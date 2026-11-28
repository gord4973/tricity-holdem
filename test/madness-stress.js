// MITSUBISHI MADNESS stress: random features back-to-back with hostile input — impatient taps during cinematics, double/triple taps on the
// wheel hub, mashing scene buttons, tapping SPIN mid-feature, doing nothing at all (auto-advance) — and a dark-screen / stuck monitor.
// Fails on: page errors, spin errors, a scene safety cap, an overlay left up, #cine visible with no active takeover >2 s, or busy > cap.
// Run: PORT=3490 node server.js ; MADNESS_URL=http://localhost:3490 ITER=40 node test/madness-stress.js
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', ITER = +(process.env.ITER || 40);
const wait = ms => new Promise(r => setTimeout(r, ms));
const KINDS = ['turbo', 'nitro', 'madspins', 'gearup', 'rally', 'rally1', 'offroad', 'rescue', 'summit', 'charge', 'full72', 'surge', 'wcharge', 'wheel3', 'wheel4', 'wheel5', 'revup', 'locked', 'meterwheel', 'mini', 'minor', 'major', 'grandwheel', 'jackpot', 'madness', 'drift', 'almost', null];
const TAPS = ['none', 'impatient', 'mash', 'spin'];
(async () => {
  const b = await P.launch({ protocolTimeout: 900000, executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const vp = process.env.IPAD ? { width: 1024, height: 1366 } : { width: 412, height: 915 };
  await p.setViewport({ ...vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(BASE + '/madness?debug=1&speed=' + (process.env.SPEED || '0.25'), { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.G && !G.busy, { timeout: 60000 }); await p.mouse.click(200, 150); await p.click('#billBtn'); await p.waitForFunction(() => G.st.cents > 0 && !G.busy, { timeout: 30000 });
  await p.evaluate(() => { window.__dark = { max: 0, since: 0 }; setInterval(() => { const c = document.getElementById('cine'), vis = !c.classList.contains('hidden'), now = performance.now(); const orphan = vis && !(window.__tkLog && document.getElementById('cine').classList.contains('show'));
    if (orphan) { if (!__dark.since) __dark.since = now; __dark.max = Math.max(__dark.max, now - __dark.since); } else __dark.since = 0; }, 100); });
  let maxBusy = 0;
  for (let i = 0; i < ITER; i++) {
    const kind = KINDS[(i * 5 + +(process.env.OFFSET || 0)) % KINDS.length], tap = TAPS[i % TAPS.length];
    if (kind) await p.evaluate(k => G.force(k), kind);
    const t0 = Date.now(); await p.click('#spinBtn');
    let done = false; const tapper = (async () => { while (!done) { await wait(150 + Math.random() * 500); if (done) break;
        try { if (tap === 'impatient') await p.mouse.click(206, 300 + Math.random() * 300);
          else if (tap === 'mash') { await p.evaluate(() => { const bs = [...document.querySelectorAll('#sceneBtns button, #wheelHub, #startBtn')].filter(b => b.offsetParent); for (const b of bs) { b.click(); b.click(); } }); }
          else if (tap === 'spin') await p.evaluate(() => document.getElementById('spinBtn').click()); } catch (e) {} } })();
    await p.waitForFunction(() => !G.busy, { timeout: 240000, polling: 200 }).catch(() => {}); done = true; await tapper;
    const s = await p.evaluate(() => ({ busy: G.busy, over: ['cine', 'scene', 'wheelBox', 'splash', 'big'].filter(id => !document.getElementById(id).classList.contains('hidden')), errs: window.__spinErrors || 0, cap: window.__sceneCap || 0, wsafe: window.__wheelSafety || 0, dark: __dark.max, cents: G.st.cents }));
    const secs = (Date.now() - t0) / 1000; maxBusy = Math.max(maxBusy, secs);
    console.log(`${String(i).padStart(3)} ${String(kind).padEnd(10)} ${tap.padEnd(9)} ${secs.toFixed(1).padStart(5)}s  credits ${(s.cents / 100).toFixed(2)}  dark ${Math.round(s.dark)}ms`);
    assert.ok(!s.busy, `${kind}: stuck busy`); assert.deepStrictEqual(s.over, [], `${kind}: overlay left up`); assert.strictEqual(s.errs, 0, 'spin errors'); assert.strictEqual(s.cap, 0, 'scene cap'); assert.strictEqual(s.wsafe, 0, 'wheel safety'); assert.ok(s.dark < 2000, 'dark cine ' + s.dark);
    if (s.cents < 3000) { await p.click('#billBtn'); await p.waitForFunction(() => !G.busy, { timeout: 30000 }); }
  }
  assert.deepStrictEqual(errs, [], 'page errors: ' + errs.join(' | '));
  console.log(`PASS madness-stress: ${ITER} flows, longest ${maxBusy.toFixed(1)}s, 0 page errors`); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
