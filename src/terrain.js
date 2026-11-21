import * as THREE from 'three';
import { enhanceMarsTerrainMaterial } from './vfx/cinematic_shaders.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2(ix, iz) {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x, z, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * (noise2(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.48;
  }
  return v;
}

/**
 * Expanded GTA-Style Open-World Arcadia Planitia Topography (1.6km × 1.6km playable basin!):
 *  1. Founder's Ridge Plateau: z in [-28..+65], x in [-125..+105], y = 18.0m
 *  2. West Promontory for 100m Blender-Sculpted Elon Musk Colossus at (-74, -56), y = 16.0m
 *  3. Dual Drivable Highway Ramps: East Ramp (x≈74) & West Ramp (x≈-118) descending smoothly to Colony Basin
 *  4. Central Arcadia Colony Bio-Dome & Regolith Basin: y = 0m
 *  5. NEW: Red Canyon Stunt Gorge (Scene 05/08): x in [-430..-190], z in [-240..+140], carved -18m canyon floor + dramatic terraced red walls!
 *  6. NEW: Rust-Hulk Starship Saloon Outpost Flat (Scene 04): (-255, -385), y = 2.0m
 *  7. NEW: Arcadia Subsurface Ice-Mining Quarry Crater (Scene 05): (+365, -210), terraced -14m pit + rim road!
 *  8. Open Right-Horizon Arcadia Interplanetary Megaport: x in [+110..+520], z in [-490..-760] + Viewing Spur at (+195, -405)
 */
export function getTerrainHeight(x, z) {
  let h = fbm(x * 0.0042, z * 0.0042, 4) * 3.8 + fbm(x * 0.020, z * 0.020, 2) * 0.45;

  // 1. Founder's Ridge Plateau
  const ridgeZ = smoothstep(-64, -22, z);
  const ridgeX = 1.0 - smoothstep(82, 165, Math.abs(x + 6));
  const ridgeMask = ridgeZ * ridgeX;
  h = h * (1 - ridgeMask * 0.88) + 18.0 * ridgeMask;

  // Sculpted West Promontory holding the 212m Elon Musk Colossus Citadel at (-74, -56)
  const dCol = Math.hypot(x + 74, z + 56);
  const colProm = 1.0 - smoothstep(56, 76, dCol);
  h = THREE.MathUtils.lerp(h, 16.0, colProm);

  // Clean flat plaza connecting Skybridge, Roadster Apron, and Monument Approach
  const plazaMask = smoothstep(-32, -16, z) * (1.0 - smoothstep(44, 66, z))
    * (1.0 - smoothstep(74, 98, Math.abs(x - 2)));
  h = THREE.MathUtils.lerp(h, 18.0, plazaMask * 0.98);

  // Connecting spur bridge-ridge from Plaza (-30,-16) over to Colossus Promontory (-74,-56)
  const tSpur = THREE.MathUtils.clamp(((x + 30) * -44 + (z + 16) * -40) / (44 * 44 + 40 * 40), 0, 1);
  const sx = -30 - 44 * tSpur;
  const sz = -16 - 40 * tSpur;
  const dSpur = Math.hypot(x - sx, z - sz);
  const spurMask = 1.0 - smoothstep(15, 28, dSpur);
  h = THREE.MathUtils.lerp(h, THREE.MathUtils.lerp(18.0, 16.0, tSpur), spurMask * 0.94);

  // Smooth Drivable East Highway Ramp (x ≈ 74, z = -18 .. -96) down into Colony Basin!
  const rampX = 1.0 - smoothstep(10, 24, Math.abs(x - 74));
  const rampZ = smoothstep(-108, -90, z) * (1.0 - smoothstep(-14, 6, z));
  if (rampX * rampZ > 0.01) {
    const tRamp = smoothstep(-96, -18, z);
    h = THREE.MathUtils.lerp(h, 18.0 * tRamp, rampX * rampZ);
  }

  // Smooth Drivable West Highway Ramp (x ≈ -148, z = 14 .. -90) clearing the 212m Colossus Citadel toward Red Canyon!
  const wRampX = 1.0 - smoothstep(10, 24, Math.abs(x + 148));
  const wRampZ = smoothstep(-105, -88, z) * (1.0 - smoothstep(12, 32, z));
  if (wRampX * wRampZ > 0.01) {
    const tW = smoothstep(-90, 14, z);
    h = THREE.MathUtils.lerp(h, 18.0 * tW, wRampX * wRampZ);
  }

  // 2. Flatten Central Colony Basin & Expanded East-Horizon Megaport Plain (accommodates 150m-spaced Starship pads!)
  const basinMask = smoothstep(-62, -98, z) * (1.0 - smoothstep(-940, -1120, z))
    * (1.0 - smoothstep(660, 880, Math.abs(x - 190)));
  h = THREE.MathUtils.lerp(h, 0.0, basinMask * 0.96);

  // 3. NEW: RED CANYON STUNT GORGE (West Sector, x ≈ -315 + sin(z*0.011)*48, z in [-250..+150]!)
  const canyonCenterX = -315 + Math.sin(z * 0.011) * 48;
  const distCanyon = Math.abs(x - canyonCenterX);
  const canyonLenMask = smoothstep(-290, -210, z) * (1.0 - smoothstep(115, 195, z));
  if (canyonLenMask > 0.005) {
    // Raised dramatic canyon rim walls flanking a deep drivable flat canyon floor!
    const rimWall = (1.0 - smoothstep(32, 95, Math.abs(distCanyon - 72))) * canyonLenMask;
    const floorCut = (1.0 - smoothstep(26, 56, distCanyon)) * canyonLenMask;
    h += rimWall * 24.0;
    h = THREE.MathUtils.lerp(h, -15.5, floorCut * 0.94);
  }

  // 4. NEW: STARSHIP SALOON & WORKSHOP OUTPOST FLAT at (-255, -385)
  const dSaloon = Math.hypot(x + 255, z + 385);
  const saloonFlat = 1.0 - smoothstep(38, 72, dSaloon);
  h = THREE.MathUtils.lerp(h, 1.5, saloonFlat * 0.96);

  // 5. NEW: ARCADIA ICE-MINING QUARRY CRATER at (+365, -210)
  const dQuarry = Math.hypot(x - 365, z + 210);
  if (dQuarry < 130) {
    const rimUp = Math.exp(-Math.pow((dQuarry - 78) / 22, 2)) * 10.5;
    const pitCut = 1.0 - smoothstep(36, 68, dQuarry);
    // Terraced quarry bench steps
    const stepPit = pitCut > 0.55 ? -13.5 : -6.5 * smoothstep(0.1, 0.55, pitCut);
    // Keep north entrance ramp drivable into quarry!
    const qRamp = (z < -210 && Math.abs(x - 365) < 16) ? smoothstep(28, 72, dQuarry) : 0;
    h = THREE.MathUtils.lerp(h + rimUp, stepPit, pitCut * 0.92 * (1 - qRamp * 0.55));
  }

  // 6. Megaport Overlook Spur Ridge at (195, -405)
  const dView = Math.hypot(x - 195, z + 405);
  const viewMask = 1.0 - smoothstep(18, 46, dView);
  h = THREE.MathUtils.lerp(h, 14.0, viewMask);

  // 7. Earthen Blast-Deflection Berms framing Expanded Arcadia Interplanetary Megaport (x in [45..855], z ≈ -492 & -628)
  const inPortX = smoothstep(35, 78, x) * (1.0 - smoothstep(825, 885, x));
  // Leave clean drivable gateway gap at x ≈ 215 through the front berm so Roadster can drive right onto the pads!
  const bermGate = 1.0 - (1.0 - smoothstep(14, 28, Math.abs(x - 215)));
  const bermFront = Math.exp(-Math.pow((z + 492) / 11, 2)) * inPortX * bermGate;
  const bermMid = Math.exp(-Math.pow((z + 628) / 11, 2)) * inPortX * bermGate;
  h += (bermFront * 7.5 + bermMid * 7.0);

  // 8. Majestic Distant Volcanic Mesas encircling the far open-world horizon
  const dist = Math.hypot(x - 95, z + 390);
  const rimMask = smoothstep(1060, 1660, dist);
  if (rimMask > 0.001) {
    const mesaNoise = fbm(x * 0.0016 + 3.1, z * 0.0016 - 1.7, 4);
    const terraced = Math.floor((mesaNoise + 1.2) * 4.5) / 4.5;
    const mesaH = Math.max(0, (mesaNoise * 0.65 + terraced * 0.35 + 0.55)) * 210;
    h += rimMask * mesaH;
  }

  return h;
}

/**
 * Analytical terrain normal via finite differences so the Roadster hugs Martian slopes & ramps smoothly!
 */
export function getTerrainNormal(x, z, out = new THREE.Vector3()) {
  const e = 1.2;
  const hL = getTerrainHeight(x - e, z);
  const hR = getTerrainHeight(x + e, z);
  const hD = getTerrainHeight(x, z - e);
  const hU = getTerrainHeight(x, z + e);
  return out.set(hL - hR, 2 * e, hD - hU).normalize();
}

export function createMarsTerrain(textures) {
  const size = 4200;
  const segs = 280;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  geo.translate(40, 0, -340);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cOchre = new THREE.Color('#bc683e');
  const cDarkRock = new THREE.Color('#663a28');
  const cDustLight = new THREE.Color('#da8c5b');
  const cSintered = new THREE.Color('#6f5e53');
  const cCanyonRed = new THREE.Color('#8e3f25');
  const cIceQuarry = new THREE.Color('#8a9aa4');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const hx = getTerrainHeight(x + 4, z);
    const hz = getTerrainHeight(x, z + 4);
    const slope = Math.hypot(hx - y, hz - y) / 4;

    tmp.copy(cOchre);
    const dustVar = fbm(x * 0.008, z * 0.008, 2);
    if (dustVar > 0) tmp.lerp(cDustLight, dustVar * 0.52);
    else tmp.lerp(cDarkRock, -dustVar * 0.40);

    // Rich crimson iron-oxide strata inside Red Canyon walls
    const canyonCenterX = -315 + Math.sin(z * 0.011) * 48;
    if (Math.abs(x - canyonCenterX) < 110 && z > -290 && z < 195) {
      tmp.lerp(cCanyonRed, Math.min(0.65, slope * 0.9 + 0.18));
    }

    // Exposed frosted subsurface permafrost/ice veins at bottom of Ice-Mining Quarry Crater!
    const dQuarry = Math.hypot(x - 365, z + 210);
    if (dQuarry < 55 && y < -8.0) {
      tmp.lerp(cIceQuarry, smoothstep(-8.0, -13.0, y) * 0.62);
    }

    tmp.lerp(cDarkRock, Math.min(0.68, slope * 1.25));

    const onPlaza = z > -28 && z < 46 && Math.abs(x - 4) < 70 && y > 16.5;
    const onPort = z < -498 && z > -750 && x > 95 && x < 475 && y < 3.0;
    const onSaloon = Math.hypot(x + 255, z + 385) < 44;
    if (onPlaza || onPort || onSaloon) {
      tmp.lerp(cSintered, 0.52);
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = enhanceMarsTerrainMaterial(new THREE.MeshStandardMaterial({
    map: textures.marsColor,
    normalMap: textures.marsNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.marsRough,
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.08
  }));

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Martian basalt boulders scattered across cliffs, canyon rims & wild outskirts (keeping roads/pads/plazas clear!)
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rpos = rockGeo.attributes.position;
  for (let i = 0; i < rpos.count; i++) {
    const vx = rpos.getX(i), vy = rpos.getY(i), vz = rpos.getZ(i);
    const sc = 0.74 + hash2(vx * 13 + vy * 7, vz * 17) * 0.48;
    rpos.setXYZ(i, vx * sc, vy * sc * 0.65, vz * sc);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#c8b4a8',
    map: textures.rockColor,
    normalMap: textures.rockNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: textures.rockRough,
    roughness: 0.92,
    metalness: 0.08,
    flatShading: true
  });

  const rockCount = 420;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < 2800 && placed < rockCount; i++) {
    const rx = -580 + hash2(i, 2.7) * 1240;
    const rz = -780 + hash2(i, 8.3) * 1020;
    // Exclusion zones: plazas, domes, saloon, quarry center, canyon floor road, ramps & Megaport pads
    if (rz > -105 && rz < 65 && rx > -135 && rx < 115) continue;
    if (rz < -85 && rz > -360 && rx > -195 && rx < 175) continue;
    if (rz < -475 && rz > -760 && rx > 80 && rx < 495) continue;
    if (Math.hypot(rx - 195, rz + 405) < 46) continue;
    if (Math.hypot(rx + 255, rz + 385) < 58) continue;
    if (Math.hypot(rx - 365, rz + 210) < 76) continue;
    const canyonX = -315 + Math.sin(rz * 0.011) * 48;
    if (Math.abs(rx - canyonX) < 38 && rz > -290 && rz < 195) continue;

    const ry = getTerrainHeight(rx, rz);
    const scale = 0.6 + Math.pow(hash2(i, 5.1), 2.3) * 4.2;
    dummy.position.set(rx, ry + scale * 0.22, rz);
    dummy.rotation.set(hash2(i, 1.1) * 3, hash2(i, 4.4) * 6, hash2(i, 9.8) * 3);
    dummy.scale.set(scale * (0.85 + hash2(i, 6.6) * 0.65), scale * 0.68, scale * (0.85 + hash2(i, 7.2) * 0.55));
    dummy.updateMatrix();
    rocks.setMatrixAt(placed++, dummy.matrix);
  }
  rocks.count = placed;
  rocks.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(rocks);
  return group;
}
