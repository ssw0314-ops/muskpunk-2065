import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { createTextures } from './textures.js';
import { createMarsTerrain, getTerrainHeight } from './terrain.js';
import { createMarsSky } from './sky.js';
import { createElonColossus } from './assets/colossus.js';
import { createArcadiaColony, HERO_BIODOME, isColonistLoaded } from './assets/domes.js';
import { createMegaport, isStarshipLoaded } from './assets/starship.js';
import { createRoadsterSystems, isRoadsterLoaded } from './assets/roadster.js';
import { createOptimusWorkforce, isOptimusLoaded, isCyberRoverLoaded } from './assets/optimus.js';
import { createOpenWorldExpansion } from './assets/world_expansion.js';
import { createPlayerRoadster } from './player_roadster.js';
import { createGtaMinimap, getCurrentDistrict } from './minimap.js';
import { createMarsAudio } from './audio.js';
import { createVolumetricGodRays, syncCinematicSun, updateCinematicShaderTime } from './vfx/cinematic_shaders.js';

// =========================================================================
// 1. RENDERER, SCENE & POST-PROCESSING (ADAPTIVE MOBILE DPR + ACES FILMIC)
// =========================================================================
const isTouchDevice =
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  window.matchMedia('(pointer: coarse)').matches;
const isMobileViewport = () => window.innerWidth <= 820;

const canvas = document.getElementById('mars-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
const maxDpr = (isTouchDevice || isMobileViewport()) ? 1.5 : 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
function getBaseFov() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return aspect < 1.0 ? THREE.MathUtils.clamp(64 / Math.pow(aspect, 0.34), 64, 86) : 64;
}
const camera = new THREE.PerspectiveCamera(getBaseFov(), window.innerWidth / window.innerHeight, 0.15, 4200);

// Title-screen camera presets. car = [forward m, right m, up m, heading] relative to the camera.
const INTRO_CAM_DESKTOP = { pos: [-18, 56, 165], look: [8, 150, -210], fov: 54, orbit: 5.0, car: [27, -2.0, 6.0, Math.PI - 0.54] };
const INTRO_CAM_PORTRAIT = { pos: [-36, 62, 200], look: [4, 140, -210], fov: 74, orbit: 3.0, car: [30, 1.0, 6.0, Math.PI - 0.52] };
const introFwd = new THREE.Vector3();
const introRight = new THREE.Vector3();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.18,
  0.42,
  1.12
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// =========================================================================
// 2. ASSEMBLE THE EXPANDED GTA OPEN-WORLD OF STARBASE ARCADIA!
// =========================================================================
const textures = createTextures(renderer);
const audio = createMarsAudio();
const sky = createMarsSky(scene, renderer);
const godRays = createVolumetricGodRays();
scene.add(godRays.group);

const terrain = createMarsTerrain(textures);
scene.add(terrain);

// Hero 212m Blender-Sculpted 30X Stainless Elon Musk Colossus (AD ASTRA — 1:1 True World Meters!)
const colossus = createElonColossus(textures);
const colX = -74, colZ = -56;
const colBaseY = getTerrainHeight(colX, colZ) - 1.6;
const colScale = 1.0;
colossus.group.position.set(colX, colBaseY, colZ);
colossus.group.scale.setScalar(colScale);
colossus.group.rotation.y = 0.62;
scene.add(colossus.group);

// Arcadia Colony Basin: Domes, Tubes, Metro Train & Glass Skybridge Café
const colony = createArcadiaColony(textures);
scene.add(colony.group);

// Arcadia Interplanetary Megaport (14 × 55m Starships + Live Launch/Landing)
const megaport = createMegaport(textures, () => audio.playStarshipRumble());
scene.add(megaport.group);

// NPC Service Apron Roadster & Sky-Pad 02 Ballistic Hopper
const roadsters = createRoadsterSystems(textures, () => audio.playColdGasBurst());
scene.add(roadsters.group);

// Tesla Optimus Workforce + 6-Wheeled Pressurized Mars Cargo Cyber-Rovers
const optimus = createOptimusWorkforce(textures);
scene.add(optimus.group);

// NEW: GTA Open-World Expansion (Highways, Red Canyon Arches & Stunt Ramps, Starship Saloon, Ice Quarry, 10 Flight Gates, Sky Traffic!)
let toastTimer = 0;
function showToast(kicker, title) {
  const el = document.getElementById('district-toast');
  const kEl = document.getElementById('toast-kicker');
  const tEl = document.getElementById('toast-title');
  if (!el || !kEl || !tEl) return;
  kEl.textContent = kicker;
  tEl.textContent = title;
  el.classList.add('show');
  toastTimer = 3.2;
}

const expansion = createOpenWorldExpansion(textures, (gateName, count, total) => {
  audio.playGateChime(count);
  showToast(`FLIGHT GATE PASSED · ${count}/${total}`, gateName);
});
scene.add(expansion.group);

// NEW: HERO PLAYER-CONTROLLED DRIVABLE & FLYING TESLA ROADSTER ROCKET-M (DEFAULT START MODE!)
const playerCar = createPlayerRoadster(textures, expansion.ramps);
scene.add(playerCar.group);

// Sunlit Ambient Martian Dust Motes (follow camera smoothly across the entire 1.6km open world!)
const moteCount = 520;
const moteGeo = new THREE.BufferGeometry();
const motePos = new Float32Array(moteCount * 3);
const moteVel = new Float32Array(moteCount);
for (let i = 0; i < moteCount; i++) {
  motePos[i * 3]     = (Math.random() - 0.5) * 260;
  motePos[i * 3 + 1] = 2 + Math.random() * 68;
  motePos[i * 3 + 2] = (Math.random() - 0.5) * 260;
  moteVel[i] = 1.6 + Math.random() * 3.8;
}
moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
const moteMat = new THREE.PointsMaterial({
  map: textures.softParticle,
  color: '#e5a474',
  size: 0.85,
  transparent: true,
  opacity: 0.28,
  depthWrite: false
});
const dustMotes = new THREE.Points(moteGeo, moteMat);
scene.add(dustMotes);

// GTA Rotating Circular Tactical Minimap
const minimap = createGtaMinimap(document.getElementById('gta-minimap'));

// =========================================================================
// 3. GTA OPEN-WORLD DISTRICTS, DRIVING/FLIGHT & ON-FOOT STATE MACHINE
// =========================================================================
const DISTRICTS = [
  {
    id: 'ridge',
    label: '1. 파운더스 리지',
    x: -10.0, z: -4.0, heading: Math.PI + 0.42, airAlt: 0,
    inVehicle: true, inside: false
  },
  {
    id: 'colossus_fly',
    label: '2. 거상 공중관람',
    x: 10.0, z: 16.0, heading: Math.PI + 0.86, airAlt: 148.0, // Hovering eye-to-eye beside the overwhelming 212m Blender Musk Colossus!
    inVehicle: true, inside: false
  },
  {
    id: 'canyon',
    label: '3. 레드 캐니언',
    x: -315 + Math.sin(-180 * 0.011) * 48, z: -180.0, heading: 0.12, airAlt: 0, // Lined up down Red Canyon highway toward arches & stunt ramp!
    inVehicle: true, inside: false
  },
  {
    id: 'saloon',
    label: '4. 스타십 살룬',
    x: -244.0, z: -344.0, heading: Math.PI + 0.24, airAlt: 0, // Clean open forecourt facing the salvaged 55m Starship Saloon, marquee & Sky-Pad 04!
    inVehicle: true, inside: false
  },
  {
    id: 'quarry',
    label: '5. 빙하 채굴장',
    x: 292.0, z: -215.0, heading: Math.PI * 0.5, airAlt: 0.1, // Parked on Elevated PAD-03 overlooking the 44m X-braced rotary ice drill & frozen pit!
    inVehicle: true, inside: false
  },
  {
    id: 'megaport',
    label: '6. 메가포트 우주항',
    x: 214.0, z: -468.0, heading: Math.PI - 0.12, airAlt: 0, // On the Megaport highway gateway facing 14 towering 55m Starships!
    inVehicle: true, inside: false
  }
];

const player = {
  inVehicle: true, // START IN FLYING TESLA ROADSTER BY DEFAULT (GTA OPEN WORLD!)
  pos: new THREE.Vector3(-10.0, getTerrainHeight(-10.0, -4.0) + 1.72, -4.0),
  velY: 0,
  yaw: 0.42,
  pitch: 0.08,
  eyeHeight: 1.72,
  grounded: true,
  inside: false,
  interiorZone: null, // null | 'skybridge' | 'biodome'
  walking: false,
  bobTime: 0,
  // GTA Chase Camera parameters (0: Chase Near, 1: Chase Wide, 2: Hood/Cockpit 1st-Person!)
  camMode: 0,
  chaseYawOffset: 0,   // Free orbit offset around car (smoothly springs back while driving!)
  chasePitch: 0.07,    // Clean heroic chase angle framing Roadster + towering 212m Colossus + Horizon!
  orbitIdleTimer: 0,
  smoothCamPos: new THREE.Vector3(-10.0, getTerrainHeight(-10.0, -4.0) + 4.0, 5.0),
  smoothLookAt: new THREE.Vector3(-30, 26, -45)
};

let experienceStarted = false;
let pointerLocked = false;
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
const keys = {};

// Mobile / Virtual Touch Controls State
let touchControlsEnabled = isTouchDevice || isMobileViewport();
const touchState = {
  stickX: 0,
  stickY: 0,
  sprint: false,
  liftHeld: false,
  descendHeld: false,
  boostHeld: false,
  stickTouchId: null,
  lookTouchId: null,
  stickOriginX: 0,
  stickOriginY: 0,
  lastLookX: 0,
  lastLookY: 0,
  mouseStickActive: false
};

let skyOrder = ['blueSunset', 'dusk', 'noon'];
let skyIndex = 0;
let dustStorm = false;
let currentDistrictId = 'ridge';

function isInsideSkybridge(x, z) {
  return x >= -15.5 && x <= 21.6 && z >= 18.4 && z <= 27.6;
}

function getWalkableFloor(x, z, inside) {
  if (inside && player.interiorZone === 'biodome') return HERO_BIODOME.floorY + 0.08;
  if (inside && isInsideSkybridge(x, z)) return 19.2;
  if (x >= 21.5 && x <= 28.0 && z >= 20.5 && z <= 25.5) {
    const t = THREE.MathUtils.clamp((x - 21.5) / 6.5, 0, 1);
    return THREE.MathUtils.lerp(19.2, getTerrainHeight(28.0, z), t);
  }
  return getTerrainHeight(x, z);
}

function clampFootPosition(nextX, nextZ, inside) {
  let x = THREE.MathUtils.clamp(nextX, -560, 860);
  let z = THREE.MathUtils.clamp(nextZ, -920, 260);
  if (inside) {
    if (player.interiorZone === 'biodome') {
      const dx = x - HERO_BIODOME.x;
      const dz = z - HERO_BIODOME.z;
      const d = Math.hypot(dx, dz);
      const maxR = HERO_BIODOME.r - 4.8;
      if (d > maxR) {
        x = HERO_BIODOME.x + (dx / d) * maxR;
        z = HERO_BIODOME.z + (dz / d) * maxR;
      }
      return { x, z };
    }
    return { x: THREE.MathUtils.clamp(x, -15.1, 21.3), z: THREE.MathUtils.clamp(z, 18.8, 27.1) };
  }
  if (x > -16.8 && x < 22.8 && z > 17.2 && z < 28.8) {
    const dN = Math.abs(z - 17.2), dS = Math.abs(z - 28.8), dE = Math.abs(x - 22.8), dW = Math.abs(x + 16.8);
    const m = Math.min(dN, dS, dE, dW);
    if (m === dN) z = 17.2;
    else if (m === dS) z = 28.8;
    else if (m === dE) x = 22.8;
    else x = -16.8;
  }
  const dCol = Math.hypot(x - colX, z - colZ);
  if (dCol < 53.5) {
    const ang = Math.atan2(z - colZ, x - colX);
    x = colX + Math.cos(ang) * 53.5;
    z = colZ + Math.sin(ang) * 53.5;
  }
  return { x, z };
}

function updateEnvironmentBadge() {
  const envBadge = document.getElementById('hud-env');
  const visorFx = document.getElementById('eva-visor');
  const vHud = document.getElementById('vehicle-hud');
  const btnMount = document.getElementById('btn-mount');
  const btnAirlock = document.getElementById('btn-airlock');
  const btnBio = document.getElementById('btn-biodome');
  const tMount = document.getElementById('touch-btn-mount');
  const tLiftSub = document.getElementById('touch-lift-sub');
  const tLiftLbl = document.getElementById('touch-lift-label');
  const tDesc = document.getElementById('touch-btn-descend');

  if (btnAirlock) btnAirlock.classList.toggle('active', !player.inVehicle && player.interiorZone === 'skybridge');
  if (btnBio) btnBio.classList.toggle('active', !player.inVehicle && player.interiorZone === 'biodome');
  if (tDesc) tDesc.style.visibility = player.inVehicle ? 'visible' : 'hidden';

  if (player.inVehicle) {
    const flying = !playerCar.state.grounded;
    envBadge.textContent = isMobileViewport()
      ? (flying ? 'ROADSTER · FLIGHT' : 'ROADSTER · DRIVE')
      : (flying
          ? 'ROADSTER ROCKET-M · COLD-GAS FLIGHT · PRESSURIZED CABIN'
          : 'ROADSTER ROCKET-M · 0.38G MARS OPEN-WORLD · 70 kPa CABIN');
    envBadge.className = flying ? 'pill pill-flight' : 'pill pill-cabin';
    visorFx.classList.remove('active');
    if (vHud) vHud.classList.remove('on-foot');
    if (btnMount) btnMount.textContent = '하차(F)';
    if (tMount) tMount.textContent = '하차';
    if (tLiftSub) tLiftSub.textContent = 'COLD-GAS';
    if (tLiftLbl) tLiftLbl.textContent = '상승';
  } else if (player.interiorZone === 'biodome') {
    envBadge.textContent = isMobileViewport()
      ? 'BIO-DOME · 70 kPa'
      : 'BIO-DOME 01 · AGRO-FARM · 70.0 kPa PRESSURIZED';
    envBadge.className = 'pill pill-cabin';
    visorFx.classList.remove('active');
    if (vHud) vHud.classList.add('on-foot');
    if (btnMount) btnMount.textContent = '탑승(F)';
    if (tMount) tMount.textContent = '탑승';
    if (tLiftSub) tLiftSub.textContent = '0.38G';
    if (tLiftLbl) tLiftLbl.textContent = 'JUMP';
  } else if (player.inside) {
    envBadge.textContent = isMobileViewport()
      ? 'SKYBRIDGE · 70 kPa'
      : 'SKYBRIDGE CAFÉ · 70.0 kPa PRESSURIZED CABIN';
    envBadge.className = 'pill pill-cabin';
    visorFx.classList.remove('active');
    colony.skybridge.airlockBeacon.material.color.set('#38bdf8');
    if (vHud) vHud.classList.add('on-foot');
    if (btnMount) btnMount.textContent = '탑승(F)';
    if (tMount) tMount.textContent = '탑승';
    if (tLiftSub) tLiftSub.textContent = '0.38G';
    if (tLiftLbl) tLiftLbl.textContent = 'JUMP';
  } else {
    envBadge.textContent = isMobileViewport()
      ? 'EVA · ON FOOT'
      : (dustStorm
          ? 'EVA SUIT ON FOOT · 0.61 kPa CO₂ · DUST STORM τ=3.8'
          : 'EVA SUIT ON FOOT · 0.61 kPa CO₂ · 0.38G MARS');
    envBadge.className = 'pill pill-eva';
    visorFx.classList.add('active');
    colony.skybridge.airlockBeacon.material.color.set('#f59e0b');
    if (vHud) vHud.classList.add('on-foot');
    if (btnMount) btnMount.textContent = '탑승(F)';
    if (tMount) tMount.textContent = '탑승';
    if (tLiftSub) tLiftSub.textContent = '0.38G';
    if (tLiftLbl) tLiftLbl.textContent = 'JUMP';
  }
  audio.setEnvironment(!player.inside && !player.inVehicle, dustStorm);
}

function closeMobileDrawer() {
  const drawer = document.getElementById('hud-drawer');
  const toggle = document.getElementById('btn-mobile-menu');
  if (drawer) drawer.classList.remove('open');
  if (toggle) toggle.classList.remove('active');
}

function snapChaseCameraImmediately() {
  const s = playerCar.state;
  const dist = player.camMode === 1 ? 13.5 : 8.8;
  const height = player.camMode === 1 ? 4.2 : 2.65;
  const backX = -Math.sin(s.heading);
  const backZ = -Math.cos(s.heading);
  player.smoothCamPos.set(s.pos.x + backX * dist, s.pos.y + height, s.pos.z + backZ * dist);
  player.smoothLookAt.set(s.pos.x - backX * 14, s.pos.y + 3.55, s.pos.z - backZ * 14);
}

function teleportTo(idx) {
  const d = DISTRICTS[idx];
  if (!d) return;
  player.inVehicle = d.inVehicle;
  player.inside = d.inside;
  player.interiorZone = d.inside ? 'skybridge' : null;
  player.chaseYawOffset = 0;
  player.chasePitch = d.airAlt > 10 ? -0.10 : 0.04;
  playerCar.teleportCar(d.x, d.z, d.heading, d.airAlt || 0);
  player.pos.copy(playerCar.state.pos).add(new THREE.Vector3(0, player.eyeHeight, 0));
  snapChaseCameraImmediately();
  updateEnvironmentBadge();

  if (d.id === 'colossus_fly') {
    currentDistrictId = 'colossus';
    showToast('MONUMENT "AD ASTRA"', '212m 머스크 거상 공중관람');
  } else {
    const distInfo = getCurrentDistrict(d.x, d.z);
    currentDistrictId = distInfo.id;
    showToast(distInfo.name, distInfo.kr);
  }

  document.querySelectorAll('.vp-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  closeMobileDrawer();
}

/**
 * GTA Seamless Enter / Exit Flying Roadster (`F` key or Mobile `하차/탑승`!)
 */
function toggleVehicleMount() {
  audio.init();
  audio.playAirlockCycle();
  if (player.inVehicle) {
    // Exit Roadster onto driver's left flank!
    const s = playerCar.state;
    const exitX = s.pos.x + Math.cos(s.heading) * 2.6;
    const exitZ = s.pos.z - Math.sin(s.heading) * 2.6;
    player.inVehicle = false;
    player.inside = false;
    player.interiorZone = null;
    player.pos.set(exitX, Math.max(s.pos.y, getTerrainHeight(exitX, exitZ)) + player.eyeHeight, exitZ);
    player.velY = 0;
    player.yaw = s.heading - Math.PI; // Match Roadster forward direction in FPS coords!
    player.pitch = 0.05;
    showToast('EVA SUIT DEPLOYED', '로드스터 하차 (도보 탐험 · F 재탑승)');
  } else {
    // Board Roadster (if walking inside Skybridge/Bio-Dome or far away, Smart Summon seats you in Roadster!)
    player.inVehicle = true;
    player.inside = false;
    player.interiorZone = null;
    player.chaseYawOffset = 0;
    snapChaseCameraImmediately();
    showToast('ROADSTER ROCKET-M', '탑승 완료 (WASD 주행 · SPACE 상승 · Q/Ctrl/X 하강 · SHIFT 부스터)');
  }
  updateEnvironmentBadge();
  closeMobileDrawer();
}

function cycleAirlock() {
  audio.init();
  audio.playAirlockCycle();
  if (player.interiorZone === 'skybridge') {
    player.inside = false;
    player.interiorZone = null;
    player.inVehicle = false;
    player.pos.set(25.2, getWalkableFloor(25.2, 23.0, false) + player.eyeHeight, 23.0);
    player.yaw = 0.65;
    player.pitch = 0.08;
    showToast('AIRLOCK DEPRESSURIZED', '화성 야외 광장 진출 (0.61 kPa EVA)');
  } else {
    player.inside = true;
    player.interiorZone = 'skybridge';
    player.inVehicle = false;
    player.pos.set(11.5, 19.2 + player.eyeHeight, 24.8);
    player.yaw = 0.36;
    player.pitch = 0.24;
    showToast('SKYBRIDGE CAFÉ · 70.0 kPa', '가압 전망 스카이브리지 입장');
  }
  player.velY = 0;
  player.grounded = true;
  updateEnvironmentBadge();
  closeMobileDrawer();
}

function toggleBioDome() {
  audio.init();
  audio.playAirlockCycle();
  if (player.interiorZone === 'biodome') {
    player.inside = false;
    player.interiorZone = null;
    player.inVehicle = false;
    const ex = HERO_BIODOME.x + 8.5;
    const ez = HERO_BIODOME.z + HERO_BIODOME.r + 12.0;
    player.pos.set(ex, getTerrainHeight(ex, ez) + player.eyeHeight, ez);
    player.yaw = 0.22;
    player.pitch = 0.12;
    showToast('BIO-DOME AIRLOCK EXIT', '바이오-돔 01 외부 분지 진출 (0.61 kPa EVA)');
  } else {
    player.inside = true;
    player.interiorZone = 'biodome';
    player.inVehicle = false;
    // Exact Scene 09 Hero Promenade Angle: grated walkway, potato crates & tomato trellises left, Optimus & golden wheat right, glass arches & Starships ahead!
    player.pos.set(HERO_BIODOME.x + 0.15, HERO_BIODOME.floorY + 0.08 + player.eyeHeight, HERO_BIODOME.z + 25.5);
    player.yaw = -0.14;
    player.pitch = 0.06;
    showToast('BIO-DOME 01 · AGRO-FARM', '70.0 kPa 가압 농업 돔 입장 (WASD 산책 · F 로드스터 탑승)');
  }
  player.velY = 0;
  player.grounded = true;
  updateEnvironmentBadge();
  closeMobileDrawer();
}

function cycleCameraMode() {
  if (!player.inVehicle) return;
  player.camMode = (player.camMode + 1) % 3;
  player.chaseYawOffset = 0;
  const names = ['GTA 추격 시점 (근거리)', 'GTA 와이드 시점 (광각)', '1인칭 로드스터 후드 시점'];
  showToast('CAMERA VIEW', names[player.camMode]);
}

function setSkyMode(key) {
  skyIndex = skyOrder.indexOf(key);
  const dust = dustStorm ? 1.0 : 0.0;
  const preset = sky.applySky(key, dust);
  syncCinematicSun(preset, dust);
  godRays.syncSun(key, preset.sunDir);
  colossus.uplights.forEach((l, i) => {
    l.intensity = (i === 0 ? 48 : 68) * preset.uplightMul;
  });
  const fogPreset = { ...preset, fogDensity: dustStorm ? preset.fogDensity * 2.1 : preset.fogDensity };
  megaport.setSunLighting(fogPreset);
  playerCar.setSunLighting(fogPreset);
  roadsters.setSunLighting(fogPreset);
  document.getElementById('hud-sky').textContent = preset.name;
}

function toggleDustStorm() {
  dustStorm = !dustStorm;
  setSkyMode(skyOrder[skyIndex]);
  moteMat.opacity = dustStorm ? 0.68 : 0.28;
  moteMat.size = dustStorm ? 1.65 : 0.85;
  document.getElementById('btn-dust').classList.toggle('active', dustStorm);
  updateEnvironmentBadge();
}

function setTouchControls(enabled) {
  touchControlsEnabled = !!enabled;
  const mc = document.getElementById('mobile-controls');
  const btn = document.getElementById('btn-touchpad');
  if (mc) mc.classList.toggle('visible', experienceStarted && touchControlsEnabled);
  if (btn) btn.classList.toggle('active', touchControlsEnabled);
}

function triggerFootJump() {
  if (!player.inVehicle && player.grounded) {
    player.velY = player.inside ? 2.6 : 4.85;
    player.grounded = false;
  }
}

// =========================================================================
// 4. INPUT & UI BINDINGS (GTA DRIVE/FLIGHT + FREE ORBIT + FULL MOBILE TOUCH)
// =========================================================================
const introOverlay = document.getElementById('intro-overlay');
const btnStart = document.getElementById('btn-start');
const bootLoader = document.getElementById('boot-loader');
const bootBarFill = document.getElementById('boot-bar-fill');
const bootPctEl = document.getElementById('boot-pct');
const bootStatusEl = document.getElementById('boot-status');
let bootReady = false;
let bootProgressDisplay = 0.08;
let warmRenderFrames = 0;

function getRawAssetLoadProgress() {
  const cProg = colossus.getProgress ? colossus.getProgress() : (colossus.isLoaded() ? 1 : 0);
  const sProg = isStarshipLoaded() ? 1 : 0;
  const rProg = isRoadsterLoaded() ? 1 : 0;
  const oProg = isOptimusLoaded() ? 1 : 0;
  const vProg = isCyberRoverLoaded() ? 1 : 0;
  const hProg = isColonistLoaded() ? 1 : 0;
  return cProg * 0.42 + sProg * 0.20 + rProg * 0.18 + oProg * 0.08 + vProg * 0.06 + hProg * 0.06;
}

function areAllModelsLoaded() {
  return (
    colossus.isLoaded() &&
    isStarshipLoaded() &&
    isRoadsterLoaded() &&
    isOptimusLoaded() &&
    isCyberRoverLoaded() &&
    isColonistLoaded()
  );
}

function enterExperience() {
  experienceStarted = true;
  bootReady = true;
  if (bootLoader) bootLoader.classList.add('done');
  introOverlay.classList.remove('ready');
  introOverlay.classList.add('hidden');
  document.getElementById('hud-root').classList.remove('hud-hidden');
  playerCar.teleportCar(DISTRICTS[0].x, DISTRICTS[0].z, DISTRICTS[0].heading, 0);
  setTouchControls(touchControlsEnabled);
  audio.init();
  snapChaseCameraImmediately();
  updateEnvironmentBadge();
  showToast("FOUNDER'S RIDGE OVERLOOK", '로드스터 탑승 · WASD 주행 / SPACE 상승 / Q·Ctrl·X 하강 / SHIFT 부스터');
}

btnStart.addEventListener('click', () => enterExperience());

canvas.addEventListener('mousedown', (e) => {
  if (!bootReady) return;
  if (!experienceStarted) {
    enterExperience();
    return;
  }
  audio.init();
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  if (touchState.mouseStickActive) resetVirtualStick();
  touchState.liftHeld = false;
  touchState.descendHeld = false;
  touchState.boostHeld = false;
  const bl = document.getElementById('touch-btn-lift');
  const bd = document.getElementById('touch-btn-descend');
  const bb = document.getElementById('touch-btn-boost');
  if (bl) bl.classList.remove('pressed');
  if (bd) bd.classList.remove('pressed');
  if (bb) bb.classList.remove('pressed');
});

window.addEventListener('mousemove', (e) => {
  if (!experienceStarted) return;
  if (touchState.mouseStickActive) {
    updateVirtualStickFromPoint(e.clientX, e.clientY);
    return;
  }
  if (isDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (player.inVehicle) {
      player.chaseYawOffset -= dx * 0.0048;
      player.chasePitch = THREE.MathUtils.clamp(player.chasePitch + dy * 0.0038, -0.62, 0.78);
      player.orbitIdleTimer = 2.6;
    } else {
      player.yaw -= dx * 0.0038;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0038, -1.25, 1.32);
    }
  }
});

// =========================================================================
// 4B. MULTI-TOUCH MOBILE VIRTUAL THUMBSTICK + FREE ORBIT + FLY/DESCEND/BOOST/MOUNT
// =========================================================================
const stickZone = document.getElementById('touch-stick-zone');
const stickBase = document.getElementById('touch-stick-base');
const stickKnob = document.getElementById('touch-stick-knob');
const STICK_MAX_R = 44;

function updateVirtualStickFromPoint(clientX, clientY) {
  let dx = clientX - touchState.stickOriginX;
  let dy = clientY - touchState.stickOriginY;
  const dist = Math.hypot(dx, dy);
  if (dist > STICK_MAX_R) {
    dx = (dx / dist) * STICK_MAX_R;
    dy = (dy / dist) * STICK_MAX_R;
  }
  const normDist = Math.min(1, dist / STICK_MAX_R);
  touchState.stickX = dx / STICK_MAX_R;
  touchState.stickY = -dy / STICK_MAX_R;
  touchState.sprint = normDist > 0.88;
  if (stickKnob) stickKnob.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
  if (stickBase) {
    stickBase.classList.toggle('active', normDist > 0.05);
    stickBase.classList.toggle('sprinting', touchState.sprint);
  }
}

function resetVirtualStick() {
  touchState.stickTouchId = null;
  touchState.mouseStickActive = false;
  touchState.stickX = 0;
  touchState.stickY = 0;
  touchState.sprint = false;
  if (stickKnob) stickKnob.style.transform = 'translate3d(0px, 0px, 0)';
  if (stickBase) {
    stickBase.classList.remove('active');
    stickBase.classList.remove('sprinting');
  }
}

if (stickZone && stickBase) {
  stickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!experienceStarted) enterExperience();
    audio.init();
    if (touchState.stickTouchId !== null) return;
    const t = e.changedTouches[0];
    touchState.stickTouchId = t.identifier;
    const rect = stickBase.getBoundingClientRect();
    const baseCx = rect.left + rect.width * 0.5;
    const baseCy = rect.top + rect.height * 0.5;
    if (Math.hypot(t.clientX - baseCx, t.clientY - baseCy) < 78) {
      touchState.stickOriginX = baseCx;
      touchState.stickOriginY = baseCy;
    } else {
      touchState.stickOriginX = t.clientX;
      touchState.stickOriginY = t.clientY;
    }
    updateVirtualStickFromPoint(t.clientX, t.clientY);
  }, { passive: false });

  stickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchState.stickTouchId) {
        updateVirtualStickFromPoint(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  const endStick = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchState.stickTouchId) {
        resetVirtualStick();
        break;
      }
    }
  };
  stickZone.addEventListener('touchend', endStick, { passive: false });
  stickZone.addEventListener('touchcancel', endStick, { passive: false });

  stickBase.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (!experienceStarted) enterExperience();
    const rect = stickBase.getBoundingClientRect();
    touchState.mouseStickActive = true;
    touchState.stickOriginX = rect.left + rect.width * 0.5;
    touchState.stickOriginY = rect.top + rect.height * 0.5;
    updateVirtualStickFromPoint(e.clientX, e.clientY);
  });
}

// Right-Side Touch-Drag Camera Orbit / Look
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!experienceStarted) {
    enterExperience();
    return;
  }
  audio.init();
  if (touchState.lookTouchId !== null) return;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier !== touchState.stickTouchId) {
      touchState.lookTouchId = t.identifier;
      touchState.lastLookX = t.clientX;
      touchState.lastLookY = t.clientY;
      break;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (touchState.lookTouchId === null) return;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === touchState.lookTouchId) {
      const dx = t.clientX - touchState.lastLookX;
      const dy = t.clientY - touchState.lastLookY;
      touchState.lastLookX = t.clientX;
      touchState.lastLookY = t.clientY;
      if (player.inVehicle) {
        player.chaseYawOffset -= dx * 0.0062;
        player.chasePitch = THREE.MathUtils.clamp(player.chasePitch + dy * 0.0048, -0.62, 0.78);
        player.orbitIdleTimer = 2.6;
      } else {
        player.yaw -= dx * 0.0052;
        player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0046, -1.25, 1.32);
      }
      break;
    }
  }
}, { passive: false });

const endLook = (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === touchState.lookTouchId) {
      touchState.lookTouchId = null;
      break;
    }
  }
};
canvas.addEventListener('touchend', endLook, { passive: false });
canvas.addEventListener('touchcancel', endLook, { passive: false });

// Mobile FLY / DESCEND / BOOST / MOUNT / CAM Buttons
function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  const down = (e) => { e.preventDefault(); e.stopPropagation(); audio.init(); el.classList.add('pressed'); onDown(); };
  const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); onUp(); };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
}
bindHoldButton('touch-btn-lift', () => { touchState.liftHeld = true; triggerFootJump(); }, () => { touchState.liftHeld = false; });
bindHoldButton('touch-btn-descend', () => { touchState.descendHeld = true; }, () => { touchState.descendHeld = false; });
bindHoldButton('touch-btn-boost', () => { touchState.boostHeld = true; }, () => { touchState.boostHeld = false; });

const tMountBtn = document.getElementById('touch-btn-mount');
if (tMountBtn) {
  tMountBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); toggleVehicleMount(); }, { passive: false });
  tMountBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleVehicleMount(); });
}
const tCamBtn = document.getElementById('touch-btn-cam');
if (tCamBtn) {
  tCamBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); cycleCameraMode(); }, { passive: false });
  tCamBtn.addEventListener('click', (e) => { e.stopPropagation(); cycleCameraMode(); });
}

const btnMobileMenu = document.getElementById('btn-mobile-menu');
const hudDrawer = document.getElementById('hud-drawer');
if (btnMobileMenu && hudDrawer) {
  btnMobileMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = hudDrawer.classList.toggle('open');
    btnMobileMenu.classList.toggle('active', open);
  });
}

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();
  }
  keys[e.code] = true;
  if (!experienceStarted && (e.code === 'Space' || e.code === 'Enter')) {
    enterExperience();
    return;
  }
  if (e.code === 'KeyF') toggleVehicleMount();
  if (e.code === 'KeyC') cycleCameraMode();
  if (e.code === 'KeyE') cycleAirlock();
  if (e.code === 'KeyB') toggleBioDome();
  if (e.code === 'KeyL') { audio.init(); megaport.triggerLaunchOrLanding(); }
  if (e.code === 'KeyR') { audio.init(); roadsters.triggerRoadsterHop(); }
  if (e.code === 'KeyV') setSkyMode(skyOrder[(skyIndex + 1) % skyOrder.length]);
  if (e.code === 'KeyG') toggleDustStorm();
  if (e.code === 'KeyM') {
    const m = audio.toggleMute();
    document.getElementById('btn-mute').textContent = m ? '음소거(M)' : '음성(M)';
  }
  if (e.code === 'KeyH') document.getElementById('hud-root').classList.toggle('hud-hidden');
  if (e.code === 'Digit1') teleportTo(0);
  if (e.code === 'Digit2') teleportTo(1);
  if (e.code === 'Digit3') teleportTo(2);
  if (e.code === 'Digit4') teleportTo(3);
  if (e.code === 'Digit5') teleportTo(4);
  if (e.code === 'Digit6') teleportTo(5);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

document.querySelectorAll('.vp-btn').forEach((btn, idx) => {
  btn.addEventListener('click', () => { audio.init(); teleportTo(idx); });
});
document.getElementById('btn-mount').addEventListener('click', toggleVehicleMount);
document.getElementById('btn-cam').addEventListener('click', cycleCameraMode);
document.getElementById('btn-airlock').addEventListener('click', cycleAirlock);
const btnBiodome = document.getElementById('btn-biodome');
if (btnBiodome) btnBiodome.addEventListener('click', toggleBioDome);
document.getElementById('btn-launch').addEventListener('click', () => { audio.init(); megaport.triggerLaunchOrLanding(); closeMobileDrawer(); });
document.getElementById('btn-sky').addEventListener('click', () => setSkyMode(skyOrder[(skyIndex + 1) % skyOrder.length]));
document.getElementById('btn-dust').addEventListener('click', toggleDustStorm);
document.getElementById('btn-mute').addEventListener('click', () => {
  audio.init();
  const m = audio.toggleMute();
  document.getElementById('btn-mute').textContent = m ? '음소거(M)' : '음성(M)';
});
const btnTouchpad = document.getElementById('btn-touchpad');
if (btnTouchpad) {
  btnTouchpad.classList.toggle('active', touchControlsEnabled);
  btnTouchpad.addEventListener('click', () => setTouchControls(!touchControlsEnabled));
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = getBaseFov();
  camera.updateProjectionMatrix();
  const dprCap = (isTouchDevice || isMobileViewport()) ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (isMobileViewport() && !touchControlsEnabled) setTouchControls(true);
  updateEnvironmentBadge();
});

// Automated QA & inspection hooks
window.__ARCADIA__ = {
  teleportTo,
  toggleVehicleMount,
  cycleAirlock,
  toggleBioDome,
  cycleCameraMode,
  setSkyMode,
  toggleDustStorm,
  setTouchControls,
  triggerLaunch: () => megaport.triggerLaunchOrLanding(),
  getMegaport: () => megaport,
  triggerRoadster: () => roadsters.triggerRoadsterHop(),
  simulateFlight: (lift = true, boost = true, steerDir = 0) => {
    keys['Space'] = lift;
    keys['ShiftLeft'] = boost;
    keys['KeyW'] = true;
    keys['KeyA'] = steerDir > 0;
    keys['KeyD'] = steerDir < 0;
  },
  simulateDescent: (active = true) => {
    keys['Space'] = false;
    keys['KeyQ'] = !!active;
    touchState.descendHeld = !!active;
  },
  getRoadsterState: () => playerCar.state,
  stopInput: () => {
    keys['Space'] = false; keys['ShiftLeft'] = false; keys['KeyW'] = false;
    keys['KeyA'] = false; keys['KeyD'] = false;
    keys['KeyQ'] = false; keys['ControlLeft'] = false; keys['ControlRight'] = false; keys['KeyX'] = false;
    touchState.liftHeld = false; touchState.descendHeld = false; touchState.boostHeld = false;
  },
  setChaseOrbit: (yawOff = 0, pitch = 0.08) => {
    player.chaseYawOffset = yawOff;
    player.chasePitch = pitch;
    player.orbitIdleTimer = 8.0;
  },
  teleportCustom: (x, z, heading, airAlt = 0) => {
    player.inVehicle = true;
    player.inside = false;
    player.interiorZone = null;
    player.chaseYawOffset = 0;
    player.chasePitch = airAlt > 8 ? 0.16 : 0.08;
    playerCar.teleportCar(x, z, heading, airAlt);
    player.pos.copy(playerCar.state.pos).add(new THREE.Vector3(0, player.eyeHeight, 0));
    snapChaseCameraImmediately();
    updateEnvironmentBadge();
  },
  setFootView: (x, y, z, yaw, pitch, zone = null) => {
    player.inVehicle = false;
    player.interiorZone = zone;
    player.inside = !!zone;
    player.pos.set(x, y, z);
    player.yaw = yaw;
    player.pitch = pitch;
    player.velY = 0;
    player.grounded = true;
    updateEnvironmentBadge();
  },
  enterExperience: () => enterExperience(),
  isColossusLoaded: () => colossus.isLoaded()
};

// =========================================================================
// 5. MAIN 60FPS GTA OPEN-WORLD SIMULATION, CHASE CAM & RADAR RENDER LOOP
// =========================================================================
const clock = new THREE.Clock();
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const targetCamPos = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();

const hudCoords = document.getElementById('hud-coords');
const hudPort = document.getElementById('hud-port');
const vehSpeedEl = document.getElementById('veh-speed');
const vehAltEl = document.getElementById('veh-alt');
const vehVspeedEl = document.getElementById('veh-vspeed');
const vehModeEl = document.getElementById('veh-mode');
const copvBarEl = document.getElementById('copv-bar-fill');
const copvPctEl = document.getElementById('copv-pct');
const mobSpeedEl = document.getElementById('mob-speed');

let prevInAir = false;
playerCar.teleportCar(DISTRICTS[0].x, DISTRICTS[0].z, DISTRICTS[0].heading, 0);
setSkyMode('blueSunset');
snapChaseCameraImmediately();
updateEnvironmentBadge();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  // Fade district toast cleanly
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      const el = document.getElementById('district-toast');
      if (el) el.classList.remove('show');
    }
  }

  // Update living world systems (pass camera.position for exact back-to-front volumetric cloud sorting!)
  sky.update(elapsed);
  updateCinematicShaderTime(elapsed);
  colony.update(dt, elapsed);
  megaport.update(dt, elapsed, camera.position);
  roadsters.update(dt, elapsed, camera.position);
  optimus.update(dt, elapsed);

  // Build unified Keyboard + Mobile Touch driving/flight input
  let throttle = 0;
  let steer = 0;
  if (keys['KeyW'] || keys['ArrowUp']) throttle += 1;
  if (keys['KeyS'] || keys['ArrowDown']) throttle -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) steer += 1;
  if (keys['KeyD'] || keys['ArrowRight']) steer -= 1;
  if (Math.abs(touchState.stickY) > 0.08) throttle += touchState.stickY;
  if (Math.abs(touchState.stickX) > 0.08) steer -= touchState.stickX;
  throttle = THREE.MathUtils.clamp(throttle, -1, 1);
  steer = THREE.MathUtils.clamp(steer, -1, 1);

  const lift = !!(keys['Space'] || touchState.liftHeld);
  const descend = !!(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyQ'] || keys['KeyX'] || touchState.descendHeld);
  const boost = !!(keys['ShiftLeft'] || keys['ShiftRight'] || touchState.boostHeld);

  // Camera & Movement Controller
  let activeCamYaw = player.yaw;

  if (!experienceStarted) {
    // Tight heroic Scene-03 opening under Mars Blue Sunset:
    //   - Left: the 212m Colossus towering close & intimate, Flying Roadster hovering in front of it
    //   - Center Midground: Arcadia Bio-Domes & Metro Viaduct
    //   - Right sky (below the MUSKPUNK 2065 logo): Megaport Starships launching & landing live
    const isPortrait = window.innerWidth < window.innerHeight;
    const cfg = window.__ARCADIA_INTRO_CAM || (isPortrait ? INTRO_CAM_PORTRAIT : INTRO_CAM_DESKTOP);
    const orb = Math.sin(elapsed * 0.14) * cfg.orbit;
    const introFov = cfg.fov;
    if (Math.abs(camera.fov - introFov) > 0.1) {
      camera.fov = introFov;
      camera.updateProjectionMatrix();
    }
    const camX = cfg.pos[0] + orb * 0.45;
    const camY = cfg.pos[1] + Math.sin(elapsed * 0.12) * 1.4;
    const camZ = cfg.pos[2] - orb * 0.38;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(cfg.look[0], cfg.look[1], cfg.look[2]);
    // Hovering Flying Roadster anchored smoothly in camera space (gentle parallax, zero drift over statue).
    introFwd.set(cfg.look[0] - camX, 0, cfg.look[2] - camZ).normalize();
    introRight.set(-introFwd.z, 0, introFwd.x);
    const cx = camX + introFwd.x * cfg.car[0] + introRight.x * cfg.car[1];
    const cz = camZ + introFwd.z * cfg.car[0] + introRight.z * cfg.car[1];
    playerCar.setIntroHoverPose(cx, camY + cfg.car[2], cz, cfg.car[3], dt, elapsed, camera.position);
    activeCamYaw = 0.22;
  } else {
    // Update Player Roadster physics (parked with idle dampers when on foot!)
    playerCar.update(dt, elapsed, { throttle, steer, lift, descend, boost }, player.inVehicle, camera.position);
  }

  // Active world coordinate for District Detector, Dust Motes & Radar Minimap
  const activePos = player.inVehicle ? playerCar.state.pos : player.pos;
  expansion.update(dt, elapsed);

  // Keep sunlit ambient Martian dust motes centered around player across the entire open world!
  const windSpeed = dustStorm ? 5.4 : 1.1;
  const mp = moteGeo.attributes.position;
  for (let i = 0; i < moteCount; i++) {
    let mx = mp.getX(i) + moteVel[i] * windSpeed * dt;
    let mz = mp.getZ(i);
    if (mx - activePos.x > 130) mx -= 260;
    if (mx - activePos.x < -130) mx += 260;
    if (mz - activePos.z > 130) mz -= 260;
    if (mz - activePos.z < -130) mz += 260;
    mp.setXYZ(i, mx, mp.getY(i), mz);
  }
  mp.needsUpdate = true;

  if (!experienceStarted) {
    // Intro camera already updated above
  } else if (player.inVehicle) {
    const s = playerCar.state;

    // Update top HUD badge cleanly whenever crossing grounded <-> hover-flight
    const inAir = !s.grounded;
    if (inAir !== prevInAir) {
      prevInAir = inAir;
      updateEnvironmentBadge();
    }

    // Gently auto-recenter chase orbit offset when driving/flying without manual drag
    if (player.orbitIdleTimer > 0) {
      player.orbitIdleTimer -= dt;
    } else if (!isDragging && touchState.lookTouchId === null && Math.abs(throttle) > 0.1) {
      player.chaseYawOffset = THREE.MathUtils.lerp(player.chaseYawOffset, 0, Math.min(1, dt * 2.2));
    }

    const viewYaw = s.heading + player.chaseYawOffset;
    const fwdX = Math.sin(viewYaw), fwdZ = Math.cos(viewYaw);

    if (player.camMode === 2) {
      // 1st-Person Sleek Roadster Hood/Cockpit Cam!
      const cfX = Math.sin(s.heading), cfZ = Math.cos(s.heading);
      camera.position.set(s.pos.x + cfX * 0.45, s.pos.y + 1.48, s.pos.z + cfZ * 0.45);
      camera.lookAt(s.pos.x + cfX * 42, s.pos.y + 1.5 - s.pitch * 18, s.pos.z + cfZ * 42);
    } else {
      // Silky GTA 3rd-Person Chase Camera (Near / Wide) + Dynamic Speed Pullback & FOV Punch!
      const speedFrac = Math.min(1, s.speedKmh / 240);
      const baseDist = player.camMode === 1 ? 13.8 : 9.2;
      const dist = baseDist + speedFrac * 2.4 + (inAir ? 2.2 : 0);
      const liftH = (player.camMode === 1 ? 4.2 : 2.65) + Math.sin(player.chasePitch) * dist * 0.55;

      targetCamPos.set(
        s.pos.x - fwdX * dist,
        Math.max(getTerrainHeight(s.pos.x - fwdX * dist, s.pos.z - fwdZ * dist) + 1.1, s.pos.y + liftH),
        s.pos.z - fwdZ * dist
      );
      targetLookAt.set(
        s.pos.x + fwdX * 14,
        s.pos.y + (inAir ? 2.8 : 3.75) - Math.min(0, Math.sin(player.chasePitch)) * 12.0,
        s.pos.z + fwdZ * 14
      );
      player.smoothCamPos.lerp(targetCamPos, Math.min(1, dt * 8.5));
      player.smoothLookAt.lerp(targetLookAt, Math.min(1, dt * 11.0));
      const rumble = s.boostPower * 0.035;
      camera.position.set(
        player.smoothCamPos.x + (rumble > 0.004 ? Math.sin(elapsed * 95) * rumble : 0),
        player.smoothCamPos.y + (rumble > 0.004 ? Math.cos(elapsed * 112) * rumble * 0.75 : 0),
        player.smoothCamPos.z
      );
      camera.lookAt(player.smoothLookAt);
    }

    // Dynamic Boost Speed FOV punch (64° -> 78° when firing aft rocket booster!)
    const targetFov = getBaseFov() + s.boostPower * 11.5 + Math.min(5.0, (s.speedKmh / 240) * 5.0);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 6));
      camera.updateProjectionMatrix();
    }

    activeCamYaw = viewYaw - Math.PI;
    audio.updateVehicleAudio(s.speedKmh / 190, s.liftPower, s.boostPower, true, s.descentPower);
    if (s.rcsPower > 0.44) audio.playRcsPuff(s.rcsPower);
  } else {
    // 0.38G Mars First-Person Walking Mode (after hopping out of Roadster with `F`!)
    let moveF = 0, moveR = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveF += 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveF -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveR += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveR -= 1;
    if (Math.abs(touchState.stickY) > 0.08) moveF += touchState.stickY;
    if (Math.abs(touchState.stickX) > 0.08) moveR += touchState.stickX;

    const sprinting = keys['ShiftLeft'] || keys['ShiftRight'] || touchState.sprint || touchState.boostHeld;
    const speed = (player.inside ? 5.8 : 9.8) * (sprinting ? 1.85 : 1.0);

    forwardVec.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    rightVec.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const moveDir = new THREE.Vector3().addScaledVector(forwardVec, moveF).addScaledVector(rightVec, moveR);
    const mag = moveDir.length();
    player.walking = mag > 0.05;
    if (player.walking) {
      moveDir.normalize().multiplyScalar(Math.min(1, mag) * speed * dt);
      const cl = clampFootPosition(player.pos.x + moveDir.x, player.pos.z + moveDir.z, player.inside);
      player.pos.x = cl.x;
      player.pos.z = cl.z;
    }

    if (keys['Space'] && player.grounded) triggerFootJump();
    player.velY -= 3.71 * dt;
    player.pos.y += player.velY * dt;
    const floorY = getWalkableFloor(player.pos.x, player.pos.z, player.inside);
    if (player.pos.y <= floorY + player.eyeHeight) {
      player.pos.y = floorY + player.eyeHeight;
      player.velY = 0;
      player.grounded = true;
    }

    let bob = 0;
    if (player.walking && player.grounded) {
      player.bobTime += dt * (sprinting ? 9.5 : 6.4);
      bob = Math.sin(player.bobTime) * 0.055;
    }
    camera.position.set(player.pos.x, player.pos.y + bob, player.pos.z);
    euler.set(player.pitch, player.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    activeCamYaw = player.yaw;

    const baseFov = getBaseFov();
    if (Math.abs(camera.fov - baseFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, baseFov, Math.min(1, dt * 6));
      camera.updateProjectionMatrix();
    }
    audio.updateVehicleAudio(0, 0, 0, false, 0);
  }

  // Detect District Changes for GTA Zone Entry Toast!
  if (experienceStarted) {
    const inColossusAirspace = activePos.y > 65 && Math.hypot(activePos.x - colX, activePos.z - colZ) < 155;
    const distNow = inColossusAirspace
      ? { id: 'colossus', name: 'MONUMENT "AD ASTRA"', kr: '212m 머스크 거상 공중관람' }
      : getCurrentDistrict(activePos.x, activePos.z);
    if (distNow.id !== currentDistrictId && distNow.id !== 'wilds') {
      currentDistrictId = distNow.id;
      showToast(distNow.name, distNow.kr);
    }
  }

  // Render Live GTA Tactical Radar Minimap
  minimap.render(activePos, activeCamYaw, playerCar.state.pos, player.inVehicle);

  // Update Telemetry & Vehicle Instrument Cluster
  const cs = playerCar.state;
  if (hudCoords) {
    hudCoords.textContent = isMobileViewport()
      ? `ALT:+${Math.round(activePos.y)}m`
      : `X:${Math.round(activePos.x)}m  Z:${Math.round(activePos.z)}m  ALT:+${Math.round(activePos.y)}m`;
  }
  if (hudPort) hudPort.textContent = `MEGAPORT: ${megaport.getStatus()}`;
  if (vehSpeedEl) vehSpeedEl.textContent = String(cs.speedKmh);
  if (vehAltEl) vehAltEl.textContent = `${Math.round(cs.altAGL)}m`;
  if (vehVspeedEl) {
    const vy = cs.vel.y;
    vehVspeedEl.textContent = Math.abs(vy) < 0.3
      ? 'V/S 0.0 m/s'
      : (vy > 0 ? `↑ +${vy.toFixed(1)} m/s` : `↓ ${vy.toFixed(1)} m/s`);
    vehVspeedEl.style.color = cs.descentPower > 0.18 ? '#7dd3fc' : (vy > 1.0 ? '#5eead4' : '#c6bcb2');
  }
  if (vehModeEl) {
    const descending = cs.descentPower > 0.20 && !cs.grounded;
    vehModeEl.classList.toggle('descending', descending);
    vehModeEl.textContent = cs.onSkyPad && cs.copvFuel < 99.5
      ? 'SKY-PAD RECHARGING'
      : descending
        ? 'COLD-GAS DESCENT'
        : cs.boostPower > 0.25
          ? 'AFT ROCKET BOOST'
          : !cs.grounded
            ? 'COLD-GAS FLIGHT'
            : '0.38G GROUND DRIVE';
  }
  if (copvBarEl) copvBarEl.style.width = `${Math.round(cs.copvFuel)}%`;
  if (copvPctEl) copvPctEl.textContent = `${Math.round(cs.copvFuel)}%`;
  if (mobSpeedEl) mobSpeedEl.textContent = `${cs.speedKmh} km/h · ${Math.round(cs.altAGL)}m`;

  composer.render();

  if (!bootReady) {
    const rawProg = getRawAssetLoadProgress();
    const allLoaded = areAllModelsLoaded();
    if (allLoaded) warmRenderFrames += 1;
    const targetProg = allLoaded && warmRenderFrames >= 3 ? 1.0 : Math.min(0.96, 0.08 + rawProg * 0.88);
    bootProgressDisplay = Math.max(
      bootProgressDisplay,
      THREE.MathUtils.lerp(bootProgressDisplay, targetProg, Math.min(1, dt * 11))
    );
    const pct = allLoaded && warmRenderFrames >= 3 ? 100 : Math.min(99, Math.round(bootProgressDisplay * 100));
    if (bootBarFill) bootBarFill.style.width = `${pct}%`;
    if (bootPctEl) bootPctEl.textContent = `${pct}%`;
    if (bootStatusEl) {
      bootStatusEl.textContent = pct < 45
        ? 'DECOMPRESSING 3D COLONY ASSETS...'
        : pct < 90
          ? 'ASSEMBLING 212M COLOSSUS & MEGAPORT...'
          : 'SYNCHRONIZING O₂ METERING...';
    }
    if (pct >= 100) {
      bootReady = true;
      if (bootLoader) bootLoader.classList.add('done');
      if (!experienceStarted && introOverlay) introOverlay.classList.add('ready');
    }
  }
}

animate();
