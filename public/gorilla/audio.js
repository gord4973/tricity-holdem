// GORILLA - original synthesized sounds (WebAudio, no samples). window.GorillaAudio
(function () {
  let ctx = null, master = null, muted = localStorage.getItem('gorillaMute') === '1', noiseBuf = null;
  function init() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .8; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return true; }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function osc(type, f0, f1, t, dur, peak, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .005, peak, dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + .05); return o; }
  function noise(t, dur, peak, type, freq, q, dest) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1; env(g, t, .005, peak, dur); s.connect(f); f.connect(g); g.connect(dest || master); s.start(t, Math.random()); s.stop(t + dur + .05); return { s, f, g }; }
  const S = {
    click() { const t = now(); osc('square', 1800, 900, t, .04, .08); },
    spin() { const t = now(); const n = noise(t, .5, .25, 'bandpass', 400, 2); n.f.frequency.exponentialRampToValueAtTime(2400, t + .45); osc('sine', 90, 50, t, .2, .4); },
    reelStop(i) { const t = now(); osc('sine', 150 - i * 15, 45, t, .16, .7); noise(t, .06, .3, 'lowpass', 1800); osc('triangle', 600, 300, t, .05, .12); },
    drum(i = 0) { const t = now(); osc('sine', 180 + i * 30, 55, t, .45, .9); noise(t, .12, .35, 'bandpass', 220, 3); osc('sine', 330 + i * 40, 160, t, .18, .25); },
    beat() { const t = now(); osc('sine', 110, 48, t, .22, .85); noise(t, .08, .3, 'lowpass', 500); },
    roar(dur = 1.8) { const t = now(); const sh = ctx.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 6); } sh.curve = c; const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9, t + .18); g.gain.setValueAtTime(.8, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur); sh.connect(g); g.connect(master);
      for (const [f, d] of [[62, 0], [93, 7], [124, -5]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.3, t); o.frequency.exponentialRampToValueAtTime(f, t + .3); o.frequency.exponentialRampToValueAtTime(f * .8, t + dur); o.detune.value = d; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 23; lg.gain.value = f * .08; lfo.connect(lg); lg.connect(o.frequency); const og = ctx.createGain(); og.gain.value = .25; o.connect(og); og.connect(sh); o.start(t); o.stop(t + dur + .1); lfo.start(t); lfo.stop(t + dur + .1); }
      const n = noise(t, dur, .6, 'bandpass', 700, 1.2); n.f.frequency.setValueAtTime(1200, t); n.f.frequency.exponentialRampToValueAtTime(380, t + dur); },
    slam() { const t = now(); osc('sine', 75, 28, t, .9, 1); noise(t, .35, .9, 'lowpass', 2500); noise(t + .02, 1.2, .35, 'lowpass', 300); osc('square', 200, 40, t, .12, .2); },
    crack() { const t = now(); for (let i = 0; i < 5; i++) noise(t + i * .03, .05, .4, 'highpass', 2500 + i * 300); osc('triangle', 2400, 1200, t, .1, .15); },
    thunder() { const t = now(); noise(t, .2, .8, 'highpass', 900); const n = noise(t + .05, 2.6, .8, 'lowpass', 220, .7); n.f.frequency.exponentialRampToValueAtTime(70, t + 2.6); },
    bill() { const t = now(); const o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain(); o.type = 'square'; o.frequency.value = 95; am.frequency.value = 31; ag.gain.value = .05; am.connect(ag); ag.connect(g.gain); g.gain.value = .07; g.gain.setValueAtTime(.07, t + 1.1); g.gain.linearRampToValueAtTime(0, t + 1.25); const f = ctx.createBiquadFilter(); f.frequency.value = 900; o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.3); am.start(t); am.stop(t + 1.3); osc('sine', 880, 0, t + 1.3, .12, .15); osc('sine', 1320, 0, t + 1.42, .2, .15); },
    ticket() { const t = now(); for (let i = 0; i < 22; i++) { osc('square', 1400 + (i % 3) * 200, 0, t + i * .06, .03, .05); noise(t + i * .06, .04, .08, 'highpass', 3000); } },
    coin(i = 0) { const t = now(); const f = 1320 * Math.pow(1.06, i % 12); osc('sine', f, 0, t, .25, .18); osc('sine', f * 1.5, 0, t + .02, .3, .1); },
    tick() { const t = now(); osc('triangle', 2200, 0, t, .03, .06); },
    win(lv = 1) { const t = now(); const notes = [523, 659, 784, 1047, 1319, 1568]; for (let i = 0; i < 3 + lv; i++) { osc('triangle', notes[i % 6] * (i >= 6 ? 2 : 1), 0, t + i * .09, .35, .2); osc('sine', notes[i % 6] * 2, 0, t + i * .09, .2, .06); } },
    fanfare(lv = 1) { const t = now(); const seq = [392, 523, 659, 784, 659, 784, 1047]; seq.forEach((f, i) => { osc('sawtooth', f, 0, t + i * .14, .3, .12); osc('triangle', f / 2, 0, t + i * .14, .4, .15); }); for (let k = 0; k < lv * 4; k++) S.drum(k % 3); },
    wheelTick() { const t = now(); osc('square', 2600, 1800, t, .02, .07); },
    jackpot() { const t = now(); for (let i = 0; i < 16; i++) osc('triangle', 784 * Math.pow(2, (i % 8) / 12), 0, t + i * .1, .25, .15); S.thunder(); },
    whoosh() { const t = now(); const n = noise(t, .55, .3, 'bandpass', 300, 1.6); n.f.frequency.exponentialRampToValueAtTime(1800, t + .35); n.f.frequency.exponentialRampToValueAtTime(600, t + .55); osc('sine', 70, 40, t, .25, .35); },
    reelStop(i = 0) { const t = now(); osc('sine', 120 - i * 12, 38, t, .2, .85); noise(t, .05, .45, 'lowpass', 2600); noise(t + .01, .16, .18, 'bandpass', 900 - i * 120, 4); osc('triangle', 420 - i * 40, 210, t, .05, .1); },
    tease(dur = 1.8) { const t = now(); const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + dur);
      l.frequency.setValueAtTime(6, t); l.frequency.linearRampToValueAtTime(18, t + dur); lg.gain.value = .5; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .2); g.gain.setValueAtTime(.16, t + dur - .1); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .15); l.connect(lg); const am = ctx.createGain(); am.gain.value = .5; lg.connect(am.gain);
      o.connect(f); f.connect(am); am.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + dur + .2); l.stop(t + dur + .2); for (let i = 0; i < dur / .25; i++) S.drumSoft(t + i * .25 * Math.pow(.92, i), .25 + i * .04); },
    drumSoft(t, v = .3) { osc('sine', 140, 50, t, .25, v); noise(t, .06, v * .4, 'bandpass', 200, 2); },
    rattle() { const t = now(); for (let i = 0; i < 7; i++) { noise(t + i * .045, .03, .25 - i * .025, 'bandpass', 3200 + (i % 2) * 900, 6); osc('square', 900 + (i % 3) * 140, 0, t + i * .045, .02, .05); } },
    glint(i = 0) { const t = now(); const f = 2093 * Math.pow(1.06, i % 7); osc('sine', f, 0, t, .4, .08); osc('sine', f * 2.01, 0, t + .03, .3, .04); },
    sparkle() { const t = now(); for (let i = 0; i < 5; i++) osc('sine', 2600 + Math.random() * 2400, 0, t + i * .05, .18, .035); },
    deny() { const t = now(); osc('square', 220, 150, t, .25, .12); },
  };
  // ---- real recorded samples (gorilla roars, chest beats, slams) ----
  const raw = {}, buf = {}, decoding = {}; let ambient = null;
  function fetchSamples(map) { for (const k in map) if (!raw[k]) raw[k] = fetch(map[k]).then(r => { if (!r.ok) throw new Error(map[k] + ' ' + r.status); return r.arrayBuffer(); }).catch(e => { console.warn('sample', e); return null; }); }
  function decode(k) { if (buf[k]) return Promise.resolve(buf[k]); if (!ctx || !raw[k]) return Promise.resolve(null); return decoding[k] || (decoding[k] = raw[k].then(ab => ab ? new Promise((res) => ctx.decodeAudioData(ab.slice(0), b => { buf[k] = b; res(b); }, () => res(null))) : null)); }
  function sample(k, o = {}) { if (!ctx || muted) return null; const b = buf[k]; if (!b) { decode(k); return null; } const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.loop = !!o.loop; if (o.rate) s.playbackRate.value = o.rate; g.gain.value = o.gain != null ? o.gain : 1; s.connect(g); g.connect(master); s.start(now() + (o.delay || 0), Math.max(0, o.offset || 0)); return { src: s, stop: (fade = 0) => { try { if (fade) { g.gain.setTargetAtTime(0, now(), fade / 3); s.stop(now() + fade); } else s.stop(); } catch (e) {} }, g, dur: b.duration / (o.rate || 1) }; }
  let breathT = 0, duckUntil = 0, lastB = '';
  const BREATHS = [['br1', 3], ['br2', 3], ['br3', 2], ['br4', 2], ['br5', 2], ['br6', 3], ['huff1', .7], ['huff2', .6], ['huff3', .6], ['grunt1', .25], ['grunt2', .3]];
  function pickBreath() { const av = BREATHS.filter(([k]) => buf[k] && k !== lastB); if (!av.length) { BREATHS.forEach(([k]) => raw[k] && decode(k)); return null; } let r = Math.random() * av.reduce((a, b) => a + b[1], 0); for (const [k, w] of av) if ((r -= w) <= 0) return k; return av[0][0]; }
  function breathe(ms) { clearTimeout(breathT); breathT = setTimeout(() => { if (!window.__gorillaAmbient || muted || !ctx) return; if (document.hidden || performance.now() < duckUntil) return breathe(900 + Math.random() * 900);
      const k = pickBreath(); if (k) { lastB = k; const grunt = /grunt|huff/.test(k); sample(k, { gain: (grunt ? .35 : .45) + Math.random() * (grunt ? .25 : .4), rate: .86 + Math.random() * .2 });
        if (!grunt && Math.random() < .35) setTimeout(() => { const k2 = pickBreath(); if (k2 && !/grunt/.test(k2) && performance.now() > duckUntil) sample(k2, { gain: .25 + Math.random() * .25, rate: .9 + Math.random() * .15 }); }, 700 + Math.random() * 600); }
      breathe(1700 + Math.random() * 3800 + (Math.random() < .2 ? 2500 + Math.random() * 3000 : 0)); }, ms); }
  window.GorillaAudio = { init: () => { const ok = init(); if (ok) { for (const k in raw) decode(k); if (window.__gorillaAmbient && !ambient && !muted) GorillaAudio.ambient(true); } return ok; }, fetchSamples, decode, sample, loaded: k => !!buf[k], rawLoaded: () => Promise.all(Object.values(raw)).then(a => a.filter(Boolean).length),
    // randomized breathing: one-shot breaths / huffs / grunts with random gaps, pitch and level (no loop), ducked while the gorilla's clips speak
    ambient(on) { window.__gorillaAmbient = on; clearTimeout(breathT); if (on && ctx && !muted) breathe(600); },
    duck(sec) { duckUntil = Math.max(duckUntil, performance.now() + sec * 1000); }, play(name, ...a) { if (!ctx || muted) return; try { S[name](...a); } catch (e) { console.warn(e); } }, get muted() { return muted; },
    setMuted(m) { muted = m; localStorage.setItem('gorillaMute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : .8; if (!m && window.__gorillaAmbient) GorillaAudio.ambient(true); if (m) clearTimeout(breathT); } };
})();
