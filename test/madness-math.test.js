// MITSUBISHI MADNESS math: paytable order, ways evaluation, jackpots, wheel locks, free spins, rally, S-AWC, PHEV charge (72 km cap), RTP.
const test = require('node:test'), assert = require('assert'), M = require('../public/madness/math.js');
const G = cols => cols.map(c => c.map(s => typeof s === 'string' ? { s } : s));
test('t125u pay order (Gord): Smart Key < Tire < RVR < Eclipse Cross < Sportback EV < Outlander < Outlander PHEV (top prize)', () => {
  assert.deepStrictEqual(M.PAYSYMS, ['KY', 'TI', 'RV', 'EC', 'EV', 'OU', 'PH']); assert.deepStrictEqual(M.LOWS, ['KY', 'TI']); assert.ok(!M.SYM.SH && !M.SYM.HL, 'shifter/helmet removed');
  for (let i = 1; i < M.CARS.length; i++) { const a = M.CARS[i - 1], b = M.CARS[i]; for (let n = 0; n < 3; n++) assert.ok(M.PAY[b][n] >= M.PAY[a][n], `${b} pays >= ${a} for ${n + 3}`); }
  assert.ok(M.PAY.PH[2] > M.PAY.OU[2] * 1.8, 'PHEV 5-of-a-kind clearly the top line pay');
  // t123u: pays make sense vs the TOTAL bet (per winning way): PHEV 5oak 10-20x, RVR 5oak 1-3x, lowest symbol 5oak >= 1x, 3oak 0.2x - 1x
  assert.ok(M.PAY.PH[2] >= 10 && M.PAY.PH[2] <= 20, 'PH 5oak ' + M.PAY.PH[2]); assert.ok(M.PAY.RV[2] >= 1 && M.PAY.RV[2] <= 3, 'RV 5oak');
  assert.ok(M.PAY.OU[2] >= 8 && M.PAY.OU[2] <= 10 && M.PAY.EV[2] >= 4 && M.PAY.EV[2] <= 6 && M.PAY.EC[2] >= 2.5 && M.PAY.EC[2] <= 3.5, 'OU ~8x, EV ~5x, EC ~3x'); assert.ok(M.PAY.PH[0] >= .8 && M.PAY.PH[0] <= 1.2, 'PH 3oak ~1x');
  for (const s of M.PAYSYMS) assert.ok(M.PAY[s][0] >= .2, s + ' 3oak >= 0.2x bet');
  for (const s of M.PAYSYMS) { assert.ok(M.PAY[s][2] >= 1, s + ' 5oak >= 1x bet'); assert.ok(M.PAY[s][0] <= 1, s + ' 3oak <= bet'); assert.ok(M.PAY[s][0] < M.PAY[s][1] && M.PAY[s][1] < M.PAY[s][2]); }
  for (let i = 1; i < M.PAYSYMS.length; i++) for (let n = 0; n < 3; n++) assert.ok(M.PAY[M.PAYSYMS[i]][n] >= M.PAY[M.PAYSYMS[i - 1]][n], 'ordered ' + M.PAYSYMS[i]);
  // paytable credits are whole credits at the 50-credit bet and PAY is derived from them (single source)
  for (const s of M.PAYSYMS) M.PAYC[s].forEach((c, n) => { assert.ok(Number.isInteger(c)); assert.strictEqual(M.PAY[s][n], c / M.BASE_CR); assert.strictEqual(M.wayPay(s, n + 3, 1), c / M.BASE_CR); });
  assert.strictEqual(M.JP.grand, 1000); assert.ok(M.JP.grand > M.JP.major && M.JP.major > M.JP.minor && M.JP.minor > M.JP.mini);
});
test('243-ways evaluation with wild multipliers', () => {
  const g = G([['EC', 'RV', 'RV'], ['RV', { s: 'WD', mult: 2 }, 'RV'], ['EC', 'EC', 'OU'], ['RV', 'OU', 'RV'], ['OU', 'OU', 'OU']]);
  const r = M.evalWays(g, 2); const ec = r.ways.find(w => w.s === 'EC');
  assert.ok(ec && ec.len === 3 && ec.ways === 2 && ec.mult === 2, JSON.stringify(ec)); assert.ok(Math.abs(ec.pay - M.PAY.EC[0] * 2 * 4) < 1e-9);
  const none = M.evalWays(G([['RV', 'RV', 'RV'], ['EC', 'EC', 'EC'], ['RV', 'RV', 'RV'], ['RV', 'RV', 'RV'], ['RV', 'RV', 'RV']]), 1); assert.strictEqual(none.win, 0, 'reel 2 breaks the way');
});
test('five Outlander PHEVs on the centre row = PHEV GRAND (1000x bet)', () => {
  const s = M.spin(3, Math.random, { force: g => { for (let r = 0; r < 5; r++) g[r][1] = { s: 'PH' }; } });
  assert.ok(s.jackpot && s.jackpot.id === 'grand' && s.jackpot.win === 3000); assert.ok(s.win >= 3000);
});
test('triggers: 3/4/5 flags -> wheel tier 1/2/3, 3 plugs -> PHEV charge, meter fills', () => {
  for (const n of [3, 4, 5]) { const s = M.spin(1, Math.random, { force: g => { for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (/FL|PL/.test(g[r][y].s)) g[r][y] = { s: 'RV' }; for (let r = 0; r < n; r++) g[r][0] = { s: 'FL' }; } }); assert.deepStrictEqual([s.trigger.type, s.trigger.tier], ['wheel', n - 2]); }
  const c = M.spin(1, Math.random, { force: g => { for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (/FL|PL/.test(g[r][y].s)) g[r][y] = { s: 'RV' }; for (const r of [0, 2, 4]) g[r][2] = { s: 'PL' }; } }); assert.strictEqual(c.trigger.type, 'charge');
  const m = { n: M.METER_MAX - 1 }; const s = M.spin(1, Math.random, { meter: m, force: g => { for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (/FL|PL/.test(g[r][y].s)) g[r][y] = { s: 'RV' }; g[0][0] = { s: 'FL' }; } });
  assert.ok(s.meter.full && s.trigger.via === 'meter' && m.n === 0);
});
test('reel strips: specials at most once per 3-row window', () => {
  for (const S of [...M.STRIPS, ...M.FREE_STRIPS]) for (let i = 0; i < S.length; i++) for (const k of ['FL', 'PL', 'WD']) if (S[i] === k) for (const d of [1, 2]) assert.notStrictEqual(S[(i + d) % S.length], k);
});
test('Madness Wheel: locks by tier, locked pays 5x, REV UP raises the tier', () => {
  const rng = M.mulberry32(5);
  assert.deepStrictEqual(M.LOCKS[1].sort(), ['grand', 'madness', 'major']); assert.deepStrictEqual(M.LOCKS[3], []);
  const w = M.spinWheel(2, rng, 1, { forceIdx: M.WHEEL.findIndex(x => x.id === 'grand'), forceRevUp: false }); assert.ok(w.locked && w.win === 10);
  const u = M.spinWheel(2, rng, 2, { forceIdx: M.WHEEL.findIndex(x => x.id === 'grand'), forceRevUp: true }); assert.ok(u.revUp && u.tier === 3 && !u.locked && u.win === 2000);
  const f = M.spinWheel(1, rng, 3, { forceIdx: M.WHEEL.findIndex(x => x.id === 'charge') }); assert.strictEqual(f.feat, 'charge');
  assert.strictEqual(M.WHEEL.length, 12);
});
test('PHEV charge: every km = 1 credit x bet, never more than 72 km; full charge = exactly 72 credits at bet 1', () => {
  const full = M.charge(1, M.mulberry32(1), { forceFull: true }); assert.strictEqual(full.km, 72); assert.strictEqual(full.win, 72); assert.ok(full.full);
  const rng = M.mulberry32(9); let maxKm = 0, fulls = 0, sum = 0; const N = 40000;
  for (let i = 0; i < N; i++) { const c = M.charge(1, rng); assert.ok(c.km <= 72 && c.km >= 3); assert.strictEqual(c.win, c.km); let t = 0; for (const b of c.bursts) { t += b.km; assert.strictEqual(b.total, t); } assert.strictEqual(t, c.km); assert.strictEqual(c.full, c.km === 72); assert.strictEqual(c.surge, !c.full); maxKm = Math.max(maxKm, c.km); fulls += c.full; sum += c.km; }
  assert.strictEqual(maxKm, 72); assert.ok(fulls / N > .02 && fulls / N < .15, 'full charge rate ' + fulls / N); assert.ok(sum / N > 18 && sum / N < 40, 'avg km ' + sum / N);
  assert.strictEqual(M.charge(5, M.mulberry32(2), { forceFull: true }).win, 360, 'scales with bet');
  const s = M.charge(1, M.mulberry32(3), { forceSurgeAt: 30 }); assert.ok(s.surge && s.km >= 30 && s.km < 72);
});
test('rally race and S-AWC challenge', () => {
  const rng = M.mulberry32(4);
  assert.deepStrictEqual([1, 2, 3, 4].map(p => M.rally(1, rng, { forcePlace: p, forceNitro: false }).win), [30, 15, 8, 4]);
  assert.strictEqual(M.rally(2, rng, { forcePlace: 1, forceNitro: true }).win, 120);
  const sm = M.offroad(1, rng, { forceStuck: -1 }); assert.ok(sm.summit && sm.cleared === 5 && sm.win === sm.stages.reduce((a, s) => a + s.prize, 0) + 20);
  const st = M.offroad(1, rng, { forceStuck: 0, forceRescue: false }); assert.ok(st.stages[0].stuck && st.win === 0 && st.cleared === 0);
  const rs = M.offroad(1, rng, { forceStuck: 1, forceRescue: true }); assert.ok(rs.rescued && rs.stages[1].rescue);
});
test('free spins: TURBO 8 / NITRO 8 / MADNESS 10, retriggers, cap 50, gear up, madness multiplier climbs', () => {
  const rng = M.mulberry32(11);
  for (const m of ['turbo', 'nitro', 'madness']) { const R = M.bonusRound(1, rng, m); assert.ok(R.played >= M.FS_START[m] && R.played <= 50); assert.ok(Math.abs(R.win - R.spins.reduce((a, s) => a + s.win, 0)) < 1e-6); }
  const g = M.bonusRound(1, rng, 'turbo', { forceGearUp: true }); assert.ok(g.gearUp && g.gearUp.to === 'nitro' && g.finalMode === 'nitro' && g.played >= 10);
  let climbed = false; for (let i = 0; i < 40 && !climbed; i++) { const R = M.bonusRound(1, rng, 'madness'); climbed = R.spins.some(s => s.prog > 1); } assert.ok(climbed, 'madness multiplier climbs');
});
test('RTP ~95% with frequent small wins and regular bonuses (2M seeded spins)', () => {
  const r = M.simulate(2000000, M.mulberry32(20261127));
  console.log(`  RTP ${(r.rtp * 100).toFixed(2)}%  hit ${(r.hitRate * 100).toFixed(1)}%  wheel 1/${r.wheelEvery.toFixed(0)}  charge 1/${r.chargeEvery.toFixed(0)}  drift 1/${r.driftEvery.toFixed(0)}  avg km ${r.avgKm.toFixed(1)}  full ${(r.fullChargeRate * 100).toFixed(1)}%`);
  assert.ok(r.rtp > .90 && r.rtp < 1.0, 'rtp ' + r.rtp); assert.ok(r.hitRate > .22, 'hit rate'); assert.ok(r.wheelEvery > 40 && r.wheelEvery < 110, 'wheel freq'); assert.ok(r.chargeEvery < 500, 'charge freq');
});
test('t115u: 243-ways evaluator matches brute-force line enumeration; win cells are exactly the contributing tiles (incl. wilds)', () => {
  const rng = M.mulberry32(115), syms = ['KY', 'TI', 'RV', 'EC', 'OU', 'EV', 'PH', 'WD', 'FL', 'PL'];
  for (let n = 0; n < 20000; n++) {
    const grid = [0, 1, 2, 3, 4].map(r => [0, 1, 2].map(() => { const s = syms[Math.floor(rng() * syms.length)]; return s === 'WD' ? { s, mult: [1, 2, 3][Math.floor(rng() * 3)] } : { s }; }));
    const got = M.evalWays(grid, 1);
    // brute force: every symbol, every length 3..5, count left-anchored adjacent paths (each path = one row per reel)
    let want = 0; const wantCells = {};
    for (const s of M.PAYSYMS) { let best = null;
      for (let len = 5; len >= 3 && !best; len--) { let total = 0; const cells = new Set();
        const walk = (r, mult, path) => { if (r === len) { total += mult; path.forEach(([rr, y]) => cells.add(rr + ',' + y)); return; }
          grid[r].forEach((c, y) => { if (c.s === s || c.s === 'WD') walk(r + 1, mult * (c.s === 'WD' ? (c.mult || 1) : 1), [...path, [r, y]]); }); };
        walk(0, 1, []);
        // longest only: a way counts at its full length; a length-L way must not extend to reel L
        if (total > 0 && (len === 5 || !grid[len].some(c => c.s === s || c.s === 'WD'))) best = { len, total, cells }; }
      if (best) { want += M.PAY[s][best.len - 3] * best.total; wantCells[s] = best.cells; } }
    assert.ok(Math.abs(got.win - want) < 1e-9, `grid ${JSON.stringify(grid)} got ${got.win} want ${want}`);
    for (const w of got.ways) { const c = new Set(w.cells.map(([r, y]) => r + ',' + y)); assert.deepStrictEqual([...c].sort(), [...wantCells[w.s]].sort(), 'cells for ' + w.s);
      for (let r = 0; r < w.len; r++) assert.ok(w.cells.some(([rr]) => rr === r), 'every reel up to the way length has a highlighted tile'); }
  }
});

test('t122u: every payout scales exactly with the bet (ways, wilds/mults, drift, wheel credits/locks, jackpots, free spins, rally, S-AWC, PHEV charge = km x bet)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  // same seed at bet 1 and bet b must give the same outcome scaled by b
  for (const b of M.BETS) {
    for (let seed = 1; seed <= 4000; seed++) { const r1 = M.spin(1, M.mulberry32(seed)), rb = M.spin(b, M.mulberry32(seed));
      assert.ok(near(rb.win, r1.win * b), `spin seed ${seed} bet ${b}: ${rb.win} vs ${r1.win * b}`); }
    for (const tier of [1, 2, 3]) for (let seed = 1; seed <= 300; seed++) { const w1 = M.spinWheel(1, M.mulberry32(seed), tier), wb = M.spinWheel(b, M.mulberry32(seed), tier); assert.ok(near(wb.win, w1.win * b), `wheel t${tier} s${seed}`); }
    for (const feat of ['turbo', 'nitro', 'madness', 'rally', 'offroad', 'charge']) for (let seed = 1; seed <= 150; seed++) { const f1 = M.feature(1, M.mulberry32(seed), feat), fb = M.feature(b, M.mulberry32(seed), feat);
      assert.ok(near(fb.win, f1.win * b), `${feat} seed ${seed} bet ${b}: ${fb.win} vs ${f1.win * b}`); if (feat === 'charge') assert.ok(near(fb.win, fb.km * b), 'charge = km x bet'); }
    const full = M.feature(b, M.mulberry32(9), 'charge', { forceFull: true }); assert.ok(full.km === 72 && near(full.win, 72 * b), 'full charge = 72x bet');
    for (const id of ['mini', 'minor', 'major', 'grand']) assert.ok(M.JP[id] > 0);
  }
});

test('t135u: NITRO SPINS play 5x4 = 1,024 ways; other modes and the base game stay 5x3; Nitro round value kept', () => {
  assert.strictEqual(M.rowsOf('nitro'), 4); assert.strictEqual(M.rowsOf('turbo'), 3); assert.strictEqual(M.rowsOf('madness'), 3); assert.strictEqual(M.rowsOf(null), 3);
  for (let seed = 1; seed <= 300; seed++) { const n = M.spin(1, M.mulberry32(seed), { mode: 'nitro' }), t = M.spin(1, M.mulberry32(seed), { mode: 'turbo' }), b = M.spin(1, M.mulberry32(seed));
    assert.ok(n.grid.every(c => c.length === 4), 'nitro 4 rows'); assert.ok(t.grid.every(c => c.length === 3) && b.grid.every(c => c.length === 3), '3 rows elsewhere');
    if (n.drift) for (const r of n.drift.reels) assert.ok(n.grid[r].length === 4 && n.grid[r].every(c => c.s === 'WD'), 'drift fills all 4 rows'); }
  // a full screen of one symbol = 4^5 = 1,024 ways
  const g = [...Array(5)].map(() => [...Array(4)].map(() => ({ s: 'RV' }))), w = M.evalWays(g, 1).ways.find(x => x.s === 'RV');
  assert.strictEqual(w.ways, 1024); assert.strictEqual(w.cells.length, 20); assert.ok(Math.abs(w.pay - M.wayPay('RV', 5, 1, 1024)) < 1e-9);
  // the bigger grid is rebalanced: Nitro round mean stays ~40-46x bet (was 42x on 5x3)
  let s = 0; const N = 6000, rng = M.mulberry32(135); for (let i = 0; i < N; i++) s += M.bonusRound(1, rng, 'nitro').win; const mean = s / N;
  assert.ok(mean > 34 && mean < 52, 'nitro round mean ' + mean.toFixed(2));
});

test('t137u: every DRIFT WILD pays at least one way (base game + every free-spin mode), drift reel is fully wild on reels 2-4', () => {
  const seen = { base: 0, turbo: 0, nitro: 0, madness: 0 };
  for (const mode of [null, 'nitro', 'madness']) { const rng = M.mulberry32(137 + (mode ? mode.length : 0));
    for (let i = 0; i < (mode ? 60000 : 300000); i++) { const s = M.spin(1, rng, mode ? { mode } : {});
      if (!s.drift) continue; seen[mode || 'base']++;
      assert.ok(s.win > 0 && s.ways.length > 0, `drift wild paid nothing (${mode || 'base'}, spin ${i})`);
      for (const r of s.drift.reels) { assert.ok(r >= 1 && r <= 3); assert.ok(s.grid[r].every(c => c.s === 'WD' && c.drift)); }
      assert.ok(s.ways.some(w => s.drift.reels.some(r => r < w.len)), 'a paying way runs through the drift reel'); } }
  // forced drift (any reel 2-4) also always pays
  for (let seed = 1; seed <= 3000; seed++) { const s = M.spin(1, M.mulberry32(seed), { forceDrift: 1 + seed % 3 }); assert.ok(s.win > 0, 'forced drift seed ' + seed); }
  assert.ok(seen.base > 5000 && seen.nitro > 2000 && seen.madness > 5000, JSON.stringify(seen));
});

test('t138u/t139u: 3 BOOST GAUGES (reels 2-4) launch the BOOSTED WHEEL (no locks); the flag-filled BOOST meter still fires at 100%', () => {
  for (let r = 0; r < 5; r++) { const n = M.STRIPS[r].filter(s => s === 'BG').length; assert.strictEqual(n, r >= 1 && r <= 3 ? M.BGN : 0, 'BG on reels 2-4 only'); assert.ok(!M.FREE_STRIPS[r].includes('BG'), 'no BG in free spins'); }
  assert.ok(M.PAYSYMS.indexOf('BG') < 0, 'BG never pays on a way'); assert.deepStrictEqual(M.LOCKS[M.BOOST_TIER], []);
  const rng = M.mulberry32(138); let boosts = 0, meterFires = 0; const meter = { n: 0 }; const N = 600000;
  for (let i = 0; i < N; i++) { const s = M.spin(1, rng, { meter }); if (s.boosts >= 3) { assert.ok(s.trigger && s.trigger.via === 'boost' && s.trigger.tier === M.BOOST_TIER && s.trigger.type === 'wheel'); boosts++; } if (s.trigger && s.trigger.via === 'meter') meterFires++; }
  assert.ok(N / boosts > 350 && N / boosts < 1000, 'boost every ' + (N / boosts).toFixed(0)); assert.ok(meterFires > 600, 'meter still fires ' + meterFires);
  // the meter path is unchanged: METER_MAX - 1 + one flag = wheel via meter
  const m2 = { n: M.METER_MAX - 1 }; let got = null; for (let seed = 1; seed < 5000 && !got; seed++) { m2.n = M.METER_MAX - 1; const s = M.spin(1, M.mulberry32(seed), { meter: m2, noDrift: true }); if (s.trigger && s.trigger.via === 'meter') got = s; }
  assert.ok(got && got.trigger.tier === 1, 'meter wheel still tier 1');
  for (let seed = 1; seed <= 200; seed++) { const w = M.spinWheel(1, M.mulberry32(seed), M.BOOST_TIER, { forceRevUp: false }); assert.ok(!w.locked); }
});
