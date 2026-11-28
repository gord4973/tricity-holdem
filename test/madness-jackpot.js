// t145u: the four jackpots (RVR MINI < ECLIPSE MINOR < OUTLANDER MAJOR < PHEV GRAND) each run a full-machine showcase of their Mitsubishi that gets longer / bigger each tier,
// tap-to-skip works, the pay is unchanged (JP x bet) and the celebration carries back to the main screen until the next spin.
// node test/madness-jackpot.js   env: JP_VP=phone|ipad|ipad-820 (default phone), JP_SPEED (default 1), JP_ONLY=mini,minor,... , JP_SHOTS=dir
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
const VPS = { phone: { width: 412, height: 915 }, ipad: { width: 1024, height: 1366 }, 'ipad-820': { width: 820, height: 1180 } };
const tag = process.env.JP_VP || 'phone', SPEED = +(process.env.JP_SPEED || 1), SHOTS = process.env.JP_SHOTS || '/workspace/madness-notes/shots', ONLY = (process.env.JP_ONLY || 'mini,minor,major,grand').split(',');
(async () => { const b = await P.launch({ protocolTimeout: 900000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0; const dur = {};
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  try {
    await p.setViewport({ ...VPS[tag], isMobile: true, hasTouch: true }); await p.goto(BASE + `/madness?debug=1&speed=${SPEED}`); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
    await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
    const shot = async name => p.screenshot({ path: `${SHOTS}/jp-${name}-${tag}.png` });
    const phase = (ph, to = 120000) => p.waitForFunction(x => window.__jackpot && window.__jackpot.log.some(l => l[0] === x), { timeout: to }, ph);
    for (const k of ONLY) {
      await p.evaluate(() => { window.__jackpot = null; window.__jpCele = null; }); await p.evaluate(x => G.force('jp' + x), k);
      const c0 = await p.evaluate(() => G.st.cents); await p.click('#spinBtn');
      await p.waitForFunction(x => window.__jackpot && window.__jackpot.id === x, { timeout: 180000 }, k);
      const skipTest = k === 'mini' && process.env.JP_SKIP;
      if (k === 'grand') { await phase('dark'); await wait(1250 * SPEED); await shot('grand-0a-thunder'); await phase('charge'); await wait(3600 * SPEED); await shot('grand-0b-charge'); await phase('surge'); await wait(250 * SPEED); await shot('grand-0c-surge'); }
      await phase('spotlight'); await wait(500 * SPEED); await shot(`${k}-1-spotlight`);
      await phase('brake'); await wait(300 * SPEED); await shot(`${k}-2-arrive`);
      await phase('slam'); await wait(900 * SPEED); await shot(`${k}-3-slam`);
      if (k === 'grand') { }
      await phase('rollup'); await p.waitForFunction(() => window.__jackpot.rollU > .55, { timeout: 60000 }); await shot(`${k}-4-rollup`);
      await phase('landed', 90000); await wait(1200 * SPEED); await shot(`${k}-5-landed`);
      await phase('done', 90000);
      const J = await p.evaluate(() => window.__jackpot), done = J.log.find(l => l[0] === 'done')[1]; dur[k] = done; assert.ok(!J.skipped, 'natural run');
      for (const ph of ['dark', 'spotlight', 'drive-in', 'brake', 'slam', 'rollup', 'landed']) assert.ok(J.log.some(l => l[0] === ph), k + ' has phase ' + ph);
      if (k === 'grand') for (const ph of ['charge', 'surge']) assert.ok(J.log.some(l => l[0] === ph), 'grand has ' + ph);
      const jpSnd = await p.evaluate(() => (MadAudio.diag.jp || []).slice()); for (const n of ['dark', 'spot', 'drive', 'stop', 'slam', 'land']) assert.ok(jpSnd.includes(n), k + ' plays its ' + n + ' sound ' + jpSnd);
      // pay unchanged
      const exp = await p.evaluate(x => G.M.JP[x] * G.M.BETS[G.st.bet], k); assert.strictEqual(Math.round(J.amount * 1e6), Math.round(exp * 1e6), 'pays ' + exp + 'x');
      await p.waitForFunction(() => !G.busy || window.__jpCele, { timeout: 60000 }); await wait(1500);
      const cele = await p.evaluate(() => ({ show: MadShow.celebrating, cls: document.getElementById('frame').classList.contains('jpcele'), win: document.getElementById('mWin').textContent, busy: G.busy, st: window.__jpCele }));
      assert.ok(cele.show && cele.cls && cele.st && cele.st.on, 'celebration persists on the main screen ' + JSON.stringify(cele)); await shot(`${k}-6-main`);
      await wait(3500 * SPEED); const still = await p.evaluate(() => MadShow.celebrating); assert.ok(still, 'still celebrating until next spin');
      await p.waitForFunction(() => !G.busy, { timeout: 60000 });
      const sc = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight, jp: r('jp').width }; }); assert.ok(sc.sw <= sc.vw + 1, 'no horizontal overflow');
      // next spin ends the celebration
      await p.click('#spinBtn'); await wait(500); const off = await p.evaluate(() => ({ show: MadShow.celebrating, cls: document.getElementById('frame').classList.contains('jpcele') })); assert.ok(!off.show && !off.cls, 'celebration ends on the next spin ' + JSON.stringify(off));
      await p.waitForFunction(() => !G.busy, { timeout: 120000 });
      console.log(`${tag} ${k}: showcase ${done}s, phases ${J.log.map(l => l[0] + '@' + l[1]).join(' ')}`); }
    // tap-to-skip (RVR MINI, mid rollup): jumps to the landing, tap again closes
    if (ONLY.includes('mini')) { await p.evaluate(() => { window.__jackpot = null; }); await p.evaluate(() => G.force('jpmini')); await p.click('#spinBtn'); await p.waitForFunction(() => window.__jackpot && window.__jackpot.log.some(l => l[0] === 'slam'), { timeout: 180000 }); await wait(1500 * SPEED);
      const t0 = Date.now(); await p.click('#jp'); await p.waitForFunction(() => window.__jackpot.landed && window.__jackpot.skipped, { timeout: 5000 }); await p.click('#jp'); await p.waitForFunction(() => window.__jackpot.done, { timeout: 5000 }); assert.ok(Date.now() - t0 < 6000, 'skip is quick');
      await p.waitForFunction(() => !G.busy, { timeout: 60000 }); console.log(tag + ': tap-to-skip OK'); }
    const order = ONLY.filter(k => dur[k] != null).map(k => dur[k]); for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1] * 1.15, 'spectacle grows each tier ' + JSON.stringify(dur));
    assert.deepStrictEqual(errs, []); console.log(tag + ' durations', JSON.stringify(dur));
  } catch (e) { fails++; console.log('FAIL', tag, e.message.slice(0, 600)); try { await p.screenshot({ path: `${SHOTS}/jp-FAIL-${tag}.png` }); } catch (e2) {} }
  await b.close(); console.log(fails ? 'FAIL madness-jackpot' : 'PASS madness-jackpot'); process.exit(fails ? 1 : 0); })();
