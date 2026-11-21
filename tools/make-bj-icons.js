// Blackjack app icons (green chip, gold "21", PLAYER / HOST banner). node tools/make-bj-icons.js
const P = require('puppeteer-core'), fs = require('fs'), path = require('path');
const LABEL = { player: { text: 'BJ PLAYER', fill: '#13853a', stroke: '#fff', ink: '#fff' }, host: { text: 'BJ HOST', fill: 'url(#gold)', stroke: '#062a16', ink: '#062a16' } };
function banner(label, k) { const L = LABEL[label], w = 80, top = 42, h = 36;
  return `<g transform="scale(${k})"><rect x="${-w}" y="${top}" width="${2 * w}" height="${h}" rx="12" fill="${L.fill}" stroke="${L.stroke}" stroke-width="4"/><text x="0" y="${top + h / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-family="Archivo Black, Arial Black, sans-serif" font-size="24" fill="${L.ink}" textLength="${2 * w - 20}" lengthAdjust="spacingAndGlyphs">${L.text}</text></g>`; }
function svg(scale, label, k = 1) {
  const notches = Array.from({ length: 8 }, (_, i) => `<rect x="-9" y="-92" width="18" height="22" rx="3" fill="#fff" transform="rotate(${i * 45 + 22.5})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="512" height="512"><defs><radialGradient id="bg" cx="0" cy="-20" r="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0d4a24"/><stop offset="1" stop-color="#03140a"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="-90" x2="0" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe27a"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#b8790f"/></linearGradient></defs>
  <rect x="-100" y="-100" width="200" height="200" fill="url(#bg)"/><g transform="scale(${scale})"><circle r="92" fill="#13853a"/>${notches}<circle r="68" fill="#062a16" stroke="url(#gold)" stroke-width="7"/><circle r="56" fill="none" stroke="#13853a" stroke-width="2.5" stroke-dasharray="6 6"/>
  <text x="0" y="-2" text-anchor="middle" dominant-baseline="central" font-family="Archivo Black, Arial Black, sans-serif" font-size="66" fill="url(#gold)" stroke="#fff" stroke-width="2">21</text></g>${label ? banner(label, k) : ''}</svg>`; }
(async () => {
  const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }), pg = await b.newPage();
  for (const label of ['player', 'host']) { const suf = '-bj-' + label;
    for (const [f, px, sc, k] of [[`icon${suf}-192.png`, 192, 0.9, 1], [`icon${suf}-512.png`, 512, 0.9, 1], [`icon${suf}-192-maskable.png`, 192, 0.62, 0.72], [`icon${suf}-512-maskable.png`, 512, 0.62, 0.72], [`apple-touch-icon${suf}.png`, 180, 0.84, 0.95], [`favicon${suf}.png`, 64, 1, 1.08]]) {
      await pg.setViewport({ width: px, height: px }); await pg.setContent(`<html><body style="margin:0">${svg(sc, label, k).replace('width="512" height="512"', `width="${px}" height="${px}"`)}</body></html>`); await pg.evaluate(() => document.fonts.ready);
      await pg.screenshot({ path: path.join(__dirname, '../public', f), clip: { x: 0, y: 0, width: px, height: px } }); }
    fs.writeFileSync(path.join(__dirname, `icon-bj-${label}.svg`), svg(0.9, label)); }
  await b.close(); console.log('bj icons done');
})();
