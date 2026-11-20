// Renders the app icons from an inline SVG with headless Chrome. node tools/make-icons.js
const P = require('puppeteer-core'), fs = require('fs'), path = require('path');
const SPADE = 'M0,-30 C10,-16 30,-8 30,6 C30,18 18,24 8,20 C5,19 3,17 2,15 C3,24 7,30 12,34 L-12,34 C-7,30 -3,24 -2,15 C-3,17 -5,19 -8,20 C-18,24 -30,18 -30,6 C-30,-8 -10,-16 0,-30 Z';
const LABEL = {
  player: { text: 'PLAYER', fill: '#e60012', stroke: '#fff', ink: '#fff' },
  host: { text: 'HOST', fill: 'url(#gold)', stroke: '#120406', ink: '#120406' },
};
function banner(label, k) { // k scales the banner; maskable icons use a smaller k so it stays inside the 80% safe circle
  const L = LABEL[label]; if (!L) return '';
  const w = 74, top = 40, h = 36; // in 'any' coordinates (-100..100)
  return `<g transform="scale(${k})"><rect x="${-w}" y="${top}" width="${2 * w}" height="${h}" rx="12" fill="${L.fill}" stroke="${L.stroke}" stroke-width="4"/>
    <text x="0" y="${top + h / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-family="Archivo Black, Arial Black, sans-serif" font-size="${L.text.length > 4 ? 25 : 28}" letter-spacing="1.5" fill="${L.ink}" textLength="${L.text.length > 4 ? 2 * w - 22 : 2 * w - 52}" lengthAdjust="spacingAndGlyphs">${L.text}</text></g>`;
}
function svg(scale, label, k = 1) { // scale = emblem size relative to the full icon (1 = edge to edge)
  const notches = Array.from({ length: 8 }, (_, i) => `<rect x="-9" y="-92" width="18" height="22" rx="3" fill="#fff" transform="rotate(${i * 45 + 22.5})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="512" height="512">
  <defs><radialGradient id="bg" cx="0" cy="-20" r="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3a0a10"/><stop offset="1" stop-color="#120406"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="-90" x2="0" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#b8790f"/></linearGradient></defs>
  <rect x="-100" y="-100" width="200" height="200" fill="url(#bg)"/>
  <g transform="scale(${scale})">
    <circle r="92" fill="#e60012"/>${notches}
    <circle r="68" fill="#120406" stroke="url(#gold)" stroke-width="7"/>
    <circle r="56" fill="none" stroke="#e60012" stroke-width="2.5" stroke-dasharray="6 6"/>
    <g transform="translate(0,-4) scale(1.32)"><path d="${SPADE}" fill="url(#gold)" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></g>
  </g>${banner(label, k)}</svg>`;
}
(async () => {
  const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }), pg = await b.newPage();
  const sets = [['', null], ['-player', 'player'], ['-host', 'host']];
  for (const [suf, label] of sets) {
    const out = [[`icon${suf}-192.png`, 192, 0.9, 1], [`icon${suf}-512.png`, 512, 0.9, 1], [`icon${suf}-192-maskable.png`, 192, 0.62, 0.74], [`icon${suf}-512-maskable.png`, 512, 0.62, 0.74], [`apple-touch-icon${suf}.png`, 180, 0.84, 0.95], [`favicon${suf}.png`, 64, 1, 1.08]];
    for (const [f, px, sc, k] of out) {
      await pg.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
      await pg.setContent(`<html><body style="margin:0;background:#120406">${svg(sc, label, k).replace('width="512" height="512"', `width="${px}" height="${px}"`)}</body></html>`);
      await pg.evaluate(() => document.fonts.ready);
      await pg.screenshot({ path: path.join(__dirname, '../public', f), clip: { x: 0, y: 0, width: px, height: px } });
      console.log(f, px, fs.statSync(path.join(__dirname, '../public', f)).size, 'bytes');
    }
    if (label) fs.writeFileSync(path.join(__dirname, `icon-${label}.svg`), svg(0.9, label));
  }
  fs.writeFileSync(path.join(__dirname, 'icon.svg'), svg(0.9)); await b.close();
})();
