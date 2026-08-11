let ctx = null;
let masterGain, sfxGain, musicGain;
let musicTimer = null;
let musicStep = 0;
let musicOn = false;

const state = { sfx: 0.8, music: 0.5, muted: false };

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = state.sfx;
  sfxGain.connect(masterGain);
  musicGain = ctx.createGain();
  musicGain.gain.value = state.music * 0.35;
  musicGain.connect(masterGain);
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c.state === "suspended") c.resume();
}

export function setVolumes({ sfx, music, muted }) {
  if (sfx !== undefined) state.sfx = sfx;
  if (music !== undefined) state.music = music;
  if (muted !== undefined) state.muted = muted;
  if (!ctx) return;
  sfxGain.gain.setTargetAtTime(state.muted ? 0 : state.sfx, ctx.currentTime, 0.05);
  musicGain.gain.setTargetAtTime(state.muted ? 0 : state.music * 0.35, ctx.currentTime, 0.05);
}

function osc(type, freq, t0, dur, gainPeak, dest, opts = {}) {
  const c = ensureContext();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.freqEnd !== undefined) {
    o.frequency.exponentialRampToValueAtTime(Math.max(opts.freqEnd, 1), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak, t0 + (opts.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  return o;
}

function noiseBurst(t0, dur, gainPeak, dest, opts = {}) {
  const c = ensureContext();
  const bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.filterType || "bandpass";
  filter.frequency.value = opts.filterFreq || 1200;
  if (opts.filterFreqEnd !== undefined) {
    filter.frequency.setValueAtTime(opts.filterFreq || 1200, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(opts.filterFreqEnd, 20), t0 + dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gainPeak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function safe(fn) {
  if (state.muted) return;
  try { ensureContext(); if (ctx.state === "suspended") ctx.resume(); fn(ctx.currentTime); } catch (e) { /* audio unavailable */ }
}

export function sfxShoot(spread = 0) {
  safe((t0) => {
    const f = 780 + Math.random() * 60 + spread * 40;
    osc("sawtooth", f, t0, 0.09, 0.09, sfxGain, { freqEnd: 260 });
  });
}

export function sfxExplosion(big = false) {
  safe((t0) => {
    noiseBurst(t0, big ? 0.5 : 0.28, big ? 0.5 : 0.32, sfxGain, { filterFreq: big ? 900 : 1400, filterFreqEnd: 90 });
    osc("sine", big ? 140 : 210, t0, big ? 0.42 : 0.22, big ? 0.45 : 0.3, sfxGain, { freqEnd: 40 });
  });
}

export function sfxPlayerHit() {
  safe((t0) => {
    noiseBurst(t0, 0.22, 0.35, sfxGain, { filterType: "lowpass", filterFreq: 2200, filterFreqEnd: 300 });
    osc("square", 160, t0, 0.2, 0.22, sfxGain, { freqEnd: 60 });
  });
}

export function sfxPickup() {
  safe((t0) => {
    osc("triangle", 660, t0, 0.09, 0.16, sfxGain);
    osc("triangle", 990, t0 + 0.06, 0.12, 0.14, sfxGain);
  });
}

export function sfxLevelUp() {
  safe((t0) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => osc("triangle", f, t0 + i * 0.075, 0.16, 0.16, sfxGain));
  });
}

export function sfxBomb() {
  safe((t0) => {
    osc("sawtooth", 90, t0, 0.55, 0.3, sfxGain, { freqEnd: 700, attack: 0.15 });
    noiseBurst(t0 + 0.1, 0.6, 0.4, sfxGain, { filterFreq: 1800, filterFreqEnd: 120 });
  });
}

export function sfxEnemyShoot() {
  safe((t0) => {
    osc("square", 340 + Math.random() * 40, t0, 0.1, 0.05, sfxGain, { freqEnd: 180 });
  });
}

export function sfxBossShot() {
  safe((t0) => {
    osc("sawtooth", 220, t0, 0.16, 0.1, sfxGain, { freqEnd: 90 });
  });
}

export function sfxBossAlarm() {
  safe((t0) => {
    for (let i = 0; i < 3; i++) {
      osc("square", 440, t0 + i * 0.22, 0.18, 0.12, sfxGain, { freqEnd: 660 });
    }
  });
}

export function sfxUiClick() {
  safe((t0) => osc("triangle", 520, t0, 0.05, 0.1, sfxGain));
}

export function sfxWaveClear() {
  safe((t0) => {
    [523.25, 783.99].forEach((f, i) => osc("triangle", f, t0 + i * 0.09, 0.22, 0.15, sfxGain));
  });
}

export function sfxGameOver() {
  safe((t0) => {
    [392, 349.23, 293.66, 220].forEach((f, i) => osc("sawtooth", f, t0 + i * 0.16, 0.3, 0.16, sfxGain));
  });
}

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

function scheduleMusicStep() {
  if (!musicOn || !ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const root = SCALE[musicStep % SCALE.length];
  const bar = Math.floor(musicStep / SCALE.length) % 2;
  const freq = bar === 0 ? root : root * 2;
  if (musicStep % 2 === 0) osc("sine", freq / 2, t0, 0.5, 0.05, musicGain, { attack: 0.05 });
  osc("triangle", freq, t0, 0.22, 0.045, musicGain, { attack: 0.02 });
  musicStep++;
  musicTimer = setTimeout(scheduleMusicStep, 260);
}

export function startMusic() {
  if (musicOn) return;
  ensureContext();
  if (ctx.state === "suspended") ctx.resume();
  musicOn = true;
  musicStep = 0;
  scheduleMusicStep();
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
}

export function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
}
