// MITSUBISHI MADNESS - canvas reels (5 x 3): wind-back start, motion blur, staggered stops with overshoot, tease (slow, glowing) reels,
// landing pops for specials, win pulse + dimming, wild multiplier chips, drift-wild reel transform. Purely visual. window.MadReels
(function () {
  const CODES = ['RV', 'EC', 'OU', 'EV', 'PH', 'WD', 'FL', 'PL'], V = '2';
  const img = {}, ready = Promise.all(CODES.map(c => new Promise(r => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => r(); i.src = `/madness/art/${c}@2x.webp?v=${V}`; img[c] = i; })));
  const SPECIAL = { WD: 1, FL: 1, PL: 1 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  class Reels {
    constructor(cv, o = {}) { this.cv = cv; this.g = cv.getContext('2d'); this.o = o; this.n = 5; this.rows = 3;
      this.reels = [...Array(5)].map(() => ({ list: [], pos: 0, anim: null, pop: {}, tease: false }));
      this.win = null; this.blur = {}; this.sparks = []; this.flash = 0; this.dim = 0; this.glow = [0, 0, 0, 0, 0]; this.shine = -1; this.nextShine = performance.now() + 3000;
      this.resize(); ready.then(() => { this.blur = {}; this.dirty = true; });
      const loop = now => { requestAnimationFrame(loop); this.draw(now); }; requestAnimationFrame(loop); }
    resize() { const r = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2.5); this.dpr = d; this.W = Math.max(40, r.width); this.H = Math.max(30, r.height);
      this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); this.gap = Math.max(2, this.W * .008); this.colW = (this.W - 4 * this.gap) / 5; this.cellH = this.H / 3; this.blur = {}; }
    setGrid(grid) { grid.forEach((col, r) => { const R = this.reels[r]; R.list = col.map(c => ({ ...c })); R.pos = 0; R.anim = null; R.pop = {}; }); }
    visible(r) { const R = this.reels[r]; return R.list.slice(Math.round(R.pos), Math.round(R.pos) + 3); }
    // spin to `grid`. o: { fast, tease:[5 bools], onStop(r, cells), onTease(r) }
    spin(grid, o = {}) { const sp = window.__madSpeed || 1, fast = o.fast || 1; this.clearWin(); this.stopping = false;
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
    setWin(cells) { this.win = { cells, t0: performance.now() }; }
    clearWin() { this.win = null; }
    transformReel(r, cells) { const R = this.reels[r]; R.list = cells.map(c => ({ ...c })); R.pos = 0; const t = performance.now(); [0, 1, 2].forEach(y => R.pop[y] = t + y * 90); this.flash = 1;
      for (let k = 0; k < 40; k++) this.sparks.push({ x: (r + .5) * (this.colW + this.gap), y: Math.random() * this.H, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, life: 1, c: Math.random() < .5 ? '#ff3048' : '#ffd84a' }); }
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
          let wn = false; if (this.win && !speed) { wn = this.win.cells.has(r + ',' + i); if (!wn) alpha = .38; else s *= 1 + .06 * Math.sin((now - this.win.t0) / 140); }
          const w = this.colW - 2 * pad, h = this.cellH - 2 * pad, sw = w * s, sh = h * s, cx = x + this.colW / 2, cy = yy + this.cellH / 2;
          const spr = this.sprite(c.s, w, h, speed && !(R.anim && R.anim.tease && R.anim.teased)); g.globalAlpha = alpha;
          if (spr) g.drawImage(spr, cx - sw / 2, cy - sh / 2, sw, speed ? sh * 1.5 : sh); else { g.fillStyle = '#334'; g.fillRect(cx - sw / 2, cy - sh / 2, sw, sh); }
          if (!speed && c.s === 'WD' && c.mult > 1) { const cr = Math.min(w, h) * .23; g.fillStyle = '#ffd84a'; g.strokeStyle = '#7a0010'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx + sw * .34, cy - sh * .3, cr, 0, 7); g.fill(); g.stroke();
            g.fillStyle = '#7a0010'; g.font = `900 ${Math.round(cr * 1.05)}px "Russo One",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×' + c.mult, cx + sw * .34, cy - sh * .29); }
          if (wn) { g.globalAlpha = .6 + .4 * Math.sin((now - this.win.t0) / 120); g.strokeStyle = '#ffe14a'; g.lineWidth = 3; g.shadowColor = '#ffb000'; g.shadowBlur = 14; g.strokeRect(cx - sw / 2 + 1, cy - sh / 2 + 1, sw - 2, sh - 2); g.shadowBlur = 0; }
          g.globalAlpha = 1; }
        // glass + depth shading
        const sh2 = g.createLinearGradient(0, 0, 0, this.H); sh2.addColorStop(0, 'rgba(0,0,0,.55)'); sh2.addColorStop(.18, 'rgba(0,0,0,0)'); sh2.addColorStop(.82, 'rgba(0,0,0,0)'); sh2.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = sh2; g.fillRect(x, 0, this.colW, this.H);
        if (R.tease) { const tg = .5 + .5 * Math.sin(now / 90); g.strokeStyle = `rgba(255,${120 + tg * 100},0,${.6 + tg * .4})`; g.lineWidth = 5; g.shadowColor = '#ff7a00'; g.shadowBlur = 20; g.strokeRect(x + 2, 2, this.colW - 4, this.H - 4); g.shadowBlur = 0; }
        g.restore(); }
      // idle shine sweep
      if (!busy && !this.win && now > this.nextShine) { this.shine = now; this.nextShine = now + 5000 + Math.random() * 4000; }
      if (this.shine > 0) { const u = (now - this.shine) / 900; if (u > 1) this.shine = -1; else { const sx = -this.W * .3 + u * this.W * 1.6, gr = g.createLinearGradient(sx - 60, 0, sx + 60, this.H * .3); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H); } }
      if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * .5})`; g.fillRect(0, 0, this.W, this.H); this.flash = Math.max(0, this.flash - .05); }
      for (let i = this.sparks.length - 1; i >= 0; i--) { const p = this.sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += .12; p.life -= .025; if (p.life <= 0) { this.sparks.splice(i, 1); continue; } g.globalAlpha = p.life; g.fillStyle = p.c; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
      g.globalAlpha = 1; }
  }
  window.MadReels = Reels; window.MadReels.img = img; window.MadReels.ready = ready;
})();
