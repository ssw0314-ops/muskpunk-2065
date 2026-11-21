import * as THREE from 'three';

/**
 * Shared High-Detail Asset Builder: Architectural Hooded Mars Promenade / Street Luminaire
 * (Replaces bare cylinder+sphere lollipops across Citadel, Plaza, and Outposts!)
 */
export function buildHoodedMarsLamp(height, darkMat, accentMat, glowMat, scale = 1.0) {
  const g = new THREE.Group();
  const s = scale;
  // Bolted octagonal steel base flange & stepped collar
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.36 * s, 0.24 * s, 8), darkMat);
  flange.position.y = 0.12 * s;
  g.add(flange);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 0.45 * s, 8), darkMat);
  collar.position.y = 0.44 * s;
  g.add(collar);
  // Tapered fluted shaft
  const shaftH = Math.max(1.2, height - 0.85 * s);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * s, 0.17 * s, shaftH, 8), darkMat);
  shaft.position.y = 0.62 * s + shaftH * 0.5;
  g.add(shaft);
  // Mid-shaft accent ring
  const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.14 * s, 0.025 * s, 6, 12), accentMat);
  midRing.rotation.x = Math.PI / 2;
  midRing.position.y = 0.62 * s + shaftH * 0.72;
  g.add(midRing);
  // Shielded architectural louver lantern head (top conical hood + vertical cage fins + recessed glowing core!)
  const headY = 0.62 * s + shaftH;
  const lowerRim = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.16 * s, 0.12 * s, 8), darkMat);
  lowerRim.position.y = headY + 0.04 * s;
  g.add(lowerRim);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.15 * s, 0.42 * s, 10), glowMat);
  core.position.y = headY + 0.30 * s;
  g.add(core);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.48 * s, 0.10 * s), darkMat);
    fin.position.set(Math.cos(a) * 0.22 * s, headY + 0.30 * s, Math.sin(a) * 0.22 * s);
    fin.rotation.y = -a + Math.PI / 2;
    g.add(fin);
  }
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 0.28 * s, 8), darkMat);
  hood.position.y = headY + 0.64 * s;
  g.add(hood);
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.09 * s, 0.14 * s, 6), accentMat);
  finial.position.y = headY + 0.80 * s;
  g.add(finial);
  return g;
}

/**
 * Shared High-Detail Asset Builder: Industrial Dual-Fan Mars HVAC / Atmospheric Scrubber Unit
 */
export function buildIndustrialHvacUnit(w, h, d, bodyMat, darkMat, accentMat) {
  const g = new THREE.Group();
  const baseSkid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.16, d + 0.2), darkMat);
  baseSkid.position.y = 0.08;
  g.add(baseSkid);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = 0.16 + h * 0.5;
  body.castShadow = true;
  g.add(body);
  // Twin rooftop cylindrical condenser fan shrouds + dark recessed intake discs
  const fanR = Math.min(w * 0.20, d * 0.34);
  for (const fx of [-w * 0.24, w * 0.24]) {
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(fanR, fanR * 1.08, 0.28, 12, 1, true), darkMat);
    shroud.position.set(fx, 0.16 + h + 0.14, 0);
    g.add(shroud);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(fanR * 0.26, fanR * 0.26, 0.24, 8), accentMat);
    hub.position.set(fx, 0.16 + h + 0.10, 0);
    g.add(hub);
    const grilleBar = new THREE.Mesh(new THREE.BoxGeometry(fanR * 1.9, 0.04, 0.06), darkMat);
    grilleBar.position.set(fx, 0.16 + h + 0.24, 0);
    g.add(grilleBar);
  }
  // Front heat-exchanger cooling louvers + side coolant manifold pipe
  for (let lv = 0; lv < 3; lv++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.08, 0.10), darkMat);
    slat.position.set(0, 0.35 + (lv + 0.5) * (h * 0.26), d * 0.5 + 0.02);
    g.add(slat);
  }
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h * 0.85, 6), accentMat);
  pipe.position.set(w * 0.5 + 0.10, 0.16 + h * 0.45, 0);
  g.add(pipe);
  return g;
}

/**
 * Shared High-Detail Asset Builder: Industrial Mars ISRU / Sabatier Cryogenic Storage Silo
 * (Concrete foundation skirt, welded ring stiffeners, caged vertical access ladder, rooftop guardrailed catwalk,
 *  pressure-relief vent stack, vertical downcomer piping & stenciled propellant band!)
 */
export function buildIndustrialCryoSilo(radius, height, textures, opts = {}) {
  const g = new THREE.Group();
  const r = radius;
  const h = height;
  const steelMat = opts.steelMat || new THREE.MeshStandardMaterial({
    color: '#c0c8d2', map: textures.steelColor, normalMap: textures.steelNormal,
    roughnessMap: textures.steelRough, roughness: 0.46, metalness: 0.78, envMapIntensity: 0.70
  });
  const darkMat = opts.darkMat || new THREE.MeshStandardMaterial({
    color: '#343a44', map: textures.ribSteelColor, normalMap: textures.ribSteelNormal,
    roughness: 0.52, metalness: 0.80
  });
  const concreteMat = opts.concreteMat || new THREE.MeshStandardMaterial({
    color: '#6b5c52', map: textures.basaltColor, normalMap: textures.basaltNormal,
    roughness: 0.90, metalness: 0.08
  });
  const accentMat = opts.accentMat || new THREE.MeshBasicMaterial({ color: '#45e6d6' });
  const hazardMat = opts.hazardMat || new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.55, metalness: 0.28 });

  // 1. Grounded octagonal sintered-basalt foundation plinth + steel anchor skirt
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.28, 1.8, 8), concreteMat);
  plinth.position.y = 0.6;
  plinth.receiveShadow = true;
  g.add(plinth);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.12, 1.6, 16), darkMat);
  skirt.position.y = 2.0;
  g.add(skirt);

  // 2. Main pressurized welded stainless cylindrical tank + elliptical dome crown
  const bodyH = Math.max(6, h - 2.2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 20), steelMat);
  body.position.y = 2.2 + bodyH * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), steelMat);
  dome.scale.set(1, 0.72, 1);
  dome.position.y = 2.2 + bodyH;
  g.add(dome);

  // 3. Circumferential welded stiffening rings & propellant ID stripe
  const ringCount = Math.max(3, Math.floor(bodyH / 5.2));
  for (let i = 1; i <= ringCount; i++) {
    const ry = 2.2 + (i / (ringCount + 0.2)) * bodyH;
    const isBand = i === ringCount - 1;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.02, isBand ? 0.18 : 0.12, 6, 22),
      isBand ? accentMat : darkMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    g.add(ring);
  }
  const topFlange = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, 0.16, 6, 22), hazardMat);
  topFlange.rotation.x = Math.PI / 2;
  topFlange.position.y = 2.2 + bodyH;
  g.add(topFlange);

  // 4. Rooftop circular inspection catwalk + yellow safety rail + pressure relief valve stack!
  const roofY = 2.2 + bodyH + r * 0.70;
  const catDeck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.18, 14), darkMat);
  catDeck.position.y = roofY;
  g.add(catDeck);
  const catRail = new THREE.Mesh(new THREE.TorusGeometry(r * 0.58, 0.06, 6, 16), hazardMat);
  catRail.rotation.x = Math.PI / 2;
  catRail.position.y = roofY + 1.05;
  g.add(catRail);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 5), hazardMat);
    post.position.set(Math.cos(a) * r * 0.58, roofY + 0.52, Math.sin(a) * r * 0.58);
    g.add(post);
  }
  const ventStack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 2.8, 8), darkMat);
  ventStack.position.set(-r * 0.16, roofY + 1.4, 0);
  g.add(ventStack);
  const ventCap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 8), steelMat);
  ventCap.position.set(-r * 0.16, roofY + 2.95, 0);
  g.add(ventCap);

  // 5. External caged climbing ladder + twin insulated vertical cryogenic feed/return downcomer pipes
  const ladX = r + 0.26;
  for (const lz of [-0.24, 0.24]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, bodyH + 1.2, 6), hazardMat);
    rail.position.set(ladX, 2.2 + bodyH * 0.5 + 0.5, lz);
    g.add(rail);
  }
  const cageStep = Math.max(3, Math.floor(bodyH / 3.2));
  for (let c = 0; c < cageStep; c++) {
    const cy = 4.2 + c * 3.1;
    if (cy > 2.2 + bodyH) break;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 5, 10, Math.PI), darkMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.rotation.z = -Math.PI / 2;
    hoop.position.set(ladX + 0.18, cy, 0);
    g.add(hoop);
  }
  // Twin vertical cryogenic downcomer pipes + lower valve manifold box on opposite side (-X)
  for (const pz of [-0.45, 0.45]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, bodyH * 0.92, 8), steelMat);
    pipe.position.set(-(r + 0.38), 2.2 + bodyH * 0.46, pz);
    g.add(pipe);
    const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.42), darkMat);
    elbow.position.set(-(r + 0.10), 2.2 + bodyH * 0.90, pz);
    g.add(elbow);
  }
  const manifold = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 2.2), darkMat);
  manifold.position.set(-(r + 0.72), 2.4, 0);
  g.add(manifold);

  return g;
}

/**
 * Shared High-Detail Asset Builder: Braced Spherical Cryogenic LOX / CH4 / H2O Hortonsphere Tank
 * (Grounded on concrete pier ring, cross-braced tubular legs, equatorial inspection catwalk + handrail,
 *  meridian weld bands, bottom discharge manifold & top flare stack — ZERO floating spheres!)
 */
export function buildCryoSphereTank(radius, textures, opts = {}) {
  const g = new THREE.Group();
  const r = radius;
  const centerY = r * 1.38;
  const steelMat = opts.steelMat || new THREE.MeshStandardMaterial({
    color: '#cad2dc', map: textures.steelColor, normalMap: textures.steelNormal,
    roughness: 0.42, metalness: 0.78
  });
  const darkMat = opts.darkMat || new THREE.MeshStandardMaterial({
    color: '#343a44', map: textures.ribSteelColor, normalMap: textures.ribSteelNormal,
    roughness: 0.50, metalness: 0.82
  });
  const concreteMat = opts.concreteMat || new THREE.MeshStandardMaterial({
    color: '#6b5c52', map: textures.basaltColor, normalMap: textures.basaltNormal, roughness: 0.90
  });
  const bandMat = opts.bandMat || new THREE.MeshBasicMaterial({ color: '#5eead4' });
  const hazardMat = opts.hazardMat || new THREE.MeshStandardMaterial({ color: '#d89b32', roughness: 0.55, metalness: 0.28 });

  // Grounded circular concrete foundation ring pad (extends -1.2m into sloped terrain so NEVER floats!)
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.24, 2.4, 16), concreteMat);
  pad.position.y = -0.7;
  pad.receiveShadow = true;
  g.add(pad);

  // Main insulated Hortonsphere pressure vessel + meridian weld seam bands
  const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), steelMat);
  sph.position.y = centerY;
  sph.castShadow = true;
  sph.receiveShadow = true;
  g.add(sph);

  const eqBand = new THREE.Mesh(new THREE.TorusGeometry(r * 1.015, 0.18, 6, 26), bandMat);
  eqBand.rotation.x = Math.PI / 2;
  eqBand.position.y = centerY;
  g.add(eqBand);

  // Equatorial maintenance catwalk ring + yellow safety rail
  const catRing = new THREE.Mesh(new THREE.TorusGeometry(r * 1.16, 0.22, 6, 24), darkMat);
  catRing.rotation.x = Math.PI / 2;
  catRing.scale.set(1, 1, 0.35);
  catRing.position.y = centerY - 0.55;
  g.add(catRing);
  const catRail = new THREE.Mesh(new THREE.TorusGeometry(r * 1.22, 0.055, 5, 24), hazardMat);
  catRail.rotation.x = Math.PI / 2;
  catRail.position.y = centerY + 0.45;
  g.add(catRail);

  // 6 Heavy Equatorial Support Columns anchored into concrete footings + diagonal X-bracing tie rods!
  const legCount = 6;
  const legR = r * 0.96;
  const legH = centerY + 0.4;
  for (let i = 0; i < legCount; i++) {
    const a = (i / legCount) * Math.PI * 2;
    const lx = Math.cos(a) * legR, lz = Math.sin(a) * legR;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.1), concreteMat);
    foot.position.set(lx, 0.2, lz);
    g.add(foot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, legH, 8), darkMat);
    leg.position.set(lx, legH * 0.5, lz);
    leg.castShadow = true;
    g.add(leg);
    // Horizontal tie girder & diagonal brace to next column
    const aNext = ((i + 1) / legCount) * Math.PI * 2;
    const p1 = new THREE.Vector3(lx, legH * 0.36, lz);
    const p2 = new THREE.Vector3(Math.cos(aNext) * legR, legH * 0.36, Math.sin(aNext) * legR);
    const span = p1.distanceTo(p2);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, span, 6), darkMat);
    tie.position.copy(p1).add(p2).multiplyScalar(0.5);
    tie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
    g.add(tie);
  }

  // Bottom cryo discharge manifold pipe + valve house directly under south pole of sphere
  const dropPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, centerY - r + 0.9, 10), darkMat);
  dropPipe.position.y = (centerY - r + 0.9) * 0.5;
  g.add(dropPipe);
  const valveSkid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), darkMat);
  valveSkid.position.y = 0.85;
  g.add(valveSkid);

  // Top pressure-relief flare stack + access hatch
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.24, r * 0.30, 0.65, 10), darkMat);
  topCap.position.y = centerY + r + 0.15;
  g.add(topCap);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8), steelMat);
  flare.position.set(0.35, centerY + r + 1.4, 0);
  g.add(flare);

  return g;
}
