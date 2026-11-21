import * as THREE from 'three';

/**
 * PHOTOREALISTIC GPU-INSTANCED VOLUMETRIC FRACTAL CLOUD ENGINE (WebGL2 GLSL)
 * ---------------------------------------------------------------------------
 * Film-grade single-draw-call InstancedBufferGeometry fluid smoke & Martian regolith
 * dust renderer designed for ACES Filmic Linear-HDR pipelines (zero cartoon cotton balls,
 * zero blown-out white bloom!).
 *
 * Optical features per fragment:
 *  - Hybrid 512x512 multi-lobe volumetric base atlas + PIXEL-SHARP 4-octave live GLSL FBM
 *    domain-warped turbulence & micro-bump normal perturbation (razor-sharp even 5m away!)
 *  - Feathery translucent wispy filament edge dissolution (zero hard sticker outlines!)
 *  - True 3D world-space normal reconstruction, wrapped Martian directional sunlight,
 *    Beer-Lambert deep crevice self-shadowing & Henyey-Greenstein backlit silver-lining
 *  - Tight physically-calibrated internal Raptor 3 molten-amber/violet subsurface fire-scatter
 *    so ONLY the blast core blazes incandescently while outer billows keep full dark relief!
 *  - Back-to-front camera sorting + Martian exponential² atmospheric aerial perspective
 */
export function createVolumetricCloudSystem(cloudAtlas, maxParticles = 520, options = {}) {
  const maxRenderOrder = options.renderOrder ?? 6;

  const basePlane = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = basePlane.index;
  geo.attributes.position = basePlane.attributes.position;
  geo.attributes.uv = basePlane.attributes.uv;

  const posSizeArr = new Float32Array(maxParticles * 4); // x, y, z, size
  const rotAgeArr  = new Float32Array(maxParticles * 4); // rot, age01, tileSeed, opacity
  const litColArr  = new Float32Array(maxParticles * 3); // linear sunlit crest RGB
  const shadColArr = new Float32Array(maxParticles * 3); // linear deep self-shadow RGB
  const paramsArr  = new Float32Array(maxParticles * 4); // density, engineScatter, stretchY, wispiness

  const posSizeAttr = new THREE.InstancedBufferAttribute(posSizeArr, 4).setUsage(THREE.DynamicDrawUsage);
  const rotAgeAttr  = new THREE.InstancedBufferAttribute(rotAgeArr, 4).setUsage(THREE.DynamicDrawUsage);
  const litColAttr  = new THREE.InstancedBufferAttribute(litColArr, 3).setUsage(THREE.DynamicDrawUsage);
  const shadColAttr = new THREE.InstancedBufferAttribute(shadColArr, 3).setUsage(THREE.DynamicDrawUsage);
  const paramsAttr  = new THREE.InstancedBufferAttribute(paramsArr, 4).setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('aPosSize', posSizeAttr);
  geo.setAttribute('aRotAge',  rotAgeAttr);
  geo.setAttribute('aLitCol',  litColAttr);
  geo.setAttribute('aShadCol', shadColAttr);
  geo.setAttribute('aParams',  paramsAttr);
  geo.instanceCount = 0;

  const lightPos = [];
  const lightCol = [];
  const lightRad = [];
  for (let i = 0; i < 4; i++) {
    lightPos.push(new THREE.Vector3(0, -9999, 0));
    lightCol.push(new THREE.Color('#ff7a2e'));
    lightRad.push(30.0);
  }

  const uniforms = {
    uAtlas:       { value: cloudAtlas },
    uTime:        { value: 0 },
    uSunDir:      { value: new THREE.Vector3(0.74, 0.25, 0.62).normalize() },
    uSunCol:      { value: new THREE.Color('#ffd09b') },
    uAmbientCol:  { value: new THREE.Color('#6a3b2a') },
    uFogColor:    { value: new THREE.Color('#cc885c') },
    uFogDensity:  { value: 0.00042 },
    uEnginePos:   { value: lightPos },
    uEngineCol:   { value: lightCol },
    uEnginePower: { value: [0, 0, 0, 0] },
    uEngineRad:   { value: lightRad }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 aPosSize;
      attribute vec4 aRotAge;
      attribute vec3 aLitCol;
      attribute vec3 aShadCol;
      attribute vec4 aParams;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vCamRight;
      varying vec3 vCamUp;
      varying vec3 vCamFwd;
      varying vec4 vRotAge;
      varying vec3 vLitCol;
      varying vec3 vShadCol;
      varying vec4 vParams;
      varying float vCamDist;

      void main() {
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 camFwd   = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);

        float rot = aRotAge.x;
        float c = cos(rot);
        float s = sin(rot);
        vec2 p = position.xy;
        vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

        float sz = aPosSize.w;
        float stretchY = aParams.z;
        vec3 worldPos = aPosSize.xyz + camRight * (rp.x * sz) + camUp * (rp.y * sz * stretchY);

        vUv = uv;
        vWorldPos = worldPos;
        vCamRight = camRight;
        vCamUp = camUp;
        vCamFwd = camFwd;
        vRotAge = aRotAge;
        vLitCol = aLitCol;
        vShadCol = aShadCol;
        vParams = aParams;

        vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
        vCamDist = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uAmbientCol;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uEnginePos[4];
      uniform vec3 uEngineCol[4];
      uniform float uEnginePower[4];
      uniform float uEngineRad[4];

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vCamRight;
      varying vec3 vCamUp;
      varying vec3 vCamFwd;
      varying vec4 vRotAge;
      varying vec3 vLitCol;
      varying vec3 vShadCol;
      varying vec4 vParams;
      varying float vCamDist;

      // Fast pixel-sharp 2D gradient/value noise & 4-octave fractal billow turbulence (zero blurry texels!)
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm4(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = m * p * 2.04 + vec2(17.1, 31.7);
          a *= 0.50;
        }
        return v;
      }

      void main() {
        float rot       = vRotAge.x;
        float age       = vRotAge.y;
        float seedPack  = vRotAge.z;
        float baseOp    = vRotAge.w;
        float density   = vParams.x;
        float engScat   = vParams.y;
        float wispiness = vParams.w; // 0.6 = thick pyroclastic dust, 1.4 = feathery gossamer cryo mist!

        if (baseOp <= 0.004) discard;

        float tileIdx = mod(floor(seedPack), 4.0);
        float seed = fract(seedPack) * 19.7 + tileIdx * 3.7;

        vec2 centerVec = (vUv - 0.5) * 2.0;
        float rad = length(centerVec);
        if (rad > 1.02) discard;

        // Live domain-warped fluid coordinate for genuine turbulent boiling & wispy edge fraying!
        vec2 flowP = vUv * (3.4 + wispiness * 1.1) + vec2(seed, seed * 0.73) + vec2(age * 0.35, -age * 0.62);
        vec2 curlW = vec2(fbm4(flowP) - 0.5, fbm4(flowP + vec2(5.2, 1.3)) - 0.5);
        float fineFbm = fbm4(flowP * 1.85 + curlW * 1.45);
        // Ridged cauliflower turbulence (creates crisp boiling rocket-plume eddies!)
        float billow = 1.0 - abs(fineFbm * 2.0 - 1.0);
        float microDetail = mix(fineFbm, billow, 0.58);

        // Sample 2x2 sculpted multi-lobe cloud atlas warped by live fluid curl!
        vec2 tileOff = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
        vec2 warpedUv = clamp(vUv + curlW * (0.14 + age * 0.10), 0.015, 0.985);
        vec4 tex0 = texture2D(uAtlas, tileOff + warpedUv * 0.5);

        // Feathery, turbulent organic silhouette (ZERO hard cartoon circle/popcorn borders!)
        float radialSoft = pow(clamp(1.0 - smoothstep(0.18, 0.98, rad), 0.0, 1.0), 1.25);
        float macroMass = mix(radialSoft, tex0.a * radialSoft, 0.68);
        // Carve genuine fractal wisps into the edges — gets airier & more feathery as puff matures!
        float erode = 0.08 + smoothstep(0.15, 1.0, age) * 0.42 * wispiness + (wispiness - 0.8) * 0.10;
        float cloudField = macroMass * (0.48 + microDetail * 0.92) - erode;
        float alpha = clamp(smoothstep(0.0, 0.44 + wispiness * 0.16, cloudField) * density * baseOp, 0.0, 0.92);
        if (alpha <= 0.008) discard;

        // Finite-difference 2-tap high-frequency fractal bump normal + atlas macro cauliflower normal!
        float fX = fbm4((flowP + vec2(0.09, 0.0)) * 1.85 + curlW * 1.45);
        float fY = fbm4((flowP + vec2(0.0, 0.09)) * 1.85 + curlW * 1.45);
        vec2 microGrad = vec2(fineFbm - fX, fineFbm - fY) * 4.2;

        vec2 atlasN = (tex0.rg * 2.0 - 1.0) * 1.15;
        vec2 n2 = clamp(atlasN + microGrad + centerVec * 0.52, -0.98, 0.98);
        float nz = sqrt(max(0.10, 1.0 - dot(n2, n2)));
        float c = cos(rot), s = sin(rot);
        vec2 rn = vec2(n2.x * c - n2.y * s, n2.x * s + n2.y * c);
        vec3 Nworld = normalize(vCamRight * rn.x + vCamUp * rn.y - vCamFwd * nz);

        // 1. Photorealistic Martian Sunlight + Deep Crevice Powder / Beer-Lambert Self-Shadowing!
        vec3 sunD = normalize(uSunDir);
        float ndl = dot(Nworld, sunD);
        float sunWrap = clamp(ndl * 0.58 + 0.42, 0.0, 1.0);
        // Deep volcanic crevices stay dramatically dark while sunlit cauliflower crests pop!
        float creviceAO = mix(0.46, 1.12, clamp(microDetail * 0.65 + (1.0 - tex0.a * 0.35) * 0.35, 0.0, 1.0));
        float topFill = clamp(Nworld.y * 0.5 + 0.5, 0.0, 1.0);

        float litFactor = smoothstep(0.10, 0.88, sunWrap * (0.72 + topFill * 0.36));
        vec3 col = mix(vShadCol, vLitCol, litFactor) * creviceAO;

        // Subtle Martian sky fill on upper domes + physically bounded backlit silver-lining rim!
        vec3 viewToPuff = normalize(vWorldPos - cameraPosition);
        float sunFwd = pow(max(0.0, dot(viewToPuff, sunD)), 5.0);
        float thinRim = pow(clamp(1.0 - alpha * 0.88, 0.0, 1.0), 1.7);
        col += uAmbientCol * topFill * 0.16;
        col += uSunCol * (sunFwd * 0.34 + pow(max(0.0, ndl), 3.0) * 0.14) * thinRim;

        // 2. TIGHT INTERNAL RAPTOR 3 / BOOSTER SUBSURFACE FIRE-SCATTERING!
        //    Blazes fierce molten amber-white ONLY inside the core near active engine bells;
        //    leaves outer 50-120m Martian dust & steam walls crisp and richly shadowed!
        if (engScat > 0.01) {
          vec3 fireAccum = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            float ep = uEnginePower[i];
            if (ep > 0.02) {
              vec3 toEng = uEnginePos[i] - vWorldPos;
              float dist = length(toEng);
              float radL = max(3.0, uEngineRad[i]);
              if (dist < radL * 2.8) {
                // Sharp physically realistic inverse-exponential falloff from flame core!
                float atten = exp(-pow(dist / radL, 1.35)) * ep * engScat;
                vec3 engDir = toEng / (dist + 0.001);
                // Only the side of each cauliflower billow FACING the rocket flame catches fierce orange fire!
                float facing = pow(clamp(dot(Nworld, engDir) * 0.65 + 0.35, 0.0, 1.0), 1.6);
                // Thin smoky wisps right next to flame transmit warm fiery glow
                float transmit = thinRim * 0.65 * exp(-dist / (radL * 0.85));
                fireAccum += uEngineCol[i] * atten * (facing * 0.88 + transmit * 0.72);
              }
            }
          }
          // Soft shoulder knee prevents over-blooming the entire cloud bank into flat white!
          col += fireAccum / (1.0 + fireAccum * 0.48);
        }

        // 3. Martian Exponential² Atmospheric Aerial Perspective Fog (sits naturally in the basin!)
        float fogF = 1.0 - exp(-pow(max(0.0, vCamDist) * uFogDensity, 2.0));
        col = mix(col, uFogColor * 0.58, clamp(fogF * 0.80, 0.0, 0.88));

        // Soft camera lens proximity fade
        float nearFade = smoothstep(2.2, 7.5, vCamDist);
        gl_FragColor = vec4(col, alpha * nearFade);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = maxRenderOrder;

  const pool = [];
  for (let i = 0; i < maxParticles; i++) {
    pool.push({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      drag: 0.9,
      buoyancy: 0,
      curlUp: 0,
      originX: 0, originZ: 0,
      age: 0, maxLife: 1,
      startSize: 4, endSize: 18,
      rot: 0, rotVel: 0,
      tileSeed: 0,
      maxOp: 0.7,
      density: 1.0,
      scatter: 1.0,
      stretchY: 1.0,
      wispiness: 1.0,
      litR: 0.4, litG: 0.2, litB: 0.1,
      shadR: 0.06, shadG: 0.02, shadB: 0.01,
      camDistSq: 0
    });
  }

  let cursor = 0;
  const activeList = [];

  function spawn(cfg) {
    let slot = null;
    for (let k = 0; k < maxParticles; k++) {
      const idx = (cursor + k) % maxParticles;
      if (!pool[idx].active) {
        slot = pool[idx];
        cursor = (idx + 1) % maxParticles;
        break;
      }
    }
    if (!slot) {
      slot = pool[cursor];
      cursor = (cursor + 1) % maxParticles;
    }

    slot.active = true;
    slot.x = cfg.x; slot.y = cfg.y; slot.z = cfg.z;
    slot.vx = cfg.vx || 0; slot.vy = cfg.vy || 0; slot.vz = cfg.vz || 0;
    slot.drag = cfg.drag ?? 0.62;
    slot.buoyancy = cfg.buoyancy ?? 0.0;
    slot.curlUp = cfg.curlUp ?? 0.0;
    slot.originX = cfg.originX ?? cfg.x;
    slot.originZ = cfg.originZ ?? cfg.z;
    slot.age = cfg.initAge || 0;
    slot.maxLife = cfg.maxLife || 3.5;
    slot.startSize = cfg.startSize || 8;
    slot.endSize = cfg.endSize || 28;
    slot.rot = cfg.rot ?? (Math.random() * Math.PI * 2);
    slot.rotVel = cfg.rotVel ?? ((Math.random() - 0.5) * 0.65);
    slot.tileSeed = (cfg.tile ?? Math.floor(Math.random() * 4)) + Math.random() * 0.95;
    slot.maxOp = cfg.maxOp ?? 0.75;
    slot.density = cfg.density ?? 1.05;
    slot.scatter = cfg.scatter ?? 1.0;
    slot.stretchY = cfg.stretchY ?? 1.0;
    slot.wispiness = cfg.wispiness ?? 0.95;

    const lc = cfg.litCol || [0.38, 0.14, 0.06];
    const sc = cfg.shadCol || [0.05, 0.016, 0.009];
    slot.litR = lc[0]; slot.litG = lc[1]; slot.litB = lc[2];
    slot.shadR = sc[0]; slot.shadG = sc[1]; slot.shadB = sc[2];
    return slot;
  }

  function setEngineLight(idx, x, y, z, power, radius = 30, r = 1.15, g = 0.36, b = 0.08) {
    if (idx < 0 || idx >= 4) return;
    uniforms.uEnginePos.value[idx].set(x, y, z);
    uniforms.uEnginePower.value[idx] = power;
    uniforms.uEngineRad.value[idx] = radius;
    uniforms.uEngineCol.value[idx].setRGB(r, g, b);
  }

  function setSunLighting(preset) {
    if (!preset) return;
    if (preset.sunDir) uniforms.uSunDir.value.copy(preset.sunDir).normalize();
    if (preset.sunColor) uniforms.uSunCol.value.copy(preset.sunColor);
    if (preset.hemiSky) uniforms.uAmbientCol.value.copy(preset.hemiSky).multiplyScalar(0.55);
    if (preset.fogColor) uniforms.uFogColor.value.copy(preset.fogColor);
    if (preset.fogDensity !== undefined) uniforms.uFogDensity.value = preset.fogDensity;
  }

  function step(dt, t, cameraPos = null) {
    uniforms.uTime.value = t;
    activeList.length = 0;

    const cx = cameraPos ? cameraPos.x : 0;
    const cy = cameraPos ? cameraPos.y : 20;
    const cz = cameraPos ? cameraPos.z : 0;

    for (let i = 0; i < maxParticles; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        continue;
      }
      const f = p.age / p.maxLife;
      const damp = Math.pow(p.drag, dt);
      p.vx *= damp;
      p.vz *= damp;
      p.vy = p.vy * Math.pow(Math.max(0.25, p.drag), dt) + p.buoyancy * dt;

      if (p.curlUp > 0.01) {
        const rx = p.x - p.originX;
        const rz = p.z - p.originZ;
        const rDist = Math.hypot(rx, rz);
        if (rDist > 16.0) {
          p.vy += p.curlUp * Math.min(1.0, (rDist - 16.0) / 38.0) * (1.0 - f * 0.5) * dt;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotVel * dt * (1.0 - f * 0.45);

      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      p.camDistSq = dx * dx + dy * dy + dz * dz;
      activeList.push(p);
    }

    if (cameraPos && activeList.length > 1) {
      activeList.sort((a, b) => b.camDistSq - a.camDistSq);
    }

    const count = activeList.length;
    for (let i = 0; i < count; i++) {
      const p = activeList[i];
      const f = p.age / p.maxLife;
      const growT = 1.0 - Math.pow(1.0 - f, 2.1);
      const sz = p.startSize + (p.endSize - p.startSize) * growT;
      const fadeIn = Math.min(1.0, f / 0.10);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(f, 0.46, 1.0);
      const op = fadeIn * fadeOut * p.maxOp;

      const i4 = i * 4;
      const i3 = i * 3;
      posSizeArr[i4]     = p.x;
      posSizeArr[i4 + 1] = p.y;
      posSizeArr[i4 + 2] = p.z;
      posSizeArr[i4 + 3] = sz;

      rotAgeArr[i4]     = p.rot;
      rotAgeArr[i4 + 1] = f;
      rotAgeArr[i4 + 2] = p.tileSeed;
      rotAgeArr[i4 + 3] = op;

      litColArr[i3]     = p.litR;
      litColArr[i3 + 1] = p.litG;
      litColArr[i3 + 2] = p.litB;

      shadColArr[i3]     = p.shadR;
      shadColArr[i3 + 1] = p.shadG;
      shadColArr[i3 + 2] = p.shadB;

      paramsArr[i4]     = p.density;
      paramsArr[i4 + 1] = p.scatter;
      paramsArr[i4 + 2] = p.stretchY;
      paramsArr[i4 + 3] = p.wispiness;
    }

    geo.instanceCount = count;
    if (count > 0) {
      posSizeAttr.needsUpdate = true;
      rotAgeAttr.needsUpdate = true;
      litColAttr.needsUpdate = true;
      shadColAttr.needsUpdate = true;
      paramsAttr.needsUpdate = true;
    }
  }

  return {
    mesh,
    spawn,
    step,
    setEngineLight,
    setSunLighting
  };
}

/**
 * BALLISTIC LAUNCHPAD SPARKS, MOLTEN CONCRETE EMBERS & MARTIAN REGOLITH CLODS (0.38G!)
 * Single InstancedMesh draw call launching incandescent streaks & dark flying rocks out of
 * the flame trench during Starship Raptor 3 ignition, liftoff, and hoverslam touchdown!
 */
export function createLaunchEjectaSystem(maxCount = 240) {
  const geo = new THREE.BoxGeometry(0.18, 0.18, 1.0);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
  mesh.frustumCulled = false;
  const _initCol = new THREE.Color('#ffffff');
  for (let i = 0; i < maxCount; i++) mesh.setColorAt(i, _initCol);
  mesh.instanceColor.needsUpdate = true;
  mesh.count = 0;

  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();
  const velDir = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  const pool = [];
  for (let i = 0; i < maxCount; i++) {
    pool.push({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      floorY: 0,
      age: 0, maxLife: 1,
      size: 0.4,
      isSpark: true
    });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, floorY, isSpark = true, size = 0.45, maxLife = 1.6) {
    let slot = pool[cursor];
    cursor = (cursor + 1) % maxCount;
    slot.active = true;
    slot.x = x; slot.y = y; slot.z = z;
    slot.vx = vx; slot.vy = vy; slot.vz = vz;
    slot.floorY = floorY;
    slot.age = 0;
    slot.maxLife = maxLife;
    slot.size = size;
    slot.isSpark = isSpark;
  }

  function step(dt) {
    let n = 0;
    for (let i = 0; i < maxCount; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy -= 3.71 * dt * (p.isSpark ? 1.4 : 2.1);
      p.vx *= Math.pow(0.84, dt);
      p.vz *= Math.pow(0.84, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      if (p.y < p.floorY + 0.15) {
        p.y = p.floorY + 0.15;
        p.vy = Math.abs(p.vy) * 0.32;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }

      const f = p.age / p.maxLife;
      const spd = Math.hypot(p.vx, p.vy, p.vz);
      dummy.position.set(p.x, p.y, p.z);

      if (p.isSpark) {
        if (spd > 0.2) {
          velDir.set(p.vx / spd, p.vy / spd, p.vz / spd);
          dummy.quaternion.setFromUnitVectors(zAxis, velDir);
        }
        const len = Math.min(5.2, 0.70 + spd * 0.075) * (1.0 - f * 0.65);
        const thick = p.size * (1.0 - f * 0.65);
        dummy.scale.set(thick, thick, len);
        // Blazing incandescent HDR white-gold -> molten orange -> glowing crimson ember!
        if (f < 0.28) colorTmp.setRGB(1.8, 1.35, 0.75);
        else if (f < 0.68) colorTmp.setRGB(1.4, 0.45, 0.08);
        else colorTmp.setRGB(0.65 * (1.0 - f) * 2.5, 0.12 * (1.0 - f) * 2.5, 0.03);
      } else {
        dummy.rotation.set(p.age * 7.5 + i, p.age * 5.2, i * 1.3);
        const s = p.size * (1.0 - f * 0.35);
        dummy.scale.set(s * 1.25, s * 0.85, s);
        colorTmp.setRGB(0.14, 0.06, 0.04);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, colorTmp);
      n++;
    }
    mesh.count = n;
    if (n > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  return { mesh, spawn, step };
}
