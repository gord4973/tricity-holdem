// GORILLA app icons (original silverback face on volcano orange, "GORILLA" banner). node tools/make-gorilla-icons.js
const P = require('puppeteer-core'), fs = require('fs'), path = require('path');
function svg(k = 1, banner = true) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="512" height="512">
<defs><radialGradient id="bg" cx="0" cy="30" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff9a2a"/><stop offset=".35" stop-color="#c2410c"/><stop offset="1" stop-color="#1a0402"/></radialGradient>
<linearGradient id="sv" x1="0" y1="-80" x2="0" y2="-10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#bdb6ac"/><stop offset="1" stop-color="#2b2622"/></linearGradient>
<linearGradient id="gold" x1="0" y1="40" x2="0" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff3b8"/><stop offset=".45" stop-color="#ffb52a"/><stop offset=".75" stop-color="#d2400a"/><stop offset="1" stop-color="#ffcf6a"/></linearGradient></defs>
<rect x="-100" y="-100" width="200" height="200" fill="url(#bg)"/>
<g transform="scale(${k}) translate(0,${banner ? -12 : 0})">
<path d="M0-82C52-82 70-38 68 2C66 48 40 70 0 70C-40 70-66 48-68 2C-70-38-52-82 0-82Z" fill="#2b2622"/><path d="M0-82C52-82 70-38 68 2C66 48 40 70 0 70C-40 70-66 48-68 2C-70-38-52-82 0-82Z" fill="url(#sv)" opacity=".85"/>
<path d="M-50-14Q0-38 50-14Q53 0 40 4Q0-10-40 4Q-53 0-50-14Z" fill="#120d0b"/>
<ellipse cx="0" cy="34" rx="46" ry="34" fill="#3a2f29"/>
<ellipse cx="-23" cy="6" rx="8" ry="5.5" fill="#e8a33a"/><ellipse cx="23" cy="6" rx="8" ry="5.5" fill="#e8a33a"/><circle cx="-23" cy="6" r="3.2"/><circle cx="23" cy="6" r="3.2"/>
<ellipse cx="-10" cy="25" rx="8" ry="5.5" fill="#0c0807" transform="rotate(-20 -10 25)"/><ellipse cx="10" cy="25" rx="8" ry="5.5" fill="#0c0807" transform="rotate(20 10 25)"/>
<path d="M-24 50Q0 57 24 50" stroke="#0c0807" stroke-width="4" fill="none" stroke-linecap="round"/></g>
${banner ? `<g transform="scale(${k})"><rect x="-86" y="52" width="172" height="34" rx="10" fill="#1a0602" stroke="#ffb52a" stroke-width="3"/><text x="0" y="70" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, sans-serif" font-weight="900" font-size="27" fill="url(#gold)" stroke="#2a0800" stroke-width=".8" textLength="150" lengthAdjust="spacingAndGlyphs">GORILLA</text></g>` : ''}</svg>`; }
(async () => {
  const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }), p = await b.newPage(), pub = path.join(__dirname, '../public');
  fs.writeFileSync(path.join(__dirname, 'icon-gorilla.svg'), svg());
  const out = async (file, size, k, banner = true) => { await p.setViewport({ width: size, height: size }); await p.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg(k, banner)}`); await p.screenshot({ path: path.join(pub, file) }); };
  await out('icon-gorilla-512.png', 512, 1); await out('icon-gorilla-192.png', 192, 1); await out('icon-gorilla-512-maskable.png', 512, .8); await out('icon-gorilla-192-maskable.png', 192, .8);
  await out('apple-touch-icon-gorilla.png', 180, .92); await out('favicon-gorilla.png', 64, 1, false);
  await b.close(); console.log('icons written');
})();
