// MITSUBISHI MADNESS - t145u JACKPOT SHOWCASE. Each of the four jackpots takes over the whole machine and shows off its Mitsubishi:
//   RVR MINI (lvl 1) .. ECLIPSE MINOR (2) .. OUTLANDER MAJOR (3) .. PHEV GRAND (4, a multi-stage finale: thunder, PHEV charge surge, stadium crowd).
// lights go down -> spotlight -> the photo-real vehicle drives in / brakes with a burnout + horns -> NAME SLAM -> huge rolling total with
// coin / confetti / firework / car sounds -> big landing. Longer, louder and more layered at every tier. Tap = jump to the landing; tap again = close.
// MadJackpot.run(id, amount, {fmt, bet}) -> Promise.  The payout itself is decided elsewhere (math.js); this is presentation only.
(function () {
  const SPD = () => window.__madSpeed || 1, F = () => window.MadFX, A = () => window.MadAudio;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), eio = u => { u = clamp(u, 0, 1); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  // seconds (at normal speed). dark/spot: lights down / spotlight on; in..stop: the car drives in and brakes; slam: name slam; roll0..roll1: total counts up; close: auto close
  const CFG = {
    mini: { id: 'mini', car: 'rvr', name: 'RVR MINI', model: 'MITSUBISHI RVR', c: '#2ab4ff', c2: '#c6ecff', lvl: 1, T: { spot: 1.0, in: 1.5, stop: 3.3, slam: 3.5, roll0: 4.3, roll1: 8.3, close: 12.2 } },
    minor: { id: 'minor', car: 'ec', name: 'ECLIPSE MINOR', model: 'MITSUBISHI ECLIPSE CROSS', c: '#ff9a3a', c2: '#ffe2b8', lvl: 2, T: { spot: 1.3, in: 2.1, stop: 4.2, slam: 4.4, roll0: 5.4, roll1: 11.4, close: 16.4 } },
    major: { id: 'major', car: 'out', name: 'OUTLANDER MAJOR', model: 'MITSUBISHI OUTLANDER', c: '#5f8fff', c2: '#d0deff', lvl: 3, T: { spot: 1.8, in: 3.0, stop: 5.6, slam: 5.9, roll0: 7.2, roll1: 16.0, close: 22.0 } },
    grand: { id: 'grand', car: 'phev', name: 'PHEV GRAND', model: 'MITSUBISHI OUTLANDER PHEV', c: '#ffd84a', c2: '#fff6b8', lvl: 4, T: { charge0: 3.0, charge1: 8.6, spot: 9.0, in: 10.4, stop: 13.2, slam: 13.6, roll0: 15.4, roll1: 29.4, close: 37.0 } },
  };
  let el = null, cv = null, g = null, active = null;
  const $ = id => document.getElementById(id);
  function build() { if (el) return; el = document.createElement('div'); el.id = 'jp'; el.className = 'hidden';
    el.innerHTML = '<canvas id=jpCv></canvas><div id=jpTag>★ JACKPOT ★</div><div id=jpName><span></span><span></span></div><div id=jpModel></div><div id=jpAmt>0.00</div><div id=jpX></div><small id=jpTap>tap to continue</small>';
    document.getElementById('app').appendChild(el); cv = $('jpCv'); g = cv.getContext('2d'); }
  function run(id, amount, o = {}) { build(); if (active) active.end(); const C = CFG[id] || CFG.mini, T = C.T, L = C.lvl, fmt = o.fmt || (x => '$' + x.toFixed(2)), xb = o.bet ? amount / o.bet : 0;
    return new Promise(resolve => {
      const S = { t0: performance.now(), last: 0, parts: [], bolts: [], arcs: 0, flash: 0, shake: 0, landed: false, done: false, skipped: false, lockUntil: performance.now() + 700, km: 0, tick: 0, tickN: 0, hits: {}, lastCharge: -1, burn: 0 };
      const words = C.name.split(' '), nm = el.querySelectorAll('#jpName span'); nm[0].textContent = words[0]; nm[1].textContent = words.slice(1).join(' ');
      { const aw = $('app').getBoundingClientRect().width, fit = (txt, base) => Math.floor(Math.min(base, aw * .9 / (txt.length * .76))); nm[0].style.fontSize = fit(nm[0].textContent, aw / (L >= 4 ? 5.2 : 6.2)) + 'px'; nm[1].style.fontSize = fit(nm[1].textContent, aw / (L >= 4 ? 3.7 : 4.6)) + 'px'; }
      $('jpModel').textContent = C.model; $('jpAmt').textContent = fmt(0); $('jpX').textContent = xb ? (xb >= 10 ? Math.round(xb) : xb.toFixed(1)) + '× BET' : '';
      const r = $('app').getBoundingClientRect(); el.style.setProperty('--jpW', r.width + 'px'); el.style.setProperty('--jpC', C.c); el.style.setProperty('--jpC2', C.c2);
      el.className = 'lvl' + L + ' ' + id; void el.offsetWidth;
      window.__jackpot = { id, lvl: L, amount, phase: 'start', skipped: false, landed: false, done: false, start: S.t0, max: {}, log: [] };
      const J = window.__jackpot, play = (n, ...a) => { try { A().play(n, ...a); } catch (e) {} }, mark = p => { J.phase = p; J.log.push([p, Math.round((performance.now() - S.t0) / 10) / 100]); };
      const sp = () => SPD(), real = s => s * 1000 * sp();
      const burst = (x, y, n, col, sp0 = 6) => { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(1.5, sp0); S.parts.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: .08, s: rnd(2, 4), life: 1, decay: rnd(.012, .03), c: col }); } };
      const smoke = (x, y, n = 3, big = 1) => { for (let i = 0; i < n; i++) S.parts.push({ t: 'smoke', x: x + rnd(-10, 10), y: y + rnd(-5, 5), vx: rnd(-.2, 2.2) * big, vy: rnd(-1.1, -.2), s: rnd(10, 22) * big, life: 1, decay: rnd(.008, .016) }); };
      const bolt = (x0, y0, x1, y1, life = 1) => { const pts = [[x0, y0]]; const n = 9; for (let i = 1; i < n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u + rnd(-26, 26) * (1 - Math.abs(u - .5)), y0 + (y1 - y0) * u + rnd(-10, 10)]); } pts.push([x1, y1]); S.bolts.push({ pts, life }); };
      // ---- scripted events (each fires once at its time) ----
      const E = [], at = (t, fn) => E.push({ t, fn, done: false });
      at(0, () => { mark('dark'); play('jpDark', L); if (L >= 4) { play('jpThunder'); S.flash = 1; bolt(rnd(.2, .8) * cv.clientWidth, 0, cv.clientWidth * .5, cv.clientHeight * .62); } });
      if (L >= 4) { at(1.2, () => { play('jpThunder'); S.flash = 1; S.shake = 10; bolt(cv.clientWidth * .25, 0, cv.clientWidth * .4, cv.clientHeight * .6); bolt(cv.clientWidth * .8, 0, cv.clientWidth * .6, cv.clientHeight * .6); });
        at(2.2, () => { play('jpThunder'); S.flash = 1; S.shake = 14; bolt(cv.clientWidth * .5, 0, cv.clientWidth * .5, cv.clientHeight * .62); });
        at(T.charge0, () => { mark('charge'); play('jpCharge', 0); window.__jackpotCharge = 0; });
        at(T.charge1, () => { mark('surge'); S.km = 72; play('jpCharge', 1); S.flash = 1.4; S.shake = 18; burst(cv.clientWidth / 2, cv.clientHeight * .45, 90, '#9fe8ff', 10); try { F().coinBurst(innerWidth / 2, innerHeight * .45, 60); } catch (e) {} });
        at(T.charge1 + .15, () => play('jpCrowd')); }
      at(T.spot, () => { mark('spotlight'); play('jpSpot', L); S.flash = Math.max(S.flash, .3); });
      at(T.in, () => { mark('drive-in'); play('jpDrive', L); if (L >= 2) { try { F().fireworks(real(T.stop - T.in)); } catch (e) {} } });
      at(T.stop, () => { mark('brake'); play('jpStop', L); S.burn = 1; S.shake = 12; const W = cv.clientWidth, H = cv.clientHeight; smoke(W * .62, H * .66, 18, 1.6); burst(W * .6, H * .66, 20, '#ffb060'); });
      at(T.slam, () => { mark('slam'); J.slam = true; el.classList.add('slam'); play('jpSlam', L); S.flash = 1.2; S.shake = 18 + L * 3; const W = cv.clientWidth, H = cv.clientHeight;
        try { F().confetti(80 + L * 70); F().coinBurst(innerWidth / 2, innerHeight * .42, 50 + L * 25); if (L >= 3) F().fireworks(real(T.roll1 - T.slam + (L >= 4 ? 8 : 3))); else if (L === 2) F().fireworks(real(T.roll1 - T.slam)); } catch (e) {}
        burst(W / 2, H * .3, 60 + L * 25, C.c, 9); });
      at(T.roll0, () => { mark('rollup'); el.classList.add('roll'); play('rollStart', L - 1); try { F().coinRain(real(T.roll1 - T.roll0), 1 + L); } catch (e) {} });
      const pulses = L * 2 + 1; for (let k = 1; k <= pulses; k++) at(T.roll0 + (T.roll1 - T.roll0) * k / (pulses + 1), () => { if (S.landed) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); S.shake = 8 + L * 2; S.flash = .45; try { F().confetti(30 + L * 20); F().coinBurst(innerWidth * rnd(.2, .8), innerHeight * .5, 40); } catch (e) {} const W = cv.clientWidth, H = cv.clientHeight; burst(rnd(.2, .8) * W, H * rnd(.2, .5), 24, C.c2, 8); if (L >= 3) play('jpCrowd'); });
      const land = skipped => { if (S.landed) return; S.landed = true; S.skipped = !!skipped; J.skipped = !!skipped; J.landed = true; mark('landed'); $('jpAmt').textContent = fmt(amount); el.classList.add('roll', 'landed', 'slam'); play('jpLand', L); S.flash = 1.4; S.shake = 22;
        try { F().confetti(120 + L * 80); F().coinBurst(innerWidth / 2, innerHeight * .5, 90 + L * 40); F().fireworks(real(L >= 3 ? 7 : L === 2 ? 5 : 3.2)); } catch (e) {} const W = cv.clientWidth, H = cv.clientHeight; burst(W / 2, H * .7, 100, C.c, 11); S.landT = performance.now(); };
      at(T.roll1, () => land(false));
      // ---- teardown ----
      const end = () => { if (S.done) return; S.done = true; J.done = true; mark('done'); el.onclick = null; clearTimeout(S.safety); el.classList.add('out'); active = null; setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out', 'slam', 'roll', 'landed', 'hit'); try { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); } catch (e) {} resolve(true); }, 320); };
      active = { end }; el.classList.remove('hidden', 'out', 'slam', 'roll', 'landed', 'hit');
      // tap: first tap = jump to the landing (fanfare + total), tap again = close
      el.onclick = () => { if (performance.now() < S.lockUntil || S.done) return; if (!S.landed) { E.forEach(e => { if (e.t < T.roll1) e.done = true; }); E.forEach(e => { if (e.t === T.roll1) e.done = true; }); el.classList.add('slam'); J.slam = true; land(true); S.skipAt = performance.now(); } else end(); };
      S.safety = setTimeout(end, real(T.close) + 9000);
      // ---- frame ----
      const imgs = () => F() && F().cars;
      const frame = now => { if (S.done) return; requestAnimationFrame(frame); const r = cv.getBoundingClientRect(), d = Math.min(1.5, devicePixelRatio || 1), w = Math.max(10, Math.round(r.width * d)), h = Math.max(10, Math.round(r.height * d));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } const W = r.width, H = r.height; g.setTransform(d, 0, 0, d, 0, 0);
        const dt = Math.min(50, now - (S.last || now)); S.last = now; const fr = dt / 16.667, t = S.landed && S.skipped ? T.roll1 + (now - S.landT) / (1000 * sp()) : (now - S.t0) / (1000 * sp());
        for (const e of E) if (!e.done && t >= e.t) { e.done = true; try { e.fn(); } catch (er) { console.warn('jp event', er); } }
        if (S.landed && t >= (S.skipped ? T.roll1 + 2.6 : T.close)) { end(); return; }
        // total counts up (ease-in: the last seconds are a blur) with a tick that quickens and climbs in pitch
        if (t >= T.roll0 && !S.landed) { const u = clamp((t - T.roll0) / (T.roll1 - T.roll0), 0, 1), e2 = u * u * (1.6 - .6 * u); $('jpAmt').textContent = fmt(amount * Math.min(1, e2)); if (now - S.tick > 200 - 160 * u) { S.tick = now; S.tickN++; play('rollTick', u, L - 1, S.tickN); } J.rollU = u; }
        if (L >= 4 && t >= T.charge0 && t < T.charge1) { const p = clamp((t - T.charge0) / (T.charge1 - T.charge0), 0, 1); S.km = Math.round(72 * p); window.__jackpotCharge = S.km; if (Math.floor(p * 14) !== S.lastCharge) { S.lastCharge = Math.floor(p * 14); play('jpCharge', p); S.flash = Math.max(S.flash, .3); } }
        J.max.parts = Math.max(J.max.parts || 0, S.parts.length);
        // ================= draw =================
        const sh = S.shake; S.shake *= Math.pow(.9, fr); g.save(); if (sh > .3) g.translate(rnd(-sh, sh), rnd(-sh, sh) * .7);
        g.fillStyle = '#010208'; g.fillRect(-20, -20, W + 40, H + 40);
        const lit = L >= 4 ? ease((t - T.spot) / 1.2) : ease((t - T.spot) / 1.0), groundY = H * .66, cx = W / 2, cw = Math.min(W * .84, H * .54);
        // backdrop photo comes up with the lights (stadium / showroom)
        try { const ph = F().photo('bg-show'); if (ph && ph.complete && ph.naturalWidth && lit > .01) { g.globalAlpha = .55 * lit; F().cover(g, ph, W, H, { fy: .62 }); g.globalAlpha = 1; } } catch (e) {}
        const vg = g.createRadialGradient(cx, H * .55, H * .1, cx, H * .55, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(0,0,0,' + (.1 + (1 - lit) * .85) + ')'); vg.addColorStop(1, 'rgba(0,0,0,.88)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
        // spotlight cones (more of them every tier) + sweeping rays
        const cones = [[cx, 0]]; if (L >= 2) cones.push([W * .12, 0], [W * .88, 0]); if (L >= 3) cones.push([W * .3, 0], [W * .7, 0]); if (L >= 4) cones.push([W * .0, H * .1], [W, H * .1]);
        const on = clamp((t - T.spot) / .5, 0, 1); g.save(); g.globalCompositeOperation = 'lighter';
        cones.forEach(([sx, sy], i) => { const sway = Math.sin(t * (.9 + i * .31) + i) * W * (.05 + L * .012), tx = cx + sway + (i ? (i % 2 ? -1 : 1) * W * .12 : 0), a = on * (i ? .17 : .3) * (.85 + .15 * Math.sin(t * 7 + i)); if (a <= .01) return;
          const gr = g.createLinearGradient(sx, sy, tx, groundY); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 8, sy); g.lineTo(sx + 8, sy); g.lineTo(tx + cw * .52, groundY + 6); g.lineTo(tx - cw * .52, groundY + 6); g.closePath(); g.fill(); });
        if (L >= 3 && on > 0) for (let i = 0; i < 6 + L * 2; i++) { const a = t * .6 + i * (6.283 / (6 + L * 2)), x1 = cx + Math.cos(a) * W * 1.2, y1 = groundY - Math.abs(Math.sin(a)) * H * .8; g.strokeStyle = i % 2 ? C.c : C.c2; g.globalAlpha = .22 * on; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, groundY); g.lineTo(x1, y1); g.stroke(); } g.restore(); g.globalAlpha = 1;
        // stage / turntable
        if (on > 0) { g.save(); g.translate(cx, groundY + 4); const rx = cw * .66, ry = cw * .09; const gr = g.createRadialGradient(0, 0, 4, 0, 0, rx); gr.addColorStop(0, C.c2 + 'cc'); gr.addColorStop(.55, C.c + '55'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = on; g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
          g.lineWidth = 3; g.strokeStyle = C.c; g.shadowColor = C.c; g.shadowBlur = 16; g.setLineDash([14, 10]); g.lineDashOffset = -t * 60 * (1 + L * .4); g.beginPath(); g.ellipse(0, 0, rx * .9, ry * .9, 0, 0, 7); g.stroke(); g.setLineDash([]); g.shadowBlur = 0; g.restore(); }
        // PHEV charge surge (grand): orb + arcs + km gauge
        if (L >= 4 && t >= T.charge0 - .3 && t < T.charge1 + .5) { const p = clamp((t - T.charge0) / (T.charge1 - T.charge0), 0, 1), ox = cx, oy = H * .44, R = Math.min(W, H) * (.08 + .14 * p);
          g.save(); g.globalCompositeOperation = 'lighter'; const og = g.createRadialGradient(ox, oy, 0, ox, oy, R * 2.6); og.addColorStop(0, 'rgba(255,255,255,.95)'); og.addColorStop(.25, 'rgba(120,225,255,.75)'); og.addColorStop(1, 'rgba(0,120,255,0)'); g.fillStyle = og; g.beginPath(); g.arc(ox, oy, R * 2.6, 0, 7); g.fill();
          const n = 2 + Math.round(p * 7); g.strokeStyle = '#bff4ff'; g.shadowColor = '#22c3ff'; g.shadowBlur = 18; g.lineWidth = 2.5; for (let i = 0; i < n; i++) { const side = i % 3, sx = side === 0 ? 0 : side === 1 ? W : rnd(0, W), sy = side === 2 ? 0 : rnd(H * .05, H * .8); g.beginPath(); g.moveTo(sx, sy); let x = sx, y = sy; for (let k = 1; k <= 8; k++) { const u = k / 8; x = sx + (ox - sx) * u + rnd(-30, 30) * (1 - u); y = sy + (oy - sy) * u + rnd(-30, 30) * (1 - u); g.lineTo(x, y); } g.stroke(); }
          g.shadowBlur = 0; g.restore();
          const gr2 = Math.min(W, H) * .2; g.save(); g.translate(ox, oy); g.lineWidth = gr2 * .16; g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(0, 0, gr2, 0, 7); g.stroke(); g.strokeStyle = '#33e0ff'; g.shadowColor = '#33e0ff'; g.shadowBlur = 18; g.beginPath(); g.arc(0, 0, gr2, -Math.PI / 2, -Math.PI / 2 + p * 6.283); g.stroke(); g.shadowBlur = 0;
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 ${Math.round(gr2 * .62)}px Russo, sans-serif`; g.fillText(S.km, 0, -gr2 * .05); g.font = `400 ${Math.round(gr2 * .24)}px Russo, sans-serif`; g.fillStyle = '#9fe8ff'; g.fillText('km', 0, gr2 * .38); g.restore();
          g.fillStyle = '#9fe8ff'; g.textAlign = 'center'; g.font = `400 ${Math.round(Math.min(W * .06, 30))}px Russo, sans-serif`; g.fillText(p >= 1 ? 'FULL CHARGE!' : 'PHEV CHARGE SURGE', cx, H * .2); }
        // stadium crowd (grand)
        if (L >= 4 && t >= T.spot - .2) { const k = clamp((t - T.spot) / 1.2, 0, 1), n = Math.ceil(W / 15); for (let row = 0; row < 2; row++) { g.fillStyle = row ? '#05060c' : '#0a0c16'; for (let i = 0; i < n; i++) { const x = i * 15 + (row ? 7 : 0), y = H * (.90 - row * .035) + Math.sin(t * (4 + (i % 5)) + i) * 3 * (1 + (S.landed ? 1.5 : 0)) * k; g.beginPath(); g.arc(x, y - 18 * k, 6, 0, 7); g.fill(); g.fillRect(x - 6, y - 12 * k, 12, 40); if ((i + row) % 6 === 0 && Math.sin(t * 5 + i) > .85) { g.fillRect(x + 4, y - 38, 3, 20); } } }
          if (Math.random() < .5 * k) { g.fillStyle = '#fff'; g.save(); g.globalCompositeOperation = 'lighter'; const x = rnd(0, W), y = H * rnd(.78, .92); g.fillRect(x, y, 3, 3); const gl = g.createRadialGradient(x, y, 0, x, y, 12); gl.addColorStop(0, 'rgba(255,255,255,.9)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(x - 12, y - 12, 24, 24); g.restore(); } }
        // THE VEHICLE
        const tIn = clamp((t - T.in) / (T.stop - T.in), 0, 1);
        if (t >= T.in - .05) { const slide = ease(tIn), brake = t >= T.stop, tb = brake ? t - T.stop : 0;
          let x = cx + (1 - slide) * (W * .5 + cw * .7) + (brake ? Math.sin(tb * 9) * Math.exp(-tb * 3.2) * cw * .03 : 0); if (S.landed && S.skipped && !brake) x = cx;
          const y = groundY + Math.sin(t * 14) * (brake ? 1.2 : 2) * (tIn < 1 ? 1 : .5) - (brake ? Math.exp(-tb * 3) * 6 * Math.sin(tb * 12) : 0);
          const wspin = (tIn < 1 ? 1.2 : 0) + (S.burn && t < T.slam + 1.6 ? 1.2 : 0) + (S.landed ? .5 : 0); J.carX = x / W;
          // headlight beams
          if (t > T.in) { g.save(); g.globalCompositeOperation = 'lighter'; const bx = x - cw * .47, by = y - cw * .13, Lb = cw * (1.0 + .3 * Math.sin(t * 8)); const bg2 = g.createLinearGradient(bx, 0, bx - Lb, 0); bg2.addColorStop(0, 'rgba(255,252,225,.6)'); bg2.addColorStop(1, 'rgba(255,252,225,0)'); g.fillStyle = bg2; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(bx - Lb, by - cw * .2); g.lineTo(bx - Lb, by + cw * .16); g.lineTo(bx, by + 6); g.fill(); g.restore(); }
          // reflection
          g.save(); g.translate(0, groundY * 2 + 8); g.scale(1, -1); g.globalAlpha = .16 * on; try { F().drawCar(g, C.car, x, y, cw, {}); } catch (e) {} g.restore();
          // victory sway: after the slam the car rocks on its suspension, revs flames and bobs on the turntable (tier 3+ sways wider / revs more often)
          const sway = t > T.slam ? Math.sin((t - T.slam) * (1.4 + L * .25)) * (L >= 3 ? cw * .035 : cw * .012) : 0, tilt = t > T.slam ? Math.sin((t - T.slam) * 3.1) * (.008 + L * .004) : 0, sx = 1;
          g.save(); g.translate(x + sway, y); g.rotate(tilt); g.translate(-x - sway, -y); g.translate(sway, 0);
          try { F().drawCar(g, C.car, x, y, cw, { glow: C.c, track: S, wx: x, wspin, flame: (tIn < 1 || S.burn || (t > T.slam && Math.sin(t * 2.2) > .5)) ? .8 : 0 }); } catch (e) {} g.restore();
          if ((tIn < 1 && tIn > 0) || (S.burn && t < T.slam + 1.8)) { if (Math.random() < .7) smoke(x + cw * .3, y - 6, 2, 1.3); }
          if (t > T.slam && Math.random() < .3 * L) burst(x + rnd(-cw * .4, cw * .4), y - rnd(0, cw * .25), 2, C.c2, 4);
          if (t >= T.stop) { g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y - cw * .12, 0, x, y - cw * .12, cw * .8); gl.addColorStop(0, C.c + (S.landed ? '55' : '33')); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(x - cw, y - cw, cw * 2, cw * 1.2); g.restore(); } }
        // lightning
        for (let i = S.bolts.length - 1; i >= 0; i--) { const b = S.bolts[i]; b.life -= .06 * fr; if (b.life <= 0) { S.bolts.splice(i, 1); continue; } g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.strokeStyle = `rgba(120,200,255,${b.life})`; g.lineWidth = 8; g.shadowColor = '#22c3ff'; g.shadowBlur = 26; g.beginPath(); b.pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.strokeStyle = `rgba(255,255,255,${b.life})`; g.lineWidth = 3; g.stroke(); g.restore(); }
        // particles
        for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.x += p.vx * fr; p.y += p.vy * fr; p.vy += (p.g || 0) * fr; p.life -= p.decay * fr; if (p.life <= 0) { S.parts.splice(i, 1); continue; }
          if (p.t === 'smoke') { g.fillStyle = `rgba(215,215,225,${.34 * p.life})`; g.beginPath(); g.arc(p.x, p.y, p.s * (2 - p.life), 0, 7); g.fill(); } else { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p.life; g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); g.restore(); } }
        if (S.parts.length > 700) S.parts.splice(0, S.parts.length - 700);
        // chasing marquee lights round the whole screen (from the slam on)
        if (t >= T.slam) { const n = Math.floor((W + H) * 2 / 26), per = (W + H) * 2; g.save(); g.globalCompositeOperation = 'lighter'; const ph = Math.floor(now / (110 - L * 14));
          for (let i = 0; i < n; i++) { const d = i / n * per; let x, y; if (d < W) { x = d; y = 8; } else if (d < W + H) { x = W - 8; y = d - W; } else if (d < 2 * W + H) { x = W - (d - W - H); y = H - 8; } else { x = 8; y = H - (d - 2 * W - H); } const onb = (i + ph) % 4 === 0; g.fillStyle = onb ? (i % 8 < 4 ? C.c2 : C.c) : 'rgba(255,255,255,.12)'; g.shadowColor = onb ? C.c : 'transparent'; g.shadowBlur = onb ? 12 : 0; g.beginPath(); g.arc(x, y, onb ? 4 : 2.4, 0, 7); g.fill(); } g.restore(); }
        // letterbox bars while the lights are down
        const bar = H * .07 * (1 - clamp((t - T.slam) / .6, 0, 1)) * clamp(t / .5, 0, 1); g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
        g.restore();
        if (S.flash > .01) { g.fillStyle = `rgba(255,255,255,${Math.min(1, S.flash) * .85})`; g.fillRect(0, 0, W, H); S.flash *= Math.pow(.88, fr); }
      };
      requestAnimationFrame(frame);
    }); }
  window.MadJackpot = { run, CFG, get active() { return !!active; } };
})();
