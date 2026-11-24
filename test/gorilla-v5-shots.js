// GORILLA v5 feature screenshots: node test/gorilla-v5-shots.js  (GORILLA_URL, SHOTS env) -> <SHOTS>/<device>-<feature>.png
const P = require('puppeteer-core'), BASE = process.env.GORILLA_URL || 'http://localhost:3480', SHOTS = process.env.SHOTS || '/workspace/gorilla-shots/v5';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  for (const [dev, w, h, d] of [['phone-412', 412, 915, 3], ['ipad-1024', 1024, 1366, 2]].filter(x => !process.env.DEVS || process.env.DEVS.split(',').includes(x[0]))) {
    const p = await b.newPage(); p.on('pageerror', e => errs.push(dev + ': ' + e.message)); await p.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: true, hasTouch: true });
    await p.goto(BASE + '/gorilla?debug=1&speed=0.5', { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('gorillaState1', JSON.stringify({ cents: 500000, denom: 1, bet: 2, meter: 120 }))); await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.G && !G.busy && window.ape && ape.kind === 'video'); await p.mouse.click(w / 2, h * .3); await wait(2500);
    await p.addStyleTag({ content: '#dbg{display:none!important}' });
    const shot = async n => { await p.screenshot({ path: `${SHOTS}/${dev}-${n}.png` }); console.log(`${dev}-${n}.png`); };
    const fx = k => p.waitForFunction(k => window.__gorillaFx && __gorillaFx.kind === k, { timeout: 120000 }, k), sel = s => p.waitForSelector(s, { timeout: 120000 }), fn = f => p.waitForFunction(f, { timeout: 240000 });
    const run = async (k, f) => { await p.evaluate(() => window.__gorillaFx = null); await p.evaluate(k => { G.force(k); G.spin(); }, k); try { await f(); } catch (e) { errs.push(`${dev} ${k}: ${e.message}`); } await fn(() => !G.busy); await wait(400); };
    await shot('base');
    await run('thunder', async () => { await fx('thunder'); await wait(500); await shot('thunder-wild'); });
    await run('respin', async () => { await fx('respin'); await wait(200); await shot('coin-respin'); });
    await run('big', async () => { await sel('#big:not(.hidden)'); await wait(1500); await shot('big-win'); });
    await run('mega', async () => { await sel('#big:not(.hidden)'); await wait(1500); await shot('mega-win'); });
    await run('monster', async () => { await sel('#big:not(.hidden)'); await wait(1500); await shot('monster-win'); });
    await run('meter', async () => { await sel('#meter.full'); await shot('meter-full'); await fx('meter'); await wait(120); await shot('meter-smash'); await sel('#wheelBox:not(.hidden)'); await wait(800); await shot('wheel-2drums'); });
    await run('wheel1', async () => { await sel('#wheelBox:not(.hidden)'); await wait(700); await shot('wheel-1drum-chains'); await fx('swipe'); await wait(1200); await shot('wheel-spinning'); });
    await run('awaken', async () => { await fx('awaken'); await wait(250); await shot('awaken-chains-shatter'); });
    await run('locked', async () => { await fn(() => /CHAINED/.test(document.getElementById('wheelMsg').textContent)); await shot('wheel-locked-wedge'); });
    await run('jackpot', async () => { await fn(() => /JACKPOT/.test(document.getElementById('wheelMsg').textContent)); await shot('wheel-jackpot'); await fn(() => !document.getElementById('big').classList.contains('hidden')); await wait(2500); await shot('jackpot-overlay'); });
    for (const m of ['jungle', 'fury', 'inferno']) await run(m, async () => {
      await fx('lunge'); await wait(1400); await shot(m + '-lunge-grade'); await sel('#splash:not(.hidden)'); await wait(900); await shot(m + '-splash'); await p.click('#startBtn');
      await sel('#modeHud:not(.hidden)'); await wait(2500); await shot(m + '-spins');
      if (m !== 'jungle') { await fn(() => G.rows === 7); await wait(1200); await shot(m + '-7rows-343ways'); }
      await fx('fist'); await wait(300); await shot(m + '-firefist');
      await fn(() => !document.getElementById('big').classList.contains('hidden') && /TOTAL/.test(document.getElementById('bigTitle').textContent)); await wait(4000); await shot(m + '-total'); });
    await p.close(); }
  console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(errs.length ? 1 : 0); })();
