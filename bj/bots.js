'use strict';
// Free Bet Blackjack computer players. Hard = perfect Free Bet basic strategy, Medium = a few mistakes, Easy = sloppy.
const { recommend } = require('./strategy');
const { total } = require('./engine');
const LEVELS = ['easy', 'medium', 'hard'];
const NAMES = { easy: ['Eddie', 'Ellie', 'Emma', 'Ethan', 'Eve', 'Elmer', 'Edna', 'Eli'], medium: ['Max', 'Mia', 'Milo', 'Maya', 'Mason', 'Molly', 'Marco', 'Mabel'], hard: ['Hank', 'Holly', 'Hugo', 'Hazel', 'Harvey', 'Heidi', 'Hector', 'Hope'] };
function pickName(level, taken, rand = Math.random) { const t = new Set(taken.map(n => n.toLowerCase())), free = NAMES[level].filter(n => !t.has(n.toLowerCase())); return free.length ? free[Math.floor(rand() * free.length)] : NAMES[level][0] + ' ' + (taken.length + 1); }
// returns { main, pog } in cents
function bet(level, chips, minBet, maxBet, pogOn, rand = Math.random) {
  const units = level === 'easy' ? [1, 1, 2, 3, 5, 5, 10] : level === 'medium' ? [1, 2, 2, 3, 4, 5] : [1, 1, 2, 2, 3, 4];
  let main = Math.min(maxBet, minBet * units[Math.floor(rand() * units.length)]); main = Math.round(main / 500) * 500;
  if (main > chips) main = Math.floor(chips / 500) * 500; if (main < minBet) return { main: 0, pog: 0 };
  let pog = pogOn && chips - main >= 500 && rand() < (level === 'easy' ? 0.5 : 0.25) ? 500 : 0;
  return { main, pog };
}
function insurance(level, rand = Math.random) { return level === 'easy' ? rand() < 0.4 : level === 'medium' ? rand() < 0.05 : false; }
function decide(level, hand, upcard, legal, rand = Math.random) {
  const free = hand.cash === 0, best = recommend(hand.cards, upcard, legal, free).action, t = total(hand.cards);
  const ok = a => (a === 'hit' && legal.canHit) || a === 'stand' || (a === 'double' && legal.canDouble) || (a === 'split' && legal.canSplit);
  let a = best;
  if (level === 'medium' && rand() < 0.12 && t.total >= 12 && t.total <= 16) a = best === 'hit' ? 'stand' : 'hit';
  if (level === 'easy') { // sloppy "never bust" style with random freebies
    if (legal.canSplit && legal.splitFree && rand() < 0.6) a = 'split';
    else if (legal.canDouble && legal.doubleFree && rand() < 0.7) a = 'double';
    else if (legal.canDouble && !legal.doubleFree && rand() < 0.08) a = 'double';
    else a = t.total >= (rand() < 0.5 ? 15 : 13) ? 'stand' : 'hit';
  }
  return ok(a) ? a : (legal.canHit && t.total < 12 ? 'hit' : 'stand');
}
const delayMs = (rand = Math.random) => Math.round(800 + rand() * 1100);
module.exports = { LEVELS, NAMES, pickName, bet, insurance, decide, delayMs };
