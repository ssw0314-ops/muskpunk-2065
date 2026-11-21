import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COLOSSUS_GLB_GZIP_B64 } from './colossus_glb_data.js';
import {
  COLOSSUS_HEAD_ALBEDO_URI,
  COLOSSUS_HEAD_NORMAL_URI,
  COLOSSUS_HEAD_ROUGH_URI
} from './colossus_head_tex_data.js';
import { buildHoodedMarsLamp } from './industrial_props.js';
import { enhanceSteelMonumentMaterial } from '../vfx/cinematic_shaders.js';

/**
 * Loads an embedded Base64 Data-URI texture cleanly for glTF UV-mapped meshes (flipY = false,
 * seamless cylindrical wrapS = RepeatWrapping, high anisotropy for razor-sharp close-up portrait detail).
 */
function createInlineGlbTexture(dataUri, isColor, onReady) {
  const tex = new THREE.Texture();
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
    if (onReady) onReady();
  };
  img.src = dataUri;
  return tex;
}

function cloneWithRepeat(srcTex, mulX, mulY) {
  if (!srcTex) return srcTex;
  const t = srcTex.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((srcTex.repeat ? srcTex.repeat.x : 1) * mulX, (srcTex.repeat ? srcTex.repeat.y : 1) * mulY);
  t.needsUpdate = true;
  return t;
}

/**
 * Clean linear satin micro-brushed stainless steel normal map (zero boxy grid bumps!)
 * so the flat-faceted Soviet-Constructivist coat plates gleam like Cybertruck 30X armor steel.
 */
function createSatinCoatBrushNormal() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const streak = (Math.sin(y * 1.9) * 0.5 + Math.cos(y * 5.3) * 0.5) * 5;
    for (let x = 0; x < size; x++) {
      const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 - 0.5) * 5;
      const idx = (y * size + x) * 4;
      img.data[idx]     = Math.max(0, Math.min(255, 128 + grain));
      img.data[idx + 1] = Math.max(0, Math.min(255, 128 + streak));
      img.data[idx + 2] = 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * Decodes the gzipped Base64 Blender 5.0 GLB natively in-browser (100% offline, zero external fetches!).
 */
async function decodeGzippedGlbBase64(b64) {
  const binStr = atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).arrayBuffer();
}

/**
 * Overwhelming Soviet-Constructivist welded 30X stainless-steel Elon Musk Colossus (Scene 03/06!):
 *  - Crisp flat-faceted Cybertruck/Constructivist stainless-steel armor coat + 28K-triangle HD portrait head
 *    sculpted in Blender 5.0 (bpy), scaled 2.40× -> 177.6m statue alone (212m total with Citadel)!
 *  - Seated 100% flush atop a 34.4m multi-tiered brutalist octagonal sintered-basalt monolith citadel
 *    with stepped ribbed corner buttresses, beveled cornice collars, Constructivist brass-inlaid obelisks,
 *    28 architectural hooded Mars promenade luminaires, deep-beveled AD ASTRA relief plaque & gimbaled uplights!
 */
export function createElonColossus(textures) {
  const root = new THREE.Group();

  const plinthBasaltColor = cloneWithRepeat(textures.basaltColor, 2.2, 2.2);
  const plinthBasaltNormal = cloneWithRepeat(textures.basaltNormal, 2.2, 2.2);
  const plinthBasaltRough = cloneWithRepeat(textures.basaltRough, 2.2, 2.2);

  const friezeTpsColor = cloneWithRepeat(textures.tpsColor, 2.6, 1.8);
  const friezeTpsNormal = cloneWithRepeat(textures.tpsNormal, 2.6, 1.8);
  const friezeTpsRough = cloneWithRepeat(textures.tpsRough, 2.6, 1.8);

  // 1. Welded 30X stainless steel PBR for the coat & folded arms
  const coatSteelColor = cloneWithRepeat(textures.steelColor, 1.25, 1.25);
  const coatSteelNormal = cloneWithRepeat(textures.steelNormal, 1.25, 1.25);
  const coatSteelRough = cloneWithRepeat(textures.steelRough, 1.25, 1.25);
  const coatSteelMat = enhanceSteelMonumentMaterial(new THREE.MeshStandardMaterial({
    color: '#c4ccd4',
    vertexColors: true,
    map: coatSteelColor,
    normalMap: coatSteelNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: coatSteelRough,
    roughness: 0.58,
    metalness: 0.72,
    envMapIntensity: 0.58
  }), { mode: 'colossus', dustStrength: 0.46 });

  // 2. Museum-grade Photo-Sculpted 30X Satin Stainless Steel PBR for the 57.7m Elon Musk Portrait Head!
  let headTexCount = 0;
  const onHeadTexLoad = () => { headTexCount += 1; };
  const headAlbedoTex = createInlineGlbTexture(COLOSSUS_HEAD_ALBEDO_URI, true, onHeadTexLoad);
  const headNormalTex = createInlineGlbTexture(COLOSSUS_HEAD_NORMAL_URI, false, onHeadTexLoad);
  const headRoughTex  = createInlineGlbTexture(COLOSSUS_HEAD_ROUGH_URI, false, onHeadTexLoad);

  const headSteelMat = enhanceSteelMonumentMaterial(new THREE.MeshStandardMaterial({
    color: '#d8e0e8',
    vertexColors: false,
    map: headAlbedoTex,
    normalMap: headNormalTex,
    normalScale: new THREE.Vector2(0.86, -0.86),
    roughnessMap: headRoughTex,
    roughness: 0.96,
    metalness: 0.56,
    envMapIntensity: 0.48
  }), { mode: 'colossus_head', dustStrength: 0.14 });

  const basaltMat = new THREE.MeshStandardMaterial({
    color: '#8c786a',
    map: plinthBasaltColor,
    normalMap: plinthBasaltNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: plinthBasaltRough,
    roughness: 0.88,
    metalness: 0.10
  });

  const tpsMat = new THREE.MeshStandardMaterial({
    color: '#20242a',
    map: friezeTpsColor,
    normalMap: friezeTpsNormal,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: friezeTpsRough,
    roughness: 0.70,
    metalness: 0.22
  });

  const railDark = new THREE.MeshStandardMaterial({
    color: '#343a44',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.44,
    metalness: 0.84
  });
  const trimSteel = new THREE.MeshStandardMaterial({
    color: '#a8b2be',
    map: textures.steelColor,
    normalMap: textures.steelNormal,
    roughness: 0.34,
    metalness: 0.88
  });
  const brassRingMat = new THREE.MeshStandardMaterial({ color: '#c89a4e', roughness: 0.34, metalness: 0.88 });
  const warmLantern = new THREE.MeshBasicMaterial({ color: '#ffd080' });

  // =========================================================================
  // 1. MULTI-TIERED BRUTALIST OCTAGONAL SINTERED-BASALT CITADEL PLINTH (y = 0 .. 34.8m)
  //    Top inscribed apothem = 45.2 * cos(22.5°) = 41.76m > 40.99m coat skirt (100% flush!)
  // =========================================================================
  const baseSlab = new THREE.Mesh(new THREE.CylinderGeometry(50.2, 52.4, 5.4, 8), basaltMat);
  baseSlab.rotation.y = Math.PI / 8;
  baseSlab.position.y = 2.7;
  baseSlab.castShadow = true;
  baseSlab.receiveShadow = true;
  root.add(baseSlab);

  // Heavy chamfered steel promenade cornice rim encircling the 5.4m observation terrace
  const baseCornice = new THREE.Mesh(new THREE.CylinderGeometry(50.8, 50.2, 0.72, 8), railDark);
  baseCornice.rotation.y = Math.PI / 8;
  baseCornice.position.y = 5.25;
  root.add(baseCornice);

  // 8 Multi-Step Sculpted Brutalist Corner Buttresses with steel tension ribs, anchor gussets & recessed amber slot lights!
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bg = new THREE.Group();
    bg.position.set(Math.cos(a) * 46.8, 0, Math.sin(a) * 46.8);
    bg.rotation.y = -a + Math.PI / 2;

    // Stepped concrete footing shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(8.4, 6.2, 13.8), basaltMat);
    shoe.position.set(0, 3.1, 0.9);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    bg.add(shoe);
    // Main sloped brutalist shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6.8, 25.0, 10.6), basaltMat);
    shaft.position.set(0, 14.2, -0.2);
    shaft.rotation.x = -0.15;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bg.add(shaft);
    // Upper chamfered steel tension cap & flanking riveted structural flanges
    const cap = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 8.8), railDark);
    cap.position.set(0, 26.8, -1.9);
    cap.rotation.x = -0.15;
    bg.add(cap);
    for (const fx of [-3.55, 3.55]) {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.48, 24.0, 1.35), railDark);
      flange.position.set(fx, 14.2, 4.4);
      flange.rotation.x = -0.15;
      bg.add(flange);
    }
    // Recessed vertical bronze-steel architectural light channel down outer buttress spine!
    const slotBack = new THREE.Mesh(new THREE.BoxGeometry(1.15, 19.5, 0.35), railDark);
    slotBack.position.set(0, 15.6, 5.12);
    slotBack.rotation.x = -0.15;
    bg.add(slotBack);
    const slotGlow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 18.2, 0.14), warmLantern);
    slotGlow.position.set(0, 15.6, 5.26);
    slotGlow.rotation.x = -0.15;
    bg.add(slotGlow);

    root.add(bg);
  }

  // 28 Architectural Hooded Mars Promenade Luminaires encircling the Observation Terrace (NO bare spheres on sticks!)
  const promPylons = 28;
  for (let i = 0; i < promPylons; i++) {
    const a = (i / promPylons) * Math.PI * 2;
    if (Math.sin(a) > 0.94 && Math.abs(Math.cos(a)) < 0.32) continue;
    const rP = 48.2;
    const lamp = buildHoodedMarsLamp(4.1, railDark, brassRingMat, warmLantern, 0.95);
    lamp.position.set(Math.cos(a) * rP, 5.4, Math.sin(a) * rP);
    lamp.rotation.y = -a;
    root.add(lamp);
  }

  // Human-scale 1.15m double-rail brushed safety railings & twin monumental hooded entrance standards flanking ceremonial stairs
  for (const side of [-1, 1]) {
    for (const ry of [6.55, 6.08]) {
      const railX = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.08, 0.10), trimSteel);
      railX.position.set(side * 14.2, ry, 45.8);
      root.add(railX);
    }
    const toePlate = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.16, 0.14), railDark);
    toePlate.position.set(side * 14.2, 5.48, 45.8);
    root.add(toePlate);
    for (let px = 8.6; px <= 19.8; px += 2.8) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.18, 0.14), railDark);
      st.position.set(side * px, 6.0, 45.8);
      root.add(st);
    }
    for (const [pyZ, pyY] of [[46.0, 5.4], [57.6, 0.0]]) {
      const ep = buildHoodedMarsLamp(6.4, railDark, brassRingMat, warmLantern, 1.38);
      ep.position.set(side * 9.0, pyY, pyZ);
      root.add(ep);
    }
  }

  // Monumental Constructivist Colonnade Obelisk Pylons & Inlaid Brass Mars Meridian Ring around Citadel!
  const meridianRing = new THREE.Mesh(new THREE.RingGeometry(52.8, 54.6, 64), brassRingMat);
  meridianRing.rotation.x = -Math.PI / 2;
  meridianRing.position.y = 0.22;
  root.add(meridianRing);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    if (Math.sin(a) > 0.85 && Math.abs(Math.cos(a)) < 0.42) continue;
    const og = new THREE.Group();
    og.position.set(Math.cos(a) * 53.7, 0, Math.sin(a) * 53.7);
    og.rotation.y = -a + Math.PI / 2;

    // 2-step chamfered basalt obelisk pedestal
    const oBase1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.2), basaltMat);
    oBase1.position.y = 0.6;
    og.add(oBase1);
    const oBase2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 2.5), railDark);
    oBase2.position.y = 1.65;
    og.add(oBase2);
    // Tapered monolithic basalt obelisk shaft
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 1.48, 10.6, 4), basaltMat);
    obelisk.position.y = 7.4;
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = true;
    og.add(obelisk);
    // Brass meridian inlay strips & stainless steel collar rings
    for (const cy of [4.8, 9.6, 12.2]) {
      const rC = THREE.MathUtils.lerp(1.36, 0.86, (cy - 2.1) / 10.6);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(rC * 1.54, 0.24, rC * 1.54), cy > 11 ? brassRingMat : railDark);
      collar.position.y = cy;
      og.add(collar);
    }
    const brassSpine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 9.2, 0.14), brassRingMat);
    brassSpine.position.set(0, 7.2, 0.95);
    brassSpine.rotation.x = 0.048;
    og.add(brassSpine);
    // Multi-fin shielded Constructivist beacon lantern crown (replaces bare flat cube!)
    const lanternCore = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.92, 8), warmLantern);
    lanternCore.position.y = 13.05;
    og.add(lanternCore);
    for (let k = 0; k < 4; k++) {
      const ka = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.34), railDark);
      fin.position.set(Math.cos(ka) * 0.56, 13.05, Math.sin(ka) * 0.56);
      fin.rotation.y = -ka;
      og.add(fin);
    }
    const crownCap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.65, 4), railDark);
    crownCap.rotation.y = Math.PI / 4;
    crownCap.position.y = 13.85;
    og.add(crownCap);

    root.add(og);
  }

  // Sculpted Constructivist 30X Stainless Flank Wing Buttresses embracing Tier 1 & Tier 2!
  for (const side of [-1, 1]) {
    const wg = new THREE.Group();
    const wingFin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 29.5, 2.2), railDark);
    wingFin.position.set(side * 47.6, 18.8, 0);
    wingFin.rotation.z = side * 0.14;
    wingFin.castShadow = true;
    wg.add(wingFin);
    const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.65, 28.8, 2.45), trimSteel);
    wingEdge.position.set(side * 49.8, 18.5, 0);
    wingEdge.rotation.z = side * 0.14;
    wg.add(wingEdge);
    const wingSlot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 24.0, 2.55), warmLantern);
    wingSlot.position.set(side * 47.2, 19.2, 0);
    wingSlot.rotation.z = side * 0.14;
    wg.add(wingSlot);
    root.add(wg);
  }

  // Tier 1 + Architectural Cornice Ledges + Recessed Hexagonal TPS Ceramic Frieze + Tier 2 + Top Statue Crown Collar
  const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(46.8, 50.0, 11.0, 8), basaltMat);
  tier1.rotation.y = Math.PI / 8;
  tier1.position.y = 10.9;
  tier1.castShadow = true;
  tier1.receiveShadow = true;
  root.add(tier1);

  const friezeLowerCornice = new THREE.Mesh(new THREE.CylinderGeometry(47.4, 46.8, 0.85, 8), railDark);
  friezeLowerCornice.rotation.y = Math.PI / 8;
  friezeLowerCornice.position.y = 16.4;
  root.add(friezeLowerCornice);

  const tpsFrieze = new THREE.Mesh(new THREE.CylinderGeometry(45.5, 46.4, 5.4, 8), tpsMat);
  tpsFrieze.rotation.y = Math.PI / 8;
  tpsFrieze.position.y = 19.1;
  tpsFrieze.castShadow = true;
  root.add(tpsFrieze);

  const friezeUpperCornice = new THREE.Mesh(new THREE.CylinderGeometry(46.9, 46.2, 0.95, 8), brassRingMat);
  friezeUpperCornice.rotation.y = Math.PI / 8;
  friezeUpperCornice.position.y = 21.85;
  root.add(friezeUpperCornice);

  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(45.2, 46.2, 13.0, 8), basaltMat);
  tier2.rotation.y = Math.PI / 8;
  tier2.position.y = 28.3;
  tier2.castShadow = true;
  tier2.receiveShadow = true;
  root.add(tier2);

  // Heavy welded 30X stainless top statue seating collar crowning Tier 2 at y = 34.4m!
  const topCrown = new THREE.Mesh(new THREE.CylinderGeometry(45.7, 45.2, 1.15, 8), railDark);
  topCrown.rotation.y = Math.PI / 8;
  topCrown.position.y = 34.55;
  root.add(topCrown);

  // Grand Human-Scale Ceremonial Front Staircase (18 steps @ 0.30m rise + brushed bronze cheek trim!)
  const stairGroup = new THREE.Group();
  const stepLightMat = new THREE.MeshBasicMaterial({ color: '#ffcb7a' });
  for (let i = 0; i < 18; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.32, 0.85), basaltMat);
    step.position.set(0, 0.16 + i * 0.30, 46.4 + (17 - i) * 0.64);
    step.receiveShadow = true;
    stairGroup.add(step);
    if (i % 3 === 0) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.05, 0.07), stepLightMat);
      strip.position.set(0, 0.32 + i * 0.30, 46.8 + (17 - i) * 0.64);
      stairGroup.add(strip);
    }
  }
  for (const sx of [-8.4, 8.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 13.4), basaltMat);
    rail.position.set(sx, 3.25, 51.9);
    rail.rotation.x = 0.42;
    rail.castShadow = true;
    stairGroup.add(rail);
    const railCap = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.16, 13.5), brassRingMat);
    railCap.position.set(sx, 4.22, 51.5);
    railCap.rotation.x = 0.42;
    stairGroup.add(railCap);
  }
  root.add(stairGroup);

  // Deep-Beveled Bronze & 30X Steel Monumental "AD ASTRA" Relief Plaque + Overhead Grazing Light Canopy!
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 1024;
  plaqueCanvas.height = 256;
  const pctx = plaqueCanvas.getContext('2d');
  pctx.fillStyle = '#171b21';
  pctx.fillRect(0, 0, 1024, 256);
  pctx.strokeStyle = '#d4a35d';
  pctx.lineWidth = 10;
  pctx.strokeRect(14, 14, 996, 228);
  pctx.strokeStyle = 'rgba(212,163,93,0.42)';
  pctx.lineWidth = 3;
  pctx.strokeRect(28, 28, 968, 200);
  pctx.fillStyle = '#f5d8a4';
  pctx.font = 'bold 88px serif';
  pctx.textAlign = 'center';
  pctx.fillText('A D   A S T R A', 512, 130);
  pctx.fillStyle = '#b4c0cc';
  pctx.font = 'bold 27px monospace';
  pctx.fillText('ARCADIA PLANITIA · 212M RECYCLED 30X STARSHIP STEEL', 512, 202);
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;

  const plaqueG = new THREE.Group();
  plaqueG.position.set(0, 28.0, 42.3);
  plaqueG.rotation.x = -0.07;
  const plaqueBack = new THREE.Mesh(new THREE.BoxGeometry(25.4, 7.2, 0.9), railDark);
  plaqueBack.position.z = -0.42;
  plaqueG.add(plaqueBack);
  const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(24.7, 6.6, 0.55), brassRingMat);
  plaqueFrame.position.z = -0.22;
  plaqueG.add(plaqueFrame);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(24.0, 6.0),
    new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.34, metalness: 0.72 })
  );
  plaque.position.z = 0.08;
  plaqueG.add(plaque);
  // Overhead cantilevered grazing-light hood & warm linear wash bar illuminating AD ASTRA
  const plaqueHood = new THREE.Mesh(new THREE.BoxGeometry(24.8, 0.38, 1.65), railDark);
  plaqueHood.position.set(0, 3.65, 0.65);
  plaqueG.add(plaqueHood);
  const plaqueWash = new THREE.Mesh(new THREE.BoxGeometry(23.2, 0.12, 0.24), warmLantern);
  plaqueWash.position.set(0, 3.42, 0.95);
  plaqueG.add(plaqueWash);
  root.add(plaqueG);

  // =========================================================================
  // 2. LOAD BLENDER 5.0 SCULPTED ELON MUSK COLOSSUS GLB (2.40× -> 177.6m STATUE!)
  //    y = 34.4 .. 212.0m above promontory (226.4m above Arcadia Colony Basin!)
  // =========================================================================
  const statueAnchor = new THREE.Group();
  statueAnchor.position.set(0, 34.4, 0);
  statueAnchor.scale.setScalar(2.40);
  root.add(statueAnchor);

  const loader = new GLTFLoader();
  let glbLoaded = false;
  decodeGzippedGlbBase64(COLOSSUS_GLB_GZIP_B64)
    .then((arrayBuffer) => {
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          gltf.scene.traverse((child) => {
            if (!child.isMesh) return;
            const n = (child.name || '').toLowerCase();
            const matName = (child.material && child.material.name ? child.material.name : '').toLowerCase();
            const isHead = n.includes('head') || matName.includes('head') || n.includes('001');
            child.material = isHead ? headSteelMat : coatSteelMat;
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }
          });
          statueAnchor.add(gltf.scene);
          glbLoaded = true;
        },
        (err) => {
          console.error('Failed to parse embedded Colossus GLB:', err);
        }
      );
    })
    .catch((err) => console.error('Failed to decompress Colossus GLB:', err));

  // =========================================================================
  // 3. GIMBALED AEROSPACE GRAZING UPLIGHT PROJECTORS (212m Range!)
  // =========================================================================
  const uplights = [];
  const housingMat = new THREE.MeshStandardMaterial({
    color: '#2b2f36',
    map: textures.ribSteelColor,
    normalMap: textures.ribSteelNormal,
    roughness: 0.48,
    metalness: 0.84
  });
  const lensMat = new THREE.MeshBasicMaterial({ color: '#ffcb80' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const ug = new THREE.Group();
    ug.position.set(Math.cos(a) * 45.2, 5.4, Math.sin(a) * 45.2);
    ug.rotation.y = -a + Math.PI / 2;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.55, 8), basaltMat);
    ped.position.y = 0.28;
    ug.add(ped);
    for (const yx of [-0.95, 0.95]) {
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.28), housingMat);
      yoke.position.set(yx, 1.15, 0);
      ug.add(yoke);
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 1.15, 12), housingMat);
    barrel.position.set(0, 1.52, 0);
    barrel.rotation.x = 0.22;
    ug.add(barrel);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.09, 6, 16), trimSteel);
    bezel.rotation.x = Math.PI / 2 + 0.22;
    bezel.position.set(0, 2.08, 0.12);
    ug.add(bezel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.76, 12), lensMat);
    lens.rotation.x = -Math.PI / 2 + 0.22;
    lens.position.set(0, 2.08, 0.12);
    ug.add(lens);
    root.add(ug);
  }

  const chestLight = new THREE.PointLight('#ffcf99', 48, 360, 1.05);
  chestLight.position.set(58, 126, 98);
  root.add(chestLight);
  uplights.push(chestLight);

  // Monumental sculptural 3/4 Rembrandt key uplight illuminating Elon's portrait clearly under backlit Mars Blue Sunset!
  const faceLight = new THREE.PointLight('#ffe4c4', 64, 340, 1.02);
  faceLight.position.set(44, 198, 86);
  root.add(faceLight);
  uplights.push(faceLight);

  return { group: root, uplights, isLoaded: () => glbLoaded && headTexCount >= 3 };
}
