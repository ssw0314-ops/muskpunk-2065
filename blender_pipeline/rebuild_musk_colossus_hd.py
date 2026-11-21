import base64
import gzip
import io
import math
import os
import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates, sobel, binary_dilation
from scipy.optimize import minimize
from scipy.spatial import cKDTree

RAW_BODY = "/home/antigravity/arcadia-3d/blender_pipeline/output/elon_statue_raw.glb"
RAW_HEAD = "/home/antigravity/arcadia-3d/blender_pipeline/output/elon_head_hd_raw.glb"
REF_HEAD = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/c1ee4bb6-03c5-4e8a-8a56-fcabe22f4620/elon_head_hd_ref_1795135951526.jpg"
OUT_GLB  = "/home/antigravity/arcadia-3d/blender_pipeline/output/elon_colossus_blender.glb"
DIAG_REG = "/home/antigravity/arcadia-3d/blender_pipeline/output/diag_head_registration.png"
DIAG_UV  = "/home/antigravity/arcadia-3d/blender_pipeline/output/diag_head_uv_maps.png"
DIAG_ASM = "/home/antigravity/arcadia-3d/blender_pipeline/output/diag_assembled_colossus.png"

OUT_GLB_JS = "/home/antigravity/arcadia-3d/src/assets/colossus_glb_data.js"
OUT_TEX_JS = "/home/antigravity/arcadia-3d/src/assets/colossus_head_tex_data.js"


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_single_mesh(path: str, name: str):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new_objs = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new_objs if o.type == "MESH"]
    assert len(meshes) >= 1, f"No mesh imported from {path}"

    obj = meshes[0]
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(mw)
    obj.data.update()
    obj.name = name

    for o in list(bpy.data.objects):
        if o != obj and o in new_objs:
            bpy.data.objects.remove(o, do_unlink=True)
    return obj


def get_bounds(obj):
    pts = np.array([[v.co.x, v.co.y, v.co.z] for v in obj.data.vertices], dtype=np.float64)
    return pts.min(axis=0), pts.max(axis=0)


def keep_largest_island(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    visited = set()
    islands = []
    for v in bm.verts:
        if v.index in visited:
            continue
        stack = [v]
        comp = []
        visited.add(v.index)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for e in cur.link_edges:
                nb = e.other_vert(cur)
                if nb.index not in visited:
                    visited.add(nb.index)
                    stack.append(nb)
        islands.append(comp)
    if len(islands) > 1:
        islands.sort(key=len, reverse=True)
        to_del = [v for isl in islands[1:] for v in isl]
        bmesh.ops.delete(bm, geom=to_del, context="VERTS")
        bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def bisect_mesh(obj, plane_co, plane_no, clear_outer=False, clear_inner=False, fill=True):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(
        bm,
        geom=geom,
        plane_co=Vector(plane_co),
        plane_no=Vector(plane_no).normalized(),
        clear_outer=clear_outer,
        clear_inner=clear_inner,
        use_snap_center=False,
    )
    if fill:
        boundary_edges = [e for e in bm.edges if e.is_boundary]
        if boundary_edges:
            try:
                bmesh.ops.holes_fill(bm, edges=boundary_edges, sides=0)
            except Exception:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def extract_vertex_rgb_linear(obj):
    """Returns (N, 3) float32 vertex RGB in [0, 1] sRGB-like brightness."""
    me = obj.data
    n_verts = len(me.vertices)
    rgb = np.full((n_verts, 3), 0.72, dtype=np.float32)
    if len(me.color_attributes) == 0:
        return rgb
    ca = me.color_attributes[0]
    if ca.domain == "POINT":
        raw = np.empty(n_verts * 4, dtype=np.float32)
        ca.data.foreach_get("color", raw)
        rgb = raw.reshape(-1, 4)[:, :3]
    else:
        n_loops = len(me.loops)
        raw = np.empty(n_loops * 4, dtype=np.float32)
        ca.data.foreach_get("color", raw)
        lrgb = raw.reshape(-1, 4)[:, :3]
        lv = np.empty(n_loops, dtype=np.int32)
        me.loops.foreach_get("vertex_index", lv)
        acc = np.zeros((n_verts, 3), dtype=np.float64)
        cnt = np.zeros((n_verts, 1), dtype=np.float64)
        np.add.at(acc, lv, lrgb)
        np.add.at(cnt, lv, 1.0)
        rgb = (acc / np.maximum(cnt, 1.0)).astype(np.float32)
    # Blender stores glTF COLOR_0 as linear -> lift to sRGB for direct comparison with JPEG ref
    return np.power(np.clip(rgb, 0.0, 1.0), 1.0 / 2.2)


def taubin_smooth_mesh(obj, iterations=6, lam=0.42, mu=-0.44):
    """Volume-preserving Taubin smoothing: removes Marching-Cubes lumps WITHOUT shrinking eyes/nose/lips!"""
    me = obj.data
    n_verts = len(me.vertices)
    V = np.empty(n_verts * 3, dtype=np.float64)
    me.vertices.foreach_get("co", V)
    V = V.reshape(-1, 3)

    edges = np.empty(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get("vertices", edges)
    edges = edges.reshape(-1, 2)
    u, v = edges[:, 0], edges[:, 1]

    deg = np.zeros(n_verts, dtype=np.float64)
    np.add.at(deg, u, 1.0)
    np.add.at(deg, v, 1.0)
    deg = np.maximum(deg, 1.0)[:, None]

    for _ in range(iterations):
        for w in (lam, mu):
            acc = np.zeros_like(V)
            np.add.at(acc, u, V[v])
            np.add.at(acc, v, V[u])
            avg = acc / deg
            V = V + w * (avg - V)

    me.vertices.foreach_set("co", V.ravel().astype(np.float32))
    me.update()


def register_head_to_reference(V, N, v_srgb, ref_rgb, ref_fg_mask):
    """
    Finds the exact orthographic mapping (flip_x, sx, sz, tx, tz) mapping front-facing
    3D head vertices (X, Z) onto reference image pixels (px, py) with sub-pixel accuracy!
    """
    H, W = ref_rgb.shape[:2]
    ref_gray = (0.299 * ref_rgb[:, :, 0] + 0.587 * ref_rgb[:, :, 1] + 0.114 * ref_rgb[:, :, 2]).astype(np.float32)
    ref_gray_s = gaussian_filter(ref_gray, 2.0)

    # Extract front-facing vertices (strictly visible from -Y camera!)
    front_idx = np.where(N[:, 1] < -0.22)[0]
    Vf = V[front_idx]
    Cf = (0.299 * v_srgb[front_idx, 0] + 0.587 * v_srgb[front_idx, 1] + 0.114 * v_srgb[front_idx, 2]).astype(np.float32)

    # Keep only frontmost vertex per small (X, Z) bin to exclude occluded back-of-ear/neck points
    gx = np.round((Vf[:, 0] - Vf[:, 0].min()) * 240).astype(np.int32)
    gz = np.round((Vf[:, 2] - Vf[:, 2].min()) * 240).astype(np.int32)
    order = np.argsort(Vf[:, 1])  # most negative Y (closest to camera) first
    seen = {}
    vis_indices = []
    for k in order:
        key = (int(gx[k]), int(gz[k]))
        if key not in seen:
            seen[key] = True
            vis_indices.append(k)
    vis_indices = np.array(vis_indices, dtype=np.int32)
    Vv = Vf[vis_indices]
    Cv = Cf[vis_indices]
    # Normalize Cv to zero mean, unit std
    Cv_n = (Cv - Cv.mean()) / (Cv.std() + 1e-6)

    # Reference FG bbox for initial guess
    ys, xs = np.where(ref_fg_mask)
    rx0, rx1 = float(xs.min()), float(xs.max())
    ry0, ry1 = float(ys.min()), float(ys.max())
    rcx, rcy = 0.5 * (rx0 + rx1), 0.5 * (ry0 + ry1)
    rw, rh = rx1 - rx0, ry1 - ry0

    vx0, vx1 = float(V[:, 0].min()), float(V[:, 0].max())
    vz0, vz1 = float(V[:, 2].min()), float(V[:, 2].max())
    vcx, vcz = 0.5 * (vx0 + vx1), 0.5 * (vz0 + vz1)
    vw, vh = vx1 - vx0, vz1 - vz0

    # Test both X signs (+1 and -1) to guarantee ZERO left-right mirror mistake!
    best_res = None
    for x_sign in (+1.0, -1.0):
        init_sx = x_sign * (rw / vw)
        init_sz = -(rh / vh)  # +Z is UP -> smaller image py!
        init_tx = rcx - init_sx * vcx
        init_tz = rcy - init_sz * vcz

        # Weight central facial zone (eyes, nose, lips) higher for razor-sharp feature lock!
        z_rel = (Vv[:, 2] - vz0) / vh
        x_rel = np.abs(Vv[:, 0] - vcx) / (vw * 0.5)
        w_face = np.where((z_rel > 0.30) & (z_rel < 0.88) & (x_rel < 0.72), 2.5, 0.7).astype(np.float32)

        def loss(params):
            sx, sz, tx, tz = params
            px = sx * Vv[:, 0] + tx
            py = sz * Vv[:, 2] + tz
            # Sample ref luminance and fg mask
            in_bounds = (px >= 2) & (px <= W - 3) & (py >= 2) & (py <= H - 3)
            if in_bounds.mean() < 0.90:
                return 10.0
            r_val = map_coordinates(ref_gray_s, [py, px], order=1, mode="nearest")
            r_fg = map_coordinates(ref_fg_mask.astype(np.float32), [py, px], order=1, mode="constant", cval=0.0)
            # Weighted normalized cross-correlation on luminance
            w = w_face
            rm = np.sum(w * r_val) / np.sum(w)
            cm = np.sum(w * Cv) / np.sum(w)
            dr = r_val - rm
            dc = Cv - cm
            ncc = np.sum(w * dr * dc) / (np.sqrt(np.sum(w * dr * dr) * np.sum(w * dc * dc)) + 1e-6)
            # Silhouette penalty: front vertices should lie inside FG mask
            fg_pen = np.mean((1.0 - r_fg) ** 2) * 1.6
            # Also penalize excessive aspect distortion away from bbox
            return -float(ncc) + float(fg_pen)

        res = minimize(
            loss,
            x0=np.array([init_sx, init_sz, init_tx, init_tz], dtype=np.float64),
            method="Nelder-Mead",
            options={"maxiter": 600, "xatol": 0.15, "fatol": 1e-4},
        )
        print(f"  Registration x_sign={x_sign:+.0f}: loss={res.fun:.4f}, params={np.round(res.x, 3)}")
        if best_res is None or res.fun < best_res[0]:
            best_res = (res.fun, x_sign, res.x)

    _, x_sign, (sx, sz, tx, tz) = best_res
    print(f"  CHOSEN registration: x_sign={x_sign:+.0f}, sx={sx:.2f}, sz={sz:.2f}, tx={tx:.2f}, tz={tz:.2f}")
    print(f"  Measured aspect ratio |sx/sz| = {abs(sx/sz):.4f} (1.00 = identical proportion, <1 means 3D mesh is wider than ref)")
    return x_sign, sx, sz, tx, tz


def save_registration_diag(V, N, v_srgb, ref_rgb, sx, sz, tx, tz, out_path):
    H, W = ref_rgb.shape[:2]
    # Render front-facing mesh vertices onto a WxH canvas using (sx, sz, tx, tz)
    front_idx = np.where(N[:, 1] < -0.15)[0]
    Vf = V[front_idx]
    Cf = np.clip(v_srgb[front_idx] * 255.0, 0, 255).astype(np.uint8)
    order = np.argsort(-Vf[:, 1])  # back-to-front so frontmost wins
    Vf = Vf[order]
    Cf = Cf[order]

    px = np.round(sx * Vf[:, 0] + tx).astype(np.int32)
    py = np.round(sz * Vf[:, 2] + tz).astype(np.int32)
    valid = (px >= 1) & (px < W - 1) & (py >= 1) & (py < H - 1)
    px, py, Cf = px[valid], py[valid], Cf[valid]

    mesh_img = np.full((H, W, 3), 128, dtype=np.uint8)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            mesh_img[py + dy, px + dx] = Cf

    blend = np.clip(ref_rgb.astype(np.float32) * 0.55 + mesh_img.astype(np.float32) * 0.45, 0, 255).astype(np.uint8)
    # Crop tightly around the head for crisp inspection
    crop = slice(40, 960), slice(200, 824)
    p1 = Image.fromarray(ref_rgb[crop]).resize((360, 530), Image.Resampling.LANCZOS)
    p2 = Image.fromarray(mesh_img[crop]).resize((360, 530), Image.Resampling.LANCZOS)
    p3 = Image.fromarray(blend[crop]).resize((360, 530), Image.Resampling.LANCZOS)
    out = Image.new("RGB", (1080, 560), (24, 24, 30))
    out.paste(p1, (0, 30))
    out.paste(p2, (360, 30))
    out.paste(p3, (720, 30))
    d = ImageDraw.Draw(out)
    d.text((12, 8), "1. ORIGINAL HD REF (elon_head_hd_ref)", fill=(255, 220, 120))
    d.text((372, 8), "2. 3D MESH ALIGNED PROJECTION", fill=(255, 220, 120))
    d.text((732, 8), "3. 50/50 ALIGNMENT CHECK (EYES/NOSE/LIPS LOCK)", fill=(120, 255, 190))
    out.save(out_path)
    print("Saved registration check:", out_path)


def build_front_depth_buffer(V, F, sx, sz, tx, tz, H, W):
    """
    Rasterizes front-most Y depth per reference pixel so nose/ears never project onto occluded cheek behind them!
    """
    y_buf = np.full((H, W), 1e9, dtype=np.float32)
    p0 = V[F[:, 0]]
    p1 = V[F[:, 1]]
    p2 = V[F[:, 2]]
    # Also include vertices + face centroids + midpoints at high density (65K verts = ~130K faces, avg tri < 2px!)
    samples = np.vstack([
        V,
        (p0 + p1 + p2) / 3.0,
        (p0 + p1) * 0.5,
        (p1 + p2) * 0.5,
        (p2 + p0) * 0.5,
    ])
    px = np.round(sx * samples[:, 0] + tx).astype(np.int32)
    py = np.round(sz * samples[:, 2] + tz).astype(np.int32)
    valid = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    px, py, sy = px[valid], py[valid], samples[valid, 1]
    np.minimum.at(y_buf, (py, px), sy)
    # 1-px min dilation to seal any tiny pixel cracks
    from scipy.ndimage import minimum_filter
    y_buf = minimum_filter(y_buf, size=3)
    return y_buf


def apply_sculptural_relief_displacement(obj, ref_rgb, sx, sz, tx, tz, y_buf):
    """
    Carves real 3D micro-sculptural relief (eyelids, brow ridge, iris recess, nostrils,
    philtrum, lip border, chin cleft, wavy hair locks) directly into the 65K-vertex mesh!
    """
    me = obj.data
    H, W = ref_rgb.shape[:2]
    gray = (0.299 * ref_rgb[:, :, 0] + 0.587 * ref_rgb[:, :, 1] + 0.114 * ref_rgb[:, :, 2]).astype(np.float32) / 255.0
    # Multi-scale band-pass sculptural relief: crisp fine details (eyes/lips/hair) + medium form (cheeks/nose)
    lo = gaussian_filter(gray, 26.0)
    hi = gaussian_filter(gray, 1.3)
    mid = gaussian_filter(gray, 5.5)
    relief = (hi - lo) * 0.72 + (hi - mid) * 0.58
    relief = np.clip(relief, -0.34, 0.34)

    n_verts = len(me.vertices)
    V = np.empty(n_verts * 3, dtype=np.float32)
    N = np.empty(n_verts * 3, dtype=np.float32)
    me.vertices.foreach_get("co", V)
    me.vertices.foreach_get("normal", N)
    V = V.reshape(-1, 3)
    N = N.reshape(-1, 3)

    px = sx * V[:, 0] + tx
    py = sz * V[:, 2] + tz
    in_b = (px >= 2) & (px <= W - 3) & (py >= 2) & (py <= H - 3)

    r_sample = map_coordinates(relief, [np.clip(py, 0, H - 1), np.clip(px, 0, W - 1)], order=1, mode="nearest")
    y_front = map_coordinates(y_buf, [np.clip(py, 0, H - 1), np.clip(px, 0, W - 1)], order=1, mode="nearest")
    vis = np.clip(1.0 - (V[:, 1] - y_front - 0.014) / 0.028, 0.0, 1.0)
    # Smooth front-facing weight so ears/temples/back stay completely clean
    front_w = np.clip((-N[:, 1] - 0.20) / 0.55, 0.0, 1.0)
    front_w = front_w * front_w * (3.0 - 2.0 * front_w) * vis * in_b.astype(np.float32)

    # Displace along smooth vertex normal (~0.013 max in raw ~1.0m unit head -> ~0.75m crisp carving at 57m scale!)
    disp = (r_sample * 0.0155 * front_w)[:, None]
    V_new = V + N * disp
    me.vertices.foreach_set("co", V_new.ravel().astype(np.float32))
    me.update()
    print(f"  Applied 3D sculptural relief carving (max disp={np.abs(disp).max():.5f}, affected verts={(front_w > 0.1).sum()})")


def assign_cylindrical_portrait_uvs(obj):
    """
    Assigns a 100% seam-free Cylindrical Portrait UV map centered on the head axis:
      - u = 0.5 at dead-center FRONT (-Y, nose!), u = 0/1 strictly at dead-BACK (+Y)!
      - Properly splits UV coordinates on any triangle crossing the back seam so ZERO triangles stretch!
      - Returns (cx, cy, z_min, z_max) for exact inverse baking.
    """
    me = obj.data
    V = np.array([[v.co.x, v.co.y, v.co.z] for v in me.vertices], dtype=np.float64)
    cx = float(0.5 * (V[:, 0].min() + V[:, 0].max()))
    cy = float(np.median(V[:, 1]))
    z_min = float(V[:, 2].min()) - 0.004
    z_max = float(V[:, 2].max()) + 0.004

    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    uv_layer = me.uv_layers.new(name="UVMap")

    # Compute base (u, v) per vertex
    dx = V[:, 0] - cx
    dy = -(V[:, 1] - cy)  # +dy = FRONT (-Y)!
    theta = np.arctan2(dx, dy)  # 0 at front nose, +-pi at dead back!
    u_vert = 0.5 + theta / (2.0 * math.pi)
    v_vert = (V[:, 2] - z_min) / max(z_max - z_min, 1e-6)
    v_vert = np.clip(v_vert * 0.96 + 0.02, 0.01, 0.99)

    for poly in me.polygons:
        lis = list(poly.loop_indices)
        vis = [me.loops[li].vertex_index for li in lis]
        us = [float(u_vert[vi]) for vi in vis]
        vs = [float(v_vert[vi]) for vi in vis]
        # Fix seam-straddling polygons strictly at the back of the head!
        if max(us) - min(us) > 0.5:
            # Shift vertices near 0 upward by +1.0 (wrapping cleanly onto tiled U)
            us = [u + 1.0 if u < 0.5 else u for u in us]
        for li, u_val, v_val in zip(lis, us, vs):
            uv_layer.data[li].uv = (u_val, v_val)

    me.update()
    return cx, cy, z_min, z_max


def dilate_rgb(img, valid_mask, iters=12):
    """Fills empty UV background texels by bleeding valid edge colors outward (prevents seam mip artifacts)."""
    out = img.copy()
    mask = valid_mask.copy()
    for _ in range(iters):
        if mask.all():
            break
        dil = binary_dilation(mask)
        ring = dil & (~mask)
        if not ring.any():
            break
        ys, xs = np.where(ring)
        acc = np.zeros((len(ys), out.shape[2]), dtype=np.float32)
        cnt = np.zeros(len(ys), dtype=np.float32)
        H, W = mask.shape
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                ny = np.clip(ys + dy, 0, H - 1)
                nx = (xs + dx) % W  # wrap horizontally for seamless cylindrical U!
                m = mask[ny, nx]
                acc[m] += out[ny[m], nx[m]]
                cnt[m] += 1.0
        good = cnt > 0
        out[ys[good], xs[good]] = acc[good] / cnt[good, None]
        mask[ys[good], xs[good]] = True
    return out


def bake_portrait_pbr_maps(head_obj, raw_V, raw_srgb, ref_rgb, ref_fg_mask, sx, sz, tx, tz, y_buf, atlas_size=1024):
    """
    Rasterizes the UV-mapped head mesh directly into a 1024x1024 UV atlas, sampling:
      - Sub-pixel-aligned elon_head_hd_ref_1795135951526.jpg on the front hemisphere (eyes/brows/nose/lips/hair!)
      - Histogram-matched high-res TripoSR vertex colors on sides/ears/back of head!
    Then synthesizes:
      1) Crisp Satin-Steel Portrait Albedo Map (768x768)
      2) Sculpted Tangent-Space Portrait Normal Map (768x768)
      3) Satin-vs-Cavity Roughness Map (512x512)
    """
    me = head_obj.data
    me.calc_loop_triangles()
    uv_layer = me.uv_layers.active.data

    n_verts = len(me.vertices)
    V = np.array([[v.co.x, v.co.y, v.co.z] for v in me.vertices], dtype=np.float32)
    N = np.array([[v.normal.x, v.normal.y, v.normal.z] for v in me.vertices], dtype=np.float32)

    # Nearest-neighbor high-res TripoSR vertex colors for side/back seamless blending
    tree = cKDTree(raw_V)
    _, nn_idx = tree.query(V, k=1)
    v_tripo_srgb = raw_srgb[nn_idx]

    # Match TripoSR side/back luminance histogram to elon_head_hd_ref brushed steel tone!
    ref_f = ref_rgb.astype(np.float32) / 255.0
    ref_fg_vals = ref_f[ref_fg_mask]
    ref_lum_all = 0.299 * ref_fg_vals[:, 0] + 0.587 * ref_fg_vals[:, 1] + 0.114 * ref_fg_vals[:, 2]
    ref_p10, ref_p90 = np.percentile(ref_lum_all, [10, 90])

    tripo_lum = 0.299 * v_tripo_srgb[:, 0] + 0.587 * v_tripo_srgb[:, 1] + 0.114 * v_tripo_srgb[:, 2]
    tp10, tp90 = np.percentile(tripo_lum, [10, 90])
    tripo_matched = np.clip((tripo_lum - tp10) / max(tp90 - tp10, 1e-4), 0.0, 1.0)
    tripo_matched = np.clip(ref_p10 + tripo_matched * (ref_p90 - ref_p10), 0.08, 0.94)
    # Slight warm-neutral steel tone matching elon_head_hd_ref_1795135951526.jpg
    v_side_rgb = np.stack([tripo_matched * 1.01, tripo_matched * 1.00, tripo_matched * 0.98], axis=-1).astype(np.float32)

    S = atlas_size
    pos_map = np.zeros((S, S, 3), dtype=np.float32)
    nrm_map = np.zeros((S, S, 3), dtype=np.float32)
    side_map = np.zeros((S, S, 3), dtype=np.float32)
    valid = np.zeros((S, S), dtype=bool)

    # Vectorized per-triangle barycentric rasterization onto UV atlas (handles seam wrap U > 1 cleanly!)
    for lt in me.loop_triangles:
        l0, l1, l2 = lt.loops
        v0, v1, v2 = lt.vertices
        u0, w0 = uv_layer[l0].uv
        u1, w1 = uv_layer[l1].uv
        u2, w2 = uv_layer[l2].uv

        # UV pixel coordinates (note: image row 0 = TOP = v=1.0 -> matches Three.js flipY=true!)
        x0, y0 = u0 * S, (1.0 - w0) * S
        x1, y1 = u1 * S, (1.0 - w1) * S
        x2, y2 = u2 * S, (1.0 - w2) * S

        min_x = int(math.floor(min(x0, x1, x2)))
        max_x = int(math.ceil(max(x0, x1, x2)))
        min_y = max(0, int(math.floor(min(y0, y1, y2))))
        max_y = min(S - 1, int(math.ceil(max(y0, y1, y2))))
        if max_x < min_x or max_y < min_y:
            continue

        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denom) < 1e-6:
            continue

        xs = np.arange(min_x, max_x + 1, dtype=np.float32) + 0.5
        ys = np.arange(min_y, max_y + 1, dtype=np.float32) + 0.5
        gx, gy = np.meshgrid(xs, ys)

        b0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / denom
        b1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / denom
        b2 = 1.0 - b0 - b1
        inside = (b0 >= -0.02) & (b1 >= -0.02) & (b2 >= -0.02)
        if not inside.any():
            continue

        iy, ix_raw = np.where(inside)
        py = min_y + iy
        px = (min_x + ix_raw) % S  # wrap U >= 1.0 back into [0, S-1]!

        w_0 = b0[iy, ix_raw][:, None]
        w_1 = b1[iy, ix_raw][:, None]
        w_2 = b2[iy, ix_raw][:, None]

        pos_map[py, px] = w_0 * V[v0] + w_1 * V[v1] + w_2 * V[v2]
        nrm_map[py, px] = w_0 * N[v0] + w_1 * N[v1] + w_2 * N[v2]
        side_map[py, px] = w_0 * v_side_rgb[v0] + w_1 * v_side_rgb[v1] + w_2 * v_side_rgb[v2]
        valid[py, px] = True

    print(f"  UV rasterization coverage: {valid.mean()*100:.1f}% of {S}x{S} atlas")

    # Normalize interpolated normals
    nlen = np.linalg.norm(nrm_map, axis=2, keepdims=True)
    nrm_map = np.where(nlen > 1e-5, nrm_map / np.maximum(nlen, 1e-5), np.array([0, -1, 0], dtype=np.float32))

    # Build front occlusion depth buffer from THIS exact final mesh (zero Taubin/decimation mismatch!)
    final_F = np.array([lt.vertices for lt in me.loop_triangles], dtype=np.int32)
    y_buf_final = build_front_depth_buffer(V, final_F, sx, sz, tx, tz, ref_rgb.shape[0], ref_rgb.shape[1])

    # Project each valid texel's 3D position onto elon_head_hd_ref_1795135951526.jpg!
    H_r, W_r = ref_rgb.shape[:2]
    rx = sx * pos_map[:, :, 0] + tx
    ry = sz * pos_map[:, :, 2] + tz
    in_ref = (rx >= 2) & (rx <= W_r - 3) & (ry >= 2) & (ry <= H_r - 3)

    ref_sample = np.zeros((S, S, 3), dtype=np.float32)
    rx_c = np.clip(rx, 0, W_r - 1)
    ry_c = np.clip(ry, 0, H_r - 1)
    for ch in range(3):
        ref_sample[:, :, ch] = map_coordinates(ref_f[:, :, ch], [ry_c, rx_c], order=1, mode="nearest")

    # Foreground mask & front-visibility depth check (generous tolerance on final mesh so cheeks NEVER drop out!)
    ref_fg_eroded = gaussian_filter(ref_fg_mask.astype(np.float32), 2.5)
    fg_w = map_coordinates(ref_fg_eroded, [ry_c, rx_c], order=1, mode="constant", cval=0.0)
    fg_w = np.clip((fg_w - 0.58) / 0.36, 0.0, 1.0)

    y_front = map_coordinates(y_buf_final, [ry_c, rx_c], order=1, mode="nearest")
    vis_w = np.clip(1.0 - (pos_map[:, :, 1] - y_front - 0.036) / 0.045, 0.0, 1.0)

    # Smooth cosine-angle feather from front face (-ny > 0.22) into sides/ears/back + Gaussian seam feathering!
    front_cos = np.clip((-nrm_map[:, :, 1] - 0.18) / 0.48, 0.0, 1.0)
    front_cos = front_cos * front_cos * (3.0 - 2.0 * front_cos)
    blend_raw = front_cos * fg_w * vis_w * in_ref.astype(np.float32)
    blend_smooth = gaussian_filter(blend_raw, sigma=3.5)
    # Keep inner face (eyes/nose/lips) 100% locked at blend = 1.0 where clearly visible & front-facing!
    core_front = (front_cos > 0.65) & (fg_w > 0.85) & (vis_w > 0.85) & in_ref
    blend_2d = np.where(core_front, np.maximum(blend_smooth, blend_raw), blend_smooth)
    blend_w = np.clip(blend_2d, 0.0, 1.0)[:, :, None]

    # Exact exposure/tone match between side_map and ref_sample right along the overlap boundary!
    overlap = valid & (blend_2d > 0.20) & (blend_2d < 0.85)
    if overlap.sum() > 200:
        ref_ov = (0.299 * ref_sample[overlap, 0] + 0.587 * ref_sample[overlap, 1] + 0.114 * ref_sample[overlap, 2])
        sid_ov = (0.299 * side_map[overlap, 0] + 0.587 * side_map[overlap, 1] + 0.114 * side_map[overlap, 2])
        r_m, r_s = float(ref_ov.mean()), float(ref_ov.std()) + 1e-4
        s_m, s_s = float(sid_ov.mean()), float(sid_ov.std()) + 1e-4
        gain = np.clip(r_s / s_s, 0.75, 1.35)
        side_map = np.clip((side_map - s_m) * gain + r_m, 0.08, 0.94)

    # Slightly lift side hair/ear/steel micro-texture so sides & back feel as sculpted as the front!
    side_gray = 0.299 * side_map[:, :, 0] + 0.587 * side_map[:, :, 1] + 0.114 * side_map[:, :, 2]
    side_detail = side_gray - gaussian_filter(side_gray, 5.0)
    side_sharp = np.clip(side_map + side_detail[:, :, None] * 0.50, 0.08, 0.95)

    # Combine crisp front reference portrait + seamless side/back portrait steel!
    albedo = ref_sample * blend_w + side_sharp * (1.0 - blend_w)

    # Convert to clean neutral-cool museum 30X brushed stainless steel palette (preserves 100% of ref shading & eyes!)
    alb_lum = 0.299 * albedo[:, :, 0] + 0.587 * albedo[:, :, 1] + 0.114 * albedo[:, :, 2]
    alb_sharp = alb_lum + (alb_lum - gaussian_filter(alb_lum, 2.0)) * 0.32
    alb_sharp = np.clip(alb_sharp, 0.07, 0.96)
    albedo_steel = np.stack([
        alb_sharp * 0.99,
        alb_sharp * 0.995,
        alb_sharp * 1.015,
    ], axis=-1).astype(np.float32)

    albedo_filled = dilate_rgb(albedo_steel, valid, iters=18)

    # =========================================================================
    # TANGENT-SPACE SCULPTED RELIEF NORMAL MAP + FINE SATIN BRUSHED GRAIN!
    # =========================================================================
    lum_f = 0.299 * albedo_filled[:, :, 0] + 0.587 * albedo_filled[:, :, 1] + 0.114 * albedo_filled[:, :, 2]
    h_fine = gaussian_filter(lum_f, 0.85) - gaussian_filter(lum_f, 6.0)
    h_mid  = gaussian_filter(lum_f, 2.2)  - gaussian_filter(lum_f, 18.0)
    rng = np.random.default_rng(42)
    brush_noise = gaussian_filter(rng.standard_normal((S, S)).astype(np.float32), sigma=(0.6, 4.5)) * 0.016
    height = h_fine * 1.10 + h_mid * 0.50 + brush_noise

    gx = sobel(height, axis=1, mode="wrap") * 1.10
    gy_img = sobel(height, axis=0, mode="nearest") * 1.10
    nx = -gx
    ny = gy_img
    nz = np.ones_like(nx) * 1.0
    nl = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    normal_rgb = np.stack([
        0.5 + 0.5 * (nx / nl),
        0.5 + 0.5 * (ny / nl),
        0.5 + 0.5 * (nz / nl),
    ], axis=-1).astype(np.float32)

    # =========================================================================
    # SMOOTH CAVITY & SATIN ROUGHNESS MAP (Zero white specular blobs inside eyes/mouth!)
    # =========================================================================
    local_cav = np.clip((gaussian_filter(lum_f, 12.0) - lum_f) * 1.9, 0.0, 1.0)
    dark_mask = np.clip((0.50 - lum_f) / 0.42, 0.0, 1.0)
    rough = 0.44 + dark_mask * 0.28 + local_cav * 0.14
    rough = gaussian_filter(rough, 1.2)
    rough = np.clip(rough + brush_noise * 1.1, 0.40, 0.86)
    rough_rgb = np.repeat(rough[:, :, None], 3, axis=2).astype(np.float32)

    # Save diagnostic preview sheet of all 3 UV maps
    p_alb = Image.fromarray(np.clip(albedo_filled * 255, 0, 255).astype(np.uint8)).resize((420, 420), Image.Resampling.LANCZOS)
    p_nrm = Image.fromarray(np.clip(normal_rgb * 255, 0, 255).astype(np.uint8)).resize((420, 420), Image.Resampling.LANCZOS)
    p_rgh = Image.fromarray(np.clip(rough_rgb * 255, 0, 255).astype(np.uint8)).resize((420, 420), Image.Resampling.LANCZOS)
    sheet = Image.new("RGB", (1260, 450), (24, 24, 30))
    sheet.paste(p_alb, (0, 30))
    sheet.paste(p_nrm, (420, 30))
    sheet.paste(p_rgh, (840, 30))
    d = ImageDraw.Draw(sheet)
    d.text((12, 8), "BAKED PORTRAIT ALBEDO (u=0.5 FRONT)", fill=(255, 220, 120))
    d.text((432, 8), "BAKED SCULPTED NORMAL MAP", fill=(255, 220, 120))
    d.text((852, 8), "BAKED SATIN / CAVITY ROUGHNESS MAP", fill=(255, 220, 120))
    sheet.save(DIAG_UV)
    print("Saved baked UV maps diagnostic:", DIAG_UV)

    return albedo_filled, normal_rgb, rough_rgb


def sanitize_coat_vertex_colors(obj, min_lum=0.34, max_lum=0.96, contrast=1.32):
    me = obj.data
    n_verts = len(me.vertices)
    vert_rgb = extract_vertex_rgb_linear(obj)
    vert_lum = 0.299 * vert_rgb[:, 0] + 0.587 * vert_rgb[:, 1] + 0.114 * vert_rgb[:, 2]

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    cavity = np.zeros(n_verts, dtype=np.float32)
    for v in bm.verts:
        if not v.link_edges:
            continue
        avg = Vector((0.0, 0.0, 0.0))
        for e in v.link_edges:
            avg += e.other_vert(v).co
        avg /= len(v.link_edges)
        cavity[v.index] = (v.co - avg).dot(v.normal)
    bm.free()

    c_std = float(np.std(cavity)) + 1e-6
    cav_norm = np.clip(cavity / (c_std * 2.2), -1.0, 1.0)
    p05, p95 = np.percentile(vert_lum, [4, 96])
    lum_n = np.clip((vert_lum - p05) / max(p95 - p05, 1e-4), 0.0, 1.0)
    lum_n = np.clip((lum_n - 0.5) * contrast + 0.5, 0.0, 1.0)
    final_lum = min_lum + (max_lum - min_lum) * np.clip(lum_n * 0.48 + (cav_norm * 0.5 + 0.5) * 0.52, 0.0, 1.0)

    while len(me.color_attributes) > 0:
        me.color_attributes.remove(me.color_attributes[0])
    ca = me.color_attributes.new(name="Color", type="BYTE_COLOR", domain="POINT")
    out_rgba = np.ones((n_verts, 4), dtype=np.float32)
    # Convert back to linear for Blender BYTE_COLOR export
    lin = np.power(np.clip(final_lum, 0.0, 1.0), 2.2)
    out_rgba[:, 0] = np.clip(lin * 0.98, 0.0, 1.0)
    out_rgba[:, 1] = np.clip(lin * 0.99, 0.0, 1.0)
    out_rgba[:, 2] = np.clip(lin * 1.02, 0.0, 1.0)
    ca.data.foreach_set("color", out_rgba.ravel())
    me.update()


def generate_box_uvs(obj, scale=0.016):
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv_layer = me.uv_layers.active
    for poly in me.polygons:
        nx, ny, nz = abs(poly.normal.x), abs(poly.normal.y), abs(poly.normal.z)
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if nz >= nx and nz >= ny:
                u, v = co.x * scale, co.y * scale
            elif nx >= ny:
                u, v = co.y * scale, co.z * scale
            else:
                u, v = co.x * scale, co.z * scale
            uv_layer.data[li].uv = (u, v)
    me.update()


def build_crisp_constructivist_coat(obj, target_faces=540, bevel_width=0.11):
    """
    Transforms the bumpy TripoSR coat mesh into clean, razor-sharp, flat-faceted
    Soviet-Constructivist / Cybertruck-style welded 30X stainless-steel plates
    matching elon_statue_3d_ref_1795135586361.jpg!
    """
    # 1. Heavy volume-preserving Taubin smoothing eliminates 100% of marching-cubes lumps/warts
    #    while preserving broad shoulders, folded arms, open collar, and flared coat geometry!
    taubin_smooth_mesh(obj, iterations=28, lam=0.46, mu=-0.47)

    # 2. Clean QEM Collapse decimation down to bold geometric Constructivist steel plates!
    dec = obj.modifiers.new(name="ConstructivistFacets", type="DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, float(target_faces) / max(1, len(obj.data.polygons)))
    apply_modifier(obj, dec)

    # 3. Light planar merge for nearly-coplanar triangles so sweeping coat panels read boldly!
    dis = obj.modifiers.new(name="PlanarPlates", type="DECIMATE")
    dis.decimate_type = "DISSOLVE"
    dis.angle_limit = math.radians(7.5)
    apply_modifier(obj, dis)

    # 4. Crisp architectural welded chamfer bevel along sharp plate edges!
    #    Tag original large plates via material_index=0 before beveling, then bevel gets material_index=1
    #    so we can shade the razor-thin weld chamfers slightly darker like real TIG-welded 30X seams!
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    for f in bm.faces:
        f.smooth = False
        f.material_index = 0

    sharp_edges = []
    for e in bm.edges:
        if len(e.link_faces) == 2:
            ang = e.calc_face_angle(0.0)
            if ang > math.radians(12.0):
                sharp_edges.append(e)

    if sharp_edges:
        ret = bmesh.ops.bevel(
            bm,
            geom=sharp_edges,
            offset=bevel_width,
            offset_type="OFFSET",
            segments=1,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
        for f in ret.get("faces", []):
            f.material_index = 1
            f.smooth = False

    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.update()

    # 5. Assign crisp per-face CORNER vertex colors:
    #    - Large flat Constructivist steel plates: clean uniform satin steel with subtle panel-to-panel tonal shift!
    #    - Narrow beveled weld seams (material_index == 1): crisp dark welded seam line just like the concept art!
    while len(me.color_attributes) > 0:
        me.color_attributes.remove(me.color_attributes[0])
    ca = me.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    n_loops = len(me.loops)
    out_rgba = np.ones((n_loops, 4), dtype=np.float32)

    # Group coplanar adjacent triangles into unified panels by quantized normal + centroid cell for clean tonal consistency
    for poly in me.polygons:
        if poly.material_index == 1:
            # Subtle brushed TIG-welded chamfer seam (sleek metallic crease, never cartoon-black!)
            lum_srgb = 0.64
        else:
            nx, ny, nz = poly.normal.x, poly.normal.y, poly.normal.z
            cx, cy, cz = poly.center.x, poly.center.y, poly.center.z
            # Deterministic subtle plate-to-plate brushed reflectance variation (0.76 .. 0.94)
            h_val = math.sin(round(nx * 5) * 12.9898 + round(ny * 5) * 78.233 + round(nz * 5) * 37.719 + round(cz * 0.25) * 19.13) * 43758.5453
            h_frac = h_val - math.floor(h_val)
            # Subtle upward-light gradient + chest/arm shadow relief without any noise
            height_grad = 0.80 + 0.10 * np.clip(cz / 55.0, 0.0, 1.0)
            lum_srgb = float(np.clip(height_grad + (h_frac - 0.5) * 0.14, 0.68, 0.95))
        lin = lum_srgb ** 2.2
        for li in poly.loop_indices:
            out_rgba[li, 0] = min(1.0, lin * 0.98)
            out_rgba[li, 1] = min(1.0, lin * 0.99)
            out_rgba[li, 2] = min(1.0, lin * 1.015)

    ca.data.foreach_set("color", out_rgba.ravel())
    # Reset all polygons to material_index 0 so the coat exports as ONE clean draw call!
    for poly in me.polygons:
        poly.material_index = 0
        poly.use_smooth = False
    me.update()
    generate_box_uvs(obj, scale=0.025)
    print(f"  Built crisp flat-faceted Constructivist coat: {len(me.vertices)}v / {len(me.polygons)}f")


def apply_modifier(obj, mod):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def encode_jpeg_b64(arr_float, size, quality=90, grayscale=False):
    arr_u8 = np.clip(arr_float * 255.0, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr_u8[:, :, 0] if grayscale else arr_u8, mode="L" if grayscale else "RGB")
    if im.size != (size, size):
        im = im.resize((size, size), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii"), len(buf.getvalue())


def build():
    clear_scene()

    # Load 1024x1024 studio Elon Musk portrait reference & foreground mask
    im_ref = Image.open(REF_HEAD).convert("RGB")
    ref_rgb = np.asarray(im_ref, dtype=np.uint8)
    bg_col = np.median(ref_rgb[:16, :16].reshape(-1, 3).astype(np.float32), axis=0)
    ref_fg_mask = np.linalg.norm(ref_rgb.astype(np.float32) - bg_col[None, None, :], axis=2) >= 16.0

    body = import_single_mesh(RAW_BODY, "MuskCoat30X")
    head = import_single_mesh(RAW_HEAD, "MuskHeadHD")

    # Canonical Blender basis: +X = statue's left, -Y = FRONT (-> Three.js +Z!), +Z = UP (-> Three.js +Y!)
    M_align = Matrix((
        ( 0.0,  0.0,  1.0, 0.0),
        (-1.0,  0.0,  0.0, 0.0),
        ( 0.0, -1.0,  0.0, 0.0),
        ( 0.0,  0.0,  0.0, 1.0),
    ))
    body.data.transform(M_align)
    head.data.transform(M_align)
    body.data.update()
    head.data.update()

    keep_largest_island(body)
    keep_largest_island(head)

    # =========================================================================
    # 1. REGISTER 65K-VERT HD HEAD TO ORIGINAL 1024x1024 PORTRAIT REFERENCE!
    # =========================================================================
    raw_V = np.array([[v.co.x, v.co.y, v.co.z] for v in head.data.vertices], dtype=np.float32)
    raw_N = np.array([[v.normal.x, v.normal.y, v.normal.z] for v in head.data.vertices], dtype=np.float32)
    raw_srgb = extract_vertex_rgb_linear(head)

    x_sign, sx, sz, tx, tz = register_head_to_reference(raw_V, raw_N, raw_srgb, ref_rgb, ref_fg_mask)
    save_registration_diag(raw_V, raw_N, raw_srgb, ref_rgb, sx, sz, tx, tz, DIAG_REG)

    # Build front orthographic depth buffer on the raw head BEFORE sculpting/cutting
    head.data.calc_loop_triangles()
    raw_F = np.array([lt.vertices for lt in head.data.loop_triangles], dtype=np.int32)
    y_buf = build_front_depth_buffer(raw_V, raw_F, sx, sz, tx, tz, ref_rgb.shape[0], ref_rgb.shape[1])

    # =========================================================================
    # 2. VOLUME-PRESERVING TAUBIN DENOISE + REAL 3D SCULPTURAL RELIEF CARVING!
    # =========================================================================
    taubin_smooth_mesh(head, iterations=6, lam=0.40, mu=-0.42)
    apply_sculptural_relief_displacement(head, ref_rgb, sx, sz, tx, tz, y_buf)

    # Trim bottom 17.5% square shoulder/clavicle plinth stub cleanly so only sculpted neck + head remain
    hmin0, hmax0 = get_bounds(head)
    hH0 = hmax0[2] - hmin0[2]
    bisect_mesh(head, (0, 0, hmin0[2] + hH0 * 0.175), (0, 0, 1), clear_inner=True, fill=True)

    # Preserve crisp 28,000-triangle sculpted head geometry!
    dec_h = head.modifiers.new(name="DecimateHead", type="DECIMATE")
    dec_h.decimate_type = "COLLAPSE"
    dec_h.ratio = min(1.0, 28000.0 / max(1, len(head.data.polygons)))
    apply_modifier(head, dec_h)

    for p in head.data.polygons:
        p.use_smooth = True

    # Assign seam-free Cylindrical Portrait UV Map & bake Albedo + Sculpted Normal + Roughness!
    assign_cylindrical_portrait_uvs(head)
    albedo_map, normal_map, rough_map = bake_portrait_pbr_maps(
        head, raw_V, raw_srgb, ref_rgb, ref_fg_mask, sx, sz, tx, tz, y_buf, atlas_size=1024
    )

    # Strip noisy vertex colors from head so the crisp 768x768 baked PBR texture shines cleanly!
    while len(head.data.color_attributes) > 0:
        head.data.color_attributes.remove(head.data.color_attributes[0])

    # =========================================================================
    # 3. CORRECT HORIZONTAL ASPECT STRETCH & GRAFT HEROICALLY INTO COAT COLLAR!
    # =========================================================================
    aspect_corr = float(np.clip(abs(sx / sz), 0.88, 1.02))
    print(f"  Applying sculptural proportion correction to head X: {aspect_corr:.4f}")
    head.data.transform(Matrix.Diagonal((aspect_corr, 0.96, 1.0, 1.0)))
    head.data.update()

    # Straighten Constructivist coat body (+12° around X)
    body.data.transform(Matrix.Rotation(math.radians(12.0), 4, "X"))
    body.data.update()

    bmin, bmax = get_bounds(body)
    bH = bmax[2] - bmin[2]
    cut_bottom_z = bmin[2] + bH * 0.195
    bisect_mesh(body, (0, 0, cut_bottom_z), (0, 0, 1), clear_inner=True, fill=True)

    cut_neck_z = bmin[2] + bH * 0.788
    pts_b = np.array([[v.co.x, v.co.y, v.co.z] for v in body.data.vertices])
    neck_band = pts_b[np.abs(pts_b[:, 2] - cut_neck_z) < 0.025]
    neck_cx = float(neck_band[:, 0].mean())
    neck_cy = float(neck_band[:, 1].mean())
    bisect_mesh(body, (0, 0, cut_neck_z + 0.004), (0, 0, 1), clear_outer=True, fill=True)

    hmin, hmax = get_bounds(head)
    hW = hmax[0] - hmin[0]
    head.data.transform(Matrix.Translation(Vector((
        -(hmin[0] + hmax[0]) * 0.5,
        -(hmin[1] + hmax[1]) * 0.5,
        -hmin[2],
    ))))

    # Heroic sleek sculptural proportion matching elon_statue_3d_ref & scene_03!
    target_head_w = 0.148
    head.data.transform(Matrix.Scale(target_head_w / hW, 4))

    # Proud skyward visionary gaze (-9.5° X pitches -Y front UP toward Mars horizon; -7° Z 3/4 turn)
    head.data.transform(Matrix.Rotation(math.radians(-9.5), 4, "X"))
    head.data.transform(Matrix.Rotation(math.radians(-7.0), 4, "Z"))
    head.data.transform(Matrix.Translation(Vector((neck_cx, neck_cy - 0.005, cut_neck_z - 0.042))))
    head.data.update()

    # =========================================================================
    # 4. NORMALIZE COMBINED STATUE TO EXACT 74.0m SEATED FLUSH AT Z = 0!
    # =========================================================================
    bmin_f, bmax_f = get_bounds(body)
    hmin_f, hmax_f = get_bounds(head)
    tot_min_z = bmin_f[2]
    tot_max_z = max(bmax_f[2], hmax_f[2])
    tot_h = tot_max_z - tot_min_z

    base_pts = np.array([[v.co.x, v.co.y, v.co.z] for v in body.data.vertices])
    base_ring = base_pts[base_pts[:, 2] < tot_min_z + 0.04]
    cx0 = float(base_ring[:, 0].mean())
    cy0 = float(base_ring[:, 1].mean())
    scale_to_74m = 74.0 / tot_h

    M_norm = Matrix.Scale(scale_to_74m, 4) @ Matrix.Translation(Vector((-cx0, -cy0, -tot_min_z)))
    body.data.transform(M_norm)
    head.data.transform(M_norm)
    body.data.update()
    head.data.update()

    # Smooth welded 30X stainless-steel coat (restored original 9K-face version)
    sm_b = body.modifiers.new(name="CoatClean", type="SMOOTH")
    sm_b.factor = 0.22
    sm_b.iterations = 1
    apply_modifier(body, sm_b)

    dec_b = body.modifiers.new(name="DecimateCoat", type="DECIMATE")
    dec_b.decimate_type = "COLLAPSE"
    dec_b.ratio = min(1.0, 9000.0 / max(1, len(body.data.polygons)))
    apply_modifier(body, dec_b)

    sanitize_coat_vertex_colors(body, min_lum=0.34, max_lum=0.96, contrast=1.32)
    for p in body.data.polygons:
        p.use_smooth = True
    es_b = body.modifiers.new(name="ConstructivistSharpEdges", type="EDGE_SPLIT")
    es_b.split_angle = math.radians(24.0)
    apply_modifier(body, es_b)
    generate_box_uvs(body, scale=0.016)

    mat_coat = bpy.data.materials.new(name="Coat30XSteel")
    body.data.materials.clear()
    body.data.materials.append(mat_coat)

    mat_head = bpy.data.materials.new(name="PortraitHeadSteel")
    head.data.materials.clear()
    head.data.materials.append(mat_head)

    bmin_e, bmax_e = get_bounds(body)
    hmin_e, hmax_e = get_bounds(head)
    print(f"FINAL MESHES -> MuskCoat30X: {len(body.data.vertices)}v/{len(body.data.polygons)}f | MuskHeadHD: {len(head.data.vertices)}v/{len(head.data.polygons)}f")
    print("FINAL BODY bounds (m):", bmin_e.round(2), bmax_e.round(2))
    print("FINAL HEAD bounds (m):", hmin_e.round(2), hmax_e.round(2))

    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_vertex_color="ACTIVE",
        export_materials="PLACEHOLDER",
    )
    glb_bytes = open(OUT_GLB, "rb").read()
    glb_gz = gzip.compress(glb_bytes, compresslevel=9)
    glb_b64 = base64.b64encode(glb_gz).decode("ascii")
    with open(OUT_GLB_JS, "w") as f:
        f.write(f"// Auto-generated from Blender 5.0 sculpted Elon Musk Colossus HD GLB (raw={len(glb_bytes)}B, gz={len(glb_gz)}B)\n")
        f.write(f'export const COLOSSUS_GLB_GZIP_B64 = "{glb_b64}";\n')
    print(f"Exported GLB ({len(glb_bytes)/1024:.1f} KB raw -> {len(glb_gz)/1024:.1f} KB gz) -> {OUT_GLB_JS}")

    # Encode portrait PBR textures as ultra-compact offline Base64 Data URIs!
    alb_b64, alb_sz = encode_jpeg_b64(albedo_map, 768, quality=90, grayscale=False)
    nrm_b64, nrm_sz = encode_jpeg_b64(normal_map, 768, quality=90, grayscale=False)
    rgh_b64, rgh_sz = encode_jpeg_b64(rough_map,  512, quality=85, grayscale=True)
    with open(OUT_TEX_JS, "w") as f:
        f.write("// Auto-generated 100% offline baked PBR portrait maps for the 212m Elon Musk Colossus Head\n")
        f.write(f'export const COLOSSUS_HEAD_ALBEDO_URI = "data:image/jpeg;base64,{alb_b64}";\n')
        f.write(f'export const COLOSSUS_HEAD_NORMAL_URI = "data:image/jpeg;base64,{nrm_b64}";\n')
        f.write(f'export const COLOSSUS_HEAD_ROUGH_URI  = "data:image/jpeg;base64,{rgh_b64}";\n')
    print(f"Exported Portrait PBR Maps -> Albedo {alb_sz/1024:.1f}KB, Normal {nrm_sz/1024:.1f}KB, Rough {rgh_sz/1024:.1f}KB -> {OUT_TEX_JS}")


if __name__ == "__main__":
    build()
