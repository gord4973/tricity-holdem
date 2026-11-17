const test = require('node:test'), assert = require('node:assert/strict');
const { Table, bestHand, eval5, cmp, buildPots, blindsFor, newDeck, shuffle } = require('../engine');
const H = s => s.split(' ');
const name = s => bestHand(H(s)).name;

// ---------- hand evaluation ----------
test('hand names', () => {
  assert.equal(name('Ks Kd 7c 7h Kh 2s 3d'), 'Full House, Kings over 7s');
  assert.equal(name('As Ks Qs Js Ts 2d 3c'), 'Royal Flush');
  assert.equal(name('5s 4s 3s 2s As Kd Kc'), 'Straight Flush, Five high');
  assert.equal(name('9h 9d 9s 9c 2d 3c 4h'), 'Four of a Kind, 9s');
  assert.equal(name('Ah 9h 2h 5h 7h Kd Kc'), 'Flush, Ace high');
  assert.equal(name('Ah 2d 3c 4s 5h Kd Qc'), 'Straight, Five high');
  assert.equal(name('Th Jd Qc Ks Ah 2d 2c'), 'Straight, Ace high');
  assert.equal(name('7h 7d 7c Ks 2h 3d 9c'), 'Three of a Kind, 7s');
  assert.equal(name('Ah Ad 8c 8s 2h 3d 9c'), 'Two Pair, Aces and 8s');
  assert.equal(name('Jh Jd 8c 4s 2h 3d 9c'), 'One Pair, Jacks');
  assert.equal(name('Ah Jd 8c 4s 2h 3d 9c'), 'High Card, Ace');
});
test('hand ordering and kickers', () => {
  const b = s => bestHand(H(s)).score;
  assert.ok(cmp(b('Ah Ad Kc 4s 2h 3d 9c'), b('Ah Ad Qc 4s 2h 3d 9c')) > 0, 'kicker');
  assert.ok(cmp(b('Ah Kh Qh Jh 9h 2c 3c'), b('As Ks Qs Js Ts 2c 3c')) < 0, 'flush < royal');
  assert.ok(cmp(b('2h 3d 4c 5s 6h Kd Kc'), b('Ah 2d 3c 4s 5h Kd Qc')) > 0, '6-high straight beats wheel');
  assert.ok(cmp(b('Kh Kd Kc 2s 2h 3d 3c'), b('Qh Qd Qc As Ah 3d 3c')) > 0, 'full house trips rank');
  assert.ok(cmp(b('Kh Kd 2c 2s 5h 5d 9c'), b('Kh Kd 2c 2s 4h 4d 9c')) > 0, 'best two pair picked from 3 pairs');
  assert.equal(cmp(b('Ah Kd 2c 3s 9h 9d 9c'), b('As Kc 2d 3h 9h 9d 9c')), 0, 'tie');
  // board plays
  assert.equal(cmp(b('2c 3d As Ks Qs Js Ts'), b('4c 5d As Ks Qs Js Ts')), 0);
  // 7-card picks flush over straight
  assert.equal(name('9h 8h 7h 6d 5h 2h Kc'), 'Flush, Nine high');
});
test('deck is 52 unique cards and shuffle is crypto/random', () => {
  const d = shuffle(newDeck()); assert.equal(new Set(d).size, 52);
});
test('blind levels', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(blindsFor), [[1, 2], [2, 4], [5, 10], [10, 20], [20, 40], [50, 100], [100, 200]]);
});

// ---------- pots ----------
test('side pots with multiple all-ins', () => {
  const pots = buildPots([{ id: 'a', total: 20, folded: false }, { id: 'b', total: 50, folded: false }, { id: 'c', total: 120, folded: false }, { id: 'd', total: 120, folded: false }, { id: 'e', total: 30, folded: true }]);
  assert.deepEqual(pots, [{ amount: 100, eligible: ['a', 'b', 'c', 'd'] }, { amount: 100, eligible: ['b', 'c', 'd'] }, { amount: 140, eligible: ['c', 'd'] }]);
});
test('uncalled bet comes back as single-eligible pot', () => {
  const pots = buildPots([{ id: 'a', total: 10, folded: false }, { id: 'b', total: 40, folded: false }]);
  assert.deepEqual(pots, [{ amount: 20, eligible: ['a', 'b'] }, { amount: 30, eligible: ['b'] }]);
});

// ---------- table helpers ----------
function table(n, chips) {
  const t = new Table({ rand: () => 0 }); // dealer = seat 0 on first hand
  for (let i = 0; i < n; i++) t.addPlayer('p' + i, 'P' + i);
  if (chips) chips.forEach((c, i) => t.players[i].chips = c);
  return t;
}
const cur = t => t.players[t.toAct];
// stack the deck so the board will be the given cards (burns are 'X')
function rig(t, holes, board) {
  const used = new Set([...holes.flat(), ...board]);
  const rest = newDeck().filter(c => !used.has(c));
  t.makeDeck = () => { const d = [...rest]; const seq = [rest[0], ...board.slice(0, 3), rest[1], board[3], rest[2], board[4]]; const fill = d.slice(3, 3 + 2 * holes.length); return d.slice(3 + 2 * holes.length).concat(seq.reverse(), fill); };
  t._holes = holes;
}
function start(t) { t.startGame ? (t.stage === 'lobby' ? t.startGame() : t.startHand()) : 0; if (t._holes) t._holes.forEach((h, i) => t.players[i].hole = h); }
const chips = t => t.players.map(p => p.chips);
const total = t => t.players.reduce((s, p) => s + p.chips + p.total * (['handover', 'gameover'].includes(t.stage) ? 0 : 1), 0);

// ---------- betting rules ----------
test('blinds, preflop order and BB option (3 players)', () => {
  const t = table(3); start(t);
  assert.equal(t.dealerSeat, 0); assert.equal(t.sbSeat, 1); assert.equal(t.bbSeat, 2);
  assert.equal(t.players[1].bet, 1); assert.equal(t.players[2].bet, 2);
  assert.equal(cur(t).id, 'p0', 'UTG (button in 3-handed) acts first');
  t.act('p0', 'call'); t.act('p1', 'call');
  assert.equal(cur(t).id, 'p2', 'BB gets option'); const L = t.legal('p2'); assert.ok(L.canCheck && L.canRaise);
  t.act('p2', 'check');
  assert.equal(t.stage, 'flop'); assert.equal(t.board.length, 3);
  assert.equal(cur(t).id, 'p1', 'SB acts first postflop');
});
test('heads-up: dealer posts SB and acts first preflop, last postflop', () => {
  const t = table(2); start(t);
  assert.equal(t.sbSeat, t.dealerSeat);
  assert.equal(cur(t).id, t.players[t.dealerSeat].id);
  t.act(cur(t).id, 'call'); t.act(cur(t).id, 'check');
  assert.equal(t.stage, 'flop'); assert.equal(cur(t).id, t.players[t.bbSeat].id);
});
test('min-raise rules and re-raise', () => {
  const t = table(4); start(t); // D=0 SB=1 BB=2 UTG=3
  assert.throws(() => t.act('p3', 'raise', 3), /Minimum is 4/);
  t.act('p3', 'raise', 6); // raise by 4
  assert.equal(t.legal('p0').minTo, 10, 'next min raise is +4');
  assert.throws(() => t.act('p0', 'raise', 9));
  t.act('p0', 'raise', 20); // raise by 14
  assert.equal(t.legal('p1').minTo, 34);
  t.act('p1', 'fold'); t.act('p2', 'fold'); t.act('p3', 'call');
  assert.equal(t.stage, 'flop'); assert.equal(t.potTotal(), 43);
  assert.equal(t.legal(cur(t).id).minTo, 2, 'min bet postflop is the big blind');
});
test('raise to any amount up to stack; bet over stack is capped (all-in)', () => {
  const t = table(3); start(t);
  t.act('p0', 'raise', 77); assert.equal(t.players[0].bet, 77);
  t.act('p1', 'raise', 9999); assert.equal(t.players[1].bet, 120); assert.ok(t.players[1].allIn);
});
test('incomplete all-in raise does not reopen betting', () => {
  const t = table(3, [120, 120, 13]); start(t); // D=0 SB=1 BB=2(13 chips)
  t.act('p0', 'raise', 10);   // full raise (+8)
  t.act('p1', 'call');         // SB calls 10
  t.act('p2', 'allin');        // BB all-in to 13: +3 < 8 => incomplete
  assert.equal(cur(t).id, 'p0');
  let L = t.legal('p0'); assert.equal(L.toCall, 3); assert.equal(L.canRaise, false, 'p0 already acted, faces incomplete raise');
  t.act('p0', 'call');
  L = t.legal('p1'); assert.equal(L.canRaise, false); t.act('p1', 'call');
  assert.equal(t.stage, 'flop');
});
test('full raise after acting reopens', () => {
  const t = table(3); start(t);
  t.act('p0', 'call'); t.act('p1', 'raise', 8); assert.equal(t.legal('p2').canRaise, true); t.act('p2', 'call');
  assert.equal(t.legal('p0').canRaise, true);
});
test('everyone folds to the big blind: BB wins, chips conserved', () => {
  const t = table(4); start(t);
  t.act('p3', 'fold'); t.act('p0', 'fold'); t.act('p1', 'fold');
  assert.equal(t.stage, 'handover'); assert.deepEqual(chips(t), [120, 119, 121, 120]);
  assert.ok(t.lastResult.byFold);
});
test('cannot act out of turn; cannot check facing a bet', () => {
  const t = table(3); start(t);
  assert.throws(() => t.act('p1', 'call'), /Not your turn/);
  assert.throws(() => t.act('p0', 'check'), /Cannot check/);
});
test('short-stack blinds post all-in', () => {
  const t = table(3, [120, 1, 1]); start(t); // SB=1 has 1, BB=2 has 1
  assert.ok(t.players[1].allIn && t.players[2].allIn);
  assert.equal(t.players[2].bet, 1);
  assert.equal(t.legal('p0').toCall, 2, 'still must call the full big blind');
  t.act('p0', 'call');
  assert.equal(t.stage, 'handover', 'runs out to showdown');
  assert.equal(chips(t).reduce((a, b) => a + b), 122);
});
test('button rotates, eliminated players skipped', () => {
  const t = table(4); start(t);
  assert.equal(t.dealerSeat, 0);
  ['p3', 'p0', 'p1'].forEach(id => t.act(id, 'fold')); t.startHand();
  assert.equal(t.dealerSeat, 1); assert.equal(t.sbSeat, 2); assert.equal(t.bbSeat, 3);
});
test('showdown: split pot with odd chip to first seat left of button', () => {
  const t = table(3);
  rig(t, [['2c', '3d'], ['Ah', '4c'], ['Ad', '4s']], ['Kh', 'Qs', 'Jd', '9c', '8h']);
  start(t); // D=0 SB=1 BB=2
  t.act('p0', 'call'); t.act('p1', 'raise', 5); t.act('p2', 'call'); t.act('p0', 'fold'); // pot 2+5+5=12
  ['p1', 'p2', 'p1', 'p2', 'p1', 'p2'].forEach(id => t.act(id, 'check'));
  assert.equal(t.stage, 'handover');
  assert.equal(t.lastResult.pots[0].winners.length, 2);
  assert.deepEqual(chips(t), [118, 121, 121]);
  // odd chip
  const t2 = table(3); rig(t2, [['2c', '3d'], ['Ah', '4c'], ['Ad', '4s']], ['Kh', 'Qs', 'Jd', '9c', '8h']); start(t2);
  t2.act('p0', 'raise', 5); t2.act('p1', 'call'); t2.act('p2', 'call');
  t2.act('p1', 'bet', 3); t2.act('p2', 'call'); t2.act('p0', 'fold'); // pot 15+6 = 21
  ['p1', 'p2', 'p1', 'p2'].forEach(id => t2.act(id, 'check'));
  assert.deepEqual(chips(t2), [115, 120 - 8 + 11, 120 - 8 + 10], 'SB (left of button) gets odd chip');
  assert.equal(t2.lastResult.pots[0].hand, 'High Card, Ace');
});
test('multi-way all-in with side pots awarded correctly', () => {
  // p0 30 chips best hand, p1 60 chips 2nd best, p2 & p3 120 chips worst (p2 beats p3)
  const t = table(4, [30, 60, 120, 120]);
  rig(t, [['Ah', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', '2d']], ['As', 'Ks', '7c', '3d', '8s']);
  start(t); // D=0 SB=1 BB=2 UTG=3
  t.act('p3', 'allin'); t.act('p0', 'allin'); t.act('p1', 'allin'); t.act('p2', 'call');
  assert.equal(t.stage, 'handover');
  const r = t.lastResult;
  assert.deepEqual(r.pots.map(p => [p.amount, p.winners.map(w => w.id).join()]), [[120, 'p0'], [90, 'p1'], [120, 'p2']]);
  assert.deepEqual(chips(t), [120, 90, 120, 0]);
  assert.equal(r.pots[0].hand, 'Three of a Kind, Aces');
  assert.ok(t.players[3].out, 'busted player eliminated');
  assert.equal(r.shown.length, 4);
});
test('folded player chips stay in pot; side pot with a fold', () => {
  const t = table(3, [20, 120, 120]);
  rig(t, [['2h', '7d'], ['Kh', 'Kd'], ['Qh', 'Qd']], ['As', '5s', '9c', '3d', '8s']);
  start(t);
  t.act('p0', 'allin'); t.act('p1', 'raise', 60); t.act('p2', 'call');
  t.act('p1', 'bet', 30); t.act('p2', 'fold');
  // p0 (worst) only eligible for main pot 60; p1 wins main (KK) + side 80 + uncalled 30 back
  assert.deepEqual(chips(t), [0, 120 - 90 + 170, 60]);
});
test('game ends with a single winner', () => {
  const t = table(2, [10, 120]);
  rig(t, [['Ah', 'Ad'], ['2c', '7d']], ['As', 'Ks', '9c', '3d', '8s']);
  start(t); // heads up: dealer p0 posts SB
  t.act('p0', 'allin'); t.act('p1', 'call');
  assert.equal(t.stage, 'handover'); assert.deepEqual(chips(t), [20, 110]);
  const t2 = table(2, [10, 120]); rig(t2, [['2c', '7d'], ['Ah', 'Ad']], ['As', 'Ks', '9c', '3d', '8s']); start(t2);
  t2.act('p0', 'allin'); t2.act('p1', 'call');
  assert.equal(t2.stage, 'gameover'); assert.equal(t2.winner, 'P1');
});
test('20-player random games conserve chips and finish', () => {
  for (let g = 0; g < 30; g++) {
    const t = new Table(); for (let i = 0; i < 20; i++) t.addPlayer('p' + i, 'P' + i);
    t.startGame(); let hands = 0;
    while (t.stage !== 'gameover' && hands < 3000) {
      if (t.stage === 'handover') { hands++; if (hands % 15 === 0) t.level++; t.startHand(); continue; }
      const p = cur(t), L = t.legal(p.id), r = Math.random();
      if (r < 0.15 && !L.canCheck) t.act(p.id, 'fold');
      else if (r < 0.3 && L.canRaise) t.act(p.id, 'raise', L.minTo + Math.floor(Math.random() * (L.maxTo - L.minTo + 1) * 0.3));
      else if (r < 0.35) t.act(p.id, 'allin');
      else t.act(p.id, L.canCheck ? 'check' : 'call');
      const sum = t.players.reduce((s, q) => s + q.chips + (['handover', 'gameover'].includes(t.stage) ? 0 : q.total), 0);
      assert.equal(sum, 2400);
      assert.ok(t.players.every(q => q.chips >= 0));
    }
    assert.equal(t.stage, 'gameover', 'game finished');
    assert.equal(t.players.filter(q => q.chips > 0).length, 1);
  }
});
