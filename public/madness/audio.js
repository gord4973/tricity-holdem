// MITSUBISHI MADNESS - t120u RECORDED sound layer (CC0 recordings in /madness/sfx, AAC .m4a + .mp3 fallback, credits in madness-notes/audio-credits.md)
// on top of the original synthesized sounds, which remain the fallback for any clip that has not loaded / decoded yet.
// window.MadAudio.play(name, ...args); loops: engine() / hum() return handles with .set() / .stop().
(function () {
  let ctx = null, master = null, muted = localStorage.getItem('madMuteV2') === '1', noiseBuf = null, musicT = null;
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  function init() { if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); return true; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .8; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // t112u richer sound: a short generated "garage" reverb send + a soft-clip drive bus for engines
    try { const L = Math.round(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, L, ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < L; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3.2); }
      verb = ctx.createConvolver(); verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .22; verb.connect(vg); vg.connect(master);
      drive = ctx.createWaveShaper(); const cu = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cu[i] = Math.tanh(x * 3.2) * .8; } drive.curve = cu; drive.oversample = '2x'; const dg = ctx.createGain(); dg.gain.value = .9; drive.connect(dg); dg.connect(master); dg.connect(verb); } catch (e) { verb = null; drive = null; }
    return true; }
  let verb = null, drive = null; const diag = { unlocks: 0, plays: 0, last: '', media: 'none' };
  // iOS: playing a (silent) HTML media element inside the first gesture moves Safari onto the media/playback audio path, so
  // WebAudio is not silenced by the ring/silent switch on older iOS (17+ also gets navigator.audioSession = 'playback' above).
  let silentEl = null; function mediaUnlock() { if (silentEl) return; try { silentEl = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='); silentEl.playsInline = true; silentEl.setAttribute('playsinline', ''); silentEl.loop = false; silentEl.volume = 0.01;
      const pr = silentEl.play(); pr && pr.then(() => diag.media = 'ok').catch(() => diag.media = 'blocked'); } catch (e) { diag.media = 'error'; } }
  const unlock = () => { init(); mediaUnlock(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); if (ctx) { diag.unlocks++; try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {} } };
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function osc(type, f0, f1, t, dur, peak, dest, a = .005) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, a, peak, dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + a + dur + .05); return o; }
  function noise(t, dur, peak, type, freq, q, dest, a = .005) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1; env(g, t, a, peak, dur); s.connect(f); f.connect(g); g.connect(dest || master); s.start(t, Math.random()); s.stop(t + a + dur + .05); return { s, f, g }; }
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const chord = (notes, t, dur, peak, type = 'triangle') => notes.forEach((n, i) => osc(type, N(n), 0, t + i * .0, dur, peak));
  const arp = (notes, t, step, dur, peak, type = 'square') => notes.forEach((n, i) => osc(type, N(n), 0, t + i * step, dur, peak));
  const S = {
    click() { osc('square', 1800, 900, now(), .04, .07); },
    spin() { const t = now(), n = noise(t, .45, .22, 'bandpass', 500, 2); n.f.frequency.exponentialRampToValueAtTime(3000, t + .4); osc('sawtooth', 70, 160, t, .35, .12); },
    reelStop(i = 0) { const t = now(); osc('sine', 120 - i * 6, 42, t, .16, .32); osc('square', 180 - i * 12, 60, t, .06, .12); noise(t, .05, .22, 'lowpass', 1600); if (verb) noise(t, .08, .06, 'bandpass', 900, 2, verb); },
    tick() { osc('square', 2400, 0, now(), .02, .04); },
    win(n = 0) { const t = now(); arp([72, 76, 79, 84].map(x => x + (n % 3) * 2), t, .07, .18, .1, 'triangle'); },
    bigWin() { const t = now(); arp([60, 64, 67, 72, 76, 79, 84], t, .09, .4, .12, 'square'); chord([72, 76, 79], t + .7, 1.2, .1, 'sawtooth'); noise(t + .65, .9, .12, 'highpass', 5000); },
    fanfare() { const t = now(); [[67, 0], [67, .12], [67, .24], [72, .4], [76, .7], [79, .9]].forEach(([n, d]) => { osc('sawtooth', N(n), 0, t + d, .3, .1); osc('square', N(n - 12), 0, t + d, .3, .06); }); chord([72, 76, 79, 84], t + 1.1, 1.4, .09, 'sawtooth'); },
    coin(i = 0) { const t = now(), f = 1600 + (i % 7) * 140; osc('square', f, 0, t, .06, .07); osc('square', f * 1.5, 0, t + .06, .12, .06); },
    revOld(len = 1.2) { const t = now(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 6;
      o.frequency.setValueAtTime(45, t); o.frequency.exponentialRampToValueAtTime(190, t + len * .55); o.frequency.exponentialRampToValueAtTime(120, t + len * .7); o.frequency.exponentialRampToValueAtTime(230, t + len); o2.frequency.setValueAtTime(22, t); o2.frequency.exponentialRampToValueAtTime(115, t + len);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + len); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .08); g.gain.setValueAtTime(.35, t + len - .1); g.gain.exponentialRampToValueAtTime(.0001, t + len + .25);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + len + .3); o2.stop(t + len + .3); },
    rev(len = 1.2) { const t = now(), out = drive || master, g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3800, t + len * .55); f.frequency.exponentialRampToValueAtTime(700, t + len);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .06); g.gain.setValueAtTime(.22, t + len * .7); g.gain.exponentialRampToValueAtTime(.0001, t + len); f.connect(g); g.connect(out);
      [[1, 'sawtooth', .5], [2, 'square', .25], [.5, 'sawtooth', .6], [3.01, 'sawtooth', .12]].forEach(([h, ty, a]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; og.gain.value = a; o.frequency.setValueAtTime(42 * h, t); o.frequency.exponentialRampToValueAtTime(190 * h, t + len * .55); o.frequency.exponentialRampToValueAtTime(70 * h, t + len); o.connect(og); og.connect(f); o.start(t); o.stop(t + len + .05); });
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.setValueAtTime(18, t); lfo.frequency.exponentialRampToValueAtTime(60, t + len * .55); lg.gain.value = .1; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + len + .05);
      if (len > .9) setTimeout(() => S.blowoff(), len * 620); },
    blowoff() { const t = now(), n = noise(t, .38, .22, 'bandpass', 5200, 4, verb ? null : null); n.f.frequency.exponentialRampToValueAtTime(900, t + .35); if (verb) { const n2 = noise(t, .3, .08, 'highpass', 6000, 1, verb); } osc('sine', 2600, 700, t, .18, .03); },
    screech(len = .9) { const t = now(); [2500, 2950].forEach((fq, i) => { const n = noise(t, len, .16, 'bandpass', fq, 18); n.f.frequency.setValueAtTime(fq, t); n.f.frequency.linearRampToValueAtTime(fq * .78, t + len); });
      const o = ctx.createOscillator(), g = ctx.createGain(), m = ctx.createOscillator(), mg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 2200; m.frequency.value = 23; mg.gain.value = 140; m.connect(mg); mg.connect(o.frequency); env(g, t, .02, .05, len); o.connect(g); g.connect(master); if (verb) g.connect(verb); o.start(t); m.start(t); o.stop(t + len + .1); m.stop(t + len + .1); },
    screechOld(len = .9) { const t = now(), n = noise(t, len, .2, 'bandpass', 2600, 12); n.f.frequency.linearRampToValueAtTime(1800, t + len); osc('sine', 2100, 1500, t, len, .03); },
    turbo() { const t = now(); osc('sine', 900, 4200, t, .7, .08, null, .2); const n = noise(t + .7, .35, .25, 'highpass', 3000); },
    whoosh() { const t = now(), n = noise(t, .5, .3, 'bandpass', 300, 1.5); n.f.frequency.exponentialRampToValueAtTime(4000, t + .45); },
    zap(i = 0) { const t = now(); for (let k = 0; k < 3; k++) osc('sawtooth', 2000 + Math.random() * 3000, 200, t + k * .025, .05, .08); noise(t, .12, .18, 'highpass', 4000 + i * 200); },
    plug() { const t = now(); osc('square', 140, 60, t, .09, .3); noise(t, .06, .3, 'lowpass', 800); osc('sine', 600, 1800, t + .12, .4, .1); },
    surge() { const t = now(); for (let k = 0; k < 10; k++) noise(t + k * .04, .05, .3, 'bandpass', 1000 + Math.random() * 5000, 3); osc('sawtooth', 900, 40, t + .1, .9, .25); osc('square', 60, 30, t + .1, .9, .2); },
    full() { const t = now(); osc('sine', 300, 2400, t, .8, .15, null, .1); S.fanfare(); for (let k = 0; k < 6; k++) setTimeout(() => S.zap(k), 900 + k * 120); },
    flag(i = 0) { const t = now(); noise(t, .08, .3, 'bandpass', 1200 + i * 300, 3); osc('triangle', N(76 + i * 4), 0, t, .25, .12); osc('triangle', N(83 + i * 4), 0, t + .08, .3, .1); },
    tease() { const t = now(); for (let k = 0; k < 8; k++) osc('triangle', N(64 + k), 0, t + k * .16, .14, .06); },
    lights(i = 0) { osc('square', i < 3 ? 440 : 880, 0, now(), i < 3 ? .25 : .7, .14); },
    horn() { const t = now(); osc('sawtooth', 392, 0, t, .5, .1, null, .02); osc('sawtooth', 494, 0, t, .5, .08, null, .02); },
    crowd(len = 2.5) { const t = now(), n = noise(t, len, .14, 'bandpass', 1100, .7, null, .5); },
    crack() { const t = now(); noise(t, .2, .5, 'highpass', 1500); osc('square', 90, 40, t, .2, .3); },
    unlock() { const t = now(); S.crack(); arp([72, 79, 84, 91], t + .1, .06, .2, .1, 'square'); },
    wheelTick() { osc('square', 1300, 600, now(), .03, .06); },
    deny() { const t = now(); osc('square', 220, 0, t, .12, .12); osc('square', 165, 0, t + .14, .2, .12); },
    bill() { const t = now(); for (let k = 0; k < 8; k++) osc('square', 90 + k * 6, 0, t + k * .1, .08, .07); },
    ticket() { const t = now(); for (let k = 0; k < 14; k++) noise(t + k * .07, .05, .1, 'bandpass', 2600, 4); },
    sparkle() { const t = now(); for (let k = 0; k < 5; k++) osc('sine', 2000 + Math.random() * 2500, 0, t + k * .05, .12, .04); },
    mud() { const t = now(); noise(t, .6, .3, 'lowpass', 300, 2); osc('sawtooth', 60, 40, t, .6, .2); },
    stuck() { const t = now(); osc('sawtooth', 120, 50, t, .8, .2); noise(t, .8, .2, 'lowpass', 400); },
    pick() { const t = now(); osc('triangle', 660, 990, t, .1, .12); },
    gear() { const t = now(); osc('square', 300, 0, t, .05, .2); S.rev(.9); setTimeout(S.turbo, 800); },
  };
  // continuous engine for the race / drift (set(rpm 0..1))
  function engine() { if (!ctx || muted) return { set() {}, stop() {} }; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 4; f.frequency.value = 600; g.gain.value = .0001;
    o.frequency.value = 50; o2.frequency.value = 25; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); g.gain.exponentialRampToValueAtTime(.16, now() + .3);
    return { set(r) { const t = now(); o.frequency.setTargetAtTime(50 + r * 170, t, .08); o2.frequency.setTargetAtTime(25 + r * 85, t, .08); f.frequency.setTargetAtTime(500 + r * 2400, t, .08); }, stop() { if (this.s) return; this.s = 1; const t = now(); g.gain.setTargetAtTime(.0001, t, .15); o.stop(t + .8); o2.stop(t + .8); } }; }
  // charging hum (set(level 0..1))
  function hum() { if (!ctx || muted) return { set() {}, stop() {} }; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = 120; o2.frequency.value = 241; g.gain.value = .0001; o.connect(g); o2.connect(g); g.connect(master); o.start(); o2.start(); g.gain.exponentialRampToValueAtTime(.06, now() + .3);
    return { set(l) { const t = now(); o.frequency.setTargetAtTime(120 + l * 380, t, .1); o2.frequency.setTargetAtTime(241 + l * 760, t, .1); g.gain.setTargetAtTime(.05 + l * .05, t, .1); }, stop() { if (this.s) return; this.s = 1; const t = now(); g.gain.setTargetAtTime(.0001, t, .1); o.stop(t + .6); o2.stop(t + .6); } }; }
  // bonus music: a driving synth bassline + hats (quiet)
  function music(on) { clearInterval(musicT); musicT = null; if (!on || !ctx || muted) return; let step = 0; const bass = [40, 40, 52, 40, 43, 43, 55, 43, 38, 38, 50, 38, 45, 45, 47, 49];
    musicT = setInterval(() => { if (!ctx || muted) return; const t = now(); osc('sawtooth', N(bass[step % 16]), 0, t, .12, .05); if (step % 2) noise(t, .03, .04, 'highpass', 8000); if (step % 4 === 0) osc('sine', 110, 40, t, .12, .12); step++; }, 125); }

  // ================= t120u recorded samples =================
  const SFX_V = '1';
  // per-clip playback gain (clips are peak-normalised; transient / sparse clips get a lift, dense beds are pulled down)
  const GAIN = { applause: 1, beep: .45, beepGo: .55, bill: 1, blowoff: 1, boom: 1, burnout: .9, chaching: 1.1, cheer: .9, chime: 1, click: .8, coin: .9, coins: 1.2, crowd: .9, drift: 1, engineLoop: .55, engineLoop2: .6,
    engineStart: 1.2, fanfare: 1, fanfareBig: 1, fireworks: 1.6, gear: 1, gravel: .8, gravelHit: 1, horn: 1, humLoop: .45, impact: .9, launch: 1, limiter: .9, mud: 1.1, passby: .9, passby2: 1.1, passby3: 1, plug: 1.3,
    powerUp: 1.1, rallyStart: .9, reelSpin: 1, reelStop: 1, reelStopHeavy: .9, rev: 1, rev2: 1, screech: .85, screechShort: .85, spark: 1, sparks: 1.3, surge: 1, tada: 1, tick: .8, ticket: .9, turbo: 1.4, unlock: 1.3, zap: 1, plugIn: 1.1,
    wheelSpin: 1.3, whoosh: .9, whoosh2: 1 };
  const ALL = Object.keys(GAIN);
  // loaded right after the first tap (what a base spin needs); everything else streams in afterwards, a few at a time
  const CORE = ['reelSpin', 'reelStop', 'reelStopHeavy', 'click', 'tick', 'coin', 'coins', 'whoosh', 'rev', 'rev2', 'screechShort', 'limiter', 'engineLoop', 'chaching', 'drift', 'turbo', 'fanfare', 'crowd', 'fireworks', 'impact', 'whoosh2', 'horn', 'chime', 'spark', 'plug', 'plugIn'];
  const buf = {}, loading = {}; let sbus = null, preloaded = false;
  Object.assign(diag, { total: ALL.length, loaded: 0, failed: [], errors: [], fmt: {}, http: {}, samples: 0 });
  const canAAC = (() => { try { const a = document.createElement('audio'); return !!(a.canPlayType && a.canPlayType('audio/mp4; codecs="mp4a.40.2"').replace(/no/, '')); } catch (e) { return false; } })();
  function decode(ab) { return new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } }); }
  function load(n) { if (buf[n]) return Promise.resolve(buf[n]); if (loading[n]) return loading[n];
    return loading[n] = (async () => { for (const ext of (canAAC ? ['m4a', 'mp3'] : ['mp3', 'm4a'])) { try { const r = await fetch(`/madness/sfx/${n}.${ext}?v=${SFX_V}`); diag.http[n + '.' + ext] = r.status; if (!r.ok) continue;
        const b = await decode(await r.arrayBuffer()); buf[n] = b; diag.loaded++; diag.fmt[n] = ext; return b; } catch (e) { diag.errors.push(n + '.' + ext + ': ' + ((e && e.message) || e)); } }
      diag.failed.push(n); return null; })(); }
  async function pool(list, k = 3) { const q = list.slice(); await Promise.all([...Array(k)].map(async () => { while (q.length) await load(q.shift()); })); }
  function preload() { if (preloaded || !ctx) return; preloaded = true; pool(CORE, 4).then(() => { const rest = ALL.filter(n => !CORE.includes(n)); const go = () => pool(rest, 2); (window.requestIdleCallback || (f => setTimeout(f, 800)))(go); }); }
  window.MadAudio_loadAll = () => { preloaded = true; return pool(ALL, 4); };
  function bus() { if (!sbus) { sbus = ctx.createGain(); sbus.gain.value = 1; sbus.connect(master); } return sbus; }
  // play one clip; returns the node pair, or null (and starts loading it) if it isn't decoded yet
  function smp(n, o = {}) { const b = buf[n]; if (!b) { load(n); return null; } const t = now() + (o.delay || 0), src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = o.rate || 1; src.loop = !!o.loop; g.gain.value = (GAIN[n] || 1) * (o.gain == null ? 1 : o.gain); src.connect(g); g.connect(bus()); if (o.verb && verb) { const vs = ctx.createGain(); vs.gain.value = o.verb; g.connect(vs); vs.connect(verb); }
    src.start(t, o.offset || 0); if (o.dur) { g.gain.setValueAtTime(g.gain.value, t + o.dur - .15); g.gain.linearRampToValueAtTime(0, t + o.dur); src.stop(t + o.dur + .05); } diag.samples++; return { src, g }; }
  const rnd = (a, b) => a + Math.random() * (b - a); let alt = 0;
  // event -> recorded clips. Return a truthy value when a clip played; otherwise the synth version plays.
  const R = {
    click: () => smp('click', { gain: .8 }),
    spin: () => smp('reelSpin', { gain: .8 }) && (smp('whoosh', { gain: .45 }), 1),
    reelStop: (i = 0, heavy) => smp(heavy ? 'reelStopHeavy' : 'reelStop', { rate: 1 - i * .03, verb: .15 }),
    tick: () => smp('tick', { gain: .5, rate: rnd(.95, 1.1) }),
    win: (n = 0) => { const r = smp('coins', { gain: .8, rate: 1 + (n % 3) * .05 }); if (r) S.win(n); return r; },
    bigWin: () => smp('chaching', { gain: .9 }) && (smp('crowd', { gain: .8, delay: .3 }), smp('fireworks', { gain: .9, delay: .5 }), smp('burnout', { gain: .55, delay: .1 }), 1),
    fanfare: () => smp('fanfare') && (smp('cheer', { gain: .5, delay: .4 }), 1),
    coin: (i = 0) => smp('coin', { gain: .7, rate: 1 + (i % 7) * .04 }),
    rev: (len = 1.2) => smp(len >= 1.3 ? 'rev' : 'rev2', { rate: rnd(.95, 1.05), verb: .2 }),
    blowoff: () => smp('blowoff'),
    screech: (len = .9) => smp(len >= .95 ? 'screech' : 'screechShort', { verb: .2 }),
    turbo: () => smp('turbo'),
    whoosh: () => smp((alt++ & 1) ? 'whoosh2' : 'whoosh'),
    zap: () => smp('zap', { rate: rnd(.85, 1.2) }) && (smp('spark', { gain: .6, rate: rnd(.9, 1.2) }), 1),
    plug: () => smp('plug') && (smp('powerUp', { gain: .6, delay: .25 }), 1),
    surge: () => smp('surge'),
    full: () => smp('chime') && (smp('powerUp', { gain: .6 }), smp('fanfareBig', { gain: .9, delay: .5 }), smp('applause', { gain: .7, delay: .9 }), smp('sparks', { gain: .5, delay: .2 }), 1),
    flag: (i = 0) => { const r = smp('impact', { gain: .35 + i * .15, rate: 1.3 + i * .15, dur: .6 }); smp('whoosh2', { gain: .35, rate: 1 + i * .08 }); S.flag(i); return r || 1; },
    tease: () => smp('limiter', { gain: .8 }),
    lights: (i = 0) => smp(i < 3 ? 'beep' : 'beepGo'),
    horn: () => smp('horn'),
    crowd: (len = 2.5) => smp(len > 4 ? 'cheer' : 'crowd', { gain: .8 }),
    crack: () => smp('impact', { gain: .7 }),
    unlock: () => { const r = smp('unlock'); if (r) arp([72, 79, 84, 91], now() + .1, .06, .2, .07, 'square'); return r; },
    wheelTick: () => smp('tick', { gain: .6, rate: 1.15 }),
    bill: () => smp('bill'),
    ticket: () => smp('ticket', { gain: .8 }),
    sparkle: () => { const r = smp('spark', { gain: .35, rate: rnd(1, 1.3) }); S.sparkle(); return r || 1; },
    mud: () => smp('mud') && (smp('gravelHit', { gain: .5, delay: .1 }), 1),
    stuck: () => smp('limiter', { gain: .7, rate: .75 }) && (smp('mud', { gain: .6, delay: .3 }), 1),
    pick: () => { const r = smp('click', { gain: .7 }); S.pick(); return r || 1; },
    gear: () => smp('gear', { gain: .8 }) && (smp('rev2', { gain: .9, delay: .25 }), smp('turbo', { gain: .9, delay: .9 }), 1),
    // t127u 'lining up' on a reel stop: revs climb higher and louder with every reel in the chain, plus a rising tone; 5 in a row adds a crowd lift
    lineUp: (n = 2, rank = 0) => { const k = n - 2; const r = smp('reelStop', { gain: .8, rate: 1.05 + k * .05 }); if (!r) S.reelStop(n - 1); smp('rev2', { gain: .45 + k * .18, rate: .92 + k * .13, dur: .55 + k * .15, offset: .2 });
      const t = now(); osc('triangle', N(67 + k * 4 + Math.min(rank, 6)), 0, t, .22 + k * .05, .09 + k * .02); osc('sine', N(79 + k * 4), 0, t + .06, .25, .05 + k * .015); if (n >= 4) smp('whoosh2', { gain: .4 }); if (n >= 5) smp('crowd', { gain: .5, dur: 1.4 }); return r || 1; },
    phLand: (n = 0) => smp('horn', { gain: .45, rate: 1.1 }) && (smp('chime', { gain: .35, rate: 1.2 }), 1),
    // t129u CHARGE plug lands: connector clunk snapping in + zap/crackle + rising power-up hum; the 2nd and 3rd plug zap harder and hum higher
    plugLand: (k = 1) => { k = Math.max(1, Math.min(3, k)); const r = smp('plugIn', { gain: .8 + k * .12, rate: 1 + (k - 1) * .09 });
      if (k >= 2) smp('zap', { gain: .45 + (k - 2) * .3, rate: 1.05 + k * .08, delay: .08 }); if (k >= 3) { smp('sparks', { gain: .55, rate: 1.15, dur: 1.1, delay: .05 }); smp('powerUp', { gain: .6, rate: 1.3, dur: 1.4, delay: .2 }); }
      if (!r) { const t = now(); osc('square', 180, 60, t, .06, .3); noise(t + .05, .25 + k * .05, .25 + k * .08, 'bandpass', 3200, 2); osc('sawtooth', 90 + k * 30, 260 + k * 120, t + .12, .9, .12 + k * .03); } return 1; },
    // recorded-only events (no synth version)
    passby: (g = 1) => smp(['passby', 'passby2', 'passby3'][Math.floor(Math.random() * 3)], { gain: g }),
    launch: (g = 1) => smp('launch', { gain: g, verb: .15 }),
    rallyStart: () => smp('rallyStart'),
    drift: () => smp('drift', { verb: .2 }),
    burnout: () => smp('burnout'),
    fireworks: () => smp('fireworks'),
    boom: () => smp('boom'),
    engineStart: () => smp('engineStart'),
    gravel: (dur = 1.5) => smp('gravel', { dur, offset: Math.random() * 3 }) && (smp('gravelHit', { gain: .6 }), 1),
    wheelSpin: () => smp('wheelSpin'),
    chaching: () => smp('chaching'),
  };
  addEventListener('pointerdown', () => { if (ctx) preload(); }, { passive: true }); addEventListener('touchend', () => { if (ctx) preload(); }, { passive: true }); addEventListener('click', () => { if (ctx) preload(); }, { passive: true });
  // continuous engine / charging hum: looped recordings (rate follows rpm / charge level), synth fallback until they load
  const engineSynth = engine, humSynth = hum;
  function loopHandle(n, base, rate0, rateK, gK) { const v = smp(n, { loop: true, gain: 0, rate: rate0 }); if (!v) return null; const t = now(); v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(GAIN[n] * base, t + .25);
    return { set(x) { const t = now(); v.src.playbackRate.setTargetAtTime(rate0 + x * rateK, t, .08); v.g.gain.setTargetAtTime(GAIN[n] * (base + x * gK), t, .1); }, stop() { if (this.s) return; this.s = 1; const t = now(); v.g.gain.setTargetAtTime(0, t, .12); v.src.stop(t + .8); } }; }
  engine = function () { if (!ctx || muted) return { set() {}, stop() {} }; return loopHandle('engineLoop', .8, .7, 1.3, .4) || engineSynth(); };
  hum = function () { if (!ctx || muted) return { set() {}, stop() {} }; return loopHandle('humLoop', .7, .85, .5, .5) || humSynth(); };
  window.MadAudio = { init, unlock, music, engine, hum, state: () => ctx ? ctx.state : 'none', play(name, ...a) { if (!ctx || muted) return; try { if (!(R[name] && R[name](...a)) && S[name]) S[name](...a); diag.plays++; diag.last = name; (diag.log = diag.log || []).push(name); if (diag.log.length > 80) diag.log.shift(); } catch (e) { console.warn(e); } }, load, preload, loaded: () => Object.keys(buf), sfx: ALL, diag, get muted() { return muted; },
    setMuted(m) { muted = m; localStorage.setItem('madMuteV2', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : .8; if (m) music(false); }, names: [...new Set([...Object.keys(S), ...Object.keys(R)])] };
})();
