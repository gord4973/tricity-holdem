'use strict';
// Tricity Hold'em - pure No-Limit Texas Hold'em engine (no I/O). Play money only.
const crypto = require('crypto');

const RANKS = '23456789TJQKA', SUITS = 'shdc';
const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const RANK_PLURAL = { 2: '2s', 3: '3s', 4: '4s', 5: '5s', 6: '6s', 7: '7s', 8: '8s', 9: '9s', 10: '10s', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
const CAT = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
const STARTING_CHIPS = 120;
const BLIND_LEVELS = [[1, 2], [2, 4], [5, 10], [10, 20], [20, 40], [50, 100], [100, 200], [200, 400], [500, 1000], [1000, 2000], [2000, 4000], [5000, 10000]];
const blindsFor = lvl => lvl < BLIND_LEVELS.length ? BLIND_LEVELS[lvl] : (() => { const m = 10 ** (lvl - BLIND_LEVELS.length + 1); return [5000 * m, 10000 * m]; })();

function newDeck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(r + s); return d; }
function shuffle(d, rand = crypto.randomInt) { for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }
const rv = c => RANKS.indexOf(c[0]) + 2;

// ---- hand evaluation ----
// returns [category, ...tiebreak ranks] for exactly 5 cards; higher compares better
function eval5(cards) {
  const r = cards.map(rv).sort((a, b) => b - a), flush = cards.every(c => c[1] === cards[0][1]);
  const cnt = {}; r.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  const groups = Object.entries(cnt).map(([k, v]) => [+k, v]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = [...new Set(r)];
  let straightHigh = 0;
  if (uniq.length === 5) { if (r[0] - r[4] === 4) straightHigh = r[0]; else if (r[0] === 14 && r[1] === 5) straightHigh = 5; }
  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...r];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(g => g[0])];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(g => g[0])];
  return [0, ...r];
}
function cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function bestHand(cards) {
  let best = null, bestCards = null; const n = cards.length;
  const pick = (start, chosen) => {
    if (chosen.length === 5) { const s = eval5(chosen); if (!best || cmp(s, best) > 0) { best = s; bestCards = chosen.slice(); } return; }
    for (let i = start; i <= n - (5 - chosen.length); i++) { chosen.push(cards[i]); pick(i + 1, chosen); chosen.pop(); }
  };
  pick(0, []);
  return { score: best, cards: bestCards, name: handName(best) };
}
function handName(s) {
  const [c, a, b] = s, N = RANK_NAME, P = RANK_PLURAL;
  switch (c) {
    case 9: return 'Royal Flush';
    case 8: return `Straight Flush, ${N[a]} high`;
    case 7: return `Four of a Kind, ${P[a]}`;
    case 6: return `Full House, ${P[a]} over ${P[b]}`;
    case 5: return `Flush, ${N[a]} high`;
    case 4: return `Straight, ${N[a]} high`;
    case 3: return `Three of a Kind, ${P[a]}`;
    case 2: return `Two Pair, ${P[a]} and ${P[b]}`;
    case 1: return `One Pair, ${P[a]}`;
    default: return `High Card, ${N[a]}`;
  }
}

// ---- pots ----
// contributions: [{id, total, folded}] -> [{amount, eligible:[ids]}] ; uncalled excess becomes a single-eligible pot
function buildPots(contrib) {
  const levels = [...new Set(contrib.filter(c => c.total > 0).map(c => c.total))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  for (const L of levels) {
    let amount = 0; const eligible = [];
    for (const c of contrib) { if (c.total > prev) amount += Math.min(c.total, L) - prev; if (c.total >= L && !c.folded) eligible.push(c.id); }
    if (amount > 0) {
      const last = pots[pots.length - 1];
      if (!eligible.length && last) last.amount += amount;          // orphan chips (only folded players reached this level)
      else if (last && sameSet(last.eligible, eligible)) last.amount += amount;
      else pots.push({ amount, eligible });
    }
    prev = L;
  }
  return pots;
}
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// ---- final ranking (one rule for standings, game-over places and the buy-in payout) ----
// 1) players with chips, most chips first; 2) eliminated players, last one out highest; 3) same hand: more chips at the start of that hand
// ranks higher; exact ties share the place.
function rankKey(p) { return p.out || p.chips <= 0 ? [0, p.outHand || 0, p.startChips || 0] : [1, p.chips, 0]; }
function rankCmp(a, b) { const x = rankKey(a), y = rankKey(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; }
function rankPlayers(players) {
  const list = players.map((p, i) => ({ p, i })).sort((a, b) => rankCmp(a.p, b.p) || a.i - b.i);
  return list.map(({ p, i }) => ({ id: p.id, name: p.name, chips: p.chips, seat: i, out: !!p.out, outHand: p.outHand || 0, rank: 1 + list.filter(o => rankCmp(o.p, p) < 0).length }));
}
// ---- table ----
class Table {
  constructor(opts = {}) {
    this.players = []; // seat order
    this.level = 0;          // level to use for the next hand
    this.handLevel = 0;      // level of the hand being played
    this.dealerSeat = -1; this.handNo = 0;
    this.stage = 'lobby';    // lobby | preflop | flop | turn | river | showdown | handover | gameover
    this.board = []; this.log = []; this.lastResult = null;
    this.rand = opts.rand || crypto.randomInt;
    this.startingChips = opts.startingChips || STARTING_CHIPS;
    this.onEvent = opts.onEvent || (() => {}); this.makeDeck = opts.makeDeck || null;
  }
  addPlayer(id, name) {
    if (this.stage !== 'lobby') throw new Error('Game already started');
    if (this.players.length >= 20) throw new Error('Table is full (20 players max)');
    const p = { id, name, chips: this.startingChips, hole: [], bet: 0, total: 0, folded: false, allIn: false, out: false, acted: false, lastActCount: -1, sittingOut: false, lastAction: '' };
    this.players.push(p); return p;
  }
  removePlayer(id) { if (this.stage === 'lobby') this.players = this.players.filter(p => p.id !== id); }
  get(id) { return this.players.find(p => p.id === id); }
  addLog(t) { this.seq = (this.seq || 0) + 1; this.log.push(t); if (this.log.length > 40) this.log.shift(); }
  alive() { return this.players.filter(p => !p.out); }
  nextSeat(from, pred) { const n = this.players.length; for (let k = 1; k <= n; k++) { const i = (from + k + n) % n; if (pred(this.players[i])) return i; } return -1; }
  get blinds() { return blindsFor(this.handLevel); }

  startGame() {
    if (this.alive().length < 2) throw new Error('Need at least 2 players');
    if (this.stage === 'lobby' || this.stage === 'gameover') this.dealerSeat = this.rand(this.players.length) - 1;
    this.startHand();
  }
  // host ends the game: void any hand in progress (return all committed chips), rank by chips
  endGame() {
    if (this.stage === 'lobby' || this.stage === 'gameover') throw new Error('No game in progress');
    const inHand = ['preflop', 'flop', 'turn', 'river'].includes(this.stage);
    if (inHand) { for (const p of this.players) { p.chips += p.total; p.total = 0; p.bet = 0; } this.addLog('Hand voided - all bets returned'); }
    for (const p of this.players) { p.hole = []; p.bet = 0; p.total = 0; p.allIn = false; p.folded = p.out; p.lastAction = p.out ? 'Out' : ''; }
    this.board = []; this.toAct = -1; this.lastResult = null; this.stage = 'gameover'; this.endedByHost = true;
    const st = this.standings(), top = st.filter(x => x.rank === 1);
    this.winner = top.map(x => x.name).join(' & ');
    this.addLog(`⏹ Game ended by host - ${top.length > 1 ? 'tied: ' : 'chip leader: '}${this.winner} (${st[0].chips})`);
  }
  standings() { return rankPlayers(this.players); }
  resetForNewGame() { this.endedByHost = false;
    for (const p of this.players) Object.assign(p, { chips: this.startingChips, out: false, outHand: 0, startChips: this.startingChips, hole: [], bet: 0, total: 0, folded: false, allIn: false, lastAction: '' });
    this.level = 0; this.handLevel = 0; this.handNo = 0; this.board = []; this.log = []; this.lastResult = null; this.stage = 'lobby'; this.dealerSeat = -1;
  }

  startHand() {
    const live = this.alive();
    if (live.length < 2) { this.stage = 'gameover'; return; }
    this.handLevel = this.level; this.handNo++;
    const [sb, bb] = this.blinds;
    this.deck = this.makeDeck ? this.makeDeck() : shuffle(newDeck(), this.rand); this.board = []; this.lastResult = null;
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, total: 0, folded: p.out, allIn: false, acted: false, lastActCount: -1, lastAction: '', startChips: p.chips });
    this.dealerSeat = this.nextSeat(this.dealerSeat, p => !p.out);
    const headsUp = live.length === 2; this.headsUp = headsUp;
    this.sbSeat = headsUp ? this.dealerSeat : this.nextSeat(this.dealerSeat, p => !p.out);
    this.bbSeat = this.nextSeat(this.sbSeat, p => !p.out);
    // deal two cards each, starting left of the button
    for (let r = 0; r < 2; r++) { let i = this.dealerSeat; for (let k = 0; k < live.length; k++) { i = this.nextSeat(i, p => !p.out); this.players[i].hole.push(this.deck.pop()); } }
    this.addLog(`— Hand #${this.handNo} · Blinds ${sb}/${bb} —`);
    this.post(this.players[this.sbSeat], sb, 'SB'); this.post(this.players[this.bbSeat], bb, 'BB');
    this.currentBet = bb; this.minRaise = bb; this.raiseCount = 0;
    this.stage = 'preflop';
    this.toAct = this.bbSeat; this.advanceTurn(true);
  }
  post(p, amt, label) { const a = Math.min(amt, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true; p.lastAction = `${label} ${a}`; this.addLog(`${p.name} posts ${label} ${a}${p.allIn ? ' (all-in)' : ''}`); }

  canAct(p) { return !p.folded && !p.out && !p.allIn; }
  needsAction(p) { return this.canAct(p) && (!p.acted || p.bet < this.currentBet); }
  bettingDone() {
    const actors = this.players.filter(p => this.canAct(p));
    if (!actors.some(p => this.needsAction(p))) return true;
    if (actors.length === 1) { const p = actors[0]; const maxOther = Math.max(0, ...this.players.filter(o => o !== p && !o.folded && !o.out).map(o => o.bet)); if (p.bet >= maxOther) return true; }
    return false;
  }
  // move toAct to next player needing action, or progress street
  advanceTurn(fromCurrent = false) {
    const inHand = this.players.filter(p => !p.folded && !p.out);
    if (inHand.length === 1) return this.finishByFold(inHand[0]);
    if (this.bettingDone()) return this.nextStreet();
    const i = this.nextSeat(this.toAct, p => this.needsAction(p));
    this.toAct = i; this.turnStarted = Date.now();
    this.onEvent('turn', this.players[i]);
  }
  legal(id) {
    const p = this.get(id); if (!p || !['preflop', 'flop', 'turn', 'river'].includes(this.stage) || this.players[this.toAct] !== p) return null;
    const toCall = Math.min(this.currentBet - p.bet, p.chips);
    const maxTo = p.bet + p.chips;
    const canRaise = p.chips > (this.currentBet - p.bet) && p.lastActCount < this.raiseCount && this.players.some(o => o !== p && this.canAct(o));
    const minTo = Math.min(maxTo, this.currentBet === 0 ? this.blinds[1] : this.currentBet + this.minRaise);
    return { toCall, canCheck: toCall === 0, canRaise, minTo, maxTo, isBet: this.currentBet === 0, currentBet: this.currentBet, bet: p.bet, chips: p.chips };
  }
  act(id, action, amount) {
    const L = this.legal(id); if (!L) throw new Error('Not your turn');
    const p = this.get(id);
    switch (action) {
      case 'fold': p.folded = true; p.lastAction = 'Fold'; this.addLog(`${p.name} folds`); break;
      case 'check': if (!L.canCheck) throw new Error('Cannot check'); p.lastAction = 'Check'; this.addLog(`${p.name} checks`); break;
      case 'call': {
        if (L.toCall === 0) { p.lastAction = 'Check'; this.addLog(`${p.name} checks`); break; }
        this.putIn(p, L.toCall); p.lastAction = p.allIn ? `All-in ${p.bet}` : `Call ${L.toCall}`; this.addLog(`${p.name} calls ${L.toCall}${p.allIn ? ' (all-in)' : ''}`); break;
      }
      case 'allin': return this.act(id, L.canRaise && L.maxTo > this.currentBet ? 'raise' : 'call', L.maxTo);
      case 'bet': case 'raise': {
        let to = Math.floor(Number(amount));
        if (!Number.isFinite(to)) throw new Error('Bad amount');
        if (!L.canRaise) { if (to >= L.maxTo && L.maxTo <= this.currentBet) return this.act(id, 'call'); throw new Error('Raising is not allowed here'); }
        to = Math.min(to, L.maxTo);
        if (to < L.minTo) throw new Error(`Minimum is ${L.minTo}`);
        if (to <= this.currentBet) return this.act(id, 'call');
        const inc = to - this.currentBet, wasBet = this.currentBet === 0;
        this.putIn(p, to - p.bet);
        if (inc >= this.minRaise) { this.minRaise = inc; this.raiseCount++; }   // full raise reopens action
        this.currentBet = to;
        for (const o of this.players) if (o !== p) o.acted = false;
        p.lastAction = p.allIn ? `All-in ${to}` : (wasBet ? `Bet ${to}` : `Raise to ${to}`);
        this.addLog(`${p.name} ${wasBet ? 'bets' : 'raises to'} ${to}${p.allIn ? ' (all-in)' : ''}`); break;
      }
      default: throw new Error('Unknown action');
    }
    p.acted = true; p.lastActCount = this.raiseCount;
    this.advanceTurn();
  }
  putIn(p, a) { a = Math.min(a, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true; }
  // seat ids in the order they act this street (clockwise), players who can still act only
  actionOrder() {
    if (!['preflop', 'flop', 'turn', 'river'].includes(this.stage)) return [];
    const n = this.players.length;
    const anchor = this.stage === 'preflop' ? (this.headsUp ? this.dealerSeat : (this.bbSeat + 1) % n) : (this.dealerSeat + 1) % n;
    const out = []; for (let k = 0; k < n; k++) { const p = this.players[(anchor + k) % n]; if (this.canAct(p)) out.push(p.id); }
    return out;
  }
  potTotal() { return this.players.reduce((s, p) => s + p.total, 0); }

  nextStreet() {
    for (const p of this.players) { p.bet = 0; p.acted = false; p.lastActCount = -1; }
    this.currentBet = 0; this.minRaise = this.blinds[1]; this.raiseCount = 0;
    const order = ['preflop', 'flop', 'turn', 'river'];
    const idx = order.indexOf(this.stage);
    if (idx === 3) return this.showdown();
    this.deck.pop(); // burn
    if (idx === 0) this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop()); else this.board.push(this.deck.pop());
    this.stage = order[idx + 1];
    this.addLog(`${this.stage[0].toUpperCase() + this.stage.slice(1)}: ${this.board.join(' ')}`);
    for (const p of this.players) if (!p.folded && !p.allIn) p.lastAction = '';
    this.toAct = this.dealerSeat; // first to act postflop = first live seat left of button
    if (this.bettingDone()) return this.nextStreet(); // everyone all-in: run it out
    this.advanceTurn();
  }
  finishByFold(winner) {
    const won = this.potTotal();
    winner.chips += won;
    this.addLog(`${winner.name} wins ${won} (everyone else folded)`);
    this.lastResult = { byFold: true, pots: [{ amount: won, winners: [{ id: winner.id, name: winner.name, amount: won }], hand: null }], shown: [] };
    this.endHand();
  }
  showdown() {
    this.stage = 'showdown';
    const contenders = this.players.filter(p => !p.folded && !p.out);
    const evals = {}; for (const p of contenders) evals[p.id] = bestHand(p.hole.concat(this.board));
    const pots = buildPots(this.players.map(p => ({ id: p.id, total: p.total, folded: p.folded || p.out })));
    const result = { byFold: false, pots: [], shown: contenders.map(p => ({ id: p.id, name: p.name, hole: p.hole, hand: evals[p.id].name, best: evals[p.id].cards })) };
    // odd-chip order: first seat left of the button
    const seatOrder = id => { const s = this.players.findIndex(p => p.id === id); return (s - this.dealerSeat - 1 + this.players.length * 2) % this.players.length; };
    pots.forEach((pot, k) => {
      let best = null, winners = [];
      for (const id of pot.eligible) { const sc = evals[id].score, c = best ? cmp(sc, best) : 1; if (c > 0) { best = sc; winners = [id]; } else if (c === 0) winners.push(id); }
      winners.sort((a, b) => seatOrder(a) - seatOrder(b));
      const share = Math.floor(pot.amount / winners.length); let odd = pot.amount - share * winners.length;
      const wl = winners.map(id => { const amt = share + (odd-- > 0 ? 1 : 0); this.get(id).chips += amt; return { id, name: this.get(id).name, amount: amt }; });
      const label = pots.length > 1 ? (k === 0 ? 'Main pot' : `Side pot ${k}`) : 'Pot';
      const uncalled = pot.eligible.length === 1;
      result.pots.push({ label: uncalled ? 'Returned (uncalled)' : label, amount: pot.amount, winners: wl, hand: uncalled ? null : evals[winners[0]].name, uncalled });
      if (uncalled) this.addLog(`${wl[0].name} gets ${pot.amount} back (uncalled)`);
      else this.addLog(`${wl.map(w => w.name).join(' & ')} ${wl.length > 1 ? 'split' : 'wins'} ${label.toLowerCase()} ${pot.amount} with ${evals[winners[0]].name}`);
    });
    // summary order: best hand first (engine evaluator), ties together with main-pot winners first, then seat order from the button
    const main = result.pots.find(p => !p.uncalled), mainW = new Set(main ? main.winners.map(w => w.id) : []);
    result.shown.sort((a, b) => cmp(evals[b.id].score, evals[a.id].score) || (mainW.has(b.id) - mainW.has(a.id)) || seatOrder(a.id) - seatOrder(b.id));
    result.shown.forEach(s => { s.rank = 1 + result.shown.filter(o => cmp(evals[o.id].score, evals[s.id].score) > 0).length;
      s.won = result.pots.filter(p => !p.uncalled && p.winners.some(w => w.id === s.id)).map(p => p.label); });
    result.folded = this.players.filter(p => p.folded && !p.out && p.hole.length).map(p => ({ id: p.id, name: p.name }));
    this.lastResult = result;
    this.endHand();
  }
  endHand() {
    for (const p of this.players) { p.bet = 0; if (!p.out && p.chips === 0) { p.out = true; p.outHand = this.handNo; p.lastAction = 'Out'; this.addLog(`${p.name} is eliminated`); } }
    this.toAct = -1;
    const live = this.alive();
    if (live.length < 2) { this.stage = 'gameover'; this.winner = live[0] ? live[0].name : null; this.addLog(`🏆 ${this.winner} wins the game!`); }
    else this.stage = 'handover';
    this.onEvent('handEnd');
  }
}

module.exports = { rankPlayers, rankCmp, Table, eval5, bestHand, handName, buildPots, cmp, newDeck, shuffle, blindsFor, BLIND_LEVELS, STARTING_CHIPS };
