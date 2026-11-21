/**
 * Procedural Martian WebAudio Synthesizer (zero external audio files!).
 * Models 70 kPa cabin hum, airlock cycling, 0.6 kPa EVA wind, Starship sub-bass rumble,
 * continuous Tesla Roadster Plaid electric drive whine, live cold-gas thruster jet roar,
 * and aerial stunt gate pass chimes.
 */
export function createMarsAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let cabinGain = null;
  let motorOsc = null;
  let motorOsc2 = null;
  let motorGain = null;
  let thrustGain = null;
  let thrustFilter = null;
  let muted = false;
  let started = false;
  let isOutside = true;

  function init() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);

    // Filtered brown/pink noise buffer for Mars wind & continuous cold-gas jets
    const bufLen = ctx.sampleRate * 3;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const out = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      out[i] = last * 3.2;
    }

    // Crisp white noise buffer for high-pressure supersonic N2/CO2 cold-gas thrusters
    const whiteBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const wout = whiteBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) wout[i] = (Math.random() * 2 - 1) * 0.45;

    // Outdoor 0.6 kPa Martian Wind
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 185;
    windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();

    // Indoor 70 kPa pressurized cabin life-support hum
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 62;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 124;
    const cabinFilter = ctx.createBiquadFilter();
    cabinFilter.type = 'lowpass';
    cabinFilter.frequency.value = 190;
    cabinGain = ctx.createGain();
    cabinGain.gain.value = 0.04;
    osc.connect(cabinFilter);
    osc2.connect(cabinFilter);
    cabinFilter.connect(cabinGain);
    cabinGain.connect(master);
    osc.start();
    osc2.start();

    // Tesla Roadster Plaid Continuous Electric Motor Whine (subtle high-tech sci-fi hum!)
    motorOsc = ctx.createOscillator();
    motorOsc.type = 'sine';
    motorOsc.frequency.value = 95;
    motorOsc2 = ctx.createOscillator();
    motorOsc2.type = 'triangle';
    motorOsc2.frequency.value = 190;
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'bandpass';
    motorFilter.frequency.value = 340;
    motorFilter.Q.value = 1.4;
    motorGain = ctx.createGain();
    motorGain.gain.value = 0.0001;
    motorOsc.connect(motorFilter);
    motorOsc2.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(master);
    motorOsc.start();
    motorOsc2.start();

    // Continuous Supersonic N2/CO2 Cold-Gas Thruster Jet Layer (for Roadster hover & boost!)
    const thrustSrc = ctx.createBufferSource();
    thrustSrc.buffer = whiteBuf;
    thrustSrc.loop = true;
    thrustFilter = ctx.createBiquadFilter();
    thrustFilter.type = 'bandpass';
    thrustFilter.frequency.value = 920;
    thrustFilter.Q.value = 0.85;
    thrustGain = ctx.createGain();
    thrustGain.gain.value = 0.0001;
    thrustSrc.connect(thrustFilter);
    thrustFilter.connect(thrustGain);
    thrustGain.connect(master);
    thrustSrc.start();

    started = true;
    setEnvironment(isOutside, false);
  }

  function setEnvironment(outside, dustStorm = false) {
    isOutside = outside;
    if (!started || !ctx) return;
    const now = ctx.currentTime;
    if (outside) {
      cabinGain.gain.setTargetAtTime(0.02, now, 0.35);
      windGain.gain.setTargetAtTime(dustStorm ? 0.36 : 0.13, now, 0.4);
      windFilter.frequency.setTargetAtTime(dustStorm ? 360 : 175, now, 0.4);
    } else {
      cabinGain.gain.setTargetAtTime(0.075, now, 0.35);
      windGain.gain.setTargetAtTime(dustStorm ? 0.06 : 0.015, now, 0.4);
      windFilter.frequency.setTargetAtTime(110, now, 0.4);
    }
  }

  function updateVehicleAudio(speedNorm, liftThrust, boostThrust, inVehicle, descentThrust = 0) {
    if (!started || !ctx || muted) return;
    const now = ctx.currentTime;
    if (!inVehicle) {
      motorGain.gain.setTargetAtTime(0.0001, now, 0.15);
      thrustGain.gain.setTargetAtTime(0.0001, now, 0.12);
      return;
    }
    const sp = Math.min(1.4, Math.max(0, speedNorm));
    motorOsc.frequency.setTargetAtTime(88 + sp * 290, now, 0.08);
    motorOsc2.frequency.setTargetAtTime(176 + sp * 580, now, 0.08);
    motorGain.gain.setTargetAtTime(0.018 + sp * 0.085, now, 0.08);

    const jet = Math.min(1, liftThrust * 0.72 + boostThrust * 0.95 + descentThrust * 0.68);
    thrustFilter.frequency.setTargetAtTime(750 + boostThrust * 650 + liftThrust * 240 + descentThrust * 920, now, 0.06);
    thrustGain.gain.setTargetAtTime(jet > 0.02 ? 0.04 + jet * 0.24 : 0.0001, now, 0.06);
  }

  function playGateChime(count = 1) {
    if (!started || !ctx || muted) return;
    const now = ctx.currentTime;
    const base = 523.25 * Math.pow(1.06, Math.min(count, 10));
    [base, base * 1.25, base * 1.5].forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + idx * 0.06);
      g.gain.setValueAtTime(0.001, now + idx * 0.06);
      g.gain.linearRampToValueAtTime(0.18, now + idx * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.42);
      o.connect(g);
      g.connect(master);
      o.start(now + idx * 0.06);
      o.stop(now + idx * 0.06 + 0.45);
    });
  }

  function playAirlockCycle() {
    if (!started || !ctx || muted) return;
    const now = ctx.currentTime;
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(115, now);
    thud.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    tg.gain.setValueAtTime(0.35, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    thud.connect(tg);
    tg.connect(master);
    thud.start(now);
    thud.stop(now + 0.26);

    const len = Math.floor(ctx.sampleRate * 1.0);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.45;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 1.8;
    filt.frequency.setValueAtTime(isOutside ? 2200 : 650, now + 0.12);
    filt.frequency.exponentialRampToValueAtTime(isOutside ? 420 : 2100, now + 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.24);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.02);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(now + 0.1);
  }

  function playStarshipRumble() {
    if (!started || !ctx || muted) return;
    const start = ctx.currentTime + 1.2;
    const len = Math.floor(ctx.sampleRate * 4.5);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      d[i] = last * 4.0;
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = isOutside ? 95 : 68;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(isOutside ? 0.55 : 0.22, start + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, start + 4.4);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(start);
  }

  function playColdGasBurst() {
    if (!started || !ctx || muted) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 1.1;
    filt.frequency.setValueAtTime(isOutside ? 950 : 480, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(isOutside ? 0.20 : 0.08, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(now);
  }

  let lastRcsTime = 0;
  function playRcsPuff(strength = 0.65) {
    if (!started || !ctx || muted) return;
    const now = ctx.currentTime;
    if (now - lastRcsTime < 0.16) return;
    lastRcsTime = now;
    const dur = 0.12 + strength * 0.06;
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.52;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.setValueAtTime(1650 + strength * 750, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11 * Math.min(1, strength), now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(now);
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.45, ctx.currentTime, 0.08);
    return muted;
  }

  return {
    init,
    setEnvironment,
    updateVehicleAudio,
    playGateChime,
    playAirlockCycle,
    playStarshipRumble,
    playColdGasBurst,
    playRcsPuff,
    toggleMute,
    isMuted: () => muted
  };
}
