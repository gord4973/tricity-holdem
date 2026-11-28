// MITSUBISHI MADNESS - original synthesized sounds (WebAudio, no samples): engines, tyres, turbo, EV whine, charging, sparks, fanfares.
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
  window.MadAudio = { init, unlock, music, engine, hum, state: () => ctx ? ctx.state : 'none', play(name, ...a) { if (!ctx || muted) return; try { S[name](...a); diag.plays++; diag.last = name; } catch (e) { console.warn(e); } }, diag, get muted() { return muted; },
    setMuted(m) { muted = m; localStorage.setItem('madMuteV2', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : .8; if (m) music(false); }, names: Object.keys(S) };
})();
