// t136u: reel pace - reel 1 lands at 1.0s, then one reel every 0.45s (last at 2.8s) on base spins, autoplay and free spins alike (no STOP tap).
// node test/madness-reeltime.js   (MADNESS_URL=... for live)
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', SP = 0.5;
(async () => { const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); let ok = false;
  try { const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
    await p.goto(BASE + '/madness?debug=1&speed=' + SP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy && window.reels, { timeout: 60000 });
    await p.evaluate(() => { window.__spins = []; const o = reels.spin.bind(reels); reels.spin = (g, opt = {}) => { const rec = { fast: opt.fast, tease: !!(opt.tease && opt.tease.some(Boolean)), t0: performance.now(), stops: [], mode: G.mode || null }; __spins.push(rec); const os = opt.onStop; opt.onStop = (r, c) => { rec.stops.push(performance.now() - rec.t0); os && os(r, c); }; const pr = o(g, opt); rec.T = reels.reels.map(R => R.anim && R.anim.T); return pr; }; });
    await p.evaluate(() => document.getElementById('billBtn').click()); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 });
    const T = await p.evaluate(() => MadReels.TIMING); assert.deepStrictEqual(T, { STOP0: 1, STAGGER: 0.45, REEL_V: 18 });
    for (let i = 0; i < 3; i++) { await p.click('#spinBtn'); await new Promise(r => setTimeout(r, 100)); await p.waitForFunction(() => !G.busy, { timeout: 120000 }); }
    await p.click('#autoBtn'); await p.waitForFunction(() => __spins.length >= 6, { timeout: 120000 }); await p.click('#autoBtn').catch(() => {}); await p.waitForFunction(() => !G.busy, { timeout: 200000 });
    await p.evaluate(() => G.force('turbo')); await p.click('#spinBtn'); await p.waitForFunction(() => __spins.filter(s => s.mode).length >= 3, { timeout: 300000 }); await p.waitForFunction(() => !G.busy, { timeout: 400000 });
    const S = await p.evaluate(() => __spins); let n = 0, nf = 0;
    for (const s of S) { assert.strictEqual(s.fast, 1, 'no hurry without a STOP tap'); if (s.tease || s.stops.length < 5) continue; n++; if (s.mode) nf++;
      s.T.forEach((t, r) => assert.ok(Math.abs(t - (1.0 + 0.45 * r) * 1000 * SP) < 1, `configured reel ${r + 1} ${t / SP}ms`));
      s.stops.forEach((t, r) => { const want = (1.0 + 0.45 * r) * 1000 * SP; assert.ok(t - want > -40 && t - want < 250, `reel ${r + 1} at ${(t / SP).toFixed(0)}ms (want ${(want / SP).toFixed(0)}) mode ${s.mode}`); }); }
    assert.ok(n >= 6 && nf >= 2, `checked ${n} spins (${nf} free)`); assert.deepStrictEqual(errs, []);
    const one = S.find(s => !s.tease && s.stops.length === 5); console.log('reel stops (ms, real speed):', one.stops.map(t => Math.round(t / SP)).join(' / '), `| ${n} spins incl. ${nf} free spins + autoplay`); ok = true;
  } catch (e) { console.log('FAIL', e.message); }
  await b.close(); console.log(ok ? 'PASS madness-reeltime' : 'FAIL madness-reeltime'); process.exit(ok ? 0 : 1); })();
