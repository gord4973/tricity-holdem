// t120u: every recorded clip loads (HTTP 200) and decodes (AAC .m4a + the .mp3 fallback) on phone and iPad sizes; every event plays a recording.
// node test/madness-audio.js   (MADNESS_URL=https://... to check the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', URL = BASE + '/madness?debug=1', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = [], resp = {}; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('response', r => { const u = r.url(); if (u.includes('/madness/sfx/')) resp[u.split('/sfx/')[1].split('?')[0]] = r.status(); });
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      const before = Object.keys(resp).length; await p.evaluate(() => { window.__madSpeed = .15; dbg.style.display = 'none'; }); await p.click('#billBtn'); // first tap: unlock + start preloading
      await p.waitForFunction(() => MadAudio.diag.loaded + MadAudio.diag.failed.length >= MadAudio.diag.total, { timeout: 90000, polling: 250 });
      const d = await p.evaluate(() => ({ ...MadAudio.diag, n: MadAudio.sfx.length, st: MadAudio.state() }));
      assert.strictEqual(before, 0, 'no sfx fetched before the first tap (mobile-friendly)');
      assert.strictEqual(d.n, 56, 'clip count'); assert.strictEqual(d.loaded, 56, 'all decoded ' + JSON.stringify(d.failed)); assert.deepStrictEqual(d.failed, []); assert.deepStrictEqual(d.errors, []);
      const m4a = Object.entries(resp).filter(([k]) => k.endsWith('.m4a')); assert.strictEqual(m4a.length, 56, 'm4a requests'); for (const [k, s] of m4a) assert.ok(s === 200 || s === 304, k + " " + s);
      // the .mp3 fallback set must also load and decode
      const mp3 = await p.evaluate(async () => { const ctx = new (window.AudioContext || window.webkitAudioContext)(), bad = []; let ok = 0;
        for (const n of MadAudio.sfx) { try { const r = await fetch(`/madness/sfx/${n}.mp3?v=1`); if (r.status !== 200) { bad.push(n + ' ' + r.status); continue; } const bb = await ctx.decodeAudioData(await r.arrayBuffer()); if (bb.duration > .05) ok++; else bad.push(n + ' short'); } catch (e) { bad.push(n + ' ' + e.message); } } return { ok, bad }; });
      assert.strictEqual(mp3.ok, 56, 'mp3 fallback ' + JSON.stringify(mp3.bad));
      // every event name plays (recording or synth), and the recorded ones actually start buffer sources
      const pl = await p.evaluate(async () => { const s0 = MadAudio.diag.samples, bad = []; for (const n of MadAudio.names) { try { MadAudio.play(n, 1); } catch (e) { bad.push(n); } await new Promise(r => setTimeout(r, 20)); }
        const e = MadAudio.engine(), h = MadAudio.hum(); e.set(.8); h.set(.5); await new Promise(r => setTimeout(r, 200)); e.stop(); h.stop(); return { bad, played: MadAudio.diag.samples - s0, names: MadAudio.names.length }; });
      assert.deepStrictEqual(pl.bad, []); assert.ok(pl.played >= 50, 'recorded clips started: ' + pl.played);
      // real spins drive recordings (spin, reel stops, win)
      const s0 = await p.evaluate(() => MadAudio.diag.samples); for (const f of ['rv5', 'drift', 'big']) { await p.evaluate(f => G.force(f), f); await p.click('#spinBtn'); await wait(100); await p.waitForFunction(() => !G.busy, { timeout: 60000 }); }
      const s1 = await p.evaluate(() => MadAudio.diag.samples); assert.ok(s1 - s0 >= 15, 'spins played recordings: ' + (s1 - s0));
      assert.deepStrictEqual(errs, [], 'page errors'); const kb = await p.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/sfx/') && r.name.includes('.m4a')).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) / 1024);
      console.log(`${tag}: ${d.loaded}/56 decoded (${Object.values(d.fmt).filter(x => x === 'm4a').length} m4a), 56 mp3 fallbacks decode, all HTTP 200, ${pl.played} clips from ${pl.names} events, ${s1 - s0} during 3 spins, ~${kb.toFixed(0)} KB m4a`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-audio' : 'PASS madness-audio'); process.exit(fails ? 1 : 0); })();
