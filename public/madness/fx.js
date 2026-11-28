// MITSUBISHI MADNESS - visual effects: the animated showroom/track behind the cabinet (attract mode), particle overlay (coins, confetti,
// fireworks, sparks, tyre smoke), DRIFT WILD car, speed lines, and the cinematic speed-tunnel renderer. window.MadFX
(function () {
  const CAR_FILES = { rvr: 'rvr', ec: 'eclipse-cross', out: 'outlander', ev: 'eclipse-sportback', phev: 'outlander-phev' };
  const cars = {}; for (const k in CAR_FILES) { const i = new Image(); i.decoding = 'async'; i.src = `/madness/art/car-${CAR_FILES[k]}.webp?v=1`; cars[k] = i; }
  const ok = i => i && i.complete && i.naturalWidth > 0;
  // photo-real backgrounds (generated, see madness-notes/gen + photo.py)
  const photos = {}; const photo = n => { let i = photos[n]; if (!i) { i = photos[n] = new Image(); i.decoding = 'async'; i.src = `/madness/photo/${n}.webp?v=1`; } return i; };
  ['bg-tunnel', 'bg-rally', 'bg-charge', 'bg-gravel', 'bg-mud', 'bg-snow', 'bg-rocks', 'bg-sand'].forEach(photo);
  // draw a photo "cover"-fitted (optionally zoomed about (fx,fy) and scrolled horizontally with mirrored tiling); returns a mapper from
  // photo fractions (u,v) to screen x,y so scenes can place things on the photo's road/track/charger
  function cover(g, img, W, H, o = {}) { const z = o.zoom || 1, fx = o.fx == null ? .5 : o.fx, fy = o.fy == null ? .5 : o.fy;
    const iw = ok(img) ? img.naturalWidth : 9, ih = ok(img) ? img.naturalHeight : 16, s = Math.max(W / iw, H / ih) * z, dw = iw * s, dh = ih * s;
    const ox = W * fx - dw * fx, oy = H * fy - dh * fy;
    if (ok(img)) { if (o.scroll) { let x0 = ox - ((o.scroll % (2 * dw)) + 2 * dw) % (2 * dw); for (let k = 0; x0 < W; k++, x0 += dw) { if (k % 2) { g.save(); g.translate(x0 + dw, oy); g.scale(-1, 1); g.drawImage(img, 0, 0, dw, dh); g.restore(); } else g.drawImage(img, x0, oy, dw, dh); } }
      else g.drawImage(img, ox, oy, dw, dh); }
    return { x: u => ox + u * dw, y: v => oy + v * dh, s, dw, dh, ok: ok(img) }; }
  const topCar = new Image(); topCar.decoding = 'async'; topCar.src = '/madness/photo/topdown-phev.webp?v=1'; // photo-real top-down PHEV for DRIFT WILD
  const rnd = (a, b) => a + Math.random() * (b - a);
  const speed = () => window.__madSpeed || 1;
  function fit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); const w = Math.max(10, Math.round(r.width * d)), h = Math.max(10, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { W: r.width, H: r.height, d }; }
  // draw a car (facing left) with bottom-centre at x,y, width w; options: tilt, glow, flame (nitro exhaust), wheelSpin
  function drawCar(g, k, x, y, w, o = {}) { const I = cars[k]; if (!ok(I)) return; const h = w * I.naturalHeight / I.naturalWidth; g.save(); g.translate(x, y); if (o.tilt) g.rotate(o.tilt); if (o.flip) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, -h * .02, w * .48, h * .07, 0, 0, 7); g.fill();
    if (o.flame) { const fl = o.flame; for (let i = 0; i < 3; i++) { const L = w * (.12 + Math.random() * .18) * fl; const gr = g.createLinearGradient(w * .48, 0, w * .48 + L, 0); gr.addColorStop(0, 'rgba(120,220,255,.95)'); gr.addColorStop(.4, 'rgba(255,170,40,.8)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w * .46, -h * .3); g.lineTo(w * .48 + L, -h * .26 + rnd(-2, 2)); g.lineTo(w * .46, -h * .2); g.fill(); } }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 24; }
    g.drawImage(I, -w / 2, -h, w, h); g.restore(); return h; }
  // ---------------- showroom / track behind the cabinet ----------------
  const stage = { cv: null, g: null, t0: performance.now(), cruisers: [], stars: [], attract: false, mode: '', paused: false, last: 0, roadY: 0, k: 1 };
  function stageInit(cv) { stage.cv = cv; stage.g = cv.getContext('2d'); for (let i = 0; i < 70; i++) stage.stars.push({ x: Math.random(), y: Math.random() * .5, s: Math.random() * 1.6 + .3, p: Math.random() * 6 }); requestAnimationFrame(stageLoop); }
  function stageLoop(now) { requestAnimationFrame(stageLoop); if (stage.paused || document.hidden) return; if (now - stage.last < 30) return; const dt = Math.min(80, now - (stage.last || now)); stage.last = now;
    const { W, H, d } = fit(stage.cv), g = stage.g; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H); const k = stage.k, roadY = stage.roadY || H * .4;
    // searchlights
    for (let i = 0; i < 2; i++) { const a = Math.sin(now / 2200 + i * 2) * .5 - Math.PI / 2, x0 = W * (i ? .82 : .18); g.save(); g.translate(x0, roadY); g.rotate(a + Math.PI / 2); const gr = g.createLinearGradient(0, 0, 0, -H * .7); gr.addColorStop(0, stage.mode === 'nitro' ? 'rgba(40,190,255,.25)' : stage.mode === 'turbo' ? 'rgba(255,140,0,.22)' : 'rgba(255,40,70,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-W * .16, -H * .7); g.lineTo(W * .16, -H * .7); g.lineTo(6, 0); g.fill(); g.restore(); }
    // road
    const rh = 34 * k; const gr = g.createLinearGradient(0, roadY - rh * .2, 0, roadY + rh); gr.addColorStop(0, 'rgba(30,30,38,.55)'); gr.addColorStop(1, 'rgba(8,8,12,.75)'); g.fillStyle = gr; g.fillRect(0, roadY - rh * .2, W, rh * 1.2);
    const sp = (stage.attract ? .5 : .18) * k, off = (now * sp) % (40 * k); g.fillStyle = '#ffd84a'; for (let xx = -40 * k + off; xx < W; xx += 40 * k) g.fillRect(xx, roadY + rh * .35, 20 * k, 2.5 * k);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, roadY - rh * .2, W, 1.5);
    // cruisers (right -> left)
    if (Math.random() < (stage.attract ? .035 : .006) * dt / 30 && stage.cruisers.length < (stage.attract ? 5 : 2)) { const ks = Object.keys(cars); stage.cruisers.push({ k: ks[Math.floor(Math.random() * ks.length)], x: W + 120 * k, v: (stage.attract ? rnd(.35, .7) : rnd(.12, .25)) * k, lane: Math.random() < .5 ? 0 : 1, flame: stage.attract && Math.random() < .5 }); }
    stage.cruisers.sort((a, b) => a.lane - b.lane);
    for (let i = stage.cruisers.length - 1; i >= 0; i--) { const c = stage.cruisers[i]; c.x -= c.v * dt; const w = (c.lane ? 108 : 92) * k, y = roadY + (c.lane ? rh * .95 : rh * .45);
      // headlight beam
      const hg = g.createLinearGradient(c.x - w * .5, 0, c.x - w * 1.6, 0); hg.addColorStop(0, 'rgba(255,250,210,.45)'); hg.addColorStop(1, 'rgba(255,250,210,0)'); g.fillStyle = hg; g.beginPath(); g.moveTo(c.x - w * .46, y - w * .14); g.lineTo(c.x - w * 1.6, y - w * .28); g.lineTo(c.x - w * 1.6, y + w * .02); g.lineTo(c.x - w * .46, y - w * .08); g.fill();
      drawCar(g, c.k, c.x, y, w, { flame: c.flame ? 1 : 0 }); if (c.x < -w) stage.cruisers.splice(i, 1); }
  }
  // ---------------- particle overlay ----------------
  const P = { cv: null, g: null, list: [], running: false, emitters: [], hooks: [] };
  function fxInit(cv) { P.cv = cv; P.g = cv.getContext('2d'); }
  function fxStart() { if (P.running) return; P.running = true; requestAnimationFrame(fxLoop); }
  function fxLoop(now) { const { W, H, d } = fit(P.cv), g = P.g; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
    for (let i = P.emitters.length - 1; i >= 0; i--) { const e = P.emitters[i]; if (now > e.until) { P.emitters.splice(i, 1); continue; } e.tick(now, W, H); }
    for (let i = P.list.length - 1; i >= 0; i--) { const p = P.list[i]; p.life -= p.decay; if (p.life <= 0 || p.y > H + 60) { P.list.splice(i, 1); continue; } p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.vx *= p.drag || 1; p.vy *= p.drag || 1; p.r = (p.r || 0) + (p.vr || 0);
      g.save(); g.globalAlpha = Math.min(1, p.life * (p.fade || 1.5)); g.translate(p.x, p.y);
      if (p.t === 'coin') { const sx = Math.abs(Math.cos(p.r)); g.scale(Math.max(.15, sx), 1); const gr = g.createRadialGradient(-p.s * .3, -p.s * .3, 1, 0, 0, p.s); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(.5, '#ffc400'); gr.addColorStop(1, '#a86400'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.s, 0, 7); g.fill(); g.strokeStyle = '#7a4a00'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#a86400'; g.font = `900 ${p.s * 1.1}px Russo,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 1); }
      else if (p.t === 'conf') { g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      else if (p.t === 'smoke') { const s = p.s * (2 - p.life); g.fillStyle = `rgba(200,200,210,${.35 * p.life})`; g.beginPath(); g.arc(0, 0, s, 0, 7); g.fill(); }
      else if (p.t === 'line') { g.rotate(p.a); g.fillStyle = p.c || 'rgba(255,255,255,.8)'; g.fillRect(0, -1, p.s, 2); }
      else { g.fillStyle = p.c || '#ffd84a'; g.shadowColor = p.c || '#ffd84a'; g.shadowBlur = 8; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); }
      g.restore(); }
    for (let i = P.hooks.length - 1; i >= 0; i--) { let keep = false; try { keep = P.hooks[i](now, g, W, H); } catch (e) { console.warn(e); } g.setTransform(d, 0, 0, d, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0; if (!keep) P.hooks.splice(i, 1); }
    if (P.list.length || P.emitters.length || P.hooks.length) requestAnimationFrame(fxLoop); else { P.running = false; g.clearRect(0, 0, W, H); } }
  const add = p => { if (P.list.length < 900) P.list.push(p); fxStart(); };
  const COLORS = ['#ff2040', '#ffd84a', '#22c3ff', '#ffffff', '#ff8a00', '#30e060'];
  function emit(ms, tick) { P.emitters.push({ until: performance.now() + ms, tick }); fxStart(); }
  const MadFXObj = {
    cars, drawCar, fit, photo, cover,
    stageInit, setRoad(y, k) { stage.roadY = y; stage.k = k; }, setAttract(on) { stage.attract = on; }, setMode(m) { stage.mode = m || ''; }, pauseStage(p) { stage.paused = p; },
    fxInit, hook(fn) { P.hooks.push(fn); fxStart(); },
    coinRain(ms = 2500, n = 3) { emit(ms, (now, W) => { for (let i = 0; i < n; i++) add({ t: 'coin', x: rnd(0, W), y: -20, vx: rnd(-1, 1), vy: rnd(2, 6), g: .18, s: rnd(7, 13), r: rnd(0, 6), vr: rnd(.1, .3), life: 1, decay: .004 }); }); },
    coinBurst(x, y, n = 40) { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0), s = rnd(4, 11); add({ t: 'coin', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .3, s: rnd(6, 11), r: rnd(0, 6), vr: rnd(.1, .3), life: 1, decay: .008 }); } },
    confetti(n = 120) { const W = P.cv.getBoundingClientRect().width; for (let i = 0; i < n; i++) add({ t: 'conf', x: rnd(0, W), y: rnd(-80, -5), vx: rnd(-1.5, 1.5), vy: rnd(1.5, 4), g: .04, drag: .995, s: rnd(6, 11), r: rnd(0, 6), vr: rnd(-.2, .2), c: COLORS[i % COLORS.length], life: 1, decay: .004 }); },
    firework(x, y, c) { c = c || COLORS[Math.floor(Math.random() * COLORS.length)]; for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, s = rnd(2, 6); add({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .06, drag: .98, s: 3, c, life: 1, decay: .014 }); } },
    fireworks(ms = 2500) { let last = 0; emit(ms, (now, W, H) => { if (now - last > 280 / speed()) { last = now; MadFXObj.firework(rnd(W * .1, W * .9), rnd(H * .1, H * .5)); } }); },
    sparks(x, y, n = 18, c = '#9fe8ff') { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(2, 7); add({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .15, s: rnd(2, 4), c, life: 1, decay: .03 }); } },
    smoke(x, y, n = 4) { for (let i = 0; i < n; i++) add({ t: 'smoke', x: x + rnd(-8, 8), y: y + rnd(-6, 6), vx: rnd(-1, 1), vy: rnd(-1.4, -.2), s: rnd(6, 14), life: 1, decay: .02 }); },
    speedLines(ms = 1200, c) { emit(ms, (now, W, H) => { for (let i = 0; i < 4; i++) { const y = rnd(0, H); add({ t: 'line', x: W + 10, y, vx: -rnd(18, 34), vy: 0, a: 0, s: rnd(40, 140), c: c || 'rgba(255,255,255,.7)', life: 1, decay: .04 }); } }); },
    // DRIFT WILD (t111u): photo-real TOP-DOWN Outlander PHEV drives up over the reel column, fish-tailing with tyre smoke and
    // skid marks; onMid() turns the reel WILD as the car passes its centre
    drift(rect, k = 'phev', ms = 1300, onMid) { return new Promise(res => { const t0 = performance.now(), D = ms * speed() * 1.25; let mid = false, done = false;
      const I = topCar, cw = rect.width * .92, ch = ok(I) ? cw * I.naturalHeight / I.naturalWidth : cw * 2.1, marks = [];
      const y0 = rect.top + rect.height + ch * .6, y1 = rect.top - ch * .7, cx = rect.left + rect.width / 2;
      P.hooks.push((now, g) => { const u = Math.min(1, (now - t0) / D), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const y = y0 + (y1 - y0) * e, yaw = Math.sin(u * Math.PI * 3) * .38 * (1 - u * .4), x = cx + Math.sin(u * Math.PI * 3 + .6) * rect.width * .08;
        // rear-axle positions (for skid marks + smoke)
        const rx = Math.sin(yaw) * ch * .32, ry = Math.cos(yaw) * ch * .32, perp = [Math.cos(yaw) * cw * .38, Math.sin(yaw) * cw * .38];
        marks.push([x - rx + perp[0], y + ry + perp[1], x - rx - perp[0], y + ry - perp[1]]); if (marks.length > 90) marks.shift();
        g.save(); g.lineCap = 'round'; for (let i = 1; i < marks.length; i++) { const a = marks[i - 1], b = marks[i], al = .55 * (i / marks.length) * (1 - Math.max(0, u - .8) * 5);
          g.strokeStyle = `rgba(12,12,14,${Math.max(0, al)})`; g.lineWidth = cw * .1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(a[2], a[3]); g.lineTo(b[2], b[3]); g.stroke(); } g.restore();
        if (Math.random() < .9) { const m = marks[marks.length - 1]; MadFXObj.smoke(m[0], m[1], 2); MadFXObj.smoke(m[2], m[3], 2); }
        // headlight beams ahead of the car
        g.save(); g.translate(x, y); g.rotate(yaw); g.globalCompositeOperation = 'lighter'; const hb = g.createLinearGradient(0, -ch * .5, 0, -ch * 1.25); hb.addColorStop(0, 'rgba(255,250,220,.5)'); hb.addColorStop(1, 'rgba(255,250,220,0)'); g.fillStyle = hb;
        for (const sx of [-.3, .3]) { g.beginPath(); g.moveTo(cw * sx - cw * .08, -ch * .48); g.lineTo(cw * sx * 2.2 - cw * .3, -ch * 1.25); g.lineTo(cw * sx * 2.2 + cw * .3, -ch * 1.25); g.lineTo(cw * sx + cw * .08, -ch * .48); g.fill(); }
        g.globalCompositeOperation = 'source-over'; g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = cw * .18; g.shadowOffsetX = cw * .06; g.shadowOffsetY = cw * .1;
        if (ok(I)) g.drawImage(I, -cw / 2, -ch / 2, cw, ch); else { g.fillStyle = '#c0102a'; g.fillRect(-cw / 2, -ch / 2, cw, ch); }
        g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
        // brake lights glow
        g.globalCompositeOperation = 'lighter'; for (const sx of [-.36, .36]) { const bl = g.createRadialGradient(cw * sx, ch * .47, 0, cw * sx, ch * .47, cw * .22); bl.addColorStop(0, 'rgba(255,40,40,.8)'); bl.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = bl; g.fillRect(cw * sx - cw * .25, ch * .3, cw * .5, ch * .35); }
        g.restore();
        if (y < rect.top + rect.height * .5 && !mid) { mid = true; try { onMid && onMid(); } catch (e) { console.warn(e); } }
        if (u >= 1 && !done) { done = true; res(); return false; } return true; }); fxStart();
      setTimeout(() => { if (!done) { done = true; if (!mid) { mid = true; try { onMid && onMid(); } catch (e) {} } res(); } }, D + 1500); }); },
    // car blasting across the screen (big wins / transitions)
    flyBy(k = 'phev', ms = 1400, y) { const t0 = performance.now(), D = ms * speed(); P.hooks.push((now, g, W, H) => { const u = (now - t0) / D, w = W * .7, x = W + w / 2 - u * (W + w * 1.2), yy = y != null ? y : H * .72; if (u >= 1) return false;
      MadFXObj.smoke(x + w * .45, yy - 10, 2); drawCar(g, k, x, yy, w, { flame: 1.5, glow: '#ff3048' }); return true; }); fxStart(); },
    // cinematic speed tunnel (runs on the cine canvas until stop())
    tunnel(cv, o = {}) { const g = cv.getContext('2d'), t0 = performance.now(), I = photo('bg-tunnel'), lines = [...Array(70)].map(() => ({ a: rnd(0, 6.283), z: rnd(.05, 1), w: rnd(1, 2.5) })); let alive = true; const col = o.color || '#ff2040';
      const loop = now => { if (!alive) return; requestAnimationFrame(loop); const { W, H, d } = fit(cv); g.setTransform(d, 0, 0, d, 0, 0); const t = (now - t0) / 1000, cx = W / 2, cy = H * .47, R = Math.hypot(W, H) * .6;
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        // photo-real tunnel, rushing forward (zoom), tinted to the feature colour
        const z = 1 + (t * .35) % .6, zf = (t * .35) % .6 / .6; g.globalAlpha = 1; cover(g, I, W, H, { zoom: z, fx: .5, fy: .47 }); g.globalAlpha = zf; cover(g, I, W, H, { zoom: z / 1.6, fx: .5, fy: .47 }); g.globalAlpha = 1;
        g.globalCompositeOperation = 'color'; g.fillStyle = col; g.globalAlpha = .45; g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        const vg = g.createRadialGradient(cx, cy, R * .2, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter'; for (const L of lines) { L.z -= .03 * (1 + t); if (L.z <= .02) { L.z = 1; L.a = rnd(0, 6.283); } const r1 = R * (1 - L.z) ** 2, r2 = R * (1 - L.z + .08) ** 2; g.strokeStyle = `rgba(255,240,220,${.15 + (1 - L.z) * .5})`; g.lineWidth = L.w * (1.5 - L.z); g.beginPath(); g.moveTo(cx + Math.cos(L.a) * r1, cy + Math.sin(L.a) * r1); g.lineTo(cx + Math.cos(L.a) * r2, cy + Math.sin(L.a) * r2); g.stroke(); } g.globalCompositeOperation = 'source-over';
        if (o.car) { const u = Math.min(1, t / 1.6), w = W * (.1 + u * u * 1.1); drawCar(g, o.car, cx + Math.sin(t * 30) * u * 3, cy + w * .32, w, { flame: 1 + u, glow: col }); }
        if (o.bolt && Math.sin(t * 13) > .6) { g.strokeStyle = '#bff4ff'; g.lineWidth = 4; g.shadowColor = '#22c3ff'; g.shadowBlur = 20; g.beginPath(); let x = rnd(0, W), y = 0; g.moveTo(x, y); while (y < H) { x += rnd(-40, 40); y += rnd(20, 60); g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; } };
      requestAnimationFrame(loop); return () => { alive = false; }; },
  };
  window.MadFX = MadFXObj;
})();
