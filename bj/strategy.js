'use strict';
// Free Bet Blackjack basic strategy (6 decks, dealer hits soft 17, dealer 22 pushes) - Wizard of Odds tables,
// with "real money hand" vs "free hand" (a hand funded only by a lammer, where a push is as bad as a loss).
// No surrender at this table, so surrender cells fall back to the listed alternative.
const { total, val } = require('./engine');
const up = c => c[0] === 'A' ? 11 : val(c); // 2..11
const H = 'hit', S = 'stand', D = 'double', P = 'split';
function hardReal(t, u) {
  if (t <= 8) return H; if (t <= 11) return D;
  if (t === 12) return u === 5 || u === 6 ? S : H;
  if (t === 13) return u >= 3 && u <= 6 ? S : H;
  if (t <= 16) return u >= 2 && u <= 6 ? S : H;
  return S;
}
function hardFree(t, u) {
  if (t <= 8) return H; if (t <= 11) return D;
  if (t === 12) return u === 5 || u === 6 ? S : H;
  if (t <= 14) return u >= 3 && u <= 6 ? S : H;
  if (t <= 16) return u <= 6 ? S : H;
  if (t === 17) return u <= 6 || u === 10 ? S : H;
  return S;
}
function softReal(t, u) {
  if (t <= 15) return H; if (t === 16) return u === 6 ? D : H; if (t === 17) return u === 5 || u === 6 ? D : H;
  if (t === 18) return u === 5 || u === 6 ? D : (u >= 9 ? H : S);
  return S;
}
function softFree(t, u) {
  if (t <= 15) return H; if (t === 16) return u === 6 ? D : H; if (t === 17) return u === 5 || u === 6 ? D : H;
  if (t === 18) return u >= 4 && u <= 6 ? D : (u === 7 ? S : H);
  if (t === 19) return u === 5 || u === 6 ? D : S;
  if (t === 20) return u === 6 ? D : S;
  return S;
}
// hand: { cards, cash, free }, upcard, legal: { canDouble, doubleFree, canSplit, splitFree, canHit }
function recommend(cards, upcard, legal = {}, freeHand = false) {
  const u = up(upcard), t = total(cards), two = cards.length === 2;
  if (legal.canHit === false) return { action: legal.canSplit ? P : S, label: legal.canSplit ? `Split${legal.splitFree ? ' (free)' : ''}` : 'Stand' }; // split aces
  if (two && legal.canSplit && cards[0][0] === cards[1][0]) {
    const r = val(cards[0]); if (r !== 5 && r !== 10) return { action: P, label: `Split${legal.splitFree ? ' (free)' : ''}` };
  }
  let a = t.soft ? (freeHand ? softFree : softReal)(t.total, u) : (freeHand ? hardFree : hardReal)(t.total, u);
  if (a === D && !legal.canDouble) a = t.soft && t.total >= 18 ? S : H; // can't double (3+ cards / short of chips): soft 18+ stands, everything else hits
  const label = a === D ? `Double${legal.doubleFree ? ' (free)' : ''}` : a === H ? 'Hit' : a === S ? 'Stand' : 'Split';
  return { action: a, label };
}
// ---- probabilities from the unseen cards (w[1..10] = counts of unseen ace..ten-value) ----
function probs(w) { const n = w.reduce((a, x, i) => i ? a + x : a, 0) || 1; return w.map((x, i) => i ? x / n : 0); }
function bustIfHit(cards, w) {
  const t = total(cards); if (t.soft) return 0; const p = probs(w); let b = 0;
  for (let v = 1; v <= 10; v++) if (t.total + v > 21) b += p[v]; return b;
}
// dealer final-total distribution from the upcard (hits soft 17). peeked = dealer already checked for blackjack.
function dealerOdds(upcard, w, peeked = true) {
  const p = probs(w), u = upcard[0] === 'A' ? 1 : val(upcard), memo = new Map();
  const rec = (hard, ace, n) => { // returns {t17..t21, d22, bust}
    const tot = ace && hard + 10 <= 21 ? hard + 10 : hard, soft = ace && hard + 10 <= 21;
    if (tot > 21) return tot === 22 ? { d22: 1, bust: 0, made: 0 } : { d22: 0, bust: 1, made: 0 };
    if (tot > 17 || (tot === 17 && !soft)) return { d22: 0, bust: 0, made: 1 };
    const k = hard + ':' + ace + ':' + (n < 2 ? n : 2); if (memo.has(k)) return memo.get(k);
    let q = p; if (n === 1 && peeked && (u === 1 || u === 10)) { q = p.slice(); if (u === 1) q[10] = 0; else q[1] = 0; const s = q.reduce((a, x) => a + x, 0) || 1; q = q.map(x => x / s); }
    const out = { d22: 0, bust: 0, made: 0 };
    for (let v = 1; v <= 10; v++) { if (!q[v]) continue; const r = rec(hard + v, ace || v === 1, n + 1); out.d22 += q[v] * r.d22; out.bust += q[v] * r.bust; out.made += q[v] * r.made; }
    memo.set(k, out); return out;
  };
  return rec(u, u === 1, 1);
}
module.exports = { recommend, bustIfHit, dealerOdds };
