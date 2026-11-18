const test = require('node:test'), assert = require('node:assert/strict');
const { Table, rankPlayers } = require('../engine'), B = require('../bots');

const fixture = rows => rows.map(([id, chips, out, outHand, startChips]) => ({ id, name: id, chips, out, outHand, startChips }));
test('ranking: chips first, then reverse elimination order, same-hand by starting chips, exact ties share', () => {
  const r = rankPlayers(fixture([
    ['first', 0, true, 4, 30], ['gord', 0, true, 40, 12], ['lead', 500, false, 0, 0], ['b2', 220, false, 0, 0],
    ['sameA', 0, true, 20, 50], ['sameB', 0, true, 20, 80], ['tieA', 0, true, 10, 25], ['tieB', 0, true, 10, 25]]));
  assert.deepEqual(r.map(x => [x.id, x.rank]), [['lead', 1], ['b2', 2], ['gord', 3], ['sameB', 4], ['sameA', 5], ['tieA', 6], ['tieB', 6], ['first', 8]]);
});

// play a real game: seat "h" (the human) and 5 bots; h folds/checks until 3 remain, then shoves every hand
function playUntil(t, stopWhen) {
  while (t.stage !== 'gameover' && !stopWhen(t)) {
    if (t.stage === 'handover') { if (t.handNo % 10 === 0) t.level++; t.startHand(); continue; }
    const p = t.players[t.toAct], v = B.viewFor(t, p.id);
    if (p.id === 'h') { const L = v.legal; if (t.alive().length <= 3) t.act('h', 'allin'); else t.act('h', L.canCheck ? 'check' : 'fold'); }
    else { const d = B.decide(['easy', 'medium', 'hard', 'hard', 'medium'][+p.id.slice(1)], v); t.act(p.id, d.action, d.amount); }
  }
}
function scenario() {
  for (let tries = 0; tries < 200; tries++) {
    const t = new Table(); t.addPlayer('h', 'Gord'); for (let i = 0; i < 5; i++) t.addPlayer('b' + i, 'Bot' + i);
    t.startGame(); playUntil(t, t => t.get('h').out || t.alive().length <= 2);
    if (t.get('h').out && t.alive().length === 2 && t.stage === 'handover') return t; // Gord busted 3rd, two left
  }
  throw new Error('scenario not reached');
}
test('1 human + 5 bots, human busts 3rd, host presses End game: Gord is listed 3rd and the rest by elimination order', () => {
  const t = scenario(); const outs = t.players.filter(p => p.out).map(p => p.outHand);
  t.endGame(); const st = t.standings();
  assert.equal(st[2].id, 'h'); assert.equal(st[2].rank, 3);
  assert.ok(st[0].chips >= st[1].chips && st[1].chips > 0);
  const tail = st.slice(2); for (let i = 1; i < tail.length; i++) assert.ok(tail[i - 1].outHand >= tail[i].outHand, 'later out ranks higher');
  assert.equal(new Set(st.map(r => r.rank)).size >= 3, true); assert.equal(outs.length, 4);
  assert.equal(t.winner, st.filter(r => r.rank === 1).map(r => r.name).join(' & '));
  t.resetForNewGame(); assert.ok(t.players.every(p => !p.out && !p.outHand && p.chips === 120), 'Play again resets elimination data');
});
test('natural game over: winner first, then everyone in reverse elimination order', () => {
  for (let g = 0; g < 10; g++) {
    const t = new Table(); t.addPlayer('h', 'Gord'); for (let i = 0; i < 5; i++) t.addPlayer('b' + i, 'Bot' + i);
    t.startGame(); playUntil(t, () => false);
    const st = t.standings(); assert.equal(t.stage, 'gameover'); assert.equal(st[0].rank, 1); assert.equal(st[0].name, t.winner); assert.equal(st[0].chips, 720);
    for (let i = 2; i < st.length; i++) assert.ok(st[i - 1].outHand >= st[i].outHand);
    assert.ok(t.players.every(p => p.out ? p.outHand > 0 : true), 'outHand recorded for every eliminated seat (bots and human)');
  }
});
