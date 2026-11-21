import * as THREE from 'three';
import { getTerrainHeight, getTerrainNormal } from './terrain.js';
import { buildRoadsterMesh } from './assets/roadster.js';
import { SKY_PADS } from './assets/world_expansion.js';
import { createVolumetricCloudSystem } from './vfx/volumetric_clouds.js';
/**
 * GTA-Style Player-Controlled Flying Tesla Roadster Rocket-M:
 *  - Starts right on Founder's Ridge Overlook facing the 100m Elon Musk Colossus, Bio-Domes & Starships!
 *  - Electric Plaid 0.38G Mars driving (terrain-hugging suspension, front-wheel steer, tire dust roostertails)
 *  - 4 underside white supersonic N2/CO2 vertical lift thrusters + 6 lateral RCS attitude nozzles
 *  - SpaceX behind-the-license-plate Aft Main Rocket Booster (SHIFT / Mobile BOOST) up to 280 km/h!
 *  - Photorealistic GPU-instanced volumetric billowing cryogenic plumes & Martian regolith downwash dust!
 */
export function createPlayerRoadster(textures, ramps = []) {
  const root = new THREE.Group();
  const rig = buildRoadsterMesh(textures);
  root.add(rig.car);

  // Subtle floating cyan beacon visible ONLY when player exits the Roadster on foot (GTA parked car marker!)
  const beaconMat = new THREE.MeshBasicMaterial({
    color: '#38e8d8',
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const beaconCone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 4), beaconMat);
  beaconCone.rotation.x = Math.PI;
  beaconCone.position.set(0, 3.3, 0);
  rig.car.add(beaconCone);

  // GPU-Instanced Volumetric 3D-Lit Cauliflower Cloud Engine for Booster Vapor, Lateral RCS & Martian Dust!
  const vfxClouds = createVolumetricCloudSystem(textures.cloudVolAtlas, 180, { renderOrder: 8 });
  root.add(vfxClouds.mesh);

  function spawnDust(x, y, z, vx, vy, vz, baseS = 2.0, maxLife = 1.15) {
    vfxClouds.spawn({
      x, y, z, vx, vy, vz,
      drag: 0.44,
      buoyancy: 0.75,
      startSize: baseS * 0.85,
      endSize: baseS * 2.85,
      maxLife,
      maxOp: 0.54,
      density: 0.96,
      scatter: 0.55,
      stretchY: 0.72,
      wispiness: 1.08,
      litCol: [0.36, 0.13, 0.052], // True linear iron-oxide Martian sand!
      shadCol: [0.055, 0.017, 0.010]
    });
  }

  function spawnVapor(x, y, z, vx, vy, vz, baseS = 1.4, maxLife = 0.72, maxOp = 0.34) {
    vfxClouds.spawn({
      x, y, z, vx, vy, vz,
      drag: 0.36,
      buoyancy: 0.35,
      startSize: baseS * 0.75,
      endSize: baseS * 2.95,
      maxLife,
      maxOp: maxOp * 0.62,
      density: 0.78,
      scatter: 0.95,
      stretchY: 0.88,
      wispiness: 1.52, // Ultra-feathery translucent cold-gas cryo mist (ZERO popcorn cotton balls!)
      litCol: [0.46, 0.54, 0.62],
      shadCol: [0.16, 0.21, 0.26]
    });
  }

  // GLSL Supersonic Ground-Impingement Vortex Shock Ring (hugs terrain directly under Roadster during low hover!)
  const shockRingMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        if (uIntensity <= 0.01) discard;
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float ripple = 0.5 + 0.5 * sin(r * 18.0 - uTime * 22.0 + sin(ang * 6.0 + uTime * 4.0) * 0.6);
        float ring = exp(-pow((r - 0.52) / 0.28, 2.0)) * (0.65 + 0.35 * ripple);
        float innerFrost = exp(-r * r * 5.0) * 0.75;
        vec3 col = mix(vec3(0.86, 0.56, 0.36), vec3(0.82, 0.94, 1.0), clamp(innerFrost + (1.0 - r) * 0.5, 0.0, 1.0));
        float alpha = (ring + innerFrost) * (1.0 - smoothstep(0.75, 1.0, r)) * uIntensity * 0.68;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const groundShockRing = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 11.5), shockRingMat);
  groundShockRing.rotation.x = -Math.PI / 2;
  groundShockRing.visible = false;
  root.add(groundShockRing);

  // Initial Hero Spawn on Founder's Ridge Overlook facing Colossus (left), Bio-Domes (ahead), Megaport (right)!
  const spawnX = 2.0, spawnZ = -4;
  const state = {
    pos: new THREE.Vector3(spawnX, getTerrainHeight(spawnX, spawnZ) + 0.05, spawnZ),
    vel: new THREE.Vector3(),
    heading: Math.PI + 0.14, // Faces NNW directly into the iconic Scene 03/06 panorama!
    pitch: 0,
    roll: 0,
    steerVisual: 0,
    grounded: true,
    flying: false,
    altAGL: 0,
    speedKmh: 0,
    copvFuel: 100.0, // 0..100% N2/CO2 pressurized cold-gas tank
    onSkyPad: null,
    liftPower: 0,
    descentPower: 0,
    boostPower: 0,
    rcsPower: 0,
    rcs: { fl: 0, fr: 0, ml: 0, mr: 0, rl: 0, rr: 0 },
    braking: false
  };

  const terrainN = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  /**
   * Computes highest walkable/drivable ground surface (terrain + elevated Sky-Pads + Steel Stunt Ramps!)
   */
  function getSupportSurface(x, z, curY) {
    let groundY = getTerrainHeight(x, z);
    let padHit = null;
    let rampBoost = 0;

    // Check Elevated Sky-Pad landing decks
    for (const pad of SKY_PADS) {
      if (Math.hypot(x - pad.x, z - pad.z) < pad.r && curY >= pad.y - 1.2) {
        if (pad.y > groundY) {
          groundY = pad.y;
          padHit = pad;
        }
      }
    }

    // Check Stunt Launch Ramps (smooth ascending wedge surface!)
    for (const rp of ramps) {
      const dx = x - rp.x;
      const dz = z - rp.z;
      const c = Math.cos(-rp.rotY), s = Math.sin(-rp.rotY);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < 4.6 && lz > -9.2 && lz < 9.2) {
        const frac = THREE.MathUtils.clamp((lz + 9.0) / 18.0, 0, 1);
        const rY = rp.y + frac * 4.7;
        if (rY > groundY) {
          groundY = rY;
          if (frac > 0.78) rampBoost = 1.0;
        }
      }
    }

    return { groundY, padHit, rampBoost };
  }

  function teleportCar(x, z, heading = Math.PI, airAlt = 0) {
    const surf = getSupportSurface(x, z, 200);
    state.pos.set(x, surf.groundY + airAlt + 0.05, z);
    state.vel.set(0, 0, 0);
    state.heading = heading;
    state.pitch = 0;
    state.roll = 0;
    state.grounded = airAlt <= 0.2;
    state.flying = airAlt > 0.2;
    state.liftPower = 0;
    state.descentPower = 0;
    state.boostPower = 0;
    state.copvFuel = 100.0;
    syncVisuals(0.016, 0, true);
  }

  function syncVisuals(dt, t, inVehicle) {
    rig.car.position.copy(state.pos);
    rig.car.rotation.order = 'YXZ';
    rig.car.rotation.set(state.pitch, state.heading, state.roll);

    // Front wheel steering angle & 4-wheel rolling speed
    const fwdSpeed = state.vel.x * Math.sin(state.heading) + state.vel.z * Math.cos(state.heading);
    rig.frontPivots.forEach((p) => { p.rotation.y = state.steerVisual * 0.44; });
    const spinRate = state.grounded ? (fwdSpeed / 0.38) : (fwdSpeed * 0.35);
    rig.wheels.forEach((w) => { w.rotation.x += spinRate * dt; });

    // Dynamic ruby brake lights when braking/reversing
    rig.tailMat.color.set(state.braking ? '#ff5c4d' : (inVehicle ? '#df2b22' : '#7a1c17'));

    // Drive Dual-Layer GLSL Supersonic Cold-Gas Mach-Diamond Plumes + 6-Nozzle Lateral RCS + 4 Dorsal Retro-Descent Thrusters!
    const steerL = Math.max(0, -state.steerVisual) * (state.flying ? 0.95 : 0.45);
    const steerR = Math.max(0,  state.steerVisual) * (state.flying ? 0.95 : 0.45);
    rig.setThrusterFx(t, state.liftPower, state.boostPower, steerL, steerR, state.rcs, state.descentPower);

    // Fade contact shadow decal smoothly with height above ground
    rig.shadowDecal.material.opacity = Math.max(0, 0.74 * (1 - state.altAGL / 14));

    // Parked Roadster beacon pulses gently ONLY when player is walking on foot
    beaconMat.opacity = inVehicle ? 0 : (0.55 + Math.sin(t * 4.5) * 0.25);
    beaconCone.position.y = 3.25 + Math.sin(t * 3.5) * 0.25;
    beaconCone.rotation.y += dt * 1.8;
  }

  function update(dt, t, input, inVehicle, cameraPos = null) {
    const throttle = inVehicle ? input.throttle : 0; // -1..+1
    const steer = inVehicle ? input.steer : 0;       // -1 right .. +1 left
    const liftInput = inVehicle && input.lift;
    const descendInput = inVehicle && input.descend;
    const boostInput = inVehicle && input.boost;

    fwd.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    right.set(Math.cos(state.heading), 0, -Math.sin(state.heading));

    // Current local forward & lateral velocities
    let fwdSpeed = state.vel.x * fwd.x + state.vel.z * fwd.z;
    let latSpeed = state.vel.x * right.x + state.vel.z * right.z;

    // 1. Steering (responsive at low speed, crisp controlled arc at high speed & flight!)
    state.steerVisual = THREE.MathUtils.lerp(state.steerVisual, steer, Math.min(1, dt * 10));
    const steerRate = state.grounded
      ? (Math.min(1, Math.abs(fwdSpeed) / 5.5 + 0.12) * 2.05 * (fwdSpeed >= -0.5 ? 1 : -1))
      : 1.75;
    state.heading += steer * steerRate * dt;

    // Recompute basis after heading turn
    fwd.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    right.set(Math.cos(state.heading), 0, -Math.sin(state.heading));

    // 2. Electric Plaid Drive & Airborne Rocket Propulsion (with Active Cold-Gas Dorsal Retro-Descent!)
    const canLift = liftInput && state.copvFuel > 1.5;
    const canDescend = descendInput && !state.grounded && !canLift;
    const canBoost = boostInput && state.copvFuel > 1.5;

    state.liftPower = THREE.MathUtils.lerp(
      state.liftPower,
      canLift ? 1.0 : (state.flying && state.altAGL > 1.5 && !canDescend ? 0.34 : 0.0),
      Math.min(1, dt * (canDescend ? 18 : 12))
    );
    state.descentPower = THREE.MathUtils.lerp(state.descentPower, canDescend ? 1.0 : 0.0, Math.min(1, dt * 16));
    state.boostPower = THREE.MathUtils.lerp(state.boostPower, canBoost ? 1.0 : 0.0, Math.min(1, dt * 12));

    // Fuel consumption & fast recharge (minimal bleed drain during descent; emergency reserve always lets you land!)
    if (canLift) state.copvFuel = Math.max(0, state.copvFuel - 3.8 * dt);
    if (canDescend && state.copvFuel > 2.0) state.copvFuel = Math.max(2.0, state.copvFuel - 1.8 * dt);
    if (canBoost) state.copvFuel = Math.max(0, state.copvFuel - 7.0 * dt);
    if (state.grounded && !canLift && !canBoost) {
      const rate = state.onSkyPad ? 95.0 : 34.0;
      state.copvFuel = Math.min(100.0, state.copvFuel + rate * dt);
    }

    const maxCruise = state.grounded ? 54.0 : 62.0; // ~195-225 km/h electric/flight cruise
    const maxSpeed = canBoost ? 78.0 : maxCruise;   // ~280 km/h on aft cold-gas boost!

    state.braking = false;
    if (state.grounded) {
      if (throttle > 0.05) {
        fwdSpeed += throttle * 38.0 * dt;
      } else if (throttle < -0.05) {
        if (fwdSpeed > 1.5) {
          fwdSpeed = Math.max(0, fwdSpeed + throttle * 52.0 * dt);
          state.braking = true;
        } else {
          fwdSpeed += throttle * 22.0 * dt;
          state.braking = true;
        }
      } else {
        fwdSpeed *= Math.pow(0.28, dt);
      }
      if (canBoost) fwdSpeed += 42.0 * dt;
      fwdSpeed = THREE.MathUtils.clamp(fwdSpeed, -18, maxSpeed);
      latSpeed *= Math.pow(0.015, dt);
    } else {
      if (Math.abs(throttle) > 0.05) fwdSpeed += throttle * 32.0 * dt;
      if (canBoost) fwdSpeed += 46.0 * dt;
      fwdSpeed = THREE.MathUtils.clamp(fwdSpeed, -22, maxSpeed);
      fwdSpeed *= Math.pow(0.72, dt);
      latSpeed *= Math.pow(0.18, dt);
    }

    state.vel.x = fwd.x * fwdSpeed + right.x * latSpeed;
    state.vel.z = fwd.z * fwdSpeed + right.z * latSpeed;

    // 3. Vertical 0.38G Mars Gravity + Cold-Gas Hover / Active Retro-Descent + Soft-Landing Flare Physics!
    const MARS_G = 3.71;
    if (canLift) {
      state.vel.y += (18.0 - MARS_G) * dt;
      state.vel.y = Math.min(34.0, state.vel.y);
      state.grounded = false;
      state.flying = true;
    } else if (canDescend) {
      // Crisp dorsal cold-gas retro-thrust: immediately cancels upward velocity then drives controlled descent!
      const downAccel = state.vel.y > 0 ? 38.0 : 28.0;
      state.vel.y = Math.max(-34.0, state.vel.y - downAccel * dt);
      // Automatic near-ground soft-landing flare cushion below 6m AGL for buttery touchdowns!
      if (state.altAGL < 6.0) {
        const safeRate = -(4.5 + state.altAGL * 2.8);
        if (state.vel.y < safeRate) {
          state.vel.y = THREE.MathUtils.lerp(state.vel.y, safeRate, Math.min(1, dt * 10));
          state.liftPower = Math.max(state.liftPower, 0.36 * (1.0 - state.altAGL / 6.0));
        }
      }
    } else if (!state.grounded) {
      const glideLift = Math.min(2.6, Math.abs(fwdSpeed) * 0.045);
      state.vel.y -= (MARS_G - glideLift) * dt;
      state.vel.y = Math.max(-24, state.vel.y);
    }

    state.pos.addScaledVector(state.vel, dt);

    // 4. Open-World Boundary Clamp & Smart Soft Collisions
    state.pos.x = THREE.MathUtils.clamp(state.pos.x, -560, 880);
    state.pos.z = THREE.MathUtils.clamp(state.pos.z, -940, 260);
    state.pos.y = Math.min(state.pos.y, 285.0);

    if (state.pos.y < 27.5 && state.pos.x > -18.5 && state.pos.x < 24.5 && state.pos.z > 15.8 && state.pos.z < 30.2) {
      const dN = Math.abs(state.pos.z - 15.8), dS = Math.abs(state.pos.z - 30.2),
            dE = Math.abs(state.pos.x - 24.5), dW = Math.abs(state.pos.x + 18.5);
      const m = Math.min(dN, dS, dE, dW);
      if (m === dN) { state.pos.z = 15.8; state.vel.z = Math.min(0, state.vel.z); }
      else if (m === dS) { state.pos.z = 30.2; state.vel.z = Math.max(0, state.vel.z); }
      else if (m === dE) { state.pos.x = 24.5; state.vel.x = Math.max(0, state.vel.x); }
      else { state.pos.x = -18.5; state.vel.x = Math.min(0, state.vel.x); }
    }

    const colDist = Math.hypot(state.pos.x + 74, state.pos.z + 56);
    const colRad = state.pos.y < 54 ? 54.5 : (state.pos.y < 168 ? 44.0 : 28.0);
    if (state.pos.y < 230 && colDist < colRad) {
      const ang = Math.atan2(state.pos.z + 56, state.pos.x + 74);
      state.pos.x = -74 + Math.cos(ang) * colRad;
      state.pos.z = -56 + Math.sin(ang) * colRad;
      state.vel.multiplyScalar(0.5);
    }

    // 5. Ground, Sky-Pad & Stunt Ramp Contact Resolution
    const { groundY, padHit, rampBoost } = getSupportSurface(state.pos.x, state.pos.z, state.pos.y);
    state.onSkyPad = padHit;
    const minY = groundY + 0.05;

    if (state.pos.y <= minY) {
      state.pos.y = minY;
      if (rampBoost > 0 && Math.abs(fwdSpeed) > 14) {
        state.vel.y = Math.min(22.0, Math.abs(fwdSpeed) * 0.42 + 6.0);
        state.grounded = false;
        state.flying = true;
      } else {
        state.vel.y = Math.max(0, state.vel.y);
        state.grounded = true;
        state.flying = false;
        state.descentPower = 0;
      }
    } else if (state.pos.y > minY + 0.65) {
      state.grounded = false;
    }

    state.altAGL = Math.max(0, state.pos.y - groundY);
    state.speedKmh = Math.round(Math.hypot(state.vel.x, state.vel.z, state.vel.y * 0.35) * 3.6);

    // 6. Dynamic Chassis Pitch & Banking Attitude
    if (state.grounded && !padHit) {
      getTerrainNormal(state.pos.x, state.pos.z, terrainN);
      const slopeFwd = -(terrainN.x * fwd.x + terrainN.z * fwd.z);
      const slopeSide = terrainN.x * right.x + terrainN.z * right.z;
      const targetPitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(slopeFwd, -0.5, 0.5)) - (canBoost ? 0.05 : 0), -0.42, 0.42);
      const targetRoll = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(slopeSide, -0.45, 0.45)) + steer * Math.min(1, Math.abs(fwdSpeed) / 35) * 0.08, -0.42, 0.42);
      state.pitch = THREE.MathUtils.lerp(state.pitch, targetPitch, Math.min(1, dt * 8));
      state.roll = THREE.MathUtils.lerp(state.roll, targetRoll, Math.min(1, dt * 8));
    } else if (state.grounded && padHit) {
      state.pitch = THREE.MathUtils.lerp(state.pitch, 0, Math.min(1, dt * 8));
      state.roll = THREE.MathUtils.lerp(state.roll, 0, Math.min(1, dt * 8));
    } else {
      const targetPitch = THREE.MathUtils.clamp(
        (canBoost ? 0.14 : throttle * 0.11) - (canLift ? 0.10 : 0) + state.descentPower * 0.11 - state.vel.y * 0.010,
        -0.30, 0.32
      );
      const targetRoll = THREE.MathUtils.clamp(-steer * 0.28, -0.32, 0.32);
      state.pitch = THREE.MathUtils.lerp(state.pitch, targetPitch, Math.min(1, dt * 6));
      state.roll = THREE.MathUtils.lerp(state.roll, targetRoll, Math.min(1, dt * 7));
    }

    // 6B. SPACEX 6-NOZZLE LATERAL ATTITUDE-CONTROL COLD-GAS RCS THRUSTERS!
    const rcsTarget = { fl: 0, fr: 0, ml: 0, mr: 0, rl: 0, rr: 0 };
    const isAirborne = !state.grounded || state.liftPower > 0.20;
    const steerCmd = Math.abs(steer) > 0.04 ? steer : (Math.abs(state.steerVisual) > 0.08 ? state.steerVisual : 0);
    const yawGain = isAirborne ? 1.05 : (Math.abs(fwdSpeed) > 10 ? 0.62 : 0.0);

    if (steerCmd > 0.05 && yawGain > 0) {
      const m = Math.min(1.0, steerCmd * 1.15) * yawGain;
      rcsTarget.fl = Math.max(rcsTarget.fl, m);
      rcsTarget.rr = Math.max(rcsTarget.rr, m);
      rcsTarget.ml = Math.max(rcsTarget.ml, m * 0.72);
    } else if (steerCmd < -0.05 && yawGain > 0) {
      const m = Math.min(1.0, -steerCmd * 1.15) * yawGain;
      rcsTarget.fr = Math.max(rcsTarget.fr, m);
      rcsTarget.rl = Math.max(rcsTarget.rl, m);
      rcsTarget.mr = Math.max(rcsTarget.mr, m * 0.72);
    }

    // Airborne retro-flare stabilization when braking mid-air
    if (!state.grounded && throttle < -0.15) {
      rcsTarget.fl = Math.max(rcsTarget.fl, 0.85);
      rcsTarget.fr = Math.max(rcsTarget.fr, 0.85);
    }

    // Crisp staccato SpaceX hover PID micro-stabilizer bursts whenever airborne or hovering!
    if (isAirborne && inVehicle && state.copvFuel > 1.5) {
      const pidPulse = (freq, ph, pow) => Math.pow(Math.max(0, Math.sin(t * freq + ph)), pow) * 0.86;
      rcsTarget.fl = Math.max(rcsTarget.fl, pidPulse(6.8, 0.0, 7.0));
      rcsTarget.rr = Math.max(rcsTarget.rr, pidPulse(6.8, 0.15, 7.0));
      rcsTarget.fr = Math.max(rcsTarget.fr, pidPulse(6.8, 3.14, 7.0));
      rcsTarget.rl = Math.max(rcsTarget.rl, pidPulse(6.8, 3.29, 7.0));
      rcsTarget.ml = Math.max(rcsTarget.ml, pidPulse(5.1, 1.35, 8.0) * 0.85);
      rcsTarget.mr = Math.max(rcsTarget.mr, pidPulse(5.1, 4.49, 8.0) * 0.85);
    }

    // Fast solenoid valve attack (28/s) & crisp pneumatic shutoff (15/s)
    let maxRcs = 0;
    for (const k of ['fl', 'fr', 'ml', 'mr', 'rl', 'rr']) {
      const rate = rcsTarget[k] > state.rcs[k] ? 28.0 : 15.0;
      state.rcs[k] = THREE.MathUtils.lerp(state.rcs[k], rcsTarget[k], Math.min(1, dt * rate));
      if (state.rcs[k] > maxRcs) maxRcs = state.rcs[k];
    }
    state.rcsPower = maxRcs;

    // 7. REALISTIC SUPERSONIC CRYO-VAPOR WAKE, GROUND VORTEX SHOCK RING & MARTIAN DUST!
    // 7a. Ground-Impingement Vortex Shock Ring hugging ground directly under low-hovering Roadster!
    const shockProx = Math.max(0, 1.0 - state.altAGL / 14.0) * Math.max(state.liftPower, state.boostPower * 0.45);
    shockRingMat.uniforms.uTime.value = t;
    shockRingMat.uniforms.uIntensity.value = shockProx;
    if (shockProx > 0.04) {
      groundShockRing.visible = true;
      groundShockRing.position.set(state.pos.x, groundY + 0.14, state.pos.z);
      const rSc = 0.72 + (1.0 - shockProx * 0.25) * (0.45 + state.altAGL * 0.08);
      groundShockRing.scale.setScalar(rSc);
    } else {
      groundShockRing.visible = false;
    }

    // 7b. High-Velocity Expanding Cryogenic Vapor Wake from Rear SpaceX Rocket Bell!
    if (state.boostPower > 0.15) {
      for (let k = 0; k < 2; k++) {
        const jitterX = (Math.random() - 0.5) * 0.42;
        const jitterY = (Math.random() - 0.5) * 0.28;
        const axialOff = 2.4 + Math.random() * 2.8;
        spawnVapor(
          state.pos.x - fwd.x * axialOff + right.x * jitterX,
          state.pos.y + 0.56 + jitterY,
          state.pos.z - fwd.z * axialOff + right.z * jitterX,
          state.vel.x * 0.42 - fwd.x * (12 + Math.random() * 8) + (Math.random() - 0.5) * 2.0,
          state.vel.y * 0.25 + (Math.random() - 0.5) * 1.5,
          state.vel.z * 0.42 - fwd.z * (12 + Math.random() * 8) + (Math.random() - 0.5) * 2.0,
          1.35 + Math.random() * 0.75,
          0.56 + Math.random() * 0.28,
          0.54 * state.boostPower
        );
      }
    }

    // 7c. Downward Cryo-Condensation Mist from 4 Underside Hover Nozzles during Flight!
    if (state.liftPower > 0.22 && Math.random() < 0.85) {
      const sideS = Math.random() < 0.5 ? -0.74 : 0.74;
      const foreS = Math.random() < 0.5 ? 1.0 : -1.1;
      spawnVapor(
        state.pos.x + right.x * sideS + fwd.x * foreS,
        state.pos.y - 0.8 - Math.random() * 1.1,
        state.pos.z + right.z * sideS + fwd.z * foreS,
        state.vel.x * 0.45 + (Math.random() - 0.5) * 2.8,
        -9.5 - Math.random() * 5.0,
        state.vel.z * 0.45 + (Math.random() - 0.5) * 2.8,
        1.25 + Math.random() * 0.65,
        0.52 + Math.random() * 0.24,
        0.44 * state.liftPower
      );
    }

    // 7c2. Sideways-Ejected Cold-Gas Cryo Mist Puffs from Active Lateral Attitude-Control RCS Nozzles!
    if (state.rcsPower > 0.28) {
      const rcsNoz = [
        { k: 'fl', x: -1.15, y: 0.44, z:  1.92, s: -1 },
        { k: 'fr', x:  1.15, y: 0.44, z:  1.92, s:  1 },
        { k: 'ml', x: -1.2, y: 0.38, z:  0.34, s: -1 },
        { k: 'mr', x:  1.20, y: 0.38, z:  0.34, s:  1 },
        { k: 'rl', x: -1.24, y: 0.50, z: -1.9, s: -1 },
        { k: 'rr', x:  1.24, y: 0.50, z: -1.9, s:  1 }
      ];
      for (const n of rcsNoz) {
        const p = state.rcs[n.k];
        if (p > 0.30 && Math.random() < 0.72) {
          const latOff = 0.55 + Math.random() * 1.15;
          const latVel = (9.5 + Math.random() * 6.5) * n.s;
          spawnVapor(
            state.pos.x + right.x * (n.x + n.s * latOff) + fwd.x * n.z,
            state.pos.y + n.y + (Math.random() - 0.5) * 0.16,
            state.pos.z + right.z * (n.x + n.s * latOff) + fwd.z * n.z,
            state.vel.x * 0.38 + right.x * latVel + (Math.random() - 0.5) * 1.4,
            state.vel.y * 0.25 + (Math.random() - 0.5) * 1.2,
            state.vel.z * 0.38 + right.z * latVel + (Math.random() - 0.5) * 1.4,
            0.95 + Math.random() * 0.55,
            0.40 + Math.random() * 0.22,
            0.52 * p
          );
        }
      }
    }

    // 7c3. Upward-Billowing Cold-Gas Cryo Mist Puffs from 4 Dorsal Retro-Descent Nozzles!
    if (state.descentPower > 0.20) {
      const dorsalPts = [
        [-0.64, 0.92,  1.38],
        [ 0.64, 0.92,  1.38],
        [-0.68, 0.96, -1.32],
        [ 0.68, 0.96, -1.32]
      ];
      for (let d = 0; d < 2; d++) {
        const np = dorsalPts[Math.floor(Math.random() * dorsalPts.length)];
        spawnVapor(
          state.pos.x + right.x * np[0] + fwd.x * np[2],
          state.pos.y + np[1] + 0.55 + Math.random() * 0.75,
          state.pos.z + right.z * np[0] + fwd.z * np[2],
          state.vel.x * 0.42 + (Math.random() - 0.5) * 2.4,
          Math.max(4.5, state.vel.y * 0.25 + 10.5 + Math.random() * 5.0),
          state.vel.z * 0.42 + (Math.random() - 0.5) * 2.4,
          1.05 + Math.random() * 0.55,
          0.44 + Math.random() * 0.22,
          0.54 * state.descentPower
        );
      }
    }

    // 7d. Martian Tire Roostertail & Radial Hover Downwash Regolith Dust!
    if (state.grounded && !padHit && Math.abs(fwdSpeed) > 6.5 && Math.random() < 0.75) {
      const side = Math.random() < 0.5 ? -0.95 : 0.95;
      spawnDust(
        state.pos.x - fwd.x * 1.9 + right.x * side,
        state.pos.y + 0.35,
        state.pos.z - fwd.z * 1.9 + right.z * side,
        -fwd.x * 2.5 + (Math.random() - 0.5) * 2.4,
        0.9 + Math.random() * 1.6,
        -fwd.z * 2.5 + (Math.random() - 0.5) * 2.4,
        1.8 + Math.min(2.4, Math.abs(fwdSpeed) * 0.05),
        0.85
      );
    } else if (shockProx > 0.15 && Math.random() < 0.85) {
      const a = Math.random() * Math.PI * 2;
      const blastV = 8.5 + shockProx * 10.5;
      spawnDust(
        state.pos.x + Math.cos(a) * 2.1,
        groundY + 0.55,
        state.pos.z + Math.sin(a) * 2.1,
        Math.cos(a) * blastV,
        1.2 + Math.random() * 2.4,
        Math.sin(a) * blastV,
        3.0 + shockProx * 1.8,
        1.05
      );
    }

    // Light up Roadster's cryogenic wake & Martian dust billows from within by the cold-gas booster nozzle!
    const thrusterGlow = Math.max(state.boostPower * 0.62, state.liftPower * 0.35, state.descentPower * 0.38, state.rcsPower * 0.30);
    vfxClouds.setEngineLight(
      0,
      state.pos.x - fwd.x * 2.5,
      state.pos.y + 0.52,
      state.pos.z - fwd.z * 2.5,
      thrusterGlow,
      6.2,
      0.58, 0.88, 1.00
    );
    vfxClouds.step(dt, t, cameraPos);

    syncVisuals(dt, t, inVehicle);
  }

  /**
   * Showcase Hover Pose for the Opening Title Screen:
   * Hovers the Flying Roadster heroically in front of the 212m Elon Musk Colossus
   * with live 4-nozzle white cold-gas lift plumes, subtle attitude-control RCS puffs & cryo mist!
   */
  function setIntroHoverPose(x, y, z, heading, dt, t, cameraPos = null) {
    const bob = Math.sin(t * 1.45) * 0.34;
    const sway = Math.cos(t * 0.85) * 0.24;
    state.pos.set(x + sway, y + bob, z);
    state.vel.set(0, 0, 0);
    state.heading = heading + Math.sin(t * 0.55) * 0.045;
    state.pitch = -0.055 + Math.cos(t * 1.3) * 0.022;
    state.roll = Math.sin(t * 1.05) * 0.055;
    state.steerVisual = 0;
    state.grounded = false;
    state.flying = true;
    state.altAGL = Math.max(0, state.pos.y - getTerrainHeight(x, z));
    state.speedKmh = 0;
    state.liftPower = 0.76 + Math.sin(t * 3.8) * 0.06;
    state.descentPower = 0;
    state.boostPower = 0;

    // Periodic crisp lateral RCS stabilization bursts (just like real SpaceX cold-gas hover demos!)
    const rcsPulseL = Math.max(0, Math.sin(t * 1.9) - 0.58) * 1.85;
    const rcsPulseR = Math.max(0, Math.sin(t * 1.9 + Math.PI) - 0.58) * 1.85;
    state.rcs.fl = rcsPulseL * 0.85;
    state.rcs.rl = rcsPulseL * 0.65;
    state.rcs.fr = rcsPulseR * 0.85;
    state.rcs.rr = rcsPulseR * 0.65;
    state.rcs.ml = rcsPulseL * 0.45;
    state.rcs.mr = rcsPulseR * 0.45;
    state.rcsPower = Math.max(rcsPulseL, rcsPulseR);

    rig.car.position.copy(state.pos);
    rig.car.rotation.set(state.pitch, state.heading, state.roll, 'YXZ');
    rig.shadowDecal.visible = false;
    groundShockRing.visible = false;
    beaconMat.opacity = 0;
    rig.setThrusterFx(t, state.liftPower, 0, state.rcs, 0);

    // Subtle cold-gas cryo mist drifting beneath the hovering nozzles
    fwd.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    right.set(Math.cos(state.heading), 0, -Math.sin(state.heading));
    if (Math.random() < 0.42) {
      const lx = (Math.random() < 0.5 ? -0.78 : 0.78);
      const lz = (Math.random() < 0.5 ? 1.25 : -1.25);
      spawnVapor(
        state.pos.x + right.x * lx + fwd.x * lz,
        state.pos.y - 1.5 - Math.random() * 0.9,
        state.pos.z + right.z * lx + fwd.z * lz,
        (Math.random() - 0.5) * 1.4,
        -4.2 - Math.random() * 2.2,
        (Math.random() - 0.5) * 1.4,
        0.95 + Math.random() * 0.45,
        0.55 + Math.random() * 0.25,
        0.34
      );
    }
    vfxClouds.setEngineLight(0, state.pos.x, state.pos.y - 0.8, state.pos.z, 0.42, 6.0, 0.58, 0.88, 1.0);
    vfxClouds.step(dt, t, cameraPos);
  }

  // Initialize parked visuals cleanly right on frame 0
  syncVisuals(0.016, 0, true);

  return {
    group: root,
    car: rig.car,
    state,
    teleportCar,
    setIntroHoverPose,
    setSunLighting: (preset) => vfxClouds.setSunLighting(preset),
    update
  };
}
