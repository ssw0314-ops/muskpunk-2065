import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../terrain.js';
import { STARSHIP_GLB_GZIP_B64 } from './starship_glb_data.js';
import { createVolumetricCloudSystem, createLaunchEjectaSystem } from '../vfx/volumetric_clouds.js';
import { buildHoodedMarsLamp, buildIndustrialCryoSilo, buildCryoSphereTank } from './industrial_props.js';
import { enhanceSteelMonumentMaterial } from '../vfx/cinematic_shaders.js';

let _starshipGlbPromise = null;
let _starshipGlbLoaded = false;
export function isStarshipLoaded() {
  return _starshipGlbLoaded;
}
function getStarshipGlbTemplate() {
  if (!_starshipGlbPromise) {
    _starshipGlbPromise = (async () => {
      const binStr = atob(STARSHIP_GLB_GZIP_B64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const ds = new DecompressionStream('gzip');
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      const loader = new GLTFLoader();
      const scene = await new Promise((resolve, reject) => {
        loader.parse(buf, '', (gltf) => resolve(gltf.scene), reject);
      });
      _starshipGlbLoaded = true;
      return scene;
    })();
  }
  return _starshipGlbPromise;
}

/**
 * Reusable cached Blender 5.0 55m Mars Starship V4 hull mounter (shared by Megaport fleet & Rusty Starship Saloon!):
 *  - 5,610-tri sculpted tangent-ogive 30X welded stainless leeward + hexagonal silica TPS windward hull
 *  - Airfoil-section swept aft flaps + sleek V3 leeward forward flaps w/ teardrop hinge actuator fairings
 *  - Parabolic De-Laval 6-Raptor 3 / RVac engine cluster + weld ribs, payload door bay & catch pins!
 */
export function mountBlenderStarshipHull(parent, mats, yOffset = 0) {
  getStarshipGlbTemplate()
    .then((tpl) => {
      const clone = tpl.clone(true);
      clone.position.y = yOffset;
      clone.traverse((child) => {
        if (!child.isMesh) return;
        const n = child.name || '';
        if (n.includes('Steel')) {
          child.material = mats.steel;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('TPS')) {
          child.material = mats.tps;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('Raptor')) {
          child.material = mats.raptors;
          child.castShadow = true;
        }
      });
      parent.add(clone);
    })
    .catch((err) => console.error('Failed to mount Blender Starship GLB:', err));
}

/**
 * Builds an AAA Blender 5.0 55m × 9m Mars Starship V3/V4 (Scene 02!):
 *  - Cached Blender sculpted 55m stainless/TPS hull, airfoil flaps & parabolic De-Laval 6-Raptor bells
 *  - 6 wide-stance telescoping 0.38G Martian landing legs with diagonal A-frame braces & hexagonal crush footpads
 */
function buildStarshipMesh(textures, highDetail = true) {
  const ship = new THREE.Group();
  const radius = 4.5; // Exact 9m diameter!

  const steelMat = enhanceSteelMonumentMaterial(new THREE.MeshStandardMaterial({
    color: '#c4cbd4',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: textures.steelRough,
    roughness: 0.48,
    metalness: 0.80,
    envMapIntensity: 0.78
  }), { mode: 'starship', dustStrength: 0.22 });
  const tpsMat = new THREE.MeshStandardMaterial({
    color: '#1e2127',
    map: textures.tpsColor,
    normalMap: textures.tpsNormal,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughnessMap: textures.tpsRough,
    roughness: 0.72,
    metalness: 0.18
  });
  const bellMat = new THREE.MeshStandardMaterial({
    color: '#3c424c',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.32,
    metalness: 0.92,
    side: THREE.DoubleSide
  });

  // Mount Blender 5.0 55m Starship V4 sculpted hull cleanly at y = 2.4m above landing leg pads!
  const hullAnchor = new THREE.Group();
  hullAnchor.position.y = 2.4;
  ship.add(hullAnchor);
  mountBlenderStarshipHull(hullAnchor, { steel: steelMat, tps: tpsMat, raptors: bellMat }, 0);

  // 6 Wide-Stance Articulated 0.38G Martian Telescoping Landing Legs + Diagonal Brace Struts + Hex Footpads (Scene 02!)
  const legGroup = new THREE.Group();
  const legOuterMat = new THREE.MeshStandardMaterial({ color: '#454b54', roughness: 0.48, metalness: 0.82 });
  const pistonMat = new THREE.MeshStandardMaterial({ color: '#cfd6de', roughness: 0.22, metalness: 0.94 });

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const ca = Math.cos(a), sa = Math.sin(a);

    // Outer upper hydraulic housing attached to aft skirt
    const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.8, 8), legOuterMat);
    upperLeg.position.set(ca * (radius + 0.65), 1.6, sa * (radius + 0.65));
    upperLeg.rotation.z = -ca * 0.46;
    upperLeg.rotation.x = sa * 0.46;
    upperLeg.castShadow = true;
    legGroup.add(upperLeg);

    // Chrome inner telescoping piston rod extending down to crush pad
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 3.6, 8), pistonMat);
    piston.position.set(ca * (radius + 1.85), -0.75, sa * (radius + 1.85));
    piston.rotation.z = -ca * 0.46;
    piston.rotation.x = sa * 0.46;
    legGroup.add(piston);

    // Lower diagonal A-frame stabilizer brace back to skirt base
    if (highDetail) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), legOuterMat);
      brace.position.set(ca * (radius + 0.85), -0.65, sa * (radius + 0.85));
      brace.rotation.z = ca * 0.72;
      brace.rotation.x = -sa * 0.72;
      legGroup.add(brace);
    }

    // Wide hexagonal crush-core footpad resting flat on sintered pad
    const padFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.15, 0.42, 6), legOuterMat);
    padFoot.position.set(ca * (radius + 2.55), -2.2, sa * (radius + 2.55));
    padFoot.receiveShadow = true;
    legGroup.add(padFoot);
  }
  legGroup.position.y = 2.4;
  ship.add(legGroup);
  ship.userData.legGroup = legGroup;

  return ship;
}

/**
 * Builds a high-detail Scene 02 Multi-Tier Steel Lattice Mechazilla Catch & Maintenance Tower
 * with concrete footings, full 4-sided X-bracing, yellow safety handrails, individual stepped external
 * staircase treads, twin hydraulic chopstick actuators, QD cryo umbilical arm & top lightning spire!
 */
function buildMaintenanceGantry(darkSteel, yellowSteel, deckMat) {
  const gantry = new THREE.Group();
  const h = 25.5;
  const w = 4.6, d = 3.8;
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#cfd6de', roughness: 0.22, metalness: 0.94 });
  const redStrobe = new THREE.MeshBasicMaterial({ color: '#ff3b30' });

  // 4 concrete anchor plinths + vertical steel H-columns
  for (const gx of [-w / 2, w / 2]) {
    for (const gz of [-d / 2, d / 2]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.95), darkSteel);
      foot.position.set(gx, 0.42, gz);
      gantry.add(foot);
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.42), darkSteel);
      col.position.set(gx, h * 0.5, gz);
      col.castShadow = true;
      gantry.add(col);
    }
  }

  // Vertical insulated LOX/CH4 cryo riser pipes climbing up the tower core
  for (const pz of [-0.55, 0.55]) {
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, h - 1.5, 8), chromeMat);
    riser.position.set(-w / 2 + 0.55, (h - 1.5) * 0.5 + 0.5, pz);
    gantry.add(riser);
  }

  // 4 Grated Work Platforms + Yellow Safety Handrails + Full Front/Back Diagonal Cross-Bracing!
  const tiers = [5.5, 11.2, 16.8, 22.5];
  tiers.forEach((ty, idx) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.65, 0.34, d + 0.65), deckMat);
    deck.position.set(0, ty, 0);
    gantry.add(deck);

    // Perimeter yellow industrial guardrails (top & mid bars + corner stanchions!)
    for (const rz of [-d / 2 - 0.24, d / 2 + 0.24]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.10, 0.10), yellowSteel);
      rail.position.set(0, ty + 1.12, rz);
      gantry.add(rail);
      const midR = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.06, 0.06), yellowSteel);
      midR.position.set(0, ty + 0.62, rz);
      gantry.add(midR);
    }
    const railSide = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, d + 0.55), yellowSteel);
    railSide.position.set(w / 2 + 0.24, ty + 1.12, 0);
    gantry.add(railSide);

    // Diagonal lattice X-braces on both front & rear faces between tiers
    const midY = ty - 2.8;
    for (const fz of [-d / 2, d / 2]) {
      for (const sign of [-1, 1]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.8, 0.16), darkSteel);
        brace.position.set(0, midY, fz);
        brace.rotation.z = sign * 0.65;
        gantry.add(brace);
      }
    }

    // Quick-Disconnect (QD) Starship Cryo Umbilical Swing Arm at Tier 2 (y = 11.2m)!
    if (idx === 1) {
      const qdArm = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 0.95), darkSteel);
      qdArm.position.set(-w / 2 - 2.7, ty + 0.4, 0);
      gantry.add(qdArm);
      const qdHood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 1.35), yellowSteel);
      qdHood.position.set(-w / 2 - 5.4, ty + 0.4, 0);
      gantry.add(qdHood);
    }

    // Top cantilevered swing-access bridge reaching toward Starship hull (-X)
    if (idx === tiers.length - 1) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.30, 2.4), deckMat);
      bridge.position.set(-w / 2 - 2.4, ty, 0);
      gantry.add(bridge);
      for (const bz of [-1.15, 1.15]) {
        const bRail = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.10, 0.10), yellowSteel);
        bRail.position.set(-w / 2 - 2.4, ty + 1.05, bz);
        gantry.add(bRail);
      }
    }
  });

  // SpaceX Mechazilla-Style Twin Articulated Chopstick Catch/Stabilizer Arms + Hydraulic Actuators & Hoist Crown!
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 3.4, d + 1.8), darkSteel);
  carriage.position.set(-0.6, h - 2.6, 0);
  gantry.add(carriage);
  for (const side of [-1, 1]) {
    const chopstick = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.48, 0.95), darkSteel);
    chopstick.position.set(-w / 2 - 5.8, h - 2.6, side * 5.2);
    chopstick.rotation.y = side * -0.10;
    chopstick.castShadow = true;
    gantry.add(chopstick);
    // Cushioned yellow catch rail + lower diagonal hydraulic actuator strut!
    const padRail = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.38, 0.38), yellowSteel);
    padRail.position.set(-w / 2 - 6.1, h - 1.72, side * 4.8);
    padRail.rotation.y = side * -0.10;
    gantry.add(padRail);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.2, 8), chromeMat);
    piston.position.set(-w / 2 - 2.4, h - 4.4, side * 3.4);
    piston.rotation.z = -0.82;
    piston.rotation.y = side * -0.22;
    gantry.add(piston);
  }

  // Crown Pulley Sheave Box + Tall Lightning Arrestor Spire + Aviation Red Obstruction Strobe!
  const crownCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.75, d + 0.8), darkSteel);
  crownCap.position.y = h + 0.35;
  gantry.add(crownCap);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 6.2, 6), chromeMat);
  spire.position.y = h + 3.6;
  gantry.add(spire);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), redStrobe);
  strobe.position.y = h + 6.8;
  gantry.add(strobe);

  // Real Multi-Step External Industrial Access Staircase Flight on right flank (+X) with individual treads & twin handrails!
  const stairG = new THREE.Group();
  const steps = 16;
  const runZ = 9.6, riseY = 11.2;
  for (let s = 0; s < steps; s++) {
    const f = s / (steps - 1);
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.10, 0.56), deckMat);
    tread.position.set(w / 2 + 1.05, 0.45 + f * (riseY - 0.5), 9.4 - f * runZ);
    stairG.add(tread);
  }
  const stairLen = Math.hypot(runZ, riseY);
  const stairAng = Math.atan2(riseY, runZ);
  for (const sx of [w / 2 + 0.38, w / 2 + 1.72]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, stairLen), darkSteel);
    stringer.position.set(sx, riseY * 0.5, 9.4 - runZ * 0.5);
    stringer.rotation.x = stairAng;
    stairG.add(stringer);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, stairLen), yellowSteel);
    rail.position.set(sx, riseY * 0.5 + 1.05, 9.4 - runZ * 0.5);
    rail.rotation.x = stairAng;
    stairG.add(rail);
  }
  gantry.add(stairG);

  return gantry;
}

/**
 * Hyper-Realistic Triple-Layer Martian Methalox Raptor 3 Plume (0.61 kPa Thin Mars Atmosphere!):
 *  1. Inner Supersonic Mach-Diamond Core: live 3-octave GLSL FBM plasma turbulence + Prandtl-Meyer pinched standing shock diamonds
 *  2. Outer 0.61 kPa Low-Pressure Expansion Envelope: wide gossamer magenta-violet / dust-kissed Fresnel plasma sheath
 *  3. Convective Thermal Heat-Shimmer Distortion Halo rippling off the Raptor 3 skirt!
 */
function buildMethaloxPlume() {
  const grp = new THREE.Group();
  grp.position.y = 2.4; // Anchored directly at Raptor 3 engine bell exits!

  function makeLayerMat(layerMode) {
    // layerMode: 0 = outer envelope, 1 = inner Mach core, 2 = convective thermal heat-shimmer sheath
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: layerMode === 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uMode: { value: layerMode }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uMode;
        varying float vAxial;
        varying float vAngle;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          vAxial = clamp(1.0 - uv.y, 0.0, 1.0);
          vAngle = uv.x * 6.2831853;
          vec3 pos = position;
          // Physical supersonic Prandtl-Meyer expansion & compression waist pinch along Mach diamond cells!
          if (uMode > 0.5 && uMode < 1.5) {
            float pinch = 1.0 - 0.14 * pow(0.5 + 0.5 * sin(vAxial * 36.0 - uTime * 72.0), 2.0) * exp(-vAxial * 1.9);
            pos.xz *= pinch;
          } else if (uMode > 1.5) {
            // Convective heat shimmer ripple waves around exhaust column
            float ripple = sin(vAxial * 28.0 - uTime * 38.0 + vAngle * 3.0) * 0.45 * vAxial;
            pos.xz += normalize(pos.xz + vec2(0.0001)) * ripple;
          }
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uMode;
        varying float vAxial;
        varying float vAngle;
        varying vec3 vNormalView;
        varying vec3 vViewDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm3(vec2 p) {
          float v = 0.0, a = 0.54;
          for (int i = 0; i < 3; i++) {
            v += a * vnoise(p);
            p = p * 2.07 + vec2(9.1, 17.3);
            a *= 0.48;
          }
          return v;
        }

        void main() {
          if (uIntensity <= 0.008) discard;
          float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
          float topSoft = smoothstep(0.0, 0.03, vAxial);

          // Live supersonic 3-octave GLSL FBM plasma turbulence (seamless cylindrical coords!)
          vec2 cylCoord = vec2(sin(vAngle) * 2.2 + cos(vAngle) * 1.4, vAxial * 9.5 - uTime * 22.0);
          float f1 = fbm3(cylCoord);
          float f2 = fbm3(cylCoord * 2.1 + vec2(f1 * 1.4, -uTime * 11.0));
          float turb = mix(0.64, 1.24, mix(f1, f2, 0.52));

          // MODE 2: Convective thermal heat-shimmer refraction sheath
          if (uMode > 1.5) {
            float rimF = pow(1.0 - ndv, 1.8) * pow(ndv, 0.65);
            float shimmerWave = pow(smoothstep(0.32, 0.88, f2), 1.6);
            float fade = topSoft * pow(max(0.0, 1.0 - vAxial), 1.5);
            vec3 hazeCol = mix(vec3(1.0, 0.72, 0.44), vec3(0.86, 0.72, 1.0), 1.0 - vAxial);
            float a = rimF * shimmerWave * fade * uIntensity * 0.24;
            if (a <= 0.004) discard;
            gl_FragColor = vec4(hazeCol, a);
            return;
          }

          float isCore = step(0.5, uMode);
          float fresnel = pow(max(0.0, ndv), isCore > 0.5 ? 1.18 : 1.95);
          float tailFade = pow(max(0.0, 1.0 - vAxial), isCore > 0.5 ? 1.32 : 1.12);

          // Crisp standing supersonic Mach shock-diamond compression nodes (6 rhythmic CH4/LOX cells!)
          float shockCell = abs(sin(vAxial * 19.0 - uTime * 36.0 + f1 * 0.6));
          float shock = pow(1.0 - shockCell, 4.2) * exp(-vAxial * 2.05);
          float shockCore = pow(max(0.0, ndv), 2.4) * shock;

          vec3 whiteThroat = vec3(1.00, 0.99, 1.00);
          vec3 methaloxBlue = vec3(0.28, 0.64, 1.00);
          vec3 marsViolet = vec3(0.68, 0.34, 0.98);
          vec3 dustAmber = vec3(0.96, 0.52, 0.28);

          vec3 col = mix(methaloxBlue, marsViolet, smoothstep(0.14, 0.66, vAxial));
          col = mix(col, dustAmber, smoothstep(0.62, 1.0, vAxial) * (1.0 - isCore * 0.68));
          col = mix(col, whiteThroat, clamp(exp(-vAxial * 3.8) + shockCore * 1.45 * isCore, 0.0, 1.0));

          float boost = isCore > 0.5 ? (1.92 + shockCore * 2.15) : 1.14;
          float baseOp = isCore > 0.5 ? 0.94 : 0.60;
          float alpha = topSoft * tailFade * fresnel * turb * uIntensity * baseOp;
          alpha += shockCore * uIntensity * isCore * 0.55;

          gl_FragColor = vec4(col * boost, clamp(alpha, 0.0, 0.98));
        }
      `
    });
  }

  const coreMat = makeLayerMat(1);
  const coreGeo = new THREE.CylinderGeometry(3.0, 10.2, 62, 24, 24, true);
  coreGeo.translate(0, -31, 0);
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  grp.add(coreMesh);

  const outerMat = makeLayerMat(0);
  const outerGeo = new THREE.CylinderGeometry(4.0, 22.5, 76, 24, 20, true);
  outerGeo.translate(0, -38, 0);
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  grp.add(outerMesh);

  const shimmerMat = makeLayerMat(2);
  const shimmerGeo = new THREE.CylinderGeometry(5.2, 28.0, 68, 20, 18, true);
  shimmerGeo.translate(0, -34, 0);
  const shimmerMesh = new THREE.Mesh(shimmerGeo, shimmerMat);
  grp.add(shimmerMesh);

  // Blinding incandescent Raptor 3 bell throat core disc!
  const throatMat = new THREE.MeshBasicMaterial({
    color: '#eef6ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const throatDisc = new THREE.Mesh(new THREE.CircleGeometry(3.5, 18), throatMat);
  throatDisc.rotation.x = Math.PI / 2;
  throatDisc.position.y = -0.35;
  grp.add(throatDisc);

  return {
    group: grp,
    setPower(t, power) {
      const p = THREE.MathUtils.clamp(power, 0, 1.2);
      grp.visible = p > 0.008;
      coreMat.uniforms.uTime.value = t;
      coreMat.uniforms.uIntensity.value = p;
      outerMat.uniforms.uTime.value = t;
      outerMat.uniforms.uIntensity.value = p;
      shimmerMat.uniforms.uTime.value = t;
      shimmerMat.uniforms.uIntensity.value = p;
      throatMat.opacity = Math.min(0.96, p * (0.85 + Math.sin(t * 72) * 0.12));
      const scLen = 0.42 + p * 0.72;
      const scWid = 0.75 + p * 0.42;
      coreMesh.scale.set(scWid, scLen, scWid);
      outerMesh.scale.set(scWid * 1.05, scLen * 1.05, scWid * 1.05);
      shimmerMesh.scale.set(scWid * 1.12, scLen * 1.02, scWid * 1.12);
    }
  };
}

/**
 * Glowing Supersonic Ground-Impingement Blast Disc hugging the concrete pad beneath an active Starship exhaust!
 */
/**
 * Dual-Layer Photorealistic Supersonic Pad Impingement System:
 *  1. Incandescent ground blast core & Mach compression shockwaves hugging the sintered pad
 *  2. 3D raised conical high-velocity supersonic Martian dust-shear curtain flaring radially outward!
 */
function buildPadBlastDisc() {
  const grp = new THREE.Group();

  const discMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
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
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        if (uIntensity <= 0.01) discard;
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float streaks = 0.60 + 0.40 * sin(ang * 18.0 + sin(r * 14.0 - uTime * 26.0) * 1.6);
        float wave = 0.62 + 0.38 * sin(r * 24.0 - uTime * 34.0 + sin(ang * 9.0) * 0.6);
        float core = exp(-r * r * 6.0);
        float ring = exp(-pow((r - 0.52) / 0.24, 2.0)) * wave * streaks;
        vec3 amber = vec3(1.00, 0.54, 0.22);
        vec3 violet = vec3(0.76, 0.72, 1.00);
        vec3 whiteHot = vec3(1.00, 0.98, 0.96);
        vec3 col = mix(amber, violet, clamp(exp(-r * 2.2), 0.0, 1.0));
        col = mix(col, whiteHot, clamp(core * 1.45, 0.0, 1.0));
        float alpha = (core * 1.25 + ring * 0.78) * (1.0 - smoothstep(0.72, 1.0, r)) * uIntensity * 0.90;
        gl_FragColor = vec4(col * 1.45, clamp(alpha, 0.0, 0.98));
      }
    `
  });
  const discMesh = new THREE.Mesh(new THREE.PlaneGeometry(54, 54), discMat);
  discMesh.rotation.x = -Math.PI / 2;
  grp.add(discMesh);

  // 3D Conical Supersonic Ground-Skimming Dust & Steam Shear Curtain flaring out from the flame trench!
  const curtainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
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
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        if (uIntensity <= 0.02) discard;
        // uv.y = 1 near inner blast center (elevated), 0 at outer ground edge
        float radial = 1.0 - vUv.y;
        float ang = vUv.x * 6.2831853;
        float streak1 = 0.5 + 0.5 * sin(ang * 16.0 + sin(radial * 10.0 - uTime * 18.0) * 1.8);
        float streak2 = 0.5 + 0.5 * cos(ang * 29.0 - radial * 18.0 + uTime * 24.0);
        float turb = 0.45 + 0.55 * (streak1 * 0.6 + streak2 * 0.4);
        float innerEdge = smoothstep(0.0, 0.14, radial);
        float outerFade = pow(max(0.0, 1.0 - radial), 1.45);
        // Incandescent peach-white fire near center -> sunlit Martian ochre dust curtain outward!
        vec3 hotInner = vec3(1.00, 0.80, 0.58);
        vec3 marsDust = vec3(0.76, 0.42, 0.25);
        vec3 col = mix(hotInner, marsDust, smoothstep(0.08, 0.65, radial));
        float alpha = innerEdge * outerFade * turb * uIntensity * 0.56;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.72));
      }
    `
  });
  const curtainGeo = new THREE.CylinderGeometry(14.5, 58.0, 12.5, 32, 4, true);
  curtainGeo.translate(0, 5.2, 0);
  const curtainMesh = new THREE.Mesh(curtainGeo, curtainMat);
  grp.add(curtainMesh);

  grp.visible = false;
  return { mesh: grp, mat: discMat, curtainMat };
}

/**
 * Arcadia Interplanetary Megaport (Scene 02 Photorealistic Living Spaceport Fleet Operations!):
 *  - 14 towering Blender 55m Starships + scorched hexagonal sintered pads + Mechazilla catch towers
 *  - 460-puff GPU-Instanced Volumetric 3D-Lit Cauliflower Cloud Engine (internal Raptor fire-scatter!):
 *      * Pyroclastic toroidal Martian dust blast walls rolling & curling upward off the pad
 *      * Boiling white-ivory booster exhaust steam columns + sky-piercing sunlit ascent contrails
 *      * Heavy sinking cryogenic LOX/CH4 boil-off waterfalls pooling across launchpad & tank farm
 *      * Permanent ambient Martian ground spindrift sweeping across the Megaport tarmac
 *  - 240-particle 0.38G ballistic glowing concrete sparks & flying basalt regolith ejecta!
 */
export function createMegaport(textures, onLaunchAudio) {
  const root = new THREE.Group();

  const padMat = new THREE.MeshStandardMaterial({
    color: '#6b5e55',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.basaltRough,
    roughness: 0.88,
    metalness: 0.10
  });
  const yellowSteel = new THREE.MeshStandardMaterial({
    color: '#d4a33a',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.52,
    metalness: 0.45
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#3c424b',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.82
  });
  const cryoSteel = new THREE.MeshStandardMaterial({
    color: '#cad2da',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughness: 0.46,
    metalness: 0.72
  });
  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.deckColor,
    normalMap: textures.deckNormal,
    roughness: 0.65,
    metalness: 0.65
  });
  const floodLampMat = new THREE.MeshBasicMaterial({ color: '#ffe1a0' });
  const gseWhite = new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.55, metalness: 0.25 });

  // Scorched carbon exhaust-scour pad decal material (darker on active launch pads!)
  const scorchActiveMat = new THREE.MeshBasicMaterial({
    map: textures.padScorch,
    transparent: true,
    opacity: 0.90,
    depthWrite: false
  });
  const scorchStandbyMat = new THREE.MeshBasicMaterial({
    map: textures.padScorch,
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  });

  // 14 Starships spaced realistically across the Arcadia Megaport plain (~150-165m blast safety separation,
  // matching SpaceX Starbase / Mars Megaport pad clearances!) with 50%-cadence staggered fleet operations:
  const shipCoords = [
    // Front servicing & launch row behind first blast berm (z ≈ -535 .. -558, ~160m pad-to-pad separation!)
    { x: 90,  z: -545, rot: 0.32,  fleet: null },
    { x: 245, z: -535, rot: 0.18,  fleet: { padId: 'PAD-03', initState: 'ascent',       initTimer: 0.0,  initAlt: 78,  pitchDir:  1 } }, // FRONT HERO LIFTOFF!
    { x: 405, z: -552, rot: -0.25, fleet: null },
    { x: 565, z: -540, rot: 0.24,  fleet: { padId: 'PAD-05', initState: 'landing_burn', initTimer: 0.0,  initAlt: 158, pitchDir: -1 } }, // FRONT HERO FLIP-BURN LANDING!
    { x: 725, z: -558, rot: -0.15, fleet: null },
    // Mid orbital launch row beyond second blast berm (z ≈ -685 .. -712, ~160m separation!)
    { x: 155, z: -695, rot: 0.12,  fleet: null },
    { x: 315, z: -685, rot: -0.28, fleet: { padId: 'PAD-08', initState: 'idle',         initTimer: 16.0, initAlt: 0,   pitchDir: -1 } }, // 50% CADENCE NEXT LAUNCH!
    { x: 480, z: -708, rot: 0.42,  fleet: null },
    { x: 645, z: -692, rot: 0.0,   fleet: { padId: 'PAD-10', initState: 'idle',         initTimer: 32.0, initAlt: 0,   pitchDir:  1 } }, // 50% CADENCE ROTATION!
    { x: 800, z: -712, rot: -0.2,  fleet: null },
    // Deep horizon fleet apron (z ≈ -830 .. -848, ~170m separation for panoramic Megaport depth!)
    { x: 220, z: -835, rot: 0.3,   fleet: null },
    { x: 395, z: -845, rot: 0.08,  fleet: null },
    { x: 565, z: -830, rot: -0.18, fleet: null },
    { x: 735, z: -848, rot: 0.25,  fleet: null }
  ];

  const activePads = [];

  shipCoords.forEach((sc, idx) => {
    const gy = getTerrainHeight(sc.x, sc.z);
    const isFrontRow = idx < 5;

    // Hexagonal sintered basalt landing pad + scorched exhaust scour decal + steel blast-deflector ring!
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(24.5, 26.8, 1.15, 6), padMat);
    pad.position.set(sc.x, gy + 0.55, sc.z);
    pad.receiveShadow = true;
    root.add(pad);

    const scorch = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), sc.fleet ? scorchActiveMat : scorchStandbyMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.rotation.z = sc.rot * 2.1;
    scorch.position.set(sc.x, gy + 1.16, sc.z);
    root.add(scorch);

    const blastRing = new THREE.Mesh(new THREE.TorusGeometry(12.2, 0.42, 6, 24), darkSteel);
    blastRing.rotation.x = Math.PI / 2;
    blastRing.position.set(sc.x, gy + 1.25, sc.z);
    root.add(blastRing);

    // Starship 55m (Blender 5.0 sculpted hull + 6 telescoping legs!)
    const ship = buildStarshipMesh(textures, isFrontRow || !!sc.fleet);
    ship.position.set(sc.x, gy + 1.15, sc.z);
    ship.rotation.y = sc.rot;
    root.add(ship);

    // Detailed Mechazilla Catch/Maintenance Towers, Lattice Floodlight Towers, Cryo Skids & 6x6 GSE Transporters on Front Row!
    if (isFrontRow) {
      const gantry = buildMaintenanceGantry(darkSteel, yellowSteel, deckMat);
      gantry.position.set(sc.x + 12.2, gy + 1.15, sc.z + 2.5);
      root.add(gantry);

      // Braced 4-Leg Steel Lattice Stadium Floodlight Tower w/ Concrete Footing & Hooded Reflector Bank!
      const mastGroup = new THREE.Group();
      const mFoot = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.9), padMat);
      mFoot.position.y = 0.45;
      mastGroup.add(mFoot);
      for (const mx of [-0.55, 0.55]) {
        for (const mz of [-0.55, 0.55]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 18.0, 6), darkSteel);
          leg.position.set(mx * 0.72, 9.2, mz * 0.72);
          leg.rotation.z = mx * 0.03;
          leg.rotation.x = -mz * 0.03;
          mastGroup.add(leg);
        }
      }
      for (let ti = 1; ti <= 5; ti++) {
        const ty = ti * 3.3;
        const wT = THREE.MathUtils.lerp(1.1, 0.65, ti / 5);
        const tie = new THREE.Mesh(new THREE.BoxGeometry(wT, 0.12, wT), darkSteel);
        tie.position.y = ty;
        mastGroup.add(tie);
      }
      const headDeck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.24, 1.2), darkSteel);
      headDeck.position.y = 18.1;
      mastGroup.add(headDeck);
      const hoodTop = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 0.95), darkSteel);
      hoodTop.position.set(0, 19.05, 0.24);
      hoodTop.rotation.x = 0.28;
      mastGroup.add(hoodTop);
      for (const lx of [-1.35, -0.45, 0.45, 1.35]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.44), darkSteel);
        pod.position.set(lx, 18.55, 0.12);
        pod.rotation.x = 0.25;
        mastGroup.add(pod);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.08), floodLampMat);
        lamp.position.set(lx, 18.52, 0.36);
        lamp.rotation.x = 0.25;
        mastGroup.add(lamp);
      }
      const redTip = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
      redTip.position.y = 19.55;
      mastGroup.add(redTip);
      mastGroup.position.set(sc.x - 16.5, gy + 1.15, sc.z + 11.5);
      mastGroup.rotation.y = 0.55;
      root.add(mastGroup);

      if (idx % 2 === 0) {
        // High-Detail Horizontal Cryo LOX/CH4 Propellant Skid w/ Steel Frame, Saddle Cradles, Relief Stack & Valve Cabinet!
        const skid = new THREE.Group();
        skid.position.set(sc.x - 12.0, gy + 1.15, sc.z - 12.5);
        const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.45, 3.8), darkSteel);
        baseFrame.position.y = 0.22;
        skid.add(baseFrame);
        const tank = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 7.6, 8, 16), cryoSteel);
        tank.rotation.z = Math.PI / 2;
        tank.position.y = 2.25;
        tank.castShadow = true;
        skid.add(tank);
        for (const sx of [-3.4, 0, 3.4]) {
          const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.85, 3.3), darkSteel);
          cradle.position.set(sx, 1.15, 0);
          skid.add(cradle);
          const strap = new THREE.Mesh(new THREE.TorusGeometry(1.54, 0.08, 6, 18), sx === 0 ? yellowSteel : darkSteel);
          strap.rotation.y = Math.PI / 2;
          strap.position.set(sx, 2.25, 0);
          skid.add(strap);
        }
        const valveCab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.75, 2.2), darkSteel);
        valveCab.position.set(5.2, 1.25, 0);
        skid.add(valveCab);
        const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.6, 8), cryoSteel);
        relief.position.set(5.2, 3.2, 0);
        skid.add(relief);
        root.add(skid);
      } else {
        // High-Detail 6-Wheeled Megaport Cryo-Service & Crew Shuttle Transporter (replaces 2 plain boxes!)
        const vanG = new THREE.Group();
        vanG.position.set(sc.x - 9.5, gy + 1.15, sc.z + 13.0);
        vanG.rotation.y = 0.4;
        const glassMat = new THREE.MeshPhysicalMaterial({ color: '#0c1522', roughness: 0.06, metalness: 0.20, clearcoat: 1.0 });
        const tireMat = new THREE.MeshStandardMaterial({ color: '#2b2420', roughness: 0.90, metalness: 0.15 });
        const headMat = new THREE.MeshBasicMaterial({ color: '#f2fbff' });
        const tailMat = new THREE.MeshBasicMaterial({ color: '#ff382e' });
        const strobeMat = new THREE.MeshBasicMaterial({ color: '#ffae38' });

        // Lower armored chassis frame + bumpers
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.55, 6.2), darkSteel);
        chassis.position.y = 0.85;
        vanG.add(chassis);
        // Main pressurized white/silver crew & equipment body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.58, 1.85, 5.65), gseWhite);
        body.position.set(0, 2.02, -0.15);
        body.castShadow = true;
        vanG.add(body);
        // Sloped armored front windshield & side cab windows
        const cabNose = new THREE.Mesh(new THREE.BoxGeometry(2.48, 1.25, 1.15), darkSteel);
        cabNose.position.set(0, 1.55, 2.75);
        vanG.add(cabNose);
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.88, 0.14), glassMat);
        windshield.position.set(0, 2.38, 2.74);
        windshield.rotation.x = -0.34;
        vanG.add(windshield);
        // Yellow Mars Spaceport hazard livery band + recessed utility locker seams
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.24, 5.70), yellowSteel);
        stripe.position.set(0, 1.48, -0.15);
        vanG.add(stripe);
        for (const lz of [-2.0, -0.8, 0.4]) {
          const locker = new THREE.Mesh(new THREE.BoxGeometry(2.63, 0.95, 0.96), darkSteel);
          locker.position.set(0, 2.15, lz);
          vanG.add(locker);
        }
        // Rooftop expedition rack, HVAC pod, amber warning strobe, LED headlights & taillights
        const roofRack = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.28, 3.8), darkSteel);
        roofRack.position.set(0, 3.08, -0.45);
        vanG.add(roofRack);
        const strobe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.22, 8), strobeMat);
        strobe.position.set(0, 3.30, 1.75);
        vanG.add(strobe);
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.18, 0.10), headMat);
        hBar.position.set(0, 1.25, 3.34);
        vanG.add(hBar);
        const tBar = new THREE.Mesh(new THREE.BoxGeometry(2.10, 0.18, 0.10), tailMat);
        tBar.position.set(0, 1.32, -3.02);
        vanG.add(tBar);
        // 6 Heavy Lugged Mars Wheels
        for (const wx of [-1.32, 1.32]) {
          for (const wz of [1.95, -0.35, -2.05]) {
            const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.44, 14), tireMat);
            wh.rotation.z = Math.PI / 2;
            wh.position.set(wx, 0.56, wz);
            wh.castShadow = true;
            vanG.add(wh);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.48, 10), cryoSteel);
            hub.rotation.z = Math.PI / 2;
            hub.position.set(wx, 0.56, wz);
            vanG.add(hub);
          }
        }
        root.add(vanG);
      }
    }

    // Equip each scheduled fleet Starship with Dual-Layer Methalox Plume, Dual-Layer Pad Blast Skirt & Dynamic Light!
    if (sc.fleet) {
      const plume = buildMethaloxPlume();
      ship.add(plume.group);

      const blastDisc = buildPadBlastDisc();
      blastDisc.mesh.position.set(sc.x, gy + 1.30, sc.z);
      root.add(blastDisc.mesh);

      const padLight = new THREE.PointLight('#ffd2a6', 0, 440, 1.2);
      padLight.position.set(sc.x, gy + 18, sc.z);
      root.add(padLight);

      // Low-profile armored runway/blast-pad warning beacon pods (replaces floating orange balls!)
      const warnMat = new THREE.MeshBasicMaterial({ color: '#ffae38' });
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2 + Math.PI / 4;
        const bx = sc.x + Math.cos(a) * 19.8, bz = sc.z + Math.sin(a) * 19.8;
        const podBase = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.92, 0.48, 8), darkSteel);
        podBase.position.set(bx, gy + 1.38, bz);
        root.add(podBase);
        const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.36, 10), warnMat);
        bc.position.set(bx, gy + 1.76, bz);
        root.add(bc);
        const podHood = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.24, 8), darkSteel);
        podHood.position.set(bx, gy + 2.02, bz);
        root.add(podHood);
      }

      activePads.push({
        padId: sc.fleet.padId,
        ship,
        plume,
        blastDisc,
        padLight,
        warnMat,
        basePos: new THREE.Vector3(sc.x, gy + 1.15, sc.z),
        baseRotY: sc.rot,
        pitchDir: sc.fleet.pitchDir,
        state: sc.fleet.initState,
        timer: sc.fleet.initTimer,
        alt: sc.fleet.initAlt,
        vel: sc.fleet.initState === 'ascent' ? 24.0 : (sc.fleet.initState === 'belly_flop' ? -52 : (sc.fleet.initState === 'landing_burn' ? -24 : 0)),
        downrange: sc.fleet.initState === 'belly_flop' ? sc.fleet.pitchDir * 44.0 : (sc.fleet.initState === 'landing_burn' ? sc.fleet.pitchDir * 16.0 : 0),
        pitch: sc.fleet.initState === 'belly_flop' ? sc.fleet.pitchDir * 0.72 : (sc.fleet.initState === 'landing_burn' ? sc.fleet.pitchDir * 0.34 : 0),
        legDeploy: (sc.fleet.initState === 'ascent' || sc.fleet.initState === 'belly_flop' || sc.fleet.initState === 'landing_burn') ? 0.0 : 1.0,
        dustAccum: 0,
        trailAccum: 0,
        cryoAccum: 0
      });
    }
  });

  // High-Detail Braced Spherical Cryogenic LOX / Liquid Methane Propellant Tank Farms flanking the Expanded Megaport!
  const cyanBandMat = new THREE.MeshBasicMaterial({ color: '#5eead4' });
  const tankFarmCoords = [
    [136, -496], [156, -496], [176, -496],
    [325, -496], [345, -496],
    [485, -496], [505, -496]
  ];
  tankFarmCoords.forEach(([sx, sz], idx) => {
    const sy = getTerrainHeight(sx, sz);
    const sphereTank = buildCryoSphereTank(5.4, textures, {
      steelMat: cryoSteel,
      darkMat: darkSteel,
      concreteMat: padMat,
      bandMat: idx % 2 === 0 ? cyanBandMat : yellowSteel,
      hazardMat: yellowSteel
    });
    sphereTank.position.set(sx, sy, sz);
    root.add(sphereTank);
  });

  // Engineered H-Frame Trestle Main Megaport Cryogenic Propellant Feed Pipeline spanning the 640m Front Row!
  const pipeZ = -592;
  const pipeY = getTerrainHeight(410, pipeZ) + 2.4;
  const mainPipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 650, 12), cryoSteel);
  mainPipe1.rotation.z = Math.PI / 2;
  mainPipe1.position.set(410, pipeY, pipeZ);
  root.add(mainPipe1);
  const mainPipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 650, 12), darkSteel);
  mainPipe2.rotation.z = Math.PI / 2;
  mainPipe2.position.set(410, pipeY + 1.35, pipeZ);
  root.add(mainPipe2);
  for (let px = 90; px <= 730; px += 32) {
    const py = getTerrainHeight(px, pipeZ);
    const hT = Math.max(2.6, pipeY + 1.8 - py);
    // Concrete footing pad + dual H-frame vertical posts + cross-beam + bolted pipe flange collars!
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 3.2), padMat);
    foot.position.set(px, py + 0.35, pipeZ);
    root.add(foot);
    for (const sz of [-1.15, 1.15]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, hT, 0.32), darkSteel);
      col.position.set(px, py + hT * 0.5, pipeZ + sz);
      root.add(col);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 2.7), yellowSteel);
    cross.position.set(px, pipeY - 0.68, pipeZ);
    root.add(cross);
    const flange1 = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.12, 6, 12), darkSteel);
    flange1.rotation.y = Math.PI / 2;
    flange1.position.set(px, pipeY, pipeZ);
    root.add(flange1);
    const flange2 = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.10, 6, 12), yellowSteel);
    flange2.rotation.y = Math.PI / 2;
    flange2.position.set(px, pipeY + 1.35, pipeZ);
    root.add(flange2);
  }

  // =========================================================================
  // PHOTOREALISTIC GPU-INSTANCED VOLUMETRIC LAUNCH CLOUD & EJECTA SYSTEMS!
  // =========================================================================
  const clouds = createVolumetricCloudSystem(textures.cloudVolAtlas, 480, { renderOrder: 7 });
  root.add(clouds.mesh);

  const ejecta = createLaunchEjectaSystem(240);
  root.add(ejecta.mesh);

  // 1. Pyroclastic Martian Regolith Dust Blast Wall (rich iron-oxide ochre crests + dark volcanic crevices!)
  function spawnPyroclasticDust(basePos, intensity, downrangeX = 0, initAge = 0) {
    const ang = Math.random() * Math.PI * 2;
    const isEddy = Math.random() < 0.36; // Mix macro 65m dust towers + crisp 22m turbulent foreground eddies!
    const rad = isEddy ? (10 + Math.random() * 20) : (6 + Math.random() * 14);
    const speed = (isEddy ? (34 + Math.random() * 48) : (24 + Math.random() * 40)) * intensity;
    const cx = basePos.x + downrangeX * 0.45;
    const cz = basePos.z;
    const hueVar = (Math.random() - 0.5) * 0.05;
    clouds.spawn({
      x: cx + Math.cos(ang) * rad,
      y: basePos.y + (isEddy ? 2.5 : 4.2) + Math.random() * 7.5,
      z: cz + Math.sin(ang) * rad,
      originX: cx,
      originZ: cz,
      vx: Math.cos(ang) * speed + 4.5,
      vy: (isEddy ? (2.5 + Math.random() * 6.5) : (4.2 + Math.random() * 9.5)) * intensity,
      vz: Math.sin(ang) * speed,
      drag: 0.44,
      buoyancy: isEddy ? 1.5 : 2.6,
      curlUp: (isEddy ? 12.0 : 18.5) * intensity,
      startSize: isEddy ? (11 + Math.random() * 8) : (20 + Math.random() * 14),
      endSize: isEddy ? (30 + Math.random() * 16) : (60 + Math.random() * 34),
      maxLife: isEddy ? (3.4 + Math.random() * 1.8) : (5.2 + Math.random() * 2.8),
      initAge,
      maxOp: isEddy ? 0.78 : 0.88,
      density: 1.15,
      scatter: 1.40,
      stretchY: 0.82,
      wispiness: isEddy ? 0.96 : 0.72,
      litCol: [0.38 + hueVar, 0.145 + hueVar * 0.4, 0.058], // Photorealistic sunlit Martian iron-oxide dust!
      shadCol: [0.052, 0.016, 0.009]                        // Dramatic dark volcanic terracotta crevices!
    });
  }

  // 2. Boiling Sunlit Booster Exhaust Steam Cloud (sculpted warm-ivory crests + cool umber-slate shadows!)
  function spawnBoosterSteam(basePos, intensity, downrangeX = 0, initAge = 0) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 2 + Math.random() * 10;
    const speed = (14 + Math.random() * 26) * intensity;
    const cx = basePos.x + downrangeX * 0.55;
    const cz = basePos.z;
    clouds.spawn({
      x: cx + Math.cos(ang) * rad,
      y: basePos.y + 4.5 + Math.random() * 9.0,
      z: cz + Math.sin(ang) * rad,
      originX: cx,
      originZ: cz,
      vx: Math.cos(ang) * speed + 3.5,
      vy: (10 + Math.random() * 16) * intensity,
      vz: Math.sin(ang) * speed,
      drag: 0.48,
      buoyancy: 5.5,
      curlUp: 13.0 * intensity,
      startSize: 15 + Math.random() * 11,
      endSize: 52 + Math.random() * 28,
      maxLife: 4.8 + Math.random() * 2.6,
      initAge,
      maxOp: 0.86,
      density: 1.18,
      scatter: 1.75, // Blazes molten amber-peach inside the flame core, sculpted sunlit ivory outside!
      stretchY: 1.06,
      wispiness: 0.82,
      litCol: [0.60, 0.46, 0.35],   // Crisp warm sunlit rocket steam (stays below white-bloom blowout!)
      shadCol: [0.095, 0.068, 0.064] // Deep photographic cool-umber cloud undersides!
    });
  }

  // 3. Persistent Sky-Piercing Sunlit Booster Exhaust & Condensation Contrail Column!
  function spawnAscentContrail(x, y, z, power, isLanding = false, initAge = 0) {
    clouds.spawn({
      x: x + (Math.random() - 0.5) * 5.0,
      y: y + (Math.random() - 0.5) * 4.5,
      z: z + (Math.random() - 0.5) * 5.0,
      vx: 3.8 + (Math.random() - 0.5) * 4.5,
      vy: isLanding ? (-5.5 + Math.random() * 3.5) : (-11 - Math.random() * 7.5),
      vz: (Math.random() - 0.5) * 4.5,
      drag: 0.42,
      buoyancy: 0.9,
      startSize: 12 + Math.random() * 6,
      endSize: 40 + Math.random() * 22,
      maxLife: 6.8 + Math.random() * 3.0,
      initAge,
      maxOp: 0.72 * Math.min(1.0, power),
      density: 1.05,
      scatter: 1.45,
      stretchY: 1.14,
      wispiness: 1.05,
      litCol: isLanding ? [0.56, 0.34, 0.22] : [0.64, 0.50, 0.40],
      shadCol: isLanding ? [0.10, 0.055, 0.048] : [0.11, 0.085, 0.092]
    });
  }

  // 4. Delicate Gossamer Cryogenic LOX/CH4 Boil-Off Waterfall cascading down fuselage & tank farm!
  function spawnCryoWaterfall(basePos, heightOff = 22, heavy = true, initAge = 0) {
    const ang = Math.random() * Math.PI * 2;
    const rad = heavy ? (4.8 + Math.random() * 4.5) : (2.2 + Math.random() * 3.2);
    clouds.spawn({
      x: basePos.x + Math.cos(ang) * rad,
      y: basePos.y + heightOff + (Math.random() - 0.5) * 5.0,
      z: basePos.z + Math.sin(ang) * rad,
      vx: 6.0 + Math.random() * 6.0 + Math.cos(ang) * 2.2,
      vy: heavy ? (-2.2 - Math.random() * 1.6) : (0.5 + Math.random() * 1.2),
      vz: (Math.random() - 0.5) * 3.2 + Math.sin(ang) * 1.8,
      drag: 0.74,
      buoyancy: heavy ? -0.35 : 0.35,
      startSize: heavy ? (9.0 + Math.random() * 6.0) : (6.0 + Math.random() * 4.0),
      endSize: heavy ? (28 + Math.random() * 14) : (18 + Math.random() * 10),
      maxLife: heavy ? (4.0 + Math.random() * 2.0) : (3.2 + Math.random() * 1.6),
      initAge,
      maxOp: heavy ? 0.38 : 0.26,
      density: 0.82,
      scatter: 1.15,
      stretchY: 0.72,
      wispiness: 1.42, // Feathery translucent liquid-oxygen mist wisps (ZERO cotton balls!)
      litCol: [0.48, 0.54, 0.60],
      shadCol: [0.14, 0.17, 0.22]
    });
  }

  // 5. Ballistic 0.38G Glowing Concrete Sparks & Dark Basalt Regolith Ejecta Burst!
  function spawnPadDebris(basePos, intensity, downrangeX = 0) {
    const cx = basePos.x + downrangeX * 0.45;
    const cz = basePos.z;
    const count = Math.ceil(4 + intensity * 6);
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 4 + Math.random() * 11;
      const isSpark = Math.random() < 0.70;
      const spd = (24 + Math.random() * 46) * intensity;
      ejecta.spawn(
        cx + Math.cos(ang) * rad,
        basePos.y + 1.2 + Math.random() * 3.2,
        cz + Math.sin(ang) * rad,
        Math.cos(ang) * spd,
        (7 + Math.random() * 20) * intensity,
        Math.sin(ang) * spd,
        basePos.y,
        isSpark,
        isSpark ? (0.34 + Math.random() * 0.36) : (0.58 + Math.random() * 0.70),
        isSpark ? (1.0 + Math.random() * 1.1) : (1.5 + Math.random() * 1.4)
      );
    }
  }

  // 6. Ambient Wind-Blown Martian Regolith Spindrift & Tank Farm Relief Plumes (always alive!)
  let ambientTimer = 0;
  function spawnAmbientPadAtmosphere(initAge = 0) {
    const tCoord = tankFarmCoords[Math.floor(Math.random() * tankFarmCoords.length)];
    const ty = getTerrainHeight(tCoord[0], tCoord[1]);
    spawnCryoWaterfall({ x: tCoord[0], y: ty, z: tCoord[1] }, 11.5, false, initAge);

    const sx = 90 + Math.random() * 650;
    const sz = -840 + Math.random() * 330;
    const sy = getTerrainHeight(sx, sz);
    clouds.spawn({
      x: sx,
      y: sy + 3.0 + Math.random() * 5.0,
      z: sz,
      vx: 11.0 + Math.random() * 7.5,
      vy: 0.35 + Math.random() * 1.0,
      vz: (Math.random() - 0.5) * 3.5,
      drag: 0.88,
      buoyancy: 0.12,
      startSize: 16 + Math.random() * 12,
      endSize: 40 + Math.random() * 22,
      maxLife: 5.5 + Math.random() * 3.0,
      initAge,
      maxOp: 0.22,
      density: 0.75,
      scatter: 0.8,
      stretchY: 0.46,
      wispiness: 1.45,
      litCol: [0.36, 0.14, 0.06],
      shadCol: [0.08, 0.03, 0.018]
    });
  }

  // PRE-WARM PHOTOREALISTIC CLOUDS ON FRAME 0 so Megaport ALREADY roars with colossal launch clouds & cryo fog!
  function prewarmLaunchClouds() {
    for (const p of activePads) {
      if (p.state === 'ascent') {
        for (let i = 0; i < 34; i++) spawnPyroclasticDust(p.basePos, 1.15, 0, Math.random() * 2.8);
        for (let i = 0; i < 20; i++) spawnBoosterSteam(p.basePos, 1.15, 0, Math.random() * 2.5);
        for (let h = 8; h < p.alt; h += 6.0) {
          spawnAscentContrail(p.basePos.x, p.basePos.y + h, p.basePos.z, 1.0, false, (1.0 - h / p.alt) * 2.8);
        }
      } else if (p.state === 'landing_burn') {
        for (let k = 0; k < 30; k++) {
          const frac = k / 30;
          spawnAscentContrail(
            p.basePos.x + p.downrange + p.pitchDir * frac * frac * 120,
            p.basePos.y + p.alt + frac * 320,
            p.basePos.z,
            0.9 - frac * 0.45,
            true,
            frac * 2.6
          );
        }
      } else if (p.state === 'venting') {
        for (let i = 0; i < 16; i++) {
          spawnCryoWaterfall(p.basePos, 4 + Math.random() * 32, true, Math.random() * 2.4);
        }
      }
    }
    for (let i = 0; i < 14; i++) spawnAmbientPadAtmosphere(Math.random() * 3.0);
    for (let s = 0; s < 6; s++) clouds.step(0.22, s * 0.22, null);
  }
  prewarmLaunchClouds();

  // Pressing `L` triggers the next available idle/venting pad for immediate explosive Raptor ignition!
  function triggerLaunchOrLanding() {
    const candidate = activePads.find((p) => p.state === 'idle' || p.state === 'venting') || activePads[0];
    if (candidate) {
      candidate.state = 'ignition';
      candidate.timer = 1.9;
      candidate.alt = 0;
      candidate.vel = 0;
      candidate.downrange = 0;
      candidate.pitch = 0;
      candidate.legDeploy = 1.0;
      if (onLaunchAudio) onLaunchAudio('launch');
      for (let i = 0; i < 12; i++) spawnBoosterSteam(candidate.basePos, 0.95, 0);
      for (let i = 0; i < 16; i++) spawnPyroclasticDust(candidate.basePos, 0.95, 0);
      spawnPadDebris(candidate.basePos, 1.15, 0);
    }
  }

  function getStatus() {
    const busy = activePads.filter((p) => p.state !== 'idle' && p.state !== 'orbit_wait');
    if (busy.length === 0) return 'STANDBY (14 SHIPS)';
    const primary = busy[0];
    if (primary.state === 'venting') return `${primary.padId} LOX VENT T-${Math.ceil(primary.timer)}s`;
    if (primary.state === 'ignition') return `${primary.padId} RAPTOR IGNITION`;
    if (primary.state === 'ascent') return `${primary.padId} LIFTOFF ${Math.round(primary.alt)}m (${busy.length} OPS)`;
    if (primary.state === 'belly_flop') return `${primary.padId} BELLY-FLOP ${Math.round(primary.alt)}m`;
    return `${primary.padId} LANDING BURN ${Math.round(primary.alt)}m`;
  }

  return {
    group: root,
    triggerLaunchOrLanding,
    getStatus,
    debugPads: activePads,
    setSunLighting: (preset) => clouds.setSunLighting(preset),
    update(dt, t, cameraPos = null) {
      ambientTimer -= dt;
      if (ambientTimer <= 0) {
        ambientTimer = 0.42;
        spawnAmbientPadAtmosphere(0);
      }

      for (let idx = 0; idx < activePads.length; idx++) {
        const p = activePads[idx];
        let plumePower = 0;
        let shudder = 0;
        let warningFast = false;

        if (p.state === 'idle') {
          p.alt = 0; p.vel = 0; p.pitch = 0; p.downrange = 0; p.legDeploy = 1.0;
          p.timer -= dt;
          p.cryoAccum += dt;
          if (p.cryoAccum > 0.65) {
            p.cryoAccum = 0;
            spawnCryoWaterfall(p.basePos, 18 + Math.random() * 14, false);
          }
          if (p.timer <= 0) {
            p.state = 'venting';
            p.timer = 7.5;
          }
        } else if (p.state === 'venting') {
          warningFast = true;
          p.timer -= dt;
          p.cryoAccum += dt;
          if (p.cryoAccum > 0.14) {
            p.cryoAccum = 0;
            spawnCryoWaterfall(p.basePos, 24 + Math.random() * 14, true);
            if (Math.random() < 0.65) spawnCryoWaterfall(p.basePos, 4 + Math.random() * 6, true);
          }
          if (p.timer <= 0) {
            p.state = 'ignition';
            p.timer = 1.9;
            if (onLaunchAudio) onLaunchAudio('launch');
          }
        } else if (p.state === 'ignition') {
          warningFast = true;
          p.timer -= dt;
          const ramp = 1.0 - THREE.MathUtils.clamp(p.timer / 1.9, 0, 1);
          plumePower = 0.30 + ramp * 0.85;
          shudder = ramp * 0.28;

          p.dustAccum += dt;
          if (p.dustAccum > 0.055) {
            p.dustAccum = 0;
            spawnPyroclasticDust(p.basePos, 0.75 + ramp * 0.55, 0);
            spawnPyroclasticDust(p.basePos, 0.65 + ramp * 0.45, 0);
            spawnBoosterSteam(p.basePos, 0.80 + ramp * 0.50, 0);
            if (Math.random() < 0.78) spawnPadDebris(p.basePos, 0.75 + ramp * 0.5, 0);
          }
          if (p.timer <= 0) {
            p.state = 'ascent';
            p.vel = 3.8;
          }
        } else if (p.state === 'ascent') {
          warningFast = p.alt < 120;
          p.vel += (11.5 + Math.min(18, p.alt * 0.045)) * dt;
          p.alt += p.vel * dt;
          plumePower = 1.10;
          p.legDeploy = THREE.MathUtils.clamp(1.0 - (p.alt - 12) / 28, 0, 1);

          const turnFrac = THREE.MathUtils.clamp((p.alt - 75) / 380, 0, 1);
          p.pitch = p.pitchDir * turnFrac * 0.44;
          p.downrange += Math.sin(p.pitch) * p.vel * dt * 0.75;

          if (p.alt < 155) {
            p.dustAccum += dt;
            const gStr = Math.max(0.28, 1.25 - p.alt / 155);
            if (p.dustAccum > 0.065) {
              p.dustAccum = 0;
              spawnPyroclasticDust(p.basePos, gStr, p.downrange);
              if (p.alt < 95) {
                spawnPyroclasticDust(p.basePos, gStr * 0.9, p.downrange);
                spawnBoosterSteam(p.basePos, gStr * 1.05, p.downrange);
                if (Math.random() < 0.72) spawnPadDebris(p.basePos, gStr, p.downrange);
              }
            }
          }

          if (p.alt > 10 && p.alt < 1250) {
            p.trailAccum += dt;
            const trailEvery = p.alt < 680 ? 0.085 : 0.16;
            if (p.trailAccum > trailEvery) {
              p.trailAccum = 0;
              const engY = p.basePos.y + p.alt - 10.0;
              const engX = p.basePos.x + p.downrange - Math.sin(p.pitch) * 12.0;
              spawnAscentContrail(engX, Math.max(p.basePos.y + 4, engY), p.basePos.z, plumePower, false);
            }
          }

          // Climb all the way out of the upper sky before handing off to orbit (no visible vanish).
          if (p.alt > 1450) {
            p.state = 'orbit_wait';
            p.timer = 11.0;
            p.ship.visible = false;
          }
        } else if (p.state === 'orbit_wait') {
          p.timer -= dt;
          if (p.timer <= 0) {
            // Re-entry begins far above the top of the camera frustum and glides down through the sky.
            p.ship.visible = true;
            p.state = 'belly_flop';
            p.alt = 1400;
            p.vel = -92;
            p.downrange = p.pitchDir * 155;
            p.pitch = p.pitchDir * 0.86;
            p.legDeploy = 0.0;
            p.burnRamp = 0;
          }
        } else if (p.state === 'belly_flop') {
          warningFast = p.alt < 600;
          // Atmospheric drag: terminal velocity eases from ~-92 m/s high up to ~-50 m/s near the flip.
          const termVel = -(50 + THREE.MathUtils.clamp((p.alt - 210) / 1190, 0, 1) * 40);
          p.vel = THREE.MathUtils.lerp(p.vel, termVel, Math.min(1, dt * 1.2));
          p.alt += p.vel * dt;
          const glideFrac = THREE.MathUtils.clamp((p.alt - 210) / 1190, 0, 1);
          const targetDown = p.pitchDir * (24 + glideFrac * 131);
          p.downrange = THREE.MathUtils.lerp(p.downrange, targetDown, Math.min(1, dt * 1.6));
          p.trailAccum += dt;
          if (p.trailAccum > 0.18) {
            p.trailAccum = 0;
            const wx = p.basePos.x + p.downrange;
            const wy = p.basePos.y + p.alt;
            if (p.alt > 210 && p.alt < 1150) {
              // Thin aerodynamic entry condensation wisps peeling off the flaps.
              spawnAscentContrail(wx, wy + 8, p.basePos.z, 0.32, true);
            }
            spawnCryoWaterfall({ x: wx, y: wy, z: p.basePos.z }, 16, false);
          }
          if (p.alt <= 210) {
            p.state = 'landing_burn';
            p.burnRamp = 0;
            if (onLaunchAudio) onLaunchAudio('landing');
          }
        } else if (p.state === 'landing_burn') {
          warningFast = true;
          p.burnRamp = Math.min(1, (p.burnRamp ?? 1) + dt / 1.2);
          const ignite = p.burnRamp * p.burnRamp * (3 - 2 * p.burnRamp);
          const flipT = THREE.MathUtils.clamp((p.alt - 42) / 145, 0, 1);
          p.pitch = THREE.MathUtils.lerp(p.pitch, p.pitchDir * flipT * flipT * 0.72, Math.min(1, dt * 3.8));
          p.downrange = THREE.MathUtils.lerp(p.downrange, 0, Math.min(1, dt * 2.2));

          const targetVel = -Math.max(3.2, Math.sqrt(Math.max(1, p.alt)) * 3.3);
          p.vel = THREE.MathUtils.lerp(p.vel, targetVel, Math.min(1, dt * 2.6 * (0.35 + 0.65 * ignite)));
          p.alt += p.vel * dt;

          plumePower = ignite * THREE.MathUtils.clamp(0.45 + (p.alt > 18 ? 0.55 : (p.alt / 18) * 0.55), 0.25, 1.05);
          p.legDeploy = THREE.MathUtils.clamp(1.0 - (p.alt - 14) / 41, 0, 1);

          p.trailAccum += dt;
          if (p.trailAccum > 0.095) {
            p.trailAccum = 0;
            spawnAscentContrail(
              p.basePos.x + p.downrange - Math.sin(p.pitch) * 10,
              p.basePos.y + p.alt - 6,
              p.basePos.z,
              plumePower * 0.9,
              true
            );
          }

          if (p.alt < 125) {
            p.dustAccum += dt;
            const gStr = Math.max(0.32, 1.15 - p.alt / 125);
            if (p.dustAccum > 0.065) {
              p.dustAccum = 0;
              spawnPyroclasticDust(p.basePos, gStr, p.downrange);
              if (p.alt < 65) {
                spawnBoosterSteam(p.basePos, gStr * 0.85, p.downrange);
                if (Math.random() < 0.65) spawnPadDebris(p.basePos, gStr * 0.85, p.downrange);
              }
            }
          }

          if (p.alt <= 0) {
            p.alt = 0; p.vel = 0; p.pitch = 0; p.downrange = 0; p.legDeploy = 1.0;
            p.state = 'idle';
            p.timer = 26.0 + Math.random() * 10.0;
            for (let s = 0; s < 10; s++) spawnPyroclasticDust(p.basePos, 0.72, 0);
            for (let s = 0; s < 6; s++) spawnCryoWaterfall(p.basePos, 4 + s * 4, true);
          }
        }

        if (p.ship.visible) {
          const sx = shudder > 0 ? (Math.random() - 0.5) * shudder : 0;
          const sz = shudder > 0 ? (Math.random() - 0.5) * shudder : 0;
          p.ship.position.set(p.basePos.x + p.downrange + sx, p.basePos.y + p.alt, p.basePos.z + sz);
          p.ship.rotation.set(0, p.baseRotY, -p.pitch);

          const lg = p.ship.userData.legGroup;
          if (lg) {
            const d = p.legDeploy;
            lg.scale.set(0.68 + d * 0.32, 0.35 + d * 0.65, 0.68 + d * 0.32);
            lg.position.y = 2.4 + (1.0 - d) * 2.2;
          }
        }

        p.plume.setPower(t, p.ship.visible ? plumePower : 0);

        // Tight, fiery molten-amber Raptor 3 core illumination inside the dust/steam cloud cavity!
        const engWorldX = p.basePos.x + p.downrange;
        const engWorldY = p.basePos.y + Math.min(p.alt, 140) + 2.5;
        const engWorldZ = p.basePos.z;
        const livePwr = p.ship.visible ? plumePower : 0;
        const altBlend = THREE.MathUtils.clamp(p.alt / 85.0, 0, 1);
        clouds.setEngineLight(
          idx,
          engWorldX, engWorldY, engWorldZ,
          livePwr * 1.15,
          28.0 + (1.0 - altBlend) * 14.0, // Tight 28-42m fiery core! Outer 80m dust walls stay sculpted & shadowed!
          1.32 - altBlend * 0.35,
          0.42 + altBlend * 0.20,
          0.09 + altBlend * 0.58
        );

        const groundProx = p.ship.visible ? Math.max(0, 1.0 - p.alt / 95.0) * plumePower : 0;
        p.blastDisc.mat.uniforms.uTime.value = t;
        p.blastDisc.mat.uniforms.uIntensity.value = groundProx;
        p.blastDisc.curtainMat.uniforms.uTime.value = t;
        p.blastDisc.curtainMat.uniforms.uIntensity.value = groundProx * 0.72;
        p.blastDisc.mesh.visible = groundProx > 0.02;
        if (p.blastDisc.mesh.visible) {
          p.blastDisc.mesh.position.x = p.basePos.x + p.downrange * 0.45;
          p.blastDisc.mesh.scale.setScalar(0.68 + (1.0 - groundProx * 0.25) * 0.68);
        }

        p.padLight.intensity = livePwr * Math.max(0.15, 1.0 - p.alt / 360) * 780;
        p.padLight.position.set(p.basePos.x + p.downrange * 0.5, p.basePos.y + Math.min(p.alt, 110) + 14, p.basePos.z);

        const blink = warningFast ? (Math.sin(t * 14.0) > 0 ? '#ff4d2e' : '#ffbf54') : '#7a5228';
        p.warnMat.color.set(blink);
      }

      clouds.step(dt, t, cameraPos);
      ejecta.step(dt);
    }
  };
}
