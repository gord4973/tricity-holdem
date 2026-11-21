'use strict';
// Tricity Free Bet Blackjack - pure rules engine (no I/O). Play money only. All money in CENTS.
// Rules: 6-deck shoe, cut card ~75%, dealer hits soft 17, blackjack pays 3:2, insurance 2:1, dealer peeks on A/10,
// FREE double on hard 9/10/11 (two cards), FREE split on all pairs except 10-values, resplit to 4 hands (aces too),
// double after split, paid doubles on any other two cards, paid split of tens, split aces get one card, no surrender,
// DEALER 22 PUSHES every live non-blackjack hand. Pot of Gold side bet pays on the number of free-bet lammers.
const crypto = require('crypto');
const RANKS = '23456789TJQKA', SUITS = 'shdc';
const START_CHIPS = 40000; // $400: 1 x $100, 4 x $25, 40 x $5
const POG_PAY = { 1: 3, 2: 12, 3: 30, 4: 60, 5: 100, 6: 250, 7: 1000 }; // x:1 by lammer count (7+ = 1000)
const MAX_HANDS = 4;
const val = c => c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : +c[0];
const tenVal = c => val(c) === 10;
function total(cards) { let t = 0, a = 0; for (const c of cards) { t += val(c); if (c[0] === 'A') a++; } while (t > 21 && a) { t -= 10; a--; } return { total: t, soft: a > 0 }; }
const isBJ = (cards, split) => !split && cards.length === 2 && total(cards).total === 21;
const handLabel = cards => { const { total: t, soft } = total(cards); return t > 21 ? `Bust (${t})` : (soft && t < 21 ? `Soft ${t}` : String(t)); };
const fmt = c => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
const pogMult = n => n <= 0 ? 0 : POG_PAY[Math.min(n, 7)];

class Shoe {
  constructor(decks = 6, rand = (n => crypto.randomInt(n))) { this.decks = decks; this.rand = rand; this.shuffle(); }
  shuffle() {
    const d = []; for (let k = 0; k < this.decks; k++) for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    for (let i = d.length - 1; i > 0; i--) { const j = this.rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
    this.cards = d; this.pos = 0; this.cutAt = Math.floor(d.length * (0.72 + this.rand(7) / 100)); this.rigged = []; this.shuffles = (this.shuffles || 0) + 1;
  }
  draw() { if (this.rigged.length) return this.rigged.shift(); if (this.pos >= this.cards.length) this.shuffle(); return this.cards[this.pos++]; }
  get remaining() { return this.cards.length - this.pos; }
  get pastCut() { return this.pos >= this.cutAt; }
  rig(cards) { this.rigged.push(...cards); } // tests only: next cards dealt
}

class Table {
  constructor(opts = {}) {
    this.shoe = opts.shoe || new Shoe(6, opts.rand); this.players = []; this.stage = 'lobby'; this.round = 0; this.log = []; this.seq = 0; this.turnSeq = 0;
    this.minBet = opts.minBet || 500; this.maxBet = opts.maxBet || 50000; this.pog = opts.pog !== false; this.pogMin = 500; this.pogMax = 2500;
    this.seen = new Array(11).fill(0); // face-up cards seen since the last shuffle, index by value (1 = ace .. 10)
    this.dealer = { cards: [], revealed: false }; this.boxes = []; this.turn = null; this.result = null; this.house = 0;
  }
  addLog(m) { this.log.push(m); if (this.log.length > 60) this.log.shift(); this.seq++; }
  get(id) { return this.players.find(p => p.id === id); }
  addPlayer(id, name) { if (this.players.length >= 7) throw new Error('Table is full (7 seats)'); this.players.push({ id, name, chips: START_CHIPS, startChips: START_CHIPS, out: false, outHand: 0, bet: { main: 0, pog: 0, ready: false }, last: null }); }
  removePlayer(id) { this.players = this.players.filter(p => p.id !== id); }
  startGame() { if (this.players.length < 1) throw new Error('Need at least one player'); for (const p of this.players) Object.assign(p, { chips: START_CHIPS, startChips: START_CHIPS, out: false, outHand: 0, bet: { main: 0, pog: 0, ready: false }, last: null }); this.round = 0; this.house = 0; this.addLog('🃏 Shuffling a fresh 6-deck shoe'); this.shoe.shuffle(); this.seen.fill(0); this.openBetting(); }
  resetForNewGame() { this.stage = 'lobby'; this.round = 0; this.result = null; this.boxes = []; this.turn = null; this.dealer = { cards: [], revealed: false }; this.winner = null; this.endedByHost = false; for (const p of this.players) Object.assign(p, { chips: START_CHIPS, startChips: START_CHIPS, out: false, outHand: 0, bet: { main: 0, pog: 0, ready: false }, last: null }); this.addLog('New game - everyone back to $400'); }
  openBetting() {
    this.round++; this.stage = 'betting'; this.boxes = []; this.turn = null; this.dealer = { cards: [], revealed: false }; this.result = null;
    for (const p of this.players) { p.bet = { main: 0, pog: 0, ready: false }; p.startChips = p.chips; }
    if (this.shoe.pastCut) { this.shoe.shuffle(); this.seen.fill(0); this.addLog('✂ Cut card reached - shuffling a new shoe'); }
    this.addLog(`Round ${this.round}: place your bets`);
  }
  // ---- betting ----
  canBet(p) { return p && !p.out && this.stage === 'betting'; }
  betAdd(id, spot, cents) {
    const p = this.get(id); if (!this.canBet(p)) throw new Error('Betting is closed'); if (p.bet.ready) throw new Error('Your bet is locked in');
    cents = Math.round(+cents); if (![500, 2500, 10000].includes(cents)) throw new Error('Pick a $5, $25 or $100 chip');
    const avail = p.chips - p.bet.main - p.bet.pog; if (cents > avail) throw new Error('Not enough chips');
    if (spot === 'pog') { if (!this.pog) throw new Error('No Pot of Gold at this table'); if (p.bet.pog + cents > this.pogMax) throw new Error(`Pot of Gold max is ${fmt(this.pogMax)}`); p.bet.pog += cents; }
    else { if (p.bet.main + cents > this.maxBet) throw new Error(`Table max is ${fmt(this.maxBet)}`); p.bet.main += cents; }
  }
  betClear(id) { const p = this.get(id); if (!this.canBet(p)) throw new Error('Betting is closed'); if (p.bet.ready) throw new Error('Your bet is locked in'); p.bet.main = 0; p.bet.pog = 0; }
  rebet(id, mult = 1) {
    const p = this.get(id); if (!this.canBet(p)) throw new Error('Betting is closed'); if (p.bet.ready) throw new Error('Your bet is locked in'); if (!p.last) throw new Error('No previous bet');
    let main = Math.min(this.maxBet, p.last.main * mult), pog = this.pog ? Math.min(this.pogMax, p.last.pog * mult) : 0;
    if (main + pog > p.chips) { pog = 0; } if (main > p.chips) main = Math.floor(p.chips / 500) * 500;
    if (main < this.minBet) throw new Error('Not enough chips for that bet'); p.bet.main = main; p.bet.pog = pog;
  }
  setBet(id, main, pog) { const p = this.get(id); if (!this.canBet(p)) throw new Error('Betting is closed'); main = Math.round(main / 500) * 500; pog = this.pog ? Math.round(pog / 500) * 500 : 0; if (main + pog > p.chips) throw new Error('Not enough chips'); p.bet.main = Math.min(main, this.maxBet); p.bet.pog = Math.min(pog, this.pogMax); }
  betReady(id, on = true) {
    const p = this.get(id); if (!this.canBet(p)) throw new Error('Betting is closed');
    if (on) { if (p.bet.main < this.minBet) throw new Error(`Minimum bet is ${fmt(this.minBet)}`); if (p.bet.pog && p.bet.pog < this.pogMin) throw new Error(`Pot of Gold minimum is ${fmt(this.pogMin)}`); }
    p.bet.ready = !!on;
  }
  bettors() { return this.players.filter(p => !p.out && p.bet.main >= this.minBet && p.bet.main + p.bet.pog <= p.chips); }
  // ---- deal ----
  deal() {
    if (this.stage !== 'betting') throw new Error('Not taking bets');
    const ps = this.bettors(); if (!ps.length) throw new Error('No bets on the table');
    this.boxes = ps.map(p => { const pog = p.bet.pog >= this.pogMin ? p.bet.pog : 0; p.chips -= p.bet.main + pog; p.last = { main: p.bet.main, pog }; return { id: p.id, name: p.name, unit: p.bet.main, pog, lammers: 0, insurance: null, hands: [{ cards: [], cash: p.bet.main, free: 0, split: false, aces: false, done: false, doubled: false }] }; });
    for (const p of this.players) if (!this.boxes.some(b => b.id === p.id)) { p.bet.main = 0; p.bet.pog = 0; }
    const up = (c) => { this.see(c); return c; };
    for (let r = 0; r < 2; r++) { for (const b of this.boxes) b.hands[0].cards.push(up(this.shoe.draw())); this.dealer.cards.push(r === 0 ? up(this.shoe.draw()) : this.shoe.draw()); }
    this.dealer.revealed = false; this.turnSeq++;
    this.addLog(`Dealing round ${this.round} to ${this.boxes.map(b => b.name).join(', ')}`);
    for (const b of this.boxes) { const h = b.hands[0]; if (isBJ(h.cards)) { h.done = true; h.bj = true; this.addLog(`🂡 ${b.name} has BLACKJACK!`); } }
    const u = this.dealer.cards[0];
    if (u[0] === 'A') { this.stage = 'insurance'; this.addLog('Dealer shows an Ace - insurance?'); return; }
    this.afterInsurance();
  }
  see(c) { this.seen[c[0] === 'A' ? 1 : val(c)]++; }
  insure(id, yes) {
    if (this.stage !== 'insurance') throw new Error('No insurance now');
    const b = this.boxes.find(x => x.id === id), p = this.get(id); if (!b) throw new Error('You are not in this round'); if (b.insurance !== null) return;
    if (yes) { const cost = Math.floor(b.unit / 2); if (cost > p.chips) throw new Error('Not enough chips for insurance'); p.chips -= cost; b.insurance = cost; this.addLog(`${b.name} takes insurance (${fmt(cost)})`); }
    else b.insurance = 0;
    if (this.boxes.every(x => x.insurance !== null)) this.afterInsurance();
  }
  closeInsurance() { if (this.stage !== 'insurance') return; for (const b of this.boxes) if (b.insurance === null) b.insurance = 0; this.afterInsurance(); }
  afterInsurance() {
    const u = this.dealer.cards[0], peek = u[0] === 'A' || tenVal(u);
    if (peek && isBJ(this.dealer.cards)) { this.dealer.revealed = true; this.see(this.dealer.cards[1]); this.addLog('Dealer has BLACKJACK'); return this.settle(); }
    if (peek) this.addLog('Dealer checks - no blackjack');
    for (const b of this.boxes) if (b.insurance > 0) { this.addLog(`${b.name} loses insurance`); b.insLost = b.insurance; }
    this.stage = 'playing'; this.turn = { bi: 0, hi: 0 }; this.findTurn();
  }
  // ---- playing ----
  cur() { if (this.stage !== 'playing' || !this.turn) return null; const b = this.boxes[this.turn.bi]; return b ? { b, h: b.hands[this.turn.hi] } : null; }
  findTurn() { // move to the next hand that needs a decision; deal second cards to split hands as they come up
    while (this.turn && this.turn.bi < this.boxes.length) {
      const b = this.boxes[this.turn.bi], h = b.hands[this.turn.hi];
      if (!h) { this.turn = { bi: this.turn.bi + 1, hi: 0 }; continue; }
      if (h.cards.length === 1) { const c = this.shoe.draw(); this.see(c); h.cards.push(c); if (h.aces && !(c[0] === 'A' && b.hands.length < MAX_HANDS)) h.done = true; if (total(h.cards).total === 21) h.done = true; }
      if (!h.done) { this.turnSeq++; return; }
      this.turn = { bi: this.turn.bi, hi: this.turn.hi + 1 };
    }
    this.turn = null; this.turnSeq++; this.stage = 'dealer'; this.dealer.revealed = true; this.see(this.dealer.cards[1]);
    this.addLog(`Dealer turns over ${this.dealer.cards[1][0] === 'T' ? '10' : this.dealer.cards[1][0]} - ${handLabel(this.dealer.cards)}`);
  }
  legal(id) {
    const c = this.cur(); if (!c || c.b.id !== id) return null; const { b, h } = c, p = this.get(id), t = total(h.cards);
    const two = h.cards.length === 2, pair = two && (h.cards[0][0] === h.cards[1][0] || (tenVal(h.cards[0]) && tenVal(h.cards[1])));
    const freeD = two && !t.soft && t.total >= 9 && t.total <= 11, freeS = pair && !tenVal(h.cards[0]);
    const canSplit = pair && b.hands.length < MAX_HANDS && (freeS || p.chips >= b.unit);
    const canDouble = two && !h.aces && (freeD || p.chips >= b.unit);
    if (h.aces) return { canHit: false, canStand: true, canDouble: false, doubleFree: false, canSplit, splitFree: freeS, total: t.total, soft: t.soft, hand: this.turn.hi, unit: b.unit };
    return { canHit: true, canStand: true, canDouble, doubleFree: freeD, canSplit, splitFree: freeS, total: t.total, soft: t.soft, hand: this.turn.hi, unit: b.unit };
  }
  act(id, action) {
    const L = this.legal(id); if (!L) throw new Error('Not your turn');
    const { b, h } = this.cur(), p = this.get(id), nm = b.hands.length > 1 ? `${b.name} (hand ${this.turn.hi + 1})` : b.name;
    const draw = () => { const c = this.shoe.draw(); this.see(c); h.cards.push(c); return c; };
    if (action === 'hit') { if (!L.canHit) throw new Error("Can't hit"); draw(); const t = total(h.cards).total; this.addLog(`${nm} hits - ${handLabel(h.cards)}`); if (t > 21) { h.done = true; h.bust = true; } else if (t === 21) h.done = true; }
    else if (action === 'stand') { h.done = true; this.addLog(`${nm} stands on ${handLabel(h.cards)}`); }
    else if (action === 'double') {
      if (!L.canDouble) throw new Error("Can't double");
      if (L.doubleFree) { h.free += b.unit; b.lammers++; h.freeDouble = true; } else { p.chips -= b.unit; h.cash += b.unit; }
      h.doubled = true; draw(); const t = total(h.cards).total; h.done = true; if (t > 21) h.bust = true;
      this.addLog(`${nm} ${L.doubleFree ? 'FREE doubles 🪙' : 'doubles'} - ${handLabel(h.cards)}`);
    } else if (action === 'split') {
      if (!L.canSplit) throw new Error("Can't split");
      const aces = h.cards[0][0] === 'A', moved = h.cards.pop(), nh = { cards: [moved], cash: L.splitFree ? 0 : b.unit, free: L.splitFree ? b.unit : 0, split: true, aces, done: false, doubled: false, freeSplit: L.splitFree };
      if (L.splitFree) b.lammers++; else p.chips -= b.unit;
      h.split = true; h.aces = aces; b.hands.splice(this.turn.hi + 1, 0, nh);
      this.addLog(`${b.name} ${L.splitFree ? 'FREE splits 🪙' : 'splits'} ${moved[0] === 'T' ? '10' : moved[0]}s`);
      draw(); if (aces && !(h.cards[1][0] === 'A' && b.hands.length < MAX_HANDS)) h.done = true; if (total(h.cards).total === 21) h.done = true;
    } else throw new Error('Unknown action');
    if (h.done) { this.turn = { bi: this.turn.bi, hi: this.turn.hi + 1 }; this.findTurn(); } else this.turnSeq++;
  }
  // ---- dealer ----
  dealerNeedsToPlay() { return this.boxes.some(b => b.hands.some(h => !h.bust && !h.bj)); }
  dealerStep() { // one dealer action; returns true when finished (and settled)
    if (this.stage !== 'dealer') return true;
    const t = total(this.dealer.cards);
    if (this.dealerNeedsToPlay() && (t.total < 17 || (t.total === 17 && t.soft))) { const c = this.shoe.draw(); this.see(c); this.dealer.cards.push(c); this.addLog(`Dealer draws - ${handLabel(this.dealer.cards)}`); return false; }
    this.settle(); return true;
  }
  // ---- settle ----
  settle() {
    const d = total(this.dealer.cards).total, dBJ = isBJ(this.dealer.cards), d22 = d === 22, dBust = d > 22, lines = [];
    for (const b of this.boxes) {
      const p = this.get(b.id); let back = 0, staked = 0; const hr = [];
      if (b.insurance > 0 && dBJ) { back += b.insurance * 3; staked += b.insurance; hr.push({ kind: 'insurance', text: `Insurance wins ${fmt(b.insurance * 2)}` }); }
      else if (b.insurance > 0) staked += b.insurance;
      for (const h of b.hands) {
        const t = total(h.cards).total; staked += h.cash; let res, pay = 0;
        if (dBJ) { if (h.bj) { res = 'push'; pay = h.cash; } else { res = 'lose'; } }
        else if (h.bj) { res = 'blackjack'; pay = h.cash + Math.round(h.cash * 1.5); }
        else if (h.bust) res = 'bust';
        else if (d22) { res = 'push22'; pay = h.cash; }
        else if (dBust || t > d) { res = 'win'; pay = h.cash * 2 + h.free; }
        else if (t === d) { res = 'push'; pay = h.cash; }
        else res = 'lose';
        h.result = res; h.paid = pay; back += pay; hr.push({ kind: 'hand', res, pay, cash: h.cash, free: h.free });
      }
      if (b.pog) { staked += b.pog; const m = pogMult(b.lammers); b.pogPaid = m ? b.pog * (m + 1) : 0; back += b.pogPaid; hr.push({ kind: 'pog', text: m ? `Pot of Gold ${b.lammers} 🪙 pays ${m}:1 = ${fmt(b.pog * m)}` : 'Pot of Gold loses (no lammers)' }); }
      p.chips += back; b.net = back - staked; this.house -= b.net; lines.push({ id: b.id, name: b.name, net: b.net, hands: b.hands.map(h => h.result), lammers: b.lammers, extra: hr.filter(x => x.kind !== 'hand').map(x => x.text) });
    }
    this.result = { dealer: d, dealerBJ: dBJ, d22, dBust, lines, round: this.round };
    this.addLog(dBJ ? 'Dealer blackjack' : d22 ? 'Dealer 22 - all live hands PUSH' : dBust ? `Dealer busts with ${d}` : `Dealer has ${d}`);
    for (const l of lines) this.addLog(`${l.name} ${l.net > 0 ? 'wins ' + fmt(l.net) : l.net < 0 ? 'loses ' + fmt(-l.net) : 'pushes'}`);
    this.stage = 'settled'; this.turn = null; this.turnSeq++;
    for (const p of this.players) if (!p.out && p.chips < this.minBet) { p.out = true; p.outHand = this.round; this.addLog(`${p.name} is out of chips`); }
  }
  // after the result pause: next round or game over
  next() {
    if (this.stage !== 'settled') return;
    if (!this.players.some(p => !p.out)) return this.finish(false);
    this.openBetting();
  }
  finish(byHost) { this.stage = 'gameover'; this.endedByHost = !!byHost; const s = this.standings(); this.winner = s.filter(r => r.rank === 1).map(r => r.name).join(' & '); this.addLog(`🏁 Game over - ${this.winner}`); }
  endGame() { // host: void anything on the table (refund the round), then rank
    if (['insurance', 'playing', 'dealer'].includes(this.stage)) for (const b of this.boxes) { const p = this.get(b.id); p.chips += b.hands.reduce((a, h) => a + h.cash, 0) + b.pog + (b.insurance > 0 && !b.insLost ? b.insurance : 0); }
    for (const p of this.players) p.bet = { main: 0, pog: 0, ready: false };
    this.boxes = []; this.turn = null; this.addLog('⏹ Game ended by host'); this.finish(true);
  }
  standings() { return require('../engine').rankPlayers(this.players); }
}
module.exports = { Table, Shoe, total, isBJ, val, handLabel, fmt, pogMult, POG_PAY, START_CHIPS, MAX_HANDS };
