import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../terrain.js';
import { buildOptimusUnit } from './optimus.js';
import { COLONIST_GLB_GZIP_B64 } from './colonist_glb_data.js';
import { buildHoodedMarsLamp, buildIndustrialHvacUnit, buildIndustrialCryoSilo, buildCryoSphereTank } from './industrial_props.js';
import { enhancePressurizedGlassMaterial } from '../vfx/cinematic_shaders.js';

let _colonistGlbPromise = null;
function getColonistGlbParts() {
  if (!_colonistGlbPromise) {
    _colonistGlbPromise = (async () => {
      const binStr = atob(COLONIST_GLB_GZIP_B64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const ds = new DecompressionStream('gzip');
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(buf, '', resolve, reject);
      });
      const parts = {};
      gltf.scene.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const geo = child.geometry;
        const aoAttr = geo.attributes.color_1 || geo.attributes._color_1;
        if (aoAttr) {
          const n = aoAttr.count;
          const out = new Float32Array(n * 3);
          const isByte = aoAttr.array instanceof Uint8Array || aoAttr.array instanceof Uint16Array;
          const normDiv = aoAttr.array instanceof Uint16Array ? 65535 : (isByte ? 255 : 1);
          const minAo = 0.62;
          for (let i = 0; i < n; i++) {
            const raw = aoAttr.getX(i) / (aoAttr.normalized ? 1 : normDiv);
            const ao = minAo + (1.0 - minAo) * THREE.MathUtils.clamp(raw, 0, 1);
            out[i * 3] = ao;
            out[i * 3 + 1] = ao;
            out[i * 3 + 2] = ao;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
        }
        parts[child.name] = child;
      });
      return parts;
    })();
  }
  return _colonistGlbPromise;
}

export const HERO_BIODOME = {
  x: -18,
  z: -155,
  r: 42,
  floorY: getTerrainHeight(-18, -155) + 0.40
};

/**
 * Helper: Builds a lush multi-branch Martian potted tree with tapered forked boughs,
 * fine twig forks & layered alpha-cutout botanical foliage canopies (zero blocky icosahedrons!).
 */
function buildPottedMarsTree(trunkMat, leafMat, darkLeafMat, textures = null) {
  const tree = new THREE.Group();

  // Flared woody root collar + gently curving main trunk
  const rootFlare = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.11, 0.24, 8), trunkMat);
  rootFlare.position.y = 0.12;
  tree.add(rootFlare);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.074, 1.28, 8), trunkMat);
  trunk.position.set(0.02, 0.72, 0);
  trunk.rotation.z = 0.06;
  tree.add(trunk);

  // Leafy alpha-cutout material when textures provided (or layered fine foliage tufts)
  const canopyMatA = (textures && textures.vineLeafAlpha)
    ? new THREE.MeshStandardMaterial({
        map: textures.vineLeafAlpha,
        alphaTest: 0.36,
        side: THREE.DoubleSide,
        roughness: 0.72,
        emissive: '#17380d',
        emissiveIntensity: 0.24
      })
    : leafMat;
  const canopyMatB = (textures && textures.saladLeafAlpha)
    ? new THREE.MeshStandardMaterial({
        map: textures.saladLeafAlpha,
        alphaTest: 0.36,
        side: THREE.DoubleSide,
        roughness: 0.76,
        emissive: '#102c0a',
        emissiveIntensity: 0.22
      })
    : darkLeafMat;

  const branchSpecs = [
    { pos: [ 0.24, 1.22,  0.14], rot: [ 0.22, 0.2, -0.58], len: 0.68, r: 0.42 },
    { pos: [-0.26, 1.30, -0.10], rot: [-0.18, 0.1,  0.54], len: 0.64, r: 0.40 },
    { pos: [ 0.08, 1.52, -0.24], rot: [-0.48, 0.0, -0.14], len: 0.58, r: 0.44 },
    { pos: [-0.10, 1.60,  0.22], rot: [ 0.44, 0.0,  0.20], len: 0.54, r: 0.42 },
    { pos: [ 0.20, 1.66, -0.14], rot: [-0.28, 0.3, -0.36], len: 0.46, r: 0.38 },
    { pos: [-0.18, 1.70,  0.08], rot: [ 0.18, -0.2, 0.34], len: 0.44, r: 0.38 },
    { pos: [ 0.00, 1.88,  0.00], rot: [ 0.00, 0.0,  0.00], len: 0.42, r: 0.48 }
  ];
  branchSpecs.forEach((b, i) => {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.034, b.len, 6), trunkMat);
    br.position.set(b.pos[0] * 0.58, b.pos[1] - 0.16, b.pos[2] * 0.58);
    br.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
    tree.add(br);

    // Multi-plane crossed botanical leaf star-cluster (feathery sunlit foliage silhouette!)
    if (textures && textures.vineLeafAlpha) {
      const mat = i % 2 === 0 ? canopyMatA : canopyMatB;
      for (let p = 0; p < 3; p++) {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(b.r * 2.15, b.r * 1.85), mat);
        card.position.set(b.pos[0], b.pos[1] + 0.10, b.pos[2]);
        card.rotation.set((p === 2 ? 0.38 : -0.14), (p / 3) * Math.PI + i * 0.7, (i % 2 === 0 ? 0.12 : -0.12));
        tree.add(card);
      }
    } else {
      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(b.r * 0.82, 1), i % 2 === 0 ? leafMat : darkLeafMat);
      core.scale.set(1.22, 0.68, 1.12);
      core.position.set(b.pos[0], b.pos[1] + 0.10, b.pos[2]);
      tree.add(core);
    }
  });

  return tree;
}

/**
 * Helper: AAA Blender 5.0 Catmull-Clark Subsurf Mars Frontier Agronomist Settlers (11,948 tris!)
 *  - variant: 'harvest' (reaching into potato crate), 'tablet' (inspecting glowing cyan tablet), 'walk' (aisle colonist)
 */
function buildMarsAgronomist(variant = 'harvest') {
  const person = new THREE.Group();

  const prefix = variant === 'tablet'
    ? 'ColonistTablet'
    : variant === 'walk'
      ? 'ColonistWalk'
      : 'ColonistHarvest';

  const jacketCol = variant === 'harvest' ? '#92623c' : variant === 'tablet' ? '#4d6052' : '#6b584b';
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketCol,
    vertexColors: true,
    roughness: 0.80,
    metalness: 0.06
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: '#343942',
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.08
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#dfa98c',
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.04
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#262220',
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.14
  });
  const tabletGlowMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' });

  getColonistGlbParts()
    .then((parts) => {
      const mount = (suffix, mat, cast = true) => {
        const src = parts[`${prefix}_${suffix}`];
        if (!src) return;
        const m = new THREE.Mesh(src.geometry, mat);
        m.castShadow = cast;
        m.receiveShadow = true;
        person.add(m);
      };
      mount('Jacket', jacketMat, true);
      mount('Pants', pantsMat, true);
      mount('Skin', skinMat, true);
      mount('Dark', darkMat, true);
      if (variant === 'tablet') mount('TabletGlow', tabletGlowMat, false);
    })
    .catch((err) => console.error('Failed to mount Blender Colonist GLB:', err));

  return person;
}

/**
 * Helper: Monumental Beveled Aerospace Pressurized Airlock Bulkhead Portal (Scene 09 Background!)
 * (Heavy chamfered surround, top pneumatic sliding rail, reinforced dual blast doors, mullioned viewport,
 *  mechanical locking wheel, hazard threshold, pressure-telemetry wall consoles & hooded sconces!)
 */
function buildBulkheadAirlockPortal(steelMat, darkSteel, amberMat, cyanMat) {
  const g = new THREE.Group();
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.52, metalness: 0.30 });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#9aa4b0', roughness: 0.34, metalness: 0.86 });

  // Heavy chamfered industrial bulkhead outer surround + angled corner gussets
  const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(7.0, 6.6, 1.65), darkSteel);
  outerFrame.position.y = 3.3;
  outerFrame.castShadow = true;
  g.add(outerFrame);
  for (const sx of [-3.35, 3.35]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.75, 2.05), darkSteel);
    pilaster.position.set(sx, 3.38, 0);
    g.add(pilaster);
  }
  const lintelBeam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.72, 2.15), darkSteel);
  lintelBeam.position.y = 6.25;
  g.add(lintelBeam);

  const innerCollar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.4, 1.85), steelMat);
  innerCollar.position.y = 2.75;
  g.add(innerCollar);

  // Double brushed-stainless pressurized sliding blast doors + horizontal reinforcement ribs + overhead track!
  const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.4, 1.94), doorMat);
  doorSlab.position.y = 2.25;
  g.add(doorSlab);
  const trackRail = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.24, 2.16), darkSteel);
  trackRail.position.y = 4.62;
  g.add(trackRail);
  for (const ry of [1.1, 3.55]) {
    const hRib = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 2.02), darkSteel);
    hRib.position.y = ry;
    g.add(hRib);
  }
  const centerSeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.44, 2.00), darkSteel);
  centerSeam.position.y = 2.25;
  g.add(centerSeam);

  // Mechanical locking handwheel on right door leaf + recessed mullioned viewport
  const portFrame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.28, 2.04), darkSteel);
  portFrame.position.y = 2.55;
  g.add(portFrame);
  const portGlow = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.90, 2.08), new THREE.MeshBasicMaterial({ color: '#ffd994' }));
  portGlow.position.y = 2.55;
  g.add(portGlow);
  const portMul = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.08, 2.12), darkSteel);
  portMul.position.y = 2.55;
  g.add(portMul);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.04, 6, 14), hazardMat);
  wheel.position.set(1.18, 2.05, 1.06);
  g.add(wheel);

  // Hazard floor threshold + overhead 70 kPa cyan beacon + dual wall control consoles & shielded sconces!
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.10, 2.35), hazardMat);
  threshold.position.y = 0.05;
  g.add(threshold);
  const topBeacon = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.26, 2.08), cyanMat);
  topBeacon.position.y = 5.55;
  g.add(topBeacon);

  for (const sx of [-2.52, 2.52]) {
    const sconceHousing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.62, 2.08), darkSteel);
    sconceHousing.position.set(sx, 3.05, 0);
    g.add(sconceHousing);
    const sconceGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.32, 2.14), amberMat);
    sconceGlow.position.set(sx, 3.05, 0);
    g.add(sconceGlow);
    // Pressurization control keypad box mounted at waist height
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 2.10), darkSteel);
    keypad.position.set(sx, 1.42, 0);
    g.add(keypad);
    const keyScreen = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 2.15), cyanMat);
    keyScreen.position.set(sx, 1.50, 0);
    g.add(keyScreen);
  }

  return g;
}

/**
 * Geodesic Transparent Bio-Dome with heavy pressure hold-down ring (v5.1 ΔP=69.4 kPa),
 * sweeping 3D geodesic steel meridian + latitude structural ribs, apex cupola, crystal-clear
 * ETFE glazing (depthWrite:false), and 4 distinct concept-art interior archetypes:
 *   - 'farm':       Hero Walkable Scene 09 Agro-Farm (grated steel walkway, tomato vine arches w/ ripe red tomatoes,
 *                   harvest potato crates, golden wheat plots, overhead LED grow-lights, Optimus bots & agronomists!)
 *   - 'hydrotower': Vertical Aeroponic Emerald-Green & Magenta-Pink LED Hydro-Tower Dome (Mars City render!)
 *   - 'habitat':    Golden Civic Habitat & Atrium Plaza Dome (multi-story warm-lit pavilions + sky-ring mezzanine!)
 *   - 'botanical':  Grand Multi-Tier Concentric Terraced Botanical Hub Dome (Scene 03!)
 */
function buildGeodesicBioDome(radius, textures, variant = 'botanical') {
  const g = new THREE.Group();
  const animBots = [];

  const concreteMat = new THREE.MeshStandardMaterial({
    color: '#78685e',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.basaltRough,
    roughness: 0.88,
    metalness: 0.12
  });
  const trussMat = new THREE.MeshStandardMaterial({
    color: '#b2bac4',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughnessMap: textures.steelRough,
    roughness: 0.34,
    metalness: 0.88
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#343a44',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.82
  });
  const troughMat = new THREE.MeshStandardMaterial({
    color: '#747d88',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.48,
    metalness: 0.78
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: '#9ca3ab',
    map: textures.deckColor,
    normalMap: textures.deckNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.deckRough,
    roughness: 0.80,
    metalness: 0.36
  });
  const greenBedMat = new THREE.MeshStandardMaterial({
    map: textures.cropGreenColor,
    normalMap: textures.cropNormal,
    normalScale: new THREE.Vector2(1.8, 1.8),
    emissive: '#285818',
    emissiveIntensity: 0.48,
    roughness: 0.84
  });
  const wheatBedMat = new THREE.MeshStandardMaterial({
    map: textures.cropWheatColor,
    normalMap: textures.cropNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    emissive: '#785516',
    emissiveIntensity: 0.44,
    roughness: 0.86
  });
  const lampStripMat = new THREE.MeshBasicMaterial({ color: '#ffdc91' });
  const amberGlowMat = new THREE.MeshBasicMaterial({ color: '#ffca6e' });
  const cyanGlowMat = new THREE.MeshBasicMaterial({ color: '#5eead4' });
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#593e2b', roughness: 0.90 });
  const orchardLeafMat = new THREE.MeshStandardMaterial({ color: '#3b7b2b', emissive: '#1b3e12', emissiveIntensity: 0.28, roughness: 0.78 });
  const orchardDarkLeafMat = new THREE.MeshStandardMaterial({ color: '#27571d', emissive: '#112a0b', emissiveIntensity: 0.24, roughness: 0.82 });

  // 1. Heavy anchored concrete/steel pressure hold-down ring + low interior perimeter bulkhead curb
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.050, 12, 44), concreteMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = radius * 0.02;
  ring.receiveShadow = true;
  g.add(ring);

  const curbWall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.985, radius * 0.995, 2.1, 44, 1, true),
    concreteMat
  );
  curbWall.material = concreteMat.clone();
  curbWall.material.side = THREE.DoubleSide;
  curbWall.position.y = 1.05;
  g.add(curbWall);

  const pierCount = 16;
  const pierGeo = new THREE.BoxGeometry(radius * 0.055, radius * 0.13, radius * 0.12);
  for (let i = 0; i < pierCount; i++) {
    const a = (i / pierCount) * Math.PI * 2;
    const pier = new THREE.Mesh(pierGeo, concreteMat);
    pier.position.set(Math.cos(a) * (radius * 1.02), radius * 0.045, Math.sin(a) * (radius * 1.02));
    pier.rotation.y = -a + Math.PI / 2;
    g.add(pier);
  }

  // Interior pressurized level floor slab (elevated cleanly above Martian terrain regolith!)
  const floorY = 0.55;
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.982, radius * 0.988, 0.55, 40),
    new THREE.MeshStandardMaterial({
      color: '#463f3a',
      map: textures.basaltColor,
      normalMap: textures.basaltNormal,
      roughness: 0.88,
      metalness: 0.14
    })
  );
  floor.position.y = floorY - 0.275;
  floor.receiveShadow = true;
  g.add(floor);

  // =========================================================================
  // ARCHETYPE A: HERO WALKABLE BIO-DOME AGRO-FARM (Exact Scene 09 Recreation!)
  // =========================================================================
  if (variant === 'farm') {
    // Central Industrial Grated-Steel Promenade Walkway (Z main aisle + X cross aisle!)
    const mainWalk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, radius * 1.80), deckMat);
    mainWalk.position.set(0, floorY + 0.04, 0);
    mainWalk.receiveShadow = true;
    g.add(mainWalk);
    const crossWalk = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.76, 0.07, 4.4), deckMat);
    crossWalk.position.set(0, floorY + 0.035, 0);
    crossWalk.receiveShadow = true;
    g.add(crossWalk);

    // Brushed stainless walkway edge curbs + subtle recessed warm aisle guide lights
    for (const sx of [-2.68, 2.68]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, radius * 1.76), trussMat);
      curb.position.set(sx, floorY + 0.09, 0);
      g.add(curb);
      const guide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, radius * 1.70), amberGlowMat);
      guide.position.set(sx * 0.94, floorY + 0.09, 0);
      g.add(guide);
    }

    // 4 Monumental Bolted Pressurized Airlock Bulkhead Portals (North, South, East, West!)
    const portalDefs = [
      { x: 0, z: -(radius - 3.0), rotY: 0 },
      { x: 0, z:  (radius - 3.0), rotY: Math.PI },
      { x: -(radius - 3.0), z: 0, rotY: Math.PI * 0.5 },
      { x:  (radius - 3.0), z: 0, rotY: -Math.PI * 0.5 }
    ];
    portalDefs.forEach((pd) => {
      const portal = buildBulkheadAirlockPortal(trussMat, darkSteel, amberGlowMat, cyanGlowMat);
      portal.position.set(pd.x, floorY, pd.z);
      portal.rotation.y = pd.rotY;
      g.add(portal);
    });

    // Helper: Seeded deterministic PRNG for dense, organic instanced crops (zero jitter!)
    let seed = 9091;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const vineLeafSpots = [];
    const tomatoSpots = [];
    const potatoSpots = [];
    const saladSpots = [];
    const wheatSpots = [];

    // 4 Long Parallel Ribbed Grey Hydroponic Steel Planter Troughs flanking the central walkway!
    // Left rows (-5.8, -11.4): Tall Tomato Vine Trellises + Foreground Potato Harvest Crates
    // Right rows (+5.8, +11.4, +17.0): Leafy Salad Greens & Sunlit Golden Mars Wheat Plots!
    const rowConfigs = [
      { x: -5.8,  type: 'tomato', zBays: [[-30, -5], [5, 29]] },
      { x: -11.6, type: 'tomato', zBays: [[-27, -5], [5, 26]] },
      { x: -17.4, type: 'salad',  zBays: [[-21, -5], [5, 20]] },
      { x:  5.8,  type: 'salad',  zBays: [[-30, -5], [5, 29]] },
      { x:  11.6, type: 'wheat',  zBays: [[-27, -5], [5, 26]] },
      { x:  17.4, type: 'wheat',  zBays: [[-21, -5], [5, 20]] }
    ];

    const pipeMat = new THREE.MeshStandardMaterial({ color: '#bfc7d1', roughness: 0.26, metalness: 0.92 });
    const soilDarkMat = new THREE.MeshStandardMaterial({ color: '#3b2c22', roughness: 0.96 });

    rowConfigs.forEach((rc) => {
      rc.zBays.forEach(([z0, z1]) => {
        const len = z1 - z0;
        const zMid = (z0 + z1) * 0.5;
        const bedW = 2.65;
        const bedTopY = floorY + 1.18;

        // Raised corrugated steel hydroponic planter box + tubular support legs + stainless irrigation pipe!
        const box = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.72, len), troughMat);
        box.position.set(rc.x, floorY + 0.82, zMid);
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);

        const soilTop = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.16, 0.08, len - 0.16), soilDarkMat);
        soilTop.position.set(rc.x, bedTopY - 0.02, zMid);
        g.add(soilTop);

        const legCount = Math.max(3, Math.floor(len / 5.5) + 1);
        for (let li = 0; li < legCount; li++) {
          const lz = THREE.MathUtils.lerp(z0 + 0.45, z1 - 0.45, li / (legCount - 1));
          for (const lx of [-bedW * 0.44, bedW * 0.44]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.50, 6), pipeMat);
            leg.position.set(rc.x + lx, floorY + 0.25, lz);
            g.add(leg);
          }
        }

        // Curved stainless irrigation manifold riser pipe at both ends of trough (Scene 09 detail!)
        for (const ez of [z0 - 0.22, z1 + 0.22]) {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 8), pipeMat);
          pipe.position.set(rc.x, floorY + 0.52, ez);
          g.add(pipe);
          const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), pipeMat);
          elbow.position.set(rc.x, floorY + 1.02, ez);
          g.add(elbow);
        }

        // Populate bed with specialized 3D instanced crops!
        if (rc.type === 'tomato') {
          // Tall galvanized steel trellis arch frame (h = 4.5m) rising over the tomato bed!
          const postCount = Math.max(3, Math.floor(len / 5.0) + 1);
          for (let pi = 0; pi < postCount; pi++) {
            const pz = THREE.MathUtils.lerp(z0 + 0.5, z1 - 0.5, pi / (postCount - 1));
            for (const lx of [-bedW * 0.42, bedW * 0.42]) {
              const tPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6), pipeMat);
              tPost.position.set(rc.x + lx, bedTopY + 1.8, pz);
              g.add(tPost);
            }
            const tBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, bedW * 0.9, 6), pipeMat);
            tBar.rotation.z = Math.PI / 2;
            tBar.position.set(rc.x, bedTopY + 3.55, pz);
            g.add(tBar);
          }
          // Overhead horizontal vine trellis rails
          for (const lx of [-bedW * 0.42, bedW * 0.42]) {
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), pipeMat);
            rail.rotation.x = Math.PI / 2;
            rail.position.set(rc.x + lx, bedTopY + 3.55, zMid);
            g.add(rail);
          }
          // Dense layered leafy tomato vines & hanging clusters of glistening ripe red Mars tomatoes!
          const vineSteps = Math.floor(len / 1.35);
          for (let vs = 0; vs < vineSteps; vs++) {
            const vz = z0 + 0.7 + vs * 1.35;
            for (let vy = 0; vy < 4; vy++) {
              const py = bedTopY + 0.55 + vy * 0.85 + (rnd() - 0.5) * 0.2;
              const px = rc.x + (rnd() - 0.5) * (bedW * 0.78);
              vineLeafSpots.push({ x: px, y: py, z: vz + (rnd() - 0.5) * 0.35, s: 0.46 + rnd() * 0.28, ry: rnd() * 6.28 });
              // Hang clusters of bright ripe red tomatoes visibly along aisle-facing vines!
              if (rnd() > 0.32) {
                const sideBias = rc.x < 0 ? 1 : -1;
                tomatoSpots.push({
                  x: rc.x + sideBias * (0.72 + rnd() * 0.52),
                  y: py - 0.08 + (rnd() - 0.5) * 0.25,
                  z: vz + (rnd() - 0.5) * 0.45,
                  s: 0.085 + rnd() * 0.038
                });
              }
            }
          }
        } else if (rc.type === 'salad') {
          // Dense ruffled leafy greens & herbs across entire raised trough
          const stepsZ = Math.floor(len / 0.85);
          for (let sz = 0; sz < stepsZ; sz++) {
            const pz = z0 + 0.45 + sz * 0.85;
            for (const lx of [-0.75, 0.0, 0.75]) {
              saladSpots.push({
                x: rc.x + lx + (rnd() - 0.5) * 0.22,
                y: bedTopY + 0.22 + rnd() * 0.14,
                z: pz + (rnd() - 0.5) * 0.22,
                s: 0.34 + rnd() * 0.16,
                ry: rnd() * 6.28
              });
            }
          }
        } else if (rc.type === 'wheat') {
          // Tall sunlit golden Mars wheat stalks & seed ears!
          const stepsZ = Math.floor(len / 0.72);
          for (let sz = 0; sz < stepsZ; sz++) {
            const pz = z0 + 0.4 + sz * 0.72;
            for (const lx of [-0.85, -0.28, 0.28, 0.85]) {
              wheatSpots.push({
                x: rc.x + lx + (rnd() - 0.5) * 0.24,
                y: bedTopY + 0.62,
                z: pz + (rnd() - 0.5) * 0.24,
                h: 1.15 + rnd() * 0.45,
                leanX: (rnd() - 0.5) * 0.22,
                leanZ: (rnd() - 0.5) * 0.22
              });
            }
          }
        }
      });
    });

    // Foreground Harvest Potato Crates overflowing with golden-tan Mars potatoes along left aisle (Scene 09!)
    const crateMat = new THREE.MeshStandardMaterial({ color: '#6b727c', roughness: 0.62, metalness: 0.45 });
    for (const cz of [23.8, 21.8, 19.8]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 1.55), crateMat);
      crate.position.set(-3.65, floorY + 0.58, cz);
      crate.castShadow = true;
      g.add(crate);
      for (const lx of [-0.48, 0.48]) {
        for (const lz of [-0.68, 0.68]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6), pipeMat);
          leg.position.set(-3.65 + lx, floorY + 0.125, cz + lz);
          g.add(leg);
        }
      }
      // Mound of sculpted Mars potatoes piled inside crate!
      for (let p = 0; p < 38; p++) {
        potatoSpots.push({
          x: -3.65 + (rnd() - 0.5) * 0.92,
          y: floorY + 0.92 + rnd() * 0.20,
          z: cz + (rnd() - 0.5) * 1.28,
          s: 0.085 + rnd() * 0.045,
          ry: rnd() * 6.28
        });
      }
    }

    // Helper: Builds a lightweight multi-plane crossed botanical foliage star-card (upward-biased normals for lush sunlit leaves!)
    function buildCrossedCardGeo(w, h, planes = 3, yOffset = 0) {
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      let vBase = 0;
      const hw = w * 0.5;
      for (let p = 0; p < planes; p++) {
        const a = (p / planes) * Math.PI;
        const ca = Math.cos(a), sa = Math.sin(a);
        const x0 = -hw * ca, z0 = -hw * sa;
        const x1 =  hw * ca, z1 =  hw * sa;
        const y0 = yOffset, y1 = yOffset + h;
        positions.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0);
        // Slightly upward-biased normals so leaves & wheat catch overhead LED grow-lights evenly!
        for (let k = 0; k < 4; k++) normals.push(-sa * 0.35, 0.88, ca * 0.35);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
        vBase += 4;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      return geo;
    }

    // Build all instanced 3D alpha-cutout botanical crops with zero FPS overhead!
    const dummy = new THREE.Object3D();

    const vineLeafMat = new THREE.MeshStandardMaterial({
      map: textures.vineLeafAlpha,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02,
      emissive: '#17380d',
      emissiveIntensity: 0.28
    });
    const vineLeafInst = new THREE.InstancedMesh(
      buildCrossedCardGeo(1.55, 1.45, 3, -0.72),
      vineLeafMat,
      vineLeafSpots.length
    );
    vineLeafSpots.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.rotation.set((rnd() - 0.5) * 0.28, v.ry, (rnd() - 0.5) * 0.28);
      const sc = 0.85 + v.s * 0.65;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      vineLeafInst.setMatrixAt(i, dummy.matrix);
    });
    vineLeafInst.instanceMatrix.needsUpdate = true;
    g.add(vineLeafInst);

    const tomatoMat = new THREE.MeshPhysicalMaterial({
      color: '#dc2a1c',
      emissive: '#540e06',
      emissiveIntensity: 0.35,
      roughness: 0.16,
      clearcoat: 0.88,
      clearcoatRoughness: 0.10
    });
    // Multiply each tomato spot into natural 2-fruit vine clusters!
    const tomatoInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 8, 6), tomatoMat, tomatoSpots.length * 2);
    tomatoSpots.forEach((tm, i) => {
      const r1 = tm.s * 0.78;
      dummy.position.set(tm.x, tm.y, tm.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r1, r1 * 0.92, r1);
      dummy.updateMatrix();
      tomatoInst.setMatrixAt(i * 2, dummy.matrix);

      const r2 = r1 * 0.86;
      dummy.position.set(tm.x + (rnd() - 0.5) * 0.14, tm.y - 0.11, tm.z + (rnd() - 0.5) * 0.16);
      dummy.scale.set(r2, r2 * 0.92, r2);
      dummy.updateMatrix();
      tomatoInst.setMatrixAt(i * 2 + 1, dummy.matrix);
    });
    tomatoInst.instanceMatrix.needsUpdate = true;
    g.add(tomatoInst);

    const potatoMat = new THREE.MeshStandardMaterial({
      color: '#c89452',
      normalMap: textures.rockNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.88,
      metalness: 0.03
    });
    const potatoInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.0, 1), potatoMat, potatoSpots.length);
    potatoSpots.forEach((pt, i) => {
      dummy.position.set(pt.x, pt.y, pt.z);
      dummy.rotation.set(0.3, pt.ry, 0.2);
      dummy.scale.set(pt.s * 1.18, pt.s * 0.72, pt.s * 0.88);
      dummy.updateMatrix();
      potatoInst.setMatrixAt(i, dummy.matrix);
    });
    potatoInst.instanceMatrix.needsUpdate = true;
    g.add(potatoInst);

    const saladLeafMat = new THREE.MeshStandardMaterial({
      map: textures.saladLeafAlpha,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02,
      emissive: '#183c10',
      emissiveIntensity: 0.28
    });
    const saladInst = new THREE.InstancedMesh(
      buildCrossedCardGeo(1.05, 0.78, 3, -0.1),
      saladLeafMat,
      saladSpots.length
    );
    saladSpots.forEach((sl, i) => {
      dummy.position.set(sl.x, sl.y - 0.14, sl.z);
      dummy.rotation.set(0, sl.ry, 0);
      const sc = 0.88 + sl.s * 0.55;
      dummy.scale.set(sc, sc * 0.85, sc);
      dummy.updateMatrix();
      saladInst.setMatrixAt(i, dummy.matrix);
    });
    saladInst.instanceMatrix.needsUpdate = true;
    g.add(saladInst);

    const wheatSheafMat = new THREE.MeshStandardMaterial({
      map: textures.wheatSheafAlpha,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.68,
      metalness: 0.04,
      emissive: '#4f3509',
      emissiveIntensity: 0.30
    });
    const wheatInst = new THREE.InstancedMesh(
      buildCrossedCardGeo(1.02, 1.48, 2, 0.0),
      wheatSheafMat,
      wheatSpots.length
    );
    wheatSpots.forEach((wh, i) => {
      dummy.position.set(wh.x, wh.y - 0.58, wh.z);
      dummy.rotation.set(wh.leanX * 0.6, i * 0.95, wh.leanZ * 0.6);
      dummy.scale.set(1.0, wh.h * 0.92, 1.0);
      dummy.updateMatrix();
      wheatInst.setMatrixAt(i, dummy.matrix);
    });
    wheatInst.instanceMatrix.needsUpdate = true;
    g.add(wheatInst);

    // Overhead Industrial Light-Gantry Rails & 16 Suspended Rectangular Warm-Amber LED Grow-Lights (Scene 09!)
    const ledFaceMat = new THREE.MeshBasicMaterial({ color: '#ffd580' });
    for (const gx of [-5.8, 5.8]) {
      const sign = gx < 0 ? -1 : 1;
      const postX = gx + sign * 1.48; // Tuck gantry support columns cleanly to outer bed edge so aisle & bots stay clear!
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 58), darkSteel);
      rail.position.set(gx, floorY + 5.65, 0);
      g.add(rail);
      for (const pz of [-26, -12, 12, 26]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 5.65, 6), darkSteel);
        col.position.set(postX, floorY + 2.82, pz);
        g.add(col);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.16, 0.16), darkSteel);
        arm.position.set((gx + postX) * 0.5, floorY + 5.65, pz);
        g.add(arm);
      }
      for (const lz of [-24, -18, -12, -6, 6, 12, 18, 24]) {
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 1.35), darkSteel);
        hood.position.set(gx, floorY + 4.95, lz);
        g.add(hood);
        const ledPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.12), ledFaceMat);
        ledPanel.rotation.x = Math.PI / 2;
        ledPanel.position.set(gx, floorY + 4.82, lz);
        g.add(ledPanel);
        for (const cx2 of [-0.72, 0.72]) {
          const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 5), pipeMat);
          chain.position.set(gx + cx2, floorY + 5.32, lz);
          g.add(chain);
        }
      }
    }

    // Lush Perimeter Martian Orchard Trees ringing outer curved glass wall
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      if (Math.abs(Math.cos(a)) < 0.22 || Math.abs(Math.sin(a)) < 0.22) continue;
      const dist = radius * 0.74;
      const planterRing = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 0.75, 10), troughMat);
      planterRing.position.set(Math.cos(a) * dist, floorY + 0.37, Math.sin(a) * dist);
      g.add(planterRing);
      const tree = buildPottedMarsTree(treeTrunkMat, orchardLeafMat, orchardDarkLeafMat, textures);
      tree.scale.setScalar(2.45);
      tree.position.set(Math.cos(a) * dist, floorY + 0.65, Math.sin(a) * dist);
      tree.rotation.y = a;
      g.add(tree);
    }

    // 4 Articulated Tesla Optimus Gen-3 Farm Robots tending the Bio-Dome (exact Scene 09 cast!)
    const botPlacements = [
      { x: 2.15,  z: 14.5,  rotY: -1.15, phase: 0.0 },  // Foreground Hero Optimus tending right leafy bed!
      { x: 3.15,  z: -6.5,  rotY: -1.45, phase: 1.6 },
      { x: -2.25, z: -13.5, rotY:  1.25, phase: 3.1 },
      { x: 8.6,   z: 10.0,  rotY:  0.85, phase: 4.5 }
    ];
    botPlacements.forEach((bp) => {
      const unit = buildOptimusUnit(textures);
      unit.bot.position.set(bp.x, floorY + 0.06, bp.z);
      unit.bot.rotation.y = bp.rotY;
      g.add(unit.bot);
      animBots.push({ ...unit, phase: bp.phase });
    });

    // 4 Stylized Mars Agronomist Settlers (harvesting potatoes, checking tablet, strolling toward airlock!)
    const farmerHarvest = buildMarsAgronomist('harvest');
    farmerHarvest.position.set(-2.75, floorY + 0.06, 21.8);
    farmerHarvest.rotation.y = -1.38;
    g.add(farmerHarvest);

    const farmerTablet = buildMarsAgronomist('tablet');
    farmerTablet.position.set(-2.55, floorY + 0.06, 16.5);
    farmerTablet.rotation.y = -1.1;
    g.add(farmerTablet);

    const colonistA = buildMarsAgronomist('walk');
    colonistA.position.set(-0.75, floorY + 0.06, -18.5);
    colonistA.rotation.y = Math.PI;
    g.add(colonistA);

    const colonistB = buildMarsAgronomist('walk');
    colonistB.position.set(0.65, floorY + 0.06, -20.2);
    colonistB.rotation.y = Math.PI + 0.15;
    g.add(colonistB);

    // Warm sunlit horticultural lighting pools down the Bio-Dome aisle
    for (const lz of [-18, 0, 18]) {
      const aisleLight = new THREE.PointLight('#ffd58a', 68, 46, 1.4);
      aisleLight.position.set(0, floorY + 7.5, lz);
      g.add(aisleLight);
    }

  // =========================================================================
  // ARCHETYPE B: VERTICAL AEROPONIC PINK/GREEN LED HYDRO-TOWER DOME (Mars City Render!)
  // =========================================================================
  } else if (variant === 'hydrotower') {
    const emeraldGlow = new THREE.MeshBasicMaterial({ color: '#4ade80' });
    const magentaGlow = new THREE.MeshBasicMaterial({ color: '#e879f9' });
    const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.52, metalness: 0.30 });
    const towerSpecs = [
      { x: 0, z: 0, r: 4.2, h: radius * 0.72, mode: 'mixed' },
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.25;
        return {
          x: Math.cos(a) * (radius * 0.48),
          z: Math.sin(a) * (radius * 0.48),
          r: 3.1,
          h: radius * (0.50 + (i % 2) * 0.10),
          mode: i % 2 === 0 ? 'emerald' : 'magenta',
          angle: a
        };
      })
    ];

    // Grated service deck ring, elevated annular inspection bridge & radial nutrient walkways
    const serviceFloor = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.90, 28), deckMat);
    serviceFloor.rotation.x = -Math.PI / 2;
    serviceFloor.position.y = floorY + 0.05;
    g.add(serviceFloor);

    const midBridgeRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.28, 0.85, 6, 30), deckMat);
    midBridgeRing.rotation.x = Math.PI / 2;
    midBridgeRing.scale.set(1, 1, 0.22);
    midBridgeRing.position.y = floorY + 8.5;
    g.add(midBridgeRing);
    const bridgeRail = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.28 + 0.75, 0.06, 5, 30), hazardMat);
    bridgeRail.rotation.x = Math.PI / 2;
    bridgeRail.position.y = floorY + 9.5;
    g.add(bridgeRail);

    towerSpecs.forEach((tw, idx) => {
      // Heavy nutrient reservoir base sump & stainless vertical guide rails
      const sump = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 1.12, tw.r * 1.20, 1.35, 12), darkSteel);
      sump.position.set(tw.x, floorY + 0.68, tw.z);
      g.add(sump);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 0.50, tw.r * 0.58, tw.h, 12), darkSteel);
      core.position.set(tw.x, floorY + tw.h * 0.5, tw.z);
      g.add(core);
      for (let st = 0; st < 4; st++) {
        const sa = (st / 4) * Math.PI * 2;
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, tw.h + 0.8, 6), trussMat);
        strut.position.set(tw.x + Math.cos(sa) * (tw.r * 1.04), floorY + tw.h * 0.5 + 0.4, tw.z + Math.sin(sa) * (tw.r * 1.04));
        g.add(strut);
      }

      const tiers = Math.floor(tw.h / 2.45);
      for (let ti = 0; ti < tiers; ti++) {
        const ty = floorY + 1.85 + ti * 2.38;
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 1.02, tw.r * 0.90, 0.42, 12), trussMat);
        tray.position.set(tw.x, ty, tw.z);
        g.add(tray);

        const isMag = tw.mode === 'magenta' || (tw.mode === 'mixed' && ti % 2 === 1);
        const foliage = new THREE.Mesh(
          new THREE.CylinderGeometry(tw.r * 0.94, tw.r * 0.88, 0.72, 12),
          isMag ? greenBedMat : orchardLeafMat
        );
        foliage.position.set(tw.x, ty + 0.56, tw.z);
        g.add(foliage);

        const ledRing = new THREE.Mesh(
          new THREE.TorusGeometry(tw.r * 1.04, 0.13, 6, 18),
          isMag ? magentaGlow : emeraldGlow
        );
        ledRing.rotation.x = Math.PI / 2;
        ledRing.position.set(tw.x, ty + 1.24, tw.z);
        g.add(ledRing);
      }

      // Stainless nutrient distribution header crown + overhead feed pipe linking outer towers to central core!
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(tw.r * 0.75, tw.r * 1.06, 1.05, 12), trussMat);
      cap.position.set(tw.x, floorY + tw.h + 0.45, tw.z);
      g.add(cap);
      if (idx > 0) {
        const bridgeSpan = radius * 0.44;
        const radialBridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, bridgeSpan), deckMat);
        radialBridge.position.set(tw.x * 0.5, floorY + 8.5, tw.z * 0.5);
        radialBridge.rotation.y = Math.atan2(tw.x, tw.z);
        g.add(radialBridge);
        const feedPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, bridgeSpan, 8), trussMat);
        feedPipe.rotation.x = Math.PI / 2;
        feedPipe.position.set(tw.x * 0.5, floorY + 2.2, tw.z * 0.5);
        feedPipe.rotation.y = Math.atan2(tw.x, tw.z);
        g.add(feedPipe);
      }
    });

    const greenL = new THREE.PointLight('#6ee7b7', radius * 4.2, radius * 2.6, 1.4);
    greenL.position.set(-8, radius * 0.45, 6);
    g.add(greenL);
    const magL = new THREE.PointLight('#e879f9', radius * 3.8, radius * 2.5, 1.4);
    magL.position.set(8, radius * 0.45, -6);
    g.add(magL);

  // =========================================================================
  // ARCHETYPE C: GOLDEN CIVIC HABITAT & ATRIUM PLAZA DOME (Mars City Grand Render!)
  // =========================================================================
  } else if (variant === 'habitat') {
    const habWallMat = new THREE.MeshStandardMaterial({
      color: '#b4bcc5',
      map: textures.ribSteelColor,
      normalMap: textures.ribSteelNormal,
      roughness: 0.46,
      metalness: 0.68
    });
    const warmWinMat = new THREE.MeshBasicMaterial({ color: '#ffd68c' });

    // Central landscaped terraced civic park + brushed-basalt fountain ring + radial plaza paths
    const parkCurb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.38, radius * 0.40, 0.45, 24), concreteMat);
    parkCurb.position.y = floorY + 0.22;
    g.add(parkCurb);
    const parkGrass = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.36, 24), greenBedMat);
    parkGrass.rotation.x = -Math.PI / 2;
    parkGrass.position.y = floorY + 0.46;
    g.add(parkGrass);
    const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.4, 0.9, 16), darkSteel);
    fountainBasin.position.y = floorY + 0.85;
    g.add(fountainBasin);
    const fountainWater = new THREE.Mesh(new THREE.CircleGeometry(3.4, 16), new THREE.MeshPhysicalMaterial({ color: '#45b8cc', roughness: 0.08, metalness: 0.2, clearcoat: 1.0 }));
    fountainWater.rotation.x = -Math.PI / 2;
    fountainWater.position.y = floorY + 1.32;
    g.add(fountainWater);

    // Elevated Circular Pedestrian Sky-Ring Mezzanine with double safety rail & radial sky-bridges!
    const skyRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.44, 1.35, 8, 32), deckMat);
    skyRing.rotation.x = Math.PI / 2;
    skyRing.scale.set(1, 1, 0.35);
    skyRing.position.y = floorY + 6.4;
    g.add(skyRing);
    const skyRingGlow = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.40, 0.12, 6, 32), amberGlowMat);
    skyRingGlow.rotation.x = Math.PI / 2;
    skyRingGlow.position.y = floorY + 6.95;
    g.add(skyRingGlow);
    const skyRingRail = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.44 + 1.15, 0.06, 6, 32), trussMat);
    skyRingRail.rotation.x = Math.PI / 2;
    skyRingRail.position.y = floorY + 7.45;
    g.add(skyRingRail);

    // 6 Multi-Story Terraced Golden-Lit Colony Residential & Civic Pavilion Blocks with Balconies & Mullions!
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const dist = radius * 0.64;
      const stories = 2 + (i % 3);
      const bH = stories * 3.8;
      const bW = radius * 0.34;
      const bD = radius * 0.22;

      const bldg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), habWallMat);
      body.position.y = bH * 0.5;
      body.castShadow = true;
      bldg.add(body);

      const roofRim = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.9, 0.55, bD + 0.9), darkSteel);
      roofRim.position.y = bH + 0.26;
      bldg.add(roofRim);

      // Rooftop compact mechanical HVAC penthouse
      const hvac = buildIndustrialHvacUnit(2.4, 0.9, 1.6, habWallMat, darkSteel, trussMat);
      hvac.position.set(0, bH + 0.52, 0);
      bldg.add(hvac);

      // Mullioned recessed panoramic residential windows + cantilevered balcony decks per floor!
      for (let st = 0; st < stories; st++) {
        const wy = 2.0 + st * 3.8;
        const winFront = new THREE.Mesh(new THREE.BoxGeometry(bW - 1.4, 1.65, bD + 0.12), warmWinMat);
        winFront.position.y = wy;
        bldg.add(winFront);
        // Cantilevered balcony slab + railing bar
        const balc = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.5, 0.22, bD + 1.45), darkSteel);
        balc.position.y = wy - 0.98;
        bldg.add(balc);
      }
      // Architectural vertical steel brise-soleil facade mullions breaking up flat yellow ribbons!
      for (let m = -3; m <= 3; m++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, bH, bD + 0.34), darkSteel);
        fin.position.set(m * (bW * 0.145), bH * 0.5, 0);
        bldg.add(fin);
      }

      bldg.position.set(Math.cos(a) * dist, floorY, Math.sin(a) * dist);
      bldg.rotation.y = -a + Math.PI / 2;
      g.add(bldg);

      // Fluted mezzanine support pier + hooded atrium park lamp + lush branching Mars orchard tree
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 6.4, 8), darkSteel);
      pier.position.set(Math.cos(a) * (radius * 0.44), floorY + 3.2, Math.sin(a) * (radius * 0.44));
      g.add(pier);

      const tree = buildPottedMarsTree(treeTrunkMat, orchardLeafMat, orchardDarkLeafMat, textures);
      tree.scale.setScalar(2.35);
      tree.position.set(Math.cos(a + 0.3) * (radius * 0.24), floorY + 0.45, Math.sin(a + 0.3) * (radius * 0.24));
      g.add(tree);
    }

    const habGlow = new THREE.PointLight('#ffce7a', radius * 6.0, radius * 2.8, 1.4);
    habGlow.position.set(0, radius * 0.38, 0);
    g.add(habGlow);

  // =========================================================================
  // ARCHETYPE D: GRAND MULTI-TIER BOTANICAL ARBORETUM HUB (Scene 03!)
  // =========================================================================
  } else {
    // 3 Concentric Stepped Circular Botanical Terraces + Brushed-Steel Promenade Rings!
    for (let tier = 0; tier < 3; tier++) {
      const tRad = radius * (0.84 - tier * 0.22);
      const tY = floorY + 0.5 + tier * 3.4;
      const terraceSlab = new THREE.Mesh(new THREE.CylinderGeometry(tRad, tRad + 0.8, 0.55, 28), concreteMat);
      terraceSlab.position.y = tY;
      g.add(terraceSlab);
      const terraceRim = new THREE.Mesh(new THREE.TorusGeometry(tRad, 0.14, 6, 28), trussMat);
      terraceRim.rotation.x = Math.PI / 2;
      terraceRim.position.y = tY + 1.05;
      g.add(terraceRim);
      const cropRing = new THREE.Mesh(
        new THREE.CylinderGeometry(tRad - 1.2, tRad - 1.0, 0.95, 24),
        tier === 1 ? wheatBedMat : greenBedMat
      );
      cropRing.position.y = tY + 0.65;
      g.add(cropRing);
      const growHalo = new THREE.Mesh(new THREE.TorusGeometry(tRad - 2.6, 0.22, 6, 28), lampStripMat);
      growHalo.rotation.x = Math.PI / 2;
      growHalo.position.y = tY + 3.2;
      g.add(growHalo);
    }

    // Central Architectural Glass-and-Steel Arboretum Core Spire + 6 Hanging Vertical Vine Towers!
    const atriumSpire = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.8, radius * 0.72, 12), darkSteel);
    atriumSpire.position.y = floorY + radius * 0.36;
    g.add(atriumSpire);
    for (let sr = 0; sr < 4; sr++) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(2.6 - sr * 0.2, 0.18, 6, 16), trussMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = floorY + 6 + sr * 6.5;
      g.add(collar);
    }
    const atriumRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.24, 0.38, 6, 24), lampStripMat);
    atriumRing.rotation.x = Math.PI / 2;
    atriumRing.position.y = floorY + radius * 0.44;
    g.add(atriumRing);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dist = radius * 0.36;
      const towerH = radius * 0.46;
      const spireFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, towerH, 8), trussMat);
      spireFrame.position.set(Math.cos(a) * dist, floorY + towerH * 0.5 + 3.8, Math.sin(a) * dist);
      g.add(spireFrame);
      for (let ti = 0; ti < 4; ti++) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.50, 1.4, 10), ti % 2 === 0 ? greenBedMat : orchardLeafMat);
        pod.position.set(Math.cos(a) * dist, floorY + 6.5 + ti * 4.2, Math.sin(a) * dist);
        g.add(pod);
      }
      const halo = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.16, 6, 14), lampStripMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(Math.cos(a) * dist, floorY + towerH + 4.0, Math.sin(a) * dist);
      g.add(halo);

      const ta = a + Math.PI / 6;
      const tx = Math.cos(ta) * (radius * 0.58);
      const tz = Math.sin(ta) * (radius * 0.58);
      const tree = buildPottedMarsTree(treeTrunkMat, orchardLeafMat, orchardDarkLeafMat, textures);
      tree.scale.setScalar(2.8);
      tree.position.set(tx, floorY + 4.0, tz);
      g.add(tree);
    }

    const glow = new THREE.PointLight('#ffd280', radius * 5.2, radius * 2.7, 1.45);
    glow.position.set(0, radius * 0.40, 0);
    g.add(glow);
  }

  // =========================================================================
  // SHARED CRYSTAL-CLEAR GEODESIC ETFE GLAZING + 3D ARCH RIBS + LOUVERED APEX CUPOLA
  // =========================================================================
  const domeGeo = new THREE.SphereGeometry(radius, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const glassMat = enhancePressurizedGlassMaterial(new THREE.MeshStandardMaterial({
    color: '#dce8e4',
    roughness: 0.16,
    metalness: 0.14,
    transparent: true,
    opacity: variant === 'farm' ? 0.15 : 0.22,
    depthWrite: false,
    side: THREE.DoubleSide
  }), { mode: 'biodome', radius });
  const glass = new THREE.Mesh(domeGeo, glassMat);
  g.add(glass);

  // Complete triangulated geodesic wireframe cage
  const ico = new THREE.IcosahedronGeometry(radius * 1.004, 3);
  const wire = new THREE.WireframeGeometry(ico);
  const wPos = wire.attributes.position;
  const kept = [];
  for (let i = 0; i < wPos.count; i += 2) {
    const y0 = wPos.getY(i), y1 = wPos.getY(i + 1);
    if (y0 >= -0.8 && y1 >= -0.8) {
      kept.push(
        wPos.getX(i), Math.max(0.2, y0), wPos.getZ(i),
        wPos.getX(i + 1), Math.max(0.2, y1), wPos.getZ(i + 1)
      );
    }
  }
  const trussGeo = new THREE.BufferGeometry();
  trussGeo.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  const trussLines = new THREE.LineSegments(
    trussGeo,
    new THREE.LineBasicMaterial({ color: '#dae2ea', transparent: true, opacity: variant === 'farm' ? 0.18 : 0.64 })
  );
  g.add(trussLines);

  // 3D Structural Meridian Arches + Horizontal Latitude Pressure Rings + Multi-Tiered Apex Pressure Vent Cupola!
  const meridianCount = variant === 'farm' ? 10 : 6;
  for (let m = 0; m < meridianCount; m++) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.005, radius * 0.011, 6, 36, Math.PI),
      trussMat
    );
    arch.rotation.y = (m / meridianCount) * Math.PI;
    g.add(arch);
  }
  for (const elev of [0.24, 0.50, 0.74, 0.90]) {
    const rLat = Math.sqrt(1 - elev * elev) * radius * 1.005;
    const latRing = new THREE.Mesh(new THREE.TorusGeometry(rLat, radius * 0.009, 6, 40), trussMat);
    latRing.rotation.x = Math.PI / 2;
    latRing.position.y = elev * radius;
    g.add(latRing);
  }
  const apexBase = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.11, radius * 0.145, radius * 0.045, 16), darkSteel);
  apexBase.position.y = radius * 0.995;
  g.add(apexBase);
  const apexHub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.08, radius * 0.105, radius * 0.045, 16), trussMat);
  apexHub.position.y = radius * 1.032;
  g.add(apexHub);
  const apexSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, radius * 0.12, 8), trussMat);
  apexSpire.position.y = radius * 1.095;
  g.add(apexSpire);
  const apexBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), amberGlowMat);
  apexBeacon.position.y = radius * 1.158;
  g.add(apexBeacon);

  return { group: g, animBots };
}

/**
 * Regolith-Bermed Radiation-Shielded Habitat Dome (3D-Printed Sintered Basalt & Compacted Ochre Regolith!):
 * Sculpted horizontal 3D-printed sintering strata, bolted tension hold-down anchors, armored trapezoidal
 * airlock vestibules with recessed mullioned glass doors & cantilevered entry awnings, dual-fan industrial
 * HVAC scrubbers, and parabolic Starlink-Mars comm array + aviation strobe!
 */
function buildRegolithDome(radius, height, textures) {
  const g = new THREE.Group();

  const soilGeo = new THREE.SphereGeometry(radius, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.5);
  soilGeo.scale(1, height / radius, 1);
  const pos = soilGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    // Authentic horizontal 3D-printed sintered basalt layering strata
    const strata = Math.sin(vy * 3.0) * 0.22 + Math.sin(Math.atan2(vz, vx) * 12) * 0.10;
    const rFactor = 1.0 + (strata / Math.max(4, radius)) * Math.sin((vy / height) * Math.PI);
    pos.setXYZ(i, vx * rFactor, vy, vz * rFactor);
  }
  soilGeo.computeVertexNormals();

  const soilMat = new THREE.MeshStandardMaterial({
    color: '#9e5d3c',
    map: textures.basaltColor,
    normalMap: textures.marsNormal,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: textures.marsRough,
    roughness: 0.96,
    metalness: 0.03,
    envMapIntensity: 0.12
  });
  const mound = new THREE.Mesh(soilGeo, soilMat);
  mound.castShadow = true;
  mound.receiveShadow = true;
  g.add(mound);

  const crownMat = new THREE.MeshStandardMaterial({
    color: '#8f98a3',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughnessMap: textures.ribSteelRough,
    roughness: 0.44,
    metalness: 0.82
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: '#343a44',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.80
  });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.56, metalness: 0.28 });
  const warmWinMat = new THREE.MeshBasicMaterial({ color: '#ffca7a' });
  const redStrobeMat = new THREE.MeshBasicMaterial({ color: '#ff4232' });

  // Heavy Sintered Basalt Base Retention Collar + 12 Bolted Hold-Down Anchor Buttresses + 6 Arch Compression Ribs!
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.99, 0.82, 8, 36), darkMetal);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.62;
  g.add(baseRing);

  for (let p = 0; p < 12; p++) {
    const a = (p / 12) * Math.PI * 2;
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.2, 1.85), darkMetal);
    anchor.position.set(Math.cos(a) * (radius * 1.005), 1.1, Math.sin(a) * (radius * 1.005));
    anchor.rotation.y = -a + Math.PI / 2;
    g.add(anchor);
  }
  for (let r = 0; r < 6; r++) {
    const a = (r / 6) * Math.PI;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.006, 0.30, 6, 28, Math.PI), darkMetal);
    rib.scale.set(1, height / radius, 1);
    rib.rotation.y = a;
    g.add(rib);
  }

  // Multi-Tier Apex Pressurized Scrubber Cupola + Parabolic Comms Dish + Aviation Obstruction Beacon
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.19, radius * 0.24, 1.5, 16), darkMetal);
  crownBase.position.y = height - 0.55;
  g.add(crownBase);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.14, radius * 0.18, 2.2, 16), crownMat);
  crown.position.y = height + 0.65;
  g.add(crown);
  const crownCap = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.15, 0.22, 6, 18), darkMetal);
  crownCap.rotation.x = Math.PI / 2;
  crownCap.position.y = height + 1.65;
  g.add(crownCap);
  const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 5.2, 8), darkMetal);
  antMast.position.set(radius * 0.06, height + 3.2, 0);
  g.add(antMast);
  const antBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), redStrobeMat);
  antBeacon.position.set(radius * 0.06, height + 5.9, 0);
  g.add(antBeacon);
  // True parabolic Lathe comms dish + feed horn!
  const dishPts = [new THREE.Vector2(0.05, 0), new THREE.Vector2(0.45, 0.08), new THREE.Vector2(0.95, 0.28), new THREE.Vector2(1.32, 0.56)];
  const dishG = new THREE.Group();
  dishG.position.set(radius * 0.06, height + 4.35, 0.35);
  dishG.rotation.x = 0.65;
  const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 16), crownMat);
  dishG.add(dish);
  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 6), darkMetal);
  feedHorn.position.y = 0.42;
  dishG.add(feedHorn);
  g.add(dishG);

  // Heavy Bolted Armored Entry Airlock Vestibules + Recessed Mullioned Viewports + Entry Awnings + Dual-Fan HVAC!
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const isPorch = i % 2 === 0;
    const vg = new THREE.Group();
    vg.position.set(Math.cos(a) * (radius * 0.94), 0, Math.sin(a) * (radius * 0.94));
    vg.rotation.y = -a + Math.PI / 2;

    const vw = radius * (isPorch ? 0.26 : 0.21);
    const vh = isPorch ? 4.6 : 3.6;
    const vd = isPorch ? 5.8 : 4.0;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(vw, vh, vd), crownMat);
    collar.position.y = vh * 0.5 + 0.2;
    collar.castShadow = true;
    vg.add(collar);
    // Heavy chamfered perimeter blast frame & cantilevered rain/dust hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(vw + 0.8, 0.36, 1.45), darkMetal);
    hood.position.set(0, vh + 0.15, vd * 0.5 + 0.45);
    vg.add(hood);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(vw * 0.72, 1.85, 0.28), darkMetal);
    frame.position.set(0, 2.55, vd * 0.5 + 0.05);
    vg.add(frame);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(vw * 0.62, 1.45), warmWinMat);
    win.position.set(0, 2.55, vd * 0.5 + 0.22);
    vg.add(win);
    // Crisp dark steel mullions across viewport so it reads as real recessed cabin glazing!
    for (const mx of [-vw * 0.16, vw * 0.16]) {
      const mul = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.55, 0.10), darkMetal);
      mul.position.set(mx, 2.55, vd * 0.5 + 0.24);
      vg.add(mul);
    }

    if (isPorch) {
      const header = new THREE.Mesh(new THREE.BoxGeometry(vw * 0.92, 0.28, 0.28), hazardMat);
      header.position.set(0, vh - 0.18, vd * 0.5 + 0.16);
      vg.add(header);
      const step = new THREE.Mesh(new THREE.BoxGeometry(vw * 0.85, 0.32, 1.35), darkMetal);
      step.position.set(0, 0.16, vd * 0.5 + 0.75);
      vg.add(step);
      const hvac = buildIndustrialHvacUnit(2.8, 1.15, 2.0, crownMat, darkMetal, hazardMat);
      hvac.position.set(0, vh + 0.2, -0.35);
      vg.add(hvac);
    }
    g.add(vg);
  }

  return g;
}

/**
 * High-Detail Pressurized Inter-Dome Transit Corridor:
 *  - Ribbed 30X stainless pressurized tube + bolted bellows expansion collars
 *  - Terrain-grounded basalt-and-steel saddle support piers anchored cleanly into Mars ground (NEVER floating!)
 *  - Chamfered framed armored promenade viewports with dark steel mullions
 *  - Twin insulated external cryogenic/life-support conduit pipes + top grated catwalk!
 */
function buildPressurizedTube(p1, p2, radius, textures) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const dirNorm = dir.clone().normalize();
  const sideAxis = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x).normalize();

  const steelMat = new THREE.MeshStandardMaterial({
    color: '#ced4db',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: textures.steelRough,
    roughness: 0.34,
    metalness: 0.88
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: '#3c424c',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.48,
    metalness: 0.82
  });
  const pierMat = new THREE.MeshStandardMaterial({
    color: '#6b5c52',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    roughness: 0.90,
    metalness: 0.08
  });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.54, metalness: 0.28 });
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffd38a' });

  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 18), steelMat);
  cyl.position.copy(mid);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirNorm);
  cyl.castShadow = true;
  cyl.receiveShadow = true;
  g.add(cyl);

  // Twin exterior insulated life-support / cryo conduit pipes flanking lower quarters + top catwalk rail!
  for (const s of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, len, 8), ribMat);
    pipe.position.copy(mid).addScaledVector(sideAxis, s * (radius + 0.34));
    pipe.position.y -= radius * 0.48;
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirNorm);
    g.add(pipe);
  }
  const topWalk = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, len * 0.94), ribMat);
  topWalk.position.copy(mid);
  topWalk.position.y += radius + 0.14;
  topWalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
  g.add(topWalk);

  const ribCount = Math.max(2, Math.floor(len / 8));
  for (let i = 1; i < ribCount; i++) {
    const t = i / ribCount;
    const rp = new THREE.Vector3().lerpVectors(p1, p2, t);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.07, 0.34, 6, 18), ribMat);
    rib.position.copy(rp);
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
    g.add(rib);

    // Terrain-grounded saddle support pier every 2nd rib so tube is structurally anchored to Mars terrain!
    if (i % 2 === 1) {
      const groundY = getTerrainHeight(rp.x, rp.z);
      const pierH = Math.max(1.5, rp.y - radius * 0.72 - groundY + 1.2);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.75, pierH, 1.35), pierMat);
      saddle.position.set(rp.x, groundY + pierH * 0.5 - 0.6, rp.z);
      saddle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
      saddle.castShadow = true;
      g.add(saddle);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.95, 0.42, 1.55), ribMat);
      collar.position.set(rp.x, rp.y - radius * 0.78, rp.z);
      collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
      g.add(collar);
    }

    // Framed armored promenade viewport with dark mullions between ribs!
    if (i < ribCount - 1) {
      const wp = new THREE.Vector3().lerpVectors(p1, p2, (i + 0.5) / ribCount);
      const vpLen = Math.min(4.2, len / ribCount - 2.2);
      for (const s of [-1, 1]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.08, vpLen + 0.38), ribMat);
        frame.position.copy(wp).addScaledVector(sideAxis, s * (radius * 0.96));
        frame.position.y += 0.55;
        frame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
        g.add(frame);
        const vp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.76, vpLen), winMat);
        vp.position.copy(wp).addScaledVector(sideAxis, s * (radius * 1.02));
        vp.position.y += 0.55;
        vp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
        g.add(vp);
        const midMul = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.14), ribMat);
        midMul.position.copy(wp).addScaledVector(sideAxis, s * (radius * 1.01));
        midMul.position.y += 0.55;
        midMul.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirNorm);
        g.add(midMul);
      }
    }
  }
  return g;
}

/**
 * Hero Walkable Interior: Founder's Overlook Pressurized Glass Skybridge & Café Lounge (Scene 01 + 06 Extreme Detail!)
 *  - Sweeping curved arched pressure ribs curving cleanly from north knee-wall over ceiling!
 *  - Warm glowing linear ceiling light strips + subtle cyan floor pressurization strip (Scene 01!)
 *  - Upholstered café bar stools, brass mushroom table lamps, brushed stainless mugs, & back-wall Mars Espresso Bar!
 *  - Branching multi-leaf Martian potted trees lining the promenade
 *  - Vault-style 3D segmented Airlock Pressure Door with locking handwheel & yellow-black threshold striping
 */
function buildObservationSkybridge(textures) {
  const g = new THREE.Group();
  const baseY = 18.0;
  const floorY = 19.2;
  const xMin = -16, xMax = 22, len = xMax - xMin;
  const zMin = 18, zMax = 28, width = zMax - zMin;
  const cx = (xMin + xMax) * 0.5;
  const cz = (zMin + zMax) * 0.5;

  const darkSteel = new THREE.MeshStandardMaterial({
    color: '#3c424c',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.ribSteelRough,
    roughness: 0.46,
    metalness: 0.84
  });
  const warmSteel = new THREE.MeshStandardMaterial({
    color: '#5b534d',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    roughnessMap: textures.basaltRough,
    roughness: 0.64,
    metalness: 0.55
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: '#d6b494',
    map: textures.woodColor,
    normalMap: textures.woodNormal,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: textures.woodRough,
    roughness: 0.60,
    metalness: 0.06
  });
  const leatherMat = new THREE.MeshStandardMaterial({ color: '#693c27', roughness: 0.65, metalness: 0.08 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#cfa154', roughness: 0.26, metalness: 0.88 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#d4dce4', roughness: 0.20, metalness: 0.94 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d49b34', roughness: 0.55, metalness: 0.28 });
  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.deckColor,
    normalMap: textures.deckNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: textures.deckRough,
    roughness: 0.62,
    metalness: 0.58
  });
  const glassMat = enhancePressurizedGlassMaterial(new THREE.MeshStandardMaterial({
    color: '#d4e2ea',
    roughness: 0.42,
    metalness: 0.05,
    envMapIntensity: 0.35,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide
  }), { mode: 'skybridge' });

  const ceilH = 7.4; // Grand sweeping double-height panoramic atrium framing full 100m Colossus!

  // Heavy foundation plinth under skybridge
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 3.2, width + 2), warmSteel);
  plinth.position.set(cx, baseY - 0.4, cz);
  plinth.receiveShadow = true;
  g.add(plinth);

  // Grated steel floor deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.28, width), deckMat);
  deck.position.set(cx, floorY - 0.14, cz);
  deck.receiveShadow = true;
  g.add(deck);

  // Warm wooden café boardwalk strip along panoramic north window
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(len - 2, 0.06, 3.0), timberMat);
  boardwalk.position.set(cx, floorY + 0.03, zMin + 1.9);
  boardwalk.receiveShadow = true;
  g.add(boardwalk);

  // Subtle recessed cyan pressurization guide strip along north knee-wall base (exact Scene 01 touch!)
  const cyanFloorStrip = new THREE.Mesh(
    new THREE.BoxGeometry(len - 1.2, 0.08, 0.10),
    new THREE.MeshBasicMaterial({ color: '#56d4e8' })
  );
  cyanFloorStrip.position.set(cx, floorY + 0.16, zMin + 0.24);
  g.add(cyanFloorStrip);

  // Solid insulated pressurized south wall (back) & arched outer roof canopy
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(len, ceilH, 0.55), darkSteel);
  backWall.position.set(cx, floorY + ceilH * 0.5, zMax);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  g.add(backWall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 1.2, 0.48, width - 1.2), darkSteel);
  roof.position.set(cx, floorY + ceilH + 0.18, cz + 0.7);
  roof.castShadow = true;
  g.add(roof);

  // Warm recessed linear tungsten ceiling light bars running down the gallery spine (Scene 01 & 06!)
  const ceilStripMat = new THREE.MeshBasicMaterial({ color: '#ffd38a' });
  for (const lz of [cz + 0.4, cz + 2.6]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len - 3.0, 0.08, 0.24), ceilStripMat);
    bar.position.set(cx, floorY + ceilH - 0.14, lz);
    g.add(bar);
  }

  // West bulkhead wall (sealed tunnel continuation)
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, ceilH, width), darkSteel);
  westWall.position.set(xMin, floorY + ceilH * 0.5, cz);
  g.add(westWall);

  // East bulkhead wall framing the 3D VAULT-STYLE SEGMENTED AIRLOCK PRESSURE DOOR (Scene 01!)
  const eastLeft = new THREE.Mesh(new THREE.BoxGeometry(0.65, ceilH, 3.2), darkSteel);
  eastLeft.position.set(xMax, floorY + ceilH * 0.5, zMin + 1.6);
  g.add(eastLeft);
  const eastRight = new THREE.Mesh(new THREE.BoxGeometry(0.65, ceilH, 3.2), darkSteel);
  eastRight.position.set(xMax, floorY + ceilH * 0.5, zMax - 1.6);
  g.add(eastRight);
  const eastTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, ceilH - 3.6, 3.6), darkSteel);
  eastTop.position.set(xMax, floorY + 3.6 + (ceilH - 3.6) * 0.5, cz);
  g.add(eastTop);

  // Heavy chamfered industrial airlock surround collar + hazard floor threshold
  const airlockCollar = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.24, 8, 8), warmSteel);
  airlockCollar.rotation.y = Math.PI / 2;
  airlockCollar.rotation.x = Math.PI / 8;
  airlockCollar.position.set(xMax - 0.12, floorY + 1.85, cz);
  g.add(airlockCollar);
  const thresholdStrip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 3.4), hazardMat);
  thresholdStrip.position.set(xMax - 0.3, floorY + 0.03, cz);
  g.add(thresholdStrip);

  // Detailed 3D Vault Pressure Door Assembly (reinforced steel leaf + recessed viewport + 3D locking wheel!)
  const airlockDoor = new THREE.Group();
  const doorSlab = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 3.5, 3.4),
    new THREE.MeshStandardMaterial({ color: '#646d77', map: textures.steelColor, normalMap: textures.steelNormal, roughness: 0.36, metalness: 0.86 })
  );
  airlockDoor.add(doorSlab);
  // Horizontal blast reinforcement ribs across door
  for (const ry of [-1.05, 0.0, 1.05]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 3.2), darkSteel);
    rib.position.y = ry;
    airlockDoor.add(rib);
  }
  // Recessed circular porthole window & mechanical locking handwheel on inside face (-X)
  const portFrame = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 16), chromeMat);
  portFrame.rotation.y = Math.PI / 2;
  portFrame.position.set(-0.22, 0.62, 0);
  airlockDoor.add(portFrame);
  const lockWheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 16), hazardMat);
  lockWheel.rotation.y = Math.PI / 2;
  lockWheel.position.set(-0.28, -0.22, 0.55);
  airlockDoor.add(lockWheel);
  for (let sp = 0; sp < 4; sp++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.64, 6), hazardMat);
    spoke.rotation.x = (sp / 4) * Math.PI;
    spoke.position.set(-0.28, -0.22, 0.55);
    airlockDoor.add(spoke);
  }
  airlockDoor.position.set(xMax, floorY + 1.75, cz);
  g.add(airlockDoor);

  const airlockBeacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.30, 1.9),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  airlockBeacon.position.set(xMax, floorY + 3.92, cz);
  g.add(airlockBeacon);

  // Low knee wall + Continuous panoramic glazing on north vista wall
  const kneeWall = new THREE.Mesh(new THREE.BoxGeometry(len, 0.96, 0.42), darkSteel);
  kneeWall.position.set(cx, floorY + 0.48, zMin);
  g.add(kneeWall);

  const northGlass = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.4, ceilH - 1.0), glassMat);
  northGlass.position.set(cx, floorY + 0.96 + (ceilH - 1.0) * 0.5, zMin + 0.08);
  g.add(northGlass);

  // Clean high upper pressure transom mullion (above statue head sightline!)
  const midMullion = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.24), darkSteel);
  midMullion.position.set(cx, floorY + 5.95, zMin + 0.42);
  g.add(midMullion);

  // SWEEPING CURVED OVERHEAD STRUCTURAL PRESSURE ARCH RIBS (Exact Scene 01 & Scene 06 architecture!)
  const interiorLights = [];
  for (let x = xMin + 0.8; x <= xMax - 0.5; x += 6.8) {
    // Sweeping curved structural steel arch curving from north knee-wall up & back across atrium ceiling!
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, floorY + 0.15, zMin + 0.04),
      new THREE.Vector3(x, floorY + 2.8,  zMin - 0.04),
      new THREE.Vector3(x, floorY + 5.2,  zMin + 0.25),
      new THREE.Vector3(x, floorY + 6.75, zMin + 1.45),
      new THREE.Vector3(x, floorY + 7.22, cz - 0.5),
      new THREE.Vector3(x, floorY + 7.22, zMax - 0.1)
    ]);
    const archRib = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 18, 0.21, 8, false), darkSteel);
    archRib.castShadow = true;
    g.add(archRib);

    // Subtle warm recessed tungsten strip nestled along the upper curved window arch (Scene 06!)
    const ribLightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + 0.16, floorY + 5.1,  zMin + 0.34),
      new THREE.Vector3(x + 0.16, floorY + 6.58, zMin + 1.52),
      new THREE.Vector3(x + 0.16, floorY + 7.02, cz - 0.5)
    ]);
    const ribStrip = new THREE.Mesh(new THREE.TubeGeometry(ribLightCurve, 10, 0.045, 6, false), ceilStripMat);
    g.add(ribStrip);

    // Warm tungsten pendant lamp suspended inside cozy frontier gallery
    if (x + 3.4 < xMax - 1.5) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 6), darkSteel);
      cord.position.set(x + 3.4, floorY + ceilH - 0.95, cz - 0.6);
      g.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.24, 14, 1, true), brassMat);
      shade.position.set(x + 3.4, floorY + ceilH - 1.72, cz - 0.6);
      g.add(shade);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffcf7d' })
      );
      bulb.position.set(x + 3.4, floorY + ceilH - 1.82, cz - 0.6);
      g.add(bulb);
    }
  }

  // Soft warm tungsten interior point lights positioned back from glass so no glare orb appears!
  for (const lx of [-8, 3, 14]) {
    const pl = new THREE.PointLight('#ffbe6b', 18, 22, 1.6);
    pl.position.set(lx, floorY + 4.4, cz + 1.4);
    g.add(pl);
    interiorLights.push(pl);
  }

  // Timber Café Counter Rail + Brass Mushroom Lamps + Steel Mugs + Upholstered Bar Stools (Scene 06!)
  const counterRail = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 0.10, 0.68), timberMat);
  counterRail.position.set(cx, floorY + 1.08, zMin + 0.58);
  g.add(counterRail);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4230', roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3b7a2c', roughness: 0.76 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: '#29571e', roughness: 0.82 });

  for (let tx = -11; tx <= 15; tx += 6.5) {
    // Iconic Scene 06 Brass Mushroom Café Table Lamp!
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.05, 12), brassMat);
    lampBase.position.set(tx, floorY + 1.15, zMin + 0.54);
    g.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), brassMat);
    lampStem.position.set(tx, floorY + 1.33, zMin + 0.54);
    g.add(lampStem);
    const lampDome = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), brassMat);
    lampDome.position.set(tx, floorY + 1.46, zMin + 0.54);
    g.add(lampDome);
    const lampGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: '#ffd88a' })
    );
    lampGlow.position.set(tx, floorY + 1.44, zMin + 0.54);
    g.add(lampGlow);

    // Pair of brushed 30X steel Martian coffee mugs flanking each lamp
    for (const mx of [-0.46, 0.44]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.052, 0.125, 10), chromeMat);
      mug.position.set(tx + mx, floorY + 1.19, zMin + 0.64);
      g.add(mug);
    }

    // Pair of Upholstered Leather & Steel Café Bar Stools tucked under counter!
    for (const sx of [-1.05, 1.05]) {
      const stool = new THREE.Group();
      const sBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 12), darkSteel);
      sBase.position.y = 0.02;
      stool.add(sBase);
      const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.72, 8), chromeMat);
      sPost.position.y = 0.38;
      stool.add(sPost);
      const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 12), chromeMat);
      footRing.rotation.x = Math.PI / 2;
      footRing.position.y = 0.26;
      stool.add(footRing);
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.09, 14), leatherMat);
      cushion.position.y = 0.76;
      stool.add(cushion);
      const backRest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.06), leatherMat);
      backRest.position.set(0, 0.94, 0.18);
      stool.add(backRest);
      stool.position.set(tx + sx, floorY + 0.06, zMin + 1.32);
      g.add(stool);
    }

    // Lush Branching Martian Potted Trees along back promenade wall (exact Scene 01 & 06 living touch!)
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.86, 1.05), warmSteel);
    planter.position.set(tx + 1.9, floorY + 0.43, zMax - 1.15);
    g.add(planter);
    const planterRim = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 1.16), darkSteel);
    planterRim.position.set(tx + 1.9, floorY + 0.88, zMax - 1.15);
    g.add(planterRim);
    const tree = buildPottedMarsTree(trunkMat, leafMat, darkLeafMat, textures);
    tree.position.set(tx + 1.9, floorY + 0.80, zMax - 1.15);
    tree.rotation.y = tx * 0.7;
    g.add(tree);
  }

  // Back-Wall Mars Frontier Espresso & Hydroponic Bar Station (x = -12 .. -4)
  const barGroup = new THREE.Group();
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.05, 1.05), timberMat);
  barCounter.position.set(0, 0.525, 0);
  barGroup.add(barCounter);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(6.36, 0.08, 1.18), darkSteel);
  barTop.position.set(0, 1.08, 0);
  barGroup.add(barTop);
  // Chrome dual-group Mars pressure-compensated Espresso Machine + portafilters + steam wand + cup stack!
  const espBody = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.64, 0.66), chromeMat);
  espBody.position.set(-1.2, 1.44, 0.05);
  barGroup.add(espBody);
  const espDrip = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 0.24), darkSteel);
  espDrip.position.set(-1.2, 1.15, -0.34);
  barGroup.add(espDrip);
  for (const gx of [-1.52, -0.88]) {
    const grpHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.14, 10), brassMat);
    grpHead.position.set(gx, 1.38, -0.32);
    barGroup.add(grpHead);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 6), leatherMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(gx, 1.32, -0.46);
    barGroup.add(handle);
  }
  const espGauge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), new THREE.MeshBasicMaterial({ color: '#ffd98a' }));
  espGauge.rotation.x = Math.PI / 2;
  espGauge.position.set(-1.2, 1.54, -0.29);
  barGroup.add(espGauge);
  // Glass pastry/hydroponic herbal cloche + illuminated menu header on bar counter
  const clocheBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 14), timberMat);
  clocheBase.position.set(1.25, 1.16, -0.05);
  barGroup.add(clocheBase);
  const clocheDome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), glassMat);
  clocheDome.position.set(1.25, 1.20, -0.05);
  barGroup.add(clocheDome);
  // Warm backlit timber shelves mounted above espresso bar
  for (const sy of [2.1, 2.85]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.08, 0.42), timberMat);
    shelf.position.set(0, sy, 0.35);
    barGroup.add(shelf);
    const shelfLight = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.04, 0.08), ceilStripMat);
    shelfLight.position.set(0, sy - 0.05, 0.35);
    barGroup.add(shelfLight);
    for (let cx2 = -2.2; cx2 <= 2.2; cx2 += 0.88) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 8), cx2 > 0 ? brassMat : chromeMat);
      jar.position.set(cx2, sy + 0.20, 0.32);
      barGroup.add(jar);
    }
  }
  barGroup.position.set(-8.2, floorY, zMax - 1.0);
  g.add(barGroup);

  // Live v5.1 Colony Telemetry Wall mounted cleanly on the back wall
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 3.4),
    new THREE.MeshBasicMaterial({ map: textures.telemetryWall })
  );
  screen.position.set(4.5, floorY + 2.7, zMax - 0.32);
  screen.rotation.y = Math.PI;
  g.add(screen);

  // Exterior Architectural Detail on Skybridge Roof & South Bulkhead (pilasters, rooftop life-support HVAC & trusses!)
  for (let px = xMin + 2; px <= xMax - 2; px += 6.0) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.65, ceilH + 0.6, 0.72), warmSteel);
    pil.position.set(px, floorY + ceilH * 0.5, zMax + 0.38);
    g.add(pil);
    const roofRib = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, width - 0.6), warmSteel);
    roofRib.position.set(px, floorY + ceilH + 0.62, cz + 0.6);
    g.add(roofRib);
  }
  for (const hx of [-9.5, 4.5, 15.0]) {
    const roofHvac = buildIndustrialHvacUnit(3.4, 1.35, 2.4, warmSteel, darkSteel, chromeMat);
    roofHvac.position.set(hx, floorY + ceilH + 0.42, cz + 1.5);
    g.add(roofHvac);
  }

  // Detailed Exterior Airlock Exit Ramp + Tubular Handrails + Yellow Edge Curbs + Overhead Weather Canopy!
  const rampG = new THREE.Group();
  const exitRamp = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.32, 4.2), deckMat);
  exitRamp.position.set(xMax + 2.65, 18.6, cz);
  exitRamp.rotation.z = -0.22;
  exitRamp.receiveShadow = true;
  rampG.add(exitRamp);
  for (const rz of [cz - 2.02, cz + 2.02]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 0.16), hazardMat);
    curb.position.set(xMax + 2.65, 18.82, rz);
    curb.rotation.z = -0.22;
    rampG.add(curb);
    const handRail = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.08, 0.08), chromeMat);
    handRail.position.set(xMax + 2.65, 19.72, rz);
    handRail.rotation.z = -0.22;
    rampG.add(handRail);
    for (let bx = 0; bx < 4; bx++) {
      const f = bx / 3;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.02, 6), darkSteel);
      post.position.set(xMax + 0.35 + f * 4.6, 19.65 - f * 1.05, rz);
      rampG.add(post);
    }
  }
  const doorCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 4.8), darkSteel);
  doorCanopy.position.set(xMax + 1.3, floorY + 4.35, cz);
  doorCanopy.rotation.z = -0.10;
  rampG.add(doorCanopy);
  const doorLamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 2.8), ceilStripMat);
  doorLamp.position.set(xMax + 1.2, floorY + 4.20, cz);
  rampG.add(doorLamp);
  g.add(rampG);

  return { group: g, airlockDoor, airlockBeacon, interiorLights };
}

/**
 * Engineered Aerospace Steel Ridge Wayfinding Signboard outside the Skybridge Airlock Plaza
 * (Concrete footing plinth, flanged I-beam posts, rear stiffening ribs & solar-powered top light hood!)
 */
function buildRidgeSignboard() {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: '#383e48', roughness: 0.48, metalness: 0.84 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#6b5c52', roughness: 0.90, metalness: 0.08 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.54, metalness: 0.28 });
  const warmLed = new THREE.MeshBasicMaterial({ color: '#ffd994' });

  const footing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.38, 0.95), concreteMat);
  footing.position.y = 0.16;
  footing.receiveShadow = true;
  g.add(footing);
  for (const px of [-1.25, 1.25]) {
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.34), hazardMat);
    basePlate.position.set(px, 0.38, 0);
    g.add(basePlate);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.85, 0.18), postMat);
    post.position.set(px, 1.75, 0);
    post.castShadow = true;
    g.add(post);
  }
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#e0a24c';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 240);
  ctx.fillStyle = '#e0a24c';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('STARBASE ARCADIA · SECTOR 01 RIDGE', 28, 46);
  ctx.fillStyle = '#f2ede4';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('← MONUMENT "AD ASTRA"   95m', 28, 108);
  ctx.fillText('→ SKY-PAD 02 (N2-CG)    42m', 28, 158);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('↑ STARSHIP MEGAPORT    550m', 28, 210);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(3.04, 1.60, 0.18), postMat);
  frameBox.position.set(0, 2.18, -0.02);
  g.add(frameBox);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 1.42, 0.08),
    [postMat, postMat, postMat, postMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.45 }), postMat]
  );
  board.position.set(0, 2.18, 0.05);
  board.castShadow = true;
  g.add(board);
  // Overhead cantilevered illumination hood + compact rooftop solar panel
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.10, 0.56), postMat);
  hood.position.set(0, 3.04, 0.20);
  hood.rotation.x = 0.12;
  g.add(hood);
  const lampStrip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.10), warmLed);
  lampStrip.position.set(0, 2.97, 0.36);
  g.add(lampStrip);
  return g;
}

/**
 * Assembles the complete Arcadia Colony Basin, Domes, Pressurized Tubes,
 * Mars Metro/Loop Viaduct with animated train, Solar Arrays, Dark Non-Glowing Radiators,
 * Ridge Signboard, and the Founder's Overlook Pressurized Glass Skybridge.
 */
export function createArcadiaColony(textures) {
  const root = new THREE.Group();

  // 1. Hero Walkable Pressurized Observation Skybridge & Café on Founder's Ridge
  const skybridge = buildObservationSkybridge(textures);
  root.add(skybridge.group);

  // Wayfinding signboard right beside the east airlock outdoor promenade
  const sign = buildRidgeSignboard();
  const sX = 24.5, sZ = 14.5;
  sign.position.set(sX, getTerrainHeight(sX, sZ), sZ);
  sign.rotation.y = -0.45;
  root.add(sign);

  // 2. Monumental Geodesic Glass Bio-Domes in the Arcadia Basin (4 Distinct Concept-Art Interiors!)
  const bioSpecs = [
    { x: HERO_BIODOME.x, z: HERO_BIODOME.z, r: HERO_BIODOME.r, variant: 'farm' }, // Walkable Scene 09 Agro-Farm!
    { x: 64,  z: -195, r: 34, variant: 'hydrotower' }, // Emerald/Magenta Vertical Aeroponic Hydro-Tower Dome!
    { x: -95, z: -230, r: 38, variant: 'habitat' },    // Golden Civic Habitat & Sky-Ring Atrium Plaza Dome!
    { x: 18,  z: -285, r: 46, variant: 'botanical' }   // Grand Multi-Tier Terraced Botanical Arboretum Hub!
  ];
  const domeAnimBots = [];
  bioSpecs.forEach((b) => {
    const built = buildGeodesicBioDome(b.r, textures, b.variant);
    const domeY = b.variant === 'farm'
      ? (HERO_BIODOME.floorY - 0.55)
      : (getTerrainHeight(b.x, b.z) - 0.25);
    built.group.position.set(b.x, domeY, b.z);
    root.add(built.group);
    if (built.animBots.length) domeAnimBots.push(...built.animBots);
  });

  // 3. Regolith-Bermed Shielded Habitat Domes nestled right beside Glass Bio-Domes (Scene 03!)
  const regoSpecs = [
    { x: 42,   z: -138, r: 30, h: 17 },
    { x: -72,  z: -145, r: 24, h: 14 },
    { x: -16,  z: -222, r: 28, h: 16 },
    { x: 112,  z: -162, r: 26, h: 15 },
    { x: -148, z: -185, r: 32, h: 18 },
    { x: 96,   z: -265, r: 30, h: 17 }
  ];
  regoSpecs.forEach((d) => {
    const mound = buildRegolithDome(d.r, d.h, textures);
    mound.position.set(d.x, getTerrainHeight(d.x, d.z) - 0.4, d.z);
    root.add(mound);
  });

  // 4. Brushed Stainless Pressurized Connecting Tubes joining Domes (docked cleanly to Bio-Dome #1 exterior rim!)
  const dockOnHero = (targetX, targetZ) => {
    const dx = targetX - HERO_BIODOME.x;
    const dz = targetZ - HERO_BIODOME.z;
    const d = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(
      HERO_BIODOME.x + (dx / d) * (HERO_BIODOME.r - 0.5),
      3.8,
      HERO_BIODOME.z + (dz / d) * (HERO_BIODOME.r - 0.5)
    );
  };
  const tubeLinks = [
    [dockOnHero(42, -138),  new THREE.Vector3(42, 3.8, -138)],
    [dockOnHero(-72, -145), new THREE.Vector3(-72, 3.8, -145)],
    [dockOnHero(-16, -222), new THREE.Vector3(-16, 3.8, -222)],
    [new THREE.Vector3(42, 4.2, -138),  new THREE.Vector3(64, 4.2, -195)],
    [new THREE.Vector3(64, 4.2, -195),  new THREE.Vector3(112, 4.2, -162)],
    [new THREE.Vector3(-16, 4.2, -222), new THREE.Vector3(-95, 4.2, -230)],
    [new THREE.Vector3(-16, 4.2, -222), new THREE.Vector3(18, 4.2, -285)],
    [new THREE.Vector3(64, 4.2, -195),  new THREE.Vector3(96, 4.2, -265)]
  ];
  tubeLinks.forEach(([a, b]) => {
    root.add(buildPressurizedTube(a, b, 3.4, textures));
  });

  // 5. HIGH-DETAIL Industrial ISRU / Cryogenic Silo Clusters + Inter-Silo Catwalk Bridges & Pipe Racks!
  const siloMat = new THREE.MeshStandardMaterial({
    color: '#c0c7d0',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughnessMap: textures.steelRough,
    roughness: 0.46,
    metalness: 0.76,
    envMapIntensity: 0.70
  });
  const siloDarkMat = new THREE.MeshStandardMaterial({
    color: '#343a44',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.50,
    metalness: 0.80
  });
  const siloConcrete = new THREE.MeshStandardMaterial({
    color: '#6b5c52',
    map: textures.basaltColor,
    normalMap: textures.basaltNormal,
    roughness: 0.90
  });
  const siloCyan = new THREE.MeshBasicMaterial({ color: '#45e6d6' });
  const siloAmber = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.54, metalness: 0.28 });
  const siloCenters = [
    [-46, -275], [-34, -278], [-22, -272], [-40, -290], [-28, -288],
    [136, -225], [148, -222], [142, -238]
  ];
  siloCenters.forEach(([sx, sz], i) => {
    const h = 18 + (i % 3) * 7;
    const silo = buildIndustrialCryoSilo(3.6, h, textures, {
      steelMat: siloMat,
      darkMat: siloDarkMat,
      concreteMat: siloConcrete,
      accentMat: i % 2 === 0 ? siloCyan : siloAmber,
      hazardMat: siloAmber
    });
    silo.position.set(sx, getTerrainHeight(sx, sz) - 0.2, sz);
    silo.rotation.y = (i % 4) * 1.1;
    root.add(silo);
  });
  // Overhead steel catwalk & cryo transfer pipe bridges tying neighboring basin silos together!
  const siloPairs = [[0, 1], [1, 2], [3, 4], [5, 6], [5, 7]];
  siloPairs.forEach(([ia, ib]) => {
    const [ax, az] = siloCenters[ia], [bx, bz] = siloCenters[ib];
    const ay = getTerrainHeight(ax, az) + 14.5;
    const by = getTerrainHeight(bx, bz) + 14.5;
    const pA = new THREE.Vector3(ax, ay, az), pB = new THREE.Vector3(bx, by, bz);
    const d = pA.distanceTo(pB);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.35, d), siloDarkMat);
    bridge.position.copy(pA).add(pB).multiplyScalar(0.5);
    bridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pB.clone().sub(pA).normalize());
    root.add(bridge);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, d, 8), siloMat);
    pipe.position.copy(pA).add(pB).multiplyScalar(0.5);
    pipe.position.y -= 0.72;
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pB.clone().sub(pA).normalize());
    root.add(pipe);
  });

  // 6. HIGH-DETAIL MULTI-PART DUAL-AXIS MARS SOLAR TRACKER FIELDS + INVERTER SUBSTATIONS
  //    (Concrete footing, galvanized mast, slew gearbox, hydraulic tilt actuator, torque-tube
  //     backing truss, brushed anodized aluminum frame, & clearcoat monocrystalline PV deck!)
  {
    const solarSpots = [];
    // West Basin Array (cleanly buffered from Medevac Outpost at (-182,-325) & Saloon at (-255,-385)!)
    for (let gx = -242; gx <= -152; gx += 18) {
      for (let gz = -244; gz >= -292; gz -= 16) solarSpots.push([gx, gz]);
    }
    // East Basin Utility Array (cleanly clear of East Highway at x~156!)
    for (let gx = 176; gx <= 266; gx += 18) {
      for (let gz = -252; gz >= -316; gz -= 16) solarSpots.push([gx, gz]);
    }
    // Sunlit Basin-East Showcase Array (cleanly north of Metro Viaduct at z=-78 & clear of highways!)
    for (let gx = 134; gx <= 170; gx += 18) {
      for (let gz = -98; gz >= -114; gz -= 16) solarSpots.push([gx, gz]);
    }

    const count = solarSpots.length;
    const footingMat = new THREE.MeshStandardMaterial({
      color: '#6b5c52',
      map: textures.basaltColor,
      normalMap: textures.basaltNormal,
      roughness: 0.90,
      metalness: 0.08
    });
    const galvSteelMat = new THREE.MeshStandardMaterial({
      color: '#8f99a6',
      map: textures.steelColor,
      normalMap: textures.steelNormal,
      roughnessMap: textures.steelRough,
      roughness: 0.44,
      metalness: 0.82
    });
    const darkDriveMat = new THREE.MeshStandardMaterial({
      color: '#2e343e',
      map: textures.ribSteelColor,
      normalMap: textures.ribSteelNormal,
      roughness: 0.52,
      metalness: 0.78
    });
    const aluFrameMat = new THREE.MeshStandardMaterial({
      color: '#c2cbd6',
      map: textures.steelColor,
      roughness: 0.32,
      metalness: 0.88
    });
    const solarFaceMat = new THREE.MeshPhysicalMaterial({
      color: '#82b0e8',
      map: textures.solarColor,
      normalMap: textures.solarNormal,
      normalScale: new THREE.Vector2(1.75, 1.75),
      roughnessMap: textures.solarRough,
      roughness: 0.22,
      metalness: 0.56,
      clearcoat: 0.80,
      clearcoatRoughness: 0.11,
      reflectivity: 0.92,
      envMapIntensity: 0.85
    });

    const footingInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 1.38, 1.55, 8), footingMat, count);
    const mastInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.42, 3.15, 10), galvSteelMat, count);
    const gearInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.14, 0.76, 1.14), darkDriveMat, count);
    const actInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.17, 1.0, 8), aluFrameMat, count);
    const torqueInst = new THREE.InstancedMesh(new THREE.BoxGeometry(13.2, 0.28, 0.42), darkDriveMat, count);
    const purlinInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.22, 6.75), galvSteelMat, count * 2);
    const frameInst = new THREE.InstancedMesh(new THREE.BoxGeometry(13.94, 0.24, 7.54), aluFrameMat, count);
    const deckInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(13.56, 0.09, 7.16),
      [aluFrameMat, aluFrameMat, solarFaceMat, darkDriveMat, aluFrameMat, aluFrameMat],
      count
    );
    const jboxInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.18, 0.42, 0.74), darkDriveMat, count);

    [footingInst, mastInst, frameInst, deckInst].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });

    const pivotObj = new THREE.Object3D();
    const childObj = new THREE.Object3D();
    pivotObj.add(childObj);
    const baseObj = new THREE.Object3D();
    const pMastCollar = new THREE.Vector3();
    const pRearBracket = new THREE.Vector3();
    const actDir = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);

    const tiltX = 0.35; // Tilted smoothly toward low Martian sun
    const yawY = 0.14;

    solarSpots.forEach(([sx, sz], i) => {
      const gy = getTerrainHeight(sx, sz);
      const pivotY = gy + 3.48;

      // Grounded sintered-basalt footing plinth
      baseObj.position.set(sx, gy + 0.28, sz);
      baseObj.rotation.set(0, yawY, 0);
      baseObj.scale.set(1, 1, 1);
      baseObj.updateMatrix();
      footingInst.setMatrixAt(i, baseObj.matrix);

      // Vertical galvanized tracker mast
      baseObj.position.set(sx, gy + 1.82, sz);
      baseObj.updateMatrix();
      mastInst.setMatrixAt(i, baseObj.matrix);

      // Dual-axis slew-drive gearbox housing
      baseObj.position.set(sx, gy + 3.16, sz);
      baseObj.updateMatrix();
      gearInst.setMatrixAt(i, baseObj.matrix);

      // Tilted solar wing coordinate transform
      pivotObj.position.set(sx, pivotY, sz);
      pivotObj.rotation.set(tiltX, yawY, 0, 'YXZ');
      pivotObj.updateMatrixWorld(true);

      const stampLocal = (inst, idx, lx, ly, lz) => {
        childObj.position.set(lx, ly, lz);
        childObj.rotation.set(0, 0, 0);
        childObj.scale.set(1, 1, 1);
        childObj.updateMatrixWorld(true);
        inst.setMatrixAt(idx, childObj.matrixWorld);
      };

      stampLocal(torqueInst, i, 0, -0.25, 0);
      stampLocal(purlinInst, i * 2,     -4.1, -0.18, 0);
      stampLocal(purlinInst, i * 2 + 1,  4.1, -0.18, 0);
      stampLocal(frameInst,  i, 0, 0.0, 0);
      stampLocal(deckInst,   i, 0, 0.11, 0);
      stampLocal(jboxInst,   i, 2.3, -0.32, -0.48);

      // Angled hydraulic sun-tracking actuator connecting mast collar -> rear tilted beam
      pMastCollar.set(sx, gy + 1.85, sz);
      childObj.position.set(0, -0.24, -1.75);
      childObj.updateMatrixWorld(true);
      pRearBracket.setFromMatrixPosition(childObj.matrixWorld);
      actDir.subVectors(pRearBracket, pMastCollar);
      const actLen = actDir.length();
      baseObj.position.copy(pMastCollar).add(pRearBracket).multiplyScalar(0.5);
      baseObj.quaternion.setFromUnitVectors(upAxis, actDir.normalize());
      baseObj.scale.set(1, actLen, 1);
      baseObj.updateMatrix();
      actInst.setMatrixAt(i, baseObj.matrix);
    });

    [footingInst, mastInst, gearInst, actInst, torqueInst, purlinInst, frameInst, deckInst, jboxInst].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      root.add(inst);
    });

    // 4 Compact Mars Megapack / Solar Inverter Transformer Substations cleanly placed at array row heads
    const invGreenLed = new THREE.MeshBasicMaterial({ color: '#34d399' });
    const invAmberLed = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
    const invHazard = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.56, metalness: 0.28 });
    const invWhite = new THREE.MeshStandardMaterial({
      color: '#cfd5dc',
      map: textures.ribSteelColor,
      normalMap: textures.ribSteelNormal,
      roughness: 0.46,
      metalness: 0.52
    });
    const substationSpots = [
      { x: -137, z: -268, rotY: -Math.PI * 0.5 },
      { x: 164,  z: -268, rotY: Math.PI * 0.5 },
      { x: 164,  z: -306, rotY: Math.PI * 0.5 },
      { x: 120,  z: -106, rotY: Math.PI * 0.5 }
    ];
    substationSpots.forEach((sp) => {
      const sub = new THREE.Group();
      const sy = getTerrainHeight(sp.x, sp.z);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.55, 3.8), footingMat);
      slab.position.y = 0.22;
      slab.receiveShadow = true;
      sub.add(slab);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.55, 2.25), invWhite);
      cab.position.y = 1.72;
      cab.castShadow = true;
      cab.receiveShadow = true;
      sub.add(cab);
      // Dark steel cooling radiator louver cap & twin armored HV conduit risers
      const cap = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.32, 2.38), darkDriveMat);
      cap.position.y = 3.12;
      sub.add(cap);
      for (const cx2 of [-1.4, 0, 1.4]) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.65, 0.12), darkDriveMat);
        louver.position.set(cx2, 1.65, 1.12);
        sub.add(louver);
      }
      for (const hx of [-1.85, 1.85]) {
        const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.35, 8), galvSteelMat);
        riser.position.set(hx, 3.75, -0.55);
        sub.add(riser);
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 8), invHazard);
        bollard.position.set(hx * 1.35, 0.98, 1.55);
        sub.add(bollard);
      }
      // Crisp glowing grid-online LED telemetry status strip
      const ledOk = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.08), invGreenLed);
      ledOk.position.set(-1.6, 2.74, 1.15);
      sub.add(ledOk);
      const ledLoad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), invAmberLed);
      ledLoad.position.set(-1.12, 2.74, 1.15);
      sub.add(ledLoad);

      sub.position.set(sp.x, sy, sp.z);
      sub.rotation.y = sp.rotY;
      root.add(sub);
    });
  }

  // 7. ENGINEERED 20 GWth SMR HEAT-REJECTION THERMAL RADIATOR ARRAYS (Concrete Footings, A-Frame Pylons,
  //    Aluminum-Titanium Manifold Frames, Segmented Heat-Pipe Bays, Coolant Header Pipes & Trench Manifolds!)
  {
    const radPanelMat = new THREE.MeshStandardMaterial({
      color: '#343b45',
      map: textures.radiatorColor,
      normalMap: textures.radiatorNormal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.72,
      metalness: 0.38
    });
    const radFrameMat = new THREE.MeshStandardMaterial({
      color: '#9aa4b0',
      map: textures.steelColor,
      normalMap: textures.steelNormal,
      roughness: 0.38,
      metalness: 0.86
    });
    const radDark = new THREE.MeshStandardMaterial({
      color: '#2e343e',
      map: textures.ribSteelColor,
      normalMap: textures.ribSteelNormal,
      roughness: 0.50,
      metalness: 0.82
    });
    const radFootMat = new THREE.MeshStandardMaterial({
      color: '#6b5c52',
      map: textures.basaltColor,
      normalMap: textures.basaltNormal,
      roughness: 0.90
    });
    const radAmber = new THREE.MeshBasicMaterial({ color: '#ffae38' });

    for (let row = 0; row < 4; row++) {
      const rz = -475 - row * 28;
      // Ground insulated liquid-metal coolant manifold feed pipe tying all 3 radiator banks in each row!
      const rowY = getTerrainHeight(-179, rz);
      const manifoldPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 86, 10), radFrameMat);
      manifoldPipe.rotation.z = Math.PI / 2;
      manifoldPipe.position.set(-179, rowY + 0.95, rz + 2.4);
      root.add(manifoldPipe);

      for (let col = 0; col < 3; col++) {
        const rx = -215 + col * 36;
        const ry = getTerrainHeight(rx, rz);
        const bank = new THREE.Group();
        bank.position.set(rx, ry, rz);

        // 3 Grounded Sintered-Basalt Foundation Plinths + Steel A-Frame Wind-Braced Pylons!
        for (const px of [-9.2, 0, 9.2]) {
          const foot = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 4.4), radFootMat);
          foot.position.set(px, 0.2, 0);
          foot.receiveShadow = true;
          bank.add(foot);
          const colPost = new THREE.Mesh(new THREE.BoxGeometry(0.52, 13.0, 0.58), radDark);
          colPost.position.set(px, 6.7, 0);
          colPost.castShadow = true;
          bank.add(colPost);
          // Fore & aft angled A-frame wind stabilizer struts
          for (const sz of [-1, 1]) {
            const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 0.28), radDark);
            strut.position.set(px, 3.6, sz * 1.35);
            strut.rotation.x = sz * 0.36;
            bank.add(strut);
          }
        }

        // Upper & Lower Heavy Insulated Liquid-Metal Coolant Header Pipes + End Expansion Manifolds!
        for (const hy of [2.15, 13.05]) {
          const hdr = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 23.2, 10), radFrameMat);
          hdr.rotation.z = Math.PI / 2;
          hdr.position.set(0, hy, 0);
          hdr.castShadow = true;
          bank.add(hdr);
        }
        for (const ex of [-11.3, 11.3]) {
          const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 11.2, 8), radFrameMat);
          riser.position.set(ex, 7.6, 0);
          bank.add(riser);
          // Stub pipe connecting bottom header down to row coolant trench manifold
          const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 8), radDark);
          stub.rotation.x = Math.PI / 2;
          stub.position.set(ex, 1.45, 1.2);
          bank.add(stub);
        }

        // 4 Segmented Framed Radiator Heat-Pipe Fin Bays (replaces 1 monolithic black rectangle!)
        for (let b = 0; b < 4; b++) {
          const bx = -8.1 + b * 5.4;
          const bay = new THREE.Mesh(new THREE.BoxGeometry(4.85, 10.2, 0.36), radPanelMat);
          bay.position.set(bx, 7.6, 0);
          bay.castShadow = true;
          bay.receiveShadow = true;
          bank.add(bay);
          // Horizontal mid heat-pipe stiffener rib
          const midRib = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.26, 0.56), radDark);
          midRib.position.set(bx, 7.6, 0);
          bank.add(midRib);
        }
        // Subtle corner aviation marker beacon on outer banks
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.34, 8), radAmber);
        beacon.position.set(11.3, 13.6, 0);
        bank.add(beacon);

        root.add(bank);
      }
    }
  }

  // 8. HIGH-DETAIL MARS METRO / PRESSURIZED LOOP VIADUCT & AERODYNAMIC 5-CAR BULLET TRAIN (Scene 01!)
  const viaductZ = -78;
  const viaductY = 7.2;
  const beamMat = new THREE.MeshStandardMaterial({
    color: '#645850', map: textures.basaltColor, normalMap: textures.basaltNormal, roughness: 0.86, metalness: 0.10
  });
  const viaductDark = new THREE.MeshStandardMaterial({
    color: '#343a44', map: textures.ribSteelColor, normalMap: textures.ribSteelNormal, roughness: 0.48, metalness: 0.82
  });
  const railSteelMat = new THREE.MeshStandardMaterial({
    color: '#c8d0da', map: textures.steelColor, normalMap: textures.steelNormal, roughness: 0.28, metalness: 0.92
  });
  const trackGlowCyan = new THREE.MeshBasicMaterial({ color: '#45e6d6' });
  const trackGlowAmber = new THREE.MeshBasicMaterial({ color: '#ffbf5e' });

  // Sculpted Trapezoidal Concrete Box-Girder Deck + Side Safety Parapets + Dual Stainless Guideway Rails + Maglev Core!
  const trackBeam = new THREE.Mesh(new THREE.BoxGeometry(520, 1.35, 5.4), beamMat);
  trackBeam.position.set(0, viaductY, viaductZ);
  trackBeam.receiveShadow = true;
  root.add(trackBeam);
  const lowerSpine = new THREE.Mesh(new THREE.BoxGeometry(520, 0.85, 3.2), viaductDark);
  lowerSpine.position.set(0, viaductY - 0.95, viaductZ);
  root.add(lowerSpine);
  for (const rz of [-2.55, 2.55]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(520, 0.68, 0.34), viaductDark);
    parapet.position.set(0, viaductY + 0.96, viaductZ + rz);
    root.add(parapet);
    const guideRail = new THREE.Mesh(new THREE.BoxGeometry(520, 0.18, 0.22), railSteelMat);
    guideRail.position.set(0, viaductY + 0.78, viaductZ + rz * 0.56);
    root.add(guideRail);
  }
  // Central glowing linear-induction maglev guideway strip
  const indStrip = new THREE.Mesh(new THREE.BoxGeometry(520, 0.08, 0.55), viaductDark);
  indStrip.position.set(0, viaductY + 0.70, viaductZ);
  root.add(indStrip);

  // Hammerhead Tapered Architectural Concrete Piers + Grounded Footings + Trackside Beacon Markers!
  for (let px = -240; px <= 240; px += 28) {
    const py = getTerrainHeight(px, viaductZ);
    const ph = Math.max(2.4, viaductY - 1.2 - py);
    const pierFoot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 4.6), beamMat);
    pierFoot.position.set(px, py + 0.3, viaductZ);
    root.add(pierFoot);
    const pierCol = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, ph, 6), beamMat);
    pierCol.position.set(px, py + ph * 0.5, viaductZ);
    pierCol.castShadow = true;
    root.add(pierCol);
    // Flared steel-reinforced hammerhead pier capital
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 5.8), viaductDark);
    cap.position.set(px, viaductY - 1.15, viaductZ);
    root.add(cap);
    // Trackside cyan/amber optical block-signal LED markers on outer parapet
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.14), px % 56 === 0 ? trackGlowCyan : trackGlowAmber);
    marker.position.set(px, viaductY + 1.05, viaductZ + 2.75);
    root.add(marker);
  }

  // Sleek Aerodynamic Stainless-Steel 5-Car Mars Loop Express Maglev Bullet Train!
  const train = new THREE.Group();
  const carBodyMat = new THREE.MeshStandardMaterial({
    color: '#c2cbd6', map: textures.steelColor, normalMap: textures.steelNormal, roughness: 0.26, metalness: 0.88
  });
  const carRoofMat = new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.44, metalness: 0.80 });
  const carGlassMat = new THREE.MeshPhysicalMaterial({ color: '#0c1522', roughness: 0.06, metalness: 0.22, clearcoat: 1.0 });
  const carWinMat = new THREE.MeshBasicMaterial({ color: '#ffd488' });
  const headLightMat = new THREE.MeshBasicMaterial({ color: '#f2fbff' });
  const tailLightMat = new THREE.MeshBasicMaterial({ color: '#ff382e' });
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.42, metalness: 0.45 });

  for (let c = 0; c < 5; c++) {
    const car = new THREE.Group();
    const isEnd = c === 0 || c === 4;
    const endSign = c === 0 ? -1 : 1;
    const bodyLen = isEnd ? 11.4 : 13.0;

    // Lower under-chassis maglev bogie shroud skirt
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, 0.62, 2.76), carRoofMat);
    skirt.position.y = 0.56;
    car.add(skirt);
    // Main chamfered brushed-stainless fuselage body + curved aerodynamic roof shroud
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, 2.35, 3.08), carBodyMat);
    body.position.y = 2.02;
    body.castShadow = true;
    car.add(body);
    const roofShroud = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.54, bodyLen, 10, 1, false, 0, Math.PI), carRoofMat);
    roofShroud.rotation.z = Math.PI / 2;
    roofShroud.rotation.x = Math.PI / 2;
    roofShroud.scale.set(0.32, 1, 1);
    roofShroud.position.y = 3.18;
    car.add(roofShroud);
    // Amber Mars Transit livery beltline stripe
    const belt = new THREE.Mesh(new THREE.BoxGeometry(bodyLen + 0.04, 0.16, 3.14), stripeMat);
    belt.position.y = 1.38;
    car.add(belt);
    // Recessed individual panoramic passenger windows with dark structural mullions (ZERO flat single yellow box!)
    const winCount = isEnd ? 5 : 6;
    for (let w = 0; w < winCount; w++) {
      const wx = -bodyLen * 0.40 + (w / Math.max(1, winCount - 1)) * (bodyLen * 0.80);
      const wFrame = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.96, 3.13), carRoofMat);
      wFrame.position.set(wx, 2.24, 0);
      car.add(wFrame);
      const wPane = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.76, 3.17), carWinMat);
      wPane.position.set(wx, 2.24, 0);
      car.add(wPane);
    }
    // Rooftop low-profile streamlined HVAC & Starlink comms pod
    const roofPod = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.34, 1.85), carRoofMat);
    roofPod.position.y = 3.48;
    car.add(roofPod);

    // Sculpted aerodynamic sloped bullet nose / tail cab on lead & rear cars!
    if (isEnd) {
      const noseBaseX = endSign * (bodyLen * 0.5);
      const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 1.52, 3.2, 8), carBodyMat);
      noseCone.rotation.z = -endSign * Math.PI / 2;
      noseCone.scale.set(0.76, 1.0, 1.0);
      noseCone.position.set(noseBaseX + endSign * 1.45, 1.72, 0);
      car.add(noseCone);
      const cockpitGlass = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.95, 2.45), carGlassMat);
      cockpitGlass.position.set(noseBaseX + endSign * 0.72, 2.52, 0);
      cockpitGlass.rotation.z = -endSign * 0.52;
      car.add(cockpitGlass);
      const ledBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 1.85), c === 4 ? headLightMat : tailLightMat);
      ledBar.position.set(noseBaseX + endSign * 2.85, 1.25, 0);
      car.add(ledBar);
    }

    // Articulated corrugated accordion gangway bellows coupling car -> next car!
    if (c < 4) {
      const bellows = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.45, 2.42), carRoofMat);
      bellows.position.set((c - 2) * 14.2 + 7.1, 1.95, 0);
      train.add(bellows);
    }

    car.position.x = (c - 2) * 14.2;
    train.add(car);
  }
  train.position.set(-120, viaductY + 0.72, viaductZ);
  root.add(train);

  // Double-Rail Brushed-Steel Founder's Ridge Cliffside Safety Fence + Toe Kick-Plate + Bolted Base Stanchions!
  const railMat = new THREE.MeshStandardMaterial({ color: '#393e46', roughness: 0.46, metalness: 0.84 });
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(92, 0.08, 0.10), railSteelMat);
  topRail.position.set(16, 19.12, -18.5);
  root.add(topRail);
  const midRail = new THREE.Mesh(new THREE.BoxGeometry(92, 0.05, 0.06), railMat);
  midRail.position.set(16, 18.62, -18.5);
  root.add(midRail);
  const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(92, 0.16, 0.12), railMat);
  kickPlate.position.set(16, 18.08, -18.5);
  root.add(kickPlate);
  for (let rx = -28; rx <= 60; rx += 4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.18, 0.14), railMat);
    post.position.set(rx, 18.56, -18.5);
    root.add(post);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), railMat);
    flange.position.set(rx, 18.02, -18.5);
    root.add(flange);
  }

  // Architectural Hooded-Louver Mars Walkway Bollards lighting the ridge plaza walkways!
  const bollardMat = new THREE.MeshBasicMaterial({ color: '#ffbf69' });
  const bollardCoords = [
    [-22, -16], [-8, -16], [8, -16], [24, -16],
    [25, 4], [25, 16], [10, 14], [-10, 14], [-28, 6], [-38, -4]
  ];
  bollardCoords.forEach(([bx, bz]) => {
    const by = getTerrainHeight(bx, bz);
    const bg = new THREE.Group();
    bg.position.set(bx, by, bz);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.16, 8), railMat);
    foot.position.y = 0.08;
    bg.add(foot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.88, 8), railMat);
    stem.position.y = 0.56;
    bg.add(stem);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.22, 8), bollardMat);
    glow.position.y = 1.08;
    bg.add(glow);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.16, 8), railMat);
    hood.position.y = 1.24;
    bg.add(hood);
    root.add(bg);
  });

  return {
    group: root,
    skybridge,
    update(dt, t) {
      const cycle = (t * 0.045) % 2;
      const u = cycle <= 1 ? cycle : 2 - cycle;
      const smoothU = u * u * (3 - 2 * u);
      train.position.x = -210 + smoothU * 420;

      // Subtle animated crop-tending motion for the 4 Optimus Gen-3 Farm Robots inside Bio-Dome #1!
      for (const b of domeAnimBots) {
        const p = t * 1.45 + b.phase;
        b.headPivot.rotation.y = Math.sin(p * 0.65) * 0.28;
        b.headPivot.rotation.x = 0.20 + Math.sin(p * 0.9) * 0.06;
        b.torsoPivot.rotation.y = Math.sin(p * 0.45) * 0.12;
        if (b.arms && b.arms.length >= 2) {
          b.arms[0].sh.rotation.x = -0.58 + Math.sin(p) * 0.18;
          b.arms[0].elbow.rotation.x = -0.62 + Math.cos(p) * 0.15;
          b.arms[1].sh.rotation.x = -0.45 + Math.cos(p * 0.85) * 0.16;
          b.arms[1].elbow.rotation.x = -0.55 + Math.sin(p * 0.85) * 0.14;
        }
      }
    }
  };
}
