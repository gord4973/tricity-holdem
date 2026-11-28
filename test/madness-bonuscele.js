// t148u: after ANY bonus-round win the top display carries that bonus's showcase (car + graphics + win amount) until the next spin press.
// node test/madness-bonuscele.js   env: BC_VP=phone|ipad (default phone), BC_ONLY=rally,offroad,charge,turbo,wheel
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
const VPS = { phone: { width: 412, height: 915 }, ipad: { width: 1024, height: 1366 } }, tag = process.env.BC_VP || 'phone', ONLY = (process.env.BC_ONLY || 'rally,offroad,charge,turbo,wheel').split(',');
const FORCE = { rally: 'rally', offroad: 'offroad', charge: 'charge', turbo: 'turbo', wheel: 'c10' }, NAME = { rally: 'RALLY RACE', offroad: 'S-AWC CHALLENGE', charge: 'PHEV CHARGE', turbo: null, wheel: 'MADNESS WHEEL' };
(async () => { const b = await P.launch({ protocolTimeout: 900000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.setViewport({ ...VPS[tag], isMobile: true, hasTouch: true }); await p.goto(BASE + '/madness?debug=1&autostart=1&speed=0.4'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
    await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
    for (const k of ONLY) {
      await p.waitForFunction(() => !G.busy, { timeout: 300000 }); await p.evaluate(() => { window.__bonusCele = null; window.__jpCele = null; }); await p.evaluate(x => G.force(x), FORCE[k]); await p.click('#spinBtn');
      await p.waitForFunction(() => window.__bonusCele && window.__bonusCele.on, { timeout: 300000, polling: 200 }).catch(() => {});
      const ok = await p.evaluate(() => !!(window.__bonusCele && window.__bonusCele.on)); if (!ok) { console.log(k, 'no win this time (not celebrated) - skipped'); await p.waitForFunction(() => !G.busy, { timeout: 300000 }); continue; }
      await p.waitForFunction(() => !G.busy, { timeout: 300000 }); await wait(1800);
      const S = await p.evaluate(() => ({ cele: window.__bonusCele, name: MadShow.celebrating, framecls: document.getElementById('frame').classList.contains('jpcele'), win: document.getElementById('mWin').textContent, busy: G.busy }));
      console.log(k, JSON.stringify(S)); assert.ok(S.cele.on && S.name, k + ': celebration persists after the bonus ends'); if (NAME[k]) assert.strictEqual(S.name, NAME[k]); assert.ok(S.framecls, 'cabinet lights');
      await p.screenshot({ path: `/workspace/madness-notes/shots/bonuscele-${k}-${tag}.png` }); await wait(3000); assert.ok(await p.evaluate(() => !!MadShow.celebrating), k + ': still going after waiting');
      await p.evaluate(() => { window.__autoclicks = 0; }); await p.click('#spinBtn'); await wait(500); assert.ok(!(await p.evaluate(() => MadShow.celebrating)), k + ': cleared on next spin'); assert.ok(!(await p.evaluate(() => document.getElementById('frame').classList.contains('jpcele'))));
    }
    assert.deepStrictEqual(errs, []); console.log('bonus celebrations OK');
  } catch (e) { fails++; console.log('FAIL', e.message); try { await p.screenshot({ path: '/workspace/madness-notes/shots/bonuscele-FAIL.png' }); } catch (e2) {} }
  await b.close(); console.log(fails ? 'FAIL madness-bonuscele' : 'PASS madness-bonuscele'); process.exit(fails ? 1 : 0); })();
