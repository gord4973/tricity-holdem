// MITSUBISHI MADNESS - the TOP DISPLAY "show" (t117u): a photo-real night street-circuit with live photo-real Mitsubishis that reacts
// to everything the reels do. idle (cruisers, floodlights, start gantry) -> SPIN (gantry goes green, cars launch with speed lines,
// camera pushes in + shakes) -> each REEL STOP (headlight flash + tyre-smoke burst above that reel, camera bump) -> ANTICIPATION
// (gantry red, red vignette, camera zoom, engines rev) -> WIN (the winning model races in, brakes, flashes its lights, then dives
// down into the reels trailing light) -> BOOST gauge (Madness Meter) -> BONUS (full-cabinet checkered transition) / BIG WIN (fireworks).
// One canvas, DPR capped at 1.5, paused whenever a full-screen scene covers it, so it stays smooth on iPad Safari and the S21 Ultra.
(function () {
  const IMG = { RV: 'rvr', EC: 'eclipse-cross', OU: 'outlander', EV: 'eclipse-sportback', PH: 'outlander-phev' };
  const pics = {}; const pic = s => { let i = pics[s]; if (!i) { i = pics[s] = new Image(); i.decoding = 'async'; i.src = s; } return i; };
  const car = k => pic(`/madness/art/car-${IMG[k] || IMG.PH}.webp?v=1`); const bg = pic('/madness/photo/bg-show.webp?v=1');
  Object.keys(IMG).forEach(car);
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = u => 1 - Math.pow(1 - u, 3);
  const S = { cv: null, g: null, W: 0, H: 0, d: 1, last: 0, state: 'idle', cam: { z: 1.04, tz: 1.04, x: 0, tx: 0, sx: 0, sy: 0, kick: 0 },
    actors: [], parts: [], lines: [], flashes: [], gantry: { mode: 'off', t: 0 }, red: 0, tred: 0, speed: 0, tspeed: 0, meter: 0, tmeter: 0, boost: 0,
    hero: null, texts: [], fireworks: 0, tint: '', paused: false, attract: false, events: [], frames: 0, engine: null, mapCols: [] };
  const ev = (k, o) => { S.events.push(Object.assign({ k, at: Math.round(performance.now()) }, o || {})); if (S.events.length > 60) S.events.shift(); };
  function fit() { const cv = S.cv, r = cv.getBoundingClientRect(), d = Math.min(1.5, devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } S.W = r.width; S.H = r.height; S.d = d; S.rect = r; }
  // image -> canvas mapping for the background photo (cover + camera)
  function view() { const iw = bg.naturalWidth || 1280, ih = bg.naturalHeight || 720, W = S.W, H = S.H, c = S.cam; const sc = Math.max(W / iw, H / ih) * c.z;
    const dw = iw * sc, dh = ih * sc, ox = (W - dw) / 2 + c.x * W + c.sx, oy = (H - dh) * .62 + c.sy; return { sc, ox, oy, dw, dh, iw, ih }; }
  const at = (v, ix, iy) => [v.ox + ix * v.dw, v.oy + iy * v.dh];
  const laneY = (v, lane) => at(v, 0, lane ? .80 : .62)[1];
  // ---- actors ----
  function spawn(k, o = {}) { const a = Object.assign({ k, x: S.W + 40, lane: Math.random() < .5 ? 1 : 0, v: rnd(.05, .09), acc: 0, w: 0, flame: 0, beam: 1, smoke: 0, life: 1, born: performance.now() }, o); S.actors.push(a); return a; }
  function launchAll(n = 3) { for (let i = 0; i < n; i++) { const k = ['RV', 'EC', 'OU', 'EV', 'PH'][Math.floor(Math.random() * 5)]; spawn(k, { x: S.W + 30 + i * S.W * .35, lane: i % 2, v: .25, acc: .0028 + i * .0006, flame: 1 }); } }
  function puff(x, y, n = 10, col) { for (let i = 0; i < n; i++) S.parts.push({ t: 'smoke', x: x + rnd(-10, 10), y: y + rnd(-4, 4), vx: rnd(-.8, .8), vy: rnd(-1.4, -.3), s: rnd(8, 18), life: 1, decay: rnd(.012, .022), c: col }); }
  function sparks(x, y, n = 14, col = '#ffd84a') { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), sp = rnd(1.5, 5); S.parts.push({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, s: rnd(1.5, 3), life: 1, decay: rnd(.02, .04), c: col }); } }
  function firework() { const x = rnd(S.W * .1, S.W * .9), y = rnd(S.H * .08, S.H * .4), col = ['#ff2040', '#ffd84a', '#22c3ff', '#fff', '#30e060'][Math.floor(Math.random() * 5)];
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.28, sp = rnd(2, 4); S.parts.push({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: .05, s: 2.4, life: 1, decay: .016, c: col }); } }
  function drawCar(g, a, v) { const img = car(a.k); if (!img.complete || !img.naturalWidth) return; const scale = a.lane ? 1 : .72, base = a.w || Math.min(S.W * .34, S.H * 1.05);
    const w = base * scale * (a.scale || 1), h = w * img.naturalHeight / img.naturalWidth, y = (a.y != null ? a.y : laneY(v, a.lane)) - h * .92, x = a.x, fast = a.v > .2;
    // shadow
    g.save(); g.globalAlpha = .55; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + w / 2, y + h * .93, w * .48, h * .07, 0, 0, 7); g.fill(); g.restore();
    // headlight beam (cars face LEFT)
    if (a.beam) { const bx = x + w * .05, by = y + h * .45, L = w * (1.2 + (a.flash || 0)); const gr = g.createLinearGradient(bx, 0, bx - L, 0); gr.addColorStop(0, `rgba(255,250,220,${.55 + (a.flash || 0) * .4})`); gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.moveTo(bx, by - h * .04); g.lineTo(bx - L, by - h * .32); g.lineTo(bx - L, by + h * .42); g.lineTo(bx, by + h * .06); g.fill();
      g.fillStyle = `rgba(255,255,240,${.7 + (a.flash || 0) * .3})`; g.shadowColor = '#fff'; g.shadowBlur = 14 + (a.flash || 0) * 30; g.beginPath(); g.arc(bx + 2, by, h * (.05 + (a.flash || 0) * .05), 0, 7); g.fill(); g.restore(); }
    // motion ghosts
    if (fast) { g.save(); for (let i = 1; i <= 3; i++) { g.globalAlpha = .16 / i; g.drawImage(img, x + i * w * .06 * Math.min(2, a.v * 3), y, w, h); } g.restore(); }
    g.drawImage(img, x, y, w, h);
    // t130u wheels turn with the car's travel on screen (hero dive included); a.wspin adds wheelspin (launch/burnout)
    if (window.MadWheels) { const wa = MadWheels.step(a, x, y, w, a.wspin || 0); MadWheels.draw(g, img, x, y, w, h, wa, a.wo); }
    // tail lights + exhaust flame
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,30,40,.9)'; g.shadowColor = '#ff0020'; g.shadowBlur = 12; g.fillRect(x + w * .93, y + h * .32, w * .04, h * .07);
    if (a.flame) { const fl = (.6 + Math.random() * .4) * a.flame, fx = x + w * .97, fy = y + h * .78; const gr = g.createLinearGradient(fx, 0, fx + w * .25 * fl, 0); gr.addColorStop(0, 'rgba(120,180,255,.95)'); gr.addColorStop(.4, 'rgba(255,170,40,.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(fx, fy - h * .04); g.lineTo(fx + w * .25 * fl, fy); g.lineTo(fx, fy + h * .04); g.fill(); }
    g.restore();
    // light trail (hero dive)
    if (a.trail) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = a.trailC || '#ffd84a'; g.shadowColor = a.trailC || '#ffd84a'; g.shadowBlur = 18; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); a.trail.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore(); }
    a._box = { x, y, w, h }; }
  // ---- start gantry (5 lamp pairs) ----
  function drawGantry(g, now) { const n = 5, gw = Math.min(S.W * .42, 230 * S.k()), lw = gw / n, x0 = (S.W - gw) / 2, y0 = S.H * .43, r = lw * .22, m = S.gantry.mode, t = (now - S.gantry.t) / 1000;
    g.save(); g.fillStyle = 'rgba(10,10,14,.92)'; g.strokeStyle = '#3a3f52'; g.lineWidth = 1.5; rr(g, x0 - 6, y0 - r * 1.6, gw + 12, r * 3.2, 6); g.fill(); g.stroke();
    for (let i = 0; i < n; i++) { const cx = x0 + lw * (i + .5); let col = '#2a0c10', glow = 0;
      if (m === 'count') { if (t > i * .12) { col = '#ff2030'; glow = 1; } }
      else if (m === 'green') { col = '#2dff6a'; glow = Math.max(0, 1 - t * .8); if (glow <= 0) { col = '#0f3a1c'; } }
      else if (m === 'tease') { const on = Math.sin(now / 110) > 0; col = on ? '#ff2030' : '#4a0a10'; glow = on ? 1 : 0; }
      else if (m === 'win') { col = ['#ffd84a', '#ff2030', '#22c3ff'][(i + Math.floor(now / 140)) % 3]; glow = 1; }
      else if (S.attract) { col = (i === Math.floor(now / 220) % n) ? '#ffd84a' : '#2a1a10'; glow = col === '#ffd84a' ? 1 : 0; }
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = glow * 16; g.beginPath(); g.arc(cx, y0, r, 0, 7); g.fill(); }
    g.restore(); }
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // ---- BOOST gauge = Madness Meter ----
  function drawGauge(g, now) { const R = Math.min(S.H * .2, 46 * S.k()), cx = S.W - R - 8 * S.k(), cy = S.H - R * 1.05 - 24 * S.k(), p = S.meter, full = p >= .999;
    g.save(); const face = g.createRadialGradient(cx - R * .3, cy - R * .3, 2, cx, cy, R); face.addColorStop(0, '#2a2e3a'); face.addColorStop(1, '#07080c'); g.fillStyle = face; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    const ring = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); ring.addColorStop(0, '#f4f6fa'); ring.addColorStop(.5, '#6a7080'); ring.addColorStop(1, '#e0e4ea'); g.strokeStyle = ring; g.lineWidth = R * .12; g.stroke();
    const a0 = Math.PI * .75, a1 = Math.PI * 2.25; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; g.strokeStyle = i >= 8 ? '#ff2030' : '#cfd6e4'; g.lineWidth = i % 5 ? 1.2 : 2.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .72, cy + Math.sin(a) * R * .72); g.lineTo(cx + Math.cos(a) * R * .86, cy + Math.sin(a) * R * .86); g.stroke(); }
    g.strokeStyle = full ? `rgba(255,${80 + 80 * Math.sin(now / 90)},40,1)` : '#ff7a00'; g.lineWidth = R * .1; g.shadowColor = '#ff7a00'; g.shadowBlur = 10 + S.boost * 20; g.beginPath(); g.arc(cx, cy, R * .6, a0, a0 + (a1 - a0) * p); g.stroke(); g.shadowBlur = 0;
    const na = a0 + (a1 - a0) * clamp(p + (S.boost ? Math.sin(now / 40) * .02 : 0), 0, 1); g.strokeStyle = '#ff2030'; g.lineWidth = R * .06; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - Math.cos(na) * R * .15, cy - Math.sin(na) * R * .15); g.lineTo(cx + Math.cos(na) * R * .78, cy + Math.sin(na) * R * .78); g.stroke();
    g.fillStyle = '#ccd'; g.beginPath(); g.arc(cx, cy, R * .1, 0, 7); g.fill();
    g.fillStyle = full ? '#ff4a3a' : '#ffd84a'; g.font = `400 ${Math.round(R * .26)}px Russo,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(full ? 'FULL!' : Math.round(p * 100) + '%', cx, cy + R * .42);
    g.fillStyle = '#9aa3b8'; g.font = `800 italic ${Math.round(R * .2)}px Barlow,sans-serif`; g.fillText('BOOST', cx, cy - R * .32); g.restore(); }
  // ---- main loop ----
  function loop(now) { requestAnimationFrame(loop); if (!S.cv || document.hidden) return;
    const covered = S.paused || ['scene', 'wheelBox', 'splash'].some(id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); });
    if (covered) { S.last = now; return; } const dt = Math.min(50, now - (S.last || now)); S.last = now; if (dt < 12 && !window.__madShots) return; S.frames++;
    fit(); const g = S.g, W = S.W, H = S.H, c = S.cam; g.setTransform(S.d, 0, 0, S.d, 0, 0);
    // camera
    c.z += (c.tz - c.z) * Math.min(1, dt / 220); c.x += (c.tx + Math.sin(now / 7000) * .012 - c.x) * Math.min(1, dt / 600); c.kick *= Math.pow(.9, dt / 16);
    const shk = c.kick + S.speed * 1.2; c.sx = rnd(-shk, shk); c.sy = rnd(-shk, shk) * .7; S.speed += (S.tspeed - S.speed) * Math.min(1, dt / 300); S.red += (S.tred - S.red) * Math.min(1, dt / 200); S.meter += (S.tmeter - S.meter) * Math.min(1, dt / 400); S.boost *= Math.pow(.97, dt / 16);
    const v = view(); g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    if (bg.complete && bg.naturalWidth) { g.drawImage(bg, v.ox, v.oy, v.dw, v.dh);
      if (S.speed > .05) { g.save(); g.globalAlpha = Math.min(.5, S.speed * .5); for (let i = 1; i <= 2; i++) g.drawImage(bg, v.ox + i * 10 * S.speed, v.oy, v.dw, v.dh); g.restore(); } }
    // floodlight flares (image coords of the two stadium lights)
    g.save(); g.globalCompositeOperation = 'lighter'; [[.133, .265], [.815, .285]].forEach(([ix, iy], i) => { const [x, y] = at(v, ix, iy), f = .55 + .25 * Math.sin(now / 300 + i * 2) + S.boost * .5 + (S.flashAll || 0);
      const gr = g.createRadialGradient(x, y, 0, x, y, H * .5); gr.addColorStop(0, `rgba(255,255,240,${.5 * f})`); gr.addColorStop(.15, `rgba(200,220,255,${.18 * f})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - H * .5, y - H * .5, H, H); }); g.restore();
    // speed lines
    if (S.speed > .05) { if (S.lines.length < 40 * S.speed) S.lines.push({ x: -rnd(0, W * .5), y: rnd(H * .15, H * .95), l: rnd(40, 160), v: rnd(1.2, 2.4) }); g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = S.lines.length - 1; i >= 0; i--) { const L = S.lines[i]; L.x += L.v * dt * (1 + S.speed); if (L.x > W + 200) { S.lines.splice(i, 1); continue; } const gr = g.createLinearGradient(L.x - L.l, 0, L.x, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(220,235,255,${.55 * S.speed})`); g.fillStyle = gr; g.fillRect(L.x - L.l, L.y, L.l, 1.6); } g.restore(); }
    else S.lines.length = 0;
    // cruisers in idle / attract
    if (!S.hero && S.actors.length < (S.attract ? 3 : 2) && Math.random() < (S.attract ? .02 : .006) * dt / 16) spawn(['RV', 'EC', 'OU', 'EV', 'PH'][Math.floor(Math.random() * 5)]);
    S.actors.sort((a, b) => a.lane - b.lane);
    for (let i = S.actors.length - 1; i >= 0; i--) { const a = S.actors[i]; if (a.script) a.script(a, now, dt, v); else { a.v += a.acc * dt; a.x -= a.v * dt; } a.flash = Math.max(0, (a.flash || 0) - dt / 300);
      if (a.flame && !a.script) a.flame = Math.max(0, a.flame - dt / 1500); if (a.v > .3 && Math.random() < .3) puff(a.x + (a._box ? a._box.w : 80), laneY(v, a.lane) - 4, 1);
      if (a.dead || a.x < -W) { S.actors.splice(i, 1); continue; } }
    for (const a of S.actors) drawCar(g, a, v);
    // particles
    for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += (p.g || 0) * dt / 16; p.life -= p.decay * dt / 16; if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      if (p.t === 'smoke') { g.fillStyle = `rgba(${p.c || '210,210,220'},${.32 * p.life})`; g.beginPath(); g.arc(p.x, p.y, p.s * (2 - p.life), 0, 7); g.fill(); }
      else { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = p.c; g.globalAlpha = p.life; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); g.restore(); } }
    if (S.fireworks > now && Math.random() < .08 * dt / 16) firework();
    // headlight / reel-stop flashes on the bottom edge
    for (let i = S.flashes.length - 1; i >= 0; i--) { const f = S.flashes[i], u = (now - f.t0) / f.ms; if (u >= 1) { S.flashes.splice(i, 1); continue; }
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, `rgba(${f.c},${(1 - u) * .9})`); gr.addColorStop(1, `rgba(${f.c},0)`); g.fillStyle = gr; g.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); g.restore(); }
    // t145u JACKPOT CELEBRATION: after the showcase the top display keeps celebrating until the next spin - swinging colour spotlights, the jackpot car doing
    // victory laps with a glow, sparkles + the odd firework, marquee lights chasing round the edge and the jackpot banner with the win amount
    if (S.cele) { const c = S.cele, u = Math.min(1, (now - c.t0) / 900);
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const sx = W * (.2 + i * .3), tx = W * (.5 + Math.sin(now / (1100 + i * 260) + i) * .32), gr = g.createLinearGradient(sx, 0, tx, H * .9); gr.addColorStop(0, hexA(c.color, .34 * u)); gr.addColorStop(1, hexA(c.color, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 6, 0); g.lineTo(sx + 6, 0); g.lineTo(tx + W * .16, H * .9); g.lineTo(tx - W * .16, H * .9); g.closePath(); g.fill(); }
      const n = Math.max(12, Math.floor(W / 22)), ph = Math.floor(now / 90); for (let i = 0; i < n; i++) { const x = (i + .5) * W / n, on = (i + ph) % 3 === 0; g.fillStyle = on ? (i % 2 ? c.color2 : c.color) : 'rgba(255,255,255,.14)'; g.shadowColor = c.color; g.shadowBlur = on ? 10 : 0; g.beginPath(); g.arc(x, 5, on ? 3.6 : 2.2, 0, 7); g.arc(x, H - 5, on ? 3.6 : 2.2, 0, 7); g.fill(); }
      g.restore(); if (Math.random() < .35 * dt / 16) S.parts.push({ t: 'spark', x: rnd(0, W), y: rnd(H * .1, H * .8), vx: rnd(-.3, .3), vy: rnd(.2, 1), s: rnd(2, 4), life: 1, decay: rnd(.015, .03), c: Math.random() < .5 ? c.color2 : '#fff' });
      if (Math.random() < .008 * (S.cele.lvl || 1) * dt / 16) firework(); }
    if (S.cele && S.cele.fx) { const c = S.cele, u = Math.min(1, (now - c.t0) / 900), t = now / 1000; g.save();
      if (c.fx === 'charge') { // PHEV charging: a battery bar along the bottom filling up, electric arcs from the roof and rising bolts
        const bw = W * .58, bh = Math.max(10, H * .055), bx = W * .04, by = H * .86, fill = Math.min(1, (c.km || 72) / 72) * u; g.strokeStyle = '#d4f6ff'; g.lineWidth = 3; g.shadowColor = c.color; g.shadowBlur = 12; g.strokeRect(bx, by, bw, bh); g.fillRect(bx + bw + 2, by + bh * .3, 5, bh * .4);
        const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#0a6cff'); gr.addColorStop(1, '#8cf6ff'); g.fillStyle = gr; g.fillRect(bx + 2, by + 2, (bw - 4) * fill, bh - 4);
        g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.35)'; const sw = ((t * .8) % 1) * bw; g.fillRect(bx + 2 + Math.min(sw, (bw - 4) * fill - 12), by + 2, 10, bh - 4);
        g.strokeStyle = c.color2; g.lineWidth = 2.2; for (let k = 0; k < 3; k++) { if (Math.sin(t * 7 + k * 2.1) < .25) continue; let x = W * (.28 + k * .22), y = 0; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - .5) * W * .06; y += H * .12; g.lineTo(x, y); } g.stroke(); }
        if (Math.random() < .3 * dt / 16) S.parts.push({ t: 'spark', x: rnd(W * .2, W * .8), y: H * .8, vx: rnd(-.2, .2), vy: rnd(-1.6, -.6), s: rnd(2, 4), life: 1, decay: rnd(.012, .02), c: c.color2 }); }
      else if (c.fx === 'rally') { const n = Math.ceil(W / 24) + 2, off = (t * 60) % 48; for (let r = 0; r < 2; r++) for (let i = -2; i < n; i++) { g.fillStyle = (i + r) % 2 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'; g.fillRect(i * 24 + (r ? off : -off) % 48, H * .8 + r * 14, 24, 14); } }
      else if (c.fx === 'offroad') { if (Math.random() < .5 * dt / 16) S.parts.push({ t: 'smoke', x: rnd(0, W), y: H * .7, vx: rnd(.4, 1.2), vy: rnd(-.3, 0), s: rnd(8, 18), life: 1, decay: .012, c: '150,120,80' }); g.fillStyle = 'rgba(30,60,20,.55)'; g.beginPath(); g.moveTo(0, H); for (let i = 0; i <= 20; i++) g.lineTo(W * i / 20, H * (.88 - .05 * Math.abs(Math.sin(i * .9 + t * .5)))); g.lineTo(W, H); g.fill(); }
      else if (c.fx === 'wheel') { const R = Math.min(W, H) * .17, cx = W * .14, cy = H * .5; g.translate(cx, cy); g.rotate(t * 1.4); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c.color : '#3a0a10'; g.globalAlpha = .85; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i * Math.PI / 4, (i + 1) * Math.PI / 4); g.fill(); } g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke(); }
      else if (c.fx === 'spins') { g.fillStyle = c.color; g.globalAlpha = .5; for (let i = 0; i < 6; i++) { const x = ((t * 140 + i * W / 6) % (W + 80)) - 40; g.fillRect(x, H * .9, 50, 3); g.fillRect(x + 20, H * .93, 36, 2); } }
      g.restore(); }
    if (S.cele && S.cele.sub) { /* sub-line drawn with the banner below */ }
    drawGantry(g, now);
    // texts (+win amounts, BOOST!, etc.)
    for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i], u = (now - t.t0) / t.ms; if (u >= 1) { S.texts.splice(i, 1); continue; } const pop = Math.min(1, u * 6), fade = u > .8 ? (1 - u) / .2 : 1;
      g.save(); g.globalAlpha = fade; g.translate(t.x, t.y - u * 10); g.scale(.6 + .4 * ease(pop), .6 + .4 * ease(pop)); g.font = `400 ${t.size}px Russo,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = t.size * .14; g.strokeStyle = '#2a0008'; g.strokeText(t.s, 0, 0);
      const gr = g.createLinearGradient(0, -t.size / 2, 0, t.size / 2); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(.5, t.c || '#ffcc00'); gr.addColorStop(1, '#ff3a1a'); g.fillStyle = gr; g.shadowColor = t.c || '#ffb000'; g.shadowBlur = 16; g.fillText(t.s, 0, 0); g.restore(); }
    if (S.cele) { const c = S.cele, pop = Math.min(1, (now - c.t0) / 500), k = ease(pop), fs = Math.round(Math.min(W * (.066 + .008 * (c.lvl || 1)), H * .15)), pulse = 1 + .03 * Math.sin(now / 230);
      let bb = 0; try { bb = document.getElementById('brand').getBoundingClientRect().bottom - S.rect.top; } catch (e) { bb = 0; } const y1 = Math.max(H * .3, bb + fs * .8);
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(W / 2, y1); g.scale(k * pulse, k * pulse); g.lineJoin = 'round';
      g.font = `400 ${Math.round(fs * .56)}px Russo,sans-serif`; g.lineWidth = fs * .12; g.strokeStyle = '#000'; const LB = c.label || '★ JACKPOT ★'; g.strokeText(LB, 0, -fs * 1.05); g.fillStyle = c.color2; g.shadowColor = c.color; g.shadowBlur = 16; g.fillText(LB, 0, -fs * 1.05);
      g.font = `400 ${fs}px Russo,sans-serif`; g.lineWidth = fs * .16; g.strokeStyle = '#1a0600'; g.strokeText(c.name, 0, 0); const gr = g.createLinearGradient(0, -fs / 2, 0, fs / 2); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(.5, c.color); gr.addColorStop(1, '#6a2000'); g.fillStyle = gr; g.shadowBlur = 24; g.fillText(c.name, 0, 0);
      g.font = `400 ${Math.round(fs * .8)}px Russo,sans-serif`; g.lineWidth = fs * .13; g.strokeStyle = '#000'; g.strokeText(c.amt, 0, fs * .95); g.fillStyle = '#fff'; g.shadowColor = c.color; g.shadowBlur = 20 + 10 * Math.sin(now / 200); g.fillText(c.amt, 0, fs * .95); if (c.sub) { g.shadowBlur = 8; g.font = `400 ${Math.round(fs * .42)}px Russo,sans-serif`; g.lineWidth = fs * .08; g.strokeText(c.sub, 0, fs * 1.55); g.fillStyle = c.color2; g.fillText(c.sub, 0, fs * 1.55); } g.restore(); }
    drawGauge(g, now);
    // red anticipation vignette + mode tint + bottom fade into the cabinet
    if (S.red > .02) { const pulse = .75 + .25 * Math.sin(now / 120), gr = g.createRadialGradient(W / 2, H * .55, H * .2, W / 2, H * .55, Math.max(W, H) * .8); gr.addColorStop(0, 'rgba(255,0,20,0)'); gr.addColorStop(1, `rgba(255,0,20,${.55 * S.red * pulse})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (S.tint) { g.fillStyle = S.tint; g.fillRect(0, 0, W, H); }
    if (S.flashAll) { g.fillStyle = `rgba(255,255,255,${S.flashAll})`; g.fillRect(0, 0, W, H); S.flashAll = Math.max(0, S.flashAll - dt / 400); }
    const fade = g.createLinearGradient(0, H * .82, 0, H); fade.addColorStop(0, 'rgba(7,4,10,0)'); fade.addColorStop(1, 'rgba(7,4,10,.85)'); g.fillStyle = fade; g.fillRect(0, H * .82, W, H * .18);
    const top = g.createLinearGradient(0, 0, 0, H * .22); top.addColorStop(0, 'rgba(7,4,10,.75)'); top.addColorStop(1, 'rgba(7,4,10,0)'); g.fillStyle = top; g.fillRect(0, 0, W, H * .22);
  }
  // column centre (show coords) of reel r
  function colX(r) { try { const c = window.reels.cellRect(r, 0); fit(); return c.left + c.width / 2 - S.rect.left; } catch (e) { return S.W * (r + .5) / 5; } }
  const Show = {
    init(cv) { S.cv = cv; S.g = cv.getContext('2d'); S.k = () => parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--k')) || 1; requestAnimationFrame(loop); ev('init'); },
    get state() { return { state: S.state, gantry: S.gantry.mode, zoom: +S.cam.z.toFixed(3), red: +S.red.toFixed(2), speed: +S.speed.toFixed(2), meter: +S.tmeter.toFixed(2), actors: S.actors.map(a => a.k + (a.hero ? '*' : '')), wheels: S.actors.map(a => ({ k: a.k, x: +(a._wx || 0).toFixed(1), y: +(a._wy || 0).toFixed(1), wa: +(a.wa || 0).toFixed(3), wo: +(a.wo || 0).toFixed(3), w: +((a._box && a._box.w) || 0).toFixed(1) })), frames: S.frames, events: S.events.slice(-20) }; },
    spin() { Show.celebrateOff(); S.state = 'spin'; S.gantry = { mode: 'green', t: performance.now() }; S.tspeed = 1; S.cam.tz = 1.12; S.cam.kick = 3; S.tred = 0; S.hero = null; S.texts.length = 0; S.actors.forEach(a => { if (a.hero) a.dead = true; }); launchAll(3); if (Math.random() < .3) try { window.MadAudio.play('passby', .35); } catch (e) {} ev('spin'); },
    reelStop(r, cells) { const x = colX(r), y = S.H - 6, heavy = cells && cells.some(c => /PH|WD|FL|PL|BG/.test(c.s)); S.cam.kick += heavy ? 5 : 2; puff(x, y, heavy ? 16 : 8); if (heavy) sparks(x, y, 18, cells.some(c => c.s === 'PL') ? '#22c3ff' : cells.some(c => c.s === 'BG') ? '#c43cff' : '#ffd84a');
      S.flashes.push({ x, y: y - 10, r: S.H * (heavy ? .7 : .45), t0: performance.now(), ms: heavy ? 500 : 320, c: heavy ? '255,240,200' : '200,220,255' }); S.actors.forEach(a => a.flash = heavy ? 1 : .5); if (r === 4) { S.tspeed = 0; S.cam.tz = 1.04; if (S.gantry.mode !== 'win') S.gantry = { mode: 'off', t: performance.now() }; S.state = 'idle'; } ev('stop', { r, heavy }); },
    // t142u near miss: the cars rev hard (flames, red flash) then stall - speed collapses, smoke, camera snaps back
    nearMiss() { S.actors.forEach(a => { a.flame = 1; a.flash = 1; a.v = Math.max(a.v, .7); }); S.cam.kick += 8; S.flashAll = .35; S.tred = 1;
      const x = S.W * .5, y = S.H - 6; puff(x, y, 18); setTimeout(() => { S.actors.forEach(a => { a.flame = 0; a.v = 0.02; }); S.tspeed = 0; S.cam.tz = 1.04; puff(S.W * .3, y, 22); puff(S.W * .7, y, 22); S.tred = 0; }, 650);
      S.texts.push({ s: 'SO CLOSE!', x: S.W / 2, y: S.H * .3, size: Math.round(Math.min(S.W * .09, S.H * .16)), c: '#ff3048', t0: performance.now(), ms: 1400 }); ev('nearmiss'); },
    tease(on) { S.tred = on ? 1 : 0; S.cam.tz = on ? 1.22 : 1.04; S.gantry = { mode: on ? 'tease' : 'off', t: performance.now() }; if (on) { S.state = 'tease'; S.tspeed = .25; try { const A = window.MadAudio; S.engine && S.engine.stop(); S.engine = A.engine(); let r = .2; const t = setInterval(() => { r = Math.min(1, r + .08); S.engine && S.engine.set(r); if (r >= 1) clearInterval(t); }, 120); } catch (e) {} }
      else { try { S.engine && S.engine.stop(); } catch (e) {} S.engine = null; } ev('tease', { on }); },
    win(sym, amtText, tier) { const v = view(), k = IMG[sym] ? sym : ({ KY: 'EC', TI: 'RV' }[sym] || 'PH'); S.state = 'win'; S.tred = 0; S.gantry = { mode: 'win', t: performance.now() }; S.actors.forEach(a => { if (!a.hero) a.v = Math.max(a.v, .5); });
      const big = tier && tier !== 'win', W = S.W, H = S.H, t0 = performance.now(), base = Math.min(W * .5, H * 1.5);
      const a = spawn(k, { hero: true, lane: 1, x: W + 20, w: base, flame: 1, trail: null, trailC: { RV: '#2ab4ff', EC: '#ff9a3a', OU: '#4a8cff', EV: '#3fe06a', PH: '#ffd84a' }[k] });
      S.hero = a; S.cam.tz = big ? 1.18 : 1.1;
      a.script = (a, now, dt, v) => { const u = (now - t0) / 1000, cx = W / 2 - base / 2;
        if (u < .55) { a.x = W + 20 - (W + 20 - cx) * ease(u / .55); a.flame = 1; }
        else if (u < .62) { if (!a.braked) { a.braked = 1; puff(a.x + base * .8, laneY(v, 1) - 6, 18); puff(a.x + base * .2, laneY(v, 1) - 6, 12); S.cam.kick += 6; /* t131u: no generic tyre screech - each symbol has its own win sound (game.js symWin) */ } }
        else if (u < 1.5) { if (Math.floor(u * 6) % 2 === 0) a.flash = 1; if (!a.said) { a.said = 1; const bb = (() => { try { return document.getElementById('brand').getBoundingClientRect().bottom - S.rect.top; } catch (e) { return 0; } })(), fs = Math.round(Math.min(W * .1, H * .2)); S.texts.push({ s: amtText, x: W / 2, y: Math.max(H * .34, bb + fs * .75), size: Math.round(Math.min(W * .1, H * .2)), c: a.trailC, t0: now, ms: 2600 }); } }
        else if (u < 2.3) { // dive into the reels
          const p = (u - 1.5) / .8; a.y = laneY(v, 1) + p * p * H * .9; a.scale = 1 - p * .35; a.trail = a.trail || []; a.trail.push([a.x + base * .5 * (a.scale || 1), (a.y || 0) - 4]); if (a.trail.length > 16) a.trail.shift(); a.flame = 1; }
        else { a.dead = true; if (!a.landed) { a.landed = 1; S.cam.tz = 1.04; S.hero = null; Show.dive(a.trailC); } } };
      if (big) { S.fireworks = performance.now() + 4000; S.flashAll = .6; } ev('win', { sym: k, tier }); },
    dive(col) { // light trail from the bottom of the top display down into the reel window (drawn on the FX canvas)
      try { const F = window.MadFX, fr = document.getElementById('frame').getBoundingClientRect(), x = S.rect.left + S.W / 2, y0 = S.rect.top + S.H, t0 = performance.now();
        F.hook((now, g) => { const u = (now - t0) / 650; if (u >= 1) return false; const y1 = y0 + (fr.top + fr.height * .5 - y0) * ease(u); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col || '#ffd84a');
          g.strokeStyle = gr; g.shadowColor = col || '#ffd84a'; g.shadowBlur = 24; g.lineWidth = 8 * (1 - u * .5); g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 18, y0); g.lineTo(x - 18, y1); g.moveTo(x + 18, y0); g.lineTo(x + 18, y1); g.stroke(); g.globalCompositeOperation = 'source-over'; return true; }); } catch (e) {} ev('dive'); },
    meter(p, full) { const was = S.tmeter; if (!full && Math.abs(clamp(p, 0, 1) - was) < .001) return; S.tmeter = clamp(p, 0, 1); if (S.tmeter > was + .001) { S.boost = 1; sparks(S.W - 50, S.H - 40, 10, '#ff7a00'); } if (full) { S.texts.push({ s: 'BOOST FULL!', x: S.W / 2, y: S.H * .24, size: Math.round(Math.min(S.W * .09, S.H * .17)), c: '#ff7a00', t0: performance.now(), ms: 2200 }); S.actors.forEach(a => { a.flame = 1; a.v = Math.max(a.v, .4); }); launchAll(2); } ev('meter', { p: S.tmeter, full: !!full }); },
    bonus(type) { try { window.MadAudio.play('launch'); } catch (e) {} S.flashAll = .9; S.cam.kick += 10; S.cam.tz = 1.25; S.fireworks = performance.now() + 2500; launchAll(3); S.gantry = { mode: 'win', t: performance.now() };
      const sw = document.getElementById('sweep'); if (sw) { sw.className = ''; void sw.offsetWidth; sw.className = 'go ' + (type || ''); setTimeout(() => sw.className = '', 1300); } setTimeout(() => { S.cam.tz = 1.04; }, 1200); ev('bonus', { type }); },
    big(tier) { const sw = document.getElementById('sweep'); if (sw) { sw.className = ''; void sw.offsetWidth; sw.className = 'go'; setTimeout(() => sw.className = '', 1300); } S.fireworks = performance.now() + 6000; S.flashAll = .8; S.cam.tz = 1.2; launchAll(4); setTimeout(() => { S.cam.tz = 1.04; }, 3000); ev('big', { tier }); },
    // t145u: keep the jackpot celebration on the top display until the next spin (cfg: {key, name, amt, color, color2, lvl})
    celebrate(cfg) { Show.celebrateOff(); const now = performance.now(); S.cele = Object.assign({ t0: now }, cfg); S.state = 'cele'; S.tred = 0; S.tspeed = 0; S.cam.tz = 1.08; S.gantry = { mode: 'win', t: now }; S.fireworks = 0; S.flashAll = .5;
      const base = Math.min(S.W * .52, S.H * 1.4), a = spawn(cfg.key, { hero: true, cele: true, lane: 1, x: S.W + 30, w: base, flame: .5, beam: 1, v: .22, trailC: cfg.color }); S.hero = a;
      a.script = (a, now2, dt, v) => { if (!S.cele) { a.dead = true; return; } a.x -= (.17 + .03 * (cfg.lvl || 1)) * dt; a.v = .22; a.flame = .5; a.flash = Math.sin(now2 / 260) > .7 ? 1 : 0; if (a.x < -base * 1.15) a.x = S.W + 30; if (Math.random() < .25) sparks(a.x + base * .5, laneY(v, 1) - base * .1, 1, cfg.color2); };
      ev('celebrate', { id: cfg.name }); },
    celebrateOff() { if (!S.cele) return; S.cele = null; S.actors.forEach(a => { if (a.cele) a.dead = true; }); if (S.hero && S.hero.cele) S.hero = null; S.cam.tz = 1.04; ev('celebrate-off'); },
    get celebrating() { return S.cele ? S.cele.name : null; },
    clear() { S.texts.length = 0; S.tred = 0; S.fireworks = 0; S.actors.forEach(a => { if (a.hero && !a.cele) a.dead = true; }); if (!S.cele) S.hero = null; },
    setAttract(on) { S.attract = on; }, setTint(c) { S.tint = c || ''; }, pause(p) { S.paused = p; }, _S: S,
  };
  window.MadShow = Show;
})();
