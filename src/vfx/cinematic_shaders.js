import * as THREE from 'three';

/**
 * FILM-GRADE PROCEDURAL GLSL SHADER ENHANCEMENT SUITE (WebGL2)
 * ------------------------------------------------------------
 * Extends the same pixel-sharp fractal noise, normal perturbation & optical scattering
 * language from the Volumetric Cloud Engine across EVERY hero material in PROJECT ARCADIA:
 *  1. Martian Terrain: Real-time FBM wind ripples, sedimentary canyon strata & drifting sand streaks
 *  2. 30X Stainless Steel (212m Colossus & 55m Starships): Anisotropic grain, Martian dust settling & re-entry heat-tint
 *  3. Subsurface Glacier Ice (Ice Quarry): 3-layer parallax internal fractures, air bubbles & cyan SSS
 *  4. Pressurized Aerospace Glass (Bio-Domes & Skybridge): Dust base gradient, condensation & thin-film Fresnel
 *  5. Volumetric Crepuscular God-Rays: Soft-feathered drifting atmospheric light shafts past the 212m Colossus & Bio-Domes
 */

export const CINEMATIC_UNIFORMS = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.74, 0.25, 0.62).normalize() },
  uSunCol: { value: new THREE.Color('#ffd09b') },
  uDust: { value: 0.0 }
};

export function updateCinematicShaderTime(t) {
  CINEMATIC_UNIFORMS.uTime.value = t;
}

export function syncCinematicSun(preset, dust = 0.0) {
  if (!preset) return;
  if (preset.sunDir) CINEMATIC_UNIFORMS.uSunDir.value.copy(preset.sunDir).normalize();
  if (preset.sunColor) CINEMATIC_UNIFORMS.uSunCol.value.copy(preset.sunColor);
  CINEMATIC_UNIFORMS.uDust.value = dust;
}

const GLSL_NOISE_LIB = /* glsl */ `
float cHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float cVnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(cHash21(i), cHash21(i + vec2(1.0, 0.0)), u.x),
    mix(cHash21(i + vec2(0.0, 1.0)), cHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float cFbm3(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * cVnoise(p);
    p = m * p * 2.03 + vec2(13.7, 29.3);
    a *= 0.50;
  }
  return v;
}
float cRidged3(vec2 p) {
  float v = 0.0;
  float a = 0.54;
  mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    float n = 1.0 - abs(cVnoise(p) * 2.0 - 1.0);
    v += a * n * n;
    p = m * p * 2.08 + vec2(7.3, 19.1);
    a *= 0.48;
  }
  return v;
}
`;

function injectWorldVaryings(shader) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vCWorldPos;
      varying vec3 vCWorldNorm;
      varying vec3 vCLocalPos;`
    )
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vCLocalPos = position;
      vec4 cWp = vec4(transformed, 1.0);
      vec3 cWn = objectNormal;
      #ifdef USE_INSTANCING
        cWp = instanceMatrix * cWp;
        cWn = mat3(instanceMatrix) * cWn;
      #endif
      cWp = modelMatrix * cWp;
      vCWorldPos = cWp.xyz;
      vCWorldNorm = normalize(mat3(modelMatrix) * cWn);`
    );
}

// ============================================================================
// 1. MARTIAN TERRAIN: WIND RIPPLES, SEDIMENTARY STRATA & DRIFTING SAND STREAKS
// ============================================================================
export function enhanceMarsTerrainMaterial(mat) {
  mat.customProgramCacheKey = () => 'mars_terrain_cinematic_v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCTime = CINEMATIC_UNIFORMS.uTime;
    shader.uniforms.uCDust = CINEMATIC_UNIFORMS.uDust;
    injectWorldVaryings(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uCTime;
        uniform float uCDust;
        varying vec3 vCWorldPos;
        varying vec3 vCWorldNorm;
        varying vec3 vCLocalPos;
        ${GLSL_NOISE_LIB}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 wP = vCWorldPos;
          vec3 wN = normalize(vCWorldNorm);
          float camD = length(wP - cameraPosition);
          float closeFade = 1.0 - smoothstep(45.0, 260.0, camD);
          float flatMask = smoothstep(0.68, 0.95, wN.y);
          float slopeMask = 1.0 - smoothstep(0.42, 0.88, wN.y);

          // A. Broad Horizontal Sedimentary Martian Cliff Strata (NASA Curiosity / HiRISE Red Canyon & Mesas!)
          float strataWarp = cFbm3(wP.xz * 0.0085) * 1.85;
          float bandCoord = (wP.y + strataWarp) * 0.48;
          float band1 = sin(bandCoord * 3.14159) * 0.5 + 0.5;
          float band2 = sin(bandCoord * 7.8 + 1.1) * 0.5 + 0.5;
          float fineLayer = sin(bandCoord * 16.5) * 0.5 + 0.5;
          vec3 ironBand = vec3(0.16, 0.042, 0.016);
          vec3 ochreBand = vec3(0.27, 0.092, 0.034);
          vec3 basaltBand = vec3(0.068, 0.030, 0.018);
          vec3 strataCol = mix(ironBand, ochreBand, smoothstep(0.20, 0.85, band1 * 0.65 + fineLayer * 0.35));
          strataCol = mix(strataCol, basaltBand, smoothstep(0.62, 0.92, band2) * 0.48);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62 + strataCol * 0.46, slopeMask * 0.64);

          // B. Pixel-Sharp Aeolian Sand Wind Ripples + Fine Regolith Pebble Breakup
          float rippleWarp = cFbm3(wP.xz * 0.065) * 3.2;
          float rPhase = dot(wP.xz, vec2(0.84, 0.54)) * 2.25 + rippleWarp;
          float ripple = sin(rPhase) * 0.5 + 0.5;
          float pebble = cFbm3(wP.xz * 0.68);
          float rippleShade = mix(0.91, 1.09, ripple) * mix(0.94, 1.06, pebble);
          diffuseColor.rgb *= mix(1.0, rippleShade, flatMask * closeFade * 0.68);

          // C. Live Drifting Windblown Martian Sand Filaments Skimming Across Ground (Linear-HDR calibrated!)
          vec2 windUv = wP.xz * vec2(0.028, 0.115) + vec2(-uCTime * (0.28 + uCDust * 0.65), uCTime * 0.05);
          float sandWarp = cFbm3(windUv * 0.8);
          float streak = smoothstep(0.62, 0.92, cFbm3(windUv * 1.65 + vec2(sandWarp * 1.3, 0.0)));
          float streakVis = streak * flatMask * (0.10 + uCDust * 0.32) * (1.0 - smoothstep(140.0, 520.0, camD));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.120, 0.045), streakVis);
        }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 wP = vCWorldPos;
          vec3 wN = normalize(vCWorldNorm);
          float camD = length(wP - cameraPosition);
          float detailFade = 1.0 - smoothstep(26.0, 170.0, camD);
          if (detailFade > 0.01) {
            float flatM = smoothstep(0.66, 0.95, wN.y);
            float warp = cFbm3(wP.xz * 0.065) * 3.2;
            float rCos = cos(dot(wP.xz, vec2(0.84, 0.54)) * 2.25 + warp);
            float microX = cVnoise(wP.xz * 1.9 + vec2(0.15, 0.0)) - cVnoise(wP.xz * 1.9 - vec2(0.15, 0.0));
            float microZ = cVnoise(wP.xz * 1.9 + vec2(0.0, 0.15)) - cVnoise(wP.xz * 1.9 - vec2(0.0, 0.15));
            // Crisp horizontal sedimentary rock ledge bump
            float cliffBump = cos((wP.y + cFbm3(wP.xz * 0.0085) * 1.85) * 2.4) * (1.0 - flatM);
            vec3 wPerturb = vec3(
              (rCos * 0.84 * 0.16 + microX * 0.22) * flatM,
              cliffBump * 0.15,
              (rCos * 0.54 * 0.16 + microZ * 0.22) * flatM
            ) * detailFade;
            vec3 vPerturb = (viewMatrix * vec4(wPerturb, 0.0)).xyz;
            normal = normalize(normal + vPerturb);
          }
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          // Keep Martian regolith authentically ultra-dry powdery matte (0.92..1.00 — zero wet-paint glare!)
          float mineral = cFbm3(vCWorldPos.xz * 0.16);
          roughnessFactor = clamp(0.96 - smoothstep(0.68, 0.94, mineral) * 0.04 + uCDust * 0.03, 0.92, 1.0);
        }`
      );
  };
  return mat;
}

// ============================================================================
// 2. 30X STAINLESS STEEL: ANISOTROPIC BRUSHED METAL, MARS DUST & RE-ENTRY HEAT-TINT
// ============================================================================
export function enhanceSteelMonumentMaterial(mat, opts = {}) {
  const isStarship = opts.mode === 'starship';
  const isHead = opts.mode === 'colossus_head';
  const dustStrength = opts.dustStrength ?? (isHead ? 0.30 : isStarship ? 0.22 : 0.44);
  const heatTint = isStarship ? 1.0 : 0.0;
  const grainFreq = isHead ? 0.42 : (isStarship ? 2.4 : 0.18);

  mat.customProgramCacheKey = () => `steel_cinematic_${opts.mode || 'colossus'}_v3`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCSunDir = CINEMATIC_UNIFORMS.uSunDir;
    shader.uniforms.uCSunCol = CINEMATIC_UNIFORMS.uSunCol;
    shader.uniforms.uCDust = CINEMATIC_UNIFORMS.uDust;
    injectWorldVaryings(shader);

    const grainLo = isHead ? 0.965 : 0.90;
    const grainHi = isHead ? 1.035 : 1.08;
    const upMin = isHead ? 0.58 : 0.18;
    const upMax = isHead ? 0.94 : 0.78;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uCSunDir;
        uniform vec3 uCSunCol;
        uniform float uCDust;
        varying vec3 vCWorldPos;
        varying vec3 vCWorldNorm;
        varying vec3 vCLocalPos;
        ${GLSL_NOISE_LIB}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float cDustMask = 0.0;
        {
          vec3 wP = vCWorldPos;
          vec3 wN = normalize(vCWorldNorm);

          // Tri-planar fine brushed stainless anisotropic grain (ultra-subtle on sculpted portrait head!)
          float brush = cVnoise(vec2(wP.x * ${grainFreq.toFixed(2)} + wP.z * ${grainFreq.toFixed(2)}, wP.y * ${(grainFreq * 6.5).toFixed(2)}));
          float patina = cFbm3(wP.xz * ${(grainFreq * 0.35).toFixed(3)} + vec2(wP.y * ${(grainFreq * 0.25).toFixed(3)}, 0.0));
          diffuseColor.rgb *= mix(${grainLo.toFixed(3)}, ${grainHi.toFixed(3)}, brush * 0.55 + patina * 0.45);

          // Martian Iron-Oxide Dust Settling on Upward-Facing Ledges, Shoulders & Hair Crown (Linear-HDR!)
          float upFace = smoothstep(${upMin.toFixed(2)}, ${upMax.toFixed(2)}, wN.y);
          float dustPatch = smoothstep(0.32, 0.78, patina);
          cDustMask = clamp(upFace * (0.45 + dustPatch * 0.55) * ${(dustStrength).toFixed(2)} * (1.0 + uCDust * 0.5), 0.0, 0.74);
          vec3 marsDustCol = vec3(0.28, 0.095, 0.038);
          diffuseColor.rgb = mix(diffuseColor.rgb, marsDustCol, cDustMask);

          // Authentic SpaceX Orbital Re-entry Heat-Tint Iridescence on Starship 30X Hulls!
          if (${heatTint.toFixed(1)} > 0.5) {
            float localH = vCLocalPos.y;
            float scorchNoise = cFbm3(vec2(atan(vCLocalPos.z, vCLocalPos.x) * 2.2, localH * 0.14));
            // Aft Raptor skirt soot + straw/bronze/indigo thermal oxidation bands
            float aftZone = 1.0 - smoothstep(1.5, 17.5, localH + scorchNoise * 4.0);
            float noseZone = smoothstep(34.0, 49.0, localH + scorchNoise * 3.5);
            float weldBand = smoothstep(0.86, 0.98, abs(sin(localH * 1.72)));

            vec3 strawGold = vec3(0.58, 0.38, 0.20);
            vec3 indigoOxide = vec3(0.24, 0.26, 0.42);
            vec3 aftSoot = vec3(0.06, 0.05, 0.045);

            vec3 tintCol = mix(strawGold, indigoOxide, smoothstep(0.30, 0.76, scorchNoise));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tintCol * 1.55, clamp(aftZone * 0.65 + noseZone * 0.48, 0.0, 0.78));
            diffuseColor.rgb = mix(diffuseColor.rgb, aftSoot, (1.0 - smoothstep(0.0, 6.5, localH + scorchNoise * 2.5)) * 0.55);
            diffuseColor.rgb *= (1.0 - weldBand * 0.14);
          }
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float microR = cVnoise(vec2(vCWorldPos.x * ${(grainFreq * 2.0).toFixed(2)} + vCWorldPos.z * ${(grainFreq * 2.0).toFixed(2)}, vCWorldPos.y * ${(grainFreq * 9.0).toFixed(2)}));
          roughnessFactor = clamp(mix(roughnessFactor + (microR - 0.5) * ${(isHead ? 0.04 : 0.12).toFixed(2)}, 0.90, cDustMask), ${(isHead ? 0.36 : 0.16).toFixed(2)}, 0.95);
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.06, cDustMask * 0.88);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // Subtle atmospheric Mars grazing rim highlight so the 212m Colossus & Starships sculpt crisply against dusk sky
          vec3 cV = normalize(cameraPosition - vCWorldPos);
          vec3 wN = normalize(vCWorldNorm);
          float rim = pow(clamp(1.0 - max(0.0, dot(wN, cV)), 0.0, 1.0), 3.4);
          float sunSide = clamp(dot(wN, normalize(uCSunDir)) * 0.55 + 0.45, 0.0, 1.0);
          totalEmissiveRadiance += uCSunCol * rim * sunSide * ${(isHead ? 0.085 : 0.08).toFixed(3)} * (1.0 - cDustMask * 0.5);
        }`
      );
  };
  return mat;
}

// ============================================================================
// 3. SUBSURFACE GLACIER ICE: 3-LAYER PARALLAX FRACTURES, AIR BUBBLES & CYAN SSS
// ============================================================================
export function enhanceGlacierIceMaterial(mat, quarryCenter = new THREE.Vector3(365, -13.5, -210)) {
  mat.customProgramCacheKey = () => 'mars_glacier_ice_parallax_v2';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCTime = CINEMATIC_UNIFORMS.uTime;
    shader.uniforms.uCSunDir = CINEMATIC_UNIFORMS.uSunDir;
    shader.uniforms.uQuarryCenter = { value: quarryCenter.clone() };
    injectWorldVaryings(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uCTime;
        uniform vec3 uCSunDir;
        uniform vec3 uQuarryCenter;
        varying vec3 vCWorldPos;
        varying vec3 vCWorldNorm;
        varying vec3 vCLocalPos;
        ${GLSL_NOISE_LIB}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 cIceGlow = vec3(0.0);
        float cIceCrack = 0.0;
        {
          vec3 wP = vCWorldPos;
          vec3 wN = normalize(vCWorldNorm);
          vec3 viewDir = normalize(wP - cameraPosition);

          // 3-Layer 3D Tri-Planar View-Parallax Deep Glacial Fractures & Suspended Ancient CO2 Bubbles!
          vec2 yOff = vec2(wP.y * 0.28, -wP.y * 0.22);
          vec2 p0 = wP.xz * 0.15 + yOff;
          vec2 p1 = (wP.xz + viewDir.xz * 2.4) * 0.20 + yOff * 1.2 + vec2(4.1, -2.7);
          vec2 p2 = (wP.xz + viewDir.xz * 5.2) * 0.13 + yOff * 0.8 + vec2(-7.3, 6.4);

          float crack0 = pow(cRidged3(p0), 3.6);
          float crack1 = pow(cRidged3(p1), 3.1);
          float crack2 = pow(cRidged3(p2), 2.5);
          cIceCrack = clamp(crack0 * 0.95 + crack1 * 0.55 + crack2 * 0.35, 0.0, 1.0);

          // Tiny trapped sparkling ice air bubbles suspended inside the glacier
          float bubbles = smoothstep(0.76, 0.94, cVnoise((wP.xz + viewDir.xz * 1.4) * 2.8 + yOff * 3.0));

          // Linear-HDR Subsurface Depth Gradient: deep sapphire abyss -> glacier turquoise -> bright frost veins!
          vec3 deepAbyss = vec3(0.012, 0.060, 0.135);
          vec3 midGlacier = vec3(0.045, 0.240, 0.420);
          vec3 brightVein = vec3(0.460, 0.800, 0.960);

          float depthVar = cFbm3(p2 * 0.85);
          vec3 iceCol = mix(deepAbyss, midGlacier, smoothstep(0.16, 0.82, depthVar));
          iceCol = mix(iceCol, brightVein, clamp(crack0 * 0.72 + crack1 * 0.42 + bubbles * 0.42, 0.0, 0.92));

          // Subtle Martian red permafrost dust rim near outer quarry pit walls (Linear-HDR!)
          float rPit = length(wP.xz - uQuarryCenter.xz);
          float rimDust = smoothstep(23.0, 33.5, rPit) * smoothstep(0.4, 0.85, cFbm3(wP.xz * 0.15));
          iceCol = mix(iceCol, vec3(0.24, 0.09, 0.045), rimDust * 0.65);

          diffuseColor.rgb = iceCol;

          // Subsurface Turquoise Light Scattering around the rotary drill borehole + grazing Fresnel crystal glint!
          float drillDist = length(wP.xz - uQuarryCenter.xz);
          float drillSSS = exp(-drillDist * 0.068) * (0.80 + 0.20 * sin(uCTime * 2.4 + depthVar * 4.0));
          float fres = pow(clamp(1.0 - max(0.0, dot(wN, -viewDir)), 0.0, 1.0), 2.8);
          float sunScat = pow(max(0.0, dot(viewDir, normalize(uCSunDir))), 3.0) * 0.45 + 0.25;
          cIceGlow = vec3(0.06, 0.56, 0.88) * (drillSSS * (0.55 + crack1 * 0.95) + fres * 0.20 + crack0 * 0.28 * sunScat);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(0.14, 0.52, cIceCrack), 0.10, 0.65);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += cIceGlow;`
      );
  };
  return mat;
}

// ============================================================================
// 4. PRESSURIZED AEROSPACE GLASS: MARS DUST RIM, CONDENSATION & AR FRESNEL
// ============================================================================
export function enhancePressurizedGlassMaterial(mat, opts = {}) {
  const isBioDome = opts.mode !== 'skybridge';
  const domeRadius = opts.radius ?? 42.0;

  mat.customProgramCacheKey = () => `mars_glass_${opts.mode || 'biodome'}_${Math.round(domeRadius)}_v1`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCSunDir = CINEMATIC_UNIFORMS.uSunDir;
    shader.uniforms.uCSunCol = CINEMATIC_UNIFORMS.uSunCol;
    shader.uniforms.uCDust = CINEMATIC_UNIFORMS.uDust;
    injectWorldVaryings(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uCSunDir;
        uniform vec3 uCSunCol;
        uniform float uCDust;
        varying vec3 vCWorldPos;
        varying vec3 vCWorldNorm;
        varying vec3 vCLocalPos;
        ${GLSL_NOISE_LIB}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float cGlassCond = 0.0;
        float cGlassFres = 0.0;
        {
          vec3 wP = vCWorldPos;
          vec3 wN = normalize(vCWorldNorm);
          vec3 vDir = normalize(cameraPosition - wP);
          float ndv = abs(dot(wN, vDir));
          cGlassFres = pow(clamp(1.0 - ndv, 0.0, 1.0), 3.0);

          // Height-based subtle Martian ochre dust accumulation along bottom flange of glass!
          float hNorm = ${isBioDome ? `clamp(vCLocalPos.y / ${domeRadius.toFixed(1)}, 0.0, 1.0)` : `clamp((vCLocalPos.y + 2.4) / 4.8, 0.0, 1.0)`};
          float dustNoise = cFbm3(wP.xz * 0.24 + vec2(wP.y * 0.35, 0.0));
          float lowerDust = (1.0 - smoothstep(0.0, 0.34, hNorm)) * smoothstep(0.28, 0.82, dustNoise) * (0.42 + uCDust * 0.32);

          // Interior pressurized humidity micro-condensation mist patches
          float condNoise = cFbm3(wP.xz * 0.48 + vec2(0.0, wP.y * 0.52));
          cGlassCond = smoothstep(0.56, 0.86, condNoise) * (1.0 - smoothstep(0.22, 0.78, hNorm)) * ${isBioDome ? '0.28' : '0.16'};

          // Aerospace AR Thin-Film Iridescence (subtle cyan-amber-violet sheen on oblique viewing angles!)
          vec3 thinFilm = mix(vec3(0.45, 0.86, 0.94), vec3(0.96, 0.76, 0.50), clamp(ndv * 1.4 + 0.15, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.38, 0.22), lowerDust * 0.65);
          diffuseColor.rgb = mix(diffuseColor.rgb, thinFilm, cGlassFres * 0.55);

          // Keep center sightlines crystal-clear while grazing edges & dusty sills feel physically substantial!
          diffuseColor.a = clamp(diffuseColor.a + cGlassFres * ${isBioDome ? '0.24' : '0.12'} + lowerDust * 0.16 + cGlassCond * 0.10, 0.04, 0.62);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + cGlassCond * 0.42, 0.06, 0.72);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 wN = normalize(vCWorldNorm);
          float sunGlint = pow(max(0.0, dot(reflect(-normalize(uCSunDir), wN), normalize(cameraPosition - vCWorldPos))), 28.0);
          totalEmissiveRadiance += uCSunCol * (cGlassFres * ${isBioDome ? '0.16' : '0.07'} + sunGlint * ${isBioDome ? '0.26' : '0.10'});
        }`
      );
  };
  return mat;
}

// ============================================================================
// 5. VOLUMETRIC CREPUSCULAR GOD-RAYS (ATMOSPHERIC SHAFTS PAST 212m COLOSSUS & DOMES)
// ============================================================================
export function createVolumetricGodRays() {
  const root = new THREE.Group();

  const rayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: CINEMATIC_UNIFORMS.uTime,
      uSunCol: CINEMATIC_UNIFORMS.uSunCol,
      uDust: CINEMATIC_UNIFORMS.uDust,
      uRayStrength: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vEdgeSoft;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPos = viewMatrix * wp;
        vec3 nView = normalize(normalMatrix * normal);
        vec3 vDir = normalize(-mvPos.xyz);
        // Zero flat-card edge artifacts: dissolves smoothly whenever viewed edge-on!
        vEdgeSoft = pow(abs(dot(nView, vDir)), 1.65);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunCol;
      uniform float uDust;
      uniform float uRayStrength;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vEdgeSoft;
      ${GLSL_NOISE_LIB}

      void main() {
        // Horizontal Gaussian beam cross-section (zero hard card borders!)
        float dx = abs(vUv.x - 0.5) * 2.0;
        float across = pow(clamp(1.0 - smoothstep(0.0, 1.0, dx), 0.0, 1.0), 2.1);

        // Longitudinal fade from sky source (uv.y=1) down into Martian basin mist (uv.y=0)
        float along = smoothstep(0.0, 0.24, vUv.y) * (1.0 - smoothstep(0.68, 1.0, vUv.y));

        // Multiple fine crepuscular sub-shafts + live drifting dusty turbulence!
        float shafts = 0.55 + 0.45 * sin(vUv.x * 22.0 + sin(vUv.x * 7.0) * 1.4);
        float dustDrift = cFbm3(vec2(vUv.x * 4.5 + uTime * 0.045, vUv.y * 2.6 - uTime * 0.025));
        float turb = mix(0.62, 1.25, dustDrift);

        // Distance fade so beams never blind close-up camera or clip abruptly
        float camD = length(vWorldPos - cameraPosition);
        float nearFade = smoothstep(22.0, 75.0, camD);
        float farFade = 1.0 - smoothstep(480.0, 1050.0, camD);

        float dustMod = 1.0 - uDust * 0.55;
        float alpha = across * along * shafts * turb * vEdgeSoft * nearFade * farFade * dustMod * uRayStrength * 0.072;
        if (alpha <= 0.002) discard;

        vec3 beamCol = mix(uSunCol, vec3(1.0, 0.84, 0.62), 0.35);
        gl_FragColor = vec4(beamCol, alpha);
      }
    `
  });

  // Hero crepuscular shafts anchored cleanly across the 212m Colossus shoulders & Bio-Dome basin!
  const beamAnchors = [
    // Flanking the 212m Elon Musk Colossus shoulders & chest!
    { pos: new THREE.Vector3(-42, 142, -74), w: 58, len: 310 },
    { pos: new THREE.Vector3(-96, 152, -32), w: 66, len: 330 },
    { pos: new THREE.Vector3(-56, 118, -112), w: 52, len: 270 },
    // Sweeping across Hero Bio-Dome #1 & Arcadia Basin
    { pos: new THREE.Vector3(-12, 74, -152), w: 54, len: 250 },
    { pos: new THREE.Vector3(56, 82, -196),  w: 62, len: 270 },
    { pos: new THREE.Vector3(24, 90, -280),  w: 70, len: 290 }
  ];

  const beams = [];
  const upAxis = new THREE.Vector3(0, 1, 0);
  beamAnchors.forEach((b) => {
    const holder = new THREE.Group();
    holder.position.copy(b.pos);
    // Crossed dual planes per beam so shafts stay lush from every horizontal viewing angle!
    const geo = new THREE.PlaneGeometry(b.w, b.len, 1, 1);
    const p1 = new THREE.Mesh(geo, rayMat);
    const p2 = new THREE.Mesh(geo, rayMat);
    p2.rotation.y = Math.PI * 0.5;
    p1.renderOrder = 5;
    p2.renderOrder = 5;
    holder.add(p1, p2);
    root.add(holder);
    beams.push(holder);
  });

  const qAlign = new THREE.Quaternion();
  const dirTmp = new THREE.Vector3();

  function syncSun(presetKey, sunDir) {
    dirTmp.copy(sunDir).normalize();
    qAlign.setFromUnitVectors(upAxis, dirTmp);
    beams.forEach((h) => h.quaternion.copy(qAlign));
    // Warmest & richest at dusk/blueSunset, subtler at high Sol Noon
    rayMat.uniforms.uRayStrength.value = presetKey === 'noon' ? 0.52 : (presetKey === 'blueSunset' ? 0.92 : 1.05);
  }

  syncSun('dusk', CINEMATIC_UNIFORMS.uSunDir.value);
  return { group: root, syncSun };
}
