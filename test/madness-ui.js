// MITSUBISHI MADNESS browser test: bill, bets, spins, every debug force (wins, drift, jackpot, wheel tiers, rev up, locked, all free-spin
// modes, gear up, rally, S-AWC, PHEV charge full/surge, wheel jackpots), cash out; layout checks at phone (412x915) and iPad Pro portrait.
// Run: PORT=3490 node server.js ; MADNESS_URL=http://localhost:3490 node test/madness-ui.js   (SHOTS=dir to save screenshots)
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', SHOTS = process.env.SHOTS || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
const FORCES = (process.env.FORCES || 'win,big,mega,madness,wild,drift,almost,meter,jackpot,wheel3,wheel4,wheel5,revup,locked,turbo,nitro,madspins,gearup,rally,rally1,offroad,summit,rescue,charge,full72,surge,wcharge,mini,minor,major,grandwheel').split(',');
(async () => {
  const b = await P.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const speed = process.env.SPEED || '0.3';
  await p.goto(BASE + '/madness?debug=1&speed=' + speed, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  const idle = (t = 150000) => p.waitForFunction(() => window.G && !G.busy, { timeout: t }), cents = () => p.evaluate(() => G.st.cents);
  await idle(); assert.strictEqual(await cents(), 0, 'starts empty');
  await p.mouse.click(200, 200);
  // layout: everything on screen, no horizontal overflow
  const lay = await p.evaluate(() => { const r = id => { const q = document.getElementById(id).getBoundingClientRect(); return { top: q.top, bottom: q.bottom, left: q.left, right: q.right, width: q.width, height: q.height }; }; return { spin: r('spinBtn'), frame: r('frame'), bar: r('bar'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth }; });
  assert.ok(lay.spin.bottom <= lay.vh + 1 && lay.frame.right <= lay.vw + 1 && lay.sw <= lay.vw + 1, 'phone layout fits ' + JSON.stringify(lay));
  await p.click('#billBtn'); await p.waitForFunction(() => G.st.cents === 10000 && !G.busy, { timeout: 30000 }); console.log('bill ok');
  await p.click('#betUp'); assert.strictEqual(await p.evaluate(() => G.st.bet), 1); await p.click('#betDn');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/main-reels-phone.png' });
  for (let i = 0; i < 6; i++) { const c0 = await cents(); await p.click('#spinBtn'); await wait(60); await idle(); const c1 = await cents(); assert.ok(c1 >= c0 - 100, 'spin debits at most the bet'); }
  console.log('6 plain spins ok, credits ' + (await cents()) / 100);
  const results = [];
  for (const k of FORCES) {
    const c0 = await cents(); await p.evaluate(k => { window.__madFx = []; window.__chargeDone = null; window.__offroadDone = false; G.force(k); }, k);
    const t0 = Date.now(); await p.click('#spinBtn');
    // screenshots mid-feature
    if (SHOTS && k === 'madness') { await p.waitForFunction(() => !document.getElementById('big').classList.contains('hidden'), { timeout: 60000 }); await wait(900); await p.screenshot({ path: SHOTS + '/big-win-phone.png' }); }
    if (SHOTS && k === 'full72') { await p.waitForFunction(() => !document.getElementById('scene').classList.contains('hidden'), { timeout: 60000 }); await wait(2500); await p.screenshot({ path: SHOTS + '/phev-charge-phone.png' }); await p.waitForFunction(() => window.__chargeDone, { timeout: 90000 }); await wait(300); await p.screenshot({ path: SHOTS + '/phev-full-charge-phone.png' }); }
    if (SHOTS && k === 'rally1') { await p.waitForSelector('#sceneBtns .sbtn.car', { timeout: 60000 }); await wait(400); await p.screenshot({ path: SHOTS + '/rally-pick-phone.png' }); await p.click('#sceneBtns .sbtn.car:nth-child(4)'); await p.waitForFunction(() => /GO/.test(document.getElementById('sceneSub').textContent), { timeout: 30000 }); await wait(900); await p.screenshot({ path: SHOTS + '/rally-race-phone.png' }); }
    if (SHOTS && k === 'summit') { await p.waitForSelector('#sceneBtns .sbtn', { timeout: 60000 }); await wait(500); await p.screenshot({ path: SHOTS + '/offroad-phone.png' }); }
    if (SHOTS && k === 'turbo') { await p.waitForFunction(() => !document.getElementById('wheelBox').classList.contains('hidden'), { timeout: 60000 }); await wait(400); await p.screenshot({ path: SHOTS + '/wheel-phone.png' }); }
    if (SHOTS && k === 'madspins') { await p.waitForFunction(() => !document.getElementById('modeHud').classList.contains('hidden'), { timeout: 60000 }); await wait(1200); await p.screenshot({ path: SHOTS + '/madness-spins-phone.png' }); }
    await idle(200000);
    const st = await p.evaluate(() => ({ fx: window.__madFx.map(f => f.kind + (f.feat ? ':' + f.feat : '') + (f.id ? ':' + f.id : '')), cine: !document.getElementById('cine').classList.contains('hidden'), scene: !document.getElementById('scene').classList.contains('hidden'), wheel: !document.getElementById('wheelBox').classList.contains('hidden'), splash: !document.getElementById('splash').classList.contains('hidden'), big: !document.getElementById('big').classList.contains('hidden'), errs: window.__spinErrors || 0, cap: window.__sceneCap || 0, charge: window.__chargeDone, feat: window.__lastFeature && { kind: window.__lastFeature.kind, win: window.__lastFeature.win, km: window.__lastFeature.km, full: window.__lastFeature.full, place: window.__lastFeature.place, summit: window.__lastFeature.summit, mode: window.__lastFeature.finalMode, gear: !!window.__lastFeature.gearUp }, wheel: window.__lastWheel && { id: window.__lastWheel.wedge.id, locked: window.__lastWheel.locked, rev: window.__lastWheel.revUp } }));
    const c1 = await cents(), won = (c1 - c0 + 100) / 100;
    results.push({ k, won, s: Math.round((Date.now() - t0) / 1000), fx: [...new Set(st.fx)].join(' ') });
    assert.ok(!st.cine && !st.scene && !st.wheel && !st.splash && !st.big, k + ': overlay left on screen ' + JSON.stringify(st));
    assert.strictEqual(st.errs, 0, k + ': spin error'); assert.strictEqual(st.cap, 0, k + ': scene hit safety cap');
    const has = s => st.fx.some(f => f.startsWith(s));
    if (/^(win|big|mega|madness|wild)$/.test(k)) assert.ok(won > 0, k + ' pays');
    if (/^(big|mega|madness)$/.test(k)) assert.ok(has('big'), k + ' celebration');
    if (k === 'drift') assert.ok(has('drift') && won > 0, 'drift wild pays');
    if (k === 'jackpot') { assert.ok(has('jackpot'), 'grand'); assert.ok(won >= 1000, 'grand pays 1000x'); }
    if (/^wheel/.test(k) || /^(turbo|nitro|rally|offroad|revup|locked)$/.test(k)) assert.ok(has('wheel'), k + ' wheel');
    if (k === 'revup') assert.ok(has('revup') && st.wheel.rev && !st.wheel.locked, 'rev up unlocks');
    if (k === 'locked') { assert.ok(st.wheel.locked, 'locked wedge'); assert.ok(Math.abs(won - 5) < .01, 'locked pays 5x'); }
    if (/^(turbo|nitro|madspins|gearup)$/.test(k)) assert.strictEqual(st.feat.kind, 'spins');
    if (k === 'gearup') assert.ok(st.feat.gear && has('gearup'), 'gear up');
    if (/^(charge|full72|surge|wcharge)$/.test(k)) { assert.strictEqual(st.feat.kind, 'charge'); assert.ok(st.charge, 'charge scene completed'); assert.strictEqual(st.charge.km, st.feat.km, 'meter shows decided km'); assert.ok(st.feat.km <= 72); }
    if (k === 'full72') { assert.ok(st.feat.full && st.feat.km === 72 && st.feat.win === 72, 'full charge = 72 credits at bet 1'); assert.ok(won >= 72, 'credited 72'); }
    if (k === 'surge') assert.ok(!st.feat.full && st.feat.km >= 30 && st.feat.km < 72, 'surge stops the charge');
    if (/^rally/.test(k)) assert.strictEqual(st.feat.kind, 'rally');
    if (k === 'rally1') assert.ok(st.feat.place === 1 && st.feat.win === 60, 'nitro finish 60x');
    if (k === 'summit') assert.ok(st.feat.summit, 'summit');
    if (/^(mini|minor|major|grandwheel)$/.test(k)) assert.ok(has('jackpot'), k + ' jackpot');
    console.log(`${k.padEnd(10)} won ${won.toFixed(2).padStart(8)}  ${String(results.at(-1).s).padStart(3)}s  ${results.at(-1).fx}`);
    if (await cents() < 2000) { await p.click('#billBtn'); await idle(); }
  }
  // cash out
  await p.click('#cashBtn'); await p.waitForFunction(() => G.st.cents === 0 && !G.busy, { timeout: 30000 }); assert.ok(await p.evaluate(() => !document.getElementById('ticket').classList.contains('hidden')), 'ticket printed'); console.log('cash out ok');
  // attract mode
  await p.evaluate(() => __attract.enter()); await wait(400); assert.ok(await p.evaluate(() => __attract.on), 'attract on'); if (SHOTS) await p.screenshot({ path: SHOTS + '/attract-phone.png' }); await p.mouse.click(200, 300); await wait(200); assert.ok(!(await p.evaluate(() => __attract.on)), 'tap exits attract');
  // iPad Pro portrait
  await p.setViewport({ width: 1024, height: 1366, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await wait(900);
  const lay2 = await p.evaluate(() => { const r = id => { const q = document.getElementById(id).getBoundingClientRect(); return { top: q.top, bottom: q.bottom, left: q.left, right: q.right, width: q.width, height: q.height }; }; return { spin: r('spinBtn'), frame: r('frame'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth }; });
  assert.ok(lay2.spin.bottom <= lay2.vh + 1 && lay2.frame.right <= lay2.vw + 1 && lay2.sw <= lay2.vw + 1 && lay2.frame.width > 800, 'iPad layout ' + JSON.stringify(lay2));
  if (SHOTS) { await p.click('#billBtn'); await idle(); await p.screenshot({ path: SHOTS + '/main-reels-ipad.png' }); }
  assert.deepStrictEqual(errs, [], 'page errors: ' + errs.join(' | '));
  console.log(`PASS madness-ui: ${FORCES.length} forces, 0 page errors`); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
