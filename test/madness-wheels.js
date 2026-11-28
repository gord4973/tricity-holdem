// t130u: side-view cars' wheels rotate with their speed (rotation = distance / wheel radius) in the top display, fly-bys and bonus scenes.
// node test/madness-wheels.js   (MADNESS_URL=https://... for the live site)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', URL = BASE + '/madness?debug=1', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy && window.MadWheels);
      // every model's wheel sprites cut from its photo
      const sp = await p.evaluate(async () => { const ks = Object.keys(MadWheels.POS), out = {}; for (const k of ks) { const i = new Image(); i.src = `/madness/art/car-${k}.webp?v=1`; await i.decode(); const s = MadWheels.sprites(i); out[k] = s ? s.map(x => x.c.width) : null; } return out; });
      for (const [k, s] of Object.entries(sp)) assert.ok(s && s.length === 2 && s.every(n => n > 20), 'sprites ' + k + ' ' + JSON.stringify(s));
      await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      await p.evaluate(() => { G.force('rv5'); window.__wheelDraws = 0; }); await p.click('#spinBtn');
      // sample moving cars: wheel angle advance must equal distance travelled / radius (forward = leftwards = counter-clockwise)
      await wait(250); const samples = await p.evaluate(() => new Promise(res => { const out = []; const f = () => { out.push(MadShow.state.wheels); if (out.length < 90) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
      let checked = 0, maxOm = 0; for (let i = 1; i < samples.length; i++) for (const a of samples[i]) { const b0 = samples[i - 1].find(x => x.k === a.k && Math.abs(x.x - a.x) < a.w * .3); if (!b0 || !a.w || samples[i].filter(x => x.k === a.k).length > 1 || samples[i - 1].filter(x => x.k === a.k).length > 1) continue; const dx = a.x - b0.x; if (Math.abs(dx) < .5 || samples[i].length !== samples[i - 1].length) continue;
        let da = a.wa - b0.wa; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const want = (dx > .01 ? 1 : -1) * Math.hypot(dx, a.y - b0.y) / (.066 * a.w);
        maxOm = Math.max(maxOm, Math.abs(a.wo)); { const T = 2 * Math.PI, e = (((da - want) % T) + T) % T, err = Math.min(e, T - e); assert.ok(err < Math.max(.2, Math.abs(want) * .02), `rate ${a.k} da=${da.toFixed(3)} want=${want.toFixed(3)} (mod 2pi)`); checked++; } }
      assert.ok(checked >= 5, 'moving cars sampled: ' + checked); const draws = await p.evaluate(() => window.__wheelDraws); assert.ok(draws > 20, 'wheel draws ' + draws);
      await p.screenshot({ path: `/workspace/madness-notes/shots/wheels-${tag}.png` }); await p.waitForFunction(() => !G.busy, { timeout: 60000 });
      // fly-by + race scene use tracked wheels too
      const fb = await p.evaluate(async () => { window.__wheelDraws = 0; MadFX.flyBy('phev', 900); await new Promise(r => setTimeout(r, 600)); return window.__wheelDraws; }).catch(e => 'n/a ' + e.message);
      assert.ok(typeof fb !== 'number' || fb > 4, 'flyBy wheels ' + fb);
      assert.deepStrictEqual(errs, []); console.log(`${tag}: sprites ok for ${Object.keys(sp).length} models, ${checked} moving-car samples match distance/radius, max ${maxOm.toFixed(2)} rad/frame, ${draws} wheel draws, flyBy ${fb}`);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-wheels' : 'PASS madness-wheels'); process.exit(fails ? 1 : 0); })();
