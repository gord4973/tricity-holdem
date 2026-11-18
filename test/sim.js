// Bots-only simulation (engine + bots, no server). node test/sim.js [games]
const { Table } = require('../engine'), B = require('../bots');
function playGame(levels, { levelEvery = 10, maxHands = 3000 } = {}) {
  const t = new Table(); levels.forEach((lv, i) => t.addPlayer('b' + i, lv[0].toUpperCase() + i));
  const lvOf = id => levels[+id.slice(1)];
  let illegal = 0, actions = 0, leaks = 0;
  t.startGame();
  while (t.stage !== 'gameover') {
    if (t.stage === 'handover') { if (t.handNo >= maxHands) return { stalled: true, hands: t.handNo, illegal, actions }; if (t.handNo % levelEvery === 0) t.level++; t.startHand(); continue; }
    const p = t.players[t.toAct], v = B.viewFor(t, p.id);
    for (const o of t.players) if (o !== p && o.hole.length && JSON.stringify(v).includes(o.hole[0] + '"') && !v.board.includes(o.hole[0])) leaks++;
    const d = B.decide(lvOf(p.id), v);
    try { t.act(p.id, d.action, d.amount); } catch (e) { illegal++; t.act(p.id, v.legal.canCheck ? 'check' : 'fold'); }
    if (++actions > 500000) return { stalled: true, hands: t.handNo, illegal, actions };
  }
  const chips = t.players.reduce((s, p) => s + p.chips, 0);
  const w = t.players.find(p => !p.out);
  return { winner: w && lvOf(w.id), hands: t.handNo, illegal, actions, leaks, chipsOk: chips === levels.length * t.startingChips };
}
function series(levels, games, o) {
  const wins = {}, r = { games, hands: 0, illegal: 0, stalls: 0, leaks: 0, chipErr: 0, wins };
  for (let g = 0; g < games; g++) { const x = playGame(levels, o); r.hands += x.hands; r.illegal += x.illegal; r.leaks += x.leaks || 0; if (x.stalled) r.stalls++; else { wins[x.winner] = (wins[x.winner] || 0) + 1; if (!x.chipsOk) r.chipErr++; } }
  return r;
}
module.exports = { playGame, series };
if (require.main === module) {
  const n = +process.argv[2] || 200, T = Date.now();
  for (const lv of [['hard', 'easy'], ['hard', 'medium'], ['medium', 'easy'], ['hard', 'hard', 'medium', 'medium', 'easy', 'easy']]) {
    const r = series(lv, n); console.log(lv.join(' v '), JSON.stringify(r));
  }
  console.log('done in', ((Date.now() - T) / 1000).toFixed(1) + 's');
}
