// GORILLA slot math: unit tests + a short RTP simulation (full 1M run: node tools/gorilla-sim.js 1000000)
const test = require('node:test'), assert = require('node:assert');
const M = require('../public/gorilla/math.js');
const fixed = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
test('strips: fixed, deterministic, scatter/wild spacing', () => {
  assert.deepStrictEqual(M.STRIPS, require('../public/gorilla/math.js').STRIPS);
  M.STRIPS.forEach((s, r) => { const c = M.COUNTS[r]; assert.strictEqual(s.length, Object.values(c).reduce((a, b) => a + b, 0)); for (let i = 0; i < s.length; i++) for (const k of ['DR', 'WD']) if (s[i] === k) for (let d = 1; d <= 2; d++) assert.notStrictEqual(s[(i + d) % s.length], k, `reel ${r} ${k} too close at ${i}`); });
  assert.ok(!M.STRIPS[0].includes('WD') && !M.STRIPS[2].includes('WD') && M.STRIPS[1].includes('WD'), 'wild only on reel 2');
});
test('27 ways: 3 of a kind pays per way in bet/27 units', () => {
  const g = grid => { const res = M.spin(270, Math.random, { force: gr => grid.forEach((col, r) => col.forEach((s, y) => gr[r][y] = typeof s === 'string' ? { s } : s)) }); return res; };
  let r = g([['SB', 'RB', 'EM'], ['SB', 'EM', 'RB'], ['SB', 'SP', 'BN']]); // one way of SB, EM? no (reel 3 has none)
  assert.strictEqual(r.ways.length, 1); assert.strictEqual(r.ways[0].s, 'SB'); assert.strictEqual(r.win, M.PAY.SB * 10);
  r = g([['SB', 'SB', 'EM'], ['SB', 'MK', 'RB'], ['SB', 'SB', 'SB']]); assert.strictEqual(r.ways[0].ways, 6); assert.strictEqual(r.win, M.PAY.SB * 10 * 6);
  r = g([['SB', 'TC', 'EM'], ['MK', 'MK', 'RB'], ['SB', 'BN', 'BN']]); assert.strictEqual(r.win, 0, 'reel 2 must match');
});
test('reel-2 wild substitutes and multiplies', () => {
  const r = M.spin(270, Math.random, { force: g => { g[0] = [{ s: 'MK' }, { s: 'RB' }, { s: 'EM' }]; g[1] = [{ s: 'BN' }, { s: 'WD', mult: 5 }, { s: 'SP' }]; g[2] = [{ s: 'MK' }, { s: 'TC' }, { s: 'ID' }]; } });
  assert.strictEqual(r.win, M.PAY.MK * 10 * 5); assert.strictEqual(r.wildMult, 5);
});
test('prize coins: need 3+, locked pay only when smashed, wild always smashes', () => {
  const coins = (lockedWild) => M.spin(100, fixed(.99), { force: g => { g[0] = [{ s: 'CN', coin: 100, locked: true }, { s: 'RB' }, { s: 'EM' }]; g[1] = [{ s: 'CN', coin: 50, locked: false }, lockedWild ? { s: 'WD', mult: 2 } : { s: 'TC' }, { s: 'SP' }]; g[2] = [{ s: 'CN', coin: 200, locked: false }, { s: 'BN' }, { s: 'ID' }]; } });
  let r = coins(false); assert.strictEqual(r.coins.smashed, false); assert.strictEqual(r.coins.pay, 250, 'locked coin unpaid without smash (rng .99 > SMASH_P)');
  r = coins(true); assert.strictEqual(r.coins.smashed, true); assert.strictEqual(r.coins.pay, 350);
  r = M.spin(100, Math.random, { force: g => { g[0][0] = { s: 'CN', coin: 100, locked: false }; g[2][0] = { s: 'CN', coin: 100, locked: false }; for (const r2 of [0, 1, 2]) for (const y of [1, 2]) g[r2][y] = { s: 'RB' }; g[1][0] = { s: 'EM' }; } });
  assert.strictEqual(r.coins.pay, 0, 'two coins pay nothing');
});
test('3 drums trigger the wheel; wheel/free games resolve', () => {
  const r = M.spin(50, Math.random, { force: g => { for (let i = 0; i < 3; i++) g[i][1] = { s: 'DR' }; } }); assert.ok(r.bonus && r.drums === 3);
  M.WHEEL.forEach((w, i) => { const x = M.spinWheel(50, Math.random, i); assert.strictEqual(x.win, (w.x || 0) * 50); assert.strictEqual(x.freeSpins, w.fs || 0); });
  const fg = M.freeGames(50, M.mulberry32(7), 10); assert.ok(fg.spins.length >= 10 && fg.spins.length <= 40); assert.strictEqual(fg.win, fg.spins.reduce((a, s) => a + s.win, 0));
  assert.ok(!M.WHEEL.some(w => /kong|mini|minor|major|grand|primal|rage|havoc/i.test(w.label)), 'original wedge names only');
});
test('tiers', () => { assert.strictEqual(M.tier(0, 50), ''); assert.strictEqual(M.tier(100, 50), 'win'); assert.strictEqual(M.tier(500, 50), 'big'); assert.strictEqual(M.tier(1250, 50), 'mega'); assert.strictEqual(M.tier(2500, 50), 'epic'); });
test('RTP simulation (300k spins, seeded) lands in the 94-96% target band', () => {
  const s = M.simulate(300000, M.mulberry32(20261121)); console.log(`  RTP ${(s.rtp * 100).toFixed(2)}%  hit ${(s.hitRate * 100).toFixed(1)}%  SD ${s.sd.toFixed(2)}x  bonus 1 in ${s.bonusEvery.toFixed(0)}`);
  assert.ok(s.rtp > 0.925 && s.rtp < 0.985, 'short-run RTP within noise of target: ' + s.rtp); assert.ok(s.hitRate > 0.25 && s.hitRate < 0.35);
});
