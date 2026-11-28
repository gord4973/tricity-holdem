// t142u: NEAR MISS moment. 2 flags / 2 plugs / 2 boost gauges + a missed 3rd => big SO CLOSE! callout over the reels (symbols pulsing), flashing frame,
// heartbeat while the last reels crawl, near-miss sting, top-display car revs then stalls; ~1.6s, never blocks the next spin. Phone + iPad portrait.
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
const SH = '/workspace/madness-notes/screens/t142-nearmiss';
(async () => { require('fs').mkdirSync(SH, { recursive: true }); const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await p.goto(BASE + '/madness?debug=1&speed=0.5'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { dbg.style.display = 'none'; }); await p.mouse.click(100, 300); await p.evaluate(() => document.getElementById('billBtn').click()); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      const out = [];
      for (const [force, sym, what] of [['almost', 'FL', '2 CHECKERED FLAGS'], ['almostpl', 'PL', '2 CHARGE PLUGS'], ['almostbg', 'BG', '2 BOOST GAUGES']]) {
        await p.waitForFunction(() => !G.busy, { timeout: 200000 }); await p.evaluate(() => { MadAudio.diag.log = []; MadAudio.diag.beats = 0; window.__near = null; });
        await p.evaluate(f => G.force(f), force); await p.click('#spinBtn');
        await p.waitForFunction(() => window.__near, { timeout: 200000, polling: 50 }); await wait(350);
        const s = await p.evaluate(() => { const e = document.getElementById('near'), r = e.getBoundingClientRect(), t = document.getElementById('nearTitle').getBoundingClientRect(), fr = document.getElementById('frame').getBoundingClientRect();
          return { vis: !e.classList.contains('hidden'), title: document.getElementById('nearTitle').textContent, imgs: e.querySelectorAll('#nearSyms img').length, tl: t.left, tr: t.right, vw: innerWidth, midy: r.top + r.height / 2, fr: [fr.top, fr.bottom], flash: document.getElementById('frame').classList.contains('nearflash'), near: window.__near, log: MadAudio.diag.log.slice(), beats: MadAudio.diag.beats, tmsg: document.getElementById('toast').textContent }; });
        assert.ok(s.vis && s.title === 'SO CLOSE!' && s.imgs === 2 && s.near.sym === sym && s.near.what === what, JSON.stringify(s.near) + ' imgs ' + s.imgs);
        assert.ok(s.tl >= 0 && s.tr <= s.vw + 1, 'title fits'); assert.ok(s.midy > s.fr[0] && s.midy < s.fr[1], 'over the reels'); assert.ok(s.flash, 'frame flashing'); assert.ok(s.log.includes('nearMiss') && s.log.includes('heartbeat'), 'sounds ' + s.log.filter(x => /near|heart|tease/.test(x))); assert.ok(s.beats >= 1, 'heartbeat beats ' + s.beats);
        if (force === 'almost') await p.screenshot({ path: `${SH}/near-flags-${tag}.png` }); if (force === 'almostbg') await p.screenshot({ path: `${SH}/near-boost-${tag}.png` });
        // non-blocking: the spin button works again right away (busy clears) and the callout is gone within ~1.6s
        await p.waitForFunction(() => !G.busy, { timeout: 60000 }); const t0 = Date.now(); await p.waitForFunction(() => document.getElementById('near').classList.contains('hidden'), { timeout: 8000 }); const left = Date.now() - t0;
        const hb = await p.evaluate(() => MadAudio.diag.log.filter(x => x === 'heartbeat').length); assert.ok(hb >= 2, 'heartbeat start + stop events ' + hb); out.push(`${sym} ok (${s.beats} beats, gone ${left}ms later)`);
      }
      assert.deepStrictEqual(errs, []); console.log(tag + ':', out.join(' | '));
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-near' : 'PASS madness-near'); process.exit(fails ? 1 : 0); })();
