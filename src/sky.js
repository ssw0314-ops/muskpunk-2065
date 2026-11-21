import * as THREE from 'three';

// Side-raking golden Martian sunlight (matching Scene 03/06!) so the 100m Colossus's crossed arms,
// chiseled face, basalt stairs, regolith domes, Roadster & Starships gleam with dramatic sculptural relief!
export const SKY_PRESETS = {
  dusk: {
    name: '황혼 골든 오커 (Scene 03/06)',
    sunDir: new THREE.Vector3(0.74, 0.25, 0.62).normalize(), // Golden late-afternoon raking light from SE onto NW monuments!
    horizonGlowDir: new THREE.Vector3(0.55, 0.08, -0.83).normalize(),
    zenith: new THREE.Color('#52352c'),
    mid: new THREE.Color('#bc7247'),
    horizon: new THREE.Color('#ebb17e'),
    sunHalo: new THREE.Color('#ffdaa8'),
    sunColor: new THREE.Color('#ffd09b'),
    sunIntensity: 3.35,
    hemiSky: new THREE.Color('#d9966a'),
    hemiGround: new THREE.Color('#5a301f'),
    hemiIntensity: 1.25,
    fogColor: new THREE.Color('#cc885c'),
    fogDensity: 0.00042,
    starAlpha: 0.14,
    uplightMul: 1.0
  },
  blueSunset: {
    name: '화성 푸른 노을 (Mie Scattering)',
    sunDir: new THREE.Vector3(0.52, 0.11, -0.85).normalize(), // Low sun behind Megaport creating true pale blue Martian sunset!
    horizonGlowDir: new THREE.Vector3(0.52, 0.11, -0.85).normalize(),
    zenith: new THREE.Color('#211c26'),
    mid: new THREE.Color('#7f4c3a'),
    horizon: new THREE.Color('#b6a298'),
    sunHalo: new THREE.Color('#9cd6f7'),
    sunColor: new THREE.Color('#d2ebff'),
    sunIntensity: 2.45,
    hemiSky: new THREE.Color('#8ba8c4'),
    hemiGround: new THREE.Color('#42251c'),
    hemiIntensity: 1.10,
    fogColor: new THREE.Color('#937b71'),
    fogDensity: 0.00046,
    starAlpha: 0.45,
    uplightMul: 1.6
  },
  noon: {
    name: '아르카디아 주간 (Sol Noon)',
    sunDir: new THREE.Vector3(0.45, 0.74, 0.50).normalize(),
    horizonGlowDir: new THREE.Vector3(0.45, 0.74, 0.50).normalize(),
    zenith: new THREE.Color('#7d4c32'),
    mid: new THREE.Color('#cd8252'),
    horizon: new THREE.Color('#efc08e'),
    sunHalo: new THREE.Color('#fff4dc'),
    sunColor: new THREE.Color('#ffe9cc'),
    sunIntensity: 3.7,
    hemiSky: new THREE.Color('#e2ab80'),
    hemiGround: new THREE.Color('#704028'),
    hemiIntensity: 1.28,
    fogColor: new THREE.Color('#d49567'),
    fogDensity: 0.00032,
    starAlpha: 0.0,
    uplightMul: 0.35
  }
};

export function createMarsSky(scene, renderer) {
  const uniforms = {
    uSunDir: { value: SKY_PRESETS.dusk.horizonGlowDir.clone() },
    uZenith: { value: SKY_PRESETS.dusk.zenith.clone() },
    uMid: { value: SKY_PRESETS.dusk.mid.clone() },
    uHorizon: { value: SKY_PRESETS.dusk.horizon.clone() },
    uSunHalo: { value: SKY_PRESETS.dusk.sunHalo.clone() },
    uStarAlpha: { value: SKY_PRESETS.dusk.starAlpha },
    uDust: { value: 0.0 },
    uTime: { value: 0.0 },
    uCloudAlpha: { value: 1.0 }
  };

  const skyGeo = new THREE.SphereGeometry(2400, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunHalo;
      uniform float uStarAlpha;
      uniform float uDust;
      uniform float uTime;
      uniform float uCloudAlpha;
      varying vec3 vWorldDir;

      float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

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

      float fbm4(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = m * p * 2.04 + vec2(11.3, 27.9);
          a *= 0.50;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float y = clamp(d.y, 0.0, 1.0);

        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.26, y));
        col = mix(col, uZenith, smoothstep(0.20, 0.80, y));

        // Atmospheric horizon forward dust scatter halo
        vec3 sDir = normalize(uSunDir);
        float sunCos = max(dot(d, sDir), 0.0);
        float broadHalo = pow(sunCos, 5.0) * 0.36;
        float tightHalo = pow(sunCos, 54.0) * 0.62;
        float sunDisk = smoothstep(0.9996, 0.9999, sunCos) * 2.8;
        col += uSunHalo * (broadHalo + tightHalo) * (1.0 - uDust * 0.65);
        col += vec3(1.0, 0.97, 0.92) * sunDisk * (1.0 - uDust * 0.88);

        // High-Altitude Domain-Warped Martian CO2 Ice-Crystal Cirrus Clouds (Scene 03/06!)
        if (uCloudAlpha > 0.01 && d.y > 0.025) {
          vec2 skyPlane = d.xz / (d.y + 0.16);
          vec2 drift1 = vec2(uTime * 0.008, -uTime * 0.003);
          vec2 p1 = skyPlane * vec2(0.52, 1.25) + drift1;
          vec2 warp = vec2(fbm4(p1 * 1.1) - 0.5, fbm4(p1 * 1.1 + vec2(4.7, 2.1)) - 0.5);
          float c1 = fbm4(p1 * 1.65 + warp * 1.45);
          float c2 = fbm4(skyPlane * vec2(1.15, 2.35) - drift1 * 1.4 + warp * 1.1);
          float wisps = smoothstep(0.46, 0.84, mix(c1, c2, 0.42));
          // Directional self-shadow gradient along sun vector across cirrus bands
          float cLit = fbm4((p1 + sDir.xz * 0.14) * 1.65 + warp * 1.45);
          float sunEdge = clamp((c1 - cLit) * 2.2 + 0.55, 0.0, 1.0);
          float altFade = smoothstep(0.025, 0.17, d.y) * (1.0 - smoothstep(0.68, 0.98, d.y));
          float cloudDensity = wisps * altFade * (1.0 - uDust * 0.78) * uCloudAlpha * 0.46;

          vec3 cloudShadow = mix(uZenith, uMid, 0.45) * 0.82;
          vec3 cloudLit = mix(uHorizon, uSunHalo, 0.52 + pow(sunCos, 3.0) * 0.48);
          vec3 cloudCol = mix(cloudShadow, cloudLit, sunEdge);
          // Backlit silver-lining rim around sun disk
          cloudCol += uSunHalo * pow(sunCos, 8.0) * (1.0 - wisps * 0.65) * 0.65;
          col = mix(col, cloudCol, clamp(cloudDensity, 0.0, 0.72));
        }

        if (d.y < 0.0) {
          col = mix(uHorizon * 0.72, uZenith * 0.35, clamp(-d.y * 4.0, 0.0, 1.0));
        }

        if (uStarAlpha > 0.01 && d.y > 0.16) {
          vec3 grid = floor(d * 340.0);
          float s = hash3(grid);
          if (s > 0.9972) {
            float b = (s - 0.9972) / 0.0028;
            col += vec3(0.92, 0.96, 1.0) * b * uStarAlpha * smoothstep(0.16, 0.45, d.y) * (1.0 - uDust);
          }
        }

        col = mix(col, vec3(0.68, 0.38, 0.22), uDust * 0.62);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Subtle irregular Phobos moon
  const phobosGeo = new THREE.IcosahedronGeometry(12, 1);
  phobosGeo.scale(1.25, 0.9, 0.85);
  const phobos = new THREE.Mesh(
    phobosGeo,
    new THREE.MeshStandardMaterial({ color: '#cfc0b2', roughness: 0.95, emissive: '#3e332c', emissiveIntensity: 0.3 })
  );
  phobos.position.set(-540, 560, -1450);
  scene.add(phobos);

  // Primary Martian Directional Sun (Side-raking onto 212m Colossus, Domes & Starships!)
  const sunLight = new THREE.DirectionalLight(SKY_PRESETS.dusk.sunColor, SKY_PRESETS.dusk.sunIntensity);
  sunLight.position.copy(SKY_PRESETS.dusk.sunDir).multiplyScalar(460);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 25;
  sunLight.shadow.camera.far = 1150;
  const sBounds = 285;
  sunLight.shadow.camera.left = -sBounds;
  sunLight.shadow.camera.right = sBounds;
  sunLight.shadow.camera.top = sBounds;
  sunLight.shadow.camera.bottom = -sBounds;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.target.position.set(-22, 48, -52);

  // Soft opposite rim fill light from Martian dusty sky bounce so shadow sides retain rich sculptural detail
  const rimLight = new THREE.DirectionalLight('#b0826a', 0.85);
  rimLight.position.set(-220, 90, -240);
  scene.add(rimLight);

  const hemiLight = new THREE.HemisphereLight(
    SKY_PRESETS.dusk.hemiSky,
    SKY_PRESETS.dusk.hemiGround,
    SKY_PRESETS.dusk.hemiIntensity
  );
  scene.add(hemiLight);

  scene.fog = new THREE.FogExp2(SKY_PRESETS.dusk.fogColor, SKY_PRESETS.dusk.fogDensity);

  // Bake lustrous metallic PMREM environment map directly from the Martian Sky Shader!
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;

  function bakeEnvironment() {
    const prevCloud = uniforms.uCloudAlpha.value;
    uniforms.uCloudAlpha.value = 0.0; // Keep metallic PMREM reflections silky smooth!
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat);
    envScene.add(envSky);
    const bounce = new THREE.Mesh(
      new THREE.CircleGeometry(48, 24),
      new THREE.MeshBasicMaterial({ color: '#9c5937', side: THREE.DoubleSide })
    );
    bounce.rotation.x = -Math.PI / 2;
    bounce.position.y = -6;
    envScene.add(bounce);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.03);
    scene.environment = envRT.texture;
    uniforms.uCloudAlpha.value = prevCloud;
  }

  let currentPresetKey = 'dusk';
  let dustAmount = 0.0;

  function applySky(presetKey, dust = dustAmount) {
    currentPresetKey = presetKey;
    dustAmount = dust;
    const p = SKY_PRESETS[presetKey];
    uniforms.uSunDir.value.copy(p.horizonGlowDir);
    uniforms.uZenith.value.copy(p.zenith);
    uniforms.uMid.value.copy(p.mid);
    uniforms.uHorizon.value.copy(p.horizon);
    uniforms.uSunHalo.value.copy(p.sunHalo);
    uniforms.uStarAlpha.value = p.starAlpha;
    uniforms.uDust.value = dust;

    sunLight.position.copy(p.sunDir).multiplyScalar(460);
    sunLight.color.copy(p.sunColor);
    sunLight.intensity = p.sunIntensity * (1 - dust * 0.62);

    hemiLight.color.copy(p.hemiSky);
    hemiLight.groundColor.copy(p.hemiGround);
    hemiLight.intensity = p.hemiIntensity * (1 - dust * 0.25);

    const fogCol = p.fogColor.clone().lerp(new THREE.Color('#b36238'), dust * 0.7);
    scene.fog.color.copy(fogCol);
    scene.fog.density = p.fogDensity + dust * 0.0022;
    phobos.visible = p.starAlpha > 0.05 && dust < 0.4;

    bakeEnvironment();
    return p;
  }

  applySky('dusk', 0.0);
  return {
    skyMesh,
    sunLight,
    hemiLight,
    applySky,
    update(t) { uniforms.uTime.value = t; },
    getPresetKey: () => currentPresetKey
  };
}
