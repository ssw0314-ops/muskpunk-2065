import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../terrain.js';
import { OPTIMUS_GLB_GZIP_B64 } from './optimus_glb_data.js';
import { CYBER_ROVER_GLB_GZIP_B64 } from './cyber_rover_glb_data.js';

/**
 * Decodes a gzipped Base64 Blender 5.0 GLB once, softly lifts baked curvature AO
 * from COLOR_1 into the standard Three.js `color` vertex attribute (without crushing shadows),
 * and caches the parsed scene for zero-overhead cloning across all colony instances!
 */
async function decodeBlenderGlb(b64, softAoMin = 0.58) {
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buf, '', resolve, reject);
  });
  gltf.scene.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geo = child.geometry;
    const aoAttr = geo.attributes.color_1 || geo.attributes._color_1;
    if (aoAttr) {
      const n = aoAttr.count;
      const out = new Float32Array(n * 3);
      const isByte = aoAttr.array instanceof Uint8Array || aoAttr.array instanceof Uint16Array;
      const normDiv = aoAttr.array instanceof Uint16Array ? 65535 : (isByte ? 255 : 1);
      for (let i = 0; i < n; i++) {
        const raw = aoAttr.getX(i) / (aoAttr.normalized ? 1 : normDiv);
        const ao = softAoMin + (1.0 - softAoMin) * THREE.MathUtils.clamp(raw, 0, 1);
        out[i * 3] = ao;
        out[i * 3 + 1] = ao;
        out[i * 3 + 2] = ao;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
    }
  });
  return gltf.scene;
}

let _optimusGlbPromise = null;
function getOptimusGlbParts() {
  if (!_optimusGlbPromise) {
    _optimusGlbPromise = decodeBlenderGlb(OPTIMUS_GLB_GZIP_B64, 0.62).then((scene) => {
      const parts = {};
      scene.traverse((ch) => {
        if (ch.isMesh) parts[ch.name] = ch;
      });
      return parts;
    });
  }
  return _optimusGlbPromise;
}

let _roverGlbPromise = null;
function getCyberRoverGlbTemplate() {
  if (!_roverGlbPromise) {
    _roverGlbPromise = decodeBlenderGlb(CYBER_ROVER_GLB_GZIP_B64, 0.60);
  }
  return _roverGlbPromise;
}

/**
 * Builds an AAA Blender 5.0 Catmull-Clark Subsurf 1.76m Tesla Optimus Gen-3 Mars-Spec Humanoid:
 *  - 12,736-tri sculpted multi-part pearl-white clearcoat anatomical armor + baked curvature AO
 *  - Streamlined obsidian wrap-around visor dome, articulated 5-finger hands & dual-sole Mars boots
 *  - Exact bone-pivot hierarchy (`pelvis`, `torsoPivot`, `headPivot`, `arms[0..1]`, `legs[0..1]`) so all
 *    refueling, inspecting, farming & walking animations drive the sculpted Blender meshes seamlessly!
 */
export function buildOptimusUnit(textures) {
  const bot = new THREE.Group();

  const whiteShell = new THREE.MeshPhysicalMaterial({
    color: '#f2ede5',
    vertexColors: true,
    map: textures.roadsterColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughness: 0.22,
    metalness: 0.26,
    clearcoat: 0.86,
    clearcoatRoughness: 0.14
  });
  const dustyShell = new THREE.MeshPhysicalMaterial({
    color: '#dcd2c6',
    vertexColors: true,
    map: textures.roadsterColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.34,
    metalness: 0.30,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28
  });
  const darkJoint = new THREE.MeshStandardMaterial({
    color: '#222730',
    vertexColors: true,
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.38,
    metalness: 0.82
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: '#060a12',
    roughness: 0.04,
    metalness: 0.24,
    clearcoat: 1.0,
    reflectivity: 0.96
  });
  const statusLed = new THREE.MeshBasicMaterial({ color: '#5eead4' });

  // Articulated Bone-Pivot Rig matching exact Blender local part origins!
  const pelvisAnchor = new THREE.Group();
  pelvisAnchor.position.set(0, 0.90, 0);
  bot.add(pelvisAnchor);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.99, 0);
  bot.add(torsoPivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.505, 0);
  torsoPivot.add(headPivot);

  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.238, 0.445, 0);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.295, 0);
    sh.add(elbow);
    torsoPivot.add(sh);
    arms.push({ sh, elbow, side });
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.108, 0.86, 0);
    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);
    bot.add(hip);
    legs.push({ hip, knee, side });
  }

  // Mount cloned Blender 5.0 Optimus Gen-3 sculpted Subsurf meshes onto each pivot!
  getOptimusGlbParts()
    .then((parts) => {
      const mount = (name, parent, mat, mirrorX = 1, cast = true) => {
        const src = parts[name];
        if (!src) return;
        const m = new THREE.Mesh(src.geometry, mat);
        m.castShadow = cast;
        m.receiveShadow = true;
        if (mirrorX !== 1) m.scale.x = mirrorX;
        parent.add(m);
      };

      mount('OptPelvisDark', pelvisAnchor, darkJoint);
      mount('OptPelvisWhite', pelvisAnchor, whiteShell);

      mount('OptTorsoDark', torsoPivot, darkJoint);
      mount('OptTorsoWhite', torsoPivot, whiteShell);
      mount('OptTorsoCyan', torsoPivot, statusLed, 1, false);

      mount('OptHeadWhite', headPivot, whiteShell);
      mount('OptHeadVisor', headPivot, visorMat, 1, false);

      for (const a of arms) {
        mount('OptUpperArmDark', a.sh, darkJoint);
        mount('OptUpperArmWhite', a.sh, whiteShell);
        // Mirror forearm horizontally on opposite side so both thumbs orient inward anatomically!
        mount('OptForearmDark', a.elbow, darkJoint, -a.side);
        mount('OptForearmWhite', a.elbow, whiteShell, -a.side);
      }

      for (const lg of legs) {
        mount('OptThighDark', lg.hip, darkJoint);
        mount('OptThighWhite', lg.hip, whiteShell);
        mount('OptShinDark', lg.knee, darkJoint);
        mount('OptShinDust', lg.knee, dustyShell);
      }
    })
    .catch((err) => console.error('Failed to mount Blender Optimus Gen-3 GLB:', err));

  const shadowDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.98),
    new THREE.MeshBasicMaterial({ map: textures.contactShadow, transparent: true, opacity: 0.65, depthWrite: false })
  );
  shadowDecal.rotation.x = -Math.PI / 2;
  shadowDecal.position.y = 0.02;
  bot.add(shadowDecal);

  return { bot, torsoPivot, headPivot, arms, legs };
}

/**
 * Builds an AAA Blender 5.0 Hard-Surface 6×6 Heavy Pressurized Mars Cyber-Rover (7,236 tris!):
 *  - Beveled 30X cold-rolled stainless exoskeleton cab, recessed airlock crew doors & armored wheel arches
 *  - Panoramic dark glass cockpit + cyan telemetry dash, Starlink-Mars phased-array dish & expedition rack
 *  - Twin strapped cryo LOX/CH4 tanks + valve manifold + roll-cage flatbed (+ optional glacier ice haul!)
 *  - 6 spinning deep-lugged Martian titanium-mesh wheels aligned cleanly at X = ±1.48, Y = 0.66, Z = ±2.16/0!
 */
export function buildMarsCyberRover(textures, cargoMode = 'isru') {
  const rover = new THREE.Group();

  const stainless = new THREE.MeshStandardMaterial({
    color: '#c8d0da',
    vertexColors: true,
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(0.90, 0.90),
    roughnessMap: textures.steelRough,
    roughness: 0.38,
    metalness: 0.84,
    envMapIntensity: 0.78
  });
  const darkArmor = new THREE.MeshStandardMaterial({
    color: '#252a32',
    vertexColors: true,
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.78
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: '#a8b2be',
    vertexColors: true,
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughness: 0.28,
    metalness: 0.92
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0b1420',
    roughness: 0.05,
    metalness: 0.20,
    clearcoat: 1.0,
    reflectivity: 0.96,
    transparent: true,
    opacity: 0.78
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    color: '#de9c30',
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.34
  });
  const meshTireMat = new THREE.MeshStandardMaterial({
    color: '#463932',
    map: textures.deckColor,
    normalMap: textures.deckNormal,
    roughness: 0.86,
    metalness: 0.48
  });
  const treadLugMat = new THREE.MeshStandardMaterial({
    color: '#2c2420',
    roughness: 0.88,
    metalness: 0.35
  });
  const lightBarMat = new THREE.MeshBasicMaterial({ color: '#f2f9ff' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff382e' });
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ffb03a' });
  const cyanMat = new THREE.MeshBasicMaterial({ color: '#45e6d6' });

  // 1. Mount Cached Blender 5.0 Hard-Surface Cyber-Rover 6x6 Chassis, Cab, Starlink & Cargo Assembly!
  const hullAnchor = new THREE.Group();
  rover.add(hullAnchor);
  getCyberRoverGlbTemplate()
    .then((tpl) => {
      const clone = tpl.clone(true);
      clone.traverse((child) => {
        if (!child.isMesh) return;
        const n = child.name || '';
        if (n.includes('Stainless')) {
          child.material = stainless;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('DarkArmor')) {
          child.material = darkArmor;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('Glass')) {
          child.material = glassMat;
        } else if (n.includes('Alloy')) {
          child.material = alloyMat;
          child.castShadow = true;
        } else if (n.includes('Hazard')) {
          child.material = hazardMat;
          child.castShadow = true;
        } else if (n.includes('HeadLED')) {
          child.material = lightBarMat;
        } else if (n.includes('TailLED')) {
          child.material = tailMat;
        } else if (n.includes('Cyan')) {
          child.material = cyanMat;
        }
      });
      hullAnchor.add(clone);
    })
    .catch((err) => console.error('Failed to mount Blender Cyber-Rover GLB:', err));

  // Roof amber hazard strobe beacon
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.22, 10), beaconMat);
  beacon.position.set(0.66, 3.36, 0.82);
  rover.add(beacon);

  // Quarry Ice-Hauler Variant: Glowing crystalline frozen H2O glacier blocks stacked cleanly in left cargo bay!
  if (cargoMode === 'ice') {
    const iceCrateMat = new THREE.MeshPhysicalMaterial({
      color: '#88d8f8',
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.9,
      emissive: '#1e5a78',
      emissiveIntensity: 0.25
    });
    [[-0.56, 2.22, -1.48], [-0.56, 2.18, -2.55]].forEach(([ix, iy, iz]) => {
      const iceBlk = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.78, 0.92), iceCrateMat);
      iceBlk.position.set(ix, iy, iz);
      iceBlk.castShadow = true;
      rover.add(iceBlk);
    });
  }

  // 2. 6 Spinning Deep-Lugged Non-Pneumatic Martian Titanium-Mesh Wheels aligned to Blender wheel arches!
  const wheelZ = [2.16, 0.0, -2.16];
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const wz of wheelZ) {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.56, 22), meshTireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wg.add(tire);
      // 12 sculpted Martian chevron grouser traction cleats around circumference
      for (let lg = 0; lg < 12; lg++) {
        const a = (lg / 12) * Math.PI * 2;
        const lug = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.055, 0.11), treadLugMat);
        lug.position.set(0, Math.sin(a) * 0.625, Math.cos(a) * 0.625);
        lug.rotation.x = -a;
        wg.add(lug);
      }
      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.048, 8, 18), alloyMat);
      rimRing.rotation.y = Math.PI / 2;
      rimRing.position.x = side * 0.27;
      wg.add(rimRing);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.58, 12), darkArmor);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);
      const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.62, 8), stainless);
      centerCap.rotation.z = Math.PI / 2;
      wg.add(centerCap);

      wg.position.set(side * 1.48, 0.66, wz);
      rover.add(wg);
      wheels.push(wg);
    }
  }

  const shadowDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 7.8),
    new THREE.MeshBasicMaterial({ map: textures.contactShadow, transparent: true, opacity: 0.74, depthWrite: false })
  );
  shadowDecal.rotation.x = -Math.PI / 2;
  shadowDecal.position.y = 0.04;
  rover.add(shadowDecal);

  return { rover, wheels, beacon };
}

export function createOptimusWorkforce(textures) {
  const root = new THREE.Group();
  const units = [];

  const refuelBot = buildOptimusUnit(textures);
  const rY = getTerrainHeight(14.8, 3.6) + 0.32;
  refuelBot.bot.position.set(14.8, rY, 3.6);
  refuelBot.bot.rotation.y = -2.3;
  root.add(refuelBot.bot);
  units.push({ ...refuelBot, role: 'refuel', phase: 0 });

  const inspectBot = buildOptimusUnit(textures);
  inspectBot.bot.position.set(8.8, getTerrainHeight(8.8, 5.2) + 0.32, 5.2);
  inspectBot.bot.rotation.y = 1.4;
  root.add(inspectBot.bot);
  units.push({ ...inspectBot, role: 'inspect', phase: 1.5 });

  const patrol1 = buildOptimusUnit(textures);
  root.add(patrol1.bot);
  units.push({
    ...patrol1,
    role: 'patrol',
    pA: new THREE.Vector3(-42, 0, -20),
    pB: new THREE.Vector3(-4, 0, -10),
    speed: 0.065,
    phase: 0.2
  });

  const patrol2 = buildOptimusUnit(textures);
  root.add(patrol2.bot);
  units.push({
    ...patrol2,
    role: 'patrol',
    pA: new THREE.Vector3(28, 0, -8),
    pB: new THREE.Vector3(6, 0, -14),
    speed: 0.055,
    phase: 0.75
  });

  const monBot1 = buildOptimusUnit(textures);
  monBot1.bot.position.set(-34.5, getTerrainHeight(-34.5, -11.5), -11.5);
  monBot1.bot.rotation.y = -1.1;
  root.add(monBot1.bot);
  units.push({ ...monBot1, role: 'inspect', phase: 2.8 });

  const monBot2 = buildOptimusUnit(textures);
  monBot2.bot.position.set(-42.5, getTerrainHeight(-42.5, -2.5), -2.5);
  monBot2.bot.rotation.y = -2.3;
  root.add(monBot2.bot);
  units.push({ ...monBot2, role: 'refuel', phase: 4.1 });

  // Outpost Tesla Optimus Mechanic working right outside the STARSHIP SALOON Repair Bay!
  const saloonBot = buildOptimusUnit(textures);
  const sbX = -246.5, sbZ = -371.5;
  saloonBot.bot.position.set(sbX, getTerrainHeight(sbX, sbZ) + 0.28, sbZ);
  saloonBot.bot.rotation.y = 0.55;
  root.add(saloonBot.bot);
  units.push({ ...saloonBot, role: 'refuel', phase: 2.2 });

  // =========================================================================
  // 6-WHEELED PRESSURIZED MARS HEAVY CYBER-ROVERS ACROSS ALL DISTRICTS!
  // =========================================================================
  // 1. Hero Parked Cyber-Rover on Founder's Ridge Cliffside Road (clear sunlit 3/4 profile!)
  const parkedRover = buildMarsCyberRover(textures, 'isru');
  const rv1X = -16, rv1Z = -24;
  parkedRover.rover.position.set(rv1X, getTerrainHeight(rv1X, rv1Z), rv1Z);
  parkedRover.rover.rotation.y = 1.95;
  root.add(parkedRover.rover);

  // 2. Active Moving Cargo Cyber-Rover cruising along the lower Arcadia Valley Colony Road!
  const patrolRover = buildMarsCyberRover(textures, 'isru');
  root.add(patrolRover.rover);
  const roverA = new THREE.Vector3(-94, 0, -118);
  const roverB = new THREE.Vector3(82, 0, -110);

  // 3. Megaport Pad Support Cyber-Rover parked near Front Showcase Starships!
  const portRover = buildMarsCyberRover(textures, 'isru');
  const prX = 166, prZ = -504;
  portRover.rover.position.set(prX, getTerrainHeight(prX, prZ), prZ);
  portRover.rover.rotation.y = -0.85;
  root.add(portRover.rover);

  // 4. Ice-Mining Quarry Heavy Ice-Hauler Cyber-Rover loaded with glowing H2O glacier blocks!
  const quarryRover = buildMarsCyberRover(textures, 'ice');
  const qrX = 330, qrZ = -234;
  quarryRover.rover.position.set(qrX, getTerrainHeight(qrX, qrZ), qrZ);
  quarryRover.rover.rotation.y = -1.1;
  root.add(quarryRover.rover);

  return {
    group: root,
    update(dt, t) {
      for (const u of units) {
        if (u.role === 'refuel') {
          u.torsoPivot.rotation.x = 0.14 + Math.sin(t * 1.4 + u.phase) * 0.05;
          u.headPivot.rotation.y = Math.sin(t * 0.9 + u.phase) * 0.28;
          u.arms[0].sh.rotation.x = -0.85 + Math.sin(t * 2.1 + u.phase) * 0.15;
          u.arms[0].elbow.rotation.x = -0.55;
          u.arms[1].sh.rotation.x = -0.65 + Math.cos(t * 1.7 + u.phase) * 0.12;
          u.arms[1].elbow.rotation.x = -0.75;
        } else if (u.role === 'inspect') {
          u.headPivot.rotation.y = Math.sin(t * 0.7 + u.phase) * 0.55;
          u.headPivot.rotation.x = -0.08 + Math.sin(t * 1.1 + u.phase) * 0.12;
          u.arms[0].sh.rotation.x = -0.4 + Math.sin(t * 1.2 + u.phase) * 0.1;
          u.arms[0].elbow.rotation.x = -0.9;
          u.arms[1].sh.rotation.x = 0.08;
        } else if (u.role === 'patrol') {
          const cycle = (t * u.speed + u.phase) % 2;
          const forward = cycle <= 1;
          const frac = forward ? cycle : 2 - cycle;
          const pos = new THREE.Vector3().lerpVectors(u.pA, u.pB, frac);
          pos.y = getTerrainHeight(pos.x, pos.z);
          u.bot.position.copy(pos);

          const dir = new THREE.Vector3().subVectors(forward ? u.pB : u.pA, forward ? u.pA : u.pB);
          u.bot.rotation.y = Math.atan2(dir.x, dir.z);

          const stride = t * 4.4 + u.phase * 10;
          const s = Math.sin(stride);
          u.legs[0].hip.rotation.x = s * 0.42;
          u.legs[0].knee.rotation.x = Math.max(0, -s) * 0.55;
          u.legs[1].hip.rotation.x = -s * 0.42;
          u.legs[1].knee.rotation.x = Math.max(0, s) * 0.55;
          u.arms[0].sh.rotation.x = -s * 0.34;
          u.arms[0].elbow.rotation.x = -0.25;
          u.arms[1].sh.rotation.x = s * 0.34;
          u.arms[1].elbow.rotation.x = -0.25;
          u.bot.position.y += Math.abs(Math.cos(stride)) * 0.04;
        }
      }

      const rCycle = (t * 0.032) % 2;
      const rFwd = rCycle <= 1;
      const rFrac = rFwd ? rCycle : 2 - rCycle;
      const rPos = new THREE.Vector3().lerpVectors(roverA, roverB, rFrac);
      rPos.y = getTerrainHeight(rPos.x, rPos.z);
      patrolRover.rover.position.copy(rPos);
      const rDir = new THREE.Vector3().subVectors(rFwd ? roverB : roverA, rFwd ? roverA : roverB);
      patrolRover.rover.rotation.y = Math.atan2(rDir.x, rDir.z);
      patrolRover.wheels.forEach((w) => { w.rotation.x += dt * 4.5; });
    }
  };
}
