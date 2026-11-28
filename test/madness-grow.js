// t143u: 3 flags in a free spin grow the reels one more row for the rest of the round (TURBO 5x3->5x4, NITRO 5x4->5x5 = 3,125 ways), fits phone + iPad portrait, shrinks back after.
// node test/madness-grow.js   (MADNESS_URL=https://... for the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ protocolTimeout: 900000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  const cases = (process.env.GROW_CASES || 'phone,ipad,ipad-820').split(',');
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }], ['ipad-820', { width: 820, height: 1180 }]]) { if (!cases.includes(tag)) continue;
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(BASE + '/madness?debug=1&autostart=1&speed=0.25'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      const geo = () => p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { reelsH: r('reels').height, frameTop: r('frame').top, showH: r('frame').top, spinBot: r('spinBtn').bottom, barBot: r('bar').bottom, vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth, rows: reels.rows, vis: reels.visible(0).length }; });
      const g3 = await geo(); assert.strictEqual(g3.rows, 3);
      const out = [];
      for (const [force, r0, r1, mode] of [['grow', 3, 4, 'turbo'], ['grownitro', 4, 5, 'nitro']]) {
        await p.evaluate(() => { window.__grow = 0; }); await p.evaluate(f => G.force(f), force); await p.click('#spinBtn');
        await p.waitForFunction((m, r) => G.mode === m && reels.rows === r, { timeout: 200000 }, mode, r0); // round start (turbo 3 / nitro 4)
        await p.waitForFunction(r => window.__grow === 1 && window.__rows === r && reels.rows === r, { timeout: 200000 }, r1); await wait(1600);
        const g = await geo(); await p.screenshot({ path: `/workspace/madness-notes/shots/grow-5x${r1}-${tag}.png` });
        assert.ok(Math.abs(g.reelsH / g3.reelsH - r1 / 3) < .12 || g.reelsH <= g.vh * .5 + 2, `reels ${g3.reelsH} -> ${g.reelsH}`);
        assert.ok(g.spinBot <= g.vh + 1 && g.barBot <= g.vh + 1 && g.sw <= g.vw + 1 && g.frameTop >= 40, 'fits portrait ' + JSON.stringify(g));
        const toast = await p.evaluate(() => document.getElementById('toast') ? document.getElementById('toast').textContent : '');
        await p.waitForFunction(() => reels.visible(0).length === reels.rows && reels.reels.every(R => !R.anim), { timeout: 100000 }); // next spin lands the taller grid
        assert.strictEqual(await p.evaluate(() => reels.visible(0).length), r1);
        await p.waitForFunction(() => !G.busy, { timeout: 800000 }); await wait(400);
        assert.strictEqual(await p.evaluate(() => window.__grow), 1, 'one grow per round'); const gb = await geo(); assert.strictEqual(gb.rows, 3, 'back to 5x3'); assert.ok(Math.abs(gb.reelsH - g3.reelsH) < 1.5, 'height restored');
        out.push(`5x${r1}: reels ${g.reelsH.toFixed(0)}px top ${g.frameTop.toFixed(0)} spinBot ${g.spinBot.toFixed(0)}/${g.vh}`); }
      assert.deepStrictEqual(errs, []); console.log(tag + ': ' + out.join(' | '));
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-grow' : 'PASS madness-grow'); process.exit(fails ? 1 : 0); })();
