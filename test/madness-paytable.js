// t123u: the paytable, the win banner, WIN credits and WIN $ all come from one function (M.wayPay) and agree exactly at every denom x bet.
// node test/madness-paytable.js   (IPAD=1 for iPad viewport, SHOTS=dir to save win + paytable screenshots at 10¢/50 and $1/500)
const P = require('puppeteer-core'), assert = require('assert');
const URL = (process.env.MADNESS_URL || 'http://localhost:3490') + '/madness?debug=1', wait = ms => new Promise(r => setTimeout(r, ms));
const DENOMS = [1, 2, 5, 10, 25, 100], CR = [50, 100, 150, 250, 500], SHOTS = process.env.SHOTS;
const usd = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (process.env.IPAD) await p.setViewport({ width: 1024, height: 1366, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
  await p.evaluate(() => { window.__madSpeed = .1; document.getElementById('dbg').style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy);
  const idle = () => p.waitForFunction(() => !G.busy, { timeout: 60000, polling: 100 });
  let n = 0, fails = 0;
  async function check(force, d, bi, mult, shot) {
    await p.evaluate((d, bi) => { G.st.cents = 50000000; G.setDenom(d); G.setBet(bi); }, d, bi);
    await p.click('#menuBtn'); await wait(250); const pay = await p.evaluate(() => ({ t: window.__payShown, head: document.querySelector('#menuBody .payhead').textContent }));
    if (shot) await p.screenshot({ path: `${SHOTS}/paytable-${shot}.png` });
    await p.evaluate(() => document.getElementById('menu').classList.add('hidden'));
    const sym = force.startsWith('ph') ? 'PH' : 'RV', row = pay.t.rows[sym][2], tag = `${force} @ ${d}¢ x ${CR[bi]}cr`;
    assert.ok(pay.head.includes('PER WINNING WAY') && pay.head.includes(`${CR[bi]} credits`) && pay.head.includes(usd(CR[bi] * d)), tag + ' paytable header: ' + pay.head);
    await p.evaluate(f => G.force(f), force); await p.click('#spinBtn'); await wait(50); await idle(); await wait(250);
    const r = await p.evaluate(() => ({ banner: winBanner.textContent, mWin: mWin.textContent, mWinD: mWinD.textContent, ls: window.__lastSpin, cyc: window.__winCycle }));
    if (shot) await p.screenshot({ path: `${SHOTS}/win-${shot}.png` });
    const wantCr = row.cr * mult, wantUsd = usd(wantCr * d);
    assert.strictEqual(r.mWin, wantCr.toLocaleString('en-US'), tag + ' WIN credits vs paytable x' + mult);
    assert.strictEqual(r.mWinD, wantUsd, tag + ' WIN $');
    assert.ok(r.banner.endsWith('= ' + wantUsd), tag + ' banner "' + r.banner + '" vs ' + wantUsd);
    if (mult === 1) assert.strictEqual(row.usd, wantUsd, tag + ' paytable cell = banner');
    for (const k in pay.t.rows) pay.t.rows[k].forEach(c => assert.strictEqual(Math.round(c.x * CR[bi]), c.cr, tag + ' x bet column = credits / bet credits'));
    if (force === 'rv5w') assert.ok(/1 WAY · WILD ×2/.test(r.banner), tag + ' banner names the wild multiplier');
    if (force === 'rv5x2') assert.ok(/2 WAYS/.test(r.banner), tag + ' banner shows 2 ways');
    assert.strictEqual(r.ls.credits, wantCr, tag + ' credited'); n++;
    return { banner: r.banner, paycell: row, win: r.mWin, winD: r.mWinD };
  }
  try {
    for (const d of DENOMS) for (let bi = 0; bi < 5; bi++) { await check('rv5', d, bi, 1); await check('ph5', d, bi, 1); }
    console.log('rv5 / ph5 matrix ok (' + n + ')');
    for (const [d, bi] of [[1, 0], [10, 0], [25, 2], [100, 4]]) { await check('rv5w', d, bi, 2); await check('rv5x2', d, bi, 2); }
    if (SHOTS) { const a = await check('rv5', 10, 0, 1, '10c-50'); const c = await check('rv5', 100, 4, 1, '1d-500'); const g = await check('ph5', 2, 4, 1, '2c-500-ph5'); console.log('2¢/500 PHEV 5oak:', JSON.stringify(g)); console.log('10¢/50:', JSON.stringify(a)); console.log('$1/500:', JSON.stringify(c)); }
    assert.deepStrictEqual(errs, []);
  } catch (e) { fails++; console.log('FAIL', e.message); }
  await b.close(); console.log(fails ? 'FAIL madness-paytable' : `PASS madness-paytable: ${n} spins, paytable = banner = WIN credits = WIN $ at every denom x bet`); process.exit(fails ? 1 : 0); })();
