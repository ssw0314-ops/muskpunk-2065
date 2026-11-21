import * as THREE from 'three';
import { getTerrainHeight } from '../terrain.js';
import { buildRoadsterMesh, buildDetailedSkyPad } from './roadster.js';
import { buildOptimusUnit, buildMarsCyberRover } from './optimus.js';
import { mountBlenderStarshipHull } from './starship.js';
import { buildHoodedMarsLamp, buildIndustrialHvacUnit, buildIndustrialCryoSilo, buildCryoSphereTank } from './industrial_props.js';
import { enhanceGlacierIceMaterial } from '../vfx/cinematic_shaders.js';

/**
 * Open-World District & Landmark Registry (used by GTA Minimap, District Toast, and Sky-Pad COPV Recharge!)
 */
export const WORLD_DISTRICTS = [
  { id: 'ridge',    name: "FOUNDER'S RIDGE OVERLOOK",    kr: '파운더스 리지 전망대',      x: 4,    z: 4,    r: 82  },
  { id: 'colossus', name: 'MONUMENT "AD ASTRA"',         kr: '212m 머스크 거상 광장',     x: -74,  z: -56,  r: 96  },
  { id: 'canyon',   name: 'RED CANYON STUNT GORGE',      kr: '레드 캐니언 스턴트 협곡',   x: -315, z: -45,  r: 175 },
  { id: 'saloon',   name: 'THE RUSTY STARSHIP SALOON',   kr: '러스터 스타십 살룬 정비기지', x: -255, z: -385, r: 95  },
  { id: 'quarry',   name: 'ARCADIA ICE-MINING QUARRY',   kr: '아르카디아 빙하 채굴장',    x: 365,  z: -210, r: 125 },
  { id: 'megaport', name: 'ARCADIA STARSHIP MEGAPORT',   kr: '스타십 메가포트 우주항',    x: 270,  z: -590, r: 225 },
  { id: 'colony',   name: 'ARCADIA BIO-DOME BASIN',      kr: '아르카디아 바이오-돔 분지', x: 0,    z: -215, r: 185 }
];

export const SKY_PADS = [
  { name: 'SKY-PAD 02 (RIDGE)',    code: 'PAD-02', sub: 'N2-CG REFILL', x: 42,   z: -12,  y: getTerrainHeight(42, -12) + 3.6,    r: 12.2 },
  { name: 'SKY-PAD 03 (QUARRY)',   code: 'PAD-03', sub: 'ICE QUARRY',   x: 292,  z: -215, y: getTerrainHeight(292, -215) + 3.6,  r: 12.2 },
  { name: 'SKY-PAD 04 (SALOON)',   code: 'PAD-04', sub: 'SALOON BAY',   x: -206, z: -372, y: getTerrainHeight(-206, -372) + 3.6, r: 12.2 },
  { name: 'SKY-PAD 05 (MEGAPORT)', code: 'PAD-05', sub: 'MEGAPORT',     x: 195,  z: -405, y: getTerrainHeight(195, -405) + 3.6,  r: 12.2 }
];

export const HIGHWAY_PATHS = [
  // Grand Arcadia Colony Loop Highway: Ridge East Ramp -> Basin -> Megaport Gate -> Saloon -> Red Canyon Floor -> West Ramp -> Ridge
  [
    [32, -4], [68, -10], [74, -55], [74, -108], [122, -128], [156, -245], [176, -360],
    [215, -445], [215, -502], [115, -460], [-25, -365], [-165, -356], [-244, -344],
    [-312, -295], [-331, -255], [-359, -180], [-363, -140], [-352, -80], [-331, -30],
    [-299, 30], [-281, 72], [-220, 92], [-150, 38], [-148, 12], [-94, 16], [-56, 8]
  ],
  // East Ice-Mining Quarry Highway Spur
  [
    [136, -180], [215, -196], [285, -206], [345, -268], [365, -242], [365, -210]
  ]
];

function createRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4c3f38';
  ctx.fillRect(0, 0, 256, 512);
  const lg = ctx.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0.0,  'rgba(165, 92, 56, 0.92)');
  lg.addColorStop(0.14, 'rgba(85, 65, 54, 0.25)');
  lg.addColorStop(0.5,  'rgba(52, 46, 42, 0.0)');
  lg.addColorStop(0.86, 'rgba(85, 65, 54, 0.25)');
  lg.addColorStop(1.0,  'rgba(165, 92, 56, 0.92)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const v = 56 + Math.random() * 44;
    ctx.fillStyle = `rgba(${v + 16}, ${v + 4}, ${v - 6}, 0.28)`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(228, 168, 84, 0.58)';
  ctx.fillRect(34, 0, 6, 512);
  ctx.fillRect(216, 0, 6, 512);
  ctx.fillStyle = 'rgba(242, 224, 188, 0.74)';
  for (let y = 24; y < 512; y += 96) {
    ctx.fillRect(123, y, 10, 48);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function createOutpostPadTexture(code, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#39322e';
  ctx.fillRect(0, 0, 512, 512);
  const rg = ctx.createRadialGradient(256, 256, 18, 256, 256, 250);
  rg.addColorStop(0, '#5a4e47');
  rg.addColorStop(0.45, '#3b332f');
  rg.addColorStop(1, '#26211e');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(18, 14, 12, 0.72)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(256 + Math.cos(a) * 256, 256 + Math.sin(a) * 256);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d99640';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(256, 256, 224, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([22, 16]);
  ctx.strokeStyle = 'rgba(235, 198, 128, 0.65)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(256, 256, 152, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(256, 256, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8b66c';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${code} // ${sub}`, 256, 94);
  ctx.fillStyle = 'rgba(125, 211, 252, 0.82)';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('N2-CG RAPID REFILL', 256, 434);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createRampDeckTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#292e36';
  ctx.fillRect(0, 0, 256, 512);
  // Hazard yellow-black border strips
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = (y / 32) % 2 === 0 ? '#e09b32' : '#181b20';
    ctx.fillRect(0, y, 22, 32);
    ctx.fillRect(234, y, 22, 32);
  }
  // Glowing cyan launch chevron arrows!
  ctx.strokeStyle = '#45f0e0';
  ctx.lineWidth = 14;
  for (let cy = 110; cy <= 430; cy += 105) {
    ctx.beginPath();
    ctx.moveTo(64, cy + 36);
    ctx.lineTo(128, cy - 26);
    ctx.lineTo(192, cy + 36);
    ctx.stroke();
  }
  ctx.fillStyle = '#f2c879';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COLD-GAS BOOST', 128, 492);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRacingCurbTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c93326' : '#e6dfd3';
    ctx.fillRect(i * 64, 0, 64, 64);
  }
  // Subtle Martian dust weathering along lower edge
  const dg = ctx.createLinearGradient(0, 32, 0, 64);
  dg.addColorStop(0, 'rgba(155,86,48,0)');
  dg.addColorStop(1, 'rgba(155,86,48,0.45)');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 32, 256, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = 8;
  return tex;
}

function createMedevacPadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3c342f';
  ctx.fillRect(0, 0, 512, 512);
  const rg = ctx.createRadialGradient(256, 256, 20, 256, 256, 252);
  rg.addColorStop(0, '#524740');
  rg.addColorStop(0.75, '#3b332e');
  rg.addColorStop(1, '#6f422b');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 512, 512);
  // White outer perimeter ring + dashed rescue ring
  ctx.strokeStyle = 'rgba(236, 232, 224, 0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(256, 256, 218, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(220, 64, 48, 0.85)';
  ctx.lineWidth = 6;
  ctx.setLineDash([24, 14]);
  ctx.beginPath(); ctx.arc(256, 256, 170, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Crisp White Backing Circle & Crimson Medical Cross
  ctx.fillStyle = 'rgba(238, 234, 226, 0.88)';
  ctx.beginPath(); ctx.arc(256, 256, 98, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc2e24';
  ctx.fillRect(230, 182, 52, 148);
  ctx.fillRect(182, 230, 148, 52);
  ctx.fillStyle = '#f2ede4';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ARCADIA MEDEVAC · 07', 256, 86);
  ctx.fillStyle = '#f2be54';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('EMERGENCY RESCUE PAD', 256, 444);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Builds a raised 4-strip terrain-conforming sintered-basalt highway causeway (upward +Y normals, zero bleed!)
 */
function buildTerrainRoadRibbon(pointsXZ, width, roadMat, postMat, lightMat) {
  const g = new THREE.Group();
  const curvePts = pointsXZ.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.45);
  const segs = Math.max(48, Math.floor(curve.getLength() / 5.5));
  const halfW = width * 0.5;
  const skirtW = halfW + 1.8;

  const verts = [];
  const uvs = [];
  const indices = [];
  let accLen = 0;
  let prevP = null;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    if (prevP) accLen += p.distanceTo(prevP);
    prevP = p.clone();

    const lx = p.x - right.x * halfW, lz = p.z - right.z * halfW;
    const rx = p.x + right.x * halfW, rz = p.z + right.z * halfW;
    const olx = p.x - right.x * skirtW, olz = p.z - right.z * skirtW;
    const orx = p.x + right.x * skirtW, orz = p.z + right.z * skirtW;

    const hL = getTerrainHeight(lx, lz);
    const hC = getTerrainHeight(p.x, p.z);
    const hR = getTerrainHeight(rx, rz);
    const topY = Math.max(hL, hC, hR) + 0.34;
    const skirtLY = getTerrainHeight(olx, olz) - 0.55;
    const skirtRY = getTerrainHeight(orx, orz) - 0.55;

    verts.push(olx, skirtLY, olz, lx, topY, lz, rx, topY, rz, orx, skirtRY, orz);
    const vCoord = accLen / 18.0;
    uvs.push(0.0, vCoord, 0.14, vCoord, 0.86, vCoord, 1.0, vCoord);

    if (i < segs) {
      const row0 = i * 4;
      const row1 = (i + 1) * 4;
      for (let q = 0; q < 3; q++) {
        const a = row0 + q, b = row0 + q + 1, c = row1 + q, d = row1 + q + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    if (i % 7 === 0 && i > 0 && i < segs && Math.hypot(p.x, p.z - 2) > 42) {
      const side = (i / 7) % 2 === 0 ? 1 : -1;
      const px = p.x + right.x * (halfW + 1.55) * side;
      const pz = p.z + right.z * (halfW + 1.55) * side;
      const py = getTerrainHeight(px, pz);
      const lg = new THREE.Group();
      lg.position.set(px, py, pz);
      lg.rotation.y = Math.atan2(-right.x * side, -right.z * side);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.24, 6), postMat);
      base.position.y = 0.12;
      lg.add(base);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 2.35, 6), postMat);
      mast.position.y = 1.32;
      lg.add(mast);
      // Angled gooseneck arm + hooded LED roadway luminaire aiming cleanly inward over highway!
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.72), postMat);
      arm.position.set(0, 2.48, 0.32);
      arm.rotation.x = -0.18;
      lg.add(arm);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 0.44), postMat);
      hood.position.set(0, 2.55, 0.68);
      lg.add(hood);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.32), lightMat);
      lamp.position.set(0, 2.48, 0.68);
      lg.add(lamp);
      g.add(lg);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const road = new THREE.Mesh(geo, roadMat);
  road.receiveShadow = true;
  g.add(road);
  return g;
}

/**
 * Reusable Elevated Truss-Braced Circular Outpost Sky-Pad with full X-bracing, access stairs, radar mast & COPV cabinet!
 */
function buildOutpostSkyPad(pad, textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat) {
  const { x, z, code, sub } = pad;
  const gy = getTerrainHeight(x, z);
  const topTex = createOutpostPadTexture(code, sub);
  const skyPad = buildDetailedSkyPad(topTex, textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat, 3.6);
  skyPad.position.set(x, gy, z);
  return skyPad;
}

/**
 * Helper: Builds a high-detail ISO Mars Shipping Container
 * (Corrugated steel walls, corner twist-lock castings, recessed double cargo doors, vertical cam-locking rods,
 *  forklift tine pockets, vent louvers & stenciled ARCADIA LOGISTICS livery!)
 */
function buildMarsShippingContainer(colorHex, textures, darkSteel, amberMat) {
  const cg = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 512, 256);
  // Corrugated vertical steel ribbing shade + weathered lower Mars dust band
  for (let x = 0; x < 512; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 6, 0, 3, 256);
  }
  ctx.fillStyle = 'rgba(135, 68, 38, 0.34)';
  ctx.fillRect(0, 198, 512, 58);
  ctx.fillStyle = '#f2ede4';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('ARCADIA LOGISTICS', 28, 72);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('ISO-MARS · 70kPa PRESSURIZED', 28, 108);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(28, 132, 165, 6);
  const sideTex = new THREE.CanvasTexture(c);
  sideTex.colorSpace = THREE.SRGBColorSpace;

  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.64,
    metalness: 0.38
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.66,
    metalness: 0.38
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#b4bcc6', roughness: 0.34, metalness: 0.88 });

  const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.25, 2.15), [bodyMat, bodyMat, bodyMat, bodyMat, sideMat, sideMat]);
  box.castShadow = true;
  box.receiveShadow = true;
  cg.add(box);
  // Structural steel corner posts, ISO twist-lock corner castings & top/bottom frame rails!
  for (const sx of [-1.66, 1.66]) {
    for (const sz of [-1.04, 1.04]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.34, 0.18), darkSteel);
      post.position.set(sx, 0, sz);
      cg.add(post);
      for (const sy of [-1.08, 1.08]) {
        const cast = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), darkSteel);
        cast.position.set(sx, sy, sz);
        cg.add(cast);
      }
    }
  }
  for (const sy of [-1.08, 1.08]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.48, 0.14, 2.22), darkSteel);
    rail.position.y = sy;
    cg.add(rail);
  }
  // Forklift pockets along bottom rail & double rear cargo doors with 4 vertical steel cam-locking rods (+X face)
  for (const fx of [-0.65, 0.65]) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 2.28), darkSteel);
    pocket.position.set(fx, -0.98, 0);
    cg.add(pocket);
  }
  const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.02, 0.06), darkSteel);
  doorSeam.position.set(1.72, 0, 0);
  cg.add(doorSeam);
  for (const lz of [-0.62, -0.22, 0.22, 0.62]) {
    const lockBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.98, 6), chromeMat);
    lockBar.position.set(1.74, 0, lz);
    cg.add(lockBar);
  }
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.05), amberMat);
  tag.position.set(1.1, 0.72, 1.10);
  cg.add(tag);
  return cg;
}

/**
 * DISTRICT: EXTREME-DETAIL Rust-Hulk Salvaged 55m Starship Saloon & Frontier Workshop (Scene 04!)
 *  - Blender 5.0 55m salvaged rusted Starship hulk braced in basalt cradles
 *  - Multi-bay Timber Saloon + True 3D Recessed Lit Roadster Repair Garage (2-post lift, rolling tool chest,
 *    workbench, compressor, spare wheel rack!) + Cleanly mounted Fairing Trophy (zero sign clipping!)
 *  - Timber boardwalk porch w/ steps, swinging airlock saloon doors, welded-drum patio tables, sagging bulb garland
 *  - Grounded Twin N2-CG Refill Cryo Tanks on steel skirts & plinth w/ pipe bridge + A-frame Raptor 3 Hoist + Dual-Fan HVAC!
 */
function buildStarshipSaloonOutpost(textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat) {
  const g = new THREE.Group();
  const sx = -255, sz = -385;
  const sy = getTerrainHeight(sx, sz);
  g.position.set(sx, sy, sz);

  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.56, metalness: 0.30 });
  const timberMat = new THREE.MeshStandardMaterial({
    color: '#c99c72',
    map: textures.woodColor,
    normalMap: textures.woodNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.woodRough,
    roughness: 0.78,
    metalness: 0.05
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: '#343a42',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.56,
    metalness: 0.72
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#c4ccd6', roughness: 0.25, metalness: 0.90 });

  // Sintered-basalt forecourt repair apron slab + yellow perimeter safety curbing
  const yardSlab = new THREE.Mesh(new THREE.BoxGeometry(48, 0.36, 36), basaltMat);
  yardSlab.position.set(2, 0.16, 14);
  yardSlab.receiveShadow = true;
  g.add(yardSlab);

  // 1. AAA BLENDER 5.0 SALVAGED 55m STARSHIP HULK (Oxidized Weathered 30X Stainless + Black TPS + Airfoil Flaps & Raptor Bells!)
  const rustSteel = new THREE.MeshStandardMaterial({
    color: '#b47d5c',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: textures.steelRough,
    roughness: 0.66,
    metalness: 0.58
  });
  const tpsMat = new THREE.MeshStandardMaterial({
    color: '#1e2127',
    map: textures.tpsColor,
    normalMap: textures.tpsNormal,
    roughness: 0.76,
    metalness: 0.18
  });
  const rustBellMat = new THREE.MeshStandardMaterial({
    color: '#3c3634',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.48,
    metalness: 0.84,
    side: THREE.DoubleSide
  });

  const hull = new THREE.Group();
  mountBlenderStarshipHull(hull, { steel: rustSteel, tps: tpsMat, raptors: rustBellMat }, 0);
  hull.scale.setScalar(0.92);
  hull.rotation.z = 1.08;
  hull.position.set(16, 4.5, -14);
  g.add(hull);

  // Heavy basalt-and-steel cradle buttresses bracing the salvaged Starship hulk
  for (const cx of [-18, -2, 12]) {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10.5, 10.4), basaltMat);
    cradle.position.set(cx, 5.0, -14);
    cradle.castShadow = true;
    g.add(cradle);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.55, 10.8), darkSteel);
    strap.position.set(cx, 9.8, -14);
    g.add(strap);
  }

  // 2. WARM TIMBER FRONTIER SALOON WING + TRUE 3D RECESSED ROADSTER WORKSHOP BAY (Scene 04!)
  // Left Saloon Main Volume (x = -12.75 .. +4.35, z = -4.75 .. +8.75)
  const saloonWing = new THREE.Mesh(new THREE.BoxGeometry(17.1, 6.6, 13.5), wallMat);
  saloonWing.position.set(-4.2, 3.3, 2);
  saloonWing.castShadow = true;
  saloonWing.receiveShadow = true;
  g.add(saloonWing);
  // Right Workshop Bay with TRUE 3D RECESSED INTERIOR CAVITY (back wall, side walls, upper lintel — NO flat 2D plane!)
  const bayBackWall = new THREE.Mesh(new THREE.BoxGeometry(8.6, 6.6, 0.55), wallMat);
  bayBackWall.position.set(8.5, 3.3, -4.45);
  bayBackWall.castShadow = true;
  g.add(bayBackWall);
  const bayEastWall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.6, 13.5), wallMat);
  bayEastWall.position.set(12.55, 3.3, 2);
  bayEastWall.castShadow = true;
  g.add(bayEastWall);
  const bayUpperHeader = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.0, 0.65), wallMat);
  bayUpperHeader.position.set(8.5, 5.6, 8.45);
  g.add(bayUpperHeader);
  const bayFloor = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.14, 13.2), new THREE.MeshStandardMaterial({ color: '#3b3632', roughness: 0.85 }));
  bayFloor.position.set(8.5, 0.36, 2.2);
  bayFloor.receiveShadow = true;
  g.add(bayFloor);

  // Weathered timber plank frontier siding wrapping the left saloon facade (matches Scene 04!)
  const timberFacade = new THREE.Mesh(new THREE.BoxGeometry(16.6, 6.45, 0.26), timberMat);
  timberFacade.position.set(-4.35, 3.3, 8.70);
  timberFacade.receiveShadow = true;
  g.add(timberFacade);
  // Heavy architectural H-beam exterior structural pilasters along facade
  for (const px of [-12.6, -6.2, 0.2, 4.35, 12.6]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.8, 0.55), px < 3.5 ? timberMat : darkSteel);
    pil.position.set(px, 3.4, 8.78);
    g.add(pil);
  }
  // Overhanging corrugated steel roof parapet + Dual-Fan Industrial HVAC Units + Guyed Comms Mast w/ Dish & Strobe!
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.58, 14.5), darkSteel);
  roofCap.position.set(0, 6.82, 2);
  roofCap.castShadow = true;
  g.add(roofCap);
  for (const hx of [-8.8, -4.6]) {
    const hvac = buildIndustrialHvacUnit(2.8, 1.35, 2.2, steelMat, darkSteel, hazardMat);
    hvac.position.set(hx, 7.1, 1.2);
    g.add(hvac);
  }
  const commMast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 9.8, 8), darkSteel);
  commMast.position.set(10.8, 11.8, -1.5);
  g.add(commMast);
  const commDishPts = [new THREE.Vector2(0.05, 0), new THREE.Vector2(0.45, 0.10), new THREE.Vector2(0.88, 0.34)];
  const commDish = new THREE.Mesh(new THREE.LatheGeometry(commDishPts, 14), steelMat);
  commDish.position.set(10.8, 13.8, -0.95);
  commDish.rotation.x = 0.85;
  g.add(commDish);
  const redBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
  redBeacon.position.set(10.8, 16.8, -1.5);
  g.add(redBeacon);

  // Signature Salvaged Ribbed Starship Fairing Trophy perched cleanly on WEST roof eave (ZERO clipping with marquee sign!)
  const fairingTrophy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 2.15, 6.4, 14, 1, false, 0, Math.PI),
    rustSteel
  );
  fairingTrophy.rotation.z = -1.24;
  fairingTrophy.rotation.y = 0.35;
  fairingTrophy.position.set(-11.4, 7.55, 5.2);
  fairingTrophy.castShadow = true;
  g.add(fairingTrophy);

  // Recessed 3D Framed Multi-Pane Frontier Saloon Windows + Saloon Double Airlock Entry Door w/ "OPEN" Neon!
  const winGlow = new THREE.MeshBasicMaterial({ color: '#ffd080' });
  for (const wx of [-9.4, -3.2]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.9, 2.8, 0.38), darkSteel);
    frame.position.set(wx, 3.4, 8.76);
    g.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.3), winGlow);
    pane.position.set(wx, 3.4, 8.96);
    g.add(pane);
    for (const mx of [-1.1, 0, 1.1]) {
      const mul = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.4, 0.08), darkSteel);
      mul.position.set(wx + mx, 3.4, 8.99);
      g.add(mul);
    }
    const barLine = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.10, 0.08), darkSteel);
    barLine.position.set(wx, 3.7, 8.99);
    g.add(barLine);
  }
  // Frontier Saloon Entry Doorway at x = 2.1
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.25, 0.42), darkSteel);
  doorFrame.position.set(2.1, 2.25, 8.78);
  g.add(doorFrame);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.45), winGlow);
  doorGlass.position.set(2.1, 2.38, 9.00);
  g.add(doorGlass);
  const doorMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.55, 0.08), darkSteel);
  doorMid.position.set(2.1, 2.38, 9.02);
  g.add(doorMid);
  const openSign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.10), cyanMat);
  openSign.position.set(2.1, 4.15, 8.98);
  g.add(openSign);

  // TRUE 3D Illuminated Roadster Repair Garage Bay Interior (2-post hydraulic lift, rolling tool cabinet, workbench & tire rack!)
  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.65, 0.55), hazardMat);
    jamb.position.set(8.5 + side * 3.65, 2.55, 8.68);
    g.add(jamb);
  }
  const bayLintel = new THREE.Mesh(new THREE.BoxGeometry(7.75, 0.45, 0.55), hazardMat);
  bayLintel.position.set(8.5, 4.78, 8.68);
  g.add(bayLintel);
  // Rolled ribbed shutter header + twin overhead shop LED light fixtures inside bay
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.65, 0.65), steelMat);
  shutter.position.set(8.5, 4.35, 8.65);
  g.add(shutter);
  const shopLampMat = new THREE.MeshBasicMaterial({ color: '#fff3d4' });
  for (const lz of [1.5, 5.5]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.14, 0.28), shopLampMat);
    lamp.position.set(8.5, 5.85, lz);
    g.add(lamp);
  }
  // 2-Post Hydraulic Roadster Lift inside garage!
  for (const lx of [6.1, 10.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.2, 0.36), hazardMat);
    post.position.set(lx, 2.45, 3.2);
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.18), darkSteel);
    arm.position.set(lx + (lx < 8.5 ? 0.65 : -0.65), 1.05, 3.2);
    g.add(arm);
  }
  // Detailed Multi-Drawer Red Mechanic's Tool Chest + Workbench + Diagnostic Monitor + Air Compressor!
  const chestMat = new THREE.MeshStandardMaterial({ color: '#b82d22', roughness: 0.36, metalness: 0.45 });
  const toolBase = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.15, 0.78), chestMat);
  toolBase.position.set(5.6, 1.02, 6.2);
  g.add(toolBase);
  for (let dr = 0; dr < 4; dr++) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.04, 0.06), chromeMat);
    handle.position.set(5.6, 0.65 + dr * 0.24, 6.61);
    g.add(handle);
  }
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 1.1), timberMat);
  benchTop.position.set(8.5, 1.32, -3.55);
  g.add(benchTop);
  const diagMon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.72, 0.10), cyanMat);
  diagMon.position.set(8.5, 2.05, -3.75);
  g.add(diagMon);
  const compTank = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.05, 6, 10), new THREE.MeshStandardMaterial({ color: '#2b5f8a', roughness: 0.42, metalness: 0.55 }));
  compTank.position.set(11.4, 1.25, -3.4);
  g.add(compTank);
  for (let ts = 0; ts < 3; ts++) {
    const spareTire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.14, 8, 14), darkSteel);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(11.2, 0.50 + ts * 0.28, 7.6);
    g.add(spareTire);
  }
  // Customer Tesla Roadster parked cleanly outside the open illuminated workshop bay!
  const bayCar = buildRoadsterMesh(textures);
  bayCar.car.position.set(8.5, 0.34, 15.2);
  bayCar.car.rotation.y = 0.24;
  bayCar.setThrusterFx(0, 0, 0, 0, 0);
  g.add(bayCar.car);

  // Raised Timber Frontier Boardwalk Porch + Steps + Welded-Drum Patio Tables + Cantilevered Canopy + Bulb Garland!
  const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.44, 5.0), timberMat);
  porchDeck.position.set(-4.1, 0.48, 11.3);
  porchDeck.receiveShadow = true;
  g.add(porchDeck);
  // Porch entry stairs at saloon door (x = 2.1)
  for (let st = 0; st < 2; st++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.55), timberMat);
    step.position.set(2.1, 0.24 - st * 0.14, 14.05 + st * 0.48);
    g.add(step);
  }
  // Twin Frontier Welded-Drum Patio Tables & Bar Stools on porch!
  for (const tx of [-9.4, -3.2]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.96, 12), darkSteel);
    drum.position.set(tx, 1.18, 11.4);
    g.add(drum);
    const tblTop = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.08, 14), timberMat);
    tblTop.position.set(tx, 1.70, 11.4);
    g.add(tblTop);
    for (const sx2 of [-0.95, 0.95]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.68, 10), timberMat);
      stool.position.set(tx + sx2, 1.04, 11.4);
      g.add(stool);
    }
  }
  const awning = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.34, 5.5), darkSteel);
  awning.position.set(0, 5.78, 11.1);
  awning.rotation.x = 0.12;
  awning.castShadow = true;
  g.add(awning);
  for (const px of [-12.2, -5.8, 0.6, 4.4, 12.2]) {
    const colMat = px <= 1.0 ? timberMat : darkSteel;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5.4, 0.32), colMat);
    col.position.set(px, 2.75, 13.4);
    g.add(col);
    const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), colMat);
    gusset.position.set(px, 4.85, 12.9);
    gusset.rotation.x = 0.78;
    g.add(gusset);
  }
  // Sagging Edison string-light catenary cord + hooded warm frontier bulbs!
  const cordPts = [];
  for (let bx = -12.0; bx <= 12.0; bx += 2.0) {
    const sag = Math.abs(Math.sin((bx + 12) * 0.48)) * 0.28;
    cordPts.push(new THREE.Vector3(bx, 5.38 - sag, 13.56));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), amberMat);
    bulb.position.set(bx, 5.24 - sag, 13.56);
    g.add(bulb);
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 24, 0.025, 5, false), darkSteel));

  // 3. SCULPTED 3D MARQUEE GANTRY SIGN: "THE RUSTY STARSHIP // SALOON & WORKSHOP" (100% Unobstructed!)
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b120d';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#e89d42';
  ctx.lineWidth = 7;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ffd584';
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THE RUSTY STARSHIP', 256, 64);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('SALOON & WORKSHOP · ROADSTER REPAIR · SOL 0042', 256, 102);
  const signTex = new THREE.CanvasTexture(c);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(15.8, 4.1, 0.52), darkSteel);
  signBack.position.set(1.2, 9.05, 8.4);
  g.add(signBack);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(15.0, 3.6), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(1.2, 9.05, 8.68);
  g.add(sign);
  for (const sx2 of [-4.6, 1.2, 7.0]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.5, 0.24), darkSteel);
    strut.position.set(sx2, 7.75, 7.6);
    strut.rotation.x = 0.52;
    g.add(strut);
  }

  // 4. PARABOLIC LATHE RAPTOR 3 ENGINE BELL + TURBOPUMP + HOIST TROLLEY & LIFT CHAIN ON A-FRAME!
  const hoistG = new THREE.Group();
  for (const hx of [-2.4, 2.4]) {
    for (const hz of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 0.22), darkSteel);
      leg.position.set(hx, 2.55, hz * 0.55);
      leg.rotation.x = hz * -0.18;
      hoistG.add(leg);
    }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 2.1), darkSteel);
    foot.position.set(hx, 0.09, 0);
    hoistG.add(foot);
  }
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.36, 0.36), hazardMat);
  topBeam.position.y = 5.0;
  hoistG.add(topBeam);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.62), darkSteel);
  trolley.position.y = 4.78;
  hoistG.add(trolley);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6), chromeMat);
  chain.position.y = 4.35;
  hoistG.add(chain);
  const bellPts = [
    new THREE.Vector2(0.45, 2.4), new THREE.Vector2(0.32, 2.0),
    new THREE.Vector2(0.68, 1.3), new THREE.Vector2(1.08, 0.55), new THREE.Vector2(1.24, 0.0)
  ];
  const rBell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 18), steelMat);
  rBell.position.y = 1.15;
  rBell.castShadow = true;
  hoistG.add(rBell);
  const turboHead = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.95, 12), darkSteel);
  turboHead.position.y = 3.85;
  hoistG.add(turboHead);
  hoistG.position.set(-15.5, 0.25, 15.0);
  hoistG.rotation.y = 0.38;
  g.add(hoistG);

  // 5. HIGH-DETAIL ISO MARS SHIPPING CONTAINERS (with cam-lock doors, castings & stenciled livery!)
  const cont1 = buildMarsShippingContainer('#a86234', textures, darkSteel, amberMat);
  cont1.position.set(-11.2, 1.46, 19.6);
  cont1.rotation.y = 0.14;
  g.add(cont1);
  const cont2 = buildMarsShippingContainer('#4b5d6b', textures, darkSteel, cyanMat);
  cont2.position.set(-10.8, 3.74, 19.5);
  cont2.rotation.y = -0.06;
  g.add(cont2);

  // 6. GROUNDED TWIN HIGH-PRESSURE N2-CG REFILL CRYO TANKS ON CONCRETE PLINTH + STEEL SKIRTS + OVERHEAD PIPE BRIDGE!
  const tankPlinth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.55, 4.0), basaltMat);
  tankPlinth.position.set(18.15, 0.42, 6.0);
  tankPlinth.receiveShadow = true;
  g.add(tankPlinth);
  for (let ti = 0; ti < 2; ti++) {
    const tx2 = 16.6 + ti * 3.1;
    // 4 Grounded Steel Support Skirt Legs per tank (ZERO floating capsule bottoms!)
    for (let lg = 0; lg < 4; lg++) {
      const la = (lg / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.2, 6), darkSteel);
      leg.position.set(tx2 + Math.cos(la) * 0.95, 1.65, 6.0 + Math.sin(la) * 0.95);
      g.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(1.18, 5.4, 8, 16), steelMat);
    tank.position.set(tx2, 4.9, 6.0);
    tank.castShadow = true;
    g.add(tank);
    for (const by of [3.2, 6.6]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.09, 6, 18), by > 5 ? cyanMat : darkSteel);
      band.rotation.x = Math.PI / 2;
      band.position.set(tx2, by, 6.0);
      g.add(band);
    }
    const topValve = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.95, 8), hazardMat);
    topValve.position.set(tx2, 9.15, 6.0);
    g.add(topValve);
  }
  // Overhead insulated feed manifold pipe running from N2-CG cryo tanks directly into workshop east wall!
  const feedPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7.6, 8), chromeMat);
  feedPipe.rotation.z = Math.PI / 2;
  feedPipe.position.set(16.1, 4.8, 6.0);
  g.add(feedPipe);

  // Warm frontier floodlight spilling across the saloon forecourt + Hooded Architectural Bollards!
  const pl = new THREE.PointLight('#ffbd66', 46, 62, 1.45);
  pl.position.set(0, 9.0, 15);
  g.add(pl);
  for (let bx = -18; bx <= 20; bx += 9.5) {
    const bg = new THREE.Group();
    bg.position.set(bx, 0.34, 25.5);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.18, 8), darkSteel);
    foot.position.y = 0.09;
    bg.add(foot);
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.96, 8), darkSteel);
    bol.position.y = 0.62;
    bg.add(bol);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), amberMat);
    lens.position.y = 1.20;
    bg.add(lens);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 8), darkSteel);
    hood.position.y = 1.38;
    bg.add(hood);
    g.add(bg);
  }
  return g;
}

/**
 * DISTRICT: EXTREME-DETAIL Arcadia Subsurface Water-Ice Quarry & Sabatier Refinery (Scene 05!)
 *  - Tapered 48m Pyramid Steel Lattice Oil-Rig Style Rotary Ice-Drill Derrick w/ 4 tiers of X-bracing,
 *    grated steel catwalks, yellow safety railings, top-drive rotary gearbox & floodlight bar
 *  - Faceted Crystalline Glacier Water-Ice Pit Floor + Jagged Frozen Ice Ledges + Cryo-Vapor Plume
 *  - Elevated Truss-Braced Cryo Pipeline Bridge linking Pit to Detailed Sabatier Electrolysis Silos & Pressure Spheres
 */
function buildIceMiningQuarry(textures, darkSteel, steelMat, amberMat, cyanMat) {
  const g = new THREE.Group();
  const qx = 365, qz = -210;
  const pitY = getTerrainHeight(qx, qz);
  g.position.set(qx, pitY, qz);

  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d6952e', roughness: 0.54, metalness: 0.30 });
  const siloSoftMat = new THREE.MeshStandardMaterial({
    color: '#bac2cb',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughnessMap: textures.steelRough,
    roughness: 0.50,
    metalness: 0.74,
    envMapIntensity: 0.66
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: '#6b5c53', map: textures.basaltColor, normalMap: textures.basaltNormal, roughness: 0.90, metalness: 0.08
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#d8e0ea', roughness: 0.18, metalness: 0.92 });

  // Faceted Crystalline Subsurface Glacier Ice Pit Floor + Jagged Extracted Ice Boulders + Wellhead Collar!
  const iceSlabMat = enhanceGlacierIceMaterial(new THREE.MeshStandardMaterial({
    color: '#88cfee',
    normalMap: textures.rockNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.24,
    metalness: 0.10
  }), new THREE.Vector3(qx, pitY, qz));
  const iceFloor = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 0.85, 48), iceSlabMat);
  iceFloor.position.y = 0.25;
  iceFloor.receiveShadow = true;
  g.add(iceFloor);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const dist = 15.5 + (i % 3) * 4.5;
    const crystal = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0 + (i % 2) * 1.15, 0), iceSlabMat);
    crystal.scale.set(1.4, 0.85, 1.1);
    crystal.position.set(Math.cos(a) * dist, 1.2, Math.sin(a) * dist);
    crystal.rotation.set(0.2, a, 0.15);
    crystal.castShadow = true;
    g.add(crystal);
  }
  // Heavy Steel Borehole Wellhead Collar & Blowout Preventer Manifold
  const wellCollar = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.35, 16), darkSteel);
  wellCollar.position.y = 1.05;
  g.add(wellCollar);
  const wellFlange = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.22, 6, 18), hazardMat);
  wellFlange.rotation.x = Math.PI / 2;
  wellFlange.position.y = 1.72;
  g.add(wellFlange);

  // Tapered 48m Pyramid Steel Lattice Rotary Ice-Drill Derrick!
  const gantry = new THREE.Group();
  const baseX = 12.8, baseZ = 9.4;
  const topX = 8.4, topZ = 6.2;
  const derrickH = 40.0;

  // 4 Concrete Corner Footings + Tapered Angled H-Beam Corner Legs
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 2.8), concreteMat);
      foot.position.set(sx * baseX, 0.6, sz * baseZ);
      gantry.add(foot);
      const pBot = new THREE.Vector3(sx * baseX, 0.8, sz * baseZ);
      const pTop = new THREE.Vector3(sx * topX, derrickH, sz * topZ);
      const dir = new THREE.Vector3().subVectors(pTop, pBot);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.08, dir.length(), 1.08), darkSteel);
      leg.position.copy(pBot).add(pTop).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      leg.castShadow = true;
      gantry.add(leg);
    }
  }

  // 4 Structural Catwalk Tiers + Grated Walkways + Diagonal X-Bracing + Stanchioned Yellow Safety Handrails
  const tiers = [10, 20, 30, 39];
  tiers.forEach((ty, ti) => {
    const frac = ty / derrickH;
    const lx = THREE.MathUtils.lerp(baseX, topX, frac);
    const lz = THREE.MathUtils.lerp(baseZ, topZ, frac);

    for (const sz of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(lx * 2 + 0.6, 0.72, 0.64), darkSteel);
      beam.position.set(0, ty, sz * lz);
      gantry.add(beam);
      // Grated steel inspection walkway plank along north/south faces
      const walkway = new THREE.Mesh(new THREE.BoxGeometry(lx * 2 + 0.6, 0.14, 1.35), darkSteel);
      walkway.position.set(0, ty + 0.36, sz * (lz + 0.48));
      gantry.add(walkway);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(lx * 2 + 0.6, 0.14, 0.14), hazardMat);
      rail.position.set(0, ty + 1.42, sz * (lz + 1.05));
      gantry.add(rail);
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(lx * 2 + 0.6, 0.08, 0.08), hazardMat);
      midRail.position.set(0, ty + 0.92, sz * (lz + 1.05));
      gantry.add(midRail);
      for (let px = -lx; px <= lx + 0.1; px += Math.max(3.5, lx * 0.5)) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.10, 0.10), hazardMat);
        post.position.set(px, ty + 0.90, sz * (lz + 1.05));
        gantry.add(post);
      }
    }
    for (const sx of [-1, 1]) {
      const sBeam = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.72, lz * 2 + 0.6), darkSteel);
      sBeam.position.set(sx * lx, ty, 0);
      gantry.add(sBeam);
      const sRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, lz * 2 + 1.4), hazardMat);
      sRail.position.set(sx * (lx + 0.45), ty + 1.42, 0);
      gantry.add(sRail);
      const prevY = ti === 0 ? 1.0 : tiers[ti - 1];
      const midY = (ty + prevY) * 0.5;
      const midLx = THREE.MathUtils.lerp(baseX, topX, midY / derrickH);
      const midLz = THREE.MathUtils.lerp(baseZ, topZ, midY / derrickH);
      for (const sgn of [-1, 1]) {
        const xb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 16.2, 0.32), ti % 2 === 0 ? hazardMat : darkSteel);
        xb.position.set(sx * midLx, midY, 0);
        xb.rotation.x = sgn * 0.88;
        gantry.add(xb);
      }
      // Front/Back X-bracing diagonals too
      for (const sz of [-1, 1]) {
        const fb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 16.8, 0.28), darkSteel);
        fb.position.set(sx * midLx * 0.46, midY, sz * midLz);
        fb.rotation.z = sx * (ti % 2 === 0 ? 0.65 : -0.65);
        gantry.add(fb);
      }
    }
  });

  // External Caged Steel Access Ladder climbing up the west leg of the drill derrick
  const ladBot = new THREE.Vector3(-baseX - 0.85, 1.2, 0);
  const ladTop = new THREE.Vector3(-topX - 0.85, 39.5, 0);
  const ladDir = new THREE.Vector3().subVectors(ladTop, ladBot);
  const ladLen = ladDir.length();
  const ladG = new THREE.Group();
  ladG.position.copy(ladBot).add(ladTop).multiplyScalar(0.5);
  ladG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ladDir.clone().normalize());
  for (const lz of [-0.28, 0.28]) {
    const lr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ladLen, 6), hazardMat);
    lr.position.z = lz;
    ladG.add(lr);
  }
  for (let ly = -ladLen * 0.45; ly <= ladLen * 0.45; ly += 3.2) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 5, 10, Math.PI), darkSteel);
    hoop.rotation.x = Math.PI / 2;
    hoop.rotation.z = Math.PI / 2;
    hoop.position.set(-0.22, ly, 0);
    ladG.add(hoop);
  }
  gantry.add(ladG);

  // Crown Hoist Deck + Detailed Top-Drive Gearbox Housing (Cooling Louvers, Exhaust Stacks, Hooded Floodlights)!
  const crownDeck = new THREE.Mesh(new THREE.BoxGeometry(20.4, 2.0, 15.2), darkSteel);
  crownDeck.position.y = 40.4;
  crownDeck.castShadow = true;
  gantry.add(crownDeck);
  const crownStripe = new THREE.Mesh(new THREE.BoxGeometry(20.8, 0.65, 15.6), hazardMat);
  crownStripe.position.y = 41.5;
  gantry.add(crownStripe);
  const hoistHouse = new THREE.Mesh(new THREE.BoxGeometry(9.4, 5.4, 8.6), siloSoftMat);
  hoistHouse.position.y = 44.5;
  hoistHouse.castShadow = true;
  gantry.add(hoistHouse);
  const hoistRoof = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.65, 9.2), darkSteel);
  hoistRoof.position.y = 47.4;
  gantry.add(hoistRoof);
  // Recessed cooling louvers & twin exhaust stacks on Top-Drive Hoist House
  for (const sz of [-1, 1]) {
    for (let lv = 0; lv < 3; lv++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.34, 0.22), darkSteel);
      slat.position.set(0, 43.2 + lv * 1.15, sz * 4.35);
      gantry.add(slat);
    }
  }
  for (const ex of [-2.8, 2.8]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.2, 8), darkSteel);
    stack.position.set(ex, 49.0, -2.4);
    gantry.add(stack);
  }
  const crownMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 7.0, 8), darkSteel);
  crownMast.position.y = 50.8;
  gantry.add(crownMast);
  const topBeaconHood = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 8), darkSteel);
  topBeaconHood.position.y = 54.0;
  gantry.add(topBeaconHood);
  const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), amberMat);
  topBeacon.position.y = 54.45;
  gantry.add(topBeacon);

  // 6 Angled Hooded Mining Floodlights around Crown Deck
  const workLampMat = new THREE.MeshBasicMaterial({ color: '#e6f7ff' });
  for (const lx of [-7.2, 0, 7.2]) {
    for (const sz of [-1, 1]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.55), darkSteel);
      bracket.position.set(lx, 39.25, sz * 7.35);
      gantry.add(bracket);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 0.58), darkSteel);
      hood.position.set(lx, 38.88, sz * 7.62);
      hood.rotation.x = sz * 0.45;
      gantry.add(hood);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 0.14), workLampMat);
      lens.position.set(lx, 38.78, sz * 7.75);
      lens.rotation.x = sz * 0.45;
      gantry.add(lens);
    }
  }

  // Spinning Helical Ice-Core Auger Shaft + Multi-Blade Tungsten-Carbide Rotary Drill Bit Head!
  const drillGroup = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.50, 41.5, 12), siloSoftMat);
  shaft.position.y = 21.2;
  drillGroup.add(shaft);
  const kellyDrive = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.9, 3.2, 8), hazardMat);
  kellyDrive.position.y = 38.0;
  drillGroup.add(kellyDrive);
  for (let fl = 0; fl < 8; fl++) {
    const auger = new THREE.Mesh(new THREE.TorusGeometry(2.48, 0.34, 6, 16), hazardMat);
    auger.position.y = 3.2 + fl * 4.4;
    auger.rotation.x = Math.PI / 2 + 0.40;
    drillGroup.add(auger);
  }
  // 4-Blade Rotary Tungsten-Carbide Cutter Head grinding into the borehole
  const bitHub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 2.4, 8), darkSteel);
  bitHub.position.y = 1.6;
  drillGroup.add(bitHub);
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.36), hazardMat);
    blade.position.set(Math.cos(a) * 2.1, 1.35, Math.sin(a) * 2.1);
    blade.rotation.y = -a + 0.3;
    drillGroup.add(blade);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.42), chromeMat);
    tooth.position.set(Math.cos(a) * 3.1, 0.85, Math.sin(a) * 3.1);
    tooth.rotation.y = -a;
    drillGroup.add(tooth);
  }
  gantry.add(drillGroup);

  // Soft Volumetric Fresnel GLSL Cryo-Vapor Borehole Mist (Zero hard geometric cylinder edges!)
  const vaporMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.24 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        float ndotv = abs(dot(normalize(vNormal), normalize(vViewPos)));
        float edgeFade = pow(ndotv, 1.45);
        float vertFade = smoothstep(0.0, 0.24, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float wisp = 0.58 + 0.42 * sin(vUv.x * 18.85 + uTime * 1.4 + sin(vUv.y * 8.0 - uTime * 2.2) * 1.6);
        float wisp2 = 0.65 + 0.35 * cos(vUv.x * 31.4 - uTime * 1.9 + vUv.y * 10.0);
        float alpha = edgeFade * vertFade * wisp * wisp2 * uOpacity * 1.45;
        vec3 col = mix(vec3(0.55, 0.86, 1.0), vec3(0.92, 0.98, 1.0), vUv.y * 0.6 + 0.3);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const vaporCone = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 3.0, 14.5, 24, 6, true), vaporMat);
  vaporCone.position.y = 7.2;
  gantry.add(vaporCone);

  const pitGlow = new THREE.PointLight('#7dd3fc', 46, 76, 1.4);
  pitGlow.position.set(0, 8.0, 0);
  gantry.add(pitGlow);
  g.add(gantry);

  // Sabatier Electrolysis Refinery Silos (Industrial Cryo Silos w/ Deep Sloped Footings + Connecting Pipe Bridges!)
  const rimSilos = [[-54, -46], [-40, -54], [-66, -34], [55, -36], [68, -28]];
  rimSilos.forEach(([ox, oz], idx) => {
    const ry = getTerrainHeight(qx + ox, qz + oz) - pitY;
    const h = 20 + (idx % 2) * 8;
    // Deep slope-compensating concrete foundation pier so silo plinth NEVER overhangs pit rim
    const subPier = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.8, 6.0, 8), concreteMat);
    subPier.position.set(ox, ry - 2.9, oz);
    g.add(subPier);
    const silo = buildIndustrialCryoSilo(4.2, h, textures, {
      steelMat: siloSoftMat,
      darkMat: darkSteel,
      concreteMat,
      accentMat: idx % 2 === 0 ? cyanMat : amberMat,
      hazardMat
    });
    silo.position.set(ox, ry - 0.15, oz);
    silo.rotation.y = idx * 1.1;
    g.add(silo);
  });
  // Overhead inter-silo catwalk & cryogenic pipe bridges linking west & east refinery banks
  const siloLinks = [[[-54, -46], [-40, -54]], [[-54, -46], [-66, -34]], [[55, -36], [68, -28]]];
  for (const [[x1, z1], [x2, z2]] of siloLinks) {
    const y1 = getTerrainHeight(qx + x1, qz + z1) - pitY + 17.5;
    const y2 = getTerrainHeight(qx + x2, qz + z2) - pitY + 17.5;
    const p1 = new THREE.Vector3(x1, y1, z1);
    const p2 = new THREE.Vector3(x2, y2, z2);
    const d = p2.clone().sub(p1);
    const len = d.length();
    const br = new THREE.Group();
    br.position.copy(p1).add(p2).multiplyScalar(0.5);
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
    br.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, len), darkSteel));
    for (const rx of [-0.72, 0.72]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), hazardMat);
      r.position.set(rx, 0.95, 0);
      br.add(r);
    }
    const pPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, len, 8), siloSoftMat);
    pPipe.rotation.x = Math.PI / 2;
    pPipe.position.set(0, -0.58, 0);
    br.add(pPipe);
    g.add(br);
  }

  // Twin Grounded Cryogenic H2O/LOX Hortonsphere Tanks perched firmly on quarry rim (ZERO floating spheres!)
  for (const [spX, spZ] of [[-28, -56], [42, -46]]) {
    const sy = getTerrainHeight(qx + spX, qz + spZ) - pitY;
    const deepFooting = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 5.5, 12), concreteMat);
    deepFooting.position.set(spX, sy - 3.2, spZ);
    g.add(deepFooting);
    const sphTank = buildCryoSphereTank(4.6, textures, {
      steelMat: siloSoftMat,
      darkMat: darkSteel,
      concreteMat,
      bandMat: cyanMat,
      hazardMat
    });
    sphTank.position.set(spX, sy - 0.15, spZ);
    g.add(sphTank);
  }

  // Overhead Insulated Twin Cryo-Water Pipeline Bridge + Grounded H-Frame Trestle Stanchions & Flange Collars!
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4, 4.2, -4),
    new THREE.Vector3(-22, 10.5, -22),
    new THREE.Vector3(-48, getTerrainHeight(qx - 48, qz - 46) - pitY + 6.0, -46)
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 24, 0.78, 10, false), siloSoftMat));
  // Parallel insulated return line
  const pipeCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.6, 3.6, -5.4),
    new THREE.Vector3(-20.8, 9.9, -23.4),
    new THREE.Vector3(-46.8, getTerrainHeight(qx - 48, qz - 46) - pitY + 5.4, -47.2)
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve2, 22, 0.44, 8, false), darkSteel));
  for (const u of [0.16, 0.34, 0.52, 0.70, 0.88]) {
    const pt = pipeCurve.getPoint(u);
    const tan = pipeCurve.getTangent(u).normalize();
    const gRelY = getTerrainHeight(qx + pt.x, qz + pt.z) - pitY;
    const legH = Math.max(2.5, pt.y - gRelY + 1.8);
    // Bolted pipe expansion flange collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.16, 6, 14), hazardMat);
    collar.position.copy(pt);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    g.add(collar);
    // Grounded H-frame pipe-rack trestle bent
    const rightPerp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const bentG = new THREE.Group();
    for (const s of [-1.2, 1.2]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.42, legH, 0.42), darkSteel);
      col.position.set(pt.x + rightPerp.x * s, gRelY - 1.5 + legH * 0.5, pt.z + rightPerp.z * s);
      col.castShadow = true;
      bentG.add(col);
      const padF = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.1), concreteMat);
      padF.position.set(pt.x + rightPerp.x * s, gRelY - 0.5, pt.z + rightPerp.z * s);
      bentG.add(padF);
    }
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.40, 0.48), darkSteel);
    crossB.position.set(pt.x, pt.y - 0.85, pt.z);
    crossB.rotation.y = Math.atan2(tan.x, tan.z);
    bentG.add(crossB);
    g.add(bentG);
  }

  // Scene 05 Signature Mars Lattice-Boom Dragline Mining Excavator Crane perched on south-east rim bench!
  {
    const cx = 34, cz = 36;
    const benchTopY = getTerrainHeight(qx + cx, qz + cz) - pitY + 2.2;
    const craneG = new THREE.Group();
    craneG.position.set(cx, benchTopY, cz);
    craneG.rotation.y = Math.atan2(-cx * 0.65, -cz);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(15.2, 9.5, 17.2), concreteMat);
    bench.position.y = -4.75;
    bench.receiveShadow = true;
    craneG.add(bench);

    // Sculpted Heavy Crawler Tracks w/ Drive Sprockets, Bogie Rollers & Grouser Tread Bars!
    for (const tx of [-3.5, 3.5]) {
      const trackFrame = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.55, 9.6), darkSteel);
      trackFrame.position.set(tx, 1.05, 0);
      trackFrame.castShadow = true;
      craneG.add(trackFrame);
      const topBelt = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.28, 10.6), darkSteel);
      topBelt.position.set(tx, 1.88, 0);
      craneG.add(topBelt);
      const botBelt = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.26, 10.4), darkSteel);
      botBelt.position.set(tx, 0.16, 0);
      craneG.add(botBelt);
      // Front & rear sprocket drive wheels
      for (const sz of [-4.9, 4.9]) {
        const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.38, 12), darkSteel);
        sprocket.rotation.z = Math.PI / 2;
        sprocket.position.set(tx, 1.02, sz);
        craneG.add(sprocket);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.52, 8), hazardMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(tx, 1.02, sz);
        craneG.add(hub);
      }
      // 6 lower bogie rollers + steel grouser ribs
      for (let r = -3.6; r <= 3.7; r += 1.44) {
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.26, 8), siloSoftMat);
        roller.rotation.z = Math.PI / 2;
        roller.position.set(tx, 0.46, r);
        craneG.add(roller);
        const grouser = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.08, 0.24), siloSoftMat);
        grouser.position.set(tx, 2.04, r);
        craneG.add(grouser);
      }
    }
    // Cross axle carbody & geared slewing turntable ring
    const carbody = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 6.2), darkSteel);
    carbody.position.y = 1.42;
    craneG.add(carbody);
    const slewBase = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.85, 1.15, 16), darkSteel);
    slewBase.position.y = 2.32;
    craneG.add(slewBase);
    const slewGear = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.16, 6, 18), hazardMat);
    slewGear.rotation.x = Math.PI / 2;
    slewGear.position.y = 2.52;
    craneG.add(slewGear);

    // Industrial Ribbed Machinery House + Cooling Louvers + Exhaust Stacks + Catwalk + Winch Drums!
    const deckBase = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.55, 12.2), darkSteel);
    deckBase.position.set(0, 2.95, -0.8);
    craneG.add(deckBase);
    const cabBody = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.6, 10.2), hazardMat);
    cabBody.position.set(0, 5.45, -1.0);
    cabBody.castShadow = true;
    craneG.add(cabBody);
    const upperCowl = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.95, 7.6), darkSteel);
    upperCowl.position.set(0, 8.15, -1.4);
    craneG.add(upperCowl);
    // Side radiator cooling louvers + inspection catwalk with yellow handrail
    for (const sx of [-1, 1]) {
      for (let lv = 0; lv < 4; lv++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 5.4), darkSteel);
        louver.position.set(sx * 3.74, 4.4 + lv * 0.72, -1.8);
        craneG.add(louver);
      }
      const cat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 10.6), darkSteel);
      cat.position.set(sx * 4.18, 3.18, -0.8);
      craneG.add(cat);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 10.6), hazardMat);
      rail.position.set(sx * 4.55, 4.28, -0.8);
      craneG.add(rail);
    }
    // Twin vertical diesel-electric exhaust stacks
    for (const ex of [-1.8, -0.9]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.8, 8), darkSteel);
      stack.position.set(ex, 9.6, -3.6);
      craneG.add(stack);
    }
    // Rear Counterweight Block w/ Hazard Bumper Trim
    const cwBlock = new THREE.Mesh(new THREE.BoxGeometry(8.0, 3.4, 2.8), darkSteel);
    cwBlock.position.set(0, 4.75, -6.2);
    craneG.add(cwBlock);
    const cwStripe = new THREE.Mesh(new THREE.BoxGeometry(8.12, 0.55, 0.25), hazardMat);
    cwStripe.position.set(0, 4.2, -7.56);
    craneG.add(cwStripe);
    // Twin Front Hoist / Dragline Winch Drums visible ahead of machinery house
    for (const wx of [-1.2, 1.2]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.65, 12), siloSoftMat);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(wx, 4.35, 3.6);
      craneG.add(drum);
      for (const fl of [-0.82, 0.82]) {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.14, 12), darkSteel);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(wx + fl, 4.35, 3.6);
        craneG.add(flange);
      }
    }

    // Glazed Wrap-Around Operator Cab w/ Recessed Warm Telemetry Interior & Mullions!
    const opCabFrame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.4, 3.6), darkSteel);
    opCabFrame.position.set(3.2, 5.5, 4.1);
    craneG.add(opCabFrame);
    const opInterior = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 2.6), new THREE.MeshBasicMaterial({ color: '#ffcb77' }));
    opInterior.position.set(3.2, 5.55, 4.35);
    craneG.add(opInterior);
    const cabGlassMat = new THREE.MeshStandardMaterial({
      color: '#1b2b3a', transparent: true, opacity: 0.44, roughness: 0.10, metalness: 0.72
    });
    const opFrontGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 2.25), cabGlassMat);
    opFrontGlass.position.set(3.2, 5.65, 5.93);
    craneG.add(opFrontGlass);
    const opSideGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.15), cabGlassMat);
    opSideGlass.rotation.y = Math.PI / 2;
    opSideGlass.position.set(4.68, 5.65, 4.25);
    craneG.add(opSideGlass);
    // Corner mullions + roof visor + twin hooded operator work lights
    const cabVisor = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.22, 0.85), hazardMat);
    cabVisor.position.set(3.2, 7.18, 5.98);
    cabVisor.rotation.x = 0.18;
    craneG.add(cabVisor);
    for (const lx of [2.45, 3.95]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, 0.20), workLampMat);
      lamp.position.set(lx, 7.36, 5.75);
      craneG.add(lamp);
    }

    // Rear A-Frame Backstay Gantry Mast w/ Cross Bracing
    for (const gx of [-2.4, 2.4]) {
      const mastLeg = new THREE.Mesh(new THREE.BoxGeometry(0.46, 11.8, 0.46), darkSteel);
      mastLeg.position.set(gx, 11.9, -1.8);
      mastLeg.rotation.x = 0.24;
      craneG.add(mastLeg);
      const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 12.6, 0.36), darkSteel);
      backLeg.position.set(gx, 11.6, -4.4);
      backLeg.rotation.x = -0.34;
      craneG.add(backLeg);
    }
    const mastTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.62, 0.62), hazardMat);
    mastTop.position.set(0, 17.3, -0.4);
    craneG.add(mastTop);

    // 32m Angled 4-Chord Dark-Steel X-Braced Lattice Boom + Tip Pulley Sheaves!
    const boomLen = 32.0;
    const boomPitch = -0.62;
    const boomG = new THREE.Group();
    boomG.position.set(0, 5.2, 4.4);
    boomG.rotation.x = Math.PI * 0.5 + boomPitch;
    for (const bx of [-1.25, 1.25]) {
      for (const bz of [-1.15, 1.15]) {
        const chord = new THREE.Mesh(new THREE.BoxGeometry(0.30, boomLen, 0.30), darkSteel);
        chord.position.set(bx, boomLen * 0.5, bz);
        chord.castShadow = true;
        boomG.add(chord);
      }
    }
    for (let s = 3; s < boomLen; s += 4.2) {
      const ringB = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.24, 2.54), s % 8 < 4 ? hazardMat : darkSteel);
      ringB.position.set(0, s, 0);
      boomG.add(ringB);
      for (const sz of [-1.15, 1.15]) {
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.6, 0.18), darkSteel);
        diag.position.set(0, s - 2.1, sz);
        diag.rotation.z = sz > 0 ? 0.58 : -0.58;
        boomG.add(diag);
      }
      for (const sx of [-1.25, 1.25]) {
        const sDiag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.6, 0.18), darkSteel);
        sDiag.position.set(sx, s - 2.1, 0);
        sDiag.rotation.x = sx > 0 ? 0.55 : -0.55;
        boomG.add(sDiag);
      }
    }
    // Boom tip sheave head & dual yellow hoist pulleys
    const tipHead = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.8, 2.6), hazardMat);
    tipHead.position.set(0, boomLen + 0.4, 0);
    boomG.add(tipHead);
    for (const px of [-0.65, 0.65]) {
      const pulley = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.26, 14), darkSteel);
      pulley.rotation.z = Math.PI / 2;
      pulley.position.set(px, boomLen + 0.9, 0.5);
      boomG.add(pulley);
    }
    const boomTipBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), amberMat);
    boomTipBeacon.position.set(0, boomLen + 1.85, 0);
    boomG.add(boomTipBeacon);
    craneG.add(boomG);

    // Twin Taut Suspension Guy Cables from A-Frame Mast to Boom Tip!
    const tipZ = 4.4 + Math.cos(-boomPitch) * boomLen;
    const tipY = 5.2 + Math.sin(-boomPitch) * boomLen;
    for (const gx of [-1.2, 1.2]) {
      const pMast = new THREE.Vector3(gx * 1.4, 17.3, -0.4);
      const pTip = new THREE.Vector3(gx, tipY + 0.6, tipZ);
      const guyDir = new THREE.Vector3().subVectors(pTip, pMast);
      const guyCable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, guyDir.length(), 6), siloSoftMat);
      guyCable.position.copy(pMast).add(pTip).multiplyScalar(0.5);
      guyCable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), guyDir.clone().normalize());
      craneG.add(guyCable);
    }

    // Hoist Cable, Spreader Yoke, Chains, Dragline & TRUE 5-Sided Open-Cavity Toothed Dragline Bucket!
    const dropLen = 12.2;
    const hoistLine = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, dropLen, 6), siloSoftMat);
    hoistLine.position.set(0, tipY - dropLen * 0.5, tipZ);
    craneG.add(hoistLine);
    const yokeY = tipY - dropLen;
    const spreaderBar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.34, 0.34), hazardMat);
    spreaderBar.position.set(0, yokeY, tipZ);
    craneG.add(spreaderBar);

    const buckG = new THREE.Group();
    buckG.position.set(0, yokeY - 2.6, tipZ);
    buckG.rotation.x = 0.14; // Tilted slightly forward in realistic digging posture!
    // Open-cavity 5-sided steel bucket shell (bottom floor, back wall, twin side cheeks, top cutting arch)
    const bFloor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 4.2), darkSteel);
    bFloor.position.set(0, -1.1, 0);
    bFloor.castShadow = true;
    buckG.add(bFloor);
    const bBack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.3, 0.32), darkSteel);
    bBack.position.set(0, 0.0, -2.0);
    bBack.castShadow = true;
    buckG.add(bBack);
    for (const sx of [-1.62, 1.62]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.2, 4.1), darkSteel);
      sideWall.position.set(sx, -0.05, 0);
      sideWall.castShadow = true;
      buckG.add(sideWall);
      const wearRib = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 3.8), hazardMat);
      wearRib.position.set(sx, -0.82, 0.1);
      buckG.add(wearRib);
    }
    const bArch = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.44, 0.72), hazardMat);
    bArch.position.set(0, 1.05, 1.25);
    buckG.add(bArch);
    // Reinforced cutting lip + 5 Forged Steel Digging Teeth!
    const cuttingLip = new THREE.Mesh(new THREE.BoxGeometry(3.52, 0.36, 0.65), hazardMat);
    cuttingLip.position.set(0, -1.06, 2.02);
    buckG.add(cuttingLip);
    for (let ti = -2; ti <= 2; ti++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 4), chromeMat);
      tooth.rotation.x = Math.PI / 2;
      tooth.rotation.y = Math.PI / 4;
      tooth.position.set(ti * 0.68, -1.08, 2.68);
      buckG.add(tooth);
    }
    // Extracted crystalline blue glacier ice heap sitting visibly inside the open bucket cavity!
    const scoopIce = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), iceSlabMat);
    scoopIce.scale.set(1.2, 0.75, 1.1);
    scoopIce.position.set(0, -0.25, -0.35);
    buckG.add(scoopIce);
    // Twin hoist chains connecting spreader bar to bucket side trunnions
    for (const sx of [-1.62, 1.62]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.55, 6), siloSoftMat);
      ch.position.set(sx, 1.32, 0.1);
      buckG.add(ch);
    }
    craneG.add(buckG);

    // Taut Dragline Cable running from Crane Fairlead out to Bucket Front Arch!
    const pFair = new THREE.Vector3(0, 4.4, 4.8);
    const pDrag = new THREE.Vector3(0, yokeY - 2.3, tipZ - 1.6);
    const dragDir = new THREE.Vector3().subVectors(pDrag, pFair);
    const dragLine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, dragDir.length(), 6), siloSoftMat);
    dragLine.position.copy(pFair).add(pDrag).multiplyScalar(0.5);
    dragLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dragDir.clone().normalize());
    craneG.add(dragLine);

    g.add(craneG);
  }

  // Scene 05 Open-Truss Inclined Steel Ore-Conveyor Gallery w/ Visible Ice Chunks, Catwalk & A-Frame Bents!
  {
    const pStart = new THREE.Vector3(16, 1.8, -10);
    const pEnd = new THREE.Vector3(53, getTerrainHeight(qx + 53, qz - 34) - pitY + 12.0, -34);
    const convDir = new THREE.Vector3().subVectors(pEnd, pStart);
    const convLen = convDir.length();
    const convG = new THREE.Group();
    convG.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
    convG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), convDir.clone().normalize());

    // Open 4-chord truss frame + diagonal side struts (replaces solid opaque box!)
    for (const sx of [-1.42, 1.42]) {
      for (const sy of [-0.95, 0.85]) {
        const chord = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, convLen), darkSteel);
        chord.position.set(sx, sy, 0);
        convG.add(chord);
      }
      for (let z = -convLen * 0.46; z < convLen * 0.46; z += 3.8) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.82, 0.14), darkSteel);
        post.position.set(sx, -0.05, z);
        convG.add(post);
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.1), darkSteel);
        diag.position.set(sx, -0.05, z + 1.9);
        diag.rotation.x = 0.44;
        convG.add(diag);
      }
    }
    // Dark rubber conveyor bed + arched corrugated upper dust hood + visible blue glacier ice ore chunks!
    const beltBed = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.22, convLen), darkSteel);
    beltBed.position.y = -0.52;
    convG.add(beltBed);
    const archHood = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, convLen, 12, 1, true, -Math.PI * 0.36, Math.PI * 0.72), siloSoftMat);
    archHood.rotation.x = Math.PI / 2;
    archHood.position.y = 0.08;
    convG.add(archHood);
    for (let z = -convLen * 0.44; z <= convLen * 0.44; z += 3.6) {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + (Math.abs(Math.round(z)) % 3) * 0.14, 0), iceSlabMat);
      chunk.scale.set(1.2, 0.75, 1.0);
      chunk.position.set(Math.sin(z) * 0.35, -0.15, z);
      chunk.rotation.set(z * 0.2, z * 0.5, 0);
      convG.add(chunk);
    }
    // Side steel inspection catwalk + yellow safety handrail + hooded work lamps
    const catWalk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, convLen), darkSteel);
    catWalk.position.set(2.02, -0.82, 0);
    convG.add(catWalk);
    const catRail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, convLen), hazardMat);
    catRail.position.set(2.48, 0.24, 0);
    convG.add(catRail);
    for (let z = -convLen * 0.44; z <= convLen * 0.44; z += 7.2) {
      const rp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.08, 0.08), hazardMat);
      rp.position.set(2.48, -0.28, z);
      convG.add(rp);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.48), amberMat);
      lamp.position.set(2.48, 0.40, z);
      convG.add(lamp);
    }
    g.add(convG);

    // 4 Sturdy Grounded A-Frame H-Trestle Bents w/ Concrete Footings supporting the conveyor gallery!
    const convYaw = Math.atan2(convDir.x, convDir.z);
    for (const frac of [0.18, 0.42, 0.66, 0.86]) {
      const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, frac);
      const groundRelY = getTerrainHeight(qx + pt.x, qz + pt.z) - pitY;
      const hLeg = Math.max(2.4, pt.y - 0.9 - groundRelY + 1.5);
      const bentG = new THREE.Group();
      bentG.position.set(pt.x, groundRelY - 1.5, pt.z);
      bentG.rotation.y = convYaw;
      for (const sx of [-1.45, 1.45]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.46, hLeg, 0.46), darkSteel);
        leg.position.set(sx, hLeg * 0.5, 0);
        leg.castShadow = true;
        bentG.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.8, 1.15), concreteMat);
        foot.position.set(sx, 1.1, 0);
        bentG.add(foot);
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.42, 0.56), darkSteel);
      cap.position.set(0, hLeg, 0);
      bentG.add(cap);
      if (hLeg > 5.0) {
        const midTie = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 0.28), hazardMat);
        midTie.position.set(0, hLeg * 0.55, 0);
        bentG.add(midTie);
      }
      g.add(bentG);
    }
  }

  return { group: g, drillGroup, vaporCone };
}

/**
 * Builds a TRUE STRATIFIED MARTIAN SEDIMENTARY ROCK ARCH (displaced horizontal sedimentary rock shelves,
 * craggy flared buttress roots, overhanging rock ledges & stratified red-ochre/umber vertex colors — ZERO smooth tubes!)
 */
function buildStratifiedRockArch(cx, az, archHeight, rockMat) {
  const floorY = getTerrainHeight(cx, az);
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 52, floorY - 5, az),
    new THREE.Vector3(cx - 34, floorY + archHeight * 0.76, az + 4),
    new THREE.Vector3(cx,      floorY + archHeight, az),
    new THREE.Vector3(cx + 34, floorY + archHeight * 0.74, az - 4),
    new THREE.Vector3(cx + 52, floorY - 5, az)
  ]);
  const geo = new THREE.TubeGeometry(archCurve, 34, 5.4, 12, false);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cTmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    // Horizontal Martian sedimentary strata ledges + rugged basalt fracture displacement!
    const strataLedge = Math.sin(vy * 0.95) * 1.15 + Math.cos(vy * 2.15 + vx * 0.14) * 0.58;
    const crag = Math.sin(vx * 0.24 + vz * 0.31) * Math.cos(vy * 0.42 - vx * 0.19) * 1.65;
    // Flare rock buttress roots wider near canyon floor!
    const hNorm = THREE.MathUtils.clamp((vy - floorY) / Math.max(10, archHeight), 0, 1);
    const rootFlare = (1.0 - hNorm) * (1.0 - hNorm) * 4.8;
    const radialSign = vx >= cx ? 1 : -1;

    vx += radialSign * (strataLedge * 0.65 + rootFlare) + crag * 0.55;
    vy += Math.sin(vx * 0.32) * 0.65;
    vz += (strataLedge * 0.95 + crag * 0.85) * (1.2 + (1 - hNorm) * 0.6);
    pos.setXYZ(i, vx, vy, vz);

    // Rich stratified iron-oxide red / dark basalt / dusty ochre sedimentary bands!
    const band = Math.sin(vy * 0.85) * 0.5 + 0.5;
    cTmp.setRGB(
      0.56 + band * 0.24 - (1 - hNorm) * 0.10,
      0.26 + band * 0.14 - (1 - hNorm) * 0.06,
      0.16 + band * 0.08 - (1 - hNorm) * 0.04
    );
    cols[i * 3] = cTmp.r;
    cols[i * 3 + 1] = cTmp.g;
    cols[i * 3 + 2] = cTmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, rockMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds 3 Stratified Martian Red Canyon Rock Arches + 2 Engineered SpaceX Steel-Truss Cold-Gas Stunt Ramps
 * + FIA Racing Curbs & Tire Barriers + Architectural Glass Canyon-Rim Spectator Pavilion w/ Real Interior!
 */
function buildRedCanyonLandmarks(textures, darkSteel, steelMat, amberMat, cyanMat) {
  const g = new THREE.Group();
  const rockArchMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    map: textures.rockColor,
    normalMap: textures.rockNormal,
    normalScale: new THREE.Vector2(1.9, 1.9),
    roughness: 0.95,
    metalness: 0.04,
    flatShading: true
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: '#6b5c53', map: textures.basaltColor, normalMap: textures.basaltNormal, roughness: 0.90, metalness: 0.08
  });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.52, metalness: 0.28 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#dfe6ef', roughness: 0.16, metalness: 0.94 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#222428', roughness: 0.92, metalness: 0.08 });

  const archZ = [-135, -30, 72];
  archZ.forEach((az, i) => {
    const cx = -315 + Math.sin(az * 0.011) * 48;
    g.add(buildStratifiedRockArch(cx, az, 34 + i * 2.5, rockArchMat));
  });

  // 2 Engineered SpaceX Steel-Truss Cold-Gas Stunt Launch Ramps w/ Tapered Toe Plate, X-Braces & Hydraulic Jacks!
  const rampDeckTex = createRampDeckTexture();
  const rampDeckMat = new THREE.MeshStandardMaterial({
    map: rampDeckTex,
    normalMap: textures.deckNormal,
    roughness: 0.68,
    metalness: 0.55
  });
  const rampSpecs = [
    { x: -315 + Math.sin(-80 * 0.011) * 48, z: -80, rotY: 0.14 },
    { x: 105, z: -275, rotY: -0.35 }
  ];
  const ramps = [];
  rampSpecs.forEach((rs) => {
    const ry = getTerrainHeight(rs.x, rs.z);
    const rg = new THREE.Group();
    const deckLen = Math.hypot(18.0, 4.8);
    const rampPitch = -Math.atan2(4.8, 18.0);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.36, deckLen), [darkSteel, darkSteel, rampDeckMat, darkSteel, darkSteel, darkSteel]);
    deck.position.set(0, 2.42, 0);
    deck.rotation.x = rampPitch;
    deck.castShadow = true;
    deck.receiveShadow = true;
    rg.add(deck);
    // Ground-flush tapered entry toe ramp plate
    const toePlate = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 1.8), steelMat);
    toePlate.position.set(0, 0.10, -9.65);
    toePlate.rotation.x = -0.14;
    rg.add(toePlate);

    for (const sx of [-4.45, 4.45]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, deckLen), darkSteel);
      curb.position.set(sx, 2.70, 0);
      curb.rotation.x = rampPitch;
      rg.add(curb);
      const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, deckLen - 0.5), cyanMat);
      glowStrip.position.set(sx, 2.98, 0);
      glowStrip.rotation.x = rampPitch;
      rg.add(glowStrip);

      // 3 Support Columns + Side Diagonal X-Truss Web Braces
      const colPts = [[-2.0, 1.9], [3.5, 3.3], [8.6, 4.6]];
      for (const [cz, ch] of colPts) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, ch, 8), darkSteel);
        col.position.set(sx, ch * 0.5, cz);
        rg.add(col);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.85), concreteMat);
        foot.position.set(sx, 0.08, cz);
        rg.add(foot);
      }
      for (let bi = 0; bi < colPts.length - 1; bi++) {
        const [z1, h1] = colPts[bi];
        const [z2, h2] = colPts[bi + 1];
        const pA = new THREE.Vector3(sx, 0.25, z1);
        const pB = new THREE.Vector3(sx, h2 - 0.2, z2);
        const dAB = pB.clone().sub(pA);
        const strut1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, dAB.length(), 0.14), hazardMat);
        strut1.position.copy(pA).add(pB).multiplyScalar(0.5);
        strut1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dAB.clone().normalize());
        rg.add(strut1);
        const pC = new THREE.Vector3(sx, h1 - 0.15, z1);
        const pD = new THREE.Vector3(sx, 0.25, z2);
        const dCD = pD.clone().sub(pC);
        const strut2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, dCD.length(), 0.14), darkSteel);
        strut2.position.copy(pC).add(pD).multiplyScalar(0.5);
        strut2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dCD.clone().normalize());
        rg.add(strut2);
      }
      const baseRail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.30, 18.2), darkSteel);
      baseRail.position.set(sx, 0.15, 0);
      rg.add(baseRail);
    }

    // Dual Heavy Hydraulic Lift Jacks (Outer Sleeve + Chrome Piston Rod + Hydraulic Power Pack)
    for (const jx of [-2.4, 2.4]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.4, 10), hazardMat);
      sleeve.position.set(jx, 1.35, 5.4);
      sleeve.rotation.x = 0.22;
      rg.add(sleeve);
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 10), chromeMat);
      piston.position.set(jx, 2.85, 5.75);
      piston.rotation.x = 0.22;
      rg.add(piston);
    }
    const rearBeam = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.55, 0.55), darkSteel);
    rearBeam.position.set(0, 4.3, 8.6);
    rg.add(rearBeam);
    // Armored Hooded Launch-Lip Strobe Pods (replaces bare spheres!)
    for (const sx of [-4.45, 4.45]) {
      const podBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.58), darkSteel);
      podBase.position.set(sx, 5.02, 8.85);
      rg.add(podBase);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 8), amberMat);
      lens.position.set(sx, 5.26, 8.85);
      rg.add(lens);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 8), darkSteel);
      hood.position.set(sx, 5.45, 8.85);
      rg.add(hood);
    }

    rg.position.set(rs.x, ry - 0.1, rs.z);
    rg.rotation.y = rs.rotY;
    g.add(rg);
    ramps.push({ x: rs.x, z: rs.z, y: ry, rotY: rs.rotY });
  });

  // Scene 08 Signature FIA Red-and-White Canyon Racing Curbs + Stacked Tire Safety Barriers + Checkered Frontier Rally Flags!
  const curbTex = createRacingCurbTexture();
  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex, normalMap: textures.basaltNormal, roughness: 0.72, metalness: 0.14
  });
  const makeRallyFlagTex = (isRed) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = isRed ? '#c82b22' : '#ece4d4';
    ctx.fillRect(0, 0, 256, 128);
    // Checkered hoist strip + bold frontier racing stripe + emblem
    const sq = 16;
    for (let y = 0; y < 128; y += sq) {
      for (let x = 0; x < 64; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#17191e' : '#f4f0e8';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    ctx.fillStyle = isRed ? '#f4f0e8' : '#c82b22';
    ctx.fillRect(64, 52, 192, 24);
    ctx.fillStyle = isRed ? '#ffca64' : '#1b1f26';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARCADIA GP', 160, 42);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const redFlagMat = new THREE.MeshStandardMaterial({ map: makeRallyFlagTex(true), roughness: 0.62, side: THREE.DoubleSide });
  const creamFlagMat = new THREE.MeshStandardMaterial({ map: makeRallyFlagTex(false), roughness: 0.62, side: THREE.DoubleSide });
  const rallyFlags = [];

  for (let seg = -2; seg < 4; seg++) {
    const cz = -126 + seg * 16.5;
    const cx = -315 + Math.sin(cz * 0.011) * 48;
    const tanX = Math.cos(cz * 0.011) * 48 * 0.011;
    const yaw = Math.atan2(tanX, 1.0);
    for (const side of [-1, 1]) {
      const fx = cx + Math.cos(yaw) * (side * 7.25);
      const fz = cz - Math.sin(yaw) * (side * 7.25);
      const fy = getTerrainHeight(fx, fz);

      // Stepped FIA-style chamfered Martian canyon racing curb barrier
      const curbG = new THREE.Group();
      curbG.position.set(fx, fy, fz);
      curbG.rotation.y = yaw;
      const baseApron = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.24, 15.4), concreteMat);
      baseApron.position.y = 0.12;
      curbG.add(baseApron);
      const curbBlock = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.44, 15.2), curbMat);
      curbBlock.position.set(side * 0.14, 0.36, 0);
      curbBlock.rotation.z = -side * 0.16;
      curbBlock.castShadow = true;
      curbBlock.receiveShadow = true;
      curbG.add(curbBlock);
      g.add(curbG);

      // Stacked Martian Racing Tire Safety Barriers on apex bends!
      if (seg === 0 || seg === 2) {
        for (let tRow = -1; tRow <= 1; tRow++) {
          const tx = fx + Math.cos(yaw) * (side * 1.45) + Math.sin(yaw) * (tRow * 1.35);
          const tz = fz - Math.sin(yaw) * (side * 1.45) + Math.cos(yaw) * (tRow * 1.35);
          const ty = getTerrainHeight(tx, tz);
          for (let st = 0; st < 3; st++) {
            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.19, 6, 12), st === 1 ? (tRow === 0 ? curbMat : tireMat) : tireMat);
            tire.rotation.x = Math.PI / 2;
            tire.position.set(tx, ty + 0.19 + st * 0.34, tz);
            g.add(tire);
          }
        }
      }

      // Grounded Concrete-Anchored Frontier Rally Flagpole + Checkered Banner
      if (seg === -1 || seg === 1 || seg === 3) {
        const px = fx + side * 0.72;
        const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.48, 8), concreteMat);
        pBase.position.set(px, fy + 0.24, fz);
        g.add(pBase);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.088, 6.5, 6), steelMat);
        pole.position.set(px, fy + 3.45, fz);
        g.add(pole);
        const poleTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 6), amberMat);
        poleTip.position.set(px, fy + 6.82, fz);
        g.add(poleTip);

        const flagGeo = new THREE.PlaneGeometry(2.5, 1.25, 6, 2);
        flagGeo.translate(1.25, 0, 0);
        const fp = flagGeo.attributes.position;
        for (let fi = 0; fi < fp.count; fi++) {
          const x = fp.getX(fi);
          fp.setZ(fi, Math.sin(x * 2.4) * 0.16 * (x / 2.5));
        }
        flagGeo.computeVertexNormals();
        const flagMesh = new THREE.Mesh(flagGeo, (Math.abs(seg) + (side > 0 ? 1 : 0)) % 2 === 0 ? redFlagMat : creamFlagMat);
        flagMesh.position.set(px, fy + 5.88, fz);
        flagMesh.rotation.y = yaw + 0.35;
        g.add(flagMesh);
        rallyFlags.push({ mesh: flagMesh, baseYaw: yaw + 0.35, phase: seg * 1.4 + side });
      }
    }
  }

  // Scene 08 Iconic Architectural Glass Canyon-Rim Spectator Pavilion anchored solidly into West Cliff Lip (-412, -80)!
  // (Replaced opaque yellow box with semi-transparent glazed curtain-wall, real recessed tiered lounge, telemetry screen,
  //  cantilevered wrap-around observation balcony w/ glass rails, solar pergola, marquee sign & cliff truss undercarriage!)
  {
    const px = -412, pz = -80;
    const py = getTerrainHeight(px, pz);
    const pavG = new THREE.Group();
    pavG.position.set(px, py, pz);

    const interiorWallMat = new THREE.MeshStandardMaterial({ color: '#463932', roughness: 0.78, metalness: 0.14 });
    const timberMat = new THREE.MeshStandardMaterial({ color: '#9c6638', roughness: 0.56, metalness: 0.08 });
    const warmCeilingLight = new THREE.MeshBasicMaterial({ color: '#ffe6b8' });
    const archGlassMat = new THREE.MeshStandardMaterial({
      color: '#1b2b3a',
      emissive: '#3a2a18',
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.72
    });
    const railGlassMat = new THREE.MeshStandardMaterial({
      color: '#88c8dc', transparent: true, opacity: 0.28, roughness: 0.10, metalness: 0.45, side: THREE.DoubleSide
    });

    // 1. Concrete Cliff Retaining Plinth + Cantilevered Steel Deck + Cross-Braced Diagonal Cliff Truss Undercarriage
    const cliffPlinth = new THREE.Mesh(new THREE.BoxGeometry(11.0, 12.0, 24.4), concreteMat);
    cliffPlinth.position.set(-1.5, -5.8, 0);
    pavG.add(cliffPlinth);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18.8, 1.15, 26.2), darkSteel);
    deck.position.set(4.0, 0.45, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pavG.add(deck);
    const deckFascia = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 26.3), hazardMat);
    deckFascia.position.set(13.45, 0.48, 0);
    pavG.add(deckFascia);
    for (const sz of [-10.0, -3.4, 3.4, 10.0]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(1.05, 17.5, 1.05), darkSteel);
      strut.position.set(6.2, -6.8, sz);
      strut.rotation.z = -0.52;
      pavG.add(strut);
    }
    const underTie = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 21.0), darkSteel);
    underTie.position.set(7.6, -4.0, 0);
    pavG.add(underTie);

    // 2. Real Recessed Warm-Lit Interior Lounge (Back Wall, Tiered Spectator Steps, Timber Bar, Live Telemetry Screen, Ceiling Light Strips!)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.6, 21.6), interiorWallMat);
    backWall.position.set(-3.4, 3.8, 0);
    pavG.add(backWall);
    const loungeFloor = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.16, 21.4), concreteMat);
    loungeFloor.position.set(2.4, 1.10, 0);
    pavG.add(loungeFloor);
    // 2 Stepped Amphitheater Spectator Seating Tiers facing East (+X) out over Red Canyon!
    for (let st = 0; st < 2; st++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52 * (st + 1), 17.5), concreteMat);
      tier.position.set(1.2 - st * 1.9, 1.18 + 0.26 * (st + 1), 0);
      pavG.add(tier);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 16.8), timberMat);
      bench.position.set(1.7 - st * 1.9, 1.24 + 0.52 * (st + 1), 0);
      pavG.add(bench);
    }
    // Hospitality bar counter + recessed warm interior glow wall panel
    const barCounter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 7.2), timberMat);
    barCounter.position.set(-1.6, 1.72, -6.2);
    pavG.add(barCounter);
    // Live Race Telemetry Screen on Back Wall (CanvasTexture!)
    const scrC = document.createElement('canvas');
    scrC.width = 512; scrC.height = 192;
    const sctx = scrC.getContext('2d');
    sctx.fillStyle = '#0d1822';
    sctx.fillRect(0, 0, 512, 192);
    sctx.strokeStyle = '#38e8d8';
    sctx.lineWidth = 6;
    sctx.strokeRect(6, 6, 500, 180);
    sctx.fillStyle = '#ffbe55';
    sctx.font = 'bold 30px monospace';
    sctx.fillText('RED CANYON CIRCUIT · LIVE', 26, 48);
    sctx.fillStyle = '#5eead4';
    sctx.font = 'bold 22px monospace';
    sctx.fillText('01 ROADSTER-M   1:14.28  278 KM/H', 26, 98);
    sctx.fillStyle = '#e8eff5';
    sctx.fillText('02 CYBER-ROVER  1:32.04  142 KM/H', 26, 136);
    sctx.fillText('COLD-GAS RAMP   STATUS: ARMED', 26, 170);
    const scrTex = new THREE.CanvasTexture(scrC);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    const teleScreen = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 3.4), new THREE.MeshBasicMaterial({ map: scrTex }));
    teleScreen.rotation.y = Math.PI / 2;
    teleScreen.position.set(-3.02, 4.15, 1.5);
    pavG.add(teleScreen);
    // Recessed Ceiling Warm Light Coves
    for (const cxOff of [-0.5, 3.2, 6.8]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 19.5), warmCeilingLight);
      strip.position.set(cxOff, 6.32, 0);
      pavG.add(strip);
    }

    // 3. Semi-Transparent Dark Architectural Curtain-Wall Glazing + Structural Vertical Mullions & Transoms!
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.4, 21.2), archGlassMat);
    frontGlass.position.set(8.6, 3.8, 0);
    pavG.add(frontGlass);
    for (const sz of [-10.6, 10.6]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(12.0, 5.4, 0.16), archGlassMat);
      sideGlass.position.set(2.6, 3.8, sz);
      pavG.add(sideGlass);
    }
    for (let mz = -10.6; mz <= 10.7; mz += 3.53) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.36, 5.65, 0.34), darkSteel);
      mullion.position.set(8.65, 3.8, mz);
      pavG.add(mullion);
    }
    const transom = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 21.4), darkSteel);
    transom.position.set(8.65, 4.95, 0);
    pavG.add(transom);

    // 4. Cantilevered Open Observation Balcony (+X) w/ Stainless-and-Glass Safety Balustrade!
    const railX = 13.15;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 25.8), steelMat);
    topRail.position.set(railX, 2.22, 0);
    pavG.add(topRail);
    const balGlass = new THREE.Mesh(new THREE.PlaneGeometry(25.4, 1.05), railGlassMat);
    balGlass.rotation.y = Math.PI / 2;
    balGlass.position.set(railX, 1.62, 0);
    pavG.add(balGlass);
    for (let rz = -12.8; rz <= 12.9; rz += 3.2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), darkSteel);
      post.position.set(railX, 1.62, rz);
      pavG.add(post);
    }
    for (const sz of [-12.8, 12.8]) {
      const sideRail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.10, 0.12), steelMat);
      sideRail.position.set(10.85, 2.22, sz);
      pavG.add(sideRail);
    }

    // 5. Overhanging Titanium Roof, Louvered Shade Pergola, Crisp Marquee Sign, Rooftop HVAC & Broadcast Mast!
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.82, 26.8), darkSteel);
    roof.position.set(3.8, 6.85, 0);
    roof.castShadow = true;
    pavG.add(roof);
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 26.4), amberMat);
    roofTrim.position.set(13.15, 6.72, 0);
    pavG.add(roofTrim);
    // Crisp Illuminated Roof Marquee Sign facing the Canyon Circuit!
    const mqC = document.createElement('canvas');
    mqC.width = 512; mqC.height = 96;
    const mctx = mqC.getContext('2d');
    mctx.fillStyle = '#14181f';
    mctx.fillRect(0, 0, 512, 96);
    mctx.strokeStyle = '#ffbe55';
    mctx.lineWidth = 5;
    mctx.strokeRect(4, 4, 504, 88);
    mctx.fillStyle = '#fff3d6';
    mctx.font = 'bold 34px monospace';
    mctx.textAlign = 'center';
    mctx.fillText('RED CANYON CIRCUIT', 256, 46);
    mctx.fillStyle = '#5eead4';
    mctx.font = 'bold 20px monospace';
    mctx.fillText('VIP SPECTATOR PAVILION · SECTOR 08', 256, 78);
    const mqTex = new THREE.CanvasTexture(mqC);
    mqTex.colorSpace = THREE.SRGBColorSpace;
    const mqBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 2.1, 13.5),
      [new THREE.MeshBasicMaterial({ map: mqTex }), darkSteel, darkSteel, darkSteel, darkSteel, darkSteel]
    );
    mqBox.position.set(12.6, 8.35, 0);
    pavG.add(mqBox);
    // Rooftop HVAC scrubber + broadcast mast w/ shielded amber strobe
    const pavHvac = buildIndustrialHvacUnit(3.6, 1.35, 2.4, steelMat, darkSteel, hazardMat);
    pavHvac.position.set(-1.5, 7.26, -6.5);
    pavG.add(pavHvac);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 7.5, 8), steelMat);
    mast.position.set(1.5, 11.0, 8.5);
    pavG.add(mast);
    const mastDish = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), steelMat);
    mastDish.rotation.z = -Math.PI * 0.42;
    mastDish.position.set(2.1, 12.2, 8.5);
    pavG.add(mastDish);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), amberMat);
    beacon.position.set(1.5, 14.9, 8.5);
    pavG.add(beacon);

    g.add(pavG);
  }

  return { group: g, ramps, rallyFlags };
}

/**
 * SCENE 07 LANDMARK: Clean Mars Medevac / Frontier Rescue Outpost Pad (-182, -325)
 *  - Flat octagonal sintered rescue pad w/ stenciled MEDEVAC cross & 8 armored low-profile runway beacons
 *  - Pressurized Inflatable/Ribbed Medevac Field Triage Shelter Pod w/ airlock, medical cross & portable solar wing
 *  - Parked White-and-Yellow Mars Medevac Rescue Roadster + 6-Wheeled Pressurized Cyber-Rover Mobile Med-Lab
 *  - Towable Wheeled Floodlight Generator Trailer (telescoping lattice mast + 4 hooded LED pods)
 *  - Ruggedized Pelican Cryo-Med Supply Cases, Field Stretcher, O2 Bottle Rack & 2 Optimus Gen-3 Responders
 */
function buildMedevacRescueOutpost(textures, darkSteel, steelMat, basaltMat, amberMat) {
  const g = new THREE.Group();
  const mx = -182, mz = -325;
  const my = getTerrainHeight(mx, mz);
  g.position.set(mx, my, mz);

  const medRed = new THREE.MeshStandardMaterial({ color: '#cf2920', roughness: 0.42, metalness: 0.18 });
  const medWhite = new THREE.MeshStandardMaterial({ color: '#e6e2da', roughness: 0.48, metalness: 0.22 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#e0a22d', roughness: 0.50, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.90, metalness: 0.10 });
  const solarMat = new THREE.MeshStandardMaterial({
    color: '#1b385a', map: textures.solarColor, roughness: 0.28, metalness: 0.65
  });
  const redLed = new THREE.MeshBasicMaterial({ color: '#ff4232' });
  const cyanLed = new THREE.MeshBasicMaterial({ color: '#45e6d6' });
  const greenLed = new THREE.MeshBasicMaterial({ color: '#4ade80' });
  const whiteLed = new THREE.MeshBasicMaterial({ color: '#fff4d6' });

  // Grounded Octagonal Sintered Rescue Landing Pad w/ Chamfered Perimeter Curb!
  const padTopMat = new THREE.MeshStandardMaterial({
    map: createMedevacPadTexture(),
    normalMap: textures.skyPadNormal,
    roughness: 0.86,
    metalness: 0.10
  });
  const padMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(11.8, 12.8, 0.58, 16),
    [basaltMat, padTopMat, basaltMat]
  );
  padMesh.position.y = 0.14;
  padMesh.receiveShadow = true;
  g.add(padMesh);
  const padCurb = new THREE.Mesh(new THREE.TorusGeometry(11.95, 0.20, 6, 16), darkSteel);
  padCurb.rotation.x = Math.PI / 2;
  padCurb.position.y = 0.36;
  g.add(padCurb);

  // 8 Low-Profile Armored Runway Edge Approach Beacon Fixtures (Replaces spheres on bare sticks!)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI * 0.125;
    const bx = Math.cos(a) * 11.45, bz = Math.sin(a) * 11.45;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.46), darkSteel);
    housing.position.set(bx, 0.52, bz);
    housing.rotation.y = -a;
    g.add(housing);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 8), i % 2 === 0 ? redLed : amberMat);
    lens.position.set(bx, 0.72, bz);
    g.add(lens);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.08, 8), darkSteel);
    cap.position.set(bx, 0.82, bz);
    g.add(cap);
  }

  // 1. Parked Scene 07 Mars Medevac Rescue Roadster (rooftop gear rack + red cross livery!)
  const medRoadster = buildRoadsterMesh(textures, { variant: 'medevac' });
  medRoadster.car.position.set(-3.4, 0.42, 2.2);
  medRoadster.car.rotation.y = 0.58;
  medRoadster.setThrusterFx(0, 0, 0, 0, 0);
  g.add(medRoadster.car);

  // 2. Parked 6-Wheeled Pressurized Cyber-Rover Mobile Med-Lab w/ Red Cross Side Placards!
  const medRover = buildMarsCyberRover(textures, 'isru');
  medRover.rover.position.set(5.2, 0.42, -2.6);
  medRover.rover.rotation.y = -0.52;
  for (const sx of [-1.22, 1.22]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.54), medWhite);
    plate.position.set(sx, 1.56, 0.4);
    medRover.rover.add(plate);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.11), medRed);
    c1.position.set(sx, 1.56, 0.4);
    medRover.rover.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.36), medRed);
    c2.position.set(sx, 1.56, 0.4);
    medRover.rover.add(c2);
  }
  g.add(medRover.rover);

  // 3. Pressurized Ribbed Medevac Field Triage Shelter Pod on North-West Pad Flank!
  {
    const sx = -12.6, sz = -11.4;
    const sy = getTerrainHeight(mx + sx, mz + sz) - my;
    const shG = new THREE.Group();
    shG.position.set(sx, sy, sz);
    shG.rotation.y = 0.65;

    // Grounded sintered-basalt foundation pad extending down into slope
    const shPad = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.2, 11.4), basaltMat);
    shPad.position.y = -0.75;
    shPad.receiveShadow = true;
    shG.add(shPad);
    // Arched pressurized thermal-composite tunnel hull + 5 structural rib arches
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.45, 8.6, 16, 1, false, 0, Math.PI), medWhite);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.position.y = 0.35;
    hull.castShadow = true;
    hull.receiveShadow = true;
    shG.add(hull);
    for (let rz = -3.8; rz <= 3.9; rz += 1.9) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.38, 0.18, 6, 18, Math.PI), rz === 0 ? hazardMat : darkSteel);
      rib.position.set(0, 0.35, rz);
      shG.add(rib);
    }
    // Red Cross Medical Emblem Panels on Both Flanks
    for (const side of [-1, 1]) {
      const cV = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.15, 0.34), medRed);
      cV.position.set(side * 3.18, 1.75, 0);
      cV.rotation.z = -side * 0.42;
      shG.add(cV);
      const cH = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.34, 1.15), medRed);
      cH.position.set(side * 3.18, 1.75, 0);
      cH.rotation.z = -side * 0.42;
      shG.add(cH);
    }
    // Front Pressurized Airlock Vestibule w/ Bulkhead Door, Porthole & Glowing Cyan Triage Status Bar
    const vest = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.65, 2.2), darkSteel);
    vest.position.set(0, 1.65, 5.1);
    vest.castShadow = true;
    shG.add(vest);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.08, 0.14), steelMat);
    door.position.set(0, 1.48, 6.22);
    shG.add(door);
    const portWin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), cyanLed);
    portWin.rotation.x = Math.PI / 2;
    portWin.position.set(0, 1.88, 6.26);
    shG.add(portWin);
    const statusStrip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.12), cyanLed);
    statusStrip.position.set(0, 2.82, 6.20);
    shG.add(statusStrip);
    // Rooftop Red Medical Strobe + Compact HVAC Scrubber + Portable Fold-Out Solar Wing!
    const strobePost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.75, 6), darkSteel);
    strobePost.position.set(0, 3.95, 2.8);
    shG.add(strobePost);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), redLed);
    strobe.position.set(0, 4.42, 2.8);
    shG.add(strobe);
    const shHvac = buildIndustrialHvacUnit(2.2, 0.95, 1.5, steelMat, darkSteel, hazardMat);
    shHvac.position.set(0, 0.35, -5.2);
    shG.add(shHvac);
    const solRack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), darkSteel);
    solRack.position.set(-4.8, 0.9, -1.2);
    shG.add(solRack);
    const solPanel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.10, 4.6), solarMat);
    solPanel.position.set(-5.4, 1.75, -1.2);
    solPanel.rotation.z = 0.42;
    shG.add(solPanel);

    g.add(shG);
  }

  // 4. Towable Wheeled Generator Floodlight Trailer w/ Telescoping Lattice Mast & 4 Hooded LED Pods!
  {
    const trG = new THREE.Group();
    trG.position.set(-8.8, 0.42, -1.8);
    trG.rotation.y = 1.15;
    // Trailer chassis + twin rubber tires + tow tongue hitch + leveling outriggers
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.20, 2.25), darkSteel);
    chassis.position.y = 0.46;
    trG.add(chassis);
    for (const wx of [-0.90, 0.90]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, 0);
      trG.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.30, 8), steelMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.42, 0);
      trG.add(rim);
    }
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 1.35), darkSteel);
    tongue.position.set(0, 0.44, 1.65);
    trG.add(tongue);
    // Ventilated Yellow Battery/Generator Housing w/ Louvers & Control Panel
    const genBox = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.96, 1.78), hazardMat);
    genBox.position.set(0, 1.04, -0.05);
    genBox.castShadow = true;
    trG.add(genBox);
    const genLid = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 1.84), darkSteel);
    genLid.position.set(0, 1.56, -0.05);
    trG.add(genLid);
    for (let lv = 0; lv < 3; lv++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.85), darkSteel);
      slat.position.set(0, 0.82 + lv * 0.22, -0.05);
      trG.add(slat);
    }
    // 3-Stage Telescoping Steel Mast + Crossbar + 4 Individually Hooded Angled LED Floodlight Pods!
    const mast1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 0.24), darkSteel);
    mast1.position.set(0, 2.6, -0.35);
    trG.add(mast1);
    const mast2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 0.16), steelMat);
    mast2.position.set(0, 4.4, -0.35);
    trG.add(mast2);
    const mast3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8), steelMat);
    mast3.position.set(0, 5.75, -0.35);
    trG.add(mast3);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 0.16), darkSteel);
    crossbar.position.set(0, 6.45, -0.35);
    trG.add(crossbar);
    for (const px of [-0.88, -0.30, 0.30, 0.88]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.28), darkSteel);
      pod.position.set(px, 6.52, -0.22);
      pod.rotation.x = 0.28;
      trG.add(pod);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.06), whiteLed);
      lens.position.set(px, 6.49, -0.07);
      lens.rotation.x = 0.28;
      trG.add(lens);
    }
    g.add(trG);
  }
  const fieldLight = new THREE.PointLight('#ffe2b0', 28, 36, 1.5);
  fieldLight.position.set(-6.5, 6.6, -4.4);
  g.add(fieldLight);

  // 5. Ruggedized Pelican Cryo-Med Supply Cases, Field Stretcher & Portable O2 Cylinder Rack!
  const makePelicanCase = (w, h, d, bodyM) => {
    const cg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyM);
    body.position.y = h * 0.5;
    body.castShadow = true;
    cg.add(body);
    const lidSeam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.08, d + 0.05), darkSteel);
    lidSeam.position.y = h * 0.72;
    cg.add(lidSeam);
    const redStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.11, d + 0.03), medRed);
    redStripe.position.y = h * 0.48;
    cg.add(redStripe);
    for (const lx of [-w * 0.30, w * 0.30]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.08), darkSteel);
      latch.position.set(lx, h * 0.68, d * 0.5 + 0.03);
      cg.add(latch);
    }
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), greenLed);
    led.position.set(0, h * 0.84, d * 0.5 + 0.03);
    cg.add(led);
    return cg;
  };
  const medCrate1 = makePelicanCase(1.48, 0.68, 0.92, medWhite);
  medCrate1.position.set(0.6, 0.42, -0.45);
  medCrate1.rotation.y = 0.18;
  g.add(medCrate1);
  const medCrate2 = makePelicanCase(0.86, 0.44, 0.62, hazardMat);
  medCrate2.position.set(0.55, 1.10, -0.42);
  medCrate2.rotation.y = -0.12;
  g.add(medCrate2);

  // Portable O2 Tank Cart + Collapsible Field Rescue Stretcher beside the crates
  const o2Mat = new THREE.MeshStandardMaterial({ color: '#2b8a5b', roughness: 0.38, metalness: 0.45 });
  const o2Rack = new THREE.Group();
  o2Rack.position.set(1.85, 0.42, -1.25);
  o2Rack.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.10, 0.52), darkSteel));
  for (const ox of [-0.20, 0.20]) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.08, 10), o2Mat);
    cyl.position.set(ox, 0.58, 0);
    o2Rack.add(cyl);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), medWhite);
    dome.position.set(ox, 1.12, 0);
    o2Rack.add(dome);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6), steelMat);
    valve.position.set(ox, 1.28, 0);
    o2Rack.add(valve);
  }
  g.add(o2Rack);

  const stretcher = new THREE.Group();
  stretcher.position.set(-1.35, 0.42, -1.85);
  stretcher.rotation.y = 0.45;
  const matress = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.10, 2.05), hazardMat);
  matress.position.y = 0.34;
  stretcher.add(matress);
  for (const sx of [-0.40, 0.40]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.35, 6), steelMat);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(sx, 0.32, 0);
    stretcher.add(pole);
    for (const sz of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6), darkSteel);
      leg.position.set(sx, 0.16, sz);
      stretcher.add(leg);
    }
  }
  g.add(stretcher);

  // 6. Two Articulated Optimus Gen-3 Rescue Responders checking medevac gear!
  const op1 = buildOptimusUnit(textures);
  op1.bot.position.set(0.2, 0.42, 1.3);
  op1.bot.rotation.y = 2.65;
  g.add(op1.bot);
  const op2 = buildOptimusUnit(textures);
  op2.bot.position.set(2.2, 0.42, -0.5);
  op2.bot.rotation.y = -1.65;
  g.add(op2.bot);

  return g;
}

/**
 * DISTRICT LANDMARK: Sweeping Arched Titanium-and-Glass Spaceport Concourse Terminal + Control Tower (Scene 10!)
 */
function buildSpaceportConcourseTerminal(textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat) {
  const g = new THREE.Group();
  const tx = 145, tz = -345;
  const ty = getTerrainHeight(tx, tz);
  g.position.set(tx, ty, tz);
  g.rotation.y = 0.35;

  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.50, metalness: 0.28 });
  const interiorDeckMat = new THREE.MeshStandardMaterial({ color: '#463b36', roughness: 0.78, metalness: 0.14 });
  const warmGlowMat = new THREE.MeshBasicMaterial({ color: '#ffe5b0' });
  const redStrobeMat = new THREE.MeshBasicMaterial({ color: '#ff3b30' });
  const archGlassMat = new THREE.MeshStandardMaterial({
    color: '#192836',
    emissive: '#2c2214',
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.36,
    roughness: 0.08,
    metalness: 0.74
  });
  const skylightMat = new THREE.MeshStandardMaterial({
    color: '#9ad8ec',
    emissive: '#386c82',
    emissiveIntensity: 0.42,
    roughness: 0.14,
    metalness: 0.45
  });

  // 1. Grounded Sintered-Basalt Concourse Plaza Apron + Wide Approach Steps + Hooded Plaza Luminaires
  const apron = new THREE.Mesh(new THREE.BoxGeometry(78.0, 4.2, 46.0), basaltMat);
  apron.position.set(6.0, -1.65, 2.0);
  apron.receiveShadow = true;
  g.add(apron);
  for (let st = 0; st < 3; st++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(36.0 + st * 1.4, 0.26, 2.4), basaltMat);
    step.position.set(0, 0.58 - st * 0.24, 24.4 + st * 1.2);
    step.receiveShadow = true;
    g.add(step);
  }
  for (const lx of [-23.5, -17.5, 17.5, 23.5]) {
    const lamp = buildHoodedMarsLamp(5.2, darkSteel, hazardMat, warmGlowMat, 0.95);
    lamp.position.set(lx, 0.45, 23.6);
    g.add(lamp);
  }

  // 2. Sweeping Ribbed Titanium Barrel Concourse Vault w/ Roof Skylights, Abutment Footings & Rooftop HVAC!
  const hallShell = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 15.5, 50, 24, 1, false, 0, Math.PI), darkSteel);
  hallShell.rotation.z = Math.PI / 2;
  hallShell.position.y = 0.45;
  hallShell.castShadow = true;
  hallShell.receiveShadow = true;
  g.add(hallShell);
  // Twin recessed glowing linear roof skylight ribbons crowning the titanium vault
  for (const skZ of [-4.2, 4.2]) {
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(44.5, 0.42, 1.85), skylightMat);
    skylight.position.set(0, 15.32, skZ);
    skylight.rotation.x = skZ > 0 ? 0.26 : -0.26;
    g.add(skylight);
  }
  for (let rx = -24; rx <= 24; rx += 6) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(15.95, 0.54, 8, 28, Math.PI), steelMat);
    rib.rotation.y = Math.PI / 2;
    rib.position.set(rx, 0.45, 0);
    g.add(rib);
    // Concrete structural rib abutment footings on both front & rear springings
    for (const sz of [-15.8, 15.8]) {
      const abut = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.8), basaltMat);
      abut.position.set(rx, 1.15, sz);
      g.add(abut);
    }
  }
  // Rooftop dual-fan atmospheric HVAC scrubbers flanking the west vault terrace
  for (const hx of [-18, -9]) {
    const hvac = buildIndustrialHvacUnit(4.6, 1.65, 3.0, steelMat, darkSteel, hazardMat);
    hvac.position.set(hx, 0.45, -17.6);
    g.add(hvac);
  }

  // 3. Real Recessed Warm-Lit Departure Concourse Curtain-Wall + Interior Mezzanine & Departure Board!
  //    (Replaces flat solid glowing yellow brick!)
  const hallRecess = new THREE.Mesh(new THREE.BoxGeometry(46.0, 8.6, 4.8), interiorDeckMat);
  hallRecess.position.set(0, 4.75, 13.0);
  g.add(hallRecess);
  // Warm interior departure hall lighting coves + upper mezzanine balcony walkway visible through glass!
  const mezzDeck = new THREE.Mesh(new THREE.BoxGeometry(44.5, 0.38, 2.6), darkSteel);
  mezzDeck.position.set(0, 4.65, 14.3);
  g.add(mezzDeck);
  const mezzRail = new THREE.Mesh(new THREE.BoxGeometry(44.5, 0.12, 0.12), steelMat);
  mezzRail.position.set(0, 5.65, 15.45);
  g.add(mezzRail);
  for (const ly of [3.95, 8.25]) {
    const ceilBar = new THREE.Mesh(new THREE.BoxGeometry(43.5, 0.22, 0.55), warmGlowMat);
    ceilBar.position.set(0, ly, 15.05);
    g.add(ceilBar);
  }
  // Illuminated Interior Spaceport Departures Board (CanvasTexture!)
  const depC = document.createElement('canvas');
  depC.width = 512; depC.height = 160;
  const dctx = depC.getContext('2d');
  dctx.fillStyle = '#0c1520';
  dctx.fillRect(0, 0, 512, 160);
  dctx.strokeStyle = '#38e8d8';
  dctx.lineWidth = 4;
  dctx.strokeRect(4, 4, 504, 152);
  dctx.fillStyle = '#ffbe55';
  dctx.font = 'bold 24px monospace';
  dctx.fillText('ARCADIA INTERPLANETARY DEPARTURES', 18, 34);
  dctx.fillStyle = '#5eead4';
  dctx.font = 'bold 18px monospace';
  dctx.fillText('A01  STARSHIP S-39   EARTH ORBIT   BOARDING', 18, 72);
  dctx.fillStyle = '#e6eef8';
  dctx.fillText('A04  STARSHIP S-42   PHOBOS RELAY  T-18 MIN', 18, 106);
  dctx.fillText('A07  SHUTTLE M-12    JEZERO DOME   ON TIME', 18, 140);
  const depTex = new THREE.CanvasTexture(depC);
  depTex.colorSpace = THREE.SRGBColorSpace;
  const depBoard = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 3.8), new THREE.MeshBasicMaterial({ map: depTex }));
  depBoard.position.set(0, 6.65, 15.42);
  g.add(depBoard);

  // Semi-transparent architectural front curtain wall + vertical structural mullions + sliding entry doors!
  const curtainGlass = new THREE.Mesh(new THREE.BoxGeometry(46.2, 8.4, 0.20), archGlassMat);
  curtainGlass.position.set(0, 4.65, 15.72);
  g.add(curtainGlass);
  for (let mx = -23.0; mx <= 23.1; mx += 3.83) {
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 8.6, 0.38), darkSteel);
    mull.position.set(mx, 4.70, 15.76);
    g.add(mull);
  }
  for (const tyOff of [3.4, 6.2, 8.85]) {
    const trans = new THREE.Mesh(new THREE.BoxGeometry(46.6, 0.28, 0.42), darkSteel);
    trans.position.set(0, tyOff, 15.78);
    g.add(trans);
  }
  // Central double pressurized entry airlock portals under the canopy
  for (const dx of [-5.2, 5.2]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.3, 0.65), steelMat);
    frame.position.set(dx, 2.1, 15.95);
    g.add(frame);
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 0.16), archGlassMat);
    doorGlass.position.set(dx, 2.0, 16.22);
    g.add(doorGlass);
  }

  // 4. Cantilevered Porte-Cochère Entry Canopy + High-Res Illuminated Terminal Fascia Sign!
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(36.0, 0.65, 7.2), darkSteel);
  canopyRoof.position.set(0, 4.85, 19.35);
  canopyRoof.castShadow = true;
  g.add(canopyRoof);
  const canopyFascia = new THREE.Mesh(new THREE.BoxGeometry(36.2, 0.24, 0.20), cyanMat);
  canopyFascia.position.set(0, 4.55, 22.92);
  g.add(canopyFascia);
  for (const cx of [-15.5, -5.2, 5.2, 15.5]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.35, 10), steelMat);
    col.position.set(cx, 2.55, 22.15);
    col.castShadow = true;
    g.add(col);
    const soffitLamp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.65), warmGlowMat);
    soffitLamp.position.set(cx * 0.72, 4.48, 19.6);
    g.add(soffitLamp);
  }
  // Crisp Illuminated Concourse Sign Header (Replaces flat cyan rectangle!)
  const hdrC = document.createElement('canvas');
  hdrC.width = 1024; hdrC.height = 128;
  const hctx = hdrC.getContext('2d');
  hctx.fillStyle = '#141922';
  hctx.fillRect(0, 0, 1024, 128);
  hctx.strokeStyle = '#45e6d6';
  hctx.lineWidth = 6;
  hctx.strokeRect(6, 6, 1012, 116);
  hctx.fillStyle = '#f4f8fc';
  hctx.font = 'bold 42px monospace';
  hctx.textAlign = 'center';
  hctx.fillText('ARCADIA INTERPLANETARY CONCOURSE', 512, 58);
  hctx.fillStyle = '#ffbe55';
  hctx.font = 'bold 26px monospace';
  hctx.fillText('DEPARTURES · STARSHIP GATES A01–A12 · PRESSURIZED', 512, 102);
  const hdrTex = new THREE.CanvasTexture(hdrC);
  hdrTex.colorSpace = THREE.SRGBColorSpace;
  const signHeader = new THREE.Mesh(
    new THREE.BoxGeometry(30.0, 2.4, 0.55),
    [darkSteel, darkSteel, darkSteel, darkSteel, new THREE.MeshBasicMaterial({ map: hdrTex }), darkSteel]
  );
  signHeader.position.set(0, 6.25, 22.65);
  g.add(signHeader);

  // 5. Twin Pressurized Starship Boarding Jetway Corridors on Rear/Megaport Apron Side (-Z)!
  for (const jx of [-12.0, 10.0]) {
    const jetBridge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 14.5), steelMat);
    jetBridge.position.set(jx, 5.2, -21.0);
    jetBridge.castShadow = true;
    g.add(jetBridge);
    for (let jr = -15.5; jr >= -26.5; jr -= 3.6) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(3.65, 3.45, 0.42), darkSteel);
      collar.position.set(jx, 5.2, jr);
      g.add(collar);
    }
    const jetPier = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 4.4, 8), darkSteel);
    jetPier.position.set(jx, 2.1, -26.2);
    g.add(jetPier);
    const jetDock = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.8, 1.4), darkSteel);
    jetDock.position.set(jx, 5.2, -28.4);
    g.add(jetDock);
  }

  // 6. Spaceport Air-Traffic Control Tower perched on East Concourse Wing w/ Glazed Angled Cab & Curved Phased-Array Radar!
  const atcG = new THREE.Group();
  atcG.position.set(29.5, 0.45, -3.5);
  // Battered concrete pedestal plinth + steel equipment house at base
  const atcBase = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.8, 4.2, 8), basaltMat);
  atcBase.position.y = 2.0;
  atcBase.castShadow = true;
  atcG.add(atcBase);
  // Ribbed octagonal structural tower shaft + external elevator/stairwell spine w/ slot windows!
  const towerCore = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 3.55, 22.5, 8), steelMat);
  towerCore.position.y = 14.8;
  towerCore.castShadow = true;
  atcG.add(towerCore);
  for (let tyRing = 7.5; tyRing <= 23.0; tyRing += 4.8) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(THREE.MathUtils.lerp(3.4, 2.75, (tyRing - 4) / 22), 0.22, 6, 8), darkSteel);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = tyRing;
    atcG.add(collar);
  }
  const elevSpine = new THREE.Mesh(new THREE.BoxGeometry(2.1, 22.8, 1.8), darkSteel);
  elevSpine.position.set(0, 14.6, 3.15);
  atcG.add(elevSpine);
  for (let wy = 7.0; wy <= 22.0; wy += 3.6) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.16), cyanMat);
    slot.position.set(0, wy, 4.08);
    atcG.add(slot);
  }
  // Cantilevered Annular Exterior Observation Catwalk beneath ATC Cab + Yellow Safety Handrail & Support Struts!
  const catDeck = new THREE.Mesh(new THREE.CylinderGeometry(6.3, 4.8, 0.85, 12), darkSteel);
  catDeck.position.y = 25.85;
  atcG.add(catDeck);
  const catRail = new THREE.Mesh(new THREE.TorusGeometry(6.15, 0.08, 6, 24), hazardMat);
  catRail.rotation.x = Math.PI / 2;
  catRail.position.y = 27.15;
  atcG.add(catRail);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 5), hazardMat);
    post.position.set(Math.cos(a) * 6.15, 26.62, Math.sin(a) * 6.15);
    atcG.add(post);
    if (k % 2 === 0) {
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.6, 0.32), darkSteel);
      knee.position.set(Math.cos(a) * 3.8, 24.4, Math.sin(a) * 3.8);
      knee.rotation.y = -a;
      knee.rotation.z = -0.62;
      atcG.add(knee);
    }
  }
  // Real Glazed Outward-Flared Angled ATC Cab w/ Interior Radar Consoles & Structural Corner Mullions (ZERO yellow cup!)
  const cabCore = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 3.9, 10), darkSteel);
  cabCore.position.y = 28.1;
  atcG.add(cabCore);
  // Glowing cyan/amber interior ATC radar operator console ring visible through angled dark glass
  const consoleRing = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 3.75, 1.15, 12), darkSteel);
  consoleRing.position.y = 27.0;
  atcG.add(consoleRing);
  const consoleScreens = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.16, 6, 18), cyanMat);
  consoleScreens.rotation.x = Math.PI / 2;
  consoleScreens.position.y = 27.68;
  atcG.add(consoleScreens);
  const cabCeilLight = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.14, 6, 18), warmGlowMat);
  cabCeilLight.rotation.x = Math.PI / 2;
  cabCeilLight.position.y = 29.75;
  atcG.add(cabCeilLight);
  const cabGlass = new THREE.Mesh(new THREE.CylinderGeometry(5.85, 4.45, 4.15, 12, 1, true), archGlassMat);
  cabGlass.position.y = 28.25;
  atcG.add(cabGlass);
  // 12 Outward-Slanted Structural Corner Mullions framing the ATC glazing!
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * Math.PI * 2;
    const pBot = new THREE.Vector3(Math.cos(a) * 4.48, 26.2, Math.sin(a) * 4.48);
    const pTop = new THREE.Vector3(Math.cos(a) * 5.88, 30.3, Math.sin(a) * 5.88);
    const d = pTop.clone().sub(pBot);
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.22, d.length(), 0.22), darkSteel);
    mull.position.copy(pBot).add(pTop).multiplyScalar(0.5);
    mull.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    atcG.add(mull);
  }
  // Stepped Overhang Cab Roof + Parapet + Rooftop HVAC + Twin Aviation Comms Spires
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.2, 0.95, 12), darkSteel);
  cabRoof.position.y = 30.65;
  cabRoof.castShadow = true;
  atcG.add(cabRoof);
  const roofTrim = new THREE.Mesh(new THREE.TorusGeometry(6.48, 0.12, 6, 24), amberMat);
  roofTrim.rotation.x = Math.PI / 2;
  roofTrim.position.y = 30.72;
  atcG.add(roofTrim);
  const atcHvac = buildIndustrialHvacUnit(2.2, 0.85, 1.6, steelMat, darkSteel, hazardMat);
  atcHvac.position.set(-2.8, 31.12, -2.2);
  atcG.add(atcHvac);
  for (const [sx, sz, sh] of [[4.2, -2.4, 5.2], [-3.8, 2.8, 4.2]]) {
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, sh, 6), steelMat);
    spire.position.set(sx, 31.1 + sh * 0.5, sz);
    atcG.add(spire);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), redStrobeMat);
    strobe.position.set(sx, 31.1 + sh + 0.15, sz);
    atcG.add(strobe);
  }

  // Rotating Curved ASR Slotted-Waveguide Surveillance Radar Sail + Feed Horn + Counterweight!
  const radarPed = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 1.65, 10), darkSteel);
  radarPed.position.y = 31.9;
  atcG.add(radarPed);
  const radarPivot = new THREE.Group();
  radarPivot.position.set(0, 33.25, 0);
  const radarHub = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.4), hazardMat);
  radarPivot.add(radarHub);
  // Concave Curved 7-Panel Slotted Surveillance Radar Sail
  for (let i = -3; i <= 3; i++) {
    const xOff = i * 1.02;
    const curveZ = -0.18 * i * i * 0.35 + 0.45;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.85, 0.16), steelMat);
    rib.position.set(xOff, 0.65, curveZ);
    rib.rotation.y = -i * 0.14;
    radarPivot.add(rib);
  }
  const radarTopBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 0.24), hazardMat);
  radarTopBar.position.set(0, 1.62, 0.18);
  radarPivot.add(radarTopBar);
  const radarBotBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 0.28), darkSteel);
  radarBotBar.position.set(0, -0.30, 0.18);
  radarPivot.add(radarBotBar);
  // Waveguide Feed Horn Boom projecting forward (+Z) + Rear Counterweight Drum (-Z)
  const feedArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.4), darkSteel);
  feedArm.position.set(0, 0.20, 1.45);
  radarPivot.add(feedArm);
  const feedHorn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 8), hazardMat);
  feedHorn.rotation.x = -Math.PI / 2;
  feedHorn.position.set(0, 0.42, 2.55);
  radarPivot.add(feedHorn);
  const cwDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.25, 10), darkSteel);
  cwDrum.rotation.z = Math.PI / 2;
  cwDrum.position.set(0, 0.1, -1.15);
  radarPivot.add(cwDrum);
  const radarTip = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), redStrobeMat);
  radarTip.position.set(0, 2.15, 0.18);
  radarPivot.add(radarTip);
  atcG.add(radarPivot);

  g.add(atcG);

  return { group: g, radarPivot };
}

/**
 * 3 Overhead Mars Highway Wayfinding 3D Box-Truss Gantries spanning key Sintered-Basalt Highway Intersections!
 * (Concrete Jersey-barrier footings, twin-column braced lattice towers, 3D open box-truss span,
 *  maintenance catwalk, downward LED sign-illumination arms & hooded clearance beacons!)
 */
function buildHighwayGantries(darkSteel, steelMat, basaltMat, amberMat) {
  const g = new THREE.Group();
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.52, metalness: 0.28 });
  const warmLed = new THREE.MeshBasicMaterial({ color: '#fff3d4' });

  const specs = [
    { x: 162,  z: -285, rotY: -0.22, line1: '↑ STARSHIP MEGAPORT   240m', line2: '→ ICE QUARRY PAD-03   180m' },
    { x: -165, z: -356, rotY: 1.52,  line1: '↑ STARSHIP SALOON     95m',  line2: '← RED CANYON STUNT GORGE' },
    { x: -356, z: -160, rotY: 0.14,  line1: 'RED CANYON STUNT CORRIDOR',  line2: 'COLD-GAS RAMP AHEAD · 80m' }
  ];
  specs.forEach((sp) => {
    const gy = getTerrainHeight(sp.x, sp.z);
    const gg = new THREE.Group();

    // 1. Concrete Jersey-Barrier Footings + Twin-Column Braced Steel Lattice Support Towers
    for (const sx of [-7.9, 7.9]) {
      const footing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.2, 3.2), basaltMat);
      footing.position.set(sx, 0.35, 0);
      footing.receiveShadow = true;
      gg.add(footing);
      const curbStripe = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.32, 3.24), hazardMat);
      curbStripe.position.set(sx, 1.25, 0);
      gg.add(curbStripe);
      for (const sz of [-0.62, 0.62]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.38, 10.6, 0.38), darkSteel);
        leg.position.set(sx, 6.2, sz);
        leg.castShadow = true;
        gg.add(leg);
      }
      // Horizontal rungs & diagonal web braces inside tower legs
      for (let ly = 2.4; ly <= 10.2; ly += 1.9) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.35), darkSteel);
        rung.position.set(sx, ly, 0);
        gg.add(rung);
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.15), steelMat);
        diag.position.set(sx, ly + 0.95, 0);
        diag.rotation.x = (Math.round(ly) % 2 === 0) ? 0.78 : -0.78;
        gg.add(diag);
      }
    }

    // 2. 3D Open Box-Truss Overhead Span (4 Longitudinal Chords + Vertical Frames + Diagonal Web Lacing + Maintenance Catwalk)
    const spanW = 16.8;
    for (const sy of [9.85, 11.25]) {
      for (const sz of [-0.62, 0.62]) {
        const chord = new THREE.Mesh(new THREE.BoxGeometry(spanW, 0.24, 0.24), darkSteel);
        chord.position.set(0, sy, sz);
        chord.castShadow = true;
        gg.add(chord);
      }
    }
    for (let tx = -7.6; tx <= 7.7; tx += 1.9) {
      for (const sz of [-0.62, 0.62]) {
        const vPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 0.16), darkSteel);
        vPost.position.set(tx, 10.55, sz);
        gg.add(vPost);
        if (tx < 7.0) {
          const dWeb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.13, 0.13), steelMat);
          dWeb.position.set(tx + 0.95, 10.55, sz);
          dWeb.rotation.z = (Math.round(tx) % 2 === 0) ? 0.62 : -0.62;
          gg.add(dWeb);
        }
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.32), darkSteel);
      cross.position.set(tx, 9.85, 0);
      gg.add(cross);
    }
    // Steel service catwalk deck + yellow safety rail behind the sign
    const catWalk = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.12, 0.85), darkSteel);
    catWalk.position.set(0, 9.75, 0);
    gg.add(catWalk);
    const catRail = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.08, 0.08), hazardMat);
    catRail.position.set(0, 12.15, -0.62);
    gg.add(catRail);

    // 3. Beveled Double-Sided Illuminated Wayfinding Sign Board + 3 Cantilevered LED Sign-Wash Light Arms!
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#141921';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#e8a84c';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#f8f0e4';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sp.line1, 256, 52);
    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(sp.line2, 256, 98);
    const st = new THREE.CanvasTexture(c);
    st.colorSpace = THREE.SRGBColorSpace;
    const signFrame = new THREE.Mesh(new THREE.BoxGeometry(11.9, 3.05, 0.42), steelMat);
    signFrame.position.y = 8.45;
    gg.add(signFrame);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 2.75, 0.48),
      [darkSteel, darkSteel, darkSteel, darkSteel, new THREE.MeshBasicMaterial({ map: st }), new THREE.MeshBasicMaterial({ map: st })]
    );
    signBoard.position.y = 8.45;
    gg.add(signBoard);
    for (const hx of [-4.2, 0, 4.2]) {
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.15, 0.44), darkSteel);
      hanger.position.set(hx, 9.75, 0);
      gg.add(hanger);
      // Cantilevered overhead sign-illumination light arms on both faces!
      for (const sz of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.35), darkSteel);
        arm.position.set(hx, 10.35, sz * 1.15);
        gg.add(arm);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.34), darkSteel);
        hood.position.set(hx, 10.28, sz * 1.78);
        hood.rotation.x = sz * 0.55;
        gg.add(hood);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.22), warmLed);
        led.position.set(hx, 10.18, sz * 1.74);
        led.rotation.x = sz * 0.55;
        gg.add(led);
      }
    }
    // Armored Hooded Amber Clearance Beacons on both gantry tower crowns!
    for (const bx of [-7.9, 7.9]) {
      const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.42, 8), darkSteel);
      capBase.position.set(bx, 11.65, 0);
      gg.add(capBase);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 8), amberMat);
      lens.position.set(bx, 11.98, 0);
      gg.add(lens);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 8), darkSteel);
      hood.position.set(bx, 12.22, 0);
      gg.add(hood);
    }

    gg.position.set(sp.x, gy, sp.z);
    gg.rotation.y = sp.rotY;
    g.add(gg);
  });
  return g;
}

/**
 * 440 Instanced Multi-Archetype Martian Basalt & Sedimentary Rocks scattered across the 1.6km Open World!
 *  - 3 distinct geological rock archetypes (angular fractured volcanic basalt, flat-topped stratified ventifacts,
 *    clustered talus rock outcrops) w/ per-instance natural Martian mineral color variation!
 *  - Zero FPS overhead via 3 InstancedMeshes; kept strictly clear of roads, sky-pads & colony buildings!
 */
function buildInstancedMarsBoulders(textures) {
  // Archetype 1: Angular fractured volcanic basalt boulder
  const basaltGeo = new THREE.DodecahedronGeometry(1.0, 1);
  {
    const pos = basaltGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const ridge = 0.78 + 0.34 * Math.abs(Math.sin(vx * 3.4 + vy * 2.7)) * Math.cos(vz * 3.9 - vy * 2.1);
      pos.setXYZ(i, vx * ridge * 1.24, vy * ridge * 0.82, vz * ridge * 1.12);
    }
    basaltGeo.computeVertexNormals();
  }
  // Archetype 2: Flat-topped wind-eroded stratified Martian sedimentary slab / ventifact
  const slabGeo = new THREE.IcosahedronGeometry(1.0, 1);
  {
    const pos = slabGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const shelf = 1.0 + 0.22 * Math.sin(vy * 8.5) + 0.14 * Math.cos(vx * 3.1 - vz * 2.8);
      const flatY = Math.max(-0.55, Math.min(0.42, vy * 0.58));
      pos.setXYZ(i, vx * shelf * 1.48, flatY, vz * shelf * 1.32);
    }
    slabGeo.computeVertexNormals();
  }
  // Archetype 3: Broad multi-lobed craggy talus outcrop
  const cragGeo = new THREE.DodecahedronGeometry(1.0, 1);
  {
    const pos = cragGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const lobe = 0.74 + 0.40 * Math.sin(vx * 4.5 + vz * 3.2) * Math.sin(vy * 3.8 + 0.8);
      const flare = vy < 0 ? 1.22 : 0.86;
      pos.setXYZ(i, vx * lobe * flare * 1.35, vy * lobe * 0.96, vz * lobe * flare * 1.05);
    }
    cragGeo.computeVertexNormals();
  }

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: textures.rockColor,
    normalMap: textures.rockNormal,
    normalScale: new THREE.Vector2(1.75, 1.75),
    roughness: 0.95,
    metalness: 0.04,
    flatShading: true
  });

  let seed = 4207;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const buckets = [[], [], []];
  let total = 0;
  for (let attempt = 0; attempt < 960 && total < 440; attempt++) {
    const rx = -520 + rand() * 1120;
    const rz = -740 + rand() * 880;
    if (Math.hypot(rx, rz) < 55) continue;
    if (Math.hypot(rx + 74, rz + 56) < 68) continue;
    if (Math.hypot(rx + 255, rz + 385) < 48) continue;
    if (Math.hypot(rx + 182, rz + 325) < 28) continue;
    if (Math.hypot(rx - 365, rz + 210) < 58) continue;
    if (rx > 110 && rx < 186 && rz < -84 && rz > -130) continue;
    if (rx > -256 && rx < -128 && rz < -230 && rz > -308) continue;
    if (rx > 156 && rx < 282 && rz < -238 && rz > -332) continue;
    if (Math.abs(rx - 215) < 28 && rz < -420 && rz > -530) continue;
    if (rx > -140 && rx < 130 && rz < -100 && rz > -310) continue;
    const canyonX = -315 + Math.sin(rz * 0.011) * 48;
    if (rz > -260 && rz < 120 && Math.abs(rx - canyonX) < 16) continue;

    const ry = getTerrainHeight(rx, rz);
    const s = 0.68 + Math.pow(rand(), 2.1) * 3.8;
    const kind = total % 3;
    buckets[kind].push({
      x: rx, y: ry + s * (kind === 1 ? 0.14 : 0.24), z: rz,
      s, ryRot: rand() * Math.PI * 2, rxRot: (rand() - 0.5) * (kind === 1 ? 0.16 : 0.38),
      tint: rand()
    });
    total++;
  }

  const root = new THREE.Group();
  const geos = [basaltGeo, slabGeo, cragGeo];
  const palette = [
    new THREE.Color('#683929'), // Volcanic basalt umber
    new THREE.Color('#8b472b'), // Iron-oxide rust
    new THREE.Color('#9c5a34'), // Dusty Martian ochre
    new THREE.Color('#52352c')  // Dark sintered basalt
  ];
  const dummy = new THREE.Object3D();
  const colTmp = new THREE.Color();

  buckets.forEach((list, kind) => {
    const inst = new THREE.InstancedMesh(geos[kind], rockMat, list.length);
    inst.castShadow = false;
    inst.receiveShadow = true;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rxRot, p.ryRot, 0);
      dummy.scale.set(
        p.s * (0.90 + (i % 3) * 0.14),
        p.s * (0.72 + (i % 2) * 0.24),
        p.s * (0.88 + ((i + 1) % 3) * 0.12)
      );
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      const cA = palette[(kind + i) % palette.length];
      const cB = palette[(kind + i + 1) % palette.length];
      colTmp.copy(cA).lerp(cB, p.tint);
      inst.setColorAt(i, colTmp);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    root.add(inst);
  });

  return root;
}

/**
 * Builds 10 Aerospace SpaceX Orbital Telemetry Stunt Pylon Ring Gates across all Arcadia Districts!
 * (Substantial beveled dual-truss titanium-carbon aero-shroud, 8 holographic emitter pylon pods w/ fins,
 *  counter-rotating segmented telemetry arcs & custom GLSL Fresnel/radial-scanline portal field!)
 */
function buildFlightRingGates(darkSteel, onGatePass) {
  const g = new THREE.Group();
  const gateSpecs = [
    { name: 'RIDGE VALLEY LAUNCH',    x: 48,   y: getTerrainHeight(48, -96) + 24,    z: -96,  rotY: 0.25 },
    { name: 'COLOSSUS EYE-LEVEL',     x: -24,  y: getTerrainHeight(-74, -56) + 178,  z: -98,  rotY: 0.65 },
    { name: 'BIO-DOME CANOPY SKIM',   x: -18,  y: 54,                               z: -155, rotY: 0.0  },
    { name: 'RED CANYON ARCH #1',     x: -315 + Math.sin(-135 * 0.011) * 48, y: getTerrainHeight(-350, -135) + 12, z: -135, rotY: 0.1  },
    { name: 'RED CANYON ARCH #2',     x: -315 + Math.sin(-30 * 0.011) * 48,  y: getTerrainHeight(-330, -30) + 12,  z: -30,  rotY: -0.1 },
    { name: 'RED CANYON ARCH #3',     x: -315 + Math.sin(72 * 0.011) * 48,   y: getTerrainHeight(-282, 72) + 12,   z: 72,   rotY: 0.15 },
    { name: 'STARSHIP SALOON FLYBY',  x: -260, y: getTerrainHeight(-260, -385) + 32, z: -385, rotY: 0.42 },
    { name: 'ICE QUARRY DRILL DIVE',  x: 365,  y: getTerrainHeight(365, -210) + 30, z: -210, rotY: 1.57 },
    { name: 'MEGAPORT STARSHIP GATE', x: 215,  y: 26,                               z: -526, rotY: 0.0  },
    { name: 'MEGAPORT APEX RING',     x: 325,  y: 58,                               z: -530, rotY: 0.25 }
  ];

  const titaniumMat = new THREE.MeshStandardMaterial({ color: '#b4beca', roughness: 0.38, metalness: 0.84 });
  const gates = [];
  let passedCount = 0;

  gateSpecs.forEach((spec, gi) => {
    const holder = new THREE.Group();
    holder.position.set(spec.x, spec.y, spec.z);
    holder.rotation.y = spec.rotY;

    // 1. Substantial Dual-Truss Titanium-Carbon Outer Aerospace Shroud!
    const mainFrame = new THREE.Mesh(new THREE.TorusGeometry(11.8, 0.42, 10, 44), darkSteel);
    holder.add(mainFrame);
    const outerBrace = new THREE.Mesh(new THREE.TorusGeometry(12.62, 0.16, 6, 44), titaniumMat);
    holder.add(outerBrace);
    // Twin fore/aft aerodynamic lip rings giving real 3D barrel depth to the gate
    for (const lz of [-0.52, 0.52]) {
      const lip = new THREE.Mesh(new THREE.TorusGeometry(11.55, 0.11, 6, 40), darkSteel);
      lip.position.z = lz;
      holder.add(lip);
    }

    // 2. Active Glowing Inner Telemetry Ring + Counter-Rotating Segmented Holo Arcs!
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#45f0e0',
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const holoRing = new THREE.Group();
    for (let s = 0; s < 4; s++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(11.08, 0.16, 6, 16, Math.PI * 0.36), ringMat);
      arc.rotation.z = (s / 4) * Math.PI * 2;
      holoRing.add(arc);
    }
    holder.add(holoRing);

    const holoRing2 = new THREE.Group();
    for (let s = 0; s < 6; s++) {
      const arc2 = new THREE.Mesh(new THREE.TorusGeometry(10.55, 0.08, 5, 10, Math.PI * 0.18), ringMat);
      arc2.rotation.z = (s / 6) * Math.PI * 2;
      holoRing2.add(arc2);
    }
    holder.add(holoRing2);

    // 3. Eight Radial Holographic Projector Pylon Pods w/ Stabilizer Fins & Emitter Lenses!
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const isMajor = k % 2 === 0;
      const podG = new THREE.Group();
      podG.position.set(Math.cos(a) * 12.15, Math.sin(a) * 12.15, 0);
      podG.rotation.z = a;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(isMajor ? 1.55 : 1.05, isMajor ? 0.92 : 0.62, isMajor ? 1.55 : 1.08), darkSteel);
      podG.add(housing);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42, isMajor ? 1.08 : 0.72, isMajor ? 1.68 : 1.18), titaniumMat);
      collar.position.x = -0.25;
      podG.add(collar);
      // Inward-facing glowing holographic projector emitter lens
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.24, isMajor ? 0.56 : 0.38, isMajor ? 0.85 : 0.52), ringMat);
      emitter.position.x = isMajor ? -0.82 : -0.58;
      podG.add(emitter);
      // Outward aerodynamic stabilizer fin on the 4 cardinal pylon pods
      if (isMajor) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 0.95), darkSteel);
        fin.position.x = 1.45;
        podG.add(fin);
        const tipBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), ringMat);
        tipBeacon.position.x = 2.42;
        podG.add(tipBeacon);
      }
      holder.add(podG);
    }

    // 4. Custom GLSL Radial-Scanline & Reticle Holographic Portal Field!
    const innerMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: gi * 1.3 },
        uColor: { value: new THREE.Color('#45f0e0') },
        uAlpha: { value: 0.24 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float ang = atan(p.y, p.x);
          float rim = pow(r, 3.2) * 0.85;
          float pulse = exp(-pow((r - fract(uTime * 0.35)) / 0.08, 2.0)) * 0.45 * r;
          float tick = smoothstep(0.92, 0.98, sin(ang * 8.0 - uTime * 1.2)) * smoothstep(0.76, 0.96, r) * 0.55;
          float centerFill = (1.0 - r * 0.4) * 0.08;
          float a = (rim + pulse + tick + centerFill) * uAlpha * (1.0 - smoothstep(0.96, 1.0, r));
          gl_FragColor = vec4(uColor, a);
        }
      `
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(11.1, 36), innerMat);
    holder.add(disc);

    g.add(holder);

    gates.push({
      ...spec,
      pos: new THREE.Vector3(spec.x, spec.y, spec.z),
      ring: holder,
      holoRing,
      holoRing2,
      disc,
      ringMat,
      innerMat,
      passed: false,
      flash: 0
    });
  });

  function checkPlayer(pos, dt, t = 0) {
    for (const gt of gates) {
      gt.holoRing.rotation.z += dt * (gt.passed ? 0.25 : 0.72);
      gt.holoRing2.rotation.z -= dt * (gt.passed ? 0.18 : 0.48);
      if (gt.innerMat.uniforms) gt.innerMat.uniforms.uTime.value = t;
      if (gt.flash > 0) {
        gt.flash = Math.max(0, gt.flash - dt * 1.8);
        gt.ring.scale.setScalar(1.0 + gt.flash * 0.22);
      }
      if (!gt.passed && pos && pos.distanceTo(gt.pos) < 13.5) {
        gt.passed = true;
        gt.flash = 1.0;
        passedCount++;
        gt.ringMat.color.set('#fbbf24');
        gt.ringMat.opacity = 0.62;
        if (gt.innerMat.uniforms) {
          gt.innerMat.uniforms.uColor.value.set('#fbbf24');
          gt.innerMat.uniforms.uAlpha.value = 0.14;
        }
        if (onGatePass) onGatePass(gt.name, passedCount, gates.length);
      }
    }
  }

  return { group: g, gates, checkPlayer, getProgress: () => `${passedCount}/${gates.length}` };
}

/**
 * Assembles the Entire EXTREME-DETAIL GTA Open-World Expansion for Project Arcadia!
 */
export function createOpenWorldExpansion(textures, onGatePass) {
  const root = new THREE.Group();

  const roadTex = createRoadTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    normalMap: textures.basaltNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.92,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#383e48',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.78
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#bcc4ce',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughnessMap: textures.steelRough,
    roughness: 0.48,
    metalness: 0.76,
    envMapIntensity: 0.68
  });
  const basaltMat = new THREE.MeshStandardMaterial({
    color: '#6b5c53',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    roughness: 0.88,
    metalness: 0.10
  });
  const amberMat = new THREE.MeshBasicMaterial({ color: '#ffbf5e' });
  const cyanMat = new THREE.MeshBasicMaterial({ color: '#45e6d6' });

  // 1. Drivable Raised Sintered-Basalt Martian Highway Network + Overhead Wayfinding 3D Box-Truss Gantries
  HIGHWAY_PATHS.forEach((pts) => {
    root.add(buildTerrainRoadRibbon(pts, 11.5, roadMat, darkSteel, amberMat));
  });
  root.add(buildHighwayGantries(darkSteel, steelMat, basaltMat, amberMat));

  // 2. Stratified Martian Red Canyon Rock Arches & Engineered Steel-Truss Cold-Gas Stunt Ramps
  const canyon = buildRedCanyonLandmarks(textures, darkSteel, steelMat, amberMat, cyanMat);
  root.add(canyon.group);

  // 3. Extreme-Detail Ogive-Profile Salvaged 55m Starship Saloon & Workshop Outpost (Scene 04!)
  root.add(buildStarshipSaloonOutpost(textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat));

  // 3b. Clean Mars Medevac / Frontier Rescue Outpost Pad (Scene 07!)
  root.add(buildMedevacRescueOutpost(textures, darkSteel, steelMat, basaltMat, amberMat));

  // 4. Extreme-Detail 48m Tapered Lattice Ice-Mining Quarry & Sabatier Refinery (Scene 05!)
  const quarry = buildIceMiningQuarry(textures, darkSteel, steelMat, amberMat, cyanMat);
  root.add(quarry.group);

  // 5. Outpost Elevated Circular Sky-Pads (PAD-03 Quarry, PAD-04 Saloon, PAD-05 Megaport Overlook!)
  SKY_PADS.slice(1).forEach((pad) => {
    root.add(buildOutpostSkyPad(pad, textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat));
  });

  // 6. Sweeping Arched Spaceport Concourse Terminal + Air-Traffic Control Tower (Scene 10!)
  const terminal = buildSpaceportConcourseTerminal(textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat);
  root.add(terminal.group);

  // 7. 440 Instanced Multi-Archetype Martian Basalt & Sedimentary Boulders across the Open World!
  root.add(buildInstancedMarsBoulders(textures));

  // 8. Living Open-World Sky Traffic: 2 Blender-Sculpted NPC Flying Roadsters arcing across Arcadia!
  const skyTraffic = [
    {
      mesh: buildRoadsterMesh(textures),
      from: new THREE.Vector3(-206, getTerrainHeight(-206, -372) + 4.0, -372),
      to:   new THREE.Vector3(195,  getTerrainHeight(195, -405) + 4.0,  -405),
      peak: 68, speed: 0.042, phase: 0.1
    },
    {
      mesh: buildRoadsterMesh(textures),
      from: new THREE.Vector3(292,  getTerrainHeight(292, -215) + 4.0, -215),
      to:   new THREE.Vector3(-90,  getTerrainHeight(-90, -140) + 18.0, -140),
      peak: 55, speed: 0.036, phase: 0.65
    }
  ];
  skyTraffic.forEach((tr) => {
    tr.mesh.shadowDecal.visible = false;
    root.add(tr.mesh.car);
  });

  const tmpPos = new THREE.Vector3();
  const nextPos = new THREE.Vector3();

  return {
    group: root,
    ramps: canyon.ramps,
    update(dt, t) {
      quarry.drillGroup.rotation.y += dt * 1.45;
      quarry.vaporCone.rotation.y -= dt * 0.45;
      if (quarry.vaporCone.material.uniforms) {
        quarry.vaporCone.material.uniforms.uTime.value = t;
        quarry.vaporCone.material.uniforms.uOpacity.value = 0.22 + Math.sin(t * 2.6) * 0.04;
      }
      terminal.radarPivot.rotation.y += dt * 1.25;
      for (const fl of canyon.rallyFlags) {
        fl.mesh.rotation.y = fl.baseYaw + Math.sin(t * 3.4 + fl.phase) * 0.22;
      }

      skyTraffic.forEach((tr) => {
        const cyc = (t * tr.speed + tr.phase) % 2;
        const fwd = cyc <= 1;
        const u = fwd ? cyc : 2 - cyc;
        const uNext = Math.min(1, u + 0.01);
        tmpPos.lerpVectors(tr.from, tr.to, u);
        tmpPos.y += Math.sin(u * Math.PI) * tr.peak;
        nextPos.lerpVectors(tr.from, tr.to, uNext);
        nextPos.y += Math.sin(uNext * Math.PI) * tr.peak;

        tr.mesh.car.position.copy(tmpPos);
        const dx = (fwd ? 1 : -1) * (nextPos.x - tmpPos.x);
        const dz = (fwd ? 1 : -1) * (nextPos.z - tmpPos.z);
        tr.mesh.car.rotation.y = Math.atan2(dx, dz);
        tr.mesh.car.rotation.x = Math.cos(u * Math.PI) * (fwd ? -0.18 : 0.18);
        const jetPower = (u < 0.25 || u > 0.75) ? 0.85 : 0.36;
        tr.mesh.setThrusterFx(t, jetPower, 0.58, 0, 0);
      });
    }
  };
}
