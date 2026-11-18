'use strict';
// Computer opponents. A bot only ever sees viewFor(): its own hole cards plus public table info, and acts through Table.act().
const { eval5, newDeck } = require('./engine');
const RV = c => '23456789TJQKA'.indexOf(c[0]) + 2;
const LEVELS = ['easy', 'medium', 'hard'];
const NAMES = {
  easy: ['Eddie', 'Ella', 'Ethan', 'Emma', 'Eli', 'Evan', 'Erin', 'Emily', 'Elliot', 'Eva', 'Ezra', 'Elsie', 'Eric', 'Edith', 'Emmett'],
  medium: ['Max', 'Mia', 'Marco', 'Maya', 'Milo', 'Megan', 'Mason', 'Molly', 'Miles', 'Mara', 'Mitch', 'Mabel', 'Morgan', 'Monty', 'Maddie'],
  hard: ['Hank', 'Holly', 'Hugo', 'Hazel', 'Harvey', 'Hannah', 'Hector', 'Harper', 'Henry', 'Heidi', 'Hal', 'Hattie', 'Harlan', 'Hope', 'Hollis'],
};
function pickName(level, taken, rand = Math.random) {
  const t = new Set(taken.map(n => n.toLowerCase())), free = NAMES[level].filter(n => !t.has(n.toLowerCase()));
  if (free.length) return free[Math.floor(rand() * free.length)];
  for (let i = 2; ; i++) { const n = NAMES[level][0] + ' ' + i; if (!t.has(n.toLowerCase())) return n; }
}

// ---- the only information a bot gets ----
function viewFor(t, id) {
  const me = t.get(id), L = t.legal(id); if (!me || !L) return null;
  const order = t.actionOrder(), [sb, bb] = t.blinds;
  return {
    hole: me.hole.slice(), board: t.board.slice(), stage: t.stage, legal: { ...L }, pot: t.potTotal(), sb, bb,
    chips: me.chips, bet: me.bet, stack: me.chips + me.bet,
    pos: order.length > 1 ? Math.max(0, order.indexOf(id)) / (order.length - 1) : 1,
    opponents: t.players.filter(p => p.id !== id && !p.folded && !p.out).length,
    alive: t.players.filter(p => !p.out).length,
    raised: t.currentBet > bb && t.stage === 'preflop',
  };
}

// ---- hand strength helpers ----
function chen(h) {
  const [a, b] = h.map(RV).sort((x, y) => y - x), suited = h[0][1] === h[1][1];
  const pts = r => r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2;
  if (a === b) return Math.max(5, pts(a) * 2);
  let s = pts(a) + (suited ? 2 : 0); const gap = a - b - 1;
  s -= [0, 1, 2, 4][gap] ?? 5; if (gap <= 1 && a < 12) s += 1;
  return Math.ceil(s);
}
const enc = s => s.reduce((v, x) => v * 16 + x, 0) * 16 ** (6 - s.length);
const C5 = []; (function g(st, c) { if (c.length === 5) return C5.push(c.slice()); for (let i = st; i < 7; i++) { c.push(i); g(i + 1, c); c.pop(); } })(0, []);
function score(cards) { // best 5 of 5..7 cards as a single comparable number
  if (cards.length === 5) return enc(eval5(cards));
  let best = 0; const n = cards.length;
  for (const c of C5) { if (c[4] >= n) continue; const v = enc(eval5([cards[c[0]], cards[c[1]], cards[c[2]], cards[c[3]], cards[c[4]]])); if (v > best) best = v; }
  return best;
}
const cat = cards => Math.floor(score(cards) / 16 ** 5);
function equity(hole, board, opps, iters, rand = Math.random) {
  opps = Math.max(1, Math.min(opps, 9));
  const used = new Set(hole.concat(board)), rest = newDeck().filter(c => !used.has(c));
  let win = 0;
  for (let it = 0; it < iters; it++) {
    const d = rest.slice(), need = 5 - board.length + opps * 2;
    for (let i = 0; i < need; i++) { const j = i + Math.floor(rand() * (d.length - i)); [d[i], d[j]] = [d[j], d[i]]; }
    const b = board.concat(d.slice(0, 5 - board.length)); let k = 5 - board.length;
    const mine = score(hole.concat(b)); let best = 0, ties = 0;
    for (let o = 0; o < opps; o++) { const v = score([d[k], d[k + 1]].concat(b)); k += 2; if (v > best) { best = v; ties = 0; } if (v === best) ties++; }
    if (mine > best) win += 1; else if (mine === best) win += 1 / (ties + 1);
  }
  return win / iters;
}
// medium-style made hand + draws
function madeStrength(hole, board) {
  const all = hole.concat(board), c = cat(all), bc = cat(board), hr = hole.map(RV), br = board.map(RV), top = Math.max(...br);
  let s = 0.1;
  if (c >= 4 && c > bc) s = 0.85;
  else if (c === 3) s = bc >= 3 ? 0.3 : 0.8;
  else if (c === 2) s = bc >= 1 ? (hr.some(r => br.includes(r)) || hr[0] === hr[1] ? 0.55 : 0.3) : 0.75;
  else if (c === 1 && bc === 0) {
    if (hr[0] === hr[1]) s = hr[0] > top ? 0.65 : 0.4;
    else { const pr = hr.find(r => br.includes(r)); s = pr === top ? (Math.max(...hr) >= 12 || hr.every(r => r >= 10) ? 0.62 : 0.52) : 0.35; }
  } else if (c >= 1) s = 0.15;
  return s;
}
function draws(hole, board) {
  if (board.length >= 5) return 0;
  const all = hole.concat(board); let outs = 0;
  for (const su of 'shdc') { const n = all.filter(c => c[1] === su).length; if (n === 4 && hole.some(c => c[1] === su)) outs += 9; }
  const rs = new Set(all.map(RV)); if (rs.has(14)) rs.add(1); const hr = hole.map(RV);
  let st = 0; for (let lo = 1; lo <= 10; lo++) { let n = 0, inv = false; for (let r = lo; r < lo + 5; r++) if (rs.has(r)) { n++; if (hr.includes(r) || (r === 1 && hr.includes(14))) inv = true; } if (n === 4 && inv) st++; }
  if (st >= 2) outs += 8; else if (st === 1) outs += 4;
  return Math.min(0.6, outs * (board.length === 3 ? 0.04 : 0.02));
}

// ---- action helpers (always legal) ----
const A = {
  fold: L => L.canCheck ? { action: 'check' } : { action: 'fold' },
  call: L => L.canCheck ? { action: 'check' } : { action: 'call' },
  to: (L, to) => {
    if (!L.canRaise) return A.call(L);
    to = Math.round(to); if (to < L.minTo) to = L.minTo;
    if (to >= L.maxTo * 0.85) to = L.maxTo;
    return to >= L.maxTo ? { action: 'allin' } : { action: L.isBet ? 'bet' : 'raise', amount: to };
  },
  allin: L => L.canRaise ? { action: 'allin' } : A.call(L),
};
const betPot = (v, f) => v.legal.currentBet + Math.max(v.bb, f * (v.pot + v.legal.toCall)); // raise to: current bet + fraction of pot after calling

function easy(v, R) {
  const L = v.legal, r = R();
  if (r < 0.04) { const x = R(); return x < 0.3 ? A.fold(L) : x < 0.85 ? A.call(L) : A.to(L, L.minTo); } // random mistake
  if (v.stage === 'preflop') {
    const c = chen(v.hole);
    if (L.canCheck) return c >= 9 && R() < 0.15 ? A.to(L, L.minTo) : A.call(L);
    if (L.toCall > 0.4 * v.chips && c < 7 && R() < 0.7) return A.fold(L);
    if (c < 3 && R() < 0.4) return A.fold(L);
    return c >= 10 && R() < 0.1 ? A.to(L, L.minTo) : A.call(L);
  }
  const s = madeStrength(v.hole, v.board);
  if (L.canCheck) return s >= 0.5 && R() < 0.1 ? A.to(L, L.minTo) : A.call(L);
  if (s >= 0.35) return s >= 0.8 && R() < 0.1 ? A.to(L, L.minTo) : A.call(L);
  return R() < (L.toCall <= v.pot * 0.5 ? 0.7 : 0.35) ? A.call(L) : A.fold(L);
}
function medium(v, R) {
  const L = v.legal, bb = v.bb, c0 = v.stage === 'preflop' ? chen(v.hole) : 0;
  if (v.stage === 'preflop') {
    const c = c0, bbs = v.stack / bb;
    if (bbs < 8) return c >= 8 ? A.allin(L) : (L.canCheck ? A.call(L) : (c >= 10 ? A.call(L) : A.fold(L)));
    if (!v.raised) { if (c >= 9) return A.to(L, 3 * bb + L.bet * 0); if (c >= 6) return A.call(L); if (c >= 4 && L.toCall <= bb / 2) return A.call(L); return A.fold(L); }
    if (c >= 11) return A.to(L, L.currentBet * 3);
    if (c >= 8 && L.toCall <= 0.25 * v.stack) return A.call(L);
    return A.fold(L);
  }
  const s = madeStrength(v.hole, v.board), dr = draws(v.hole, v.board), po = L.toCall / (v.pot + L.toCall);
  if (L.canCheck) {
    if (s >= 0.6 && R() < 0.75) return A.to(L, betPot(v, 0.6));
    if (s >= 0.4 && R() < 0.3) return A.to(L, betPot(v, 0.4));
    if (dr >= 0.15 && R() < 0.25) return A.to(L, betPot(v, 0.5));
    if (R() < 0.06) return A.to(L, betPot(v, 0.5));
    return A.call(L);
  }
  if (s >= 0.8) return R() < 0.6 ? A.to(L, L.currentBet * 2.5) : A.call(L);
  if (s >= 0.6) return po < 0.45 ? A.call(L) : A.fold(L);
  if (s >= 0.4) return po < 0.3 ? A.call(L) : A.fold(L);
  if (dr > po) return A.call(L);
  return A.fold(L);
}
function hard(v, R) {
  const L = v.legal, bb = v.bb, bbs = v.stack / bb, late = v.pos >= 0.6;
  if (v.stage === 'preflop') {
    const c = chen(v.hole) + (v.alive <= 3 ? 1.5 : v.alive <= 5 ? 0.5 : 0);
    if (bbs <= 12) { // push/fold when short
      const push = c >= (bbs <= 6 ? 6 : 8) - (late ? 1.5 : 0);
      if (L.toCall >= v.chips * 0.5) return c >= (bbs <= 6 ? 8 : 9) ? A.allin(L) : A.fold(L);
      return push ? A.allin(L) : A.fold(L);
    }
    if (!v.raised) {
      const open = 9 - 3 * v.pos;
      if (c >= open) return A.to(L, (late ? 2.5 : 3) * bb + (L.currentBet > bb ? L.currentBet : 0));
      if (L.canCheck) return R() < 0.15 && c >= 5 ? A.to(L, 3 * bb) : A.call(L);
      if (L.toCall <= bb / 2 && c >= 5) return A.call(L);
      if (late && c >= open - 2 && R() < 0.25) return A.to(L, 2.5 * bb);
      return A.fold(L);
    }
    const po = L.toCall / (v.pot + L.toCall);
    if (c >= 12 || (c >= 10 && late)) return L.toCall > v.chips * 0.35 ? A.allin(L) : A.to(L, L.currentBet * 3 + v.pot * 0.2);
    if (c >= 8 || (c >= 7 && po < 0.25)) return L.toCall <= 0.3 * v.stack ? A.call(L) : (c >= 10 ? A.allin(L) : A.fold(L));
    return A.fold(L);
  }
  const iters = v.opponents >= 4 ? 220 : 320;
  const eq = equity(v.hole, v.board, v.opponents, iters, R), po = L.toCall / (v.pot + L.toCall), river = v.board.length === 5;
  const dr = draws(v.hole, v.board), spr = v.chips / Math.max(1, v.pot);
  const big = to => (to - L.bet) > v.chips * 0.45 ? A.allin(L) : A.to(L, to);
  if (L.canCheck) {
    if (eq > 0.7) return spr < 1.2 ? A.allin(L) : big(betPot(v, R() < 0.5 ? 0.66 : 0.8));
    if (eq > 0.52 && v.opponents <= 2) return big(betPot(v, 0.5));
    if (!river && dr >= 0.15 && R() < 0.4) return big(betPot(v, 0.6));        // semi-bluff
    if (v.opponents === 1 && R() < (river ? 0.1 : 0.15)) return A.to(L, betPot(v, 0.5)); // bluff
    return A.call(L);
  }
  if (eq > 0.8 || (eq > 0.65 && v.opponents === 1 && R() < 0.5)) return spr < 1.5 ? A.allin(L) : big(L.currentBet + v.pot + L.toCall);
  if (eq > po + 0.04) return A.call(L);
  if (!river && dr + 0.05 > po && R() < 0.3 && L.toCall < v.chips * 0.3) return R() < 0.3 ? big(L.currentBet * 2.5) : A.call(L);
  return A.fold(L);
}
const BRAIN = { easy, medium, hard };
function decide(level, v, rand = Math.random) {
  const d = (BRAIN[level] || easy)(v, rand), L = v.legal;
  // final guard: everything a bot returns must be legal
  if (d.action === 'check' && !L.canCheck) return { action: 'call' };
  if ((d.action === 'bet' || d.action === 'raise') && (!L.canRaise || !(d.amount >= L.minTo))) return A.call(L);
  return d;
}
function delayMs(v, rand = Math.random) { return Math.round(900 + rand() * 1500 + (v && v.legal && !v.legal.canCheck && v.stage !== 'preflop' ? 500 : 0)); }
module.exports = { LEVELS, NAMES, pickName, viewFor, decide, delayMs, chen, equity, score };
