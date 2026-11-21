'use strict';
// Beginner stats: a player's own best-hand description and win odds vs N random opponent hands.
// Never looks at opponents' real hole cards - only the player's own two cards, the board and how many opponents are still in.
const { bestHand } = require('./engine');
const RANKS = '23456789TJQKA', SUITS = 'shdc';
const NAME = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const PL = ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'Jacks', 'Queens', 'Kings', 'Aces'];
const SHORT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const toInt = c => RANKS.indexOf(c[0]) * 4 + SUITS.indexOf(c[1]);

// ---- fast 5..7 card evaluator over ints (rank = c>>2, suit = c&3); returns a comparable number ----
function topBits(mask, n) { let v = 0, k = 0; for (let r = 12; r >= 0 && k < n; r--) if (mask & (1 << r)) { v = v * 16 + r; k++; } while (k < n) { v *= 16; k++; } return v; }
function straightHigh(mask) { const m = mask | ((mask >> 12) & 1 ? 0 : 0); for (let r = 12; r >= 4; r--) if (((mask >> (r - 4)) & 31) === 31) return r; if ((mask & 0b1000000001111) === 0b1000000001111) return 3; return -1; }
const C = 16 ** 5;
function fastScore(cards, n) {
  const cnt = new Array(13).fill(0), sm = [0, 0, 0, 0], sc = [0, 0, 0, 0]; let all = 0;
  for (let i = 0; i < n; i++) { const c = cards[i], r = c >> 2, s = c & 3; cnt[r]++; sm[s] |= 1 << r; sc[s]++; all |= 1 << r; }
  let fs = -1; for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const h = straightHigh(sm[fs]); if (h >= 0) return 8 * C + h * 16 ** 4; }
  let q = -1, t = -1, t2 = -1, p1 = -1, p2 = -1;
  for (let r = 12; r >= 0; r--) { const k = cnt[r]; if (k === 4) q = r; else if (k === 3) { if (t < 0) t = r; else if (t2 < 0) t2 = r; } else if (k === 2) { if (p1 < 0) p1 = r; else if (p2 < 0) p2 = r; } }
  if (q >= 0) return 7 * C + q * 16 ** 4 + topBits(all & ~(1 << q), 1) * 16 ** 3;
  if (t >= 0 && (t2 >= 0 || p1 >= 0)) return 6 * C + t * 16 ** 4 + Math.max(t2, p1) * 16 ** 3;
  if (fs >= 0) return 5 * C + topBits(sm[fs], 5);
  const sh = straightHigh(all); if (sh >= 0) return 4 * C + sh * 16 ** 4;
  if (t >= 0) return 3 * C + t * 16 ** 4 + topBits(all & ~(1 << t), 2) * 16 ** 2;
  if (p2 >= 0) return 2 * C + p1 * 16 ** 4 + p2 * 16 ** 3 + topBits(all & ~(1 << p1) & ~(1 << p2), 1) * 16 ** 2;
  if (p1 >= 0) return 1 * C + p1 * 16 ** 4 + topBits(all & ~(1 << p1), 3) * 16;
  return topBits(all, 5);
}

// ---- equity: exact when cheap (heads-up on turn/river), else Monte Carlo; runs in small async chunks ----
function equityJob(hole, board, opps, { sims = 10000, chunkMs = 8, rand = Math.random } = {}) {
  opps = Math.max(1, Math.min(opps | 0, 19));
  const h = hole.map(toInt), b = board.map(toInt), used = new Set(h.concat(b)), rest = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  const mine = new Array(7), opp = new Array(7); let win = 0, n = 0;
  const exact = opps === 1 && b.length >= 4;
  return new Promise(resolve => {
    if (exact) { // enumerate every river card (if needed) and every opponent hand
      const rivers = b.length === 5 ? [null] : rest; let ri = 0;
      const step = () => {
        const end = Date.now() + chunkMs;
        while (ri < rivers.length && Date.now() < end) {
          const rv = rivers[ri++], bb = rv == null ? b : b.concat(rv), k = bb.length;
          for (let i = 0; i < k; i++) { mine[i] = bb[i]; opp[i] = bb[i]; }
          mine[k] = h[0]; mine[k + 1] = h[1]; const ms = fastScore(mine, 7);
          for (let i = 0; i < rest.length; i++) { const a = rest[i]; if (a === rv) continue; for (let j = i + 1; j < rest.length; j++) { const c = rest[j]; if (c === rv) continue;
            opp[k] = a; opp[k + 1] = c; const os = fastScore(opp, 7); win += ms > os ? 1 : ms === os ? 0.5 : 0; n++; } }
        }
        if (ri < rivers.length) setImmediate(step); else resolve({ eq: win / n, n, exact: true });
      };
      return step();
    }
    const need = 5 - b.length + opps * 2, d = rest.slice();
    const step = () => {
      const end = Date.now() + chunkMs;
      while (n < sims && Date.now() < end) {
        for (let i = 0; i < need; i++) { const j = i + Math.floor(rand() * (d.length - i)); const x = d[i]; d[i] = d[j]; d[j] = x; }
        for (let i = 0; i < b.length; i++) mine[i] = b[i]; for (let i = b.length; i < 5; i++) mine[i] = d[i - b.length];
        for (let i = 0; i < 5; i++) opp[i] = mine[i];
        mine[5] = h[0]; mine[6] = h[1]; const ms = fastScore(mine, 7);
        let best = 0, ties = 0, k = 5 - b.length;
        for (let o = 0; o < opps; o++) { opp[5] = d[k]; opp[6] = d[k + 1]; k += 2; const v = fastScore(opp, 7); if (v > best) { best = v; ties = 0; } if (v === best) ties++; }
        if (ms > best) win += 1; else if (ms === best) win += 1 / (ties + 1);
        n++;
      }
      if (n < sims) setImmediate(step); else resolve({ eq: win / n, n, exact: false });
    };
    step();
  });
}

// ---- words ----
function preflopName(hole) {
  const [a, b] = hole.map(c => RANKS.indexOf(c[0])).sort((x, y) => y - x);
  if (a === b) return `Pocket ${PL[a]}`;
  return `${SHORT[a]}-${SHORT[b]} ${hole[0][1] === hole[1][1] ? 'suited' : 'offsuit'}`;
}
function niceName(name) { // engine names -> beginner friendly
  return name.replace(/^One Pair, (.+)$/, 'Pair of $1').replace(/^Two Pair, (.+) and (.+)$/, 'Two Pair, $1 and $2').replace(/^Three of a Kind, (.+)$/, 'Three $1').replace(/^Four of a Kind, (.+)$/, 'Four $1');
}
function drawNote(hole, board) {
  if (board.length < 3 || board.length > 4) return '';
  const all = hole.concat(board), notes = [];
  for (const s of SUITS) { const k = all.filter(c => c[1] === s).length; if (k === 4 && hole.some(c => c[1] === s)) notes.push('flush draw'); }
  const ints = all.map(toInt); if (fastScore(ints, ints.length) < 4 * C) { // no straight yet: count straight outs
    const has = new Set(all.map(c => RANKS.indexOf(c[0]))), hr = new Set(hole.map(c => RANKS.indexOf(c[0]))); let outs = 0;
    for (let r = 0; r < 13; r++) { if (has.has(r)) continue; const m = new Set(has); m.add(r); for (let hi = 12; hi >= 3; hi--) { const run = hi === 3 ? [12, 0, 1, 2, 3] : [hi - 4, hi - 3, hi - 2, hi - 1, hi]; if (run.every(x => m.has(x)) && run.some(x => hr.has(x))) { outs++; break; } } }
    if (outs >= 2) notes.push('open-ended straight draw'); else if (outs === 1) notes.push('gutshot straight draw');
  }
  return notes.join(' + ');
}
function describe(hole, board) {
  if (!hole || hole.length !== 2) return null;
  if (board.length < 3) return { hand: preflopName(hole), draw: '' };
  return { hand: niceName(bestHand(hole.concat(board)).name), draw: drawNote(hole, board) };
}
function hint(eq, opps) { const ratio = eq * (opps + 1); return ratio >= 1.25 ? 'strong' : ratio >= 0.85 ? 'fair' : 'weak'; }

module.exports = { equityJob, describe, hint, fastScore, toInt, preflopName };
