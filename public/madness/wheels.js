// MITSUBISHI MADNESS - t130u rotating wheels for the side-view car photos (top display, stage cruisers, fly-bys, rally race, hero dive).
// Each photo's wheel is cut out as a circular sprite (centre + radius measured per model, madness-notes/wheels) and drawn back over the
// photo rotated by distance / radius, so the spokes turn exactly with the car's speed: rolling = no slip, faster = faster, braking slows,
// drift/burnout can add wheelspin. Above ~0.2 rad/frame the spokes get a rotational motion blur (ghosted copies along the arc).
(function () {
  // [cx, cy, r] as fractions of the image (cx, r of width; cy of height); cars face LEFT, front wheel first
  const POS = { 'eclipse-cross': [[.265, .494, .0625], [.781, .489, .0625]], 'eclipse-sportback': [[.232, .593, .0664], [.770, .589, .0672]],
    'outlander-phev': [[.231, .724, .0656], [.7375, .724, .0672]], outlander: [[.225, .721, .0656], [.736, .716, .0672]], rvr: [[.209, .662, .0719], [.811, .662, .0734]] };
  const keyOf = img => { const m = /car-([a-z-]+)\.webp/.exec(img && img.src || ''); return m && m[1]; };
  const cache = new Map(); window.__wheelDraws = 0;
  function sprites(img) { const k = keyOf(img); if (!k || !POS[k] || !img.complete || !img.naturalWidth) return null; let s = cache.get(k); if (s) return s;
    const W = img.naturalWidth, H = img.naturalHeight; s = POS[k].map(([cx, cy, r]) => { const R = r * W, n = Math.ceil(R * 2), c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      g.beginPath(); g.arc(n / 2, n / 2, R * .97, 0, 7); g.clip(); g.drawImage(img, cx * W - n / 2, cy * H - n / 2, n, n, 0, 0, n, n); return { c, cx, cy, r }; });
    cache.set(k, s); return s; }
  // advance a wheel state by the car's movement this frame; forward = leftwards (cars face left). extra = added wheelspin in radians.
  function step(st, x, y, w, extra = 0) { const R = Math.max(1, .066 * w); if (st._wx == null) { st._wx = x; st._wy = y; st.wa = st.wa || 0; st.wo = 0; }
    const dx = x - st._wx, dy = y - st._wy, d = Math.hypot(dx, dy), da = (dx > .01 ? 1 : -1) * d / R + extra; st._wx = x; st._wy = y;
    st.wa = ((st.wa || 0) + (d > w * 2 ? 0 : da)) % (Math.PI * 2); st.wo = d > w * 2 ? 0 : da; return st.wa; }
  // draw rotated wheels over a car image already drawn at (x, y, w, h) in the current transform
  function draw(g, img, x, y, w, h, angle, omega = 0) { const s = sprites(img); if (!s) return false;
    for (const wh of s) { const R = wh.r * w, px = x + wh.cx * w, py = y + wh.cy * h, size = wh.c.width * w / img.naturalWidth, dir = omega < 0 ? -1 : 1;
      g.save(); g.translate(px, py); g.beginPath(); g.arc(0, 0, R * .99, 0, 7); g.clip();
      const blur = Math.min(1.1, Math.abs(omega) * 1.6);
      g.rotate(angle); g.drawImage(wh.c, -size / 2, -size / 2, size, size);
      if (blur > .25) { const n = 4; for (let i = 1; i <= n; i++) { g.globalAlpha = .34; g.rotate(-dir * blur / n); g.drawImage(wh.c, -size / 2, -size / 2, size, size); } }
      g.restore(); window.__wheelDraws++; }
    return true; }
  window.MadWheels = { POS, step, draw, sprites };
})();
