// GORILLA browser test: insert bill, change denom, spin/win, forced smash/big/bonus/THUNDER SPINS, cash out; plus viewport + perf checks.
// Run against a server: PORT=3480 node server.js ; then GORILLA_URL=http://localhost:3480 node test/gorilla-ui.js
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.GORILLA_URL || 'http://localhost:3480', SHOTS = process.env.SHOTS || '/workspace/gorilla-shots';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await P.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(BASE + '/gorilla?debug=1&speed=0.35', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  const idle = () => p.waitForFunction(() => window.G && !G.busy, { timeout: 180000 }), cents = () => p.evaluate(() => G.st.cents);
  await idle(); assert.strictEqual(await cents(), 0);
  await p.click('#spinBtn'); await wait(300); assert.ok(await p.$eval('#toast', e => !e.classList.contains('hidden') && /Insert/.test(e.textContent)), 'spin with no cash asks for a bill');
  await p.click('#billBtn'); await p.waitForFunction(() => document.getElementById('bill').classList.contains('go'), { timeout: 5000 }); await idle();
  assert.strictEqual(await cents(), 10000); assert.strictEqual(await p.$eval('#mCash', e => e.textContent), '$100.00'); console.log('✔ bill inserted, CASH rolled to $100.00');
  await p.click('#denomBtn'); await p.click('#denoms button[data-d="25"]'); await p.click('[data-close=denomModal]');
  assert.strictEqual(await p.$eval('#denomTxt', e => e.textContent), '25¢'); assert.strictEqual(await p.$eval('#mBetD', e => e.textContent), '$12.50'); assert.strictEqual(await p.$eval('#mCred', e => e.textContent), '400'); console.log('✔ denom 25¢: bet 50 credits = $12.50, 400 credits');
  await p.click('#denomBtn'); await p.click('#denoms button[data-d="5"]'); await p.click('[data-close=denomModal]');
  await p.click('#betUp'); assert.strictEqual(await p.$eval('#mBet', e => e.textContent), '100'); await p.click('#betDn');
  const run = async (k, check) => { await p.evaluate(k => G.force(k), k); const c0 = await cents(); await p.click('#spinBtn'); if (check) await check(); await idle(); const c1 = await cents(); console.log(`✔ ${k}: ${c0} -> ${c1} cents (${await p.$eval('#winBanner', e => e.textContent)})`); return c1 - c0; };
  assert.ok(await run('win') > -250, 'win pays'); assert.ok(await p.$$eval('.cell.win', e => e.length) >= 3, 'winning cells highlighted');
  await run('smash', async () => { await p.waitForFunction(() => document.querySelectorAll('.lock.gone').length > 0, { timeout: 60000 }); await p.screenshot({ path: SHOTS + '/ui-smash.png' }); });
  await run('big', async () => { await p.waitForSelector('#big:not(.hidden)', { timeout: 60000 }); await wait(600); await p.screenshot({ path: SHOTS + '/ui-bigwin.png' }); });
  await run('bonus', async () => { await p.waitForSelector('#wheelBox:not(.hidden)', { timeout: 60000 }); await wait(300); await p.screenshot({ path: SHOTS + '/ui-wheel.png' }); });
  await run('thunder', async () => { await p.waitForSelector('#fsHud:not(.hidden)', { timeout: 90000 }); await wait(1500); await p.screenshot({ path: SHOTS + '/ui-thunder.png' }); });
  const before = await cents(); assert.ok(before > 0); await p.click('#cashBtn'); await wait(1600); await p.screenshot({ path: SHOTS + '/ui-ticket.png' }); await idle();
  assert.strictEqual(await cents(), 0); assert.ok((await p.$eval('#ticket', e => e.textContent)).includes((before / 100).toFixed(2)), 'ticket shows cashed-out amount'); console.log('✔ cash out printed ticket for $' + (before / 100).toFixed(2));
  await p.reload({ waitUntil: 'load' }); await idle(); assert.strictEqual(await cents(), 0, 'state persisted in localStorage');
  // viewports: nothing overflows, frame sits in the bottom third-ish
  for (const [n, w, h] of [['phone', 390, 844], ['ipad', 1024, 1366], ['ipad-land', 1366, 1024], ['tv', 1920, 1080]]) {
    await p.setViewport({ width: w, height: h }); await p.goto(BASE + '/gorilla', { waitUntil: 'load' }); await wait(2500);
    const m = await p.evaluate(() => { const f = document.getElementById('frame').getBoundingClientRect(), bar = document.getElementById('bar').getBoundingClientRect(); return { top: f.top / innerHeight, barBottom: bar.bottom, H: innerHeight, sw: document.documentElement.scrollWidth, W: innerWidth, fps: window.ape && ape.fps }; });
    assert.ok(m.sw <= m.W + 1 && m.barBottom <= m.H + 1, n + ' fits'); assert.ok(m.top > .5 && m.top < .72, n + ' reel frame top at ' + m.top.toFixed(2));
    await p.screenshot({ path: `${SHOTS}/view-${n}.png` }); console.log(`✔ ${n} ${w}x${h}: frame top ${(m.top * 100).toFixed(0)}% · fps(swiftshader) ${Math.round(m.fps || 0)}`);
  }
  // perf: mobile viewport on low/med quality (headless SwiftShader is CPU rendering, so this is a floor, not a device number)
  await p.setViewport({ width: 390, height: 844, isMobile: true });
  for (const q of ['low', 'med']) { await p.goto(BASE + '/gorilla?q=' + q, { waitUntil: 'load' }); await wait(5000); const fps = await p.evaluate(() => ape.fps); const fr = await p.evaluate(() => ape.renderer.info.render); console.log(`✔ perf ${q}: ${fps.toFixed(1)} fps (software GL) · ${fr.triangles} tris · ${fr.calls} draw calls`); }
  assert.deepStrictEqual(errs, [], 'no page errors'); console.log('GORILLA UI: all checks passed'); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
