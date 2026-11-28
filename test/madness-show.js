// t117u top display + t118u Gorilla-format bottom bar UI test. node test/madness-show.js [phone|ipad|both]  (SHOTS=dir for screenshots)
const P = require('puppeteer-core'), assert = require('assert');
const URL = (process.env.MADNESS_URL || 'http://localhost:3490') + '/madness?debug=1&autostart=1', SHOTS = process.env.SHOTS, which = process.argv[2] || 'both';
const SIZES = { phone: [412, 915, 3.5], ipad: [1024, 1366, 2] }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const tag of which === 'both' ? ['phone', 'ipad'] : [which]) { const [w, h, dsf] = SIZES[tag]; const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: Math.min(dsf, 2) });
    await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.G && !G.busy && window.MadShow);
    await p.evaluate(() => { document.getElementById('dbg').style.display = 'none'; window.__madShots = 1; });
    const S = () => p.evaluate(() => MadShow.state), shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/top-${n}-${tag}.png` }); };
    const idle = () => p.waitForFunction(() => !G.busy, { timeout: 60000, polling: 100 });
    try {
      // ---- t118u bottom bar: denomination + bet in credits like Gorilla ----
      await p.click('#billBtn'); await idle();
      // ---- t112u audio: unlocked on the first tap, sound ON by default, sounds actually play, visible mute toggle ----
      let au = await p.evaluate(() => ({ st: MadAudio.state(), muted: MadAudio.muted, d: MadAudio.diag, icon: muteBtn.textContent }));
      assert.ok(au.st === 'running' && !au.muted && au.d.unlocks > 0 && au.d.plays > 0 && au.icon === '🔊', 'audio unlock/play ' + JSON.stringify(au));
      await p.click('#muteBtn'); au = await p.evaluate(() => ({ muted: MadAudio.muted, icon: muteBtn.textContent })); assert.deepStrictEqual(au, { muted: true, icon: '🔇' });
      await p.click('#muteBtn'); assert.strictEqual(await p.evaluate(() => MadAudio.muted), false); console.log(tag, 'audio ok (unlocked on first tap, playing, mute toggle)');
      let m = await p.evaluate(() => ({ cash: mCash.textContent, cred: mCred.textContent, bet: mBet.textContent, betD: mBetD.textContent, den: denomTxt.textContent }));
      assert.deepStrictEqual(m, { cash: '$100.00', cred: '10,000', bet: '50', betD: '$0.50', den: '1¢' }, 'default 1¢ / 50 credits ' + JSON.stringify(m));
      await p.click('#denomBtn'); await p.waitForSelector('#denomModal:not(.hidden)'); assert.strictEqual(await p.$$eval('#denoms button', x => x.map(e => e.textContent).join(',')), '1¢,2¢,5¢,10¢,25¢,$1');
      await p.click('#denoms button[data-d="25"]'); await p.click('#denomModal .close');
      await p.click('#betUp'); m = await p.evaluate(() => ({ cred: mCred.textContent, bet: mBet.textContent, betD: mBetD.textContent, den: denomTxt.textContent }));
      assert.deepStrictEqual(m, { cred: '400', bet: '100', betD: '$25.00', den: '25¢' }, '25¢ x 100 credits ' + JSON.stringify(m));
      const before = await p.evaluate(() => G.st.cents); await p.evaluate(() => G.force('multi')); await p.click('#spinBtn'); await idle();
      const after = await p.evaluate(() => ({ c: G.st.cents, w: window.__winCycle.total }));
      assert.strictEqual(after.c, before - 2500 + Math.round(after.w * 50 * 25), 'cents debit/credit follow denom x credits'); // win units x 50 credits x 25¢
      assert.strictEqual(await p.$eval('#mWin', e => e.textContent), String(Math.round(after.w * 50)), 'WIN meter in credits');
      // t121u: WIN box shows the $ amount under the credits (like BET), live through the count-up/cycle, $0.00 with no win
      assert.strictEqual(await p.$eval('#mWinD', e => e.textContent), '$' + (Math.round(after.w * 50 * 25) / 100).toFixed(2), 'WIN $ line');
      await p.evaluate(() => { window.__winPairs = []; window.__wp = setInterval(() => __winPairs.push([mWin.textContent, mWinD.textContent]), 40); G.force('multi'); }); await p.click('#spinBtn');
      await wait(30); assert.strictEqual(await p.$eval('#mWinD', e => e.textContent), '$0.00', 'WIN $ resets to $0.00 on spin'); await idle(); await wait(500);
      const pairs = await p.evaluate(() => { clearInterval(__wp); return __winPairs; }); const bad = pairs.filter(([c, d]) => Math.abs(+c.replace(/,/g, '') * 25 / 100 - +d.replace(/[$,]/g, '')) > 0.26);
      assert.ok(pairs.length > 10 && new Set(pairs.map(p => p[1])).size >= 2 && !bad.length, 'WIN $ tracks credits live ' + JSON.stringify(bad.slice(0, 3)));
      await p.evaluate(() => { G.setDenom(1); G.setBet(0); }); console.log(tag, 'bottom bar ok (denoms, credits, bet $, win credits)');
      // ---- t117u top display ----
      await p.click('#spinBtn'); await idle(); await wait(1500);   // settle
      let s = await S(); assert.ok(s.frames > 20, 'show animating'); await shot('idle');
      await p.evaluate(() => { window.__madSpeed = 1; G.force('win'); }); await p.click('#spinBtn'); await wait(350); s = await S();
      assert.strictEqual(s.state, 'spin'); assert.strictEqual(s.gantry, 'green'); assert.ok(s.zoom > 1.06 && s.speed > .3, 'camera push + speed ' + JSON.stringify(s)); await shot('spinning');
      await p.waitForFunction(() => MadShow.state.events.filter(e => e.k === 'stop').length >= 5, { timeout: 20000 }); await idle();
      s = await S(); assert.ok(s.events.some(e => e.k === 'stop' && e.r === 0) && s.events.some(e => e.k === 'stop' && e.r === 4), 'every reel stop reacts');
      await p.evaluate(() => G.force('almost')); await p.click('#spinBtn'); await p.waitForFunction(() => MadShow.state.gantry === 'tease', { timeout: 20000, polling: 30 }); await wait(500); s = await S();
      assert.ok(s.red > .3 && s.zoom > 1.12, 'anticipation: red + zoom ' + JSON.stringify(s)); await shot('anticipation'); await idle();
      await p.waitForFunction(() => MadShow.state.red < .3, { timeout: 4000, polling: 50 }).catch(() => {}); s = await S(); assert.ok(s.gantry !== 'tease' && s.red < .3, 'tease ends ' + JSON.stringify(s));
      await p.evaluate(() => G.force('multi')); await p.click('#spinBtn'); await p.waitForFunction(() => MadShow.state.state === 'win', { timeout: 20000, polling: 30 }); await wait(1000); s = await S();
      assert.ok(s.actors.some(a => a.endsWith('*')), 'winning model races in ' + JSON.stringify(s.actors)); await shot('win');
      await p.waitForFunction(() => MadShow.state.events.some(e => e.k === 'dive'), { timeout: 8000 }); console.log(tag, 'win car dives into the reels ok');
      await idle(); await p.evaluate(() => G.force('wheel3')); await p.click('#spinBtn'); await p.waitForFunction(() => MadShow.state.events.some(e => e.k === 'bonus'), { timeout: 20000 });
      await wait(250); await shot('bonus-transition'); console.log(tag, 'bonus full-cabinet transition ok');
      await p.evaluate(() => { const w = document.getElementById('wheelHub'); w && w.click(); }); await p.waitForFunction(() => !G.busy, { timeout: 90000, polling: 200 }).catch(() => {});
      assert.strictEqual(errs.length, 0, errs.join('\n')); console.log(tag, 'top display ok: idle -> spin -> stops -> anticipation -> win -> dive -> bonus');
    } catch (e) { fails++; console.log('FAIL', tag, e.message); if (SHOTS) await p.screenshot({ path: `${SHOTS}/top-FAIL-${tag}.png` }); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-show' : 'PASS madness-show'); process.exit(fails ? 1 : 0); })();
