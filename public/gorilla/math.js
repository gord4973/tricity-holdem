// GORILLA v5 - original play-money slot math. Base: 3 reels x 3 rows, 27 ways. Bonus: Temple Drum Wheel -> Jungle / Fury / Inferno Spins
// (Fury and Inferno grow the reels to 4-7 rows, up to 343 ways). Shared by the browser machine and the Node tests/simulator (UMD).
// All amounts are in CREDITS. Every gorilla intervention (punch-nudge, thunder wild, lock smash, awakening, growing reels, +1 spins)
// is decided HERE before anything animates, so the gorilla only acts out a result that is already in the RTP.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GorillaMath = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ---- symbols (all original) ----
  const SYM = {
    SB: { name: 'Silverback', kind: 'high' }, MK: { name: 'Tribal Mask', kind: 'high' }, TC: { name: 'Toucan', kind: 'high' }, ID: { name: 'Stone Idol', kind: 'high' },
    BN: { name: 'Banana Bunch', kind: 'low' }, RB: { name: 'Ruby', kind: 'low' }, EM: { name: 'Emerald', kind: 'low' }, SP: { name: 'Sapphire', kind: 'low' },
    WD: { name: 'Wild (reel 2, multiplies)', kind: 'wild' }, CN: { name: 'Prize Coin', kind: 'coin' }, DR: { name: 'Jungle Drum', kind: 'scatter' }, FI: { name: 'Firefist (+1 spin)', kind: 'fist' },
  };
  // pay per WAY for 3 of a kind, in units of (total bet / 27)
  const PAY_SCALE = 1.095; // trimmed from 1.25 so a 1-in-85 bonus still lands near 95.4% RTP
  const PAY0 = { SB: 66.57, MK: 46.01, TC: 34.19, ID: 28.37, BN: 20.55, RB: 16.14, EM: 14.14, SP: 10.73 };
  const PAY = Object.fromEntries(Object.entries(PAY0).map(([k, v]) => [k, +(v * PAY_SCALE).toFixed(2)]));
  const DENOMS = [1, 2, 5, 10, 25, 100]; // cents per credit
  const BETS = [50, 100, 150, 250, 500]; // credits per spin
  // wild multipliers 2x-16x. Base: most wilds are plain (x1); a multiplied wild that wins is a THUNDER WILD (roar, then the stamp).
  const WILD_MULT = { base: [[1, 75], [2, 12], [3, 6], [5, 4], [8, 2], [10, 1], [16, 0.5]], free: [[2, 40], [3, 30], [5, 18], [8, 8], [10, 3], [16, 1]] };
  const COIN_VAL = [[0.5, 30], [1, 30], [2, 18], [3, 10], [5, 6], [10, 3.5], [25, 1.05], [50, 0.15]]; // base coins, x total bet
  const COIN_FREE = [[0.5, 24], [1, 30], [2, 20], [3, 12], [5, 7], [10, 3], [25, 0.8]];
  const COIN_INF = [[0.5, 22], [1, 28], [2, 20], [3, 12], [5, 8], [10, 4], [25, 'bronze', 1.0], [75, 'silver', 0.2]]; // Inferno: jackpot coins
  const LOCK_P = 0.35, SMASH_P = 0.28; // base: chance a coin lands locked; chance the gorilla smashes the locks on a spin with no wild
  const NUDGE_P = 0.06;   // chance of a gorilla punch-nudge when a losing base spin is one stop away from a win
  const RESPIN_P = 0.30, RESPIN_MAX = 5; // coin respins: each respin lands a new coin with this chance (and goes again), up to 5
  // ---- Temple Drum Wheel: 12 wedges, index 0 at the top, clockwise ----
  const JP = { bronze: 25, silver: 75, gold: 250, titan: 1000 };
  const WHEEL = [
    { id: 'titan', label: 'TITAN', x: JP.titan, jp: 4, w: 0.25 }, { id: 'jungle', label: 'JUNGLE SPINS', mode: 'jungle', w: 16 }, { id: 'c8', label: '8× BET', x: 8, w: 15 },
    { id: 'fury', label: 'FURY SPINS', mode: 'fury', w: 10 }, { id: 'bronze', label: 'BRONZE', x: JP.bronze, jp: 1, w: 9 }, { id: 'jungle', label: 'JUNGLE SPINS', mode: 'jungle', w: 16 },
    { id: 'inferno', label: 'INFERNO SPINS', mode: 'inferno', w: 6 }, { id: 'silver', label: 'SILVER', x: JP.silver, jp: 2, w: 4 }, { id: 'c15', label: '15× BET', x: 15, w: 11 },
    { id: 'fury', label: 'FURY SPINS', mode: 'fury', w: 10 }, { id: 'jungle', label: 'JUNGLE SPINS', mode: 'jungle', w: 16 }, { id: 'gold', label: 'GOLD', x: JP.gold, jp: 3, w: 1.2 },
  ];
  const LOCKS = { 1: ['inferno', 'silver', 'gold', 'titan'], 2: ['gold', 'titan'], 3: [] }; // chained wedges by drum tier
  const LOCK_X = 6;                         // a chained wedge pays 6x bet
  const AWAKEN = { 1: 0.15, 2: 0.10 };      // the gorilla's roar breaks the chains: tier +1
  const TRIG = { 1: 0.0048, 2: 0.041 };     // 1 or 2 drums may trigger the wheel; 3 always do (tuned for ~1 in 85)
  const METER_MAX = 300;                    // Rampage Meter: each drum that lands without a trigger adds a notch; full = guaranteed wheel (2-drum tier)
  // ---- free spins ----
  const FS_START = 7, FS_MAX = 50, MAX_X = 5000;
  const GROW_P = 0.30, GROW_ROWS = [[4, 50], [5, 28], [6, 15], [7, 7]]; // Fury/Inferno: chance the gorilla heaves the reels taller on a spin
  const STACK_SYMS = [['SB', 6], ['MK', 8], ['TC', 10], ['ID', 11], ['BN', 15], ['RB', 16], ['EM', 17], ['SP', 17]];
  const STACK_K = [[0, 45], [2, 25], [3, 16], [4, 8], [5, 4], [6, 2]]; // Totem Stacks: cells per 3x3 that turn into one symbol before evaluation
  const MODES = { jungle: { name: 'JUNGLE SPINS', grow: 0, coinsAll: false }, fury: { name: 'FURY SPINS', grow: GROW_P, coinsAll: false }, inferno: { name: 'INFERNO SPINS', grow: GROW_P, coinsAll: true } };
  // ---- reel strips (built once from fixed counts with a fixed shuffle so every device has the same machine) ----
  const COUNTS = [
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 6, DR: 4 },
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 5, DR: 4, WD: 3 },
    { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 10, SP: 10, CN: 6, DR: 4 },
  ];
  const JUNGLE_COUNTS = [{ SB: 4, MK: 5, TC: 6, ID: 6, BN: 9, RB: 10, EM: 10, SP: 11, FI: 1 }, { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 8, EM: 9, SP: 9, CN: 4, WD: 4, FI: 1 }, { SB: 4, MK: 5, TC: 6, ID: 6, BN: 9, RB: 10, EM: 10, SP: 11, FI: 1 }];
  const INFERNO_COUNTS = [{ SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 9, SP: 10, CN: 4, FI: 1 }, { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 8, EM: 9, SP: 9, CN: 4, WD: 4, FI: 1 }, { SB: 4, MK: 5, TC: 6, ID: 6, BN: 8, RB: 9, EM: 9, SP: 10, CN: 4, FI: 1 }];
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function buildStrip(counts, seed) {
    const r = mulberry32(seed), s = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) s.push(k);
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    // no two scatters/wilds/fists within 3 of each other on the same reel (so one per reel window at most)
    for (let pass = 0; pass < 50; pass++) { let moved = false; for (let i = 0; i < s.length; i++) for (const k of ['DR', 'WD', 'FI']) if (s[i] === k) for (let d = 1; d <= 2; d++) { const j = (i + d) % s.length; if (s[j] === k) { const m = (j + 5 + Math.floor(r() * (s.length - 7))) % s.length; [s[j], s[m]] = [s[m], s[j]]; moved = true; } } if (!moved) break; }
    return s;
  }
  const STRIPS = COUNTS.map((c, i) => buildStrip(c, 9001 + i * 77));
  const MODE_STRIPS = { jungle: JUNGLE_COUNTS.map((c, i) => buildStrip(c, 4242 + i * 31)), inferno: INFERNO_COUNTS.map((c, i) => buildStrip(c, 5151 + i * 29)) };
  MODE_STRIPS.fury = MODE_STRIPS.jungle; const FREE_STRIPS = MODE_STRIPS.jungle;
  // ---- RNG ----
  function cryptoRng() { const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : (typeof require === 'function' ? require('crypto').webcrypto : null); const buf = new Uint32Array(64); let i = 64; return () => { if (i >= 64) { g.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; }; }
  const pickW = (rng, table) => { let t = 0; for (const e of table) t += e[e.length - 1]; let x = rng() * t; for (const e of table) { if ((x -= e[e.length - 1]) < 0) return e; } return table[table.length - 1]; };
  const pickV = (rng, table) => pickW(rng, table)[0];
  const COIN_SCALE = 0.876; // base-game coins only; bonus-mode coin values keep their feel
  const coinCell = (rng, bet, table, scale) => { const e = pickW(rng, table), c = { s: 'CN', coin: Math.round(e[0] * bet * (scale == null ? (table === COIN_VAL ? COIN_SCALE : 1) : scale)) }; if (typeof e[1] === 'string') c.jp = e[1]; return c; };
  const ways = rows => rows[0] * rows[1] * rows[2];
  // ways pay of a plain symbol grid - used to find punch-nudge targets
  function waysWin(grid) { let n = 0; const wild = grid[1].some(c => c.s === 'WD'); for (const s in PAY) { const a = grid[0].some(c => c.s === s), c3 = grid[2].some(c => c.s === s); if (a && c3 && (wild || grid[1].some(c => c.s === s))) n++; } return n; }
  // GORILLA PUNCH: a base spin that stops one position away from a 3-of-a-kind is sometimes punched one stop (dir +1 = reel drops one symbol, -1 = climbs one)
  function nudgeFor(stops, strips, rng) {
    const cand = [];
    for (let r = 0; r < 3; r++) for (const d of [1, -1]) { const L = strips[r].length, st2 = (stops[r] - d + L) % L, g = stops.map((st, k) => [0, 1, 2].map(y => ({ s: strips[k][((k === r ? st2 : st) + y) % strips[k].length] })));
      const preCol = [0, 1, 2, 3].map(y => strips[r][(stops[r] - 1 + y + L) % L]);
      if (g[r].some(c => /DR|CN/.test(c.s)) || preCol.some(x => /DR|CN|WD/.test(x))) continue; if (waysWin(g)) cand.push({ r, dir: d, stop: st2 }); }
    return cand.length && rng() < NUDGE_P ? cand[Math.floor(rng() * cand.length)] : null; }
  // coin respins: one reel column respins, each landing a new coin with RESPIN_P (pays it, goes again), up to RESPIN_MAX
  function respins(rng, bet, r, table, force) { const steps = []; let pay = 0;
    for (let i = 0; i < RESPIN_MAX; i++) { const hit = force != null ? i < force : rng() < RESPIN_P; if (!hit) { steps.push(null); break; } const c = coinCell(rng, bet, table); steps.push(c); pay += c.coin; }
    return { r, steps, pay }; }
  // ---- one spin ----
  // opts: mode ('jungle'|'fury'|'inferno' = bonus spin), rows (3-7, bonus only), stack (Totem Stacks), meter ({n}) Rampage Meter state,
  //       force(grid) debug override, forceNudge, forceRespin (n coins), forceTrigger (tier) - debug/test only
  // returns { grid[reel][row] = {s, mult?, coin?, jp?, locked?}, rows, ways, wildMult, thunder, coins, respin, drums, bonus:{tier,via}|null, meter, fists, stack, pre, win, nudge }
  function spin(bet, rng, opts = {}) {
    const mode = opts.mode || null, free = !!mode, strips = free ? MODE_STRIPS[mode] : STRIPS, R = free ? (opts.rows || 3) : 3, rows = [R, R, R], stops = [], grid = [];
    for (let r = 0; r < 3; r++) stops.push(opts.stops ? opts.stops[r] : Math.floor(rng() * strips[r].length));
    let nudge = null;
    if (!free && !opts.force && !opts.noNudge) { const g0 = stops.map((st, k) => [0, 1, 2].map(y => ({ s: strips[k][(st + y) % strips[k].length] }))), drums = g0.filter(col => col.some(c => c.s === 'DR')).length;
      if (!waysWin(g0) && drums < 3) { const n = nudgeFor(stops, strips, rng); if (n) { nudge = { r: n.r, dir: n.dir, preStop: stops[n.r] }; stops[n.r] = n.stop; } } }
    if (opts.forceNudge) { const n = nudgeFor(stops, strips, () => 0); if (n) { nudge = { r: n.r, dir: n.dir, preStop: stops[n.r] }; stops[n.r] = n.stop; } }
    for (let r = 0; r < 3; r++) { const st = stops[r], col = []; for (let y = 0; y < R; y++) col.push({ s: strips[r][(st + y) % strips[r].length] }); grid.push(col); }
    if (nudge) { const r = nudge.r, L = strips[r].length; nudge.pre = [0, 1, 2].map(y => ({ s: strips[r][(nudge.preStop + y) % L] })); }
    if (opts.force) opts.force(grid);
    const ctable = mode === 'inferno' ? COIN_INF : free ? COIN_FREE : COIN_VAL;
    for (const col of grid) for (let y = 0; y < col.length; y++) { const c = col[y];
      if (c.s === 'WD' && c.mult == null) c.mult = pickV(rng, free ? WILD_MULT.free : WILD_MULT.base);
      if (c.s === 'CN' && c.coin == null) { const k = coinCell(rng, bet, ctable); c.coin = k.coin; if (k.jp) c.jp = k.jp; if (!free) c.locked = c.locked != null ? c.locked : rng() < LOCK_P; } }
    if (nudge) { const col = grid[nudge.r]; nudge.pre = nudge.dir > 0 ? [col[1], col[2], nudge.pre[2]] : [nudge.pre[0], col[0], col[1]]; }
    // Totem Stacks (bonus spins): before evaluation some cells turn into one paying symbol (wilds, coins and fists stay)
    let stack = null, pre = null;
    if (free && opts.stack) { const k = Math.round(pickV(rng, STACK_K) * R / 3); if (k > 0) { const s = pickV(rng, STACK_SYMS), cells = []; const all = []; grid.forEach((col, r) => col.forEach((c, y) => { if (!/WD|CN|FI/.test(c.s)) all.push([r, y]); }));
        for (let i = 0; i < k && all.length; i++) { const j = Math.floor(rng() * all.length); cells.push(all.splice(j, 1)[0]); }
        if (cells.length) { pre = grid.map(col => col.map(c => ({ ...c }))); for (const [r, y] of cells) grid[r][y] = { s }; stack = { s, cells }; } } }
    // ways
    const unit = bet / 27, wl = []; let win = 0;
    const wildSum = grid[1].reduce((a, c) => a + (c.s === 'WD' ? c.mult : 0), 0), wildN = grid[1].filter(c => c.s === 'WD').length;
    for (const s in PAY) {
      const c1 = grid[0].filter(c => c.s === s).length, c2 = grid[1].filter(c => c.s === s).length, c3 = grid[2].filter(c => c.s === s).length;
      if (!c1 || !c3 || !(c2 || wildSum)) continue;
      const w = c1 * (c2 + wildSum) * c3, pay = Math.round(PAY[s] * unit * w); wl.push({ s, ways: c1 * (c2 + wildN) * c3, mult: c2 + wildSum > c2 + wildN ? (c2 + wildSum) / (c2 + wildN) : 1, wild: wildN > 0, pay }); win += pay;
    }
    // THUNDER WILD (base): a multiplied wild that is part of a win lands plain; the gorilla roars and the multiplier stamps on
    let thunder = null; if (!free && wildSum > wildN && wl.some(w => w.wild)) { const y = grid[1].findIndex(c => c.s === 'WD' && c.mult > 1); thunder = { r: 1, y, mult: grid[1][y].mult }; }
    // prize coins. Base: 3+ coins anywhere pay; locked coins pay only if the gorilla smashes the locks. Bonus: every coin pays.
    const coins = []; grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'CN') coins.push({ r, y, value: c.coin, locked: !!c.locked, jp: c.jp }); }));
    let smashed = false, coinPay = 0, respin = null;
    if (!free) { const anyLocked = coins.some(c => c.locked), hasWild = wildN > 0; smashed = anyLocked && coins.length >= 3 && (hasWild || rng() < SMASH_P);
      if (smashed) for (const c of coins) c.locked = false; if (coins.length >= 3) for (const c of coins) if (!c.locked) coinPay += c.value; }
    else for (const c of coins) coinPay += c.value;
    if (coinPay > 0 || opts.forceRespin != null) { // the reel holding the most (then the biggest) paying coins respins
      const per = [0, 1, 2].map(r => coins.filter(c => c.r === r && !c.locked)), best = [0, 1, 2].sort((a, b) => per[b].length - per[a].length || Math.max(0, ...per[b].map(c => c.value)) - Math.max(0, ...per[a].map(c => c.value)))[0];
      respin = respins(rng, bet, best, ctable, opts.forceRespin); }
    win += coinPay + (respin ? respin.pay : 0);
    const drums = grid.reduce((a, col) => a + (col.some(c => c.s === 'DR') ? 1 : 0), 0), fists = free ? grid.reduce((a, col) => a + col.filter(c => c.s === 'FI').length, 0) : 0;
    // Temple Drum Wheel trigger: 3 drums always, 1-2 drums sometimes, or a full Rampage Meter
    let bonus = null, meter = null;
    if (!free) { if (opts.forceTrigger) bonus = { tier: opts.forceTrigger, via: 'force' };
      else if (drums >= 3) bonus = { tier: 3, via: 'drums' }; else if (drums && rng() < TRIG[drums]) bonus = { tier: drums, via: 'drums' };
      if (opts.meter) { const m = opts.meter, before = m.n; let full = false; if (!bonus && drums) { m.n = Math.min(METER_MAX, m.n + drums); if (m.n >= METER_MAX) { full = true; m.n = 0; bonus = { tier: 2, via: 'meter' }; } } meter = { before, n: m.n, added: bonus && !full ? 0 : drums, full, max: METER_MAX }; } }
    return { grid, rows, waysN: ways(rows), stops, ways: wl, wildMult: wildSum, thunder, coins: { list: coins, count: coins.length, pay: coinPay, smashed }, respin, drums, bonus, meter, fists, stack, pre, win, free, mode, nudge };
  }
  // ---- Temple Drum Wheel ----
  function spinWheel(bet, rng, tier = 3, o = {}) {
    const start = tier; let awaken = false; if (o.forceAwaken || (o.forceAwaken !== false && tier < 3 && rng() < AWAKEN[tier])) { tier = Math.min(3, tier + 1); awaken = true; }
    let idx = o.forceIdx; if (idx == null) { const e = pickW(rng, WHEEL.map((w, i) => [i, w.w])); idx = e[0]; }
    const w = WHEEL[idx], locked = LOCKS[tier].includes(w.id), win = locked ? LOCK_X * bet : w.x ? w.x * bet : 0;
    return { idx, wedge: w, start, tier, awaken, locked, locks: LOCKS[tier], win, mode: locked ? null : w.mode || null };
  }
  // ---- a whole bonus round (decided up front; the machine animates it spin by spin) ----
  // o.rich: debug/screenshots - first spin grows to 7 rows with a Firefist and coins
  function bonusRound(bet, rng, mode, o = {}) { const M = MODES[mode], spins = []; let total = 0, left = FS_START, played = 0, added = 0, capped = false;
    while (left > 0 && played < FS_MAX) { const rich = o.rich && played === 0, R = rich ? (M.grow ? 7 : 3) : (M.grow && rng() < M.grow ? pickV(rng, GROW_ROWS) : 3);
      const force = rich ? g => { g[0][R - 1] = { s: 'FI' }; g[1][R > 3 ? 3 : 1] = { s: 'CN' }; if (mode === 'inferno') { g[0][R > 3 ? 4 : 0] = { s: 'CN' }; g[2][1] = { s: 'CN' }; } } : null;
      const s = spin(bet, rng, { mode, rows: R, stack: true, force, forceRespin: rich ? 2 : undefined }); left--; played++;
      const add = Math.min(s.fists, FS_MAX - played - left); s.added = Math.max(0, add); left += s.added; added += s.added;
      if (total + s.win >= MAX_X * bet) { s.win = MAX_X * bet - total; capped = true; } total += s.win; s.left = left; s.played = played; s.total = total; spins.push(s); if (capped) break; }
    return { mode, spins, win: total, played, added, capped }; }
  // full "play": base spin + wheel + bonus round (what the simulator needs). state = { meter: {n} } persists between spins
  function play(bet, rng, state = { meter: { n: 0 } }) { const s = spin(bet, rng, { meter: state.meter }); let total = s.win, wheel = null, fg = null;
    if (s.bonus) { wheel = spinWheel(bet, rng, s.bonus.tier); total += wheel.win; if (wheel.mode) { fg = bonusRound(bet, rng, wheel.mode); total += fg.win; } }
    return { spin: s, wheel, fg, total }; }
  const tier = (win, bet) => win >= 50 * bet ? 'monster' : win >= 25 * bet ? 'mega' : win >= 10 * bet ? 'big' : win > 0 ? 'win' : '';
  // simulator with a per-feature RTP breakdown
  function simulate(n, rng = cryptoRng(), bet = 50) {
    const st = { meter: { n: 0 } }, B = { ways: 0, nudge: 0, thunder: 0, coins: 0, respinBase: 0, wheelCredit: 0, wheelLocked: 0, jackpot: 0, jungle: 0, fury: 0, inferno: 0, meterWheel: 0 };
    let won = 0, hits = 0, bonuses = 0, viaMeter = 0, sq = 0, maxX = 0, nudges = 0, thunders = 0, smash = 0, respinsN = 0, awakens = 0, fsSpins = 0, fsRounds = 0, grows = 0, fsN = 0; const tiers = { big: 0, mega: 0, monster: 0 }, wedges = {}, modes = { jungle: 0, fury: 0, inferno: 0 }, tiersW = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < n; i++) { const p = play(bet, rng, st), s = p.spin; won += p.total; const x = p.total / bet; sq += x * x; if (x > maxX) maxX = x; if (p.total > 0) hits++;
      const wayPay = s.ways.reduce((a, w) => a + w.pay, 0); if (s.nudge) { nudges++; B.nudge += wayPay; } else if (s.thunder) { thunders++; B.thunder += wayPay; } else B.ways += wayPay;
      B.coins += s.coins.pay; if (s.respin) { respinsN++; B.respinBase += s.respin.pay; } if (s.coins.smashed) smash++;
      if (s.bonus) { bonuses++; tiersW[s.bonus.tier]++; if (s.bonus.via === 'meter') viaMeter++; const w = p.wheel; if (w.awaken) awakens++; wedges[w.wedge.id + (w.locked ? '-locked' : '')] = (wedges[w.wedge.id + (w.locked ? '-locked' : '')] || 0) + 1;
        let bw = w.win; if (w.locked) B.wheelLocked += w.win; else if (w.wedge.jp) B.jackpot += w.win; else B.wheelCredit += w.win;
        if (p.fg) { B[p.fg.mode] += p.fg.win; bw += p.fg.win; modes[p.fg.mode]++; fsRounds++; fsSpins += p.fg.played; for (const k of p.fg.spins) { fsN++; if (k.rows[0] > 3) grows++; } }
        if (s.bonus.via === 'meter') B.meterWheel += bw; }
      const t = tier(p.total, bet); if (tiers[t] != null) tiers[t]++; }
    const T = n * bet, rtp = won / T, sd = Math.sqrt(sq / n - rtp * rtp), share = {}; for (const k in B) share[k] = B[k] / T;
    return { spins: n, rtp, hitRate: hits / n, sd, bonusEvery: n / bonuses, meterEvery: viaMeter ? n / viaMeter : null, maxX, nudgeEvery: n / nudges, thunderEvery: n / thunders, smashRate: smash / n, respinEvery: n / respinsN, awakenRate: awakens / bonuses, avgFreeSpins: fsSpins / fsRounds, growRate: grows / fsN, share, tiers, wedges, modes, wheelTiers: tiersW };
  }
  return { NUDGE_P, waysWin, SYM, PAY, PAY_SCALE, DENOMS, BETS, WILD_MULT, COIN_VAL, COIN_FREE, COIN_INF, COIN_SCALE, JP, WHEEL, LOCKS, LOCK_X, AWAKEN, TRIG, METER_MAX, MODES, FS_START, GROW_ROWS, RESPIN_MAX, STRIPS, FREE_STRIPS, MODE_STRIPS, COUNTS, spin, spinWheel, bonusRound, play, simulate, tier, ways, mulberry32, cryptoRng };
});
