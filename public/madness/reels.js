// MITSUBISHI MADNESS - canvas reels (5 x 3): wind-back start, motion blur, staggered stops with overshoot, tease (slow, glowing) reels,
// landing pops for specials, win pulse + dimming, wild multiplier chips, drift-wild reel transform. Purely visual. window.MadReels
(function () {
  const CODES = ['KY', 'TI', 'RV', 'EC', 'OU', 'EV', 'PH', 'WD', 'FL', 'PL'], V = '3';
  const img = {}, ready = Promise.all(CODES.map(c => new Promise(r => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => r(); i.src = `/madness/art/${c}@2x.webp?v=${V}`; img[c] = i; })));
  const SPECIAL = { WD: 1, FL: 1, PL: 1 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  class Reels {
    constructor(cv, o = {}) { this.cv = cv; this.g = cv.getContext('2d'); this.o = o; this.n = 5; this.rows = 3;
      this.reels = [...Array(5)].map(() => ({ list: [], pos: 0, anim: null, pop: {}, tease: false }));
      this.win = null; this.blur = {}; this.sparks = []; this.flash = 0; this.dim = 0; this.glow = [0, 0, 0, 0, 0]; this.hot = new Map(); this.shine = -1; this.nextShine = performance.now() + 3000;
      this.resize(); ready.then(() => { this.blur = {}; this.dirty = true; });
      const loop = now => { requestAnimationFrame(loop); this.draw(now); }; requestAnimationFrame(loop); }
    resize() { const r = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2.5); this.dpr = d; this.W = Math.max(40, r.width); this.H = Math.max(30, r.height);
      this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); this.gap = Math.max(2, this.W * .008); this.colW = (this.W - 4 * this.gap) / 5; this.cellH = this.H / 3; this.blur = {}; }
    setGrid(grid) { grid.forEach((col, r) => { const R = this.reels[r]; R.list = col.map(c => ({ ...c })); R.pos = 0; R.anim = null; R.pop = {}; }); }
    visible(r) { const R = this.reels[r]; return R.list.slice(Math.round(R.pos), Math.round(R.pos) + 3); }
    // spin to `grid`. o: { fast, tease:[5 bools], onStop(r, cells), onTease(r) }
    spin(grid, o = {}) { const sp = window.__madSpeed || 1, fast = o.fast || 1; this.clearWin(); this.hot.clear(); this.stopping = false;
      const ps = [];
      for (let r = 0; r < 5; r++) { const R = this.reels[r], cur = this.visible(r).length === 3 ? this.visible(r) : grid[r], tease = o.tease && o.tease[r];
        const T = ((0.75 + r * 0.24 + (tease ? 1.5 + (r - 3) * .4 : 0)) * fast) * sp * 1000, v = 24, N = Math.max(8, Math.round(v * T / 1000));
        R.list = [...grid[r].map(c => ({ ...c })), ...[...Array(N)].map(() => this.o.randomSym(r)), ...cur.map(c => ({ ...c }))];
        R.pos = N + 3; R.tease = false; R.pop = {};
        ps.push(new Promise(res => { R.anim = { t0: performance.now(), T, D: N + 3, tease, teased: false, stopped: false, res, onStop: o.onStop, onTease: o.onTease, r, cells: grid[r] }; }));
      }
      return Promise.all(ps); }
    stopNow() { const t = performance.now(); for (const R of this.reels) { const A = R.anim; if (A && !A.stopped) { A.tease = false; R.tease = false; const left = 70 * (A.r + 1); if (A.T - (t - A.t0) > left) A.t0 = t - (A.T - left); } } }
    step(now) { let busy = false;
      for (const R of this.reels) { const A = R.anim; if (!A) continue; busy = true; const t = now - A.t0;
        if (!A.stopped) {
          if (A.tease && !A.teased && t > A.T - 1500 * (window.__madSpeed || 1)) { A.teased = true; R.tease = true; A.onTease && A.onTease(A.r); }
          const u = clamp(t / A.T, 0, 1), wind = t < 110 ? -0.18 * Math.sin(Math.PI * t / 110) : 0;
          const e = A.tease ? (u < .55 ? u * 1.25 : .6875 + (1 - Math.pow(1 - (u - .55) / .45, 2)) * .3125) : u; // tease: crawl at the end
          R.pos = A.D * (1 - e) - wind;
          if (u >= 1) { A.stopped = true; A.tb = now; R.pos = 0; R.tease = false; A.cells.forEach((c, y) => { if (SPECIAL[c.s]) R.pop[y] = now; }); A.onStop && A.onStop(A.r, A.cells); }
        } else { const b = (now - A.tb) / 230; if (b >= 1) { R.pos = 0; R.anim = null; R.list = A.cells.map(c => ({ ...c })); A.res(); } else R.pos = -0.2 * Math.sin(Math.PI * b) * (1 - b * .3); }
      } return busy; }
    sprite(c, w, h, blurred) { const k = c + (blurred ? 'b' : '') + '|' + Math.round(w) + 'x' + Math.round(h); if (this.blur[k]) return this.blur[k]; const I = img[c]; if (!I || !I.naturalWidth) return null;
      const cv = document.createElement('canvas'), d = this.dpr; cv.width = Math.round(w * d); cv.height = Math.round(h * d) + (blurred ? Math.round(h * d * .5) : 0); const g = cv.getContext('2d');
      if (!blurred) g.drawImage(I, 0, 0, cv.width, Math.round(h * d)); else { g.globalAlpha = .22; for (let k2 = 0; k2 < 6; k2++) g.drawImage(I, 0, k2 * h * d * .09, cv.width, Math.round(h * d)); }
      return (this.blur[k] = cv); }
    cellXY(r, y) { return { x: r * (this.colW + this.gap), y: y * this.cellH, w: this.colW, h: this.cellH }; }
    cellRect(r, y) { const b = this.cv.getBoundingClientRect(), c = this.cellXY(r, y); return { left: b.left + c.x, top: b.top + c.y, width: c.w, height: c.h }; }
    // win display (t115u): every contributing tile incl. wilds is lit, everything else dimmed, and each way is traced reel-to-reel with a light trail
    setWin(cells, ways) { this.win = { cells, ways: ways || [], t0: performance.now() }; }
    clearWin() { this.win = null; }
    // t127u: tiles that are 'lining up' into a possible win as the reels stop (n = reels in the chain so far)
    lineUp(cells, n) { const t = performance.now(); for (const [r, y] of cells) { const k = r + ',' + y; const h = this.hot.get(k); if (!h || h.n < n) this.hot.set(k, { t: h ? h.t : t, n }); if (!h) this.reels[r].pop[y] = t; } this.dirty = true; }
    transformReel(r, cells) { const R = this.reels[r]; R.list = cells.map(c => ({ ...c })); R.pos = 0; const t = performance.now(); [0, 1, 2].forEach(y => R.pop[y] = t + y * 90); this.flash = 1;
      for (let k = 0; k < 40; k++) this.sparks.push({ x: (r + .5) * (this.colW + this.gap), y: Math.random() * this.H, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, life: 1, c: Math.random() < .5 ? '#ff3048' : '#ffd84a' }); }
    drawWays(g, now) { const W = this.win, col = { KY: '#c8cce0', TI: '#3fe0cf', RV: '#3fe06a', EC: '#ff9a3a', OU: '#4a8cff', EV: '#22d8ff', PH: '#ffd84a' }, wt = (now - W.t0) / 1000;
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      W.ways.forEach((w, k) => { const c = col[w.s] || '#ffd84a', by = {}; for (const [r, y] of w.cells) (by[r] = by[r] || []).push(y);
        const P = (r, y) => { const q = this.cellXY(r, y); return [q.x + q.w / 2, q.y + q.h / 2]; }, grow = Math.min(1, wt * 1.8);
        // network: every lit tile on a reel joins every lit tile on the next reel (that's what "ways" means)
        for (let r = 0; r < w.len - 1; r++) for (const y0 of by[r] || []) for (const y1 of by[r + 1] || []) { const [x0, yy0] = P(r, y0), [x1, yy1] = P(r + 1, y1), u = Math.max(0, Math.min(1, grow * (w.len - 1) - r));
          if (u <= 0) continue; const xe = x0 + (x1 - x0) * u, ye = yy0 + (yy1 - yy0) * u;
          g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 9; g.beginPath(); g.moveTo(x0, yy0); g.lineTo(xe, ye); g.stroke();
          g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 14; g.lineWidth = 4.5; g.beginPath(); g.moveTo(x0, yy0); g.lineTo(xe, ye); g.stroke(); g.shadowBlur = 0;
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, yy0); g.lineTo(xe, ye); g.stroke(); }
        // light streak racing along the first way, reel 1 -> last reel, looping
        const path = []; for (let r = 0; r < w.len; r++) { const ys = by[r] || [1]; path.push(P(r, ys[(k + r) % ys.length])); }
        const tt = ((wt * .9 + k * .37) % 1.2) / 1.2 * (path.length - 1), seg = Math.min(path.length - 2, Math.floor(tt)), f = tt - seg, a = path[seg], b = path[seg + 1];
        if (a && b && grow >= 1) { const hx = a[0] + (b[0] - a[0]) * f, hy = a[1] + (b[1] - a[1]) * f, ang = Math.atan2(b[1] - a[1], b[0] - a[0]); g.save(); g.translate(hx, hy); g.rotate(ang); g.globalCompositeOperation = 'lighter';
          const sg = g.createLinearGradient(-this.colW * .9, 0, 6, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,.95)'); g.fillStyle = sg; g.fillRect(-this.colW * .9, -3, this.colW * .9 + 6, 6);
          const hg = g.createRadialGradient(0, 0, 0, 0, 0, 16); hg.addColorStop(0, '#fff'); hg.addColorStop(.4, c); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); g.restore(); } });
      g.restore(); }
    burst(r, y, color = '#ffd84a', n = 26) { const c = this.cellXY(r, y); for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 5; this.sparks.push({ x: c.x + c.w / 2, y: c.y + c.h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: color }); } }
    draw(now) { const g = this.g, d = this.dpr, busy = this.step(now); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, this.W, this.H);
      const pad = Math.max(2, this.colW * .03);
      for (let r = 0; r < 5; r++) { const R = this.reels[r], x = r * (this.colW + this.gap);
        // reel bed
        const bg = g.createLinearGradient(0, 0, 0, this.H); bg.addColorStop(0, '#05070d'); bg.addColorStop(.5, '#121826'); bg.addColorStop(1, '#05070d'); g.fillStyle = bg; g.fillRect(x, 0, this.colW, this.H);
        g.save(); g.beginPath(); g.rect(x, 0, this.colW, this.H); g.clip();
        const speed = R.anim && !R.anim.stopped ? 1 : 0, base = Math.floor(R.pos), frac = R.pos - base;
        for (let j = -1; j <= 3; j++) { const c = R.list[base + j]; if (!c) continue; const yy = (j - frac) * this.cellH;
          // list index grows upward on screen: index 0..2 = final rows top..bottom
          const i = base + j; let s = 1, alpha = 1; if (!speed && R.pop[i] != null && i >= 0 && i < 3) { const pu = (now - R.pop[i]) / 420; if (pu >= 0 && pu < 1) s = 1 + .18 * Math.sin(Math.PI * pu); else if (pu >= 1) delete R.pop[i]; }
          let wn = false, tilt = 0; if (this.win && !speed) { wn = this.win.cells.has(r + ',' + i); if (!wn) alpha = .26; else { const wt = (now - this.win.t0) / 1000, pop = Math.min(1, wt * 4); s *= 1 + .1 * pop + .05 * Math.sin(wt * 7 + r * .7); tilt = Math.sin(wt * 3.2 + r * .9) * .22 * pop; } }
          const w = this.colW - 2 * pad, h = this.cellH - 2 * pad, sw = w * s, sh = h * s, cx = x + this.colW / 2, cy = yy + this.cellH / 2;
          const spr = this.sprite(c.s, w, h, speed && !(R.anim && R.anim.tease && R.anim.teased)); g.globalAlpha = alpha;
          if (tilt) { g.save(); g.translate(cx, cy); g.transform(Math.cos(tilt), Math.sin(tilt) * .18, 0, 1, 0, 0); g.translate(-cx, -cy); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 16; g.shadowOffsetY = 6; }
          if (spr) g.drawImage(spr, cx - sw / 2, cy - sh / 2, sw, speed ? sh * 1.5 : sh); else { g.fillStyle = '#334'; g.fillRect(cx - sw / 2, cy - sh / 2, sw, sh); }
          if (tilt) { g.restore(); g.shadowBlur = 0; g.shadowOffsetY = 0;
            // headlights flash on winning cars (cars face left: lamps at the front-left of the tile)
            if (/^(RV|EC|OU|EV|PH)$/.test(c.s) && Math.sin((now - this.win.t0) / 160 + r) > .2) { g.save(); g.globalCompositeOperation = 'lighter'; for (const [hx, hy] of [[.13, .66], [.2, .7]]) { const lx = cx - sw / 2 + sw * hx, ly = cy - sh / 2 + sh * hy, lr = sw * .16, lg = g.createRadialGradient(lx, ly, 0, lx, ly, lr); lg.addColorStop(0, 'rgba(255,255,235,.95)'); lg.addColorStop(.3, 'rgba(255,250,200,.45)'); lg.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = lg; g.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); } g.restore(); } }
          if (!speed && c.s === 'WD' && c.mult > 1) { const cr = Math.min(w, h) * .23; g.fillStyle = '#ffd84a'; g.strokeStyle = '#7a0010'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx + sw * .34, cy - sh * .3, cr, 0, 7); g.fill(); g.stroke();
            g.fillStyle = '#7a0010'; g.font = `900 ${Math.round(cr * 1.05)}px "Russo One",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×' + c.mult, cx + sw * .34, cy - sh * .29); }
          if (wn) { g.globalAlpha = .85 + .15 * Math.sin((now - this.win.t0) / 120); g.strokeStyle = '#ffe14a'; g.lineWidth = 4; g.shadowColor = '#ffb000'; g.shadowBlur = 18; g.strokeRect(cx - sw / 2 + 2, cy - sh / 2 + 2, sw - 4, sh - 4); g.shadowBlur = 0; }
          { const hk = !speed && !this.win && this.hot.get(r + ',' + i); if (hk) { const ht = (now - hk.t) / 1000, a = Math.min(1, ht * 6) * (.65 + .35 * Math.sin(ht * 10)), col = ['#7fe8ff', '#7fe8ff', '#7fe8ff', '#ffd84a', '#ff9a2a', '#ff4a3a'][Math.min(5, hk.n)];
            g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 2 + hk.n; g.shadowColor = col; g.shadowBlur = 10 + hk.n * 5; g.strokeRect(cx - sw / 2 + 2, cy - sh / 2 + 2, sw - 4, sh - 4); g.shadowBlur = 0; } }
          g.globalAlpha = 1; }
        // glass + depth shading
        const sh2 = g.createLinearGradient(0, 0, 0, this.H); sh2.addColorStop(0, 'rgba(0,0,0,.55)'); sh2.addColorStop(.18, 'rgba(0,0,0,0)'); sh2.addColorStop(.82, 'rgba(0,0,0,0)'); sh2.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = sh2; g.fillRect(x, 0, this.colW, this.H);
        if (speed) { g.fillStyle = 'rgba(255,255,255,.14)'; for (let k = 0; k < 5; k++) { const sx = x + this.colW * (.12 + k * .19), sy = ((now * 1.6 + k * 137) % (this.H + 80)) - 40; g.fillRect(sx, sy, 2, 60); } }
        if (R.anim && R.anim.stopped && now - R.anim.tb < 200) { g.fillStyle = `rgba(255,255,255,${.22 * (1 - (now - R.anim.tb) / 200)})`; g.fillRect(x, 0, this.colW, this.H); }
        if (R.tease) { const tg = .5 + .5 * Math.sin(now / 90); g.strokeStyle = `rgba(255,${120 + tg * 100},0,${.6 + tg * .4})`; g.lineWidth = 5; g.shadowColor = '#ff7a00'; g.shadowBlur = 20; g.strokeRect(x + 2, 2, this.colW - 4, this.H - 4); g.shadowBlur = 0; }
        g.restore(); }
      if (this.win && this.win.ways.length) this.drawWays(g, now);
      // idle shine sweep
      if (!busy && !this.win && now > this.nextShine) { this.shine = now; this.nextShine = now + 5000 + Math.random() * 4000; }
      if (this.shine > 0) { const u = (now - this.shine) / 900; if (u > 1) this.shine = -1; else { const sx = -this.W * .3 + u * this.W * 1.6, gr = g.createLinearGradient(sx - 60, 0, sx + 60, this.H * .3); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H); } }
      if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * .5})`; g.fillRect(0, 0, this.W, this.H); this.flash = Math.max(0, this.flash - .05); }
      for (let i = this.sparks.length - 1; i >= 0; i--) { const p = this.sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += .12; p.life -= .025; if (p.life <= 0) { this.sparks.splice(i, 1); continue; } g.globalAlpha = p.life; g.fillStyle = p.c; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
      g.globalAlpha = 1; }
  }
  window.MadReels = Reels; window.MadReels.img = img; window.MadReels.ready = ready;
})();
