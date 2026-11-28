// t138u/t139u: BOOST GAUGE scatter. 2 gauges = escalating landing sounds only; 3 gauges = gauge needle sweeps to FULL (boostFill sound) and the
// BOOSTED WHEEL (no locks) spins; the flag meter value is untouched. Rules + paytable mention it. node test/madness-boost.js (MADNESS_URL=...)
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let ok = false;
  try { const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | '))); await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
    await p.goto(BASE + '/madness?debug=1&autostart=1&speed=0.4'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy, { timeout: 60000 });
    await p.evaluate(() => { dbg.style.display = 'none'; }); await p.mouse.click(200, 300); await p.evaluate(() => document.getElementById('billBtn').click()); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 });
    const ok200 = await p.evaluate(async () => (await fetch('/madness/art/BG@2x.webp')).status); assert.strictEqual(ok200, 200);
    // two gauges: escalating landing sounds, no bonus
    await p.evaluate(() => { G.st.meter = 40; G.force('boost2'); MadAudio.diag.log = []; }); await p.click('#spinBtn'); await wait(150); await p.waitForFunction(() => !G.busy && __stopLog.length === 5, { timeout: 120000 });
    let r = await p.evaluate(() => ({ land: __stopLog.map(s => s.land.filter(x => x === 'boost').length), log: MadAudio.diag.log.slice(), trig: __lastSpin.trigger, meter: G.st.meter }));
    assert.deepStrictEqual(r.land, [0, 1, 1, 0, 0]); assert.ok(r.log.filter(x => x === 'boostLand').length === 2, 'two boostLand'); assert.ok(!r.trig, 'no bonus on 2');
    // three gauges: fill + boosted wheel
    const m0 = r.meter; await p.evaluate(() => { G.force('boost'); MadAudio.diag.log = []; window.__boostFill = null; }); await p.click('#spinBtn');
    await p.waitForFunction(() => window.__boostFill && !window.__boostFill.done && MadShow.state.meter > 0.5, { timeout: 60000, polling: 50 }).catch(() => {});
    await p.screenshot({ path: '/workspace/madness-notes/shots/boost-fill-phone.png' });
    await p.waitForFunction(() => window.__boostFill && window.__boostFill.done, { timeout: 60000 }); const full = await p.evaluate(() => MadShow.state.meter), log3 = await p.evaluate(() => MadAudio.diag.log.slice());
    await p.waitForFunction(() => !document.getElementById('wheelBox').classList.contains('hidden'), { timeout: 60000 }); await wait(700); await p.screenshot({ path: '/workspace/madness-notes/shots/boost-wheel-phone.png' });
    await p.waitForFunction(() => !G.busy, { timeout: 400000 });
    r = await p.evaluate(() => ({ wh: { tier: __lastWheel.tier, locked: __lastWheel.locked }, log: MadAudio.diag.log.slice(), meter: G.st.meter, gauge: MadShow.state.meter, fx: __madFx.filter(f => f.kind === 'trigger').map(f => f.via) }));
    assert.deepStrictEqual(r.fx, ['boost']); assert.strictEqual(r.wh.tier, 3); assert.strictEqual(r.wh.locked, false); assert.ok(full >= .999, 'gauge filled to max ' + full);
    assert.ok(log3.includes('boostFill') && log3.filter(x => x === 'boostLand').length === 3, 'boost sounds ' + log3.join(','));
    assert.strictEqual(r.meter, m0, 'flag meter untouched');
    // rules + paytable
    const txt = await p.evaluate(() => { document.getElementById('menuBtn') && document.getElementById('menuBtn').click(); return document.body.innerHTML; });
    const rules = await p.evaluate(() => { const f = Function('return showRules')(); return null; }).catch(() => null);
    const src = await p.evaluate(async () => await (await fetch('/madness/game.js')).text()); assert.ok(/3 BOOST GAUGES \(reels 2, 3, 4\)/.test(src) && /BOOSTED WHEEL/.test(src));
    assert.deepStrictEqual(errs, []); console.log('2 gauges: 2 rising boostLand, no bonus; 3 gauges: gauge 100%, BOOSTED WHEEL tier 3, meter kept at', m0); ok = true;
  } catch (e) { console.log('FAIL', e.message); }
  await b.close(); console.log(ok ? 'PASS madness-boost' : 'FAIL madness-boost'); process.exit(ok ? 0 : 1); })();
