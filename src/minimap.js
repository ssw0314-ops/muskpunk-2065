import { HIGHWAY_PATHS, SKY_PADS, WORLD_DISTRICTS } from './assets/world_expansion.js';

const BIO_DOMES = [
  { x: -18, z: -155, r: 42 },
  { x: 64,  z: -195, r: 34 },
  { x: -95, z: -230, r: 38 },
  { x: 18,  z: -285, r: 46 }
];
const REGO_DOMES = [
  { x: 42, z: -138, r: 30 }, { x: -72, z: -145, r: 24 }, { x: -16, z: -222, r: 28 },
  { x: 112, z: -162, r: 26 }, { x: -148, z: -185, r: 32 }, { x: 96, z: -265, r: 30 }
];
const STARSHIP_PADS = [
  [90, -545], [245, -535], [405, -552], [565, -540], [725, -558],
  [155, -695], [315, -685], [480, -708], [645, -692], [800, -712],
  [220, -835], [395, -845], [565, -830], [735, -848]
];

/**
 * GTA-Style Rotating Tactical Mars Radar Minimap (Canvas 2D, <0.2ms/frame)
 */
export function createGtaMinimap(canvas) {
  if (!canvas) return { render() {} };
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const CX = W * 0.5;
  const CY = H * 0.5;
  const R = W * 0.47;
  const WORLD_RANGE = 390; // meters from radar center to rim
  const SCALE = R / WORLD_RANGE;

  function render(playerPos, camYaw, carPos, inVehicle) {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    // Circular radar mask
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();

    // Martian radar background
    const bg = ctx.createRadialGradient(CX, CY, 8, CX, CY, R);
    bg.addColorStop(0, 'rgba(34, 20, 15, 0.86)');
    bg.addColorStop(1, 'rgba(18, 11, 9, 0.92)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle distance range rings
    ctx.strokeStyle = 'rgba(232, 174, 108, 0.14)';
    ctx.lineWidth = 1;
    for (const frac of [0.35, 0.70]) {
      ctx.beginPath();
      ctx.arc(CX, CY, R * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Transform world space into player-heading-up radar space!
    // Camera forward is (-sin(camYaw), -cos(camYaw)); rotating by +camYaw aligns forward to UP (-Y on canvas!)
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(camYaw);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-playerPos.x, -playerPos.z);

    // 1. Red Canyon Gorge subtle crimson ribbon
    ctx.strokeStyle = 'rgba(168, 66, 36, 0.45)';
    ctx.lineWidth = 54;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let z = -260; z <= 150; z += 20) {
      const x = -315 + Math.sin(z * 0.011) * 48;
      if (z === -260) ctx.moveTo(x, z);
      else ctx.lineTo(x, z);
    }
    ctx.stroke();

    // 2. Ice-Mining Quarry Crater
    ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(365, -210, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Arcadia Highway Loop Roads
    ctx.strokeStyle = 'rgba(222, 188, 146, 0.48)';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    for (const path of HIGHWAY_PATHS) {
      ctx.beginPath();
      path.forEach(([x, z], idx) => (idx === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z)));
      ctx.stroke();
    }

    // 4. Regolith Domes & Geodesic Bio-Domes
    ctx.fillStyle = 'rgba(164, 92, 58, 0.65)';
    for (const d of REGO_DOMES) {
      ctx.beginPath();
      ctx.arc(d.x, d.z, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(74, 184, 96, 0.58)';
    ctx.strokeStyle = 'rgba(195, 245, 200, 0.72)';
    ctx.lineWidth = 3;
    for (const d of BIO_DOMES) {
      ctx.beginPath();
      ctx.arc(d.x, d.z, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 5. Skybridge Café bar
    ctx.fillStyle = 'rgba(56, 189, 248, 0.68)';
    ctx.fillRect(-16, 18, 38, 10);

    // 6. Starship Saloon Outpost
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-268, -396, 26, 20);

    // 7. 212m Elon Musk Colossus Monument Citadel (Golden Diamond + Citadel Ring!)
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-74, -56, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(-74, -56 - 38);
    ctx.lineTo(-74 + 34, -56);
    ctx.lineTo(-74, -56 + 38);
    ctx.lineTo(-74 - 34, -56);
    ctx.closePath();
    ctx.fill();

    // 8. Megaport Starships (Silver dots)
    ctx.fillStyle = '#e2e8f0';
    for (const [sx, sz] of STARSHIP_PADS) {
      ctx.beginPath();
      ctx.arc(sx, sz, 9.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Sky-Pads (Cyan H-pads)
    ctx.fillStyle = '#38e8d8';
    for (const p of SKY_PADS) {
      ctx.beginPath();
      ctx.arc(p.x, p.z, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10. Parked Roadster indicator if player is on foot!
    if (!inVehicle && carPos) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#38e8d8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(carPos.x, carPos.z, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();

    // Outer tactical brass/amber bezel
    ctx.strokeStyle = 'rgba(232, 169, 88, 0.58)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting North ("N") compass marker on radar rim
    const nAng = -Math.PI * 0.5 + camYaw;
    const nx = CX + Math.cos(nAng) * (R - 9);
    const ny = CY + Math.sin(nAng) * (R - 9);
    ctx.fillStyle = '#140c09';
    ctx.beginPath();
    ctx.arc(nx, ny, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 0.5);

    // Dead-center directional Player Chevron (always pointing straight up = camera forward!)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#160e0a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(CX, CY - 7.5);
    ctx.lineTo(CX + 5.8, CY + 5.5);
    ctx.lineTo(CX, CY + 2.5);
    ctx.lineTo(CX - 5.8, CY + 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return { render };
}

/**
 * Returns the nearest named Arcadia open-world district for the live GTA zone toast banner.
 */
export function getCurrentDistrict(x, z) {
  for (const d of WORLD_DISTRICTS) {
    if (Math.hypot(x - d.x, z - d.z) <= d.r) return d;
  }
  return { id: 'wilds', name: 'ARCADIA PLANITIA FRONTIER', kr: '아르카디아 평원 개척지' };
}
