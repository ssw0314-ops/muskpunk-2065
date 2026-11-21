import fs from 'fs';

const bundle = fs.readFileSync('/home/antigravity/arcadia-3d/dist/bundle.js', 'utf8');
// MUSKPUNK 2065 title logo (black background keyed to alpha by blender_pipeline/process_logo.py)
const LOGO_URI = 'data:image/webp;base64,' +
  fs.readFileSync('/home/antigravity/arcadia-3d/blender_pipeline/muskpunk_logo.webp').toString('base64');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>PROJECT ARCADIA — GTA Open-World Mars Flying Roadster Simulator</title>
  <link rel="icon" href="data:," />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #170e0b;
      color: #f3ede4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: none;
      overscroll-behavior: none;
    }
    #mars-canvas {
      display: block; width: 100vw; height: 100vh;
      cursor: grab; touch-action: none;
    }
    #mars-canvas:active { cursor: grabbing; }

    #eva-visor {
      position: fixed; inset: 0; pointer-events: none; z-index: 5;
      opacity: 0; transition: opacity 0.6s ease;
      background: radial-gradient(ellipse at center, transparent 58%, rgba(16, 10, 8, 0.42) 86%, rgba(8, 5, 4, 0.78) 100%);
      box-shadow: inset 0 0 0 1px rgba(232, 169, 88, 0.14);
    }
    #eva-visor.active { opacity: 1; }

    /* Cinematic Dystopian Title Intro Overlay */
    #intro-overlay {
      position: fixed; inset: 0; z-index: 40;
      display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;
      padding: max(28px, env(safe-area-inset-top)) max(32px, env(safe-area-inset-right)) max(42px, env(safe-area-inset-bottom)) max(36px, env(safe-area-inset-left));
      background: linear-gradient(180deg, rgba(14,9,7,0.10) 0%, rgba(14,9,7,0.0) 52%, rgba(10,6,5,0.82) 100%);
      transition: opacity 0.55s ease, visibility 0.55s ease;
    }
    #intro-overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
    #intro-logo {
      position: absolute;
      top: max(22px, env(safe-area-inset-top)); right: max(30px, env(safe-area-inset-right));
      width: clamp(260px, 34vw, 520px); height: auto;
      pointer-events: none; user-select: none;
      filter: drop-shadow(0 6px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 18px rgba(255, 226, 40, 0.18));
      animation: introLogoIn 1.6s cubic-bezier(.2,.8,.2,1) both, introLogoGlow 4.8s ease-in-out 1.6s infinite;
    }
    @keyframes introLogoIn {
      from { opacity: 0; transform: translateY(-14px) scale(0.94); }
      to { opacity: 1; transform: none; }
    }
    @keyframes introLogoGlow {
      0%, 100% { filter: drop-shadow(0 6px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 14px rgba(255, 226, 40, 0.14)); }
      50% { filter: drop-shadow(0 6px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 26px rgba(255, 226, 40, 0.30)); }
    }
    .intro-dystopia {
      max-width: 680px;
      border-left: 2px solid rgba(72, 238, 255, 0.72);
      padding-left: 18px;
      margin-bottom: 22px;
    }
    .intro-quote {
      font-size: clamp(22px, 3.4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.14;
      color: #fbf5ec;
      text-shadow: 0 4px 28px rgba(0, 0, 0, 0.85);
    }
    .intro-quote .air-accent {
      color: #63f2ff;
      text-shadow: 0 0 22px rgba(99, 242, 255, 0.38), 0 4px 24px rgba(0, 0, 0, 0.85);
    }
    .intro-terms {
      margin-top: 9px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: clamp(12px, 1.5vw, 15px);
      font-weight: 600;
      letter-spacing: 0.20em;
      text-transform: uppercase;
      color: rgba(238, 186, 112, 0.92);
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.85);
    }
    .intro-actions {
      display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
    }
    #btn-start {
      background: linear-gradient(135deg, #f3e600 0%, #e5a93c 100%);
      color: #120c09; border: none; border-radius: 6px;
      padding: 13px 28px; font-size: 13.5px; font-weight: 900; letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer; transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 8px 28px rgba(243, 230, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.22) inset;
      touch-action: manipulation;
    }
    #btn-start:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
      box-shadow: 0 10px 32px rgba(243, 230, 0, 0.42);
    }
    .intro-fineprint {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(214, 202, 188, 0.62);
    }
    @media (orientation: portrait), (max-width: 760px) {
      #intro-overlay {
        padding: max(22px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(30px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
      }
      #intro-logo {
        right: auto; left: 50%;
        top: max(28px, calc(env(safe-area-inset-top) + 14px));
        width: min(86vw, 420px);
        margin-left: calc(min(86vw, 420px) / -2);
      }
      .intro-dystopia { margin-bottom: 16px; padding-left: 14px; }
      #btn-start { width: 100%; text-align: center; }
    }

    /* GTA District Entry / Flight Gate Banner Toast */
    #district-toast {
      position: fixed; top: 64px; left: 50%; transform: translateX(-50%) translateY(-10px);
      z-index: 25; pointer-events: none; text-align: center;
      padding: 8px 22px; border-radius: 8px;
      background: rgba(16, 12, 10, 0.76);
      border: 1px solid rgba(232, 169, 88, 0.42);
      backdrop-filter: blur(10px);
      opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease;
    }
    #district-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #toast-kicker {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px; letter-spacing: 0.18em; color: #f2b464;
    }
    #toast-title {
      font-size: 15px; font-weight: 700; color: #fbf6ee; margin-top: 2px;
    }

    /* Grounded MUSKPUNK Open-World HUD */
    #hud-root {
      position: fixed; inset: 0; pointer-events: none; z-index: 20;
      transition: opacity 0.4s ease;
    }
    #hud-root.hud-hidden { opacity: 0; }
    #hud-root.hud-hidden * { pointer-events: none !important; }

    .hud-top {
      position: absolute;
      top: max(12px, env(safe-area-inset-top));
      left: max(14px, env(safe-area-inset-left));
      right: max(14px, env(safe-area-inset-right));
      display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    }
    .hud-bar {
      pointer-events: auto;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      background: rgba(18, 14, 12, 0.68);
      border: 1px solid rgba(244, 224, 198, 0.16);
      backdrop-filter: blur(10px);
      padding: 6px 10px; border-radius: 7px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; color: #e5dccf;
    }
    .pill { padding: 3px 8px; border-radius: 4px; font-weight: 700; letter-spacing: 0.04em; }
    .pill-cabin  { background: rgba(56, 189, 248, 0.18); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.38); }
    .pill-flight { background: rgba(56, 232, 216, 0.22); color: #5eead4; border: 1px solid rgba(56,232,216,0.52); }
    .pill-eva    { background: rgba(245, 158, 11, 0.22); color: #fcd34d; border: 1px solid rgba(245,158,11,0.45); }
    .sep { color: rgba(255,255,255,0.22); }
    #hud-gates { color: #5eead4; font-weight: 700; }

    /* GTA Circular Tactical Radar Minimap */
    #minimap-wrap {
      position: absolute;
      left: max(14px, env(safe-area-inset-left));
      bottom: 62px;
      width: 150px; height: 150px;
      border-radius: 50%;
      box-shadow: 0 8px 26px rgba(0, 0, 0, 0.55);
      pointer-events: none;
    }
    #gta-minimap { width: 100%; height: 100%; display: block; border-radius: 50%; }

    /* Sleek Tesla Roadster Digital Instrument Cluster (Speed + ALT + COPV N2/CO2 Bar) */
    #vehicle-hud {
      position: absolute;
      right: max(14px, env(safe-area-inset-right));
      bottom: 62px;
      width: 204px;
      background: rgba(16, 12, 10, 0.72);
      border: 1px solid rgba(244, 224, 198, 0.20);
      backdrop-filter: blur(10px);
      border-radius: 9px;
      padding: 10px 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      transition: opacity 0.25s ease;
    }
    #vehicle-hud.on-foot { opacity: 0.35; }
    .vh-top { display: flex; justify-content: space-between; align-items: baseline; }
    .vh-speed { font-size: 28px; font-weight: 800; color: #f9f3ea; line-height: 1; }
    .vh-unit { font-size: 10px; color: rgba(235, 222, 206, 0.62); margin-left: 3px; }
    .vh-alt-col { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
    .vh-alt { font-size: 13px; font-weight: 700; color: #5eead4; }
    .vh-vspeed { font-size: 9.5px; font-weight: 600; color: rgba(148, 210, 245, 0.84); letter-spacing: 0.04em; }
    .vh-mode {
      font-size: 9.5px; letter-spacing: 0.12em; color: #f2b464;
      margin-top: 5px; text-transform: uppercase;
    }
    .vh-mode.descending { color: #7dd3fc; }
    .copv-row { display: flex; justify-content: space-between; font-size: 9.5px; color: rgba(235, 222, 206, 0.72); margin-top: 7px; }
    .copv-track {
      height: 6px; width: 100%; background: rgba(255,255,255,0.12);
      border-radius: 4px; overflow: hidden; margin-top: 4px;
    }
    #copv-bar-fill {
      height: 100%; width: 100%;
      background: linear-gradient(90deg, #38bdf8 0%, #5eead4 100%);
      transition: width 0.08s linear;
    }

    #btn-mobile-menu {
      display: none;
      pointer-events: auto;
      background: rgba(18, 14, 12, 0.78);
      border: 1px solid rgba(232, 169, 88, 0.45);
      color: #f6e7d2; border-radius: 7px;
      padding: 7px 11px; font-size: 12px; font-weight: 700;
      backdrop-filter: blur(10px);
      cursor: pointer; touch-action: manipulation;
    }
    #btn-mobile-menu.active { background: #e29d4b; color: #160e0a; }
    #mob-speed { display: none; font-weight: 700; color: #5eead4; }

    .hud-bottom {
      position: absolute;
      bottom: max(10px, env(safe-area-inset-bottom));
      left: max(12px, env(safe-area-inset-left));
      right: max(12px, env(safe-area-inset-right));
      display: flex; justify-content: space-between; align-items: flex-end; gap: 8px;
      flex-wrap: nowrap;
    }
    .btn-group {
      pointer-events: auto;
      display: flex; flex-wrap: nowrap; gap: 4px;
      background: rgba(18, 14, 12, 0.74);
      border: 1px solid rgba(244, 224, 198, 0.16);
      backdrop-filter: blur(10px);
      padding: 5px; border-radius: 8px;
    }
    .hud-btn {
      background: rgba(255, 255, 255, 0.06);
      color: #e6ddd0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 5px;
      padding: 4px 6.5px;
      font-size: 11px; font-weight: 500;
      white-space: nowrap;
      cursor: pointer; touch-action: manipulation;
    }
    .hud-btn:hover { background: rgba(232, 169, 88, 0.22); border-color: rgba(232, 169, 88, 0.55); color: #fff; }
    .hud-btn.active { background: #e29d4b; color: #160e0a; border-color: #e29d4b; font-weight: 700; }
    .hud-hint {
      position: absolute; bottom: 48px; left: 176px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10.5px; color: rgba(236, 224, 208, 0.72);
      text-shadow: 0 1px 4px rgba(0,0,0,0.85);
    }

    /* =====================================================================
       MOBILE MULTI-TOUCH DRIVING & FLIGHT CONTROLS
       ===================================================================== */
    #mobile-controls {
      position: fixed; inset: 0; z-index: 16;
      pointer-events: none;
      opacity: 0; visibility: hidden;
      transition: opacity 0.35s ease, visibility 0.35s ease;
    }
    #mobile-controls.visible { opacity: 1; visibility: visible; }

    #touch-stick-zone {
      position: absolute; left: 0; bottom: 0;
      width: min(44vw, 240px); height: min(44vh, 250px);
      pointer-events: auto; touch-action: none;
    }
    #touch-stick-base {
      position: absolute;
      left: max(20px, env(safe-area-inset-left));
      bottom: max(26px, env(safe-area-inset-bottom));
      width: 112px; height: 112px; border-radius: 50%;
      background: radial-gradient(circle, rgba(24, 18, 15, 0.34) 0%, rgba(24, 18, 15, 0.66) 100%);
      border: 2px solid rgba(240, 212, 178, 0.36);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 26px rgba(0,0,0,0.48);
    }
    #touch-stick-base.active { border-color: rgba(226, 157, 75, 0.82); }
    #touch-stick-base.sprinting { border-color: #5eead4; box-shadow: 0 0 22px rgba(94, 234, 212, 0.42); }
    #touch-stick-base::before {
      content: "DRIVE";
      position: absolute; bottom: 9px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9px; letter-spacing: 0.14em; color: rgba(242, 224, 200, 0.62);
    }
    #touch-stick-knob {
      width: 46px; height: 46px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #f5c784 0%, #c97d32 100%);
      border: 2px solid rgba(255, 245, 228, 0.88);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55);
      pointer-events: none; will-change: transform;
    }

    #touch-action-pad {
      position: absolute;
      right: max(14px, env(safe-area-inset-right));
      bottom: max(22px, env(safe-area-inset-bottom));
      display: grid; grid-template-columns: auto auto auto; gap: 9px; align-items: end; justify-items: center;
      pointer-events: none;
    }
    .touch-circle-btn {
      pointer-events: auto; touch-action: manipulation;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      border-radius: 50%;
      background: rgba(20, 15, 12, 0.68);
      border: 2px solid rgba(240, 212, 178, 0.38);
      backdrop-filter: blur(8px);
      color: #f8eee2;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      box-shadow: 0 6px 20px rgba(0,0,0,0.48);
      cursor: pointer;
    }
    #touch-btn-lift { width: 68px; height: 68px; border-color: rgba(94, 234, 212, 0.78); }
    #touch-btn-lift .t-sub { font-size: 8px; color: #5eead4; letter-spacing: 0.05em; }
    #touch-btn-lift .t-main { font-size: 12.5px; font-weight: 800; }
    #touch-btn-descend { width: 62px; height: 62px; border-color: rgba(125, 211, 252, 0.82); }
    #touch-btn-descend .t-sub { font-size: 7.5px; color: #7dd3fc; letter-spacing: 0.05em; }
    #touch-btn-descend .t-main { font-size: 11px; font-weight: 800; }
    #touch-btn-descend.pressed { background: rgba(56, 189, 248, 0.42); }
    #touch-btn-boost { width: 62px; height: 62px; border-color: rgba(245, 158, 11, 0.78); }
    #touch-btn-boost .t-sub { font-size: 7.5px; color: #fcd34d; }
    #touch-btn-boost .t-main { font-size: 11px; font-weight: 800; }
    #touch-btn-mount, #touch-btn-cam {
      width: 48px; height: 48px; font-size: 10px; font-weight: 700;
      border-color: rgba(244, 224, 198, 0.35); color: #e8dfd2; justify-self: center;
    }
    .touch-pad-spacer { width: 1px; height: 1px; pointer-events: none; }
    .touch-circle-btn.pressed { transform: scale(0.92); background: rgba(94, 234, 212, 0.35); }

    @media (max-width: 820px) {
      #hud-desktop-right, #hud-sky, #hud-coords, .hud-sep-desk, .hud-hint, #vehicle-hud { display: none !important; }
      #btn-mobile-menu { display: inline-flex; align-items: center; gap: 5px; }
      #mob-speed { display: inline; }
      #minimap-wrap {
        top: max(54px, calc(env(safe-area-inset-top) + 46px));
        bottom: auto;
        left: max(12px, env(safe-area-inset-left));
        width: 96px; height: 96px;
      }
      #district-toast {
        top: max(56px, calc(env(safe-area-inset-top) + 48px));
        bottom: auto;
        left: auto;
        right: max(12px, env(safe-area-inset-right));
        transform: translateY(-6px);
        text-align: right;
        padding: 6px 12px;
        max-width: calc(100vw - 128px);
      }
      #district-toast.show { transform: translateY(0); }
      #toast-kicker { font-size: 8.5px; letter-spacing: 0.12em; }
      #toast-title { font-size: 12.5px; }

      .hud-bottom {
        display: none;
        position: fixed;
        top: max(56px, calc(env(safe-area-inset-top) + 46px));
        bottom: auto;
        left: max(12px, env(safe-area-inset-left));
        right: max(12px, env(safe-area-inset-right));
        flex-direction: column; align-items: stretch; gap: 8px;
        background: rgba(16, 12, 10, 0.90);
        border: 1px solid rgba(232, 169, 88, 0.34);
        border-radius: 10px; padding: 10px;
        backdrop-filter: blur(14px); z-index: 30; pointer-events: auto;
      }
      .hud-bottom.open { display: flex; }
      .hud-bottom .btn-group {
        background: transparent; border: none; padding: 0; backdrop-filter: none;
        display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
      }
      .hud-btn { padding: 9px 8px; font-size: 12px; text-align: center; }
    }
  </style>
</head>
<body>
  <canvas id="mars-canvas"></canvas>
  <div id="eva-visor"></div>

  <div id="district-toast">
    <div id="toast-kicker">STARBASE ARCADIA</div>
    <div id="toast-title">파운더스 리지 전망대</div>
  </div>

  <div id="intro-overlay">
    <img id="intro-logo" src="${LOGO_URI}" alt="MUSKPUNK 2065" draggable="false" />
    <div class="intro-dystopia">
      <h1 class="intro-quote">He gave us Mars. <span class="air-accent">He owns the air.</span></h1>
      <div class="intro-terms">Welcome to Mars. Terms apply.</div>
    </div>
    <div class="intro-actions">
      <button id="btn-start">Accept Terms &amp; Breathe</button>
      <span class="intro-fineprint">O₂ Metering Active · Arcadia Colony Corp.</span>
    </div>
  </div>

  <!-- Mobile Multi-Touch Driving & Flight Controls -->
  <div id="mobile-controls">
    <div id="touch-stick-zone">
      <div id="touch-stick-base">
        <div id="touch-stick-knob"></div>
      </div>
    </div>
    <div id="touch-action-pad">
      <div class="touch-pad-spacer"></div>
      <button id="touch-btn-cam" class="touch-circle-btn" aria-label="시점 변경">시점</button>
      <button id="touch-btn-mount" class="touch-circle-btn" aria-label="하차/탑승">하차</button>
      <button id="touch-btn-boost" class="touch-circle-btn" aria-label="로켓 부스터">
        <span class="t-sub">ROCKET</span>
        <span class="t-main">BOOST</span>
      </button>
      <button id="touch-btn-descend" class="touch-circle-btn" aria-label="콜드-가스 하강">
        <span class="t-sub">RETRO</span>
        <span class="t-main">하강</span>
      </button>
      <button id="touch-btn-lift" class="touch-circle-btn" aria-label="콜드-가스 상승">
        <span id="touch-lift-sub" class="t-sub">COLD-GAS</span>
        <span id="touch-lift-label" class="t-main">상승</span>
      </button>
    </div>
  </div>

  <div id="hud-root" class="hud-hidden">
    <div class="hud-top">
      <div class="hud-bar">
        <span id="hud-env" class="pill pill-cabin">ROADSTER ROCKET-M · 0.38G MARS OPEN-WORLD</span>
        <span class="sep">|</span>
        <span id="mob-speed">0 km/h · 0m</span>
        <span id="hud-coords">X:2m Z:-4m ALT:+18m</span>
        <span class="sep hud-sep-desk">|</span>
        <span id="hud-sky">화성 푸른 노을 (Mie Scattering)</span>
      </div>
      <div id="hud-desktop-right" class="hud-bar">
        <span id="hud-port">MEGAPORT: STANDBY</span>
      </div>
      <button id="btn-mobile-menu">지도 · 메뉴 ▾</button>
    </div>

    <!-- GTA Rotating Circular Tactical Radar Minimap -->
    <div id="minimap-wrap">
      <canvas id="gta-minimap" width="176" height="176"></canvas>
    </div>

    <!-- Sleek Roadster Speedometer + Altitude + Vertical Speed + COPV N2/CO2 Thruster Gauge -->
    <div id="vehicle-hud">
      <div class="vh-top">
        <div><span id="veh-speed" class="vh-speed">0</span><span class="vh-unit">KM/H</span></div>
        <div class="vh-alt-col">
          <div class="vh-alt">ALT <span id="veh-alt">0m</span></div>
          <div id="veh-vspeed" class="vh-vspeed">V/S 0.0 m/s</div>
        </div>
      </div>
      <div id="veh-mode" class="vh-mode">0.38G GROUND DRIVE</div>
      <div class="copv-row"><span>N₂/CO₂ COPV</span><span id="copv-pct">100%</span></div>
      <div class="copv-track"><div id="copv-bar-fill"></div></div>
    </div>

    <div class="hud-hint">WASD 주행 · SPACE 상승 · Q / Ctrl / X 하강 · SHIFT 부스터 · F 하차/탑승 · C 시점 · E 카페 · B 바이오돔 · 1~6 빠른이동</div>

    <div id="hud-drawer" class="hud-bottom">
      <div class="btn-group">
        <button class="hud-btn vp-btn active">1. 파운더스 리지</button>
        <button class="hud-btn vp-btn">2. 거상 공중관람</button>
        <button class="hud-btn vp-btn">3. 레드 캐니언</button>
        <button class="hud-btn vp-btn">4. 스타십 살룬</button>
        <button class="hud-btn vp-btn">5. 빙하 채굴장</button>
        <button class="hud-btn vp-btn">6. 메가포트</button>
      </div>
      <div class="btn-group">
        <button id="btn-mount" class="hud-btn">하차(F)</button>
        <button id="btn-cam" class="hud-btn">시점(C)</button>
        <button id="btn-airlock" class="hud-btn">카페(E)</button>
        <button id="btn-biodome" class="hud-btn">바이오돔(B)</button>
        <button id="btn-launch" class="hud-btn">발사(L)</button>
        <button id="btn-sky" class="hud-btn">시간(V)</button>
        <button id="btn-dust" class="hud-btn">폭풍(G)</button>
        <button id="btn-mute" class="hud-btn">음성(M)</button>
        <button id="btn-touchpad" class="hud-btn">터치패드</button>
      </div>
    </div>
  </div>

  <script>
${bundle}
  </script>
</body>
</html>`;

const outPath = '/home/antigravity/arcadia-3d/dist/arcadia_mars_3d_prototype.html';
fs.writeFileSync(outPath, html, 'utf8');
console.log('Built standalone HTML:', outPath, (Buffer.byteLength(html) / 1024).toFixed(1), 'KB');
