// Free Bet Blackjack rules engine tests.
const test = require('node:test'), assert = require('node:assert');
const { Table, total, pogMult, START_CHIPS } = require('../bj/engine');
const S = require('../bj/strategy');
// one player, rigged deal: [p1, dUp, p2, dHole, ...draws]
function setup(cards, { main = 1000, pog = 0, players = 1 } = {}) {
  const t = new Table(); for (let i = 0; i < players; i++) t.addPlayer('p' + i, 'P' + i); t.startGame();
  for (let i = 0; i < players; i++) t.setBet('p' + i, main, pog);
  t.shoe.rig(cards); t.deal(); return t;
}
const chips = t => t.get('p0').chips;
const finish = t => { let n = 0; while (t.stage === 'dealer' && n++ < 20) t.dealerStep(); };
test('start: $400 = 1x$100 + 4x$25 + 40x$5', () => { assert.equal(START_CHIPS, 10000 + 4 * 2500 + 40 * 500); });
test('totals and soft hands', () => { assert.deepEqual(total(['As', '6d']), { total: 17, soft: true }); assert.deepEqual(total(['As', '6d', 'Tc']), { total: 17, soft: false }); assert.equal(total(['As', 'Ad', '9c']).total, 21); });
test('blackjack pays 3:2', () => { const t = setup(['As', '9h', 'Kd', '7c']); assert.equal(t.stage, 'dealer'); finish(t); assert.equal(chips(t), START_CHIPS + 1500); });
test('blackjack still pays 3:2 when the dealer makes 22', () => { const t = setup(['As', 'Ts', '6h', 'Kd', '8s', '6c', 'Tc'], { players: 2 }); t.act('p1', 'stand'); finish(t); assert.equal(t.result.dealer, 22); assert.equal(chips(t), START_CHIPS + 1500); assert.equal(t.get('p1').chips, START_CHIPS); });
test('dealer does not draw when every hand is a blackjack or bust', () => { const t = setup(['As', '6h', 'Kd', '6c']); finish(t); assert.equal(t.dealer.cards.length, 2); assert.equal(chips(t), START_CHIPS + 1500); });
test('dealer 22 pushes all live hands, busts still lose', () => {
  const t = setup(['Ts', '6h', '9d', '6c', /*dealer*/ 'Tc'], { players: 1 }); t.act('p0', 'stand'); finish(t); assert.equal(t.result.dealer, 22); assert.equal(t.boxes[0].hands[0].result, 'push22'); assert.equal(chips(t), START_CHIPS);
  const u = setup(['Ts', '6h', '6d', '6c', 'Kd', 'Tc']); u.act('p0', 'hit'); finish(u); assert.equal(u.boxes[0].hands[0].result, 'bust'); assert.equal(chips(u), START_CHIPS - 1000);
});
test('dealer 23+ busts and pays', () => { const t = setup(['Ts', '6h', '9d', '7c', 'Tc']); t.act('p0', 'stand'); finish(t); assert.equal(t.result.dealer, 23); assert.equal(chips(t), START_CHIPS + 1000); });
test('free double on hard 9/10/11 only; win pays the lammer too', () => {
  const t = setup(['5s', '6h', '6d', 'Tc', /*double card*/ 'Th', /*dealer*/ '9c']); const L = t.legal('p0'); assert.ok(L.canDouble && L.doubleFree);
  t.act('p0', 'double'); assert.equal(t.boxes[0].lammers, 1); finish(t); assert.equal(t.result.dealer, 25); assert.equal(chips(t), START_CHIPS + 2000); // win $10 + $10 on the free bet
  const s = setup(['As', '6h', '7d', 'Tc']); assert.equal(s.legal('p0').doubleFree, false); // soft 18 = paid double
  const h = setup(['Ts', '6h', '2d', 'Tc']); assert.equal(h.legal('p0').doubleFree, false); // hard 12 = paid double
});
test('free double that loses only costs the original bet', () => { const t = setup(['5s', '9h', '5d', 'Tc', '2h']); t.act('p0', 'double'); finish(t); assert.equal(t.result.dealer, 19); assert.equal(chips(t), START_CHIPS - 1000); });
test('free double that pushes returns only the original bet', () => { const t = setup(['5s', 'Th', '5d', '9c', '9h']); t.act('p0', 'double'); finish(t); assert.equal(chips(t), START_CHIPS); });
test('paid double on soft hand costs and pays real money', () => { const t = setup(['As', '6h', '7d', 'Tc', '2h', 'Tc']); t.act('p0', 'double'); assert.equal(chips(t), START_CHIPS - 2000); finish(t); assert.equal(t.result.dealer, 26); assert.equal(chips(t), START_CHIPS + 2000); });
test('free split on pairs (not tens); free hand wins even money on the lammer', () => {
  const t = setup(['8s', '6h', '8d', 'Tc', /*h1*/ 'Th', /*h2*/ 'Td', /*dealer*/ '7c']); const L = t.legal('p0'); assert.ok(L.canSplit && L.splitFree);
  t.act('p0', 'split'); assert.equal(t.boxes[0].hands.length, 2); assert.equal(t.boxes[0].lammers, 1); assert.equal(chips(t), START_CHIPS - 1000);
  t.act('p0', 'stand'); t.act('p0', 'stand'); finish(t); assert.equal(t.result.dealer, 23); assert.equal(chips(t), START_CHIPS + 2000);
});
test('tens split is paid, not free', () => { const t = setup(['Ks', '6h', 'Qd', 'Tc']); const L = t.legal('p0'); assert.ok(L.canSplit); assert.equal(L.splitFree, false); t.act('p0', 'split'); assert.equal(chips(t), START_CHIPS - 2000); assert.equal(t.boxes[0].lammers, 0); });
test('resplits up to 4 hands; Pot of Gold counts every lammer (3 splits + doubles)', () => {
  // 8,8 -> split, get 8 -> split, get 8 -> split (4 hands, max), then 3 on each -> 11 = free double each
  const t = setup(['8s', '6h', '8d', 'Tc', '8h', '8c', '3d', 'Th', '3s', 'Td', '3h', 'Tc', '3c', 'Ts', 'Kd'], { pog: 500 });
  t.act('p0', 'split'); t.act('p0', 'split'); t.act('p0', 'split'); assert.equal(t.boxes[0].hands.length, 4); assert.equal(t.legal('p0').canSplit, false);
  for (let i = 0; i < 4; i++) { assert.ok(t.legal('p0').doubleFree, 'hand ' + i); t.act('p0', 'double'); }
  assert.equal(t.boxes[0].lammers, 7); finish(t); assert.equal(t.result.dealer, 26);
  // main: 4 hands x 21 win. cash 10 on hand 1 only. win = 10*2 + 10(free dbl) = 30 back; others 0 cash: free 10 split + 10 dbl = 20 each -> 60. total back 90; staked 10 main + 5 pog. pog 1000:1 = 5005 back
  assert.equal(t.boxes[0].pogPaid, 500 * 1001); assert.equal(chips(t), START_CHIPS - 1000 - 500 + 9000 + 500 * 1001);
});
test('Pot of Gold paytable', () => { assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 9].map(pogMult), [0, 3, 12, 30, 60, 100, 250, 1000, 1000]); });
test('Pot of Gold loses with no lammers', () => { const t = setup(['Ts', '6h', '9d', '7c', 'Tc'], { pog: 500 }); t.act('p0', 'stand'); finish(t); assert.equal(chips(t), START_CHIPS + 1000 - 500); });
test('split aces get one card each (resplit aces allowed)', () => {
  const t = setup(['As', '6h', 'Ad', 'Tc', /*h1*/ '9h', /*h2*/ '5d', '9c']); t.act('p0', 'split'); assert.equal(t.stage, 'dealer'); const h = t.boxes[0].hands; assert.equal(h[0].cards.length, 2); assert.equal(h[1].cards.length, 2);
  finish(t); assert.equal(h[0].result, 'win'); assert.equal(h[0].label, undefined);
  const r = setup(['As', '6h', 'Ad', 'Tc', 'Ac', '9h', '9d', '9s', 'Tc']); r.act('p0', 'split'); const L = r.legal('p0'); assert.ok(L.canSplit && !L.canHit && !L.canDouble); r.act('p0', 'split'); assert.equal(r.boxes[0].hands.length, 3); assert.equal(r.boxes[0].lammers, 2);
});
test('split 21 is not a blackjack (pays 1:1)', () => { const t = setup(['As', '6h', 'Ad', 'Tc', 'Kh', '5d', 'Tc']); t.act('p0', 'split'); finish(t); assert.equal(t.boxes[0].hands[0].result, 'win'); assert.equal(t.boxes[0].hands[0].paid, 2000); });
test('insurance pays 2:1 on dealer blackjack; player blackjack pushes', () => {
  const t = setup(['9s', 'Ah', '9d', 'Kc'], { main: 1000 }); assert.equal(t.stage, 'insurance'); t.insure('p0', true); assert.equal(t.stage, 'settled'); assert.equal(chips(t), START_CHIPS - 1000 - 500 + 1500);
  const u = setup(['As', 'Ah', 'Kd', 'Kc']); u.insure('p0', false); assert.equal(u.boxes[0].hands[0].result, 'push'); assert.equal(chips(u), START_CHIPS);
});
test('insurance loses when the dealer has no blackjack, then play continues', () => { const t = setup(['Ts', 'Ah', '9d', '7c']); t.insure('p0', true); assert.equal(t.stage, 'playing'); t.act('p0', 'stand'); finish(t); assert.equal(t.result.dealer, 18); assert.equal(chips(t), START_CHIPS - 500 + 1000); });
test('dealer peeks on a ten: blackjack ends the round, no insurance', () => { const t = setup(['9s', 'Kh', '9d', 'Ac']); assert.equal(t.stage, 'settled'); assert.equal(chips(t), START_CHIPS - 1000); });
test('dealer hits soft 17', () => { const t = setup(['Ts', 'As', '9d', '6c', '2h']); t.insure('p0', false); t.act('p0', 'stand'); finish(t); assert.equal(t.dealer.cards.length, 3); assert.equal(t.result.dealer, 19); });
test('cut card triggers a reshuffle before the next round', () => { const t = setup(['Ts', '7h', '9d', 'Tc']); t.shoe.pos = t.shoe.cutAt + 1; t.act('p0', 'stand'); finish(t); const before = t.shoe.shuffles; t.next(); assert.equal(t.shoe.shuffles, before + 1); assert.ok(t.shoe.remaining > 300); });
test('out of chips -> out, ranked by when they went out', () => { const t = setup(['Ts', '9h', '6d', 'Tc', 'Th'], { main: START_CHIPS }); t.act('p0', 'hit'); finish(t); assert.equal(t.get('p0').out, true); t.next(); assert.equal(t.stage, 'gameover'); });
test('host end mid-round refunds the bets on the table', () => { const t = setup(['5s', '6h', '6d', 'Tc'], { pog: 500 }); t.endGame(); assert.equal(chips(t), START_CHIPS); assert.equal(t.stage, 'gameover'); });
test('chips conserve: player + house is constant over many random rounds', () => {
  const t = new Table(); ['a', 'b', 'c'].forEach(n => t.addPlayer(n, n)); t.startGame(); const start = t.players.reduce((a, p) => a + p.chips, 0);
  for (let r = 0; r < 400 && t.stage !== 'gameover'; r++) {
    for (const p of t.players) if (!p.out) { try { t.setBet(p.id, Math.min(p.chips - (p.chips % 500), 500 * (1 + (r % 4))), p.chips > 5000 ? 500 : 0); } catch (e) { } }
    if (!t.bettors().length) break; t.deal(); if (t.stage === 'insurance') for (const b of t.boxes) t.insure(b.id, Math.random() < 0.3 && t.get(b.id).chips >= b.unit / 2);
    let g = 0; while (t.stage === 'playing' && g++ < 200) { const c = t.cur(), L = t.legal(c.b.id); t.act(c.b.id, S.recommend(c.h.cards, t.dealer.cards[0], L, c.h.cash === 0).action === 'split' && L.canSplit ? 'split' : (L.canDouble && Math.random() < .3 ? 'double' : (L.canHit && total(c.h.cards).total < 15 ? 'hit' : 'stand'))); }
    finish(t); assert.equal(t.stage, 'settled'); t.next();
  }
  assert.equal(t.players.reduce((a, p) => a + p.chips, 0) + t.house, start);
});
test('strategy: always take free doubles/splits, stand on tens, free-hand table differs', () => {
  const free = { canDouble: true, doubleFree: true, canHit: true };
  assert.equal(S.recommend(['5s', '6d'], 'As', free).label, 'Double (free)');
  assert.equal(S.recommend(['8s', '8d'], 'Ts', { canSplit: true, splitFree: true, canHit: true }).label, 'Split (free)');
  assert.equal(S.recommend(['Ks', 'Qd'], '6s', { canSplit: true, canHit: true }).label, 'Stand');
  assert.equal(S.recommend(['5s', '5d'], '9s', { canSplit: true, splitFree: true, canDouble: true, doubleFree: true, canHit: true }).label, 'Double (free)');
  assert.equal(S.recommend(['Ts', '4d'], '2s', { canHit: true }, false).label, 'Stand');
  assert.equal(S.recommend(['Ts', '4d'], '2s', { canHit: true }, true).label, 'Hit');
  assert.equal(S.recommend(['As', '7d'], '4s', { canHit: true, canDouble: true }, true).label, 'Double');
  assert.equal(S.recommend(['As', '7d'], '4s', { canHit: true, canDouble: true }, false).label, 'Stand');
  assert.equal(S.recommend(['Ts', '6d'], 'Ts', { canHit: true }).label, 'Hit');
});
test('dealer odds: 6 up busts ~44% (incl. 22), ace up (peeked) ~20%', () => {
  const w = [0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 96]; const six = S.dealerOdds('6s', w), ace = S.dealerOdds('As', w);
  assert.ok(Math.abs(six.bust + six.d22 - 0.44) < 0.02, six.bust + six.d22); assert.ok(Math.abs(ace.bust + ace.d22 - 0.20) < 0.02);
  assert.ok(Math.abs(S.bustIfHit(['Ts', '6d'], w) - 8 / 13) < 0.001); assert.equal(S.bustIfHit(['As', '6d'], w), 0);
});
