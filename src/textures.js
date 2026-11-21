import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Tileable 2D value noise for seamless 1024px PBR height & albedo maps
function tileNoise(x, y, period) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0);
  const b = hash2(x1, y0);
  const c = hash2(x0, y1);
  const d = hash2(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function tileFbm(u, v, baseFreq = 8, octaves = 4) {
  let sum = 0, amp = 0.5, freq = baseFreq, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(u * freq, v * freq, freq) * amp;
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * Converts a greyscale height canvas into a true tangent-space RGB Normal Map using Sobel gradients.
 */
function heightCanvasToNormalTexture(heightCanvas, strength = 2.4, repeatX = 1, repeatY = 1, maxAniso = 8) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const outCanvas = makeCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255.0;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t  = sample(x,     y - 1);
      const tr = sample(x + 1, y - 1);
      const l  = sample(x - 1, y);
      const r  = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b  = sample(x,     y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen; ny *= invLen; nz *= invLen;

      const idx = (y * w + x) * 4;
      dst[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  return tex;
}

function finalizeTex(canvas, isColor, repeatX = 1, repeatY = 1, maxAniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  if (isColor) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = maxAniso;
  return t;
}

export function createTextures(renderer) {
  const maxAniso = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 8;
  const tex = {};

  // =========================================================================
  // 1. MARTIAN REGOLITH & EOLIAN RIPPLES (Color + Tangent Normal + Roughness)
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S);
    const hC = makeCanvas(S, S);
    const rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d');
    const hCtx = hC.getContext('2d');
    const rCtx = rC.getContext('2d');

    const cImg = cCtx.createImageData(S, S);
    const hImg = hCtx.createImageData(S, S);
    const rImg = rCtx.createImageData(S, S);

    for (let y = 0; y < S; y++) {
      const v = y / S;
      for (let x = 0; x < S; x++) {
        const u = x / S;
        const macro = tileFbm(u, v, 6, 4);
        const micro = tileFbm(u, v, 24, 3);
        // Wind-carved Martian sand ripples warped by macro noise
        const warp = macro * 0.14;
        const ripple = Math.sin((v * 22.0 + warp * 18.0 + u * 2.0) * Math.PI * 2) * 0.5 + 0.5;
        const height = Math.min(1, Math.max(0, macro * 0.45 + ripple * 0.28 + micro * 0.27));

        // Iron-oxide ochre dust in troughs vs darker exposed iron-basalt grains on crests
        const rVal = Math.round(126 + height * 78 + (micro - 0.5) * 32);
        const gVal = Math.round(64 + height * 48 + (micro - 0.5) * 18);
        const bVal = Math.round(38 + height * 28 + (micro - 0.5) * 12);
        const rough = Math.round((0.84 + (1.0 - micro) * 0.14) * 255);

        const idx = (y * S + x) * 4;
        cImg.data[idx] = Math.min(255, Math.max(0, rVal));
        cImg.data[idx + 1] = Math.min(255, Math.max(0, gVal));
        cImg.data[idx + 2] = Math.min(255, Math.max(0, bVal));
        cImg.data[idx + 3] = 255;

        const hv = Math.round(height * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;

        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
        rImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    hCtx.putImageData(hImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    // Fine micro-gravel & crisp wind-blown basalt grit (avoid oversized smooth dimples at eye level!)
    for (let i = 0; i < 4500; i++) {
      const px = hash2(i, 1.3) * S;
      const py = hash2(i, 7.9) * S;
      const pr = 0.55 + hash2(i, 3.1) * 1.15;
      const isDark = hash2(i, 5.7) > 0.38;
      cCtx.fillStyle = isDark ? 'rgba(62,32,22,0.55)' : 'rgba(212,130,82,0.42)';
      cCtx.fillRect(px, py, pr * 1.4, pr);

      hCtx.fillStyle = isDark ? 'rgba(205,205,205,0.42)' : 'rgba(95,95,95,0.32)';
      hCtx.fillRect(px, py, pr * 1.4, pr);
    }

    tex.marsColor = finalizeTex(colC, true, 92, 92, maxAniso);
    tex.marsNormal = heightCanvasToNormalTexture(hC, 1.65, 92, 92, maxAniso);
    tex.marsRough = finalizeTex(rC, false, 92, 92, maxAniso);
  }

  // =========================================================================
  // 2. FRACTURED VESICULAR BASALT ROCK (Boulders & Cliffs — Color + Normal + Rough)
  // =========================================================================
  {
    const S = 256;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');
    const cImg = cCtx.createImageData(S, S), hImg = hCtx.createImageData(S, S), rImg = rCtx.createImageData(S, S);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        const n1 = tileFbm(u, v, 8, 4);
        const strata = Math.sin((v * 10 + n1 * 2.5) * Math.PI * 2) * 0.5 + 0.5;
        const crack = Math.abs(tileFbm(u + 0.3, v + 0.7, 16, 3) - 0.5) * 2.0;
        const h = Math.min(1, Math.max(0, n1 * 0.55 + strata * 0.25 + crack * 0.2));
        // Dark volcanic basalt with ochre dust settled in fractures!
        const dustMask = Math.max(0, 1.0 - crack * 3.2);
        const idx = (y * S + x) * 4;
        cImg.data[idx]     = Math.round(76 + h * 46 + dustMask * 72);
        cImg.data[idx + 1] = Math.round(46 + h * 26 + dustMask * 38);
        cImg.data[idx + 2] = Math.round(36 + h * 18 + dustMask * 16);
        cImg.data[idx + 3] = 255;

        const hv = Math.round(h * 255);
        hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
        hImg.data[idx + 3] = 255;

        const rv = Math.round((0.74 + dustMask * 0.22) * 255);
        rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0); hCtx.putImageData(hImg, 0, 0); rCtx.putImageData(rImg, 0, 0);
    tex.rockColor = finalizeTex(colC, true, 2, 2, maxAniso);
    tex.rockNormal = heightCanvasToNormalTexture(hC, 4.0, 2, 2, maxAniso);
    tex.rockRough = finalizeTex(rC, false, 2, 2, maxAniso);
  }

  // =========================================================================
  // 3. SPACEX 30X WELDED COLD-ROLLED STAINLESS STEEL (Color + Normal + Roughness)
  //    Authentic circumferential ring welds, TIG heat-tint halos, brushed streaks & oil-canning!
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#c4c9cf'; cCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#808080'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#585858'; rCtx.fillRect(0, 0, S, S);

    // Subtle panel-to-panel dappled reflectance ("oil-canning" steel shimmer)
    const ringH = 64;
    for (let row = 0; row < S / ringH; row++) {
      const y0 = row * ringH;
      for (let col = 0; col < 4; col++) {
        const x0 = col * 128;
        const shift = (hash2(col, row) - 0.5) * 26;
        const base = Math.round(196 + shift);
        cCtx.fillStyle = `rgb(${base + 2},${base + 1},${base})`;
        cCtx.fillRect(x0, y0, 128, ringH);

        const rBase = Math.round(76 + (hash2(col + 5, row + 3) - 0.5) * 32);
        rCtx.fillStyle = `rgb(${rBase},${rBase},${rBase})`;
        rCtx.fillRect(x0, y0, 128, ringH);

        // Subtle oil-canning pillow normal highlight in center of each welded steel sheet
        const g = hCtx.createRadialGradient(x0 + 64, y0 + 32, 4, x0 + 64, y0 + 32, 62);
        g.addColorStop(0, 'rgba(156,156,156,0.45)');
        g.addColorStop(1, 'rgba(110,110,110,0.45)');
        hCtx.fillStyle = g;
        hCtx.fillRect(x0, y0, 128, ringH);
      }
    }

    // Fine brushed cold-rolled horizontal streaks
    for (let y = 0; y < S; y++) {
      const n = hash2(y, 17.3);
      const v = Math.round(175 + n * 58);
      cCtx.fillStyle = `rgba(${v},${v + 2},${v + 4},0.22)`;
      cCtx.fillRect(0, y, S, 1);
      const rv = Math.round(58 + n * 48);
      rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.28)`;
      rCtx.fillRect(0, y, S, 1);
    }

    // Authentic Horizontal Starship Ring Weld Seams + Straw-Gold / Slate Heat-Affected Zone (HAZ)
    for (let y = 0; y < S; y += ringH) {
      // Heat tint band above & below weld
      const haz = cCtx.createLinearGradient(0, y - 6, 0, y + 8);
      haz.addColorStop(0, 'rgba(165,112,68,0)');
      haz.addColorStop(0.35, 'rgba(168,118,72,0.28)');
      haz.addColorStop(0.5, 'rgba(65,68,84,0.58)');
      haz.addColorStop(0.68, 'rgba(148,104,70,0.24)');
      haz.addColorStop(1, 'rgba(148,104,70,0)');
      cCtx.fillStyle = haz;
      cCtx.fillRect(0, y - 6, S, 14);

      // Raised weld bead in height map -> crisp tangent-space normal highlight!
      hCtx.fillStyle = '#dcdcdc';
      hCtx.fillRect(0, y, S, 2.5);
      hCtx.fillStyle = '#525252';
      hCtx.fillRect(0, y + 2.5, S, 1.5);

      // Rougher weld bead
      rCtx.fillStyle = '#c8c8c8';
      rCtx.fillRect(0, y - 1, S, 4);
    }

    // Vertical sheet weld joints + rivets
    for (let x = 0; x < S; x += 128) {
      cCtx.fillStyle = 'rgba(54,50,48,0.42)';
      cCtx.fillRect(x, 0, 2, S);
      hCtx.fillStyle = '#c8c8c8';
      hCtx.fillRect(x, 0, 2, S);
      rCtx.fillStyle = '#b4b4b4';
      rCtx.fillRect(x, 0, 3, S);
    }

    // Subtle vertical reentry soot & Martian windblown ochre streaks
    for (let i = 0; i < 65; i++) {
      const sx = hash2(i, 4.9) * S;
      const sw = 2 + hash2(i, 2.1) * 8;
      cCtx.fillStyle = hash2(i, 9.1) > 0.5 ? 'rgba(92,54,36,0.08)' : 'rgba(32,34,38,0.07)';
      cCtx.fillRect(sx, 0, sw, S);
    }

    tex.steelColor = finalizeTex(colC, true, 2, 4, maxAniso);
    tex.steelNormal = heightCanvasToNormalTexture(hC, 2.8, 2, 4, maxAniso);
    tex.steelRough = finalizeTex(rC, false, 2, 4, maxAniso);
  }

  // =========================================================================
  // 4. HEXAGONAL BLACK STARSHIP TPS CERAMIC TILES (Color + Normal + Roughness)
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#090b0d'; cCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#181818'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#e8e8e8'; rCtx.fillRect(0, 0, S, S);

    const rad = 14;
    const dx = rad * Math.sqrt(3);
    const dy = rad * 1.5;
    for (let row = -1; row < S / dy + 2; row++) {
      for (let col = -1; col < S / dx + 2; col++) {
        const cx = col * dx + (row % 2 === 0 ? 0 : dx / 2);
        const cy = row * dy;
        const rnd = hash2(col, row);
        // Subtle replacement tile & thermal bake color variation
        const v = Math.round(20 + rnd * 24);
        const rustEdge = rnd > 0.86 ? 8 : 0;
        cCtx.fillStyle = `rgb(${v + rustEdge},${v + 1},${v + 4})`;
        cCtx.strokeStyle = '#050608';
        cCtx.lineWidth = 1.9;

        const hv = Math.round(175 + rnd * 55);
        hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
        hCtx.strokeStyle = '#121212';
        hCtx.lineWidth = 2.4;

        const rv = Math.round(150 + rnd * 65);
        rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rCtx.strokeStyle = '#f0f0f0';
        rCtx.lineWidth = 2.0;

        for (const g of [cCtx, hCtx, rCtx]) {
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            const px = cx + Math.cos(a) * (rad - 0.9);
            const py = cy + Math.sin(a) * (rad - 0.9);
            if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.closePath();
          g.fill();
          g.stroke();
        }
      }
    }

    tex.tpsColor = finalizeTex(colC, true, 3, 6, maxAniso);
    tex.tpsNormal = heightCanvasToNormalTexture(hC, 3.6, 3, 6, maxAniso);
    tex.tpsRough = finalizeTex(rC, false, 3, 6, maxAniso);
  }

  // =========================================================================
  // 5. SINTERED MARTIAN BASALT CONCRETE MASONRY (Plinth, Pads, Foundations)
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#5a4d45'; cCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#909090'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#d4d4d4'; rCtx.fillRect(0, 0, S, S);

    // Brutalist cast concrete blocks with form-tie holes & dust-filled expansion joints
    for (let y = 0; y < S; y += 64) {
      for (let x = 0; x < S; x += 128) {
        const n = (hash2(x, y) - 0.5) * 18;
        cCtx.fillStyle = `rgb(${Math.round(92 + n)},${Math.round(78 + n * 0.8)},${Math.round(69 + n * 0.7)})`;
        cCtx.fillRect(x + 2, y + 2, 124, 60);

        // Form-tie dimples (iconic brutalist concrete detail!)
        for (const [tx, ty] of [[x + 24, y + 18], [x + 104, y + 18], [x + 24, y + 46], [x + 104, y + 46]]) {
          cCtx.fillStyle = 'rgba(30,24,20,0.55)';
          cCtx.beginPath(); cCtx.arc(tx, ty, 3, 0, Math.PI * 2); cCtx.fill();
          hCtx.fillStyle = '#303030';
          hCtx.beginPath(); hCtx.arc(tx, ty, 3.5, 0, Math.PI * 2); hCtx.fill();
        }
      }
      // Deep concrete slab seams
      cCtx.fillStyle = 'rgba(28,20,16,0.72)'; cCtx.fillRect(0, y, S, 3);
      hCtx.fillStyle = '#252525'; hCtx.fillRect(0, y, S, 3.5);
    }
    for (let x = 0; x < S; x += 128) {
      cCtx.fillStyle = 'rgba(28,20,16,0.65)'; cCtx.fillRect(x, 0, 2.5, S);
      hCtx.fillStyle = '#2a2a2a'; hCtx.fillRect(x, 0, 3, S);
    }

    // Fine mineral grit & blown rust dust accumulation
    for (let i = 0; i < 6000; i++) {
      const gx = hash2(i, 4.1) * S, gy = hash2(i, 9.2) * S;
      const a = 0.08 + hash2(i, 1.8) * 0.22;
      cCtx.fillStyle = hash2(i, 6.2) > 0.45 ? `rgba(182,108,68,${a})` : `rgba(26,22,20,${a})`;
      cCtx.fillRect(gx, gy, 2 + hash2(i, 3.7) * 4, 2 + hash2(i, 8.1) * 3);
      const hv = hash2(i, 5.5) > 0.5 ? 170 : 105;
      hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.25)`;
      hCtx.fillRect(gx, gy, 3, 3);
    }

    tex.basaltColor = finalizeTex(colC, true, 4, 4, maxAniso);
    tex.basaltNormal = heightCanvasToNormalTexture(hC, 3.0, 4, 4, maxAniso);
    tex.basaltRough = finalizeTex(rC, false, 4, 4, maxAniso);
  }

  // =========================================================================
  // 6. STRUCTURAL RIVETED CHARCOAL STEEL (Skybridge Ribs, Airlock, Bulkheads)
  // =========================================================================
  {
    const S = 256;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#31363e'; cCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#808080'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#787878'; rCtx.fillRect(0, 0, S, S);

    // Subtle industrial brushed grain + weathered edge wear
    for (let i = 0; i < 1200; i++) {
      const x = hash2(i, 1.2) * S, y = hash2(i, 3.4) * S;
      cCtx.fillStyle = hash2(i, 5.6) > 0.5 ? 'rgba(92,98,108,0.18)' : 'rgba(22,25,30,0.22)';
      cCtx.fillRect(x, y, 8 + hash2(i, 7.8) * 20, 1.5);
    }
    // Panel seam & bolt rivets
    cCtx.strokeStyle = '#1b1e23'; cCtx.lineWidth = 3; cCtx.strokeRect(2, 2, S - 4, S - 4);
    hCtx.strokeStyle = '#303030'; hCtx.lineWidth = 3; hCtx.strokeRect(2, 2, S - 4, S - 4);
    // Subtle worn metallic edge highlight
    cCtx.strokeStyle = 'rgba(165,175,185,0.22)'; cCtx.lineWidth = 1.5; cCtx.strokeRect(5, 5, S - 10, S - 10);
    rCtx.strokeStyle = '#383838'; rCtx.lineWidth = 3; rCtx.strokeRect(5, 5, S - 10, S - 10);

    for (let p = 18; p < S; p += 32) {
      for (const [bx, by] of [[12, p], [S - 12, p], [p, 12], [p, S - 12]]) {
        cCtx.fillStyle = '#4e5560'; cCtx.beginPath(); cCtx.arc(bx, by, 3, 0, Math.PI * 2); cCtx.fill();
        hCtx.fillStyle = '#e8e8e8'; hCtx.beginPath(); hCtx.arc(bx, by, 3.2, 0, Math.PI * 2); hCtx.fill();
      }
    }

    tex.ribSteelColor = finalizeTex(colC, true, 2, 2, maxAniso);
    tex.ribSteelNormal = heightCanvasToNormalTexture(hC, 3.2, 2, 2, maxAniso);
    tex.ribSteelRough = finalizeTex(rC, false, 2, 2, maxAniso);
  }

  // =========================================================================
  // 7. WARM FRONTIER TIMBER PLANKS (Skybridge Café Counter & Boardwalk)
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    const plankH = 64;
    for (let row = 0; row < S / plankH; row++) {
      const y0 = row * plankH;
      const tone = (hash2(row, 2.3) - 0.5) * 24;
      cCtx.fillStyle = `rgb(${Math.round(124 + tone)},${Math.round(80 + tone * 0.7)},${Math.round(48 + tone * 0.5)})`;
      cCtx.fillRect(0, y0, S, plankH);

      hCtx.fillStyle = '#909090'; hCtx.fillRect(0, y0, S, plankH);
      const rBase = Math.round(115 + (hash2(row, 8.8) - 0.5) * 35);
      rCtx.fillStyle = `rgb(${rBase},${rBase},${rBase})`; rCtx.fillRect(0, y0, S, plankH);

      // Organic wood grain fibers
      for (let ly = 0; ly < plankH; ly += 2) {
        const wave = Math.sin(ly * 0.25 + row * 1.9) * 0.5 + 0.5;
        cCtx.fillStyle = wave > 0.5 ? 'rgba(65,36,18,0.18)' : 'rgba(176,120,72,0.14)';
        cCtx.fillRect(0, y0 + ly, S, 1.5);
        hCtx.fillStyle = wave > 0.5 ? 'rgba(110,110,110,0.35)' : 'rgba(150,150,150,0.35)';
        hCtx.fillRect(0, y0 + ly, S, 1.5);
      }
      // Plank seam groove
      cCtx.fillStyle = '#2c180c'; cCtx.fillRect(0, y0, S, 2.5);
      hCtx.fillStyle = '#1e1e1e'; hCtx.fillRect(0, y0, S, 3);
      rCtx.fillStyle = '#f0f0f0'; rCtx.fillRect(0, y0, S, 3);
    }

    tex.woodColor = finalizeTex(colC, true, 4, 1, maxAniso);
    tex.woodNormal = heightCanvasToNormalTexture(hC, 2.5, 4, 1, maxAniso);
    tex.woodRough = finalizeTex(rC, false, 4, 1, maxAniso);
  }

  // =========================================================================
  // 8. INDUSTRIAL STEEL DECK GRATING (Skybridge Walkway Floor)
  // =========================================================================
  {
    const S = 256;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    cCtx.fillStyle = '#2c2928'; cCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#383838'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#c8c8c8'; rCtx.fillRect(0, 0, S, S);

    // Raised metallic grating bars & anti-slip diamond ribs
    for (let i = 0; i < S; i += 16) {
      cCtx.fillStyle = '#4e4c4a'; cCtx.fillRect(i, 0, 4, S); cCtx.fillRect(0, i, S, 4);
      hCtx.fillStyle = '#dcdcdc'; hCtx.fillRect(i, 0, 4, S); hCtx.fillRect(0, i, S, 4);
      rCtx.fillStyle = '#686868'; rCtx.fillRect(i, 0, 4, S); rCtx.fillRect(0, i, S, 4);
    }
    // Slight dusty wear path
    for (let i = 0; i < 600; i++) {
      cCtx.fillStyle = 'rgba(165,102,65,0.08)';
      cCtx.fillRect(hash2(i, 2.2) * S, hash2(i, 6.6) * S, 6, 4);
    }

    tex.deckColor = finalizeTex(colC, true, 16, 4, maxAniso);
    tex.deckNormal = heightCanvasToNormalTexture(hC, 3.8, 16, 4, maxAniso);
    tex.deckRough = finalizeTex(rC, false, 16, 4, maxAniso);
  }

  // =========================================================================
  // 9. LUSH BIO-DOME CROP FOLIAGE CANOPY (Potatoes, Tomatoes, Golden Wheat)
  // =========================================================================
  {
    const S = 256;
    const gCol = makeCanvas(S, S), wCol = makeCanvas(S, S), hC = makeCanvas(S, S);
    const gCtx = gCol.getContext('2d'), wCtx = wCol.getContext('2d'), hCtx = hC.getContext('2d');

    gCtx.fillStyle = '#254a1a'; gCtx.fillRect(0, 0, S, S);
    wCtx.fillStyle = '#805b1b'; wCtx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#404040'; hCtx.fillRect(0, 0, S, S);

    for (let i = 0; i < 2400; i++) {
      const x = hash2(i, 1.7) * S, y = hash2(i, 4.9) * S;
      const r = 2 + hash2(i, 8.3) * 5.5;
      const bright = hash2(i, 3.2);
      // Leafy green potato/tomato canopy with occasional tiny red ripe tomatoes!
      if (bright > 0.965) {
        gCtx.fillStyle = '#d93829';
        gCtx.beginPath(); gCtx.arc(x, y, 2.4, 0, Math.PI * 2); gCtx.fill();
      } else {
        gCtx.fillStyle = `rgb(${Math.round(48 + bright * 68)},${Math.round(108 + bright * 78)},${Math.round(32 + bright * 34)})`;
        gCtx.beginPath(); gCtx.ellipse(x, y, r, r * 0.65, bright * 3.14, 0, Math.PI * 2); gCtx.fill();
      }

      // Golden wheat stalks
      wCtx.fillStyle = `rgb(${Math.round(168 + bright * 72)},${Math.round(126 + bright * 66)},${Math.round(44 + bright * 36)})`;
      wCtx.fillRect(x, y, 2, 7 + bright * 6);

      const hv = Math.round(90 + bright * 165);
      hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hCtx.beginPath(); hCtx.arc(x, y, r, 0, Math.PI * 2); hCtx.fill();
    }

    tex.cropGreenColor = finalizeTex(gCol, true, 3, 2, maxAniso);
    tex.cropWheatColor = finalizeTex(wCol, true, 3, 2, maxAniso);
    tex.cropNormal = heightCanvasToNormalTexture(hC, 3.5, 3, 2, maxAniso);
  }

  // =========================================================================
  // 9B. ALPHA-CUTOUT BOTANICAL BIO-DOME CROPS (TOMATO VINES, SALAD GREENS, GOLDEN WHEAT!)
  // =========================================================================
  {
    const S = 256;

    // 1) Serrated Tomato Vine Leaf Cluster (alpha-cutout for 3-plane crossed star cards!)
    const vC = makeCanvas(S, S);
    const vCtx = vC.getContext('2d');
    vCtx.clearRect(0, 0, S, S);
    // Woody green vine stems radiating from center
    vCtx.strokeStyle = '#33591f';
    vCtx.lineWidth = 4;
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2 + 0.3;
      vCtx.beginPath();
      vCtx.moveTo(128, 224);
      vCtx.quadraticCurveTo(128 + Math.cos(a) * 44, 138, 128 + Math.cos(a) * 96, 124 + Math.sin(a) * 76);
      vCtx.stroke();
    }
    // 32 overlapping pointed botanical tomato leaflets with central midrib veins!
    for (let i = 0; i < 34; i++) {
      const a = hash2(i, 1.3) * Math.PI * 2;
      const dist = 16 + Math.pow(hash2(i, 4.1), 0.7) * 86;
      const lx = 128 + Math.cos(a) * dist;
      const ly = 132 + Math.sin(a) * dist * 0.92;
      const ang = a + (hash2(i, 7.2) - 0.5) * 0.9;
      const len = 24 + hash2(i, 2.9) * 26;
      const wid = len * 0.48;
      const shade = hash2(i, 9.4);

      vCtx.save();
      vCtx.translate(lx, ly);
      vCtx.rotate(ang);
      vCtx.fillStyle = `rgb(${Math.round(34 + shade * 46)},${Math.round(78 + shade * 68)},${Math.round(22 + shade * 28)})`;
      vCtx.beginPath();
      vCtx.moveTo(-len * 0.5, 0);
      vCtx.quadraticCurveTo(-len * 0.1, -wid, len * 0.55, 0);
      vCtx.quadraticCurveTo(-len * 0.1, wid, -len * 0.5, 0);
      vCtx.closePath();
      vCtx.fill();
      // Subtle pale leaf vein
      vCtx.strokeStyle = `rgba(148,204,96,${0.28 + shade * 0.25})`;
      vCtx.lineWidth = 1.4;
      vCtx.beginPath();
      vCtx.moveTo(-len * 0.42, 0);
      vCtx.lineTo(len * 0.44, 0);
      vCtx.stroke();
      vCtx.restore();
    }
    const vTex = new THREE.CanvasTexture(vC);
    vTex.colorSpace = THREE.SRGBColorSpace;
    vTex.anisotropy = maxAniso;
    tex.vineLeafAlpha = vTex;

    // 2) Ruffled Leafy Hydroponic Lettuce / Spinach Rosette Cluster
    const sC = makeCanvas(S, S);
    const sCtx = sC.getContext('2d');
    sCtx.clearRect(0, 0, S, S);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (hash2(i, 3.1) - 0.5) * 0.25;
      const rad = 18 + (i % 3) * 24 + hash2(i, 5.5) * 18;
      const lx = 128 + Math.cos(a) * rad * 0.72;
      const ly = 216 - Math.abs(Math.sin(a * 0.5)) * rad * 1.45 - hash2(i, 8.1) * 34;
      const shade = hash2(i, 2.2);
      sCtx.save();
      sCtx.translate(lx, ly);
      sCtx.rotate(a * 0.45 - Math.PI * 0.5);
      sCtx.fillStyle = `rgb(${Math.round(44 + shade * 66)},${Math.round(108 + shade * 82)},${Math.round(28 + shade * 36)})`;
      sCtx.beginPath();
      sCtx.ellipse(0, 0, 26 + shade * 16, 15 + shade * 9, 0, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(176,226,112,0.34)';
      sCtx.lineWidth = 1.5;
      sCtx.beginPath(); sCtx.moveTo(-20, 0); sCtx.lineTo(20, 0); sCtx.stroke();
      sCtx.restore();
    }
    const sTex = new THREE.CanvasTexture(sC);
    sTex.colorSpace = THREE.SRGBColorSpace;
    sTex.anisotropy = maxAniso;
    tex.saladLeafAlpha = sTex;

    // 3) Feathered Golden Mars Wheat Sheaf & Sunlit Grain Ears (Scene 09 Foreground Right!)
    const wC = makeCanvas(S, S);
    const wCtx = wC.getContext('2d');
    wCtx.clearRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      const bx = 34 + (i / 17) * 188 + (hash2(i, 1.9) - 0.5) * 14;
      const topX = bx + (hash2(i, 4.7) - 0.5) * 56;
      const topY = 26 + hash2(i, 6.3) * 58;
      const bright = hash2(i, 8.9);

      // Arching slender golden stalk
      wCtx.strokeStyle = `rgb(${Math.round(168 + bright * 58)},${Math.round(126 + bright * 48)},${Math.round(42 + bright * 28)})`;
      wCtx.lineWidth = 2.6;
      wCtx.beginPath();
      wCtx.moveTo(bx, 254);
      wCtx.quadraticCurveTo((bx + topX) * 0.5, 145, topX, topY + 46);
      wCtx.stroke();

      // Slender side wheat leaf blade
      wCtx.strokeStyle = `rgba(196,154,62,0.85)`;
      wCtx.lineWidth = 3.2;
      wCtx.beginPath();
      wCtx.moveTo((bx + topX) * 0.5, 168);
      wCtx.quadraticCurveTo(bx + (i % 2 === 0 ? 28 : -28), 140, bx + (i % 2 === 0 ? 44 : -44), 165);
      wCtx.stroke();

      // Layered golden wheat ear kernels + delicate sunlit awns!
      const dx = (topX - bx) * 0.16;
      for (let k = 0; k < 7; k++) {
        const ky = topY + 44 - k * 6.8;
        const kx = topX + dx * (k / 7);
        for (const side of [-1, 1]) {
          wCtx.save();
          wCtx.translate(kx + side * 4.2, ky);
          wCtx.rotate(side * 0.42);
          wCtx.fillStyle = `rgb(${Math.round(205 + bright * 46)},${Math.round(162 + bright * 44)},${Math.round(64 + bright * 34)})`;
          wCtx.beginPath();
          wCtx.ellipse(0, 0, 3.2, 6.2, 0, 0, Math.PI * 2);
          wCtx.fill();
          wCtx.restore();
        }
        // Fine golden wheat awn whiskers
        wCtx.strokeStyle = 'rgba(248,224,142,0.72)';
        wCtx.lineWidth = 1.0;
        wCtx.beginPath();
        wCtx.moveTo(kx, ky - 4);
        wCtx.lineTo(kx + (hash2(i * 7 + k, 2.3) - 0.5) * 16, ky - 24);
        wCtx.stroke();
      }
    }
    const wTex = new THREE.CanvasTexture(wC);
    wTex.colorSpace = THREE.SRGBColorSpace;
    wTex.anisotropy = maxAniso;
    tex.wheatSheafAlpha = wTex;
  }

  // =========================================================================
  // 10. SKY-PAD WEATHERED CONCRETE WITH LANDING RING & BLAST SCORCH
  // =========================================================================
  {
    const S = 512;
    const c = makeCanvas(S, S), h = makeCanvas(S, S);
    const ctx = c.getContext('2d'), hCtx = h.getContext('2d');
    ctx.fillStyle = '#534740'; ctx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#808080'; hCtx.fillRect(0, 0, S, S);

    // Radial concrete slab joints
    ctx.strokeStyle = 'rgba(28,22,18,0.55)'; ctx.lineWidth = 2.5;
    hCtx.strokeStyle = '#303030'; hCtx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const g of [ctx, hCtx]) {
        g.beginPath();
        g.moveTo(256, 256);
        g.lineTo(256 + Math.cos(a) * 256, 256 + Math.sin(a) * 256);
        g.stroke();
      }
    }
    // Faded painted amber outer ring + crosshairs + central cold-gas dust-scoured ring
    ctx.strokeStyle = 'rgba(222,158,64,0.82)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(256, 256, 178, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(222,158,64,0.45)'; ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.arc(256, 256, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Center cold-gas blast scour mark + outer Martian dust halo
    const rg = ctx.createRadialGradient(256, 256, 16, 256, 256, 245);
    rg.addColorStop(0, 'rgba(30,28,26,0.45)');
    rg.addColorStop(0.45, 'rgba(55,48,44,0.0)');
    rg.addColorStop(0.85, 'rgba(176,98,58,0.38)');
    rg.addColorStop(1, 'rgba(176,98,58,0.55)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, S, S);

    ctx.fillStyle = 'rgba(235,215,180,0.75)';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAD-02 // N2-CG', 256, 108);

    tex.skyPadColor = finalizeTex(c, true, 1, 1, maxAniso);
    tex.skyPadNormal = heightCanvasToNormalTexture(h, 2.5, 1, 1, maxAniso);
  }

  // =========================================================================
  // 11. MONOCRYSTALLINE MARS PHOTOVOLTAIC MODULES, THERMAL RADIATORS & FX
  // =========================================================================
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const ctx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    // Base brushed anodized aluminum frame backing
    ctx.fillStyle = '#9aa5b2'; ctx.fillRect(0, 0, S, S);
    hCtx.fillStyle = '#dcdcdc'; hCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#707070'; rCtx.fillRect(0, 0, S, S);

    // 2x2 framed sub-modules per 512px tile (repeated 2x1 across tracker = 4x2 = 8 modules/wing!)
    const modCols = 2, modRows = 2;
    const modW = S / modCols, modH = S / modRows;
    const framePad = 8;

    for (let mr = 0; mr < modRows; mr++) {
      for (let mc = 0; mc < modCols; mc++) {
        const mx0 = mc * modW, my0 = mr * modH;

        // Outer beveled aluminum module perimeter seam & clamp bolts
        ctx.strokeStyle = '#3c4552'; ctx.lineWidth = 2.5;
        ctx.strokeRect(mx0 + 1, my0 + 1, modW - 2, modH - 2);
        hCtx.strokeStyle = '#222222'; hCtx.lineWidth = 3;
        hCtx.strokeRect(mx0 + 1, my0 + 1, modW - 2, modH - 2);

        // Recessed photovoltaic glass cavity (white/silver Tedlar backsheet behind wafers)
        const ix = mx0 + framePad, iy = my0 + framePad;
        const iw = modW - framePad * 2, ih = modH - framePad * 2;
        ctx.fillStyle = '#bcc7d6'; ctx.fillRect(ix, iy, iw, ih);
        hCtx.fillStyle = '#484848'; hCtx.fillRect(ix, iy, iw, ih);
        rCtx.fillStyle = '#202020'; rCtx.fillRect(ix, iy, iw, ih); // Mirror-gloss tempered solar glass!

        // 4x6 monocrystalline PERC silicon wafers inside each framed sub-module
        const cellCols = 4, cellRows = 6;
        const cw = iw / cellCols, ch = ih / cellRows;
        const gap = 2.2;
        const cham = 5.2;

        for (let cr = 0; cr < cellRows; cr++) {
          for (let cc = 0; cc < cellCols; cc++) {
            const x0 = ix + cc * cw + gap * 0.5;
            const y0 = iy + cr * ch + gap * 0.5;
            const w = cw - gap;
            const h = ch - gap;

            // Subtle crystal orientation iridescent tone shift per silicon wafer!
            const tone = hash2(mc * 17 + cc + 1, mr * 23 + cr + 1);
            const gCell = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
            gCell.addColorStop(0.0, `rgb(${Math.round(13 + tone * 11)},${Math.round(28 + tone * 17)},${Math.round(58 + tone * 24)})`);
            gCell.addColorStop(0.55, `rgb(${Math.round(19 + tone * 14)},${Math.round(41 + tone * 21)},${Math.round(82 + tone * 28)})`);
            gCell.addColorStop(1.0, `rgb(${Math.round(11 + tone * 9)},${Math.round(24 + tone * 15)},${Math.round(50 + tone * 22)})`);

            // Authentic chamfered octagonal monocrystalline silicon wafer silhouette!
            const drawOct = (g2d) => {
              g2d.beginPath();
              g2d.moveTo(x0 + cham, y0);
              g2d.lineTo(x0 + w - cham, y0);
              g2d.lineTo(x0 + w, y0 + cham);
              g2d.lineTo(x0 + w, y0 + h - cham);
              g2d.lineTo(x0 + w - cham, y0 + h);
              g2d.lineTo(x0 + cham, y0 + h);
              g2d.lineTo(x0, y0 + h - cham);
              g2d.lineTo(x0, y0 + cham);
              g2d.closePath();
              g2d.fill();
            };

            ctx.fillStyle = gCell;
            drawOct(ctx);

            hCtx.fillStyle = '#8e8e8e';
            drawOct(hCtx);

            rCtx.fillStyle = `rgb(${Math.round(24 + tone * 14)},${Math.round(24 + tone * 14)},${Math.round(24 + tone * 14)})`;
            drawOct(rCtx);

            // Ultra-fine horizontal silver collector fingers across wafer
            ctx.fillStyle = 'rgba(165,198,236,0.16)';
            for (let fy = y0 + 5; fy < y0 + h - 4; fy += 5) {
              ctx.fillRect(x0 + 2, fy, w - 4, 0.8);
            }

            // Twin crisp vertical silver busbars per wafer
            ctx.fillStyle = 'rgba(205,222,240,0.68)';
            ctx.fillRect(x0 + w * 0.30, y0 + 1, 1.3, h - 2);
            ctx.fillRect(x0 + w * 0.70, y0 + 1, 1.3, h - 2);
            hCtx.fillStyle = '#b4b4b4';
            hCtx.fillRect(x0 + w * 0.30, y0 + 1, 1.4, h - 2);
            hCtx.fillRect(x0 + w * 0.70, y0 + 1, 1.4, h - 2);
          }
        }

        // Aluminum frame clamp clips along module edges
        ctx.fillStyle = '#505a68';
        for (const cx2 of [mx0 + modW * 0.25, mx0 + modW * 0.75]) {
          ctx.fillRect(cx2 - 5, my0 + 1, 10, 6);
          ctx.fillRect(cx2 - 5, my0 + modH - 7, 10, 6);
        }
      }
    }

    // Subtle Martian windblown ochre dust accumulation near lower beveled frame rim (grounded on Mars!)
    const dustG = ctx.createLinearGradient(0, S * 0.62, 0, S);
    dustG.addColorStop(0.0, 'rgba(176,102,60,0.00)');
    dustG.addColorStop(0.75, 'rgba(176,102,60,0.10)');
    dustG.addColorStop(1.0, 'rgba(176,102,60,0.34)');
    ctx.fillStyle = dustG;
    ctx.fillRect(0, 0, S, S);

    const rDustG = rCtx.createLinearGradient(0, S * 0.68, 0, S);
    rDustG.addColorStop(0.0, 'rgba(215,215,215,0.0)');
    rDustG.addColorStop(1.0, 'rgba(215,215,215,0.62)');
    rCtx.fillStyle = rDustG;
    rCtx.fillRect(0, 0, S, S);

    tex.solarColor = finalizeTex(colC, true, 2, 1, maxAniso);
    tex.solarNormal = heightCanvasToNormalTexture(hC, 3.0, 2, 1, maxAniso);
    tex.solarRough = finalizeTex(rC, false, 2, 1, maxAniso);
  }

  {
    const c = makeCanvas(256, 256), h = makeCanvas(256, 256);
    const ctx = c.getContext('2d'), hCtx = h.getContext('2d');
    ctx.fillStyle = '#1b1e23'; ctx.fillRect(0, 0, 256, 256);
    hCtx.fillStyle = '#606060'; hCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) {
      ctx.fillStyle = '#2a2f37'; ctx.fillRect(0, y, 256, 3.5);
      ctx.fillStyle = '#0e1013'; ctx.fillRect(0, y + 3.5, 256, 2);
      hCtx.fillStyle = '#d8d8d8'; hCtx.fillRect(0, y, 256, 3.5);
      hCtx.fillStyle = '#202020'; hCtx.fillRect(0, y + 3.5, 256, 2);
    }
    tex.radiatorColor = finalizeTex(c, true, 4, 2, maxAniso);
    tex.radiatorNormal = heightCanvasToNormalTexture(h, 3.0, 4, 2, maxAniso);
  }

  {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.52)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    tex.softParticle = new THREE.CanvasTexture(c);
  }

  // =========================================================================
  // PHOTOREALISTIC 512x512 2x2 VOLUMETRIC CAULIFLOWER CLOUD ATLAS
  //   R = 3D Puff Normal X (left/right sun relief)
  //   G = 3D Puff Normal Y (top/bottom sun relief)
  //   B = High-Frequency Turbulent Wisp Erosion Detail
  //   A = Sculpted Multi-Lobe Pyroclastic Optical Thickness (ZERO round circles!)
  // =========================================================================
  {
    const S = 512;
    const T = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const dst = img.data;

    // 4 distinct asymmetric multi-lobe billowing cauliflower bouquets (one per 256x256 quadrant!)
    const tileLobes = [
      [[0.00, 0.02, 0.44], [-0.24, 0.16, 0.32], [0.25, 0.14, 0.30], [-0.18, -0.20, 0.31], [0.22, -0.18, 0.32], [0.02, 0.28, 0.27], [-0.30, -0.02, 0.24], [0.30, 0.02, 0.23]],
      [[0.02, -0.02, 0.42], [-0.22, 0.20, 0.33], [0.26, 0.08, 0.31], [-0.26, -0.14, 0.28], [0.16, -0.24, 0.30], [-0.04, 0.30, 0.26], [0.28, 0.24, 0.22], [-0.08, -0.28, 0.25]],
      [[-0.02, 0.04, 0.43], [0.20, 0.22, 0.32], [-0.28, 0.10, 0.30], [0.28, -0.10, 0.29], [-0.14, -0.25, 0.31], [0.08, 0.30, 0.25], [-0.26, -0.20, 0.23], [0.14, -0.28, 0.24]],
      [[0.00, 0.00, 0.41], [-0.25, -0.16, 0.33], [0.24, -0.15, 0.32], [-0.20, 0.22, 0.30], [0.22, 0.20, 0.29], [0.00, -0.29, 0.27], [0.00, 0.29, 0.26], [-0.31, 0.04, 0.22]]
    ];

    const hField = new Float32Array(T * T);
    const wispField = new Float32Array(T * T);

    for (let tile = 0; tile < 4; tile++) {
      const tx0 = (tile % 2) * T;
      const ty0 = Math.floor(tile / 2) * T;
      const lobes = tileLobes[tile];
      const seedU = tile * 0.371 + 0.13;
      const seedV = tile * 0.529 + 0.27;

      // Pass 1: Build sculpted multi-lobe billowing thickness field + fine curl wisp noise
      for (let py = 0; py < T; py++) {
        const ny = (py / (T - 1)) * 2.0 - 1.0;
        const v = py / T;
        for (let px = 0; px < T; px++) {
          const nx = (px / (T - 1)) * 2.0 - 1.0;
          const u = px / T;
          const rad = Math.hypot(nx, ny);

          // Domain-warp coordinates for authentic Kelvin-Helmholtz fluid curl!
          const wx = (tileFbm(u + seedU, v + seedV, 4, 3) - 0.5) * 0.26;
          const wy = (tileFbm(u + seedU + 0.41, v + seedV + 0.19, 4, 3) - 0.5) * 0.26;
          const pnx = nx + wx;
          const pny = ny + wy;

          // Smooth-max blend of asymmetric cauliflower cloud lobes
          let lobeH = 0.0;
          for (let li = 0; li < lobes.length; li++) {
            const l = lobes[li];
            const d = Math.hypot(pnx - l[0], pny - l[1]) / l[2];
            if (d < 1.35) {
              const s = Math.max(0.0, 1.0 - d * d * 0.62);
              lobeH = Math.max(lobeH, s * s);
            }
          }

          // Multi-octave billowy ridge turbulence (1 - |2*n - 1| creates crisp boiling cumulus bumps!)
          const n1 = tileFbm(u + wx * 0.5 + seedU, v + wy * 0.5 + seedV, 6, 4);
          const n2 = tileFbm(u + seedU * 1.7, v + seedV * 1.3, 14, 3);
          const billow1 = 1.0 - Math.abs(n1 * 2.0 - 1.0);
          const billow2 = 1.0 - Math.abs(n2 * 2.0 - 1.0);
          const detail = billow1 * 0.62 + billow2 * 0.38;

          // Strict smooth border guard so sprites NEVER clip into squares
          const edgeMask = Math.max(0.0, Math.min(1.0, (0.94 - rad) / 0.28));
          const edgeSmooth = edgeMask * edgeMask * (3.0 - 2.0 * edgeMask);

          const thick = Math.max(0.0, Math.min(1.0, (lobeH * (0.58 + detail * 0.62) - 0.09) * 1.32)) * edgeSmooth;
          const idxT = py * T + px;
          hField[idxT] = thick;
          wispField[idxT] = Math.max(0.0, Math.min(1.0, n2 * 0.55 + billow1 * 0.45));
        }
      }

      // Pass 2: Compute multi-scale Sobel 3D cloud normals (macro lobe + micro cauliflower bumps!)
      for (let py = 0; py < T; py++) {
        const yU = Math.max(0, py - 2), yD = Math.min(T - 1, py + 2);
        const yU2 = Math.max(0, py - 7), yD2 = Math.min(T - 1, py + 7);
        for (let px = 0; px < T; px++) {
          const xL = Math.max(0, px - 2), xR = Math.min(T - 1, px + 2);
          const xL2 = Math.max(0, px - 7), xR2 = Math.min(T - 1, px + 7);

          const gxMicro = hField[py * T + xR] - hField[py * T + xL];
          const gyMicro = hField[yD * T + px] - hField[yU * T + px];
          const gxMacro = hField[py * T + xR2] - hField[py * T + xL2];
          const gyMacro = hField[yD2 * T + px] - hField[yU2 * T + px];

          // Combine macro hemisphere puff slope + crisp cauliflower bump normals
          const nx = Math.max(-1, Math.min(1, -(gxMacro * 1.65 + gxMicro * 2.35)));
          const ny = Math.max(-1, Math.min(1,  (gyMacro * 1.65 + gyMicro * 2.35))); // +Y up in GLSL UV!
          const idxT = py * T + px;
          const thick = hField[idxT];
          const wisp = wispField[idxT];

          const outIdx = ((ty0 + py) * S + (tx0 + px)) * 4;
          dst[outIdx]     = Math.round((nx * 0.5 + 0.5) * 255);
          dst[outIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          dst[outIdx + 2] = Math.round(wisp * 255);
          dst[outIdx + 3] = Math.round(thick * 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const atlas = new THREE.CanvasTexture(c);
    atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.generateMipmaps = true;
    tex.cloudVolAtlas = atlas;
  }

  // Scorched Sintered-Basalt Rocket Launchpad Blast-Pit Carbon & Exhaust Ray-Streaks Decal!
  {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 6, S / 2, S / 2, S * 0.49);
    g.addColorStop(0.00, 'rgba(10, 9, 10, 0.94)');
    g.addColorStop(0.32, 'rgba(22, 17, 15, 0.82)');
    g.addColorStop(0.62, 'rgba(42, 26, 18, 0.45)');
    g.addColorStop(0.84, 'rgba(72, 42, 26, 0.16)');
    g.addColorStop(1.00, 'rgba(72, 42, 26, 0.00)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // High-velocity radial supersonic Raptor exhaust scour streaks radiating from pad center!
    ctx.save();
    ctx.translate(S / 2, S / 2);
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2 + (hash2(i, 4.1) - 0.5) * 0.08;
      const len = S * (0.28 + hash2(i, 9.2) * 0.21);
      const w = 1.5 + hash2(i, 2.3) * 4.5;
      ctx.rotate(ang);
      const sg = ctx.createLinearGradient(8, 0, len, 0);
      sg.addColorStop(0, 'rgba(8, 7, 8, 0.42)');
      sg.addColorStop(0.55, 'rgba(34, 20, 14, 0.24)');
      sg.addColorStop(1, 'rgba(34, 20, 14, 0.0)');
      ctx.fillStyle = sg;
      ctx.fillRect(8, -w * 0.5, len, w);
      ctx.rotate(-ang);
    }
    ctx.restore();
    tex.padScorch = finalizeTex(c, true, 1, 1, maxAniso);
    tex.padScorch.wrapS = tex.padScorch.wrapT = THREE.ClampToEdgeWrapping;
  }

  // Soft Grounded Contact Shadow Decal (anchors wheels, Optimus feet, lamps & mugs to surfaces!)
  {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(12,6,4,0.72)');
    g.addColorStop(0.55, 'rgba(14,8,5,0.34)');
    g.addColorStop(1, 'rgba(14,8,5,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    tex.contactShadow = new THREE.CanvasTexture(c);
  }

  // Live Interior Telemetry Wall Canvas Texture (v5.1 Grounded Colony Vitals)
  {
    const c = makeCanvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0d1217'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#3c5263'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 248);
    ctx.fillStyle = '#ebb060'; ctx.font = 'bold 20px monospace';
    ctx.fillText('STARBASE ARCADIA // FOUNDER RIDGE SECTOR 04', 22, 38);
    ctx.fillStyle = '#3b4f5e'; ctx.fillRect(22, 50, 468, 2);
    const rows = [
      ['CABIN PRESSURE', '70.0 kPa (21 kPa O2)', '#67e8f9'],
      ['EXTERIOR MARS', '0.61 kPa CO2 · -54 C · 0.38G', '#f59e0b'],
      ['GRID / RADIATORS', '10.0 GWe SMR · 20 GWth @ 400K', '#86efac'],
      ['SYNODIC ISRU', '650 SHIPS · 910 kt CH4/LOX (4:1)', '#e2e8f0'],
      ['FLEET & WORKFORCE', '1,000,000 CITIZENS · 4.2M OPTIMUS', '#fde68a']
    ];
    rows.forEach((row, i) => {
      const y = 86 + i * 32;
      ctx.fillStyle = '#94a3b8'; ctx.font = '15px monospace'; ctx.fillText(row[0], 24, y);
      ctx.fillStyle = row[2]; ctx.font = 'bold 16px monospace'; ctx.fillText(row[1], 208, y);
    });
    tex.telemetryWall = finalizeTex(c, true, 1, 1, maxAniso);
  }

  // Roadster Ano White Aerospace Coat with subtle panel shutlines & lower Martian dust splatter!
  {
    const S = 512;
    const colC = makeCanvas(S, S), hC = makeCanvas(S, S), rC = makeCanvas(S, S);
    const cCtx = colC.getContext('2d'), hCtx = hC.getContext('2d'), rCtx = rC.getContext('2d');

    const bodyG = cCtx.createLinearGradient(0, 0, 0, S);
    bodyG.addColorStop(0.0, '#edeae3');
    bodyG.addColorStop(0.68, '#ded9cf');
    bodyG.addColorStop(0.86, '#c7a488'); // Subtle Martian rust road dust along lower rocker panels!
    bodyG.addColorStop(1.0, '#9c6848');
    cCtx.fillStyle = bodyG; cCtx.fillRect(0, 0, S, S);

    hCtx.fillStyle = '#808080'; hCtx.fillRect(0, 0, S, S);
    const roughG = rCtx.createLinearGradient(0, 0, 0, S);
    roughG.addColorStop(0.0, '#2a2a2a'); // Glossy Ano White upper aero shell
    roughG.addColorStop(0.72, '#3a3a3a');
    roughG.addColorStop(1.0, '#d8d8d8'); // Matte dusty lower sills!
    rCtx.fillStyle = roughG; rCtx.fillRect(0, 0, S, S);

    // Crisp aerospace panel shutlines (door seam, hood cut, thruster bay hatches)
    cCtx.strokeStyle = 'rgba(42,38,36,0.42)'; cCtx.lineWidth = 2;
    hCtx.strokeStyle = '#282828'; hCtx.lineWidth = 2.5;
    for (const x of [140, 355]) {
      cCtx.beginPath(); cCtx.moveTo(x, 0); cCtx.lineTo(x, S); cCtx.stroke();
      hCtx.beginPath(); hCtx.moveTo(x, 0); hCtx.lineTo(x, S); hCtx.stroke();
    }
    // Dusty grit flecks along lower third
    for (let i = 0; i < 1200; i++) {
      const px = hash2(i, 2.9) * S;
      const py = S * (0.62 + hash2(i, 6.1) * 0.38);
      cCtx.fillStyle = `rgba(145,82,48,${0.12 + hash2(i, 1.1) * 0.25})`;
      cCtx.fillRect(px, py, 2 + hash2(i, 4.4) * 4, 2);
    }

    tex.roadsterColor = finalizeTex(colC, true, 1, 1, maxAniso);
    tex.roadsterNormal = heightCanvasToNormalTexture(hC, 2.2, 1, 1, maxAniso);
    tex.roadsterRough = finalizeTex(rC, false, 1, 1, maxAniso);
  }

  return tex;
}
