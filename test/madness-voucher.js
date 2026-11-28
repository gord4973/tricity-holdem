// t128u: the CASH OUT voucher prints fully on screen (not cut off at the right edge), is readable and taps away - phone + iPad portrait.
// node test/madness-voucher.js   (MADNESS_URL=https://... for the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', URL = BASE + '/madness?debug=1&autostart=1', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }], ['ipad-safari', { width: 820, height: 1180 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { window.__madSpeed = .3; dbg.style.display = 'none'; }); await p.click('#billBtn'); await wait(300); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 });
      await p.click('#cashBtn'); await wait(1700);
      const r = await p.evaluate(() => { const t = document.getElementById('ticket'), b = t.getBoundingClientRect(); return { vis: !t.classList.contains('hidden') && getComputedStyle(t).display !== 'none', l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, vw: innerWidth, vh: innerHeight, txt: t.innerText, fs: parseFloat(getComputedStyle(t).fontSize) }; });
      assert.ok(r.vis, 'voucher shown'); assert.ok(r.l >= 0 && r.r <= r.vw && r.t >= 0 && r.b <= r.vh, 'voucher inside viewport ' + JSON.stringify(r)); assert.ok(r.w >= 150, 'wide enough');
      assert.ok(/CASH-OUT VOUCHER/.test(r.txt) && /\$100\.00/.test(r.txt) && /TICKET #/.test(r.txt), 'readable text'); assert.ok(r.fs >= 9, 'font size ' + r.fs);
      // the topmost element at each corner is the voucher itself (not hidden under the panel / off screen)
      const top = await p.evaluate(({ l, r, t, b }) => [[l + 4, t + 4], [r - 4, t + 4], [l + 4, b - 4], [r - 4, b - 4]].every(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest('#ticket'); }), r);
      assert.ok(top, 'voucher on top at all four corners');
      await p.screenshot({ path: `/workspace/madness-notes/shots/voucher-${tag}.png` });
      await p.click('#ticket'); await wait(200); assert.ok(await p.evaluate(() => document.getElementById('ticket').classList.contains('hidden')), 'tap dismisses');
      assert.deepStrictEqual(errs, []); console.log(`${tag}: voucher ${Math.round(r.l)}-${Math.round(r.r)} of ${r.vw}px, ${Math.round(r.t)}-${Math.round(r.b)} of ${r.vh}px, tap dismisses`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-voucher' : 'PASS madness-voucher'); process.exit(fails ? 1 : 0); })();
