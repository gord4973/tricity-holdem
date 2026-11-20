// Renders the app icons from an inline SVG with headless Chrome. node tools/make-icons.js
const P = require('puppeteer-core'), fs = require('fs'), path = require('path');
const SPADE = 'M0,-30 C10,-16 30,-8 30,6 C30,18 18,24 8,20 C5,19 3,17 2,15 C3,24 7,30 12,34 L-12,34 C-7,30 -3,24 -2,15 C-3,17 -5,19 -8,20 C-18,24 -30,18 -30,6 C-30,-8 -10,-16 0,-30 Z';
function svg(scale) { // scale = emblem size relative to the full icon (1 = edge to edge)
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
  </g></svg>`;
}
(async () => {
  const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }), pg = await b.newPage();
  const out = [['icon-192.png', 192, 0.9], ['icon-512.png', 512, 0.9], ['icon-192-maskable.png', 192, 0.62], ['icon-512-maskable.png', 512, 0.62], ['apple-touch-icon.png', 180, 0.84], ['favicon.png', 64, 1]];
  for (const [f, px, sc] of out) {
    await pg.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;background:#120406">${svg(sc).replace('width="512" height="512"', `width="${px}" height="${px}"`)}</body></html>`);
    await pg.screenshot({ path: path.join(__dirname, '../public', f), clip: { x: 0, y: 0, width: px, height: px } });
    console.log(f, px, fs.statSync(path.join(__dirname, '../public', f)).size, 'bytes');
  }
  fs.writeFileSync(path.join(__dirname, 'icon.svg'), svg(0.9)); await b.close();
})();
