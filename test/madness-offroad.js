// t144u: each S-AWC Off-Road attempt runs ~3x longer (4.2 s of trail + tension vs the old 1.4 s), with real obstacles, camera push-in and a tense finish.
// Runs at REAL speed (__madSpeed = 1) so the timing is what a player sees.  node test/madness-offroad.js   (MADNESS_URL=https://... for live)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CE', m.text().slice(0, 300)); });
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(BASE + '/madness?debug=1&speed=1'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { dbg.style.display = 'none'; window.__madSpeed = 1; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      await p.evaluate(() => { window.__offroadRunMs = []; window.__offroadBumps = 0; window.__offroadDone = false; G.force('summit'); }); await p.click('#spinBtn');
      // let the how-to / wheel run fast, then play the first stage at real speed
      await p.waitForSelector('#sceneBtns .sbtn', { timeout: 120000 }); await p.evaluate(() => { window.__madSpeed = 1; });
      let shots = 0; const t0 = Date.now();
      while (!(await p.evaluate(() => window.__offroadDone))) { if (Date.now() - t0 > 240000) throw new Error('offroad never finished');
        const st = await p.evaluate(() => { const S = window.__offroadSt; return S ? { drive: S.drive, t: S.t, tens: S.tens, stage: S.stage, pulse: document.querySelectorAll('#sceneBtns .sbtn.pulse').length } : {}; });
        if (st.pulse === 3) await p.click('#sceneBtns .sbtn:nth-child(2)');
        if (st.drive && st.stage >= 1 && st.t > 1500 && st.tens === 0 && shots === 0) { shots = 1; await p.screenshot({ path: `/workspace/madness-notes/shots/offroad-run-${tag}.png` }); }
        if (st.drive && st.stage >= 1 && st.tens > .6 && shots === 1) { shots = 2; await p.screenshot({ path: `/workspace/madness-notes/shots/offroad-tension-${tag}.png` }); }
         await wait(120); }

      const r = await p.evaluate(() => ({ runs: window.__offroadRunMs, bumps: window.__offroadBumps }));
      assert.strictEqual(r.runs.length, 5, 'five stage runs'); for (const x of r.runs) assert.ok(x.trailMs >= 4100 && x.trailMs < 6500, 'trail run ' + x.trailMs + ' ms (old 1,400)'); assert.ok(r.bumps >= 5, 'bumps ' + r.bumps);
      assert.deepStrictEqual(errs, []); console.log(`${tag}: ${r.runs.length} runs ${r.runs.map(x => x.trailMs).join('/')} ms (was ~1400), ${r.bumps} bumps`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-offroad' : 'PASS madness-offroad'); process.exit(fails ? 1 : 0); })();
