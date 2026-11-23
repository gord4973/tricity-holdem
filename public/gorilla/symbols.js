// GORILLA - original reel symbol art drawn with canvas 2D. window.GorillaSymbols.get(code) -> dataURL (256px)
(function () {
  const S = 256, cache = {};
  function base(g, c1, c2) { const r = g.createRadialGradient(128, 110, 10, 128, 128, 140); r.addColorStop(0, c1); r.addColorStop(1, c2); g.fillStyle = r; g.fillRect(0, 0, S, S); }
  function gloss(g) { const l = g.createLinearGradient(0, 0, 0, S); l.addColorStop(0, 'rgba(255,255,255,.22)'); l.addColorStop(.45, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, S, S); }
  function gem(g, col, dark, shape) { // faceted gem
    g.save(); g.translate(128, 132); const pts = shape === 'oct' ? [[-70, -40], [-40, -78], [40, -78], [70, -40], [70, 40], [40, 78], [-40, 78], [-70, 40]] : shape === 'tri' ? [[0, -88], [84, 60], [-84, 60]] : [[0, -90], [74, -20], [46, 80], [-46, 80], [-74, -20]];
    g.shadowColor = col; g.shadowBlur = 30; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); const lg = g.createLinearGradient(-80, -80, 80, 80); lg.addColorStop(0, '#fff'); lg.addColorStop(.25, col); lg.addColorStop(1, dark); g.fillStyle = lg; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.stroke();
    const inner = pts.map(([x, y]) => [x * .5, y * .5 - 6]); g.beginPath(); inner.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.stroke();
    pts.forEach(([x, y], i) => { g.beginPath(); g.moveTo(x, y); g.lineTo(inner[i][0], inner[i][1]); g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(-22, -40, 12, 6, -.6, 0, 7); g.fill(); g.restore(); }
  function txt(g, t, y, size, fill, stroke) { g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size / 6; g.strokeStyle = stroke || '#2a0d00'; g.strokeText(t, 128, y); g.fillStyle = fill; g.fillText(t, 128, y); }
  function goldFill(g, y0, y1) { const l = g.createLinearGradient(0, y0, 0, y1); l.addColorStop(0, '#fff6c2'); l.addColorStop(.35, '#ffcf3a'); l.addColorStop(.7, '#c27a06'); l.addColorStop(1, '#ffe17a'); return l; }
  const ART = {
    SB(g) { base(g, '#5b3a23', '#120804'); // silverback face emblem
      g.save(); g.translate(128, 136); g.fillStyle = '#2b2622'; g.beginPath(); g.moveTo(0, -100); g.bezierCurveTo(70, -100, 92, -40, 88, 10); g.bezierCurveTo(86, 70, 50, 96, 0, 96); g.bezierCurveTo(-50, 96, -86, 70, -88, 10); g.bezierCurveTo(-92, -40, -70, -100, 0, -100); g.fill();
      const sg = g.createLinearGradient(0, -100, 0, -20); sg.addColorStop(0, '#b9b2a8'); sg.addColorStop(1, 'rgba(120,110,100,0)'); g.fillStyle = sg; g.fill();
      g.fillStyle = '#17110e'; g.beginPath(); g.moveTo(-62, -18); g.quadraticCurveTo(0, -46, 62, -18); g.quadraticCurveTo(66, 0, 50, 4); g.quadraticCurveTo(0, -14, -50, 4); g.quadraticCurveTo(-66, 0, -62, -18); g.fill(); // brow
      g.fillStyle = '#3a2f29'; g.beginPath(); g.ellipse(0, 46, 58, 44, 0, 0, 7); g.fill(); // muzzle
      for (const s of [-1, 1]) { g.fillStyle = '#e8a33a'; g.beginPath(); g.ellipse(s * 30, 10, 10, 7, 0, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(s * 30, 10, 4, 0, 7); g.fill(); g.fillStyle = '#0c0807'; g.beginPath(); g.ellipse(s * 13, 34, 10, 7, s * .4, 0, 7); g.fill(); }
      g.strokeStyle = '#0c0807'; g.lineWidth = 5; g.beginPath(); g.moveTo(-30, 66); g.quadraticCurveTo(0, 74, 30, 66); g.stroke(); g.restore(); gloss(g); },
    MK(g) { base(g, '#7a2e0b', '#1a0602'); g.save(); g.translate(128, 128);
      g.beginPath(); g.moveTo(0, -104); g.bezierCurveTo(78, -100, 80, -20, 70, 30); g.bezierCurveTo(60, 80, 24, 106, 0, 110); g.bezierCurveTo(-24, 106, -60, 80, -70, 30); g.bezierCurveTo(-80, -20, -78, -100, 0, -104); const w = g.createLinearGradient(-80, 0, 80, 0); w.addColorStop(0, '#6b3a12'); w.addColorStop(.5, '#c98a3a'); w.addColorStop(1, '#5a2e0c'); g.fillStyle = w; g.fill(); g.strokeStyle = '#2a1203'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#e6d6b0'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 24 - 8, -98); g.lineTo(i * 24, -74); g.lineTo(i * 24 + 8, -98); g.fill(); }
      for (const s of [-1, 1]) { g.fillStyle = '#120600'; g.beginPath(); g.ellipse(s * 30, -20, 22, 13, s * .25, 0, 7); g.fill(); g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(s * 30, -20, 5, 0, 7); g.fill(); g.strokeStyle = '#d23a10'; g.lineWidth = 6; g.beginPath(); g.moveTo(s * 18, 10); g.lineTo(s * 54, 26); g.moveTo(s * 18, 26); g.lineTo(s * 50, 42); g.stroke(); }
      g.fillStyle = '#2a1203'; g.fillRect(-8, -12, 16, 44); g.fillStyle = '#120600'; g.beginPath(); g.ellipse(0, 66, 30, 14, 0, 0, 7); g.fill(); g.fillStyle = '#e6d6b0'; for (let i = -2; i <= 2; i++) g.fillRect(i * 11 - 4, 56, 8, 10); g.restore(); gloss(g); },
    TC(g) { base(g, '#0f5a3a', '#021a10'); g.save(); g.translate(118, 140);
      g.fillStyle = '#0b0b0b'; g.beginPath(); g.ellipse(-10, 20, 58, 72, -.2, 0, 7); g.fill(); g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(4, -20, 34, 30, 0, 0, 7); g.fill();
      const b = g.createLinearGradient(20, -60, 120, 20); b.addColorStop(0, '#ffe14a'); b.addColorStop(.5, '#ff8a00'); b.addColorStop(1, '#d81e05'); g.fillStyle = b; g.beginPath(); g.moveTo(24, -46); g.bezierCurveTo(90, -64, 128, -30, 124, 4); g.bezierCurveTo(100, -10, 60, -8, 26, -10); g.closePath(); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(120, -6); g.lineTo(124, 4); g.lineTo(110, 0); g.fill();
      g.fillStyle = '#2ac0ff'; g.beginPath(); g.arc(2, -34, 14, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(4, -34, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(7, -37, 2.5, 0, 7); g.fill();
      g.fillStyle = '#d81e05'; g.beginPath(); g.ellipse(-4, 88, 26, 10, 0, 0, 7); g.fill(); g.restore(); gloss(g); },
    ID(g) { base(g, '#4a4f3a', '#101208'); g.save(); g.translate(128, 132);
      const st = g.createLinearGradient(-70, 0, 70, 0); st.addColorStop(0, '#5d5a4c'); st.addColorStop(.5, '#a39d86'); st.addColorStop(1, '#4b4839'); g.fillStyle = st; g.beginPath(); g.moveTo(-56, -100); g.lineTo(56, -100); g.lineTo(66, 100); g.lineTo(-66, 100); g.closePath(); g.fill(); g.strokeStyle = '#26241b'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#2f2c22'; g.fillRect(-60, -46, 120, 16); for (const s of [-1, 1]) { g.fillStyle = '#15130d'; g.beginPath(); g.ellipse(s * 26, -10, 15, 10, 0, 0, 7); g.fill(); g.fillStyle = '#5cff9a'; g.shadowColor = '#5cff9a'; g.shadowBlur = 16; g.beginPath(); g.arc(s * 26, -10, 5, 0, 7); g.fill(); g.shadowBlur = 0; }
      g.fillStyle = '#3c392d'; g.beginPath(); g.moveTo(0, -2); g.lineTo(18, 34); g.lineTo(-18, 34); g.fill(); g.fillStyle = '#15130d'; g.fillRect(-34, 56, 68, 12); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-60 + i * 22, -100); g.lineTo(-50 + i * 20, 100); g.stroke(); } g.restore(); gloss(g); },
    BN(g) { base(g, '#3d5a10', '#0e1a02'); g.save(); g.translate(128, 140);
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(-.5 + i * .3); const y = g.createLinearGradient(-20, -90, 20, 40); y.addColorStop(0, '#fff27a'); y.addColorStop(.6, '#ffc800'); y.addColorStop(1, '#b07800'); g.fillStyle = y; g.beginPath(); g.moveTo(0, -84); g.bezierCurveTo(42, -60, 40, 30, 4, 60); g.bezierCurveTo(16, 20, 14, -40, -8, -80); g.closePath(); g.fill(); g.strokeStyle = '#6a4500'; g.lineWidth = 3; g.stroke(); g.restore(); }
      g.fillStyle = '#5a3a00'; g.beginPath(); g.ellipse(-8, -84, 14, 10, 0, 0, 7); g.fill(); g.restore(); gloss(g); },
    RB(g) { base(g, '#5a0612', '#140003'); gem(g, '#ff2a4a', '#5a0010', 'pent'); gloss(g); },
    EM(g) { base(g, '#06402a', '#001208'); gem(g, '#20e070', '#004020', 'oct'); gloss(g); },
    SP(g) { base(g, '#0a2a5a', '#000818'); gem(g, '#3a8cff', '#001a5a', 'tri'); gloss(g); },
    WD(g) { const r = g.createRadialGradient(128, 128, 0, 128, 128, 180); r.addColorStop(0, '#ffef9a'); r.addColorStop(.35, '#ff8a00'); r.addColorStop(1, '#5a0d00'); g.fillStyle = r; g.fillRect(0, 0, S, S);
      g.save(); g.translate(128, 128); for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = 'rgba(255,240,180,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -190); g.lineTo(14, -190); g.fill(); } g.restore();
      txt(g, 'WILD', 112, 78, goldFill(g, 80, 150), '#3a0a00'); g.font = '900 26px Arial Black, sans-serif'; g.fillStyle = '#fff'; g.fillText('MULTIPLIER', 128, 178); },
    CN(g) { g.fillStyle = '#1a0d02'; g.fillRect(0, 0, S, S); const r = g.createRadialGradient(108, 96, 10, 128, 128, 110); r.addColorStop(0, '#fff6c2'); r.addColorStop(.4, '#ffc531'); r.addColorStop(.85, '#a86400'); r.addColorStop(1, '#5a3000'); g.fillStyle = r; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.fill();
      g.strokeStyle = '#7a4500'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 86, 0, 7); g.stroke(); g.fillStyle = 'rgba(120,70,0,.35)'; for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283; g.fillRect(128 + Math.cos(a) * 96 - 2, 128 + Math.sin(a) * 96 - 2, 4, 4); }
      // tiny gorilla paw print
      g.fillStyle = 'rgba(110,60,0,.45)'; g.beginPath(); g.ellipse(128, 150, 26, 20, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(100 + i * 19, 116 - (i === 1 || i === 2 ? 8 : 0), 9, 0, 7); g.fill(); } },
    DR(g) { base(g, '#6a1a04', '#120300'); g.save(); g.translate(128, 136);
      const body = g.createLinearGradient(-70, 0, 70, 0); body.addColorStop(0, '#4a1c06'); body.addColorStop(.5, '#b0561c'); body.addColorStop(1, '#3a1404'); g.fillStyle = body; g.beginPath(); g.moveTo(-66, -50); g.lineTo(66, -50); g.lineTo(46, 92); g.lineTo(-46, 92); g.closePath(); g.fill();
      g.strokeStyle = '#e8d2a0'; g.lineWidth = 4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 19, -48); g.lineTo(i * 13 + (i % 2 ? 10 : -10), 90); g.stroke(); }
      g.fillStyle = '#f0deb0'; g.beginPath(); g.ellipse(0, -50, 68, 22, 0, 0, 7); g.fill(); g.strokeStyle = '#5a2a08'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#d9a0402a'; g.beginPath(); g.ellipse(0, -50, 40, 12, 0, 0, 7); g.fill();
      g.restore(); txt(g, 'BONUS', 226, 34, goldFill(g, 210, 242), '#2a0700'); gloss(g); },
  };
  const custom = {};
  window.GorillaSymbols = {
    get(code) { if (custom[code]) return custom[code]; if (!cache[code]) { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); ART[code](g); cache[code] = c.toDataURL('image/png'); } return cache[code]; },
    useCustom(code, url) { custom[code] = url; }, codes: Object.keys(ART),
  };
})();
