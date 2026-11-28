// MITSUBISHI MADNESS - original play-money slot math (UMD: browser window.MadnessMath, Node require()).
// Base: 5 reels x 3 rows, 243 ways. Symbols are the 5 current Mitsubishi models (2026 + 2027 combined, no years), paying in order of
// top-trim MSRP (RVR lowest ... Outlander PHEV highest = jackpot symbol). Every feature is decided HERE before anything animates,
// so the cabinet only acts out a result that is already counted in the RTP. All amounts are in BET UNITS (the game shows them as credits: 1 unit = 50 credits x denomination).
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MadnessMath = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ---- symbols, low -> high (top-trim MSRP, Mitsubishi Canada, Nov 2026) ----
  const SYM = {
    RV: { name: 'RVR', msrp: 35998, kind: 'car' }, EC: { name: 'Eclipse Cross', msrp: 38898, kind: 'car' }, OU: { name: 'Outlander', msrp: 50998, kind: 'car' },
    EV: { name: 'Eclipse Sportback EV', msrp: 54098, kind: 'car' }, PH: { name: 'Outlander PHEV', msrp: 63048, kind: 'car' },
    KY: { name: 'Smart Key', kind: 'low' }, TI: { name: 'Performance Tire', kind: 'low' },
    WD: { name: 'Madness Wild', kind: 'wild' }, FL: { name: 'Checkered Flag', kind: 'scatter' }, PL: { name: 'Charge Plug', kind: 'plug' },
  };
  const CARS = ['RV', 'EC', 'EV', 'OU', 'PH']; // t125u pay order set by Gord: RVR < Eclipse Cross < Sportback EV < Outlander < Outlander PHEV
  const LOWS = ['KY', 'TI'];          // t123u: low "garage" symbols (like card ranks on real 243-ways slots)
  const PAYSYMS = [...LOWS, ...CARS];              // every symbol that pays on a way, low -> high
  // t123u PAYTABLE - the single source of truth. Credits paid PER WINNING WAY at the 50-credit base bet (1 bet unit) for 3 / 4 / 5 of a kind.
  // Everything else (banner, WIN meter, paytable screen, tests) derives from PAY via wayPay(): pay = PAYC / 50 x bet units x wild mult.
  // 5-of-a-kind on one way: PHEV 15x the total bet, Outlander 8x, Sportback EV 5x, Eclipse Cross 3x, RVR 2x, tire 1.2x, smart key 1x; 3-of-a-kind 0.2x to 1x (PHEV).
  const PAYC = { KY: [10, 20, 50], TI: [10, 25, 60], RV: [15, 40, 100], EC: [15, 50, 150], EV: [20, 75, 250], OU: [25, 100, 400], PH: [50, 200, 750] };
  const BASE_CR = 50;
  const PAY = Object.fromEntries(Object.entries(PAYC).map(([k, v]) => [k, v.map(x => x / BASE_CR)]));
  // pay of ONE way of `len` x `sym` at `bet` units with combined wild multiplier `mult` (and free-spin progressive `prog`) - used by evalWays and the UI
  const wayPay = (sym, len, bet, mult = 1, prog = 1) => PAY[sym][len - 3] * bet * mult * prog;
  const BETS = [1, 2, 3, 5, 10]; // credits per spin (243 ways)
  const JP = { mini: 20, minor: 50, major: 200, grand: 1000 }; // x bet: MINI (RVR) / MINOR (ECLIPSE) / MAJOR (OUTLANDER) / GRAND (PHEV)
  const JP_NAME = { mini: 'RVR MINI', minor: 'ECLIPSE MINOR', major: 'OUTLANDER MAJOR', grand: 'PHEV GRAND' };
  const WILD_MULT = { base: [[1, 82], [2, 13], [3, 5]], turbo: [[1, 30], [2, 40], [3, 20], [5, 8], [10, 2]] };
  const DRIFT_P = 0.038;            // base: a car drifts across one of reels 2-4 and leaves it fully WILD
  const FS_DRIFT = { turbo: 0, nitro: 0.38, madness: 0.42 };
  const FS_START = { turbo: 8, nitro: 8, madness: 10 }, FS_RETRIG = 5, FS_MAX = 50, MADNESS_MULT_MAX = 10;
  const GEAR_UP = { turbo: { p: 0.10, to: 'nitro', add: 2 }, nitro: { p: 0.08, to: 'madness', add: 2 } }; // mid-round upgrade, once per round
  const MODES = { turbo: { name: 'TURBO SPINS', wildMult: true, drift: 0, prog: false }, nitro: { name: 'NITRO SPINS', wildMult: true, drift: FS_DRIFT.nitro, prog: false }, madness: { name: 'MADNESS SPINS', wildMult: true, drift: FS_DRIFT.madness, prog: true } };
  const METER_MAX = 150;            // Madness Meter: every flag that lands without a trigger adds a notch; full = guaranteed wheel
  const GRAND_ROW = 1;              // 5 Outlander PHEVs on the centre row = PHEV GRAND jackpot
  // ---- Madness Wheel: 12 wedges, index 0 at the top, clockwise ----
  const WHEEL = [
    { id: 'grand', label: 'PHEV GRAND', jp: 'grand', w: 0.2 }, { id: 'turbo', label: 'TURBO SPINS', feat: 'turbo', w: 15 }, { id: 'c10', label: '10× BET', x: 10, w: 13 },
    { id: 'rally', label: 'RALLY RACE', feat: 'rally', w: 14 }, { id: 'mini', label: 'RVR MINI', jp: 'mini', w: 9 }, { id: 'charge', label: 'PHEV CHARGE', feat: 'charge', w: 11 },
    { id: 'nitro', label: 'NITRO SPINS', feat: 'nitro', w: 10 }, { id: 'major', label: 'OUTLANDER MAJOR', jp: 'major', w: 0.8 }, { id: 'offroad', label: 'S-AWC CHALLENGE', feat: 'offroad', w: 12 },
    { id: 'c25', label: '25× BET', x: 25, w: 6 }, { id: 'madness', label: 'MADNESS SPINS', feat: 'madness', w: 4 }, { id: 'minor', label: 'ECLIPSE MINOR', jp: 'minor', w: 3 },
  ];
  const LOCKS = { 1: ['grand', 'major', 'madness'], 2: ['grand'], 3: [] }; // locked wedges by flag tier (3 / 4 / 5 flags)
  const LOCK_X = 5, REV_UP = { 1: 0.16, 2: 0.10 };                       // locked wedge pays 5x; REV UP (engine roar) breaks the locks: tier + 1
  // ---- Rally Race: you pick a car, it finishes 1st-4th ----
  const RALLY = [[1, 30, 18], [2, 15, 30], [3, 8, 32], [4, 4, 20]]; // [place, x bet, weight]
  const NITRO_FINISH = 0.25;        // a 1st place can be a NITRO FINISH (x2)
  // ---- S-AWC Off-Road Challenge: 5 stages, pick a trail, each clear pays, STUCK ends it (S-AWC rescues once at 50%) ----
  const OFFROAD = { stages: 5, stuck: [0.10, 0.20, 0.28, 0.35, 0.42], prize: [[2, 30], [3, 28], [4, 20], [5, 12], [8, 7], [10, 3]], rescue: 0.5, summit: 20 };
  const TERRAIN = ['GRAVEL', 'MUD', 'SNOW', 'ROCKS', 'SAND'];
  // ---- PHEV Charging: tap to charge; bursts of 3-9 km; a POWER SURGE can stop it; 72 km = FULL CHARGE. 1 km = 1x bet. ----
  const CHARGE = { max: 72, burst: [[3, 10], [4, 14], [5, 16], [6, 16], [7, 14], [8, 10], [9, 8]], surge: 0.25, regen: 0.10, minKm: 10 };
  // ---- reel strips: fixed counts, fixed shuffle (same machine on every device) ----
  // 100-stop strips; specials: flags 4/100, plugs 4/100 on reels 1/3/5, wilds 4/100 on reels 2-4.
  // t125u: strips alternate which symbols are common (reels 1/3/5 vs 2/4) so matches across adjacent reels are rarer - fewer ways hit, each pays
  // a real multiple of the bet (RTP ~95%, a win or feature on ~1 in 4 spins).
  const COUNTS = [
    { KY: 5, TI: 28, RV: 3, EC: 20, EV: 30, OU: 3, PH: 3, FL: 4, PL: 4 },
    { KY: 23, TI: 4, RV: 20, EC: 3, EV: 3, OU: 22, PH: 17, FL: 4, WD: 4 },
    { KY: 22, TI: 22, RV: 22, EC: 13, EV: 3, OU: 3, PH: 3, FL: 4, WD: 4, PL: 4 },
    { KY: 22, TI: 3, RV: 20, EC: 3, EV: 10, OU: 22, PH: 12, FL: 4, WD: 4 },
    { KY: 22, TI: 22, RV: 19, EC: 20, EV: 3, OU: 3, PH: 3, FL: 4, PL: 4 },
  ];
  const FREE_COUNTS = [
    { KY: 9, TI: 28, RV: 3, EC: 20, EV: 30, OU: 3, PH: 3, FL: 4 },
    { KY: 23, TI: 4, RV: 20, EC: 3, EV: 3, OU: 22, PH: 17, FL: 4, WD: 4 },
    { KY: 26, TI: 22, RV: 22, EC: 13, EV: 3, OU: 3, PH: 3, FL: 4, WD: 4 },
    { KY: 22, TI: 3, RV: 20, EC: 3, EV: 10, OU: 22, PH: 12, FL: 4, WD: 4 },
    { KY: 26, TI: 22, RV: 19, EC: 20, EV: 3, OU: 3, PH: 3, FL: 4 },
  ];
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function buildStrip(counts, seed) {
    const r = mulberry32(seed), s = []; for (const k in counts) for (let i = 0; i < counts[k]; i++) s.push(k);
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    // specials (flag / plug / wild) never within 2 stops of the same special: at most one per reel window
    for (let pass = 0; pass < 80; pass++) { let moved = false; for (let i = 0; i < s.length; i++) for (const k of ['FL', 'PL', 'WD']) if (s[i] === k) for (let d = 1; d <= 2; d++) { const j = (i + d) % s.length; if (s[j] === k) { const m = (j + 5 + Math.floor(r() * (s.length - 7))) % s.length; [s[j], s[m]] = [s[m], s[j]]; moved = true; } } if (!moved) break; }
    return s;
  }
  const STRIPS = COUNTS.map((c, i) => buildStrip(c, 7272 + i * 101));
  const FREE_STRIPS = FREE_COUNTS.map((c, i) => buildStrip(c, 3030 + i * 53));
  function cryptoRng() { const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : (typeof require === 'function' ? require('crypto').webcrypto : null); const buf = new Uint32Array(64); let i = 64; return () => { if (i >= 64) { g.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; }; }
  const pickW = (rng, table) => { let t = 0; for (const e of table) t += e[e.length - 1]; let x = rng() * t; for (const e of table) { if ((x -= e[e.length - 1]) < 0) return e; } return table[table.length - 1]; };
  const pickV = (rng, table) => pickW(rng, table)[0];
  // ---- 243-ways evaluation with per-cell wild multipliers (a way through multiplied wilds multiplies) ----
  function evalWays(grid, bet) {
    const out = []; let win = 0;
    for (const s of PAYSYMS) {
      let prod = 1, plain = 1, len = 0; const cells = [];
      for (let r = 0; r < grid.length; r++) { let m = 0, n = 0; grid[r].forEach((c, y) => { if (c.s === s) { m += 1; n++; cells.push([r, y]); } else if (c.s === 'WD') { m += c.mult || 1; n++; cells.push([r, y]); } });
        if (!m) break; prod *= m; plain *= n; len++; }
      if (len >= 3) { const pay = wayPay(s, len, bet, prod); out.push({ s, len, ways: plain, mult: prod / plain, pay, cells: cells.filter(([r]) => r < len) }); win += pay; }
    }
    return { ways: out, win };
  }
  const count = (grid, s) => grid.reduce((a, col) => a + col.filter(c => c.s === s).length, 0);
  // ---- one spin ----
  // opts: mode ('turbo'|'nitro'|'madness' = free spin), meter {n}, force(grid) debug override, forceDrift (reel), noDrift, forceTrigger, noTrigger, progMult
  function spin(bet, rng, opts = {}) {
    const mode = opts.mode || null, free = !!mode, strips = free ? FREE_STRIPS : STRIPS, grid = [], stops = [];
    for (let r = 0; r < 5; r++) { const L = strips[r].length, st = Math.floor(rng() * L); stops.push(st); grid.push([0, 1, 2].map(y => ({ s: strips[r][(st + y) % L] }))); }
    if (opts.force) opts.force(grid);
    const wtab = free ? WILD_MULT.turbo : WILD_MULT.base;
    for (const col of grid) for (const c of col) if (c.s === 'WD' && c.mult == null) c.mult = pickV(rng, wtab);
    // DRIFT WILD: a car drifts across one (free spins: up to two) of reels 2-4; the reel turns fully wild before the ways are counted
    let drift = null; const pre = grid.map(col => col.map(c => ({ ...c })));
    const dp = free ? MODES[mode].drift : DRIFT_P;
    if (opts.forceDrift != null || (!opts.noDrift && !opts.force && rng() < dp)) {
      const reelsD = []; const first = opts.forceDrift != null ? opts.forceDrift : 1 + Math.floor(rng() * 3); reelsD.push(first);
      if (free && opts.forceDrift == null && rng() < 0.25) { const o = [1, 2, 3].filter(r => r !== first); reelsD.push(o[Math.floor(rng() * 2)]); }
      for (const r of reelsD) grid[r] = [0, 1, 2].map(() => ({ s: 'WD', mult: 1, drift: true }));
      drift = { reels: reelsD };
    }
    let { ways, win } = evalWays(grid, bet);
    const prog = opts.progMult || 1; if (prog > 1) { ways.forEach(w => { w.pay *= prog; }); win *= prog; }
    // PHEV GRAND: five Outlander PHEVs on the centre row (no wilds)
    let jackpot = null; if (!free && grid.every(col => col[GRAND_ROW].s === 'PH')) { jackpot = { id: 'grand', win: JP.grand * bet }; win += jackpot.win; }
    const flags = count(grid, 'FL'), plugs = count(grid, 'PL');
    let trigger = null;
    if (!free) {
      if (opts.forceTrigger) trigger = opts.forceTrigger;
      else if (!opts.noTrigger) { if (flags >= 3) trigger = { type: 'wheel', tier: Math.min(3, flags - 2), via: 'flags' }; else if (plugs >= 3) trigger = { type: 'charge', via: 'plugs' }; }
      const m = opts.meter; let meter = null;
      if (m) { if (!trigger && flags) { m.n = Math.min(METER_MAX, m.n + flags); meter = { add: flags, n: m.n }; if (m.n >= METER_MAX) { m.n = 0; trigger = { type: 'wheel', tier: 1, via: 'meter' }; meter.full = true; } } }
      return { grid, pre: drift ? pre : null, stops, ways, win, flags, plugs, drift, jackpot, trigger, meter, mode: null };
    }
    const retrig = flags >= 3 ? FS_RETRIG : 0;
    return { grid, pre: drift ? pre : null, stops, ways, win, flags, plugs, drift, jackpot: null, retrig, mode, prog };
  }
  // ---- Madness Wheel ----
  function spinWheel(bet, rng, tier, opts = {}) {
    let t = tier, revUp = false;
    if (opts.forceRevUp != null ? opts.forceRevUp : (REV_UP[t] && rng() < REV_UP[t])) { revUp = true; t = Math.min(3, t + 1); }
    const idx = opts.forceIdx != null ? opts.forceIdx : WHEEL.indexOf(pickV(rng, WHEEL.map(w => [w, w.w])));
    const wedge = WHEEL[idx], locked = LOCKS[t].includes(wedge.id);
    let win = 0, feat = null;
    if (locked) win = LOCK_X * bet; else if (wedge.jp) win = JP[wedge.jp] * bet; else if (wedge.x) win = wedge.x * bet; else feat = wedge.feat;
    return { idx, wedge, tier: t, startTier: tier, revUp, locked, win, feat, locks: LOCKS[t] };
  }
  // ---- free spins round (TURBO / NITRO / MADNESS) with retriggers and one possible GEAR UP ----
  function bonusRound(bet, rng, mode0, opts = {}) {
    let mode = mode0, left = FS_START[mode0], played = 0, win = 0, prog = 1, gearUp = null; const spins = [];
    const g = GEAR_UP[mode0], gearAt = (opts.forceGearUp || (g && rng() < g.p)) ? 2 + Math.floor(rng() * Math.max(1, FS_START[mode0] - 3)) : -1;
    while (left > 0 && played < FS_MAX) {
      if (played === gearAt && GEAR_UP[mode]) { const G = GEAR_UP[mode]; gearUp = { at: played, from: mode, to: G.to, add: G.add }; mode = G.to; left += G.add; }
      const s = spin(bet, rng, { mode, progMult: MODES[mode].prog ? prog : 1, force: opts.rich && played === 0 ? richForce : null });
      left--; played++;
      if (s.retrig) left = Math.min(left + s.retrig, FS_MAX - played);
      s.left = left; s.modeNow = mode; spins.push(s); win += s.win;
      if (MODES[mode].prog && s.win > 0 && prog < MADNESS_MULT_MAX) prog++;
    }
    return { mode: mode0, finalMode: mode, spins, played, win, gearUp };
  }
  const richForce = g => { for (let r = 0; r < 5; r++) g[r][1] = { s: r === 2 ? 'WD' : 'EV' }; };
  // ---- Rally Race ----
  function rally(bet, rng, opts = {}) {
    const e = opts.forcePlace ? RALLY.find(x => x[0] === opts.forcePlace) : pickW(rng, RALLY);
    const nitro = e[0] === 1 && (opts.forceNitro != null ? opts.forceNitro : rng() < NITRO_FINISH);
    const x = e[1] * (nitro ? 2 : 1);
    return { place: e[0], x, nitro, win: x * bet };
  }
  // ---- S-AWC Off-Road Challenge ----
  function offroad(bet, rng, opts = {}) {
    const stages = []; let win = 0, rescued = false, cleared = 0;
    for (let i = 0; i < OFFROAD.stages; i++) {
      const terrain = TERRAIN[i]; let stuck = opts.forceStuck != null ? opts.forceStuck === i : rng() < OFFROAD.stuck[i];
      if (stuck && !rescued && (opts.forceRescue != null ? opts.forceRescue : rng() < OFFROAD.rescue)) { rescued = true; const p = pickV(rng, OFFROAD.prize); stages.push({ terrain, prize: p, rescue: true }); win += p * bet; cleared++; continue; }
      if (stuck) { stages.push({ terrain, stuck: true }); break; }
      const p = pickV(rng, OFFROAD.prize); stages.push({ terrain, prize: p }); win += p * bet; cleared++;
    }
    const summit = cleared === OFFROAD.stages; if (summit) win += OFFROAD.summit * bet;
    return { stages, cleared, summit, rescued, win };
  }
  // ---- PHEV Charging ----
  function charge(bet, rng, opts = {}) {
    const bursts = []; let km = 0, surge = false;
    while (km < CHARGE.max) {
      if (bursts.length && km >= CHARGE.minKm && !opts.forceFull && (opts.forceSurgeAt != null ? km >= opts.forceSurgeAt : rng() < CHARGE.surge)) { surge = true; break; }
      let b = pickV(rng, CHARGE.burst); const regen = rng() < CHARGE.regen; if (regen) b *= 2;
      b = Math.min(b, CHARGE.max - km); km += b; bursts.push({ km: b, total: km, regen });
    }
    const full = km >= CHARGE.max;
    return { bursts, km, full, surge, win: km * bet, max: CHARGE.max };
  }
  // ---- feature dispatcher (wheel outcome) ----
  function feature(bet, rng, feat, opts = {}) {
    if (MODES[feat]) return { kind: 'spins', ...bonusRound(bet, rng, feat, opts) };
    if (feat === 'rally') return { kind: 'rally', ...rally(bet, rng, opts) };
    if (feat === 'offroad') return { kind: 'offroad', ...offroad(bet, rng, opts) };
    if (feat === 'charge') return { kind: 'charge', ...charge(bet, rng, opts) };
    return null;
  }
  // full play (simulator): base spin + wheel/charge + feature
  function play(bet, rng, state = { meter: { n: 0 } }) {
    const s = spin(bet, rng, { meter: state.meter }); let total = s.win, wheel = null, f = null;
    if (s.trigger) { if (s.trigger.type === 'charge') { f = feature(bet, rng, 'charge'); total += f.win; }
      else { wheel = spinWheel(bet, rng, s.trigger.tier); total += wheel.win; if (wheel.feat) { f = feature(bet, rng, wheel.feat); total += f.win; } } }
    return { spin: s, wheel, f, total };
  }
  const tier = (win, bet) => win >= 60 * bet ? 'madness' : win >= 25 * bet ? 'mega' : win >= 10 * bet ? 'big' : win > 0 ? 'win' : '';
  function simulate(n, rng = cryptoRng(), bet = 1) {
    const st = { meter: { n: 0 } }, B = { ways: 0, drift: 0, grand5: 0, wheelCredit: 0, wheelLocked: 0, jackpot: 0, turbo: 0, nitro: 0, madness: 0, rally: 0, offroad: 0, charge: 0 };
    let won = 0, hits = 0, sq = 0, maxX = 0, wheels = 0, charges = 0, viaMeter = 0, drifts = 0, full72 = 0, revUps = 0, gearUps = 0, fsRounds = 0, fsSpins = 0, kmSum = 0;
    const tiers = { big: 0, mega: 0, madness: 0 }, feats = {};
    for (let i = 0; i < n; i++) { const p = play(bet, rng, st), s = p.spin; won += p.total; const x = p.total / bet; sq += x * x; if (x > maxX) maxX = x; if (p.total > 0) hits++;
      if (s.drift) { drifts++; B.drift += s.win - (s.jackpot ? s.jackpot.win : 0); } else B.ways += s.win - (s.jackpot ? s.jackpot.win : 0); if (s.jackpot) B.grand5 += s.jackpot.win;
      if (s.trigger && s.trigger.via === 'meter') viaMeter++;
      if (p.wheel) { wheels++; if (p.wheel.revUp) revUps++; if (p.wheel.locked) B.wheelLocked += p.wheel.win; else if (p.wheel.wedge.jp) B.jackpot += p.wheel.win; else B.wheelCredit += p.wheel.win; }
      if (p.f) { const k = p.f.kind === 'spins' ? p.f.mode : p.f.kind; feats[k] = (feats[k] || 0) + 1; B[k] += p.f.win;
        if (p.f.kind === 'charge') { charges++; kmSum += p.f.km; if (p.f.full) full72++; }
        if (p.f.kind === 'spins') { fsRounds++; fsSpins += p.f.played; if (p.f.gearUp) gearUps++; } }
      const t = tier(p.total, bet); if (tiers[t] != null) tiers[t]++; }
    const T = n * bet, rtp = won / T, share = {}; for (const k in B) share[k] = +(B[k] / T).toFixed(4);
    return { spins: n, rtp, hitRate: hits / n, sd: Math.sqrt(sq / n - rtp * rtp), maxX, wheelEvery: n / wheels, chargeEvery: n / charges, meterEvery: viaMeter ? n / viaMeter : null, driftEvery: n / drifts,
      avgKm: kmSum / charges, fullChargeRate: full72 / charges, revUpRate: revUps / wheels, gearUpRate: fsRounds ? gearUps / fsRounds : 0, avgFreeSpins: fsSpins / fsRounds, share, tiers, feats };
  }
  const api = { SYM, CARS, LOWS, PAYSYMS, PAYC, BASE_CR, PAY, wayPay, BETS, JP, JP_NAME, WILD_MULT, DRIFT_P, FS_START, FS_RETRIG, FS_MAX, GEAR_UP, MODES, METER_MAX, WHEEL, LOCKS, LOCK_X, REV_UP, RALLY, NITRO_FINISH, OFFROAD, TERRAIN, CHARGE, COUNTS, FREE_COUNTS, STRIPS, FREE_STRIPS,
    evalWays, spin, spinWheel, bonusRound, rally, offroad, charge, feature, play, tier, simulate, mulberry32, cryptoRng, buildStrip };
  return api;
});
