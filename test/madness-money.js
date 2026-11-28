// t122u: payouts across every denomination (1¢ - $1) x bet (50 - 500 credits). node test/madness-money.js
const P = require('puppeteer-core'), assert = require('assert');
const URL = (process.env.MADNESS_URL || 'http://localhost:3490') + '/madness?debug=1', wait = ms => new Promise(r => setTimeout(r, ms));
const DENOMS = [1, 2, 5, 10, 25, 100], BETS = [0, 1, 2, 3, 4], CR = [50, 100, 150, 250, 500];
const usd = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
(async () => { const b = await P.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.G && !G.busy);
  await p.evaluate(() => { window.__madSpeed = .08; document.getElementById('dbg').style.display = 'none'; }); await p.click('#billBtn'); await p.waitForFunction(() => !G.busy);
  const idle = () => p.waitForFunction(() => !G.busy, { timeout: 120000, polling: 100 });
  const tapper = setInterval(() => p.evaluate(() => { for (const id of ['wheelHub', 'startBtn']) { const e = document.getElementById(id); if (e && e.offsetParent && !e.disabled) e.click(); } const h = document.querySelector('#sceneHow:not(.hidden) button'); h && h.click(); const s = document.querySelector('#sceneBtns button:not(:disabled)'); s && s.click(); }).catch(() => {}), 400);
  async function run(force, d, bi) { await p.evaluate((d, bi, f) => { G.st.cents = 50000000; G.setDenom(d); G.setBet(bi); window.__lastFeature = null; window.__lastWheel = null; G.force(f); }, d, bi, force);
    const c0 = await p.evaluate(() => G.st.cents); await p.click('#spinBtn'); await wait(50); await idle(); await wait(150);
    const r = await p.evaluate(() => ({ c: G.st.cents, ls: window.__lastSpin, f: window.__lastFeature, w: window.__lastWheel, mWin: mWin.textContent, mWinD: mWinD.textContent, mBet: mBet.textContent, mBetD: mBetD.textContent, jpG: jpG.textContent, jpM: jpM.textContent, JP: G.M.JP }));
    const u = r.ls.units, betU = [1, 2, 3, 5, 10][bi], tag = `${force} @ ${d}¢ x ${CR[bi]}cr`;
    assert.strictEqual(r.mBet, String(CR[bi]), tag + ' bet credits'); assert.strictEqual(r.mBetD, usd(CR[bi] * d), tag + ' bet $');
    assert.strictEqual(r.ls.betCents, CR[bi] * d, tag + ' bet cents'); assert.strictEqual(r.c - c0, Math.round(u * 50 * d) - CR[bi] * d, tag + ' balance = win credits x denom - bet');
    assert.strictEqual(r.mWin, Math.round(u * 50).toLocaleString('en-US'), tag + ' WIN credits'); assert.strictEqual(r.mWinD, usd(Math.round(u * 50 * d)), tag + ' WIN $');
    assert.strictEqual(r.jpG, usd(r.JP.grand * betU * 50 * d), tag + ' GRAND plaque = 1000x bet $'); assert.strictEqual(r.jpM, usd(r.JP.mini * betU * 50 * d), tag + ' MINI plaque');
    if (r.f && r.f.kind === 'charge') assert.ok(Math.abs(r.f.win - r.f.km * betU) < 1e-9, tag + ' charge = km x bet');
    if (r.f && r.f.kind === 'rally') assert.ok(Math.abs(r.f.win - r.f.x * betU) < 1e-9, tag + ' rally = x times bet');
    if (r.w && r.w.wedge && r.w.wedge.jp && !r.w.locked) assert.ok(Math.abs(r.w.win - r.JP[r.w.wedge.jp] * betU) < 1e-9, tag + ' jackpot wedge');
    if (r.w && r.w.locked) assert.ok(Math.abs(r.w.win - 5 * betU) < 1e-9, tag + ' locked = 5x bet');
    return { u, betU, cents: Math.round(u * 50 * d) }; }
  let n = 0, fails = 0;
  try {
    // every denomination x every bet, base-game wins (deterministic grid): win credits scale with bet, $ = credits x denom
    const base = {}; for (const d of DENOMS) for (const bi of BETS) { const r = await run('big', d, bi); n++; base[d + ':' + bi] = r; }
    console.log('base matrix ok: ' + n + ' combos'); 
    for (const f of ['jackpot', 'drift', 'wild', 'mini', 'grandwheel', 'locked', 'full72', 'rally1', 'summit', 'turbo'])
      for (const [d, bi] of [[1, 0], [5, 1], [25, 3], [100, 4]]) { const r = await run(f, d, bi); n++;
        if (f === 'jackpot') assert.ok(r.u >= 1000 * r.betU, f + ' pays >= 1000x bet'); if (f === 'mini') assert.ok(r.u >= 20 * r.betU, 'mini >= 20x'); if (f === 'grandwheel') assert.ok(r.u >= 1000 * r.betU, 'grand wheel >= 1000x');
        if (f === 'full72') assert.ok(r.u >= 72 * r.betU, 'full charge >= 72x bet'); if (f === 'rally1') assert.ok(r.u >= 30 * r.betU, 'rally 1st >= 30x'); if (f === 'summit') assert.ok(r.u >= 20 * r.betU, 'summit >= 20x'); }
    console.log('feature matrix ok');
    assert.deepStrictEqual(errs, []);
  } catch (e) { fails++; console.log('FAIL', e.message); }
  clearInterval(tapper); await b.close(); console.log(fails ? 'FAIL madness-money' : `PASS madness-money: ${n} spins across ${DENOMS.length} denoms x ${BETS.length} bets + features`); process.exit(fails ? 1 : 0); })();
