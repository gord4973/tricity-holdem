// t135u: NITRO SPINS grow the reels to 5x4 (1,024 ways) with an expand animation, everything still fits on phone / iPad portrait, back to 5x3 after.
// node test/madness-nitro.js   (MADNESS_URL=https://... for the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }], ['ipad-820', { width: 820, height: 1180 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(BASE + '/madness?debug=1&autostart=1&speed=0.3'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      const geo = () => p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { reelsH: r('reels').height, frameTop: r('frame').top, frameBot: r('frame').bottom, spinBot: r('spinBtn').bottom, barBot: r('bar').bottom, vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth, rows: reels.rows, vis: reels.visible(0).length, cell: reels.cellH, colW: reels.colW }; });
      const g3 = await geo(); assert.strictEqual(g3.rows, 3);
      await p.evaluate(() => G.force('nitro')); await p.click('#spinBtn');
      await p.waitForFunction(() => window.__rows === 4 && reels.rows === 4, { timeout: 120000 }); await wait(200);
      const g4 = await geo(); await p.screenshot({ path: `/workspace/madness-notes/shots/nitro-5x4-${tag}.png` });
      assert.ok(Math.abs(g4.reelsH / g3.reelsH - 4 / 3) < .03, `reels ${g3.reelsH} -> ${g4.reelsH} (4/3)`); assert.ok(Math.abs(g4.cell - g3.cell) < 1.5, 'tiles keep their size');
      assert.ok(g4.spinBot <= g4.vh + 1 && g4.barBot <= g4.vh + 1 && g4.sw <= g4.vw + 1 && g4.frameTop >= 0, 'fits portrait ' + JSON.stringify(g4));
      // a Nitro spin lands 4 symbols per reel
      await p.waitForFunction(() => reels.visible(0).length === 4 && reels.reels.every(R => !R.anim) && G.mode === 'nitro', { timeout: 60000 });
      const logged = await p.evaluate(() => (MadAudio.diag.log || []).includes('turbo'));
      await p.waitForFunction(() => !G.busy, { timeout: 400000 }); await wait(300);
      const gb = await geo(); assert.strictEqual(gb.rows, 3, 'back to 5x3'); assert.ok(Math.abs(gb.reelsH - g3.reelsH) < 1.5, 'height restored'); assert.strictEqual(gb.vis, 3);
      assert.deepStrictEqual(errs, []); console.log(`${tag}: reels ${g3.reelsH.toFixed(0)} -> ${g4.reelsH.toFixed(0)}px (5x4), spin btn bottom ${g4.spinBot.toFixed(0)}/${g4.vh}, grow sound ${logged}, back to 5x3`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-nitro' : 'PASS madness-nitro'); process.exit(fails ? 1 : 0); })();
