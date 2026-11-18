const test = require('node:test'), assert = require('node:assert/strict');
const { Table, bestHand, cmp, newDeck, shuffle } = require('../engine'), B = require('../bots'), { series } = require('./sim');

test('bot names start with the skill letter and never repeat', () => {
  for (const lv of B.LEVELS) {
    const taken = ['Gord'];
    for (let i = 0; i < 20; i++) { const n = B.pickName(lv, taken); assert.equal(n[0], lv[0].toUpperCase()); assert.ok(!taken.map(x => x.toLowerCase()).includes(n.toLowerCase())); taken.push(n); }
  }
  assert.notEqual(B.pickName('easy', ['eddie']), 'Eddie');
});
test('bot view contains no other player hole cards', () => {
  const t = new Table(); for (let i = 0; i < 6; i++) t.addPlayer('p' + i, 'P' + i); t.startGame();
  const id = t.players[t.toAct].id, v = B.viewFor(t, id), s = JSON.stringify(v);
  for (const p of t.players) if (p.id !== id) for (const c of p.hole) assert.ok(!s.includes('"' + c + '"'), 'leaked ' + c);
  assert.deepEqual(v.hole, t.get(id).hole);
  assert.equal(B.viewFor(t, t.players.find(p => p.id !== id).id), null, 'no view when it is not your turn');
});
test('fast scorer agrees with the engine evaluator', () => {
  for (let i = 0; i < 400; i++) { const d = shuffle(newDeck()); const a = d.slice(0, 7), b = d.slice(7, 14);
    assert.equal(Math.sign(B.score(a) - B.score(b)), Math.sign(cmp(bestHand(a).score, bestHand(b).score))); }
});
test('equity sanity: AA vs 1 ~85%, 72o vs 1 ~35%', () => {
  const aa = B.equity(['As', 'Ah'], [], 1, 3000), j = B.equity(['7s', '2d'], [], 1, 3000);
  assert.ok(aa > 0.8 && aa < 0.9, aa); assert.ok(j > 0.28 && j < 0.4, j);
});
test('bots-only simulation: many hands, no stalls, no illegal actions, chips conserved', () => {
  const r = series(['hard', 'medium', 'easy', 'hard', 'medium', 'easy'], 40);
  console.log('    mixed 6-bot:', JSON.stringify(r));
  assert.equal(r.stalls, 0); assert.equal(r.illegal, 0); assert.equal(r.chipErr, 0); assert.equal(r.leaks, 0); assert.ok(r.hands > 1000);
});
test('Hard beats Easy heads-up over many games', () => {
  const r = series(['hard', 'easy'], 200);
  const rate = r.wins.hard / (r.games - r.stalls);
  console.log(`    Hard vs Easy: Hard won ${r.wins.hard}/${r.games} games (${(rate * 100).toFixed(0)}%), ${r.hands} hands`);
  assert.equal(r.illegal, 0); assert.equal(r.stalls, 0); assert.ok(rate > 0.62, 'win rate ' + rate);
});
