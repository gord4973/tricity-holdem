// t147u: bonus rounds NEVER start by themselves. Every intro waits for an explicit tap on a pulsing START / SPIN / trail / charge button - even with AUTOPLAY on,
// and far longer than the old 7 / 9 / 10 second timers. node test/madness-nostart.js   (MADNESS_URL=... for live; no autostart hook used here)
const P = require('puppeteer-core'), assert = require('assert');
const BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true }); await p.goto(BASE + '/madness?debug=1&speed=0.5'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
    await p.evaluate(() => { dbg.style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
    const vis = sel => p.evaluate(s => [...document.querySelectorAll(s)].some(b => !b.disabled && b.getBoundingClientRect().width > 0), sel);
    const idle = async (sel, ms, what) => { await wait(ms); assert.ok(await vis(sel), what + ' is still waiting for the player after ' + ms / 1000 + 's'); };
    const flow = async (force, auto) => { await p.waitForFunction(() => !G.busy, { timeout: 400000 }); await p.evaluate(() => { window.__sceneCap = 0; window.__wheelSafety = 0; });
      await p.evaluate(f => G.force(f), force); if (auto) await p.click('#autoBtn'); else await p.click('#spinBtn'); }; // AUTO starts the (forced) spin itself
    const finish = async () => { await p.evaluate(() => { window.__madSpeed = 0.1; const t = setInterval(() => { const vis = sel => [...document.querySelectorAll(sel)].find(b => !b.disabled && b.getBoundingClientRect().width > 0); const x = vis('#sceneHow button') || vis('#splash:not(.hidden) #startBtn') || vis('#wheelBox:not(.hidden) #wheelHub') || vis('#sceneBtns .sbtn'); if (x) x.click(); }, 150); window.__fin = t; });
      await p.waitForFunction(() => !G.busy, { timeout: 400000 }); await p.evaluate(() => { clearInterval(window.__fin); window.__madSpeed = 0.5; }); };
    // 1) wheel: waits well past the old 7 s auto-spin; the wheel is not spun by anything but a tap
    await flow('rally', true); await p.waitForSelector('#wheelBox:not(.hidden) #wheelHub:not([disabled])', { timeout: 120000 }); await idle('#wheelBox:not(.hidden) #wheelHub', 14000, 'MADNESS WHEEL (autoplay on)');
    assert.strictEqual(await p.evaluate(() => window.__wheelSafety || 0), 0, 'wheel safety did not fire while waiting');
    await p.click('#wheelHub'); // 2) rally: how-to card waits past the old 10 s, then the car pick waits past the old 9 s, and the 30 s scene cap stays paused while waiting
    await p.waitForFunction(() => window.__howTitle === 'RALLY RACE' && document.querySelector('#sceneHow:not(.hidden) button'), { timeout: 120000 }); await idle('#sceneHow:not(.hidden) button', 36000, 'RALLY how-to START');
    assert.strictEqual(await p.evaluate(() => window.__sceneCap || 0), 0, 'scene cap paused while waiting');
    assert.ok(await p.evaluate(() => /START/.test(document.querySelector('#sceneHow button').textContent) && document.querySelector('#sceneHow button').classList.contains('pulse')), 'START button is clear and pulsing');
    await p.click('#sceneHow button'); await p.waitForSelector('#sceneBtns .sbtn', { timeout: 30000 }); await idle('#sceneBtns .sbtn:not(.picked)', 14000, 'RALLY car pick'); assert.ok(!(await p.evaluate(() => window.__rallyPick != null)), 'no car was auto-picked');
    await p.click('#sceneBtns .sbtn:nth-child(2)'); await finish();
    // 3) free spins splash: START waits past the old 9 s
    await flow('turbo', false); await p.waitForSelector('#wheelBox:not(.hidden) #wheelHub:not([disabled])', { timeout: 120000 }); await p.click('#wheelHub');
    await p.waitForFunction(() => !document.getElementById('splash').classList.contains('hidden'), { timeout: 200000 }); await idle('#splash:not(.hidden) #startBtn', 12000, 'FREE SPINS splash START'); await p.click('#startBtn'); await finish();
    // 4) S-AWC + charge intros
    await finish();
    for (const [force, title] of [['offroad', 'S-AWC OFF-ROAD CHALLENGE'], ['charge', 'PHEV CHARGE']]) { await flow(force, false); await p.waitForSelector('#wheelBox:not(.hidden) #wheelHub:not([disabled])', { timeout: 120000 }).catch(() => {}); if (await vis('#wheelBox:not(.hidden) #wheelHub')) await p.click('#wheelHub');
      await p.waitForFunction(t => window.__howTitle === t && document.querySelector('#sceneHow:not(.hidden) button'), { timeout: 150000 }, title); await idle('#sceneHow:not(.hidden) button', 13000, title + ' intro'); await p.click('#sceneHow button');
      if (force === 'charge') { await wait(1200); await idle('#sceneBtns .sbtn', 12000, 'PHEV CHARGE button'); assert.ok(!(await p.evaluate(() => window.__chargeDone)), 'no auto-charge'); } await finish(); }
    assert.deepStrictEqual(errs, []); console.log('nostart: wheel, rally intro + pick, free-spin splash, S-AWC intro, PHEV charge all wait for the player (autoplay on too)');
  } catch (e) { fails++; console.log('FAIL', e.message); try { await p.screenshot({ path: '/workspace/madness-notes/shots/nostart-FAIL.png' }); } catch (e2) {} }
  await b.close(); console.log(fails ? 'FAIL madness-nostart' : 'PASS madness-nostart'); process.exit(fails ? 1 : 0); })();
