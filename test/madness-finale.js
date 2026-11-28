// t141u: BONUS-WIN FINALE. Bonus-round wins >= 3x bet get a full-machine takeover scaled by x-bet tier, a climbing rollup sound (rollStart / rollTick xN / rollEnd),
// a giant total, tap-to-skip (jump to total, then close). Pays unchanged. Phone + iPad portrait. node test/madness-finale.js [MADNESS_URL=...]
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.MADNESS_URL || 'http://localhost:3490', wait = ms => new Promise(r => setTimeout(r, ms));
const SH = '/workspace/madness-notes/screens/t141-finale';
(async () => { require('fs').mkdirSync(SH, { recursive: true }); const b = await P.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 915 }], ['ipad', { width: 1024, height: 1366 }]]) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    try {
      await p.setViewport({ ...vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await p.goto(BASE + '/madness?debug=1&autostart=1&speed=1'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
      await p.evaluate(() => { dbg.style.display = 'none'; }); await p.mouse.click(100, 300); await p.evaluate(() => document.getElementById('billBtn').click()); await p.waitForFunction(() => !G.busy && G.st.cents > 0, { timeout: 30000 }); await wait(300);
      const vpw = vp.width;
      const run = async (how, want, shot) => {
        await p.waitForFunction(() => !G.busy, { timeout: 400000 });
        const c0 = await p.evaluate(() => G.st.cents); await p.evaluate(() => { MadAudio.diag.log = []; window.__finale = null; });
        if (how.force) { await p.evaluate(f => G.force(f), how.force); await p.click('#spinBtn'); } else await p.evaluate(x => { window.__demoP = __finaleDemo(x, 'BONUS DEMO'); }, how.demo);
        await p.waitForFunction(() => window.__finale && !document.getElementById('big').classList.contains('hidden'), { timeout: 400000, polling: 100 });
        await wait(1400); if (shot) await p.screenshot({ path: `${SH}/${shot}-${tag}-rolling.png` });
        const mid = await p.evaluate(() => ({ cls: document.getElementById('big').className, title: document.getElementById('bigTitle').textContent, x: document.getElementById('bigX').textContent, r: document.getElementById('bigAmt').getBoundingClientRect().toJSON(), vw: innerWidth, f: { ...window.__finale } }));
        assert.ok(/bonus/.test(mid.cls), 'finale class ' + mid.cls); assert.strictEqual(mid.title, want, 'title ' + mid.title); assert.ok(/× BET/.test(mid.x), 'x-bet chip ' + mid.x);
        assert.ok(mid.r.left >= 0 && mid.r.right <= mid.vw + 1, 'total fits the screen ' + JSON.stringify(mid.r));
        await wait(1000); const ticks = await p.evaluate(() => MadAudio.diag.log.filter(x => x === 'rollTick').length); assert.ok(ticks >= 3, 'rollup ticks ' + ticks);
        // tap once = jump to the total + finale fanfare; tap again = close
        const preRolled = await p.evaluate(() => !!(window.__finale && window.__finale.rolled)); await p.evaluate(() => document.getElementById('big').click());
        await p.waitForFunction(() => window.__finale && window.__finale.rolled, { timeout: 20000 }); await wait(500); if (shot) await p.screenshot({ path: `${SH}/${shot}-${tag}-total.png` });
        const end = await p.evaluate(() => ({ amt: document.getElementById('bigAmt').textContent, log: MadAudio.diag.log.slice(), f: { ...window.__finale } }));
        assert.ok(end.log.includes('rollStart') && end.log.includes('rollEnd'), 'rollStart + rollEnd'); assert.ok(end.f.skipped || preRolled, 'skip recorded (or the rollup had already finished on a slow device)');
        await wait(200); await p.evaluate(() => document.getElementById('big').click()); await p.waitForFunction(() => document.getElementById('big').classList.contains('hidden'), { timeout: 20000 });
        await p.waitForFunction(() => !G.busy, { timeout: 400000 });
        if (how.force) { const c1 = await p.evaluate(() => G.st.cents); assert.ok(c1 > c0, 'credits added'); }
        return end.amt;
      };
      const r = [];
      r.push(['locked 5x', await run({ force: 'locked' }, 'BONUS WIN', 'bonus5x')]);
      r.push(['wheel 10x', await run({ force: 'c10' }, 'BIG WIN', 'big10x')]);
      r.push(['wheel 25x', await run({ force: 'c25' }, 'MEGA WIN', 'mega25x')]);
      r.push(['demo 80x', await run({ demo: 80 }, 'MITSUBISHI MADNESS!', 'madness80x')]);
      const ticks = await p.evaluate(() => MadAudio.diag.rollTicks || 0);
      assert.deepStrictEqual(errs, []); console.log(tag + ':', r.map(x => x.join(' ')).join(' | '), '| ticks', ticks);
    } catch (e) { fails++; console.log('FAIL', tag, e.message); }
    await p.close(); }
  await b.close(); console.log(fails ? 'FAIL madness-finale' : 'PASS madness-finale'); process.exit(fails ? 1 : 0); })();
