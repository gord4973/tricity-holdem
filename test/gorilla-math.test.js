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
  assert.strictEqual(r.ways.length, 1); assert.strictEqual(r.ways[0].s, 'SB'); assert.strictEqual(r.win, Math.round(M.PAY.SB * 10));
  r = g([['SB', 'SB', 'EM'], ['SB', 'MK', 'RB'], ['SB', 'SB', 'SB']]); assert.strictEqual(r.ways[0].ways, 6); assert.strictEqual(r.win, Math.round(M.PAY.SB * 10 * 6));
  r = g([['SB', 'TC', 'EM'], ['MK', 'MK', 'RB'], ['SB', 'BN', 'BN']]); assert.strictEqual(r.win, 0, 'reel 2 must match');
});
test('reel-2 wild substitutes and multiplies', () => {
  const r = M.spin(270, Math.random, { force: g => { g[0] = [{ s: 'MK' }, { s: 'RB' }, { s: 'EM' }]; g[1] = [{ s: 'BN' }, { s: 'WD', mult: 5 }, { s: 'SP' }]; g[2] = [{ s: 'MK' }, { s: 'TC' }, { s: 'ID' }]; } });
  assert.strictEqual(r.win, Math.round(M.PAY.MK * 10 * 5)); assert.strictEqual(r.wildMult, 5);
});
test('prize coins: need 3+, locked pay only when smashed, wild always smashes', () => {
  const coins = (lockedWild) => M.spin(100, fixed(.99), { force: g => { g[0] = [{ s: 'CN', coin: 100, locked: true }, { s: 'RB' }, { s: 'EM' }]; g[1] = [{ s: 'CN', coin: 50, locked: false }, lockedWild ? { s: 'WD', mult: 2 } : { s: 'TC' }, { s: 'SP' }]; g[2] = [{ s: 'CN', coin: 200, locked: false }, { s: 'BN' }, { s: 'ID' }]; } });
  let r = coins(false); assert.strictEqual(r.coins.smashed, false); assert.strictEqual(r.coins.pay, 250, 'locked coin unpaid without smash (rng .99 > SMASH_P)');
  r = coins(true); assert.strictEqual(r.coins.smashed, true); assert.strictEqual(r.coins.pay, 350);
  r = M.spin(100, Math.random, { force: g => { g[0][0] = { s: 'CN', coin: 100, locked: false }; g[2][0] = { s: 'CN', coin: 100, locked: false }; for (const r2 of [0, 1, 2]) for (const y of [1, 2]) g[r2][y] = { s: 'RB' }; g[1][0] = { s: 'EM' }; } });
  assert.strictEqual(r.coins.pay, 0, 'two coins pay nothing');
});
test('drums trigger the Temple Drum Wheel; chained wedges, awakening, jackpots, modes', () => {
  const r = M.spin(50, Math.random, { force: g => { for (let i = 0; i < 3; i++) g[i][1] = { s: 'DR' }; } }); assert.ok(r.bonus && r.drums === 3 && r.bonus.tier === 3);
  assert.strictEqual(M.WHEEL.length, 12);
  for (const tier of [1, 2, 3]) M.WHEEL.forEach((w, i) => { const x = M.spinWheel(50, Math.random, tier, { forceIdx: i, forceAwaken: false }); assert.strictEqual(x.idx, i); assert.strictEqual(x.tier, tier);
    const locked = M.LOCKS[tier].includes(w.id); assert.strictEqual(x.locked, locked);
    if (locked) assert.strictEqual(x.win, M.LOCK_X * 50); else if (w.mode) { assert.strictEqual(x.mode, w.mode); assert.strictEqual(x.win, 0); } else assert.strictEqual(x.win, w.x * 50); });
  const aw = M.spinWheel(50, Math.random, 1, { forceIdx: M.WHEEL.findIndex(w => w.id === 'inferno'), forceAwaken: true }); assert.ok(aw.awaken && aw.tier === 2 && !aw.locked && aw.mode === 'inferno', 'roar breaks the chains');
  assert.ok(!M.WHEEL.some(w => /kong|mini|minor|major|grand|primal|rage|havoc/i.test(w.label)), 'original wedge names only');
});
test('Rampage Meter fills on drums and awards a 2-drum wheel when full', () => {
  const m = { n: M.METER_MAX - 1 }; let got = null;
  for (let i = 0; i < 5000 && !got; i++) { const s = M.spin(50, Math.random, { meter: m, force: g => { for (let r = 0; r < 3; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === 'DR') g[r][y] = { s: 'EM' }; g[0][1] = { s: 'DR' }; } }); if (s.bonus) got = s; }
  assert.ok(got && got.bonus.tier === 2 && got.bonus.via === 'meter' && got.meter.full && m.n === 0);
});
test('bonus rounds: jungle/fury/inferno resolve, 7..50 spins, Firefist adds spins, rows 3..7 (343 ways)', () => {
  const rng = M.mulberry32(7); let maxRows = 0, fists = 0;
  for (const mode of ['jungle', 'fury', 'inferno']) for (let k = 0; k < 150; k++) { const b = M.bonusRound(50, rng, mode); assert.strictEqual(b.mode, mode);
    assert.ok(b.spins.length >= M.FS_START && b.spins.length <= 50); assert.strictEqual(b.win, b.spins.reduce((a, s) => a + s.win, 0));
    let ascended = false;
    for (const s of b.spins) { const rows = s.rows[0]; assert.ok(rows >= 3 && rows <= 7); assert.strictEqual(s.waysN, s.rows.reduce((a, n) => a * n, 1)); maxRows = Math.max(maxRows, rows); fists += s.added || 0; if (mode === 'jungle' && !ascended) assert.strictEqual(rows, 3); if (s.ascent) ascended = true; } }
  assert.strictEqual(maxRows, 7); assert.ok(fists > 0);
  const rich = M.bonusRound(50, rng, 'inferno', { rich: true }); assert.strictEqual(rich.spins[0].rows[0], 7); assert.strictEqual(rich.spins[0].waysN, 343);
});
test('Temple Ascent upgrades Jungle→Fury, Fury→Inferno, Inferno→Temple Titan (math-decided)', () => {
  const j = M.bonusRound(50, M.mulberry32(1), 'jungle', { forceAscent: true, ascentAt: 2 });
  assert.ok(j.ascent && j.ascent.to === 'fury' && j.ascent.added === 2);
  assert.strictEqual(j.spins[2].ascent.to, 'fury');
  assert.ok(j.spins.slice(0, 3).every(s => s.mode === 'jungle'), 'trigger spin stays Jungle');
  assert.ok(j.spins.slice(3).some(s => s.mode === 'fury'), 'later spins are Fury');
  assert.ok(j.spins.slice(3).some(s => s.rows[0] >= 3));
  assert.ok(j.played >= M.FS_START + 2, 'ascent adds spins: ' + j.played);
  const f = M.bonusRound(50, M.mulberry32(2), 'fury', { forceAscent: true, ascentAt: 2 });
  assert.ok(f.ascent && f.ascent.to === 'inferno');
  assert.ok(f.spins.slice(3).every(s => s.mode === 'inferno'));
  const ttn = M.bonusRound(50, M.mulberry32(3), 'inferno', { forceTitan: true, ascentAt: 2, rich: true });
  assert.ok(ttn.ascent && ttn.ascent.to === 'titan' && ttn.ascent.added === 3);
  assert.strictEqual(ttn.endMode, 'titan');
  assert.ok(ttn.spins.slice(3).every(s => s.rows[0] === 7 && s.mode === 'inferno'), 'Titan coda is 7-row Inferno');
  assert.ok(!/kong/i.test(JSON.stringify(j.ascent)), 'original names only');
});
test('coin respins cap at 5', () => { const rng = M.mulberry32(3); let n = 0; for (let i = 0; i < 4000; i++) { const s = M.spin(50, rng, { forceRespin: 3 }); if (s.respin) { n++; assert.ok(s.respin.steps.length <= M.RESPIN_MAX); } } assert.ok(n > 0); });
test('tiers', () => { assert.strictEqual(M.tier(0, 50), ''); assert.strictEqual(M.tier(100, 50), 'win'); assert.strictEqual(M.tier(500, 50), 'big'); assert.strictEqual(M.tier(1250, 50), 'mega'); assert.strictEqual(M.tier(2500, 50), 'monster'); });
test('RTP simulation (300k spins, seeded) lands near the 95.4% target', () => {
  const s = M.simulate(300000, M.mulberry32(20261121)); console.log(`  RTP ${(s.rtp * 100).toFixed(2)}%  hit ${(s.hitRate * 100).toFixed(1)}%  SD ${s.sd.toFixed(2)}x  bonus 1 in ${s.bonusEvery.toFixed(0)}`);
  assert.ok(s.rtp > 0.925 && s.rtp < 0.985, 'short-run RTP within noise of target: ' + s.rtp); assert.ok(s.hitRate > 0.25 && s.hitRate < 0.35);
});
test('gorilla punch-nudge: only on losing base spins one stop from a win, lands the reel exactly one stop over', () => {
  const rng = M.mulberry32(99); let n = 0;
  for (let i = 0; i < 60000; i++) { const s = M.spin(50, rng); if (!s.nudge) continue; n++; const z = s.nudge, L = M.STRIPS[z.r].length;
    assert.ok(Math.abs(z.dir) === 1); assert.strictEqual((z.preStop - z.dir + L) % L, s.stops[z.r]);
    assert.strictEqual(M.waysWin(s.grid.map((c, r) => r === z.r ? z.pre : c)), 0, 'landed on a loss'); assert.ok(s.ways.length > 0, 'punched into a win');
    const shared = z.dir > 0 ? [s.grid[z.r][1], s.grid[z.r][2]] : [s.grid[z.r][0], s.grid[z.r][1]]; assert.deepStrictEqual(z.dir > 0 ? z.pre.slice(0, 2) : z.pre.slice(1), shared); }
  assert.ok(n / 60000 > .004 && n / 60000 < .02, 'nudge rate ' + n / 60000);
  for (let i = 0; i < 3000; i++) assert.ok(!M.spin(50, rng, { mode: 'jungle' }).nudge, 'no nudges in bonus spins');
});
