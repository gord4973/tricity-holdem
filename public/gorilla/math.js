// GORILLA - original play-money slot math. 3 reels x 3 rows, 27 ways (left to right, all 3 reels).
// Shared by the browser machine and the Node tests/simulator (UMD). All amounts are in CREDITS.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GorillaMath = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ---- symbols (all original) ----
  const SYM = {
    SB: { name: 'Silverback', kind: 'high' }, MK: { name: 'Tribal Mask', kind: 'high' }, TC: { name: 'Toucan', kind: 'high' }, ID: { name: 'Stone Idol', kind: 'high' },
    BN: { name: 'Banana Bunch', kind: 'low' }, RB: { name: 'Ruby', kind: 'low' }, EM: { name: 'Emerald', kind: 'low' }, SP: { name: 'Sapphire', kind: 'low' },
    WD: { name: 'Wild (reel 2, multiplies)', kind: 'wild' }, CN: { name: 'Prize Coin', kind: 'coin' }, DR: { name: 'Jungle Drum', kind: 'scatter' },
  };
  // pay per WAY for 3 of a kind, in units of (total bet / 27) -> e.g. 27 ways of Silverback at "40" = 40 x bet
  const PAY = { SB: 68, MK: 47, TC: 35, ID: 29, BN: 21, RB: 16.5, EM: 14.5, SP: 11 };
  const DENOMS = [1, 2, 5, 10, 25, 100]; // cents per credit
  const BETS = [50, 100, 150, 250, 500]; // credits per spin
  const WILD_MULT = { base: [[2, 40], [3, 25], [5, 18], [10, 10], [15, 4], [25, 3]], free: [[3, 30], [5, 28], [10, 22], [15, 12], [25, 8]] };
  const COIN_VAL = [[0.5, 30], [1, 30], [2, 18], [3, 10], [5, 6], [10, 3.5], [25, 1.2], [50, 0.3]]; // x total bet
  const LOCK_P = 0.35, SMASH_P = 0.28; // chance a coin lands locked; chance the gorilla smashes locks on a spin with no wild
  const WHEEL = [ // 16 wedges shown on the wheel; `w` = chance weight (not every wedge is equally likely)
    { id: 'c10', label: '10× BET', x: 10, w: 16 }, { id: 'thunder', label: 'THUNDER SPINS', fs: 10, w: 13 }, { id: 'c15', label: '15× BET', x: 15, w: 13 }, { id: 'bronze', label: 'BRONZE', x: 25, jp: 1, w: 12 },
    { id: 'c20', label: '20× BET', x: 20, w: 10 }, { id: 'thunder', label: 'THUNDER SPINS', fs: 10, w: 13 }, { id: 'c10', label: '10× BET', x: 10, w: 16 }, { id: 'silver', label: 'SILVER', x: 75, jp: 2, w: 4 },
    { id: 'c30', label: '30× BET', x: 30, w: 6 }, { id: 'thunder', label: 'THUNDER SPINS', fs: 10, w: 13 }, { id: 'c15', label: '15× BET', x: 15, w: 13 }, { id: 'gold', label: 'GOLD', x: 250, jp: 3, w: 0.8 },
    { id: 'c20', label: '20× BET', x: 20, w: 10 }, { id: 'thunder', label: 'THUNDER SPINS', fs: 10, w: 13 }, { id: 'bronze', label: 'BRONZE', x: 25, jp: 1, w: 12 }, { id: 'titan', label: 'TITAN', x: 1000, jp: 4, w: 0.06 },
  ];
  // ---- reel strips (built once from fixed counts with a fixed shuffle so every device has the same machine) ----
  const COUNTS = [
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 6, DR: 4 },
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 5, DR: 4, WD: 3 },
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 6, DR: 4 },
  ];
  const FREE_COUNTS = [COUNTS[0], { SB: 4, MK: 5, TC: 6, ID: 6, BN: 7, RB: 7, EM: 8, SP: 8, CN: 5, DR: 1, WD: 7 }, COUNTS[2]];
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function buildStrip(counts, seed) {
    const r = mulberry32(seed), s = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) s.push(k);
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    // no two scatters/wilds within 3 of each other on the same reel (so one per reel window at most)
    for (let pass = 0; pass < 50; pass++) { let moved = false; for (let i = 0; i < s.length; i++) for (const k of ['DR', 'WD']) if (s[i] === k) for (let d = 1; d <= 2; d++) { const j = (i + d) % s.length; if (s[j] === k) { const m = (j + 5 + Math.floor(r() * (s.length - 7))) % s.length; [s[j], s[m]] = [s[m], s[j]]; moved = true; } } if (!moved) break; }
    return s;
  }
  const STRIPS = COUNTS.map((c, i) => buildStrip(c, 9001 + i * 77)), FREE_STRIPS = FREE_COUNTS.map((c, i) => buildStrip(c, 4242 + i * 31));
  // ---- RNG ----
  function cryptoRng() { const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : (typeof require === 'function' ? require('crypto').webcrypto : null); const buf = new Uint32Array(64); let i = 64; return () => { if (i >= 64) { g.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; }; }
  const pickW = (rng, table) => { let t = 0; for (const [, w] of table) t += w; let x = rng() * t; for (const [v, w] of table) { if ((x -= w) < 0) return v; } return table[table.length - 1][0]; };
  // ---- one spin ----
  // returns { grid[reel][row] = {s, mult?, coin?, locked?}, stops, ways:[{s, ways, pay}], wildMult, coins:{count,paid,value,smashed}, drums, bonus, win }
  function spin(bet, rng, opts = {}) {
    const free = !!opts.free, strips = free ? FREE_STRIPS : STRIPS, stops = [], grid = [];
    for (let r = 0; r < 3; r++) { const st = opts.stops ? opts.stops[r] : Math.floor(rng() * strips[r].length); stops.push(st); const col = []; for (let y = 0; y < 3; y++) col.push({ s: strips[r][(st + y) % strips[r].length] }); grid.push(col); }
    if (opts.force) opts.force(grid);
    for (const col of grid) for (const c of col) {
      if (c.s === 'WD' && c.mult == null) c.mult = pickW(rng, free ? WILD_MULT.free : WILD_MULT.base);
      if (c.s === 'CN' && c.coin == null) { c.coin = Math.round(pickW(rng, COIN_VAL) * bet); c.locked = c.locked != null ? c.locked : rng() < LOCK_P; }
    }
    const unit = bet / 27, ways = []; let win = 0;
    const wildSum = grid[1].reduce((a, c) => a + (c.s === 'WD' ? c.mult : 0), 0);
    for (const s in PAY) {
      const c1 = grid[0].filter(c => c.s === s).length, c2 = grid[1].filter(c => c.s === s).length, c3 = grid[2].filter(c => c.s === s).length;
      if (!c1 || !c3 || !(c2 || wildSum)) continue;
      const w = c1 * (c2 + wildSum) * c3, pay = Math.round(PAY[s] * unit * w); ways.push({ s, ways: c1 * (c2 + grid[1].filter(c => c.s === 'WD').length) * c3, mult: c2 + wildSum > c2 ? (c2 + wildSum) / (c2 + grid[1].filter(c => c.s === 'WD').length) : 1, pay }); win += pay;
    }
    // prize coins: 3+ coins anywhere pay their values; locked coins pay only if the gorilla smashes the locks
    const coins = []; grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'CN') coins.push({ r, y, value: c.coin, locked: c.locked }); }));
    const anyLocked = coins.some(c => c.locked), hasWild = grid[1].some(c => c.s === 'WD');
    const smashed = anyLocked && coins.length >= 3 && (hasWild || rng() < SMASH_P);
    if (smashed) for (const c of coins) c.locked = false;
    let coinPay = 0; if (coins.length >= 3) for (const c of coins) if (!c.locked) coinPay += c.value;
    win += coinPay;
    const drums = grid.reduce((a, col) => a + (col.some(c => c.s === 'DR') ? 1 : 0), 0);
    return { grid, stops, ways, wildMult: wildSum, coins: { list: coins, count: coins.length, pay: coinPay, smashed }, drums, bonus: drums >= 3, win, free };
  }
  function spinWheel(bet, rng, forceIdx) {
    let idx = forceIdx; if (idx == null) { let t = 0; for (const w of WHEEL) t += w.w; let x = rng() * t; idx = WHEEL.length - 1; for (let i = 0; i < WHEEL.length; i++) if ((x -= WHEEL[i].w) < 0) { idx = i; break; } }
    const w = WHEEL[idx]; return { idx, wedge: w, win: w.x ? w.x * bet : 0, freeSpins: w.fs || 0 };
  }
  // free games: N spins on the wild-rich strips; 3 drums add +4 spins (max 40)
  function freeGames(bet, rng, n = 8) { const spins = []; let total = 0, left = n, played = 0; while (left > 0 && played < 40) { const s = spin(bet, rng, { free: true }); spins.push(s); total += s.win; left--; played++; if (s.bonus) left += 4; } return { spins, win: total }; }
  // full "play": base spin + bonus resolution (what a simulator needs)
  function play(bet, rng) { const s = spin(bet, rng); let total = s.win, wheel = null, fg = null; if (s.bonus) { wheel = spinWheel(bet, rng); total += wheel.win; if (wheel.freeSpins) { fg = freeGames(bet, rng, wheel.freeSpins); total += fg.win; } } return { spin: s, wheel, fg, total }; }
  const tier = (win, bet) => win >= 50 * bet ? 'epic' : win >= 25 * bet ? 'mega' : win >= 10 * bet ? 'big' : win > 0 ? 'win' : '';
  function simulate(n, rng = cryptoRng(), bet = 50) {
    let wagered = 0, won = 0, hits = 0, bonuses = 0, sq = 0, maxX = 0, smash = 0, coinPays = 0, fsWin = 0, wheelWin = 0; const tiers = { big: 0, mega: 0, epic: 0 }, wedges = {};
    for (let i = 0; i < n; i++) { const p = play(bet, rng); wagered += bet; won += p.total; const x = p.total / bet; sq += x * x; if (x > maxX) maxX = x; if (p.total > 0) hits++; if (p.spin.bonus) { bonuses++; wedges[p.wheel.wedge.id] = (wedges[p.wheel.wedge.id] || 0) + 1; wheelWin += p.wheel.win; if (p.fg) fsWin += p.fg.win; } if (p.spin.coins.smashed) smash++; coinPays += p.spin.coins.pay; const t = tier(p.total, bet); if (tiers[t] != null) tiers[t]++; }
    const rtp = won / wagered, mean = rtp, sd = Math.sqrt(sq / n - mean * mean);
    return { spins: n, rtp, hitRate: hits / n, sd, bonusEvery: bonuses ? n / bonuses : null, maxX, smashRate: smash / n, coinShare: coinPays / won, bonusShare: (wheelWin + fsWin) / won, tiers, wedges };
  }
  return { SYM, PAY, DENOMS, BETS, WILD_MULT, COIN_VAL, WHEEL, STRIPS, FREE_STRIPS, COUNTS, spin, spinWheel, freeGames, play, simulate, tier, mulberry32, cryptoRng };
});
