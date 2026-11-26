// GORILLA t101u regression: the 3-drum Temple Drum Wheel -> bonus transition can never strand the player on a black screen.
// Loops every wheel wedge (tier 3 + chained tier-1/2 wedges) with fast / slow / double taps and impatient screen taps, while the
// takeover clips load normally, slowly, fail (404/abort) or stall forever. Fails on any dark-cabinet hang, page error or stuck spin.
// Run: PORT=3480 node server.js ; GORILLA_URL=http://localhost:3480 ITER=26 node test/gorilla-wheel-stress.js
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.GORILLA_URL || 'http://localhost:3480';
const ITER = +(process.env.ITER || 26), SHOT = process.env.SHOT || '', OFFSET = +(process.env.OFFSET || 0);
const wait = ms => new Promise(r => setTimeout(r, ms));
const FAULTS = ['ok', 'slow', 'fail', 'stall', 'ok', 'slow'], TAPS = ['fast', 'slow', 'double', 'impatient'];
(async () => {
  const b = await P.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); // Galaxy S21 Ultra CSS viewport
  let fault = 'ok'; await p.setRequestInterception(true);
  p.on('request', async r => { const u = r.url(); if (/\/media\/v5\/rampage/.test(u) && r.resourceType() === 'media' || /\/media\/v5\/rampage-(jungle|fury|inferno)/.test(u)) {
      if (fault === 'fail') return r.abort('failed').catch(() => {});
      if (fault === 'stall') return; // never answered: the clip never loads
      if (fault === 'slow') await wait(2500 + Math.random() * 2500); }
    r.continue().catch(() => {}); });
  await p.goto(BASE + '/gorilla?debug=1&speed=0.35', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.G && !G.busy && window.ape, { timeout: 60000 });
  const ver = await p.evaluate(() => (document.querySelector('script[src*="game.js"]') || {}).src || ''); console.log('game.js ' + ver);
  await p.mouse.click(206, 150); await p.click('#billBtn'); await p.waitForFunction(() => G.st.cents > 0 && !G.busy, { timeout: 30000 });
  // dark-screen monitor: the cabinet is hidden (#app.takeover) but no takeover clip is actually playing on screen
  await p.evaluate(() => { window.__dark = { cur: 0, max: 0, since: 0 }; setInterval(() => { const app = document.getElementById('app'), v = document.getElementById('cine'), now = performance.now();
    const dark = app.classList.contains('takeover') && (v.classList.contains('hidden') || !v.classList.contains('show') || v.paused || v.readyState < 2);
    if (dark) { if (!__dark.since) __dark.since = now; __dark.cur = now - __dark.since; __dark.max = Math.max(__dark.max, __dark.cur); } else { __dark.since = 0; __dark.cur = 0; } }, 100); });
  const plan = []; for (let i = 0; i < 12; i++) plan.push('w3:' + i); plan.push('w1:6', 'w1:7', 'w2:11', 'w2:0', 'awaken', 'ascent');
  const results = []; let shotDone = false;
  for (let it = 0; it < ITER; it++) {
    const k = plan[(it + OFFSET) % plan.length], tap = TAPS[(it + OFFSET) % TAPS.length]; fault = FAULTS[Math.floor((it + OFFSET) / plan.length + it) % FAULTS.length];
    await p.evaluate(() => { __dark.max = 0; window.__tkLog = []; window.__splashTaps = 0; if (G.st.cents < 50000) { G.st.cents = 200000; } });
    const t0 = Date.now(); await p.evaluate(k => G.force(k), k); await p.evaluate(() => { G.spin(); });
    // auto-tap TAP TO START whenever a splash is up (the player taps it)
    await p.evaluate(() => { clearInterval(window.__stI); window.__stI = setInterval(() => { const s = document.getElementById('splash'); if (s && !s.classList.contains('hidden')) { if (!s.__seen) s.__seen = performance.now(); else if (performance.now() - s.__seen > 500) { s.__seen = 0; __splashTaps++; document.getElementById('startBtn').click(); } } }, 100); });
    let imp = null; if (tap === 'impatient') imp = setInterval(() => p.mouse.click(206, 120 + Math.random() * 120).catch(() => {}), 650);
    await p.waitForFunction(() => document.getElementById('wheelHub').classList.contains('ready'), { timeout: 90000 });
    const w = await p.evaluate(() => ({ idx: __lastWheel.idx, id: __lastWheel.wedge.id, mode: __lastWheel.mode || '', locked: !!__lastWheel.locked, tier: __lastWheel.tier }));
    if (tap === 'slow') await wait(3000); if (tap === 'fast') await wait(50);
    await p.click('#wheelHub'); if (tap === 'double') { await wait(60); await p.click('#wheelHub').catch(() => {}); await wait(120); await p.click('#wheelWrap').catch(() => {}); }
    if (SHOT && w.mode && !shotDone && fault === 'ok') { // wheel -> bonus transition, phone viewport
      await p.waitForFunction(() => document.getElementById('cine').classList.contains('show'), { timeout: 30000 }).then(() => wait(700)).then(() => p.screenshot({ path: SHOT + '-1-takeover.png' })).catch(() => {});
      await p.waitForFunction(() => !document.getElementById('splash').classList.contains('hidden'), { timeout: 30000 }).then(() => p.screenshot({ path: SHOT + '-2-splash.png' })).catch(() => {});
      await p.waitForFunction(() => document.body.classList.contains('bonus') && document.getElementById('splash').classList.contains('hidden') && !document.getElementById('modeHud').classList.contains('hidden'), { timeout: 30000 }).then(() => wait(1500)).then(() => p.screenshot({ path: SHOT + '-3-bonus.png' })).catch(() => {});
      shotDone = true; }
    let ok = true, why = '';
    try { await p.waitForFunction(() => !G.busy || __dark.cur > 4000, { timeout: 240000, polling: 200 }); } catch (e) { ok = false; why = 'timeout'; }
    if (imp) clearInterval(imp);
    const r = await p.evaluate(() => ({ busy: G.busy, dark: Math.round(__dark.max), tk: __tkLog.map(x => x.why), takeover: document.getElementById('app').classList.contains('takeover'), err: window.__spinErrors || 0, splashTaps: __splashTaps }));
    if (r.busy || r.takeover || r.dark > 4000) { ok = false; why = why || 'dark/stuck'; await p.screenshot({ path: `/tmp/stress-fail-${it}.png` }); }
    results.push({ it, k, tap, fault, ...w, ok, why, ms: Date.now() - t0, ...r });
    console.log(`${ok ? '✔' : '✘'} #${it} ${k} (${w.id}${w.mode ? ' → ' + w.mode : ''}${w.locked ? ' chained' : ''}) tap=${tap} video=${fault}: ${((Date.now() - t0) / 1000).toFixed(1)} s, max dark ${r.dark} ms, takeovers [${r.tk.join(',')}]${ok ? '' : ' FAIL ' + why}`);
    if (!ok) break; }
  await p.evaluate(() => clearInterval(window.__stI));
  const bad = results.filter(r => !r.ok); console.log(`${results.length - bad.length}/${results.length} wheel flows completed, wedges covered: ${[...new Set(results.map(r => r.idx))].sort((a, b) => a - b).join(',')}; page errors: ${errs.length}`);
  require('fs').writeFileSync(process.env.OUT || '/tmp/gorilla-wheel-stress.json', JSON.stringify({ results, errs }, null, 1));
  await b.close(); assert.deepStrictEqual(bad, [], 'wheel flows that hung'); assert.deepStrictEqual(errs, [], 'page errors');
})().catch(e => { console.error(e); process.exit(1); });
