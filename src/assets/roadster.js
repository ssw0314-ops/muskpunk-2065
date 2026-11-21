import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../terrain.js';
import { ROADSTER_GLB_GZIP_B64 } from './roadster_glb_data.js';
import { createVolumetricCloudSystem } from '../vfx/volumetric_clouds.js';
import { buildHoodedMarsLamp, buildIndustrialCryoSilo } from './industrial_props.js';

/**
 * Decodes the gzipped Base64 Blender 5.0 Roadster Rocket-M GLB ONCE and caches the parsed scene
 * for instant zero-overhead cloning across the Player Roadster, Apron, Sky-Pad & Sky-Traffic!
 */
let _roadsterGlbPromise = null;
let _roadsterGlbLoaded = false;
export function isRoadsterLoaded() {
  return _roadsterGlbLoaded;
}
function getRoadsterGlbTemplate() {
  if (!_roadsterGlbPromise) {
    _roadsterGlbPromise = (async () => {
      const binStr = atob(ROADSTER_GLB_GZIP_B64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const ds = new DecompressionStream('gzip');
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      const loader = new GLTFLoader();
      const scene = await new Promise((resolve, reject) => {
        loader.parse(buf, '', (gltf) => resolve(gltf.scene), reject);
      });
      _roadsterGlbLoaded = true;
      return scene;
    })();
  }
  return _roadsterGlbPromise;
}

/**
 * Builds an EXTREME-DETAIL Blender 5.0 Catmull-Clark Subsurf Tesla Roadster Rocket-M:
 *  - 8,720-tri Blender Subsurf wide-body Ano White clearcoat hull w/ carved fender arches & baked AO
 *  - Double-curved panoramic glass canopy revealing interior bucket seats, Tesla Yoke & cyan HUD
 *  - Sculpted carbon 5-tunnel rear Venturi diffuser, swan-neck active aero wing & teardrop mirrors
 *  - Machined-titanium SpaceX rear parabolic cold-gas rocket bell + twin flanking vernier RCS bells
 *  - Wrap-around sculpted curved ruby LED taillight blade (dynamic braking) + front curved DRL blades
 *  - 10-spoke twin-blade concave forged alloy wheels, slotted rotors, ruby calipers & steerable front pivots
 *  - 4 underside + 1 aft pure-white translucent supersonic cold-gas expansion cones (ZERO flames!)
 */
export function buildRoadsterMesh(textures, options = {}) {
  const car = new THREE.Group();
  const isMedevac = options.variant === 'medevac';

  const anoWhite = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    map: textures.roadsterColor,
    normalMap: textures.roadsterNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.roadsterRough,
    roughness: 0.24,
    metalness: 0.26,
    clearcoat: 0.94,
    clearcoatRoughness: 0.12
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#1b2028',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.36,
    metalness: 0.58
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: '#9aa4b0',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughness: 0.30,
    metalness: 0.90
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: '#0c1420',
    roughness: 0.05,
    metalness: 0.16,
    clearcoat: 1.0,
    reflectivity: 0.96,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide
  });
  const cabinLeather = new THREE.MeshStandardMaterial({ color: '#242830', roughness: 0.72, metalness: 0.10 });
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#29201c',
    normalMap: textures.marsNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.90,
    metalness: 0.06
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c4ccd6', roughness: 0.20, metalness: 0.94 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: '#848c96', roughness: 0.38, metalness: 0.88 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#d4281f', roughness: 0.30, metalness: 0.58 });
  const hudMat = new THREE.MeshBasicMaterial({ color: '#38e8d8' });
  const headMat = new THREE.MeshBasicMaterial({ color: '#f2f9ff' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ef2b22' });

  // 1. Mount Cached Blender 5.0 Catmull-Clark Subsurf Roadster Rocket-M Body & Propulsion Shell!
  const shellAnchor = new THREE.Group();
  car.add(shellAnchor);
  getRoadsterGlbTemplate()
    .then((tpl) => {
      const clone = tpl.clone(true);
      clone.traverse((child) => {
        if (!child.isMesh) return;
        const n = (child.name || '').toLowerCase();
        if (n.includes('body')) {
          child.material = anoWhite;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('canopy') || n.includes('glass')) {
          child.material = canopyMat;
        } else if (n.includes('carbon') || n.includes('aero')) {
          child.material = carbonMat;
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (n.includes('titanium') || n.includes('rocket')) {
          child.material = titaniumMat;
          child.castShadow = true;
        } else if (n.includes('tail')) {
          child.material = tailMat;
        } else if (n.includes('head')) {
          child.material = headMat;
        } else if (n.includes('cyan')) {
          child.material = hudMat;
        }
      });
      shellAnchor.add(clone);
    })
    .catch((err) => console.error('Failed to mount Blender Roadster GLB:', err));

  // 2. Visible Detailed Cabin Interior (twin bolstered sport bucket seats, Yoke wheel & glowing cyan HUD!)
  const cabinTub = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.28, 1.56), cabinLeather);
  cabinTub.position.set(0, 0.72, -0.08);
  car.add(cabinTub);

  for (const sx of [-0.36, 0.36]) {
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.12), cabinLeather);
    seatBack.position.set(sx, 0.96, -0.44);
    seatBack.rotation.x = -0.28;
    car.add(seatBack);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.10), cabinLeather);
    headrest.position.set(sx, 1.16, -0.52);
    car.add(headrest);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.18, 0.36), carbonMat);
  dash.position.set(0, 0.88, 0.54);
  car.add(dash);
  const centerHud = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.18), hudMat);
  centerHud.position.set(0, 0.95, 0.34);
  centerHud.rotation.y = Math.PI;
  centerHud.rotation.x = 0.22;
  car.add(centerHud);
  const yokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.04), titaniumMat);
  yokeBar.position.set(0.36, 0.94, 0.32);
  car.add(yokeBar);
  for (const gx of [-0.15, 0.15]) {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.04), cabinLeather);
    grip.position.set(0.36 + gx, 0.99, 0.32);
    car.add(grip);
  }

  // Optional Scene 07 Mars Medevac Rescue Kit (Expedition Roof Rack, Med-Cases, Lightbar & Red Cross Livery!)
  if (isMedevac) {
    const medRed = new THREE.MeshStandardMaterial({ color: '#cf2920', roughness: 0.35, metalness: 0.18 });
    const rescueYellow = new THREE.MeshStandardMaterial({ color: '#e6a825', roughness: 0.42, metalness: 0.25 });
    const medCaseMat = new THREE.MeshStandardMaterial({ color: '#e6e2da', roughness: 0.48, metalness: 0.22 });
    const rackG = new THREE.Group();

    // Slim tubular carbon roof rack frame straddling canopy pillars
    for (const rx of [-0.52, 0.52]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.38), carbonMat);
      rail.position.set(rx, 1.38, -0.28);
      rackG.add(rail);
      for (const rz of [-0.82, 0.24]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), carbonMat);
        foot.position.set(rx, 1.29, rz);
        rackG.add(foot);
      }
    }
    for (const rz of [-0.88, -0.28, 0.34]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.045, 0.05), carbonMat);
      bar.position.set(0, 1.38, rz);
      rackG.add(bar);
    }
    // Strapped White Emergency Cryo-Med Case w/ Red Cross + Yellow Oxygen Kit Box
    const medBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.72), medCaseMat);
    medBox.position.set(-0.18, 1.50, -0.34);
    medBox.castShadow = true;
    rackG.add(medBox);
    const oxyBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.68), rescueYellow);
    oxyBox.position.set(0.30, 1.48, -0.34);
    oxyBox.castShadow = true;
    rackG.add(oxyBox);
    // Roof Cross Emblem on med-case top
    const topC1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.08), medRed);
    topC1.position.set(-0.18, 1.62, -0.34);
    rackG.add(topC1);
    const topC2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.24), medRed);
    topC2.position.set(-0.18, 1.62, -0.34);
    rackG.add(topC2);
    // Front Expedition LED Lightbar + Emergency Red/Amber Roof Strobe + Slim Whip Antenna
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.09), carbonMat);
    lightBar.position.set(0, 1.43, 0.36);
    rackG.add(lightBar);
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.055, 0.04), headMat);
    ledStrip.position.set(0, 1.43, 0.41);
    rackG.add(ledStrip);
    const strobe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.11, 10), new THREE.MeshBasicMaterial({ color: '#ff422e' }));
    strobe.position.set(0.30, 1.62, 0.05);
    rackG.add(strobe);
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 1.25, 6), titaniumMat);
    whip.position.set(-0.48, 2.0, -0.88);
    whip.rotation.x = -0.14;
    rackG.add(whip);
    // Crisp Red Medical Cross + Rescue Yellow Accents on Doors & Hood
    const hoodC1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.13), medRed);
    hoodC1.position.set(0, 0.90, 1.44);
    hoodC1.rotation.x = 0.20;
    rackG.add(hoodC1);
    const hoodC2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.42), medRed);
    hoodC2.position.set(0, 0.90, 1.44);
    hoodC2.rotation.x = 0.20;
    rackG.add(hoodC2);
    for (const sx of [-1.02, 1.02]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 1.68), rescueYellow);
      stripe.position.set(sx, 0.44, 0.02);
      rackG.add(stripe);
      const dC1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.28), medRed);
      dC1.position.set(sx * 1.01, 0.67, 0.04);
      rackG.add(dC1);
      const dC2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.08), medRed);
      dC2.position.set(sx * 1.01, 0.67, 0.04);
      rackG.add(dC2);
    }
    car.add(rackG);
  }

  // =========================================================================
  // 3. REALISTIC HARD-SF SUPERSONIC COLD-GAS EXPANSION PLUMES (CUSTOM GLSL!)
  //    Zero flat triangle edges! True Fresnel volumetric density + oscillating
  //    Mach shock diamonds + 0.61 kPa Mars near-vacuum Prandtl-Meyer mist fan
  //    + twin flanking vernier RCS attitude jets + nozzle throat & diffuser glow!
  // =========================================================================
  function createColdGasShaderMat(isCore, opacityVal, fresnelPow, fadePow) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uPower: { value: 0 },
        uOpacity: { value: opacityVal },
        uFresnelPow: { value: fresnelPow },
        uFadePow: { value: fadePow },
        uIsCore: { value: isCore ? 1.0 : 0.0 },
        uColorCore: { value: new THREE.Color(isCore ? '#f6fbff' : '#d6ecf8') },
        uColorOuter: { value: new THREE.Color(isCore ? '#72d8f8' : '#96c4de') }
      },
      vertexShader: `
        varying float vAxial;
        varying float vAngle;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          vAxial = clamp(1.0 - uv.y, 0.0, 1.0);
          vAngle = uv.x * 6.2831853;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPower;
        uniform float uOpacity;
        uniform float uFresnelPow;
        uniform float uFadePow;
        uniform float uIsCore;
        uniform vec3 uColorCore;
        uniform vec3 uColorOuter;
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
            p = p * 2.08 + vec2(11.4, 23.7);
            a *= 0.48;
          }
          return v;
        }

        void main() {
          if (uPower <= 0.008) discard;
          float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
          float fresnel = pow(max(0.0, ndv), uFresnelPow);
          float throat = smoothstep(0.0, 0.048, vAxial);
          float tailFade = pow(max(0.0, 1.0 - vAxial), uFadePow);

          // High-speed supersonic 3-octave GLSL FBM cryogenic N2/CO2 filament shear!
          vec2 cylP = vec2(sin(vAngle) * 2.4 + cos(vAngle) * 1.6, vAxial * 11.5 - uTime * 28.0);
          float f1 = fbm3(cylP);
          float f2 = fbm3(cylP * 2.2 + vec2(f1 * 1.2, -uTime * 14.0));
          float turb = mix(0.62, 1.28, mix(f1, f2, 0.50));

          // Crisp standing supersonic Mach shock-diamond compression cells near nozzle exit!
          float shockCell = abs(sin(vAxial * 22.0 - uTime * 46.0 + f1 * 0.5));
          float machDiamonds = pow(1.0 - shockCell, 4.5) * exp(-vAxial * 2.65) * uIsCore;
          float machCore = pow(max(0.0, ndv), 2.1) * machDiamonds;

          float coreMix = clamp(exp(-vAxial * 3.4) * 0.88 + machCore * 1.45, 0.0, 1.0);
          vec3 col = mix(uColorOuter, uColorCore, coreMix);
          col *= (1.0 + machCore * 1.65);

          float alpha = throat * tailFade * fresnel * turb * uPower * uOpacity;
          alpha += machCore * uPower * 0.48;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.94));
        }
      `
    });
  }

  function makePlumePair(coreR, coreL, mistR, mistL, axisDir) {
    const grp = new THREE.Group();
    const isAft = axisDir === '-z';
    const isSide = axisDir === '-x' || axisDir === '+x';
    const coreMat = createColdGasShaderMat(
      true,
      isAft ? 0.82 : (isSide ? 0.88 : 0.78),
      isAft ? 0.78 : (isSide ? 1.05 : 1.45),
      isSide ? 1.35 : 1.50
    );
    const mistMat = createColdGasShaderMat(
      false,
      isAft ? 0.40 : (isSide ? 0.44 : 0.38),
      isAft ? 1.25 : (isSide ? 1.55 : 2.05),
      isSide ? 1.05 : 1.15
    );

    const cGeo = new THREE.ConeGeometry(coreR, coreL, 18, 12, true);
    cGeo.translate(0, -coreL * 0.5, 0);
    const mGeo = new THREE.ConeGeometry(mistR, mistL, 18, 12, true);
    mGeo.translate(0, -mistL * 0.5, 0);

    if (isAft) {
      cGeo.rotateX(-Math.PI / 2);
      mGeo.rotateX(-Math.PI / 2);
    } else if (axisDir === '+y') {
      cGeo.rotateX(Math.PI);
      mGeo.rotateX(Math.PI);
    } else if (axisDir === '+x') {
      cGeo.rotateZ(Math.PI / 2);
      mGeo.rotateZ(Math.PI / 2);
    } else if (axisDir === '-x') {
      cGeo.rotateZ(-Math.PI / 2);
      mGeo.rotateZ(-Math.PI / 2);
    }
    const coreMesh = new THREE.Mesh(cGeo, coreMat);
    const mistMesh = new THREE.Mesh(mGeo, mistMat);
    grp.add(coreMesh, mistMesh);

    // Nozzle frost exit flash disc on side RCS thrusters for crisp visual valve pop!
    let exitFlashMat = null;
    if (isSide) {
      exitFlashMat = new THREE.MeshBasicMaterial({
        color: '#eefaff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const flashDisc = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), exitFlashMat);
      flashDisc.rotation.y = Math.PI / 2;
      flashDisc.position.x = axisDir === '+x' ? 0.03 : -0.03;
      grp.add(flashDisc);
    }

    // Coaxial supersonic Mach shock-diamond compression discs (crystal-clear even head-on from GTA Chase Cam!)
    const shockDiscs = [];
    if (isAft) {
      const discMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uPower: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          varying float vFace;
          void main(){
            vUv = uv;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vec3 nView = normalize(normalMatrix * normal);
            vec3 vDir = normalize(-mvPos.xyz);
            vFace = pow(abs(dot(nView, vDir)), 2.2);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform float uPower;
          uniform float uTime;
          varying vec2 vUv;
          varying float vFace;
          void main() {
            if (uPower <= 0.01 || vFace <= 0.05) discard;
            float r = length((vUv - 0.5) * 2.0);
            if (r > 1.0) discard;
            float core = exp(-r * r * 6.5);
            float halo = exp(-pow((r - 0.42) / 0.22, 2.0)) * 0.42;
            vec3 col = mix(vec3(0.45, 0.86, 1.0), vec3(0.96, 0.99, 1.0), clamp(core * 1.25, 0.0, 1.0));
            float a = (core + halo) * (1.0 - smoothstep(0.66, 1.0, r)) * uPower * vFace * 0.36;
            gl_FragColor = vec4(col, a);
          }
        `
      });
      const zOffs = [0.42, 1.05, 1.85, 2.75];
      zOffs.forEach((zo, idx) => {
        const rad = coreR * (1.05 + idx * 0.45);
        const dm = new THREE.Mesh(new THREE.PlaneGeometry(rad * 2.2, rad * 2.2), discMat);
        dm.position.z = -zo * (coreL / 4.6);
        grp.add(dm);
        shockDiscs.push({ mesh: dm, baseZ: -zo * (coreL / 4.6), idx });
      });
      return { grp, coreMat, mistMat, discMat, shockDiscs, exitFlashMat };
    }

    return { grp, coreMat, mistMat, discMat: null, shockDiscs, exitFlashMat };
  }

  // Hero Rear Center SpaceX Main Aft Cold-Gas Booster Plume + Incandescent Frost Throat Disc + Diffuser Light!
  const aftPair = makePlumePair(0.38, 5.4, 1.12, 7.6, '-z');
  aftPair.grp.position.set(0, 0.56, -2.35);
  car.add(aftPair.grp);

  const throatGlowMat = new THREE.MeshBasicMaterial({
    color: '#e8faff',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const throatGlow = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16), throatGlowMat);
  throatGlow.rotation.y = Math.PI;
  throatGlow.position.set(0, 0.56, -2.36);
  car.add(throatGlow);

  // Subtle pale cyan-white nozzle back-light illuminating the sculpted carbon Venturi diffuser & highway during Boost!
  const aftLight = new THREE.PointLight('#b8ecff', 0, 16, 1.7);
  aftLight.position.set(0, 0.58, -2.95);
  car.add(aftLight);

  // Twin Flanking Rear Vernier RCS Attitude Micro-Jets (aligned directly to Blender sculpted vernier bells!)
  const vernierLeft = makePlumePair(0.13, 2.0, 0.38, 2.9, '-z');
  vernierLeft.grp.position.set(-0.42, 0.56, -2.3);
  car.add(vernierLeft.grp);

  const vernierRight = makePlumePair(0.13, 2.0, 0.38, 2.9, '-z');
  vernierRight.grp.position.set(0.42, 0.56, -2.3);
  car.add(vernierRight.grp);

  // 3B. 6 LATERAL LEFT/RIGHT ATTITUDE-CONTROL COLD-GAS RCS JETS (aligned to exact Blender side titanium bezels!)
  //     Produces iconic SpaceX / Flying Roadster crisp sideways supersonic cold-gas yaw & roll stabilization bursts!
  const lateralRcsSpecs = [
    { key: 'fl', pos: [-0.9, 0.44,  1.92], dir: '-x', coreL: 2.85, mistL: 3.75 },
    { key: 'fr', pos: [ 0.90, 0.44,  1.92], dir: '+x', coreL: 2.85, mistL: 3.75 },
    { key: 'ml', pos: [-0.97, 0.38,  0.34], dir: '-x', coreL: 2.25, mistL: 3.10 },
    { key: 'mr', pos: [ 0.97, 0.38,  0.34], dir: '+x', coreL: 2.25, mistL: 3.10 },
    { key: 'rl', pos: [-1, 0.50, -1.9], dir: '-x', coreL: 2.95, mistL: 3.85 },
    { key: 'rr', pos: [ 1.00, 0.50, -1.9], dir: '+x', coreL: 2.95, mistL: 3.85 }
  ];
  const lateralRcs = {};
  lateralRcsSpecs.forEach((sp) => {
    const pair = makePlumePair(0.16, sp.coreL, 0.50, sp.mistL, sp.dir);
    pair.grp.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    car.add(pair.grp);
    lateralRcs[sp.key] = pair;
  });

  // 4. Recessed Dark Wheel Wells + 10-Spoke Twin-Blade Concave Forged Alloy Wheels (with steerable front pivots!)
  const wheelCoords = [
    [-0.95, 0.37,  1.38],
    [ 0.95, 0.37,  1.38],
    [-0.99, 0.39, -1.32],
    [ 0.99, 0.39, -1.32]
  ];
  const wheels = [];
  const frontPivots = [];
  wheelCoords.forEach(([wx, wy, wz], idx) => {
    const r = idx >= 2 ? 0.395 : 0.365;
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.38, 18),
      carbonMat
    );
    well.rotation.z = Math.PI / 2;
    well.position.set(wx * 0.88, wy + 0.02, wz);
    car.add(well);

    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, wy, wz);

    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.34, 24), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);
    const rimLip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.77, 0.028, 8, 22), rimMat);
    rimLip.rotation.y = Math.PI / 2;
    rimLip.position.x = wx > 0 ? 0.165 : -0.165;
    wg.add(rimLip);

    const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.76, 0.34, 20), rimMat);
    rimBarrel.rotation.z = Math.PI / 2;
    wg.add(rimBarrel);

    const rimRecess = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, 0.35, 20), carbonMat);
    rimRecess.rotation.z = Math.PI / 2;
    wg.add(rimRecess);

    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, 0.06, 18), rotorMat);
    rotor.rotation.z = Math.PI / 2;
    rotor.position.x = wx > 0 ? -0.01 : 0.01;
    wg.add(rotor);

    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.18), caliperMat);
    cal.position.set(wx > 0 ? -0.02 : 0.02, 0.09, -0.15);
    wg.add(cal);

    for (let sp = 0; sp < 5; sp++) {
      const aBase = (sp / 5) * Math.PI * 2;
      for (const off of [-0.14, 0.14]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.355, 0.026, r * 0.72), rimMat);
        const a = aBase + off;
        spoke.position.set(0, Math.sin(a) * r * 0.34, Math.cos(a) * r * 0.34);
        spoke.rotation.x = -a;
        wg.add(spoke);
      }
    }
    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.37, 12), titaniumMat);
    centerCap.rotation.z = Math.PI / 2;
    wg.add(centerCap);

    steerPivot.add(wg);
    car.add(steerPivot);
    wheels.push(wg);
    if (idx < 2) frontPivots.push(steerPivot);
  });

  // Grounded contact shadow decal directly beneath Roadster chassis
  const shadowDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 5.5),
    new THREE.MeshBasicMaterial({ map: textures.contactShadow, transparent: true, opacity: 0.74, depthWrite: false })
  );
  shadowDecal.rotation.x = -Math.PI / 2;
  shadowDecal.position.y = 0.03;
  car.add(shadowDecal);

  // 5. 4 Underside Vertical Cold-Gas Lift Nozzles + Dual-Layer Volumetric Supersonic Plumes!
  const liftPairs = [];
  const plumes = [];
  const nozzleCoords = [
    [-0.72, 0.18,  1.02],
    [ 0.72, 0.18,  1.02],
    [-0.76, 0.18, -1.12],
    [ 0.76, 0.18, -1.12]
  ];
  nozzleCoords.forEach(([nx, ny, nz]) => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.14, 12), titaniumMat);
    nozzle.position.set(nx, ny, nz);
    car.add(nozzle);

    const pair = makePlumePair(0.24, 3.2, 0.78, 4.6, '-y');
    pair.grp.position.set(nx, ny - 0.05, nz);
    car.add(pair.grp);
    liftPairs.push(pair);
    plumes.push(pair.grp);
  });

  // 5B. 4 Flush Titanium Dorsal Retro-Descent Cold-Gas Vent Nozzles + Upward Supersonic Plumes (Active Descent!)
  const descentPairs = [];
  const dorsalCoords = [
    [-0.64, 0.86,  1.28],
    [ 0.64, 0.86,  1.28],
    [-0.68, 0.94, -1.52],
    [ 0.68, 0.94, -1.52]
  ];
  dorsalCoords.forEach(([dx, dy, dz]) => {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.07, 12), titaniumMat);
    bezel.position.set(dx, dy, dz);
    car.add(bezel);
    const pair = makePlumePair(0.18, 2.6, 0.56, 3.6, '+y');
    pair.grp.position.set(dx, dy + 0.04, dz);
    car.add(pair.grp);
    descentPairs.push(pair);
  });

  // Unified high-fidelity VFX update API (Mach-diamond lift/boost + 6-nozzle lateral RCS + 4 dorsal descent jets!)
  function setThrusterFx(t, liftPower, boostPower, vernierL = 0, vernierR = 0, rcsState = null, descentPower = 0) {
    const lp = THREE.MathUtils.clamp(liftPower, 0, 1.2);
    const bp = THREE.MathUtils.clamp(boostPower, 0, 1.2);
    const dp = THREE.MathUtils.clamp(descentPower, 0, 1.2);
    const vl = THREE.MathUtils.clamp(Math.max(bp * 0.85, vernierL), 0, 1.0);
    const vr = THREE.MathUtils.clamp(Math.max(bp * 0.85, vernierR), 0, 1.0);

    liftPairs.forEach((pair, idx) => {
      const jitter = 0.94 + Math.sin(t * 62 + idx * 1.7) * 0.06;
      pair.coreMat.uniforms.uTime.value = t;
      pair.coreMat.uniforms.uPower.value = lp * jitter;
      pair.mistMat.uniforms.uTime.value = t;
      pair.mistMat.uniforms.uPower.value = lp * jitter;
      const scW = 0.72 + lp * 0.55;
      const scL = 0.45 + lp * 0.95;
      pair.grp.scale.set(scW, scL, scW);
    });

    descentPairs.forEach((pair, idx) => {
      const jitter = 0.93 + Math.sin(t * 74 + idx * 2.1) * 0.07;
      pair.coreMat.uniforms.uTime.value = t;
      pair.coreMat.uniforms.uPower.value = dp * jitter;
      pair.mistMat.uniforms.uTime.value = t;
      pair.mistMat.uniforms.uPower.value = dp * jitter;
      const scW = 0.68 + dp * 0.50;
      const scL = 0.42 + dp * 0.92;
      pair.grp.scale.set(scW, scL, scW);
    });

    const bJit = 0.94 + Math.sin(t * 78) * 0.06;
    aftPair.coreMat.uniforms.uTime.value = t;
    aftPair.coreMat.uniforms.uPower.value = bp * bJit;
    aftPair.mistMat.uniforms.uTime.value = t;
    aftPair.mistMat.uniforms.uPower.value = bp * bJit;
    if (aftPair.discMat) {
      aftPair.discMat.uniforms.uTime.value = t;
      aftPair.discMat.uniforms.uPower.value = bp * bJit;
      aftPair.shockDiscs.forEach((sd) => {
        sd.mesh.position.z = sd.baseZ - ((t * 14 + sd.idx * 0.25) % 0.35);
      });
    }
    aftPair.grp.scale.set(0.78 + bp * 0.48, 0.78 + bp * 0.48, 0.55 + bp * 1.05);

    vernierLeft.coreMat.uniforms.uTime.value = t;
    vernierLeft.coreMat.uniforms.uPower.value = vl;
    vernierLeft.mistMat.uniforms.uTime.value = t;
    vernierLeft.mistMat.uniforms.uPower.value = vl;
    if (vernierLeft.discMat) vernierLeft.discMat.uniforms.uPower.value = vl * 0.8;
    vernierLeft.grp.scale.set(0.8 + vl * 0.35, 0.8 + vl * 0.35, 0.55 + vl * 0.75);

    vernierRight.coreMat.uniforms.uTime.value = t;
    vernierRight.coreMat.uniforms.uPower.value = vr;
    vernierRight.mistMat.uniforms.uTime.value = t;
    vernierRight.mistMat.uniforms.uPower.value = vr;
    if (vernierRight.discMat) vernierRight.discMat.uniforms.uPower.value = vr * 0.8;
    vernierRight.grp.scale.set(0.8 + vr * 0.35, 0.8 + vr * 0.35, 0.55 + vr * 0.75);

    // 6-Nozzle Lateral Left/Right Attitude-Control Cold-Gas RCS Plumes!
    // Auto-generates crisp SpaceX staccato hover-stabilizer pulses for NPC flyers if rcsState isn't supplied.
    const autoHover = lp > 0.22;
    const autoPulse = (freq, ph) => autoHover ? Math.pow(Math.max(0, Math.sin(t * freq + ph)), 6.0) * 0.85 : 0;
    const rcsVals = rcsState || {
      fl: autoPulse(5.8, 0.0),
      fr: autoPulse(5.8, 3.14),
      ml: autoPulse(4.3, 1.2),
      mr: autoPulse(4.3, 4.35),
      rl: autoPulse(5.8, 3.14),
      rr: autoPulse(5.8, 0.0)
    };
    for (const sp of lateralRcsSpecs) {
      const p = THREE.MathUtils.clamp(rcsVals[sp.key] || 0, 0, 1.15);
      const pair = lateralRcs[sp.key];
      const jit = 0.92 + Math.sin(t * 95 + sp.pos[2] * 3.0) * 0.08;
      pair.coreMat.uniforms.uTime.value = t;
      pair.coreMat.uniforms.uPower.value = p * jit;
      pair.mistMat.uniforms.uTime.value = t;
      pair.mistMat.uniforms.uPower.value = p * jit;
      if (pair.exitFlashMat) pair.exitFlashMat.opacity = p * 0.90;
      const lenSc = 0.35 + p * 0.85;
      const radSc = 0.65 + p * 0.52;
      pair.grp.scale.set(lenSc, radSc, radSc);
    }

    throatGlowMat.opacity = bp * (0.85 + Math.sin(t * 88) * 0.12);
    aftLight.intensity = bp * 28.0 + lp * 6.0 + dp * 8.0;
  }

  return {
    car,
    thrusterMat: liftPairs[0].coreMat,
    plumes,
    descentPairs,
    aftPlume: aftPair.grp,
    aftPlumeMat: aftPair.coreMat,
    lateralRcs,
    tailMat,
    wheels,
    frontPivots,
    shadowDecal,
    setThrusterFx
  };
}

/**
 * Shared High-Detail Asset Builder: Monumental Elevated Truss-Braced Mars Sky-Pad (Used by PAD-02, 03, 04, 05!)
 *  - Sintered-basalt center hub & grounded column footing piers
 *  - Full radial + perimeter structural X-bracing, ring girder & under-deck cyan optical guide bars
 *  - Sloped grated steel access staircase with yellow safety handrails descending cleanly to terrain
 *  - Hooded low-profile approach perimeter beacons, corner windsock/radar guidance mast & COPV refill cabinet!
 */
export function buildDetailedSkyPad(topMap, textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat, padH = 3.6) {
  const skyPad = new THREE.Group();
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.54, metalness: 0.28 });

  // Heavy central reinforced core pedestal + ground collar
  const hubCol = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, padH + 0.8, 12), basaltMat);
  hubCol.position.y = padH * 0.5 - 0.35;
  hubCol.castShadow = true;
  skyPad.add(hubCol);
  const hubBand = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.24, 6, 16), darkSteel);
  hubBand.rotation.x = Math.PI / 2;
  hubBand.position.y = padH * 0.5;
  skyPad.add(hubBand);

  const ringGirder = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.34, 8, 32), darkSteel);
  ringGirder.rotation.x = Math.PI / 2;
  ringGirder.position.y = padH - 0.78;
  skyPad.add(ringGirder);

  // 8 Grounded Truss Columns + Concrete Footings + Radial Diagonal X-Braces + Under-Deck Cyan Guide Bars!
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cx = Math.cos(a) * 9.2, cz = Math.sin(a) * 9.2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.92, 1.2, 8), basaltMat);
    foot.position.set(cx, 0.15, cz);
    skyPad.add(foot);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.64, padH - 0.2, 0.64), darkSteel);
    col.position.set(cx, (padH - 0.2) * 0.5, cz);
    col.castShadow = true;
    skyPad.add(col);
    // Radial diagonal strut connecting column to center hub
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.8, 0.24), steelMat);
    brace.position.set(Math.cos(a) * 6.4, padH * 0.48, Math.sin(a) * 6.4);
    brace.rotation.z = Math.cos(a) * 0.85;
    brace.rotation.x = -Math.sin(a) * 0.85;
    skyPad.add(brace);
    // Perimeter chord brace to neighboring column
    const aNext = ((i + 1) / 8) * Math.PI * 2;
    const p1 = new THREE.Vector3(cx, padH * 0.35, cz);
    const p2 = new THREE.Vector3(Math.cos(aNext) * 9.2, padH * 0.72, Math.sin(aNext) * 9.2);
    const perimBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, p1.distanceTo(p2), 6), darkSteel);
    perimBrace.position.copy(p1).add(p2).multiplyScalar(0.5);
    perimBrace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
    skyPad.add(perimBrace);
    // Under-deck cyan optical guide bar
    const aMid = a + Math.PI / 8;
    const cyanBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), cyanMat);
    cyanBar.position.set(Math.cos(aMid) * 10.6, padH - 0.62, Math.sin(aMid) * 10.6);
    cyanBar.rotation.y = -aMid + Math.PI / 2;
    skyPad.add(cyanBar);
  }

  // Painted Weathered Concrete Top Landing Disc + Steel Rim Flange + Guarded Hooded Approach Beacons!
  const skyPadTopMat = new THREE.MeshStandardMaterial({
    map: topMap,
    normalMap: textures.skyPadNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.86,
    metalness: 0.12
  });
  const deckDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(11.6, 12.0, 0.62, 32),
    [darkSteel, skyPadTopMat, darkSteel]
  );
  deckDisc.position.y = padH - 0.25;
  deckDisc.receiveShadow = true;
  deckDisc.castShadow = true;
  skyPad.add(deckDisc);

  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(11.68, 0.24, 8, 36), steelMat);
  rimTorus.rotation.x = Math.PI / 2;
  rimTorus.position.y = padH - 0.04;
  skyPad.add(rimTorus);

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const bx = Math.cos(a) * 11.15, bz = Math.sin(a) * 11.15;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.18, 8), darkSteel);
    base.position.set(bx, padH + 0.09, bz);
    skyPad.add(base);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 8), i % 4 === 0 ? cyanMat : amberMat);
    beacon.position.set(bx, padH + 0.28, bz);
    skyPad.add(beacon);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.10, 8), darkSteel);
    hood.position.set(bx, padH + 0.44, bz);
    skyPad.add(hood);
  }

  // Sloped Steel Access Staircase + Yellow Handrails descending off the +Z pad edge cleanly to ground!
  const stairG = new THREE.Group();
  const steps = 10;
  for (let s = 0; s < steps; s++) {
    const f = s / (steps - 1);
    const tread = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.10, 0.44), darkSteel);
    tread.position.set(0, padH - 0.15 - f * (padH - 0.25), 11.9 + f * 4.4);
    stairG.add(tread);
  }
  const sLen = Math.hypot(4.6, padH);
  const sAng = Math.atan2(padH, 4.6);
  for (const sx of [-1.05, 1.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, sLen), hazardMat);
    rail.position.set(sx, padH * 0.5 + 0.95, 14.1);
    rail.rotation.x = sAng;
    stairG.add(rail);
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, sLen), darkSteel);
    str.position.set(sx, padH * 0.5 - 0.1, 14.1);
    str.rotation.x = sAng;
    stairG.add(str);
  }
  skyPad.add(stairG);

  // Corner Approach Guidance Mast (anemometer/radar beacon) + Pad-Side N2/CO2 Quick-Charge COPV Cabinet!
  const mastX = -10.8, mastZ = -4.2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 4.4, 8), darkSteel);
  mast.position.set(mastX, padH + 2.2, mastZ);
  skyPad.add(mast);
  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.18), steelMat);
  radarBar.position.set(mastX, padH + 4.35, mastZ);
  skyPad.add(radarBar);
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
  redLight.position.set(mastX, padH + 4.65, mastZ);
  skyPad.add(redLight);

  const copvCab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.65, 0.95), steelMat);
  copvCab.position.set(10.6, padH + 0.82, 3.8);
  copvCab.rotation.y = -0.35;
  skyPad.add(copvCab);
  const cabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.36), cyanMat);
  cabScreen.position.set(10.16, padH + 1.15, 3.63);
  cabScreen.rotation.y = -Math.PI * 0.5 - 0.35;
  skyPad.add(cabScreen);

  return skyPad;
}

export function createRoadsterSystems(textures, onColdGasAudio) {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: '#88919c',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughnessMap: textures.ribSteelRough,
    roughness: 0.44,
    metalness: 0.84
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#343a44',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.48,
    metalness: 0.82
  });
  const basaltMat = new THREE.MeshStandardMaterial({
    color: '#6b5c53',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.basaltRough,
    roughness: 0.88,
    metalness: 0.10
  });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.62, metalness: 0.25 });
  const amberMat = new THREE.MeshBasicMaterial({ color: '#ffbf5e' });
  const cyanMat = new THREE.MeshBasicMaterial({ color: '#5eead4' });

  // =========================================================================
  // 1. ROADSTER #1 ON SERVICE APRON + CANTILEVERED MARS REFUELING STATION (Scene 01!)
  // =========================================================================
  const r1X = 12, r1Z = 5.5;
  const r1Y = getTerrainHeight(r1X, r1Z);

  const apronSlab = new THREE.Mesh(new THREE.BoxGeometry(20, 0.35, 13), basaltMat);
  apronSlab.position.set(12, r1Y + 0.15, 5.5);
  apronSlab.receiveShadow = true;
  root.add(apronSlab);

  // Yellow wheel-stop safety curbs & corner protective bollards along apron edge
  for (const cz of [0.2, 11.2]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.14, 0.24), hazardMat);
    curb.position.set(12, r1Y + 0.38, cz);
    root.add(curb);
  }

  const parked = buildRoadsterMesh(textures);
  parked.car.position.set(r1X, r1Y + 0.32, r1Z);
  parked.car.rotation.y = -Math.PI * 0.42;
  root.add(parked.car);

  // High-Detail N2/CO2 Cold-Gas Refueling Dispenser + Truss Cantilevered Shelter Canopy & Telemetry UI!
  const dispX = r1X + 4.5, dispZ = r1Z - 2.3;
  const dispenser = new THREE.Group();
  const dispBase = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 1.65), darkSteel);
  dispBase.position.y = 0.14;
  dispenser.add(dispBase);

  const dispBox = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.25, 0.88), steelMat);
  dispBox.position.y = 1.32;
  dispBox.castShadow = true;
  dispenser.add(dispBox);
  const dispCrown = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.24, 0.96), darkSteel);
  dispCrown.position.y = 2.52;
  dispenser.add(dispCrown);
  // Protective yellow crash bollards flanking dispenser
  for (const bx of [-0.95, 0.95]) {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.05, 8), hazardMat);
    guard.position.set(bx, 0.55, 0.62);
    dispenser.add(guard);
  }

  // Twin high-pressure COPV composite nitrogen bottles with brass valve manifolds & cross-pipe
  const copvMat = new THREE.MeshStandardMaterial({
    color: '#d4cfc6',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughness: 0.36,
    metalness: 0.58
  });
  for (const bx of [-0.30, 0.30]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.25, 6, 12), copvMat);
    tank.position.set(bx, 1.35, -0.62);
    dispenser.add(tank);
    for (const sy of [0.85, 1.78]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.024, 6, 12), darkSteel);
      strap.rotation.x = Math.PI / 2;
      strap.position.set(bx, sy, -0.62);
      dispenser.add(strap);
    }
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.24, 8), hazardMat);
    valve.position.set(bx, 2.15, -0.62);
    dispenser.add(valve);
  }
  const crossPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.66, 6), hazardMat);
  crossPipe.rotation.z = Math.PI / 2;
  crossPipe.position.set(0, 2.24, -0.62);
  dispenser.add(crossPipe);

  // Crisp CanvasTexture Cryo Flow Telemetry UI Screen ("N2/CO2 COPV · 350 BAR · READY")!
  const uiCan = document.createElement('canvas');
  uiCan.width = 256; uiCan.height = 160;
  const uctx = uiCan.getContext('2d');
  uctx.fillStyle = '#07141c';
  uctx.fillRect(0, 0, 256, 160);
  uctx.strokeStyle = '#38e8d8';
  uctx.lineWidth = 6;
  uctx.strokeRect(4, 4, 248, 152);
  uctx.fillStyle = '#5eead4';
  uctx.font = 'bold 24px monospace';
  uctx.fillText('N2/CO2 COPV', 18, 42);
  uctx.fillStyle = '#f8f0e4';
  uctx.font = 'bold 34px monospace';
  uctx.fillText('350 BAR', 18, 92);
  uctx.fillStyle = '#fbbf24';
  uctx.font = 'bold 18px monospace';
  uctx.fillText('FLOW: READY · -182C', 18, 134);
  const uiTex = new THREE.CanvasTexture(uiCan);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  const dispScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.48), new THREE.MeshBasicMaterial({ map: uiTex }));
  dispScreen.position.set(0, 1.72, 0.45);
  dispenser.add(dispScreen);
  for (const gx of [-0.24, 0.24]) {
    const gBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), darkSteel);
    gBezel.rotation.x = Math.PI / 2;
    gBezel.position.set(gx, 1.20, 0.44);
    dispenser.add(gBezel);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), new THREE.MeshBasicMaterial({ color: '#f4ecd8' }));
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(gx, 1.20, 0.45);
    dispenser.add(gauge);
  }

  // Truss-Braced Cantilevered Steel Service Shelter Canopy + Illuminated Fascia Strip!
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.85, 0.28), darkSteel);
  mast.position.set(0.48, 1.92, -0.82);
  mast.castShadow = true;
  dispenser.add(mast);
  const strutArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.55, 0.14), hazardMat);
  strutArm.position.set(0.15, 3.15, -0.35);
  strutArm.rotation.x = 0.78;
  dispenser.add(strutArm);
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.22, 2.7), darkSteel);
  canopyRoof.position.set(-0.2, 3.82, 0.14);
  canopyRoof.rotation.x = 0.08;
  canopyRoof.castShadow = true;
  dispenser.add(canopyRoof);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.18, 0.08), hazardMat);
  fascia.position.set(-0.2, 3.72, 1.48);
  dispenser.add(fascia);
  const canopyStrip = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.16), amberMat);
  canopyStrip.position.set(-0.2, 3.68, 0.85);
  dispenser.add(canopyStrip);

  dispenser.position.set(dispX, r1Y + 0.32, dispZ);
  dispenser.rotation.y = -0.35;
  root.add(dispenser);

  // Twin flexible high-pressure refueling hoses (orange primary N2 line + dark return pressure tether)
  const hoseCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(dispX - 0.35, r1Y + 1.35, dispZ + 0.32),
    new THREE.Vector3(dispX - 1.55, r1Y + 0.48, dispZ + 1.22),
    new THREE.Vector3(r1X + 1.65,   r1Y + 0.84, r1Z - 0.52)
  ]);
  root.add(new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve1, 18, 0.055, 8, false),
    new THREE.MeshStandardMaterial({ color: '#c44d2b', roughness: 0.62 })
  ));
  const hoseCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(dispX - 0.15, r1Y + 1.15, dispZ + 0.42),
    new THREE.Vector3(dispX - 1.35, r1Y + 0.42, dispZ + 1.48),
    new THREE.Vector3(r1X + 1.55,   r1Y + 0.76, r1Z - 0.32)
  ]);
  root.add(new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve2, 16, 0.036, 8, false),
    darkSteel
  ));

  // =========================================================================
  // 2. MONUMENTAL ELEVATED CIRCULAR SKY-PAD + ACTIVE BALLISTIC HOP ROADSTER #2 (Scene 06!)
  // =========================================================================
  const padX = 42, padZ = -12;
  const padGround = getTerrainHeight(padX, padZ);
  const padH = 3.6;
  const padTopY = padGround + padH;

  const skyPad = buildDetailedSkyPad(textures.skyPadColor, textures, darkSteel, steelMat, basaltMat, amberMat, cyanMat, padH);
  skyPad.position.set(padX, padGround, padZ);
  root.add(skyPad);

  const jumper = buildRoadsterMesh(textures);
  jumper.car.position.set(padX, padTopY + 0.08, padZ);
  jumper.car.rotation.y = Math.PI * 0.72;
  root.add(jumper.car);

  const hopClouds = createVolumetricCloudSystem(textures.cloudVolAtlas, 56, { renderOrder: 7 });
  root.add(hopClouds.mesh);

  function spawnHopDust(pos) {
    const a = Math.random() * Math.PI * 2;
    const isCryo = Math.random() < 0.42;
    hopClouds.spawn({
      x: pos.x + Math.cos(a) * 1.6,
      y: pos.y + (isCryo ? 1.1 : 0.65),
      z: pos.z + Math.sin(a) * 1.6,
      vx: Math.cos(a) * (5.5 + Math.random() * 6.5),
      vy: isCryo ? (0.8 + Math.random() * 1.6) : (1.5 + Math.random() * 2.8),
      vz: Math.sin(a) * (5.5 + Math.random() * 6.5),
      drag: 0.48,
      buoyancy: isCryo ? 0.4 : 0.9,
      startSize: isCryo ? 2.4 : 2.8,
      endSize: isCryo ? 8.2 : 10.2,
      maxLife: 1.5 + Math.random() * 0.8,
      maxOp: isCryo ? 0.32 : 0.56,
      density: isCryo ? 0.80 : 0.98,
      scatter: isCryo ? 0.90 : 0.60,
      stretchY: 0.72,
      wispiness: isCryo ? 1.48 : 1.05,
      litCol: isCryo ? [0.46, 0.54, 0.62] : [0.36, 0.13, 0.052],
      shadCol: isCryo ? [0.16, 0.21, 0.26] : [0.055, 0.017, 0.010]
    });
  }

  let hopActive = false;
  let hopTime = 0;
  const hopDuration = 12.5;
  let autoHopTimer = 8.0;

  function triggerRoadsterHop() {
    if (hopActive) return;
    hopActive = true;
    hopTime = 0;
    if (onColdGasAudio) onColdGasAudio();
  }

  return {
    group: root,
    triggerRoadsterHop,
    setSunLighting: (preset) => hopClouds.setSunLighting(preset),
    getStatus: () => (hopActive ? `COLD-GAS HOP (${Math.round((hopTime / hopDuration) * 100)}%)` : 'SKY-PAD READY (250kg N2/CO2)'),
    update(dt, t, cameraPos = null) {
      if (!hopActive) {
        autoHopTimer -= dt;
        if (autoHopTimer <= 0) triggerRoadsterHop();
      } else {
        hopTime += dt;
        const u = Math.min(1, hopTime / hopDuration);
        const arcOut = Math.sin(u * Math.PI);
        const alt = Math.pow(arcOut, 0.85) * 26.0;
        const driftX = -Math.sin(u * Math.PI * 2) * 22.0;
        const driftZ = -arcOut * 62.0;

        jumper.car.position.set(padX + driftX, padTopY + 0.08 + alt, padZ + driftZ);
        jumper.shadowDecal.material.opacity = Math.max(0, 0.72 * (1 - alt / 12));
        const pitch = Math.cos(u * Math.PI) * -0.18;
        const roll = Math.cos(u * Math.PI * 2) * 0.14;
        jumper.car.rotation.set(pitch, Math.PI * 0.72 + Math.sin(u * Math.PI) * 0.45, roll);

        let thrust = 0.28;
        if (u < 0.28) thrust = 1.0 - (u / 0.28) * 0.42;
        else if (u > 0.70) thrust = 0.55 + ((u - 0.70) / 0.30) * 0.45;
        const aftB = (u > 0.18 && u < 0.72) ? 0.65 : 0.12;
        jumper.setThrusterFx(t, thrust, aftB, 0, 0);

        if (alt < 9.5 && Math.random() < 0.82) {
          spawnHopDust(new THREE.Vector3(padX + driftX, padTopY, padZ + driftZ));
        }
        hopClouds.setEngineLight(0, padX + driftX, padTopY + alt, padZ + driftZ, thrust * 0.85, 14.0, 0.78, 0.94, 1.0);

        if (u >= 1) {
          hopActive = false;
          jumper.car.position.set(padX, padTopY + 0.08, padZ);
          jumper.car.rotation.set(0, Math.PI * 0.72, 0);
          jumper.setThrusterFx(t, 0, 0, 0, 0);
          jumper.shadowDecal.material.opacity = 0.72;
          hopClouds.setEngineLight(0, padX, -999, padZ, 0, 14.0);
          autoHopTimer = 18.0;
        }
      }

      hopClouds.step(dt, t, cameraPos);
    }
  };
}
