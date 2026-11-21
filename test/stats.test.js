// Beginner stats: equity sanity, evaluator agreement with the engine, and wording.
const test = require('node:test'), assert = require('node:assert');
const S = require('../stats'), E = require('../engine');
const near = (v, want, tol, msg) => assert.ok(Math.abs(v - want) <= tol, `${msg}: ${(v * 100).toFixed(1)}% not within ${tol * 100} of ${want * 100}%`);
test('AA vs 1 random hand ~85%', async () => near((await S.equityJob(['As', 'Ad'], [], 1)).eq, 0.85, 0.03, 'AA'));
test('72o vs 1 random hand ~35%', async () => near((await S.equityJob(['7s', '2d'], [], 1)).eq, 0.35, 0.03, '72o'));
test('AA vs 4 random hands ~56%', async () => near((await S.equityJob(['Ah', 'Ac'], [], 4)).eq, 0.56, 0.03, 'AA 5-way'));
test('river heads-up is exact (990 hands) and the nuts is 100%', async () => {
  const r = await S.equityJob(['As', 'Ks'], ['Qs', 'Js', 'Ts', '2d', '3c'], 1); assert.equal(r.exact, true); assert.equal(r.n, 990); assert.equal(r.eq, 1);
});
test('turn heads-up is exact', async () => { const r = await S.equityJob(['Ks', 'Qd'], ['Js', 'Ts', '2d', '3c'], 1); assert.equal(r.exact, true); assert.ok(r.eq > 0.4 && r.eq < 0.6); });
test('board-only nuts splits (royal on board = 100% tie = 50% heads-up)', async () => near((await S.equityJob(['2c', '3d'], ['As', 'Ks', 'Qs', 'Js', 'Ts'], 1)).eq, 0.5, 0.0001, 'split'));
test('fast evaluator orders hands exactly like the engine (20k random pairs)', () => {
  const d = E.newDeck(), cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = (a[i] || 0) - (b[i] || 0); if (x) return Math.sign(x); } return 0; };
  for (let k = 0; k < 20000; k++) { const sh = E.shuffle(d.slice()), A = sh.slice(0, 7), B = sh.slice(7, 14);
    assert.equal(Math.sign(S.fastScore(A.map(S.toInt), 7) - S.fastScore(B.map(S.toInt), 7)), cmp(E.bestHand(A).score, E.bestHand(B).score), A + ' vs ' + B); }
});
test('wording', () => {
  assert.equal(S.describe(['8s', '8d'], []).hand, 'Pocket 8s');
  assert.equal(S.describe(['As', 'Ks'], []).hand, 'A-K suited');
  assert.equal(S.describe(['Td', 'As'], []).hand, 'A-10 offsuit');
  assert.equal(S.describe(['Ks', 'Kd'], ['2c', '7h', '9s']).hand, 'Pair of Kings');
  assert.equal(S.describe(['Js', '5d'], ['Jc', '5h', '9s']).hand, 'Two Pair, Jacks and 5s');
  assert.equal(S.describe(['Ks', 'Qs'], ['Js', 'Ts', '2d']).draw, 'flush draw + open-ended straight draw');
  assert.equal(S.describe(['Ks', '9d'], ['Jc', 'Th', '2d']).draw, 'gutshot straight draw');
  assert.equal(S.describe(['Ks', 'Qs'], ['Js', 'Ts', '2d', '3c', '9h']).draw, '');
  assert.equal(S.hint(0.8, 1), 'strong'); assert.equal(S.hint(0.5, 1), 'fair'); assert.equal(S.hint(0.3, 1), 'weak');
});
test('equity job stays fast (worst case 19 opponents, 10k sims) and yields to the event loop', async () => {
  let ticks = 0; const iv = setInterval(() => ticks++, 1); const t = Date.now(); await S.equityJob(['As', 'Kd'], [], 19); const ms = Date.now() - t; clearInterval(iv);
  assert.ok(ms < 1500, ms + 'ms'); if (ms > 30) assert.ok(ticks > 0, 'event loop starved');
});
