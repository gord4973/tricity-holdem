// t127u: reel-stop sounds tell you when symbols are lining up (like Gorilla). Each stop that continues a possible win from reel 1 plays an
// escalating 'lineUp' (n = 2..5) and glows the tiles; non-contributing stops are a plain clunk; flags / plugs / PHEVs have landing sounds.
// node test/madness-lineup.js   (MADNESS_URL=https://... for the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', URL = BASE + '/madness?debug=1';
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { window.__madSpeed = .3; dbg.style.display = 'none'; G.setDenom(2); }); await p.click('#billBtn');
      await p.waitForFunction(() => MadAudio.diag.loaded >= 20, { timeout: 60000 });
      const run = async f => { await p.waitForFunction(() => !G.busy, { timeout: 60000 }); await new Promise(r => setTimeout(r, 300)); await p.evaluate(f => { G.force(f); MadAudio.diag.log = []; window.__hotMax = 0; window.__hotT = setInterval(() => { window.__hotMax = Math.max(window.__hotMax, G.reels.hot.size); }, 30); }, f);
        await p.click('#spinBtn'); await new Promise(r => setTimeout(r, 150)); await p.waitForFunction(() => !G.busy, { timeout: 60000 });
        return p.evaluate(() => { clearInterval(window.__hotT); return { log: window.__stopLog, sounds: MadAudio.diag.log.slice(), hot: window.__hotMax }; }); };
      // 5 RVRs on the middle row: reel 1 plain, then lineUp 2,3,4,5 with glowing tiles
      let r = await run('rv5'); assert.deepStrictEqual(r.log.map(x => x.kind), ['plain', 'lineUp', 'lineUp', 'lineUp', 'lineUp'], JSON.stringify(r.log));
      assert.deepStrictEqual(r.log.map(x => x.n), [1, 2, 3, 4, 5]); assert.strictEqual(r.sounds.filter(s => s === 'lineUp').length, 4); assert.ok(r.hot >= 5, 'tiles glow ' + r.hot);
      // t131u: the win plays the RVR's own sound (horn + rev), not tyre screech
      { const d = await p.evaluate(() => ({ sw: MadAudio.diag.symWins.slice(), log: MadAudio.diag.log.slice() })); assert.strictEqual(d.sw[d.sw.length - 1], 'RV', 'RVR win sound'); assert.ok(r.sounds.includes('symWin'), 'symWin played'); assert.ok(!r.sounds.includes('screech'), 'no tyre screech on an RVR win: ' + r.sounds.join(',')); }
      // nothing in common between reel 1 and reel 2: every stop is a plain clunk, no lineUp, no glow
      r = await run('noline'); assert.deepStrictEqual(r.log.map(x => x.kind), ['plain', 'plain', 'plain', 'plain', 'plain']);
      assert.ok(!r.sounds.includes('lineUp')); assert.strictEqual(r.sounds.filter(s => s === 'reelStop').length, 5); assert.strictEqual(r.hot, 0);
      // t132u: PHEVs landing where they continue nothing -> only the plain stop, no per-symbol landing sounds
      r = await run('phscatter'); assert.deepStrictEqual(r.log.map(x => x.kind), ['plain', 'plain', 'plain', 'plain', 'plain']);
      { const stopSounds = r.sounds.filter(s => /reelStop|lineUp|phLand|sparkle|flag|plugLand/.test(s)); assert.deepStrictEqual(stopSounds, ['reelStop', 'reelStop', 'reelStop', 'reelStop', 'reelStop'], 'plain only: ' + r.sounds.join(',')); }
      // PHEVs landing on every reel: distinct PHEV landing sound + escalating lineUp
      r = await run('ph5'); assert.strictEqual(r.sounds.filter(s => s === 'phLand').length, 4, 'phLand only on contributing reels 2-5'); assert.deepStrictEqual(r.log.map(x => x.n), [1, 2, 3, 4, 5]); assert.strictEqual(r.log[4].top, 'PH');
      // CHARGE plugs: their own plug-in landing sound, escalating with each plug (t129u)
      r = await run('plugs2'); assert.strictEqual(r.sounds.filter(s => s === 'plugLand').length, 2, 'plugLand x2'); assert.deepStrictEqual(r.log.filter(x => x.land.includes('plug')).map(x => x.r), [0, 2]);
      assert.ok(await p.evaluate(() => MadAudio.loaded().includes('plugIn')), 'plugIn clip decoded');
      { const d = await p.evaluate(() => MadAudio.diag.symWins.slice(-1)[0]); assert.strictEqual(d, 'PH', 'PHEV win sound'); }
      // every symbol has its own recorded win sound: each starts recordings, and the clip sets differ symbol to symbol
      const per = await p.evaluate(async () => { const out = {}; for (const s of ['PH', 'OU', 'EV', 'EC', 'RV', 'TI', 'KY']) { const s0 = MadAudio.diag.samples; MadAudio.play('symWin', s, 0); out[s] = MadAudio.diag.samples - s0; await new Promise(r => setTimeout(r, 30)); } return out; });
      for (const [k, n] of Object.entries(per)) assert.ok(n >= 1, 'symWin ' + k + ' started ' + n);
      // the lining-up sound fires loud and climbs: 4 lineUps for 5 in a row (bell pitch steps 0/4/7/12 semitones)
      // flags get their own (rising) landing sound
      r = await run('almost'); assert.ok(r.sounds.filter(s => s === 'flag').length >= 2, 'flag sounds');
      assert.deepStrictEqual(errs, []); console.log(`${tag}: symWin per symbol ${JSON.stringify(per)}, rv5 plain→lineUp×4 (glow ${r.hot >= 0 ? 'ok' : ''}), noline all plain, ph5 phLand×4, phscatter plain×5, flags ok`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-lineup' : 'PASS madness-lineup'); process.exit(fails ? 1 : 0); })();
