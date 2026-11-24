// GORILLA - canvas reels: curved drum projection, depth shading, glass, motion blur, staggered stops with overshoot + settle,
// anticipation (slow last reel, glowing frame), idle shimmer/glints, landing pops, lock rattle/smash, win pulse/frames/sparkles.
// Purely visual: results come from GorillaMath (game.js), so the math/RTP is untouched.  window.GorillaReels
(function () {
  const SY = () => window.GorillaSymbols, DELTA = .40, TAU = Math.PI * 2;
  const SPECIAL = { WD: 1, CN: 1, DR: 1 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  class Reels {
    constructor(canvas, opts = {}) {
      this.cv = canvas; this.g = canvas.getContext('2d'); this.o = opts; this.rows = 3; this.reels = [0, 1, 2].map(() => ({ strip: [], y: 0, anim: null, pop: {}, tease: false, rattle: {}, respin: false }));
      this.win = null; this.sparks = []; this.pieces = []; this.shimmer = null; this.nextShimmer = performance.now() + 2500; this.sprites = {}; this.blurred = {}; this.frameN = 0; this.flash = 0;
      this.resize(); SY().ready.then(() => { this.sprites = {}; this.blurred = {}; });
      const loop = now => { requestAnimationFrame(loop); this.frameN++; const busy = this.reels.some(r => r.anim || r.respin) || this.win || this.pieces.length || this.sparks.length || this.shimmer || this.flash > 0 || Object.keys(this.reels[0].pop).length + Object.keys(this.reels[1].pop).length + Object.keys(this.reels[2].pop).length;
        if (!busy && this.frameN % 2) return; this.draw(now); }; requestAnimationFrame(loop);
    }
    resize() { const r = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 3); this.dpr = d; this.W = Math.max(30, r.width); this.H = Math.max(30, r.height);
      this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); this.gap = Math.max(3, this.W * .012); this.colW = (this.W - 2 * this.gap) / 3; this.cellH = this.H / this.rows; this.dl = DELTA * 3 / this.rows;
      this.R = (this.H / 2) / Math.sin(1.5 * DELTA); this.sprites = {}; this.blurred = {}; this.bg = null; this.shadeC = null; }
    setGrid(grid) { grid.forEach((col, r) => { const R = this.reels[r]; R.strip = col.map(c => ({ ...c })); R.y = 0; R.anim = null; R.pop = {}; }); }
    // v5 growing reels: change the visible row count (3-7). New rows are filled from the reel (random symbols); the frame itself is resized by the page.
    setRows(n) { if (n === this.rows) return; this.rows = n; this.reels.forEach((R, r) => { const vis = R.strip.slice(Math.round(R.y), Math.round(R.y) + n); while (vis.length < n) vis.push(this.o.randomSym ? this.o.randomSym(r) : { s: 'SP' }); R.strip = vis; R.y = 0; R.anim = null; R.pop = {}; }); this.resize(); }
    visible(r) { const R = this.reels[r]; return R.strip.slice(0, this.rows); }
    // ----- sprites (cached per cell size) -----
    sprite(code) { const k = code; if (this.sprites[k]) return this.sprites[k]; const im = SY().img[code]; if (!im || !im.complete || !im.naturalWidth) return null;
      const s = Math.round(Math.min(this.colW, this.cellH * 1.05) * this.dpr * SY().scale(code)), c = document.createElement('canvas'); c.width = c.height = Math.max(8, s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return (this.sprites[k] = c); }
    blurSprite(code) { if (this.blurred[code]) return this.blurred[code]; const sp = this.sprite(code); if (!sp) return null; const ext = sp.height * .38, H = Math.round(sp.height + ext);
      // smooth vertical motion blur: accumulate shifted copies at 1/6 vertical resolution, then stretch back up (bilinear = no banding)
      const f = 6, lo = document.createElement('canvas'); lo.width = sp.width; lo.height = Math.ceil(H / f); const lg = lo.getContext('2d'); lg.imageSmoothingQuality = 'high';
      const n = 14; for (let i = 0; i < n; i++) { lg.globalAlpha = 1 / (i + 1); lg.drawImage(sp, 0, (ext * i / (n - 1)) / f, sp.width, sp.height / f); }
      const c = document.createElement('canvas'); c.width = sp.width; c.height = H; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(lo, 0, 0, sp.width, lo.height * f); c.ext = ext; return (this.blurred[code] = c); }
    // ----- spin -----
    spin(grid, opts = {}) {
      const rs = this.rs = opts.randomSym || this.o.randomSym, fast = opts.fast || 1, sp = (window.__gorillaSpeed || 1); this.clearWin(); this.quick = false; this.spinT0 = performance.now();
      return Promise.all(this.reels.map((R, r) => new Promise(done => {
        const tease = !!(opts.tease && opts.tease[r]);
        const D = (.95 + r * .38 + (tease ? 1.9 : 0)) * fast * sp, N = Math.max(8, Math.round(17 * (D / sp - .2) * (tease ? .8 : 1)));
        const n = this.rows, vis = Array.from({ length: n }, (_, k) => R.strip[Math.round(R.y) + k] || rs(r));
        R.strip = [...grid[r].map(c => ({ ...c })), ...Array.from({ length: N }, () => rs(r)), ...vis]; R.y = N + n; R.above = rs(r); R.pop = {}; R.rattle = {}; R.tease = false;
        const ov = .2 + Math.random() * .06, td = (tease ? 1.25 : .42) * sp, ta = .16 * sp, wind = .1 * sp;
        R.anim = { t0: performance.now() / 1000, y0: R.y, D, ov, td, ta, wind, done, r, tease, landed: false, onStop: opts.onStop, teaseOn: opts.onTease };
        R.anim.vmax = (R.anim.y0 + ov) / (D - ta / 2 - td / 2);
      })));
    }
    stopNow() { if (this.quick) return; this.quick = true; const now = performance.now() / 1000;
      this.reels.forEach((R, r) => { const a = R.anim; if (!a || a.settle) return; const t = now - a.t0 - a.wind; if (t > a.D - a.td && !a.tease) return;
        const n = this.rows, yi = Math.floor(R.y), frac = R.y - yi, vis = R.strip.slice(yi, yi + n + 1), grid = R.strip.slice(0, n), fill = [0, 1, 2].map(() => this.rs(r));
        R.strip = [...grid, ...fill, ...vis]; R.y = n + 3 + frac; const td = (.2 + r * .07) * (window.__gorillaSpeed || 1);
        Object.assign(a, { t0: now, wind: 0, y0: R.y, D: td + .02, ta: .02, td, tease: false }); a.vmax = (a.y0 + a.ov) / (a.D - a.ta / 2 - a.td / 2); R.tease = false; }); }
    // GORILLA PUNCH nudge: reel r jolts ONE stop (dir +1 = drops, the symbol above enters at the top; -1 = climbs), hard bounce, rock debris.
    // col = the final 3 cells. Resolves when the reel has settled.
    nudge(r, dir, col) { const R = this.reels[r], cur = R.strip.slice(0, 3).map(c => ({ ...c })), fin = col.map(c => ({ ...c }));
      if (dir > 0) { R.strip = [fin[0], ...cur]; R.y = 1; } else { R.strip = [...cur, fin[2], this.rs ? this.rs(r) : { ...cur[0] }]; R.y = 0; }
      const sp = window.__gorillaSpeed || 1, now = performance.now() / 1000; this.nudgeT = performance.now();
      return new Promise(done => { R.anim = { nudge: true, t0: now, from: R.y, to: dir > 0 ? 0 : 1, dur: .13 * sp, ov: .16 * dir, done: () => { R.strip = fin; R.y = 0; R.pop = { 0: performance.now(), 1: performance.now(), 2: performance.now() }; done(); } };
        const { x, w } = this.cellBox(r, 0); this.flash = .8;
        for (let i = 0; i < 34; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, s = 120 + Math.random() * 380; this.pieces.push({ kind: i % 3 ? 'rock' : 'spark', x: x + w * (.15 + Math.random() * .7), y: dir > 0 ? 4 : this.H - 4, vx: Math.cos(a) * s * .6, vy: (dir > 0 ? -1 : -1.3) * Math.abs(Math.sin(a) * s), t: 0, life: .7 + Math.random() * .6, r: 1.5 + Math.random() * 3.5, rot: Math.random() * 6, vr: (Math.random() - .5) * 14 }); } }); }
    stepAnim(R, nowS) { const a = R.anim; if (!a) return 0;
      if (a.nudge) { const u = (nowS - a.t0) / a.dur, span = a.to - a.from;
        if (u < 1) { const e = u * u * (3 - 2 * u) * .3 + u * .7; R.y = a.from + span * e; return Math.abs(span) / a.dur * 1.4; }
        const v = nowS - a.t0 - a.dur; if (v > .38) { R.anim = null; R.y = a.to; a.done(); return 0; }
        R.y = a.to - a.ov * Math.exp(-v / .07) * Math.cos(Math.PI * v / .12); return 0; }
      let t = nowS - a.t0;
      if (a.settle != null) { const u = nowS - a.settle; if (u > .34) { R.y = 0; R.anim = null; a.done(); return 0; } R.y = -a.ov * Math.exp(-u / .085) * Math.cos(Math.PI * u / .2); return 0; }
      if (t < a.wind) { R.y = a.y0 + .12 * Math.sin(Math.PI * t / a.wind); return 2; } t -= a.wind;
      const { vmax, ta, td, D } = a; let d;
      if (t < ta) d = vmax * t * t / (2 * ta); else if (t < D - td) d = vmax * ta / 2 + vmax * (t - ta); else { const tt = Math.min(t, D) - (D - td); d = vmax * ta / 2 + vmax * (D - td - ta) + vmax * (tt - tt * tt / (2 * td)); }
      if (a.tease && !R.tease && t > D - td - .9) { R.tease = true; a.teaseOn && a.teaseOn(a.r, td + .9); }
      R.y = a.y0 - d; const v = t < ta ? vmax * t / ta : t < D - td ? vmax : vmax * (1 - (Math.min(t, D) - (D - td)) / td);
      if (t >= D) { R.y = -a.ov; a.settle = nowS; R.tease = false; this.land(R, a.r); }
      return v; }
    land(R, r) { const now = performance.now(); let special = false;
      for (let y = 0; y < this.rows; y++) { const c = R.strip[y]; R.pop[y] = now; if (c.s === 'CN' && c.locked) R.rattle[y] = now; if (SPECIAL[c.s] || c.mult > 1 || c.locked) special = true; }
      if (special) this.flash = Math.max(this.flash, .45); R.anim.onStop && R.anim.onStop(r, R.strip.slice(0, this.rows)); }
    // punch-nudge: a fire/ember column over the struck reel
    fireCol(r) { this.fire = { r, t0: performance.now() }; this.flash = 1; }
    // ----- wins / effects -----
    setWin(cells) { this.win = cells && cells.size ? { cells, t0: performance.now() } : null; }
    clearWin() { this.win = null; this.sparks = []; }
    winCount() { return this.win ? this.win.cells.size : 0; }
    smash() { const now = performance.now(); this.locksGone = 0;
      this.reels.forEach((R, r) => R.strip.slice(0, this.rows).forEach((c, y) => { if (c.s === 'CN' && c.locked) { c.locked = false; c.smashed = now; this.locksGone++; const { x, y: cy, w, h } = this.cellBox(r, y);
        for (let i = 0; i < 2; i++) this.pieces.push({ kind: 'lock', half: i, x: x + w / 2, y: cy + h / 2, vx: (i ? 1 : -1) * (60 + Math.random() * 80), vy: -220 - Math.random() * 120, rot: 0, vr: (i ? 1 : -1) * (4 + Math.random() * 4), t: 0, w });
        for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = 80 + Math.random() * 260; this.pieces.push({ kind: 'spark', x: x + w / 2, y: cy + h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, life: .5 + Math.random() * .5 }); } } })); this.flash = 1; }
    // ----- v5 features -----
    // one reel spins alone (coin respins); col = final cells (rows long). Resolves when it has settled.
    spinReel(r, col, opts = {}) { const R = this.reels[r], rs = opts.randomSym || this.rs || this.o.randomSym, sp = window.__gorillaSpeed || 1, n = this.rows;
      return new Promise(done => { const D = (opts.dur || .9) * sp, N = Math.max(8, Math.round(17 * (D / sp - .2)));
        const vis = Array.from({ length: n }, (_, k) => R.strip[Math.round(R.y) + k] || rs(r)); R.strip = [...col.map(c => ({ ...c })), ...Array.from({ length: N }, () => rs(r)), ...vis]; R.y = N + n; R.above = rs(r); R.pop = {}; R.rattle = {};
        const ov = .18, td = .38 * sp, ta = .12 * sp; R.anim = { t0: performance.now() / 1000, y0: R.y, D, ov, td, ta, wind: .06 * sp, done, r, tease: false, landed: false, onStop: opts.onStop };
        R.anim.vmax = (R.anim.y0 + ov) / (D - ta / 2 - td / 2); }); }
    // coin respins: reel r glows blue and respins once per step. Existing coins and symbols stay put; a hit lands a new
    // coin on a free row (middle first); a miss keeps the current column. Never write a blank 'NO' cell into the final grid.
    async respin(r, steps, opts = {}) { const R = this.reels[r], mid = Math.floor(this.rows / 2); R.respin = true; this.respinR = r;
      const fill = () => { const src = opts.holdSym || this.o.randomSym || this.rs; const c = src ? src(r) : { s: 'SP' }; return (!c || !c.s || c.s === 'NO') ? { s: 'SP' } : { ...c }; };
      try { let col = R.strip.slice(0, this.rows).map(c => (c && c.s && c.s !== 'NO') ? { ...c } : fill());
        for (const st of steps) { let placed = -1;
          if (st) { let y = (col[mid] && col[mid].s !== 'CN') ? mid : col.findIndex(c => !c || c.s !== 'CN'); if (y < 0) y = mid;
            col = col.map((c, i) => i === y ? { ...st } : (c && c.s && c.s !== 'NO' ? { ...c } : fill())); placed = y; }
          else col = col.map(c => (c && c.s && c.s !== 'NO') ? { ...c } : fill());
          await this.spinReel(r, col, { randomSym: opts.randomSym, dur: opts.dur });
          if (st && placed >= 0) { R.pop[placed] = performance.now(); this.flash = .5; this.burstAt(r, placed, 24, 'spark'); }
          if (opts.onStep) await opts.onStep(st, placed); }
      } finally { R.respin = false; } }
    // Totem Stacks: cells turn into one symbol with a golden flash
    transform(cells, s) { const now = performance.now(); for (const [r, y] of cells) { const R = this.reels[r]; if (!R.strip[y]) continue; R.strip[y] = { s }; R.pop[y] = now; this.burstAt(r, y, 14, 'spark'); } this.flash = .55; }
    // thunder wild: the multiplier stamps onto the (plain) wild
    stamp(r, y, mult) { const R = this.reels[r], c = R.strip[y]; if (!c) return; c.mult = mult; c.stamped = performance.now(); R.pop[y] = performance.now(); this.flash = .9; this.burstAt(r, y, 40, 'spark'); }
    pulse(r, y) { this.reels[r].pop[y] = performance.now(); this.burstAt(r, y, 16, 'spark'); }
    burstAt(r, y, n, kind) { const { x, y: cy, w, h } = this.cellBox(r, y); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 80 + Math.random() * 260; this.pieces.push({ kind, x: x + w / 2, y: cy + h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, life: .45 + Math.random() * .5 }); } }
    respinGlow(g, x0, t) { const p = .6 + .4 * Math.sin(t * 9); g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#3aa8ff'; g.shadowBlur = 26; g.lineWidth = 4 + 2 * p; g.strokeStyle = `rgba(90,${170 + 60 * p | 0},255,${.7 + .3 * p})`; g.strokeRect(x0 + 3, 3, this.colW - 6, this.H - 6);
      const gr = g.createLinearGradient(0, this.H, 0, 0); gr.addColorStop(0, `rgba(40,120,255,${.3 * p})`); gr.addColorStop(.5, 'rgba(40,120,255,.05)'); gr.addColorStop(1, `rgba(40,120,255,${.3 * p})`); g.fillStyle = gr; g.fillRect(x0, 0, this.colW, this.H); g.restore(); }
    cellBox(r, y) { return { x: r * (this.colW + this.gap), y: y * this.cellH, w: this.colW, h: this.cellH }; }
    cellRect(r, y) { const b = this.cv.getBoundingClientRect(), c = this.cellBox(r, y); return { left: b.left + c.x, top: b.top + c.y, width: c.w, height: c.h }; }
    // ----- drawing -----
    background() { if (this.bg) return this.bg; const c = document.createElement('canvas'), d = this.dpr; c.width = this.cv.width; c.height = this.cv.height; const g = c.getContext('2d'); g.scale(d, d);
      const u = 3 / Math.max(3, this.rows); // keep the 3-row look; on 4–7 row reels the mid tone covers the inner rows
      for (let r = 0; r < 3; r++) { const x = r * (this.colW + this.gap), gr = g.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, '#0b0503'); gr.addColorStop(.5 * u, '#2a140b'); gr.addColorStop(1 - .5 * u, '#2a140b'); gr.addColorStop(1, '#0b0503'); g.fillStyle = gr; g.fillRect(x, 0, this.colW, this.H);
        const rg = g.createRadialGradient(x + this.colW / 2, this.H / 2, 0, x + this.colW / 2, this.H / 2, this.H * .6); rg.addColorStop(0, 'rgba(120,60,20,.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x, 0, this.colW, this.H); }
      // reel dividers (bronze bevel)
      for (let r = 1; r < 3; r++) { const x = r * (this.colW + this.gap) - this.gap, gr = g.createLinearGradient(x, 0, x + this.gap, 0); gr.addColorStop(0, '#2a1404'); gr.addColorStop(.45, '#d9a441'); gr.addColorStop(.55, '#8a5a14'); gr.addColorStop(1, '#1a0a02'); g.fillStyle = gr; g.fillRect(x, 0, this.gap, this.H); }
      this.bg = c; return c; }
    shade() { if (this.shadeC && this.shadeC.width === this.cv.width && this.shadeC.height === this.cv.height && this.shadeC.rows === this.rows) return this.shadeC; const c = document.createElement('canvas'), d = this.dpr; c.width = this.cv.width; c.height = this.cv.height; const g = c.getContext('2d'); g.scale(d, d);
      // Cylinder lip in row units (0.17/0.36 of a 3-row reel ≈ 0.5/1.1 rows). Grown reels keep a thin edge curve so every row stays evenly bright.
      const u = 3 / Math.max(3, this.rows), a = .17 * u, b = .36 * u, gloss = this.H * .3 * u;
      for (let r = 0; r < 3; r++) { const x = r * (this.colW + this.gap), gr = g.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, 'rgba(0,0,0,.82)'); gr.addColorStop(a, 'rgba(0,0,0,.32)'); gr.addColorStop(b, 'rgba(0,0,0,0)'); gr.addColorStop(1 - b, 'rgba(0,0,0,0)'); gr.addColorStop(1 - a, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = gr; g.fillRect(x, 0, this.colW, this.H);
        const sg = g.createLinearGradient(x, 0, x + this.colW, 0); sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(.1, 'rgba(0,0,0,0)'); sg.addColorStop(.9, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = sg; g.fillRect(x, 0, this.colW, this.H); }
      // glass: top gloss + diagonal reflection
      const gl = g.createLinearGradient(0, 0, 0, gloss); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, this.W, gloss);
      g.save(); g.beginPath(); g.moveTo(this.W * .08, 0); g.lineTo(this.W * .30, 0); g.lineTo(this.W * .12, this.H); g.lineTo(-this.W * .1, this.H); g.closePath(); const dg = g.createLinearGradient(0, 0, this.W * .3, 0); dg.addColorStop(0, 'rgba(255,255,255,0)'); dg.addColorStop(.5, 'rgba(255,255,255,.05)'); dg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = dg; g.fill(); g.restore();
      c.rows = this.rows; this.shadeC = c; return c; }
    draw(nowMs) { const g = this.g, d = this.dpr, nowS = nowMs / 1000, t = nowS; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); g.drawImage(this.background(), 0, 0); g.setTransform(d, 0, 0, d, 0, 0);
      const cy = this.H / 2;
      this.reels.forEach((R, r) => { const v = this.stepAnim(R, nowS), x0 = r * (this.colW + this.gap), blur = clamp((v - 7) / 10, 0, 1);
        g.save(); g.beginPath(); g.rect(x0, 0, this.colW, this.H); g.clip();
        const i0 = Math.floor(R.y) - 1, n = this.rows, DL = this.dl;
        for (let i = i0; i <= i0 + n + 2; i++) { const c = i < 0 ? R.above : R.strip[i]; if (!c) continue; const p = i - R.y - (n - 1) / 2, a = p * DL; if (Math.abs(a) > 1.2) continue;
          const top = cy + this.R * Math.sin(a - DL / 2), bot = cy + this.R * Math.sin(a + DL / 2), h = bot - top, sq = h / this.cellH, yc = (top + bot) / 2, row = Math.round(i - R.y);
          const settled = !R.anim && i >= 0 && i < n, win = this.win && settled && this.win.cells.has(r + ',' + i), dim = this.win && settled && !win;
          let sc = 1, rot = 0; if (settled && R.pop[i]) { const u = (nowMs - R.pop[i]) / 1000; if (u > .6) delete R.pop[i]; else sc = 1 + .2 * Math.exp(-u * 7) * Math.cos(u * 16); }
          if (win) sc *= 1 + .06 * (.5 + .5 * Math.sin((nowMs - this.win.t0) / 1000 * 7.5));
          if (c.s === 'CN' && c.locked && R.rattle[i]) { const u = (nowMs - R.rattle[i]) / 1000; if (u > .8) delete R.rattle[i]; else rot = .16 * Math.exp(-u * 4.5) * Math.sin(u * 38); }
          this.drawCell(g, c, x0 + this.colW / 2, yc, sq, sc, blur, nowMs, settled, rot, r, i);
          if (dim) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0, top, this.colW, h); } }
        g.restore();
        if (R.tease) this.teaseGlow(g, x0, t); if (R.respin) this.respinGlow(g, x0, t); });
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.shade(), 0, 0); g.setTransform(d, 0, 0, d, 0, 0);
      if (this.win) this.drawWin(g, nowMs);
      this.drawShimmer(g, nowMs); this.drawPieces(g, nowS);
      if (this.fire) { const u = (nowMs - this.fire.t0) / 750; if (u >= 1) this.fire = null; else { const x = this.fire.r * (this.colW + this.gap), p = 1 - u, gy = g.createLinearGradient(0, this.H, 0, 0);
        gy.addColorStop(0, `rgba(255,80,0,${.75 * p})`); gy.addColorStop(.45, `rgba(255,180,40,${.45 * p})`); gy.addColorStop(1, 'rgba(255,240,160,0)');
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gy; g.fillRect(x, 0, this.colW, this.H);
        g.shadowColor = '#ff9a00'; g.shadowBlur = 28; g.strokeStyle = `rgba(255,220,120,${.7 * p})`; g.lineWidth = 5; g.strokeRect(x + 2, 2, this.colW - 4, this.H - 4); g.restore(); } }
      if (this.flash > 0) { g.fillStyle = `rgba(255,220,150,${this.flash * .35})`; g.fillRect(0, 0, this.W, this.H); this.flash -= .05; } }
    drawCell(g, c, cx, cy, sq, sc, blur, nowMs, settled, rot, r, i) {
      const sp = blur > .5 ? this.blurSprite(c.s) : this.sprite(c.s); if (!sp) return; const w = sp.width / this.dpr * sc, h = (blur > .5 ? sp.height : sp.width) / this.dpr * sc * sq;
      g.save(); g.translate(cx, cy); if (rot) g.rotate(rot);
      if (blur > .5) { g.globalAlpha = .55 + .45 * (1 - blur); g.drawImage(sp, -w / 2, -(sp.width / this.dpr * sc * sq) / 2 - sp.ext / this.dpr * sc * sq * .5, w, h); }
      else { if (blur > 0) g.globalAlpha = 1 - blur * .4; g.drawImage(sp, -w / 2, -h / 2, w, h); }
      g.globalAlpha = 1;
      if (blur < .5) { const fs = Math.min(this.colW, this.cellH) * .2;
        if (c.s === 'DR' && settled) { const p = .55 + .45 * Math.sin(nowMs / 150); g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#ffb000'; g.shadowBlur = 14 + 12 * p; g.strokeStyle = `rgba(255,200,70,${.4 + .4 * p})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, w * .47, 0, TAU); g.stroke(); g.restore(); }
        if (c.s === 'WD' && c.mult > 1) { const u = c.stamped ? Math.max(0, 1 - (nowMs - c.stamped) / 700) : 0; this.multBadge(g, '×' + c.mult, 0, h * .32, Math.min(this.colW, this.cellH) * (.23 + u * .16) * sq, u); }
        if (c.s === 'CN' && c.jp) { const JC = { bronze: ['#ffb27a', '#5a2408'], silver: ['#ffffff', '#3a3a48'] }[c.jp] || ['#fff', '#000']; g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = JC[0]; g.shadowBlur = 18; g.strokeStyle = JC[0]; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, w * .44, 0, TAU); g.stroke(); g.restore();
          this.label(g, c.jp.toUpperCase(), 0, -h * .02, fs * .62 * sq, JC[0], JC[1]); this.label(g, this.o.coinText ? this.o.coinText(c) : String(c.coin), 0, h * .2, fs * .55 * sq, '#3a1c00', '#ffe9a0', true); }
        else if (c.s === 'CN' && c.coin != null) { this.label(g, this.o.coinText ? this.o.coinText(c) : String(c.coin), 0, h * .03, fs * .95 * sq, '#3a1c00', '#ffe9a0', true);
          if (c.locked) { const pulse = .6 + .4 * Math.sin(nowMs / 140), Ch = this.sprite('CHAIN'), L = this.sprite('LOCK');
            g.fillStyle = `rgba(0,0,0,${.38 + .08 * pulse})`; g.beginPath(); g.arc(0, 0, w * .46, 0, TAU); g.fill();
            if (Ch) { const cw = Ch.width / this.dpr * 1.08; g.drawImage(Ch, -cw / 2, -cw / 2 * sq, cw, cw * sq); }
            if (L) { const lw = L.width / this.dpr * .78; g.drawImage(L, -lw / 2, -lw / 2 * sq, lw, lw * sq); }
            g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,190,80,${.3 + .35 * pulse})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, w * .45, 0, TAU); g.stroke(); g.restore(); }
          else if (c.smashed && nowMs - c.smashed < 900) { const u = (nowMs - c.smashed) / 900; g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,210,120,${(1 - u) * .7})`; g.beginPath(); g.arc(0, 0, w * (.3 + u * .4), 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; } } }
      g.restore(); }
    label(g, txt, x, y, size, fill, stroke, thin) { g.font = `900 ${Math.max(9, size)}px "Arial Black", Impact, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * (thin ? .2 : .28); g.strokeStyle = stroke; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y); }
    // gold multiplier medallion (2× / 3× / 5× / 10×) — large enough to read on a phone
    multBadge(g, txt, x, y, r, pop) { g.save(); g.translate(x, y); const s = 1 + pop * .7; g.scale(s, s); g.shadowColor = '#ffb000'; g.shadowBlur = 12 + 16 * pop;
      const grd = g.createRadialGradient(0, -r * .25, r * .1, 0, 0, r); grd.addColorStop(0, '#fff4c0'); grd.addColorStop(.45, '#ffc94a'); grd.addColorStop(1, '#8a3a00');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.lineWidth = Math.max(2, r * .12); g.strokeStyle = '#5a1500'; g.stroke();
      g.shadowBlur = 0; this.label(g, txt, 0, 0, r * 1.05, '#3a0c00', '#fff4c0'); g.restore(); }
    teaseGlow(g, x0, t) { const p = .6 + .4 * Math.sin(t * 14); g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = '#ff7a00'; g.shadowBlur = 24; g.lineWidth = 4 + 3 * p; g.strokeStyle = `rgba(255,${150 + 80 * p | 0},40,${.65 + .35 * p})`; g.strokeRect(x0 + 3, 3, this.colW - 6, this.H - 6);
      const gr = g.createLinearGradient(0, this.H, 0, 0); gr.addColorStop(0, `rgba(255,90,0,${.35 * p})`); gr.addColorStop(.5, 'rgba(255,90,0,0)'); g.fillStyle = gr; g.fillRect(x0, 0, this.colW, this.H); g.restore(); }
    drawWin(g, nowMs) { const u = (nowMs - this.win.t0) / 1000; g.save(); g.globalCompositeOperation = 'lighter';
      for (const k of this.win.cells) { const [r, y] = k.split(',').map(Number), b = this.cellBox(r, y), pad = 3, p = .5 + .5 * Math.sin(u * 7.5);
        g.shadowColor = '#ffb300'; g.shadowBlur = 14 + 10 * p; g.lineWidth = 3; g.strokeStyle = `rgba(255,${200 + 40 * p | 0},90,${.75 + .25 * p})`; this.rrect(g, b.x + pad, b.y + pad, b.w - 2 * pad, b.h - 2 * pad, 10); g.stroke();
        // running light around the frame
        g.shadowBlur = 0; g.setLineDash([b.w * .25, b.w * 1.2]); g.lineDashOffset = -u * b.w * 2.2; g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,230,.95)'; this.rrect(g, b.x + pad, b.y + pad, b.w - 2 * pad, b.h - 2 * pad, 10); g.stroke(); g.setLineDash([]);
        if (Math.random() < .35) this.sparks.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h, t: 0, life: .5 + Math.random() * .6, s: 3 + Math.random() * 6 }); }
      g.restore(); }
    rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    star(g, x, y, s, a, rot = 0) { g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a; const gr = g.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,230,160,.7)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s); g.fill(); g.beginPath(); g.arc(0, 0, s * .28, 0, TAU); g.fill(); g.restore(); }
    drawShimmer(g, nowMs) { const busy = this.reels.some(R => R.anim || R.respin);
      if (!busy && !this.shimmer && nowMs > this.nextShimmer) { const opts = []; this.reels.forEach((R, r) => R.strip.slice(0, this.rows).forEach((c, y) => opts.push({ r, y, c, w: SPECIAL[c.s] || /RB|EM|SP|SB/.test(c.s) ? 3 : 1 }))); let k = Math.random() * opts.reduce((a, o) => a + o.w, 0); const pick = opts.find(o => (k -= o.w) <= 0) || opts[0];
        if (pick) { this.shimmer = { ...pick, t0: nowMs, gx: .25 + Math.random() * .3, gy: .2 + Math.random() * .3 }; if (this.o.onGlint && Math.random() < .5) this.o.onGlint(); } this.nextShimmer = nowMs + 1800 + Math.random() * 2800; }
      const s = this.shimmer; this.sparks = this.sparks.filter(p => (p.t += 1 / 60) < p.life);
      g.save(); g.globalCompositeOperation = 'lighter'; for (const p of this.sparks) { const a = Math.sin(Math.PI * p.t / p.life); this.star(g, p.x, p.y, p.s, a, p.t * 3); } g.restore();
      if (!s) return; const u = (nowMs - s.t0) / 900; if (u > 1 || busy) { this.shimmer = null; return; }
      const sp = this.sprite(s.c.s); if (!sp || s.y >= this.rows) { this.shimmer = null; return; } const b = this.cellBox(s.r, s.y), w = sp.width / this.dpr;
      if (!this.tmp) this.tmp = document.createElement('canvas'); const T = this.tmp; T.width = sp.width; T.height = sp.height; const tg = T.getContext('2d'); tg.drawImage(sp, 0, 0); tg.globalCompositeOperation = 'source-in';
      const bx = (u * 1.6 - .3) * T.width, gr = tg.createLinearGradient(bx - T.width * .25, 0, bx + T.width * .25, T.height * .4); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,250,225,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); tg.fillStyle = gr; tg.fillRect(0, 0, T.width, T.height);
      g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(T, b.x + (b.w - w) / 2, b.y + (b.h - w) / 2, w, w); this.star(g, b.x + b.w * (s.gx + .1), b.y + b.h * s.gy, Math.min(b.w, b.h) * .22, Math.sin(Math.PI * u), u * 2); g.restore(); }
    drawPieces(g, nowS) { if (!this.pieces.length) return; const dt = 1 / 60, L = this.sprite('LOCK');
      this.pieces = this.pieces.filter(p => { p.t += dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'lock') { if (p.t > 1.2 || !L) return false; p.rot += p.vr * dt; const lw = L.width / this.dpr; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - p.t / 1.2); g.beginPath(); g.rect(p.half ? 0 : -lw / 2, -lw / 2, lw / 2, lw); g.clip(); g.drawImage(L, -lw / 2, -lw / 2, lw, lw); g.restore(); return true; }
        if (p.kind === 'rock') { if (p.t > p.life) return false; p.rot += p.vr * dt; const al = Math.max(0, 1 - p.t / p.life); g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = `rgba(${70 + p.r * 8 | 0},${48 + p.r * 5 | 0},${32 + p.r * 3 | 0},${al})`; g.beginPath(); g.moveTo(-p.r, -p.r * .6); g.lineTo(p.r * .8, -p.r); g.lineTo(p.r, p.r * .5); g.lineTo(-p.r * .4, p.r); g.closePath(); g.fill(); g.restore(); return true; }
        if (p.t > p.life) return false; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,${180 + 60 * Math.random() | 0},80,${1 - p.t / p.life})`; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, TAU); g.fill(); g.restore(); return true; }); }
  }
  window.GorillaReels = Reels;
})();
