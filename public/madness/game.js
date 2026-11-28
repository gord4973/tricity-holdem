// MITSUBISHI MADNESS - play-money slot cabinet: 5x3 / 243 ways of Mitsubishi models, DRIFT WILDS, BOOST gauge (flag meter), Madness Wheel
// (REV UP lock-break), TURBO / NITRO / MADNESS SPINS (GEAR UP), RALLY RACE, S-AWC CHALLENGE, PHEV CHARGE (72 km = 72x bet).
// Engine patterns carried over from GORILLA: guarded full-screen takeovers (seq token, done guards, stall caps, orphan watchdog),
// spin() try/catch -> recoverScreen(), single-fire taps, auto-advance on every interactive step, ?debug=1 forces, window.G test API.
(function () {
'use strict';
const M = window.MadnessMath, A = window.MadAudio, FX = window.MadFX, SC = window.MadScenes;
const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search), DEBUG = qs.has('debug');
if (DEBUG) window.__madSpeed = +(qs.get('speed') || 1);
const SPD = () => window.__madSpeed || 1;
const sleep = ms => new Promise(r => setTimeout(r, ms * SPD()));
const fmt = u => '$' + (Math.round(u * CPU * (window.__denom || 1)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // u = bet units
const usd = u => fmt(u);
const glog = (kind, o = {}) => { try { fetch('/madness/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, ...o, ua: navigator.userAgent.slice(0, 120) }) }).catch(() => {}); } catch (e) {} };
// ---------------- state ----------------
const KEY = 'madnessState1';
const st = Object.assign({ cents: 0, denom: 1, bet: 0, lastWin: 0, ticketNo: 5000, inserted: 0, played: 0, meter: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
if (!(st.bet >= 0 && st.bet < M.BETS.length)) st.bet = 0;
// t118u: Gorilla-format money: a bet is 50/100/150/250/500 CREDITS, each credit is worth the chosen denomination (1¢ – $1).
// The math works in bet UNITS (1 unit = 50 credits) so the paytable/RTP are unchanged by denomination or bet size.
const DENOMS = [1, 2, 5, 10, 25, 100], CPU = 50; if (!DENOMS.includes(st.denom)) st.denom = 1; window.__denom = st.denom;
const denomTxt = d => d >= 100 ? '$' + d / 100 : d + '¢';
const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const save = () => localStorage.setItem(KEY, JSON.stringify(st));
const bet = () => M.BETS[st.bet], betCr = () => bet() * CPU, betCents = () => betCr() * st.denom, toCents = u => Math.round(u * CPU * st.denom), cr = u => Math.round(u * CPU);
let busy = false, quick = false, rng = M.cryptoRng(), forceNext = null, auto = false, curMode = null;
window.__madFx = []; const fxs = o => { o.at = performance.now(); window.__madFx.push(o); if (window.__madFx.length > 200) window.__madFx.shift(); try { const S2 = window.MadShow; if (o.kind === 'trigger' || o.kind === 'gearup' || o.kind === 'retrig') S2.bonus(o.type || o.kind); else if (o.kind === 'big' || o.kind === 'jackpot') S2.big(o.tier || 'jackpot'); else if (o.kind === 'drift') S2.reelStop(o.r, [{ s: 'WD' }]); } catch (e) {} };
// ---------------- reels ----------------
const randomSym = (r) => { const s = (curMode ? M.FREE_STRIPS : M.STRIPS)[r]; const x = s[Math.floor(Math.random() * s.length)]; return { s: x, mult: x === 'WD' && curMode ? [2, 3, 5][Math.random() * 3 | 0] : null }; };
const reels = new window.MadReels($('reelCv'), { randomSym }); window.reels = reels;
let shown = [0, 1, 2, 3, 4].map(r => [0, 1, 2].map(y => ({ s: M.STRIPS[r][(r * 5 + y * 3) % M.STRIPS[r].length] })));
reels.setGrid(shown);
FX.stageInit($('stage')); FX.pauseStage(true); FX.fxInit($('fx')); const SH = window.MadShow; SH.init($('showCv'));
// ---------------- layout (portrait cabinet) ----------------
let rowsVis = 3;
const reelsHeight = rows => Math.min(Math.round(rows * (layout.colW || 60) / 1.25), Math.round(innerHeight * .5)); // t143u: 5 rows (3,125 ways) must still leave room for the top display
function layout() {
  const vw = innerWidth, vh = innerHeight, land = vw > vh * 1.05, coarse = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('rotate', land && coarse);
  const app = $('app'), W = Math.min(vw, Math.round(vh * .78)), H = vh, k = Math.max(.8, Math.min(2.0, Math.min(W / 390, H / 844))), wide = W / H > .62;
  const fw = Math.round(wide ? W * .92 : W - 2 * Math.round(5 * k)), pad = Math.round(7 * k), rw = fw - 2 * pad, gap = Math.max(2, rw * .008), colW = (rw - 4 * gap) / 5;
  layout.colW = colW; let reelsH = reelsHeight(rowsVis); // t135u: rowsVis = 3, or 4 in NITRO (animated in between)
  const v = { '--appW': W + 'px', '--k': k.toFixed(3), '--fw': fw + 'px', '--pad': pad + 'px', '--reelsH': reelsH + 'px' };
  for (const n in v) app.style.setProperty(n, v[n]); app.classList.toggle('wide', wide);
  requestAnimationFrame(() => { reels.resize(); const a = app.getBoundingClientRect(), f = $('frame').getBoundingClientRect(); FX.setRoad(f.top - a.top - 47 * k, k); app.style.setProperty('--frameTop', (f.top - a.top) + 'px'); app.style.setProperty('--showH', Math.round(f.top - a.top + 6) + 'px'); });
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 300)); layout(); setTimeout(layout, 400);
document.fonts && document.fonts.ready.then(layout);
// ---------------- meters ----------------
const disp = { cents: st.cents, win: 0 };
function meters() { window.__denom = st.denom; $('mCash').textContent = money(disp.cents); $('mCred').textContent = Math.floor(disp.cents / st.denom).toLocaleString(); $('mBet').textContent = betCr(); $('mBetD').textContent = money(betCents()); $('mWin').textContent = cr(disp.win).toLocaleString(); $('mWinD').textContent = money(toCents(disp.win)); $('denomTxt').textContent = denomTxt(st.denom);
  const b = bet(); $('jpG').textContent = usd(M.JP.grand * b); $('jpJ').textContent = usd(M.JP.major * b); $('jpN').textContent = usd(M.JP.minor * b); $('jpM').textContent = usd(M.JP.mini * b);
  $('betDn').disabled = $('betUp').disabled = $('maxBtn').disabled = $('denomBtn').disabled = busy; $('cashBtn').disabled = busy || st.cents <= 0; $('billBtn').disabled = busy;
  const p = Math.round((st.meter || 0) / M.METER_MAX * 100); try { SH.meter(p / 100); } catch (e) {} }
function roll(key, to, ms, tick) { return new Promise(res => { const from = disp[key], t0 = performance.now(); ms *= SPD(); if (quick) ms = Math.min(ms, 250); let last = 0;
  const step = now => { const u = Math.min(1, (now - t0) / ms); disp[key] = from + (to - from) * u; meters(); if (tick && now - last > 70) { last = now; A.play('tick'); } if (u < 1) requestAnimationFrame(step); else { disp[key] = to; meters(); res(); } }; requestAnimationFrame(step); }); }
function toast(msg, ms = 1800) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), ms); }
function shake() { const m = $('frame'); m.classList.remove('shakeX'); void m.offsetWidth; m.classList.add('shakeX'); }
// ---------------- bill acceptor & ticket ----------------
async function insertBill() { if (busy) return; A.init(); busy = true; meters(); const b = $('bill'); b.classList.remove('hidden', 'go'); void b.offsetWidth; b.classList.add('go'); A.play('bill');
  await sleep(1200); b.classList.add('hidden'); st.cents += 10000; st.inserted += 10000; save(); await roll('cents', st.cents, 1000, true); A.play('coin', 4); A.play('engineStart'); busy = false; meters(); }
async function cashOut() { if (busy || st.cents <= 0) return; A.init(); busy = true; meters(); const amt = st.cents, no = ++st.ticketNo; st.cents = 0; save();
  const t = $('ticket'); t.innerHTML = `<h4>MITSUBISHI MADNESS</h4><div>CASH-OUT VOUCHER</div><div class=amt>${money(amt)}</div><div>PLAY MONEY · NO CASH VALUE</div><div>${new Date().toLocaleString()}</div><div>TICKET #${no}</div><div class=bc></div><div style="text-align:center;margin-top:4px">tap to take ticket</div>`;
  { const pr = $('cashWrap').getBoundingClientRect(); t.style.bottom = Math.max(8, innerHeight - pr.top + 10) + 'px'; } // t128u: centred above the panel, fully on screen
  t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; A.play('ticket'); await roll('cents', 0, 1200, false); disp.win = 0; busy = false; meters();
  t.onclick = () => t.classList.add('hidden'); setTimeout(() => t.classList.add('hidden'), 12000); }
// ---------------- cinematic takeover (guarded) ----------------
// Same contract as GORILLA's playTakeover after the t101u fix: one seq token per takeover, every callback checks `done`, timers cleared on end,
// tap = skip, hard cap, always resolves. The orphan watchdog below can never leave #cine on screen without an active takeover.
let tkSeq = 0, tkActive = null; window.__tkLog = [];
function cinematic(o = {}) {
  if (quick) return Promise.resolve(false);
  const el = $('cine'), my = ++tkSeq, dur = (o.dur || 2200) * SPD(); if (tkActive) tkActive.end('superseded');
  el.style.setProperty('--cineC', o.color || '#ff2040'); $('cineTitle').textContent = o.title || ''; $('cineSub').textContent = o.sub || ''; el.classList.remove('hidden', 'show');
  return new Promise(res => { let done = false, stopFx = null; const timers = [], t0 = performance.now();
    const end = why => { if (done) return; done = true; timers.forEach(clearTimeout); if (tkActive && tkActive.my === my) tkActive = null; el.onclick = null; window.__tkLog.push({ title: o.title, why, ms: Math.round(performance.now() - t0) });
      if (tkSeq === my) el.classList.remove('show'); setTimeout(() => { try { stopFx && stopFx(); } catch (e) {} if (tkSeq === my && !tkActive) el.classList.add('hidden'); res(true); }, 260); };
    tkActive = { my, end, t0, max: dur + 4000 };
    try { stopFx = FX.tunnel($('cineCv'), { color: o.color, car: o.car, bolt: o.bolt }); } catch (e) { console.warn(e); }
    if (o.snd !== false) { try { A.play(o.snd || 'rev', 1.3); A.play('whoosh'); } catch (e) {} }
    requestAnimationFrame(() => requestAnimationFrame(() => { if (done) return; el.classList.add('show'); }));
    setTimeout(() => { if (!done) el.onclick = () => end('tap'); }, 350);
    timers.push(setTimeout(() => end('clip'), dur)); timers.push(setTimeout(() => end('safety'), dur + 4000)); }); }
function clearCine(why) { const el = $('cine'); if (tkActive) { tkActive.end(why); return; } if (!el.classList.contains('hidden')) { el.classList.remove('show'); el.classList.add('hidden'); window.__tkLog.push({ why: 'watchdog:' + why }); glog('takeover-watchdog', { why }); } }
let orphanSince = 0;
setInterval(() => { const el = $('cine'), vis = !el.classList.contains('hidden');
  if (tkActive && performance.now() - tkActive.t0 > tkActive.max + 1500) { tkActive.end('watchdog-overrun'); return; }
  if (vis && !tkActive) { if (!orphanSince) orphanSince = performance.now(); else if (performance.now() - orphanSince > 1200) { orphanSince = 0; clearCine('orphan'); } } else orphanSince = 0; }, 500);
// ---------------- debug / test forces ----------------
const WIDX = id => M.WHEEL.findIndex(w => w.id === id);
function forceOf(kind) {
  const set = (g, r, y, c) => { g[r][y] = c; }, clean = g => { for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (/FL|PL|BG/.test(g[r][y].s)) g[r][y] = { s: 'RV' }; };
  const flags = n => g => { clean(g); for (let r = 0; r < n; r++) set(g, r, r % 3, { s: 'FL' }); };
  const row = (s, n, wild) => g => { clean(g); for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === s) g[r][y] = { s: s === 'RV' ? 'EC' : 'RV' }; for (let r = 0; r < n; r++) set(g, r, 1, { s }); if (wild) set(g, 2, 1, { s: 'WD', mult: wild }); };
  const F = { kind };
  const fix = cols => g => { for (let r = 0; r < 5; r++) g[r] = cols[r].map(x => typeof x === 'string' ? { s: x } : { ...x }); };
  const grids = {
    // t123u: exact single-way checks for the paytable/banner/WIN agreement test
    rv5: fix([['KY', 'RV', 'TI'], ['EC', 'RV', 'OU'], ['KY', 'RV', 'TI'], ['EC', 'RV', 'OU'], ['EV', 'RV', 'PH']]),
    rv5w: fix([['KY', 'RV', 'TI'], ['EC', 'RV', 'OU'], ['KY', { s: 'WD', mult: 2 }, 'TI'], ['EC', 'RV', 'OU'], ['EV', 'RV', 'PH']]),
    rv5x2: fix([['KY', 'RV', 'TI'], ['RV', 'RV', 'OU'], ['KY', 'RV', 'TI'], ['EC', 'RV', 'OU'], ['EV', 'RV', 'PH']]),
    plugs2: fix([['KY', 'PL', 'TI'], ['EC', 'OU', 'EV'], ['KY', 'RV', 'PL'], ['EC', 'OU', 'EV'], ['KY', 'RV', 'TI']]),
    phscatter: fix([['KY', 'RV', 'TI'], ['PH', 'EC', 'OU'], ['EV', 'PH', 'EC'], ['PH', 'OU', 'EV'], ['EC', 'PH', 'OU']]),
    noline: fix([['KY', 'RV', 'TI'], ['EC', 'OU', 'EV'], ['KY', 'RV', 'TI'], ['EC', 'OU', 'EV'], ['KY', 'RV', 'TI']]),
    ph5: fix([['KY', 'PH', 'TI'], ['EC', 'OU', 'PH'], ['KY', 'PH', 'TI'], ['PH', 'EC', 'OU'], ['EV', 'PH', 'RV']]),
    win: row('EC', 3), big: g => { row('EV', 5)(g); set(g, 1, 0, { s: 'EV' }); set(g, 3, 2, { s: 'EV' }); set(g, 2, 1, { s: 'WD', mult: 2 }); },
    mega: g => { row('PH', 5)(g); set(g, 2, 1, { s: 'WD', mult: 3 }); set(g, 0, 0, { s: 'PH' }); set(g, 1, 0, { s: 'PH' }); },
    madness: g => { row('PH', 5)(g); for (const r of [0, 1, 3, 4]) set(g, r, 0, { s: 'PH' }); set(g, 2, 1, { s: 'WD', mult: 3 }); set(g, 2, 0, { s: 'WD', mult: 2 }); },
    wild: g => { row('OU', 4)(g); set(g, 1, 1, { s: 'WD', mult: 3 }); set(g, 3, 1, { s: 'WD', mult: 2 }); },
    jackpot: g => { clean(g); for (let r = 0; r < 5; r++) set(g, r, 1, { s: 'PH' }); },
    almost: g => { clean(g); set(g, 0, 0, { s: 'FL' }); set(g, 1, 2, { s: 'FL' }); },
    almostpl: g => { clean(g); set(g, 0, 0, { s: 'PL' }); set(g, 2, 1, { s: 'PL' }); },
    almostbg: g => { clean(g); set(g, 1, 0, { s: 'BG' }); set(g, 2, 2, { s: 'BG' }); },
    drift: g => { clean(g); for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === 'WD' || g[r][y].s === 'OU') g[r][y] = { s: 'RV' }; set(g, 0, 1, { s: 'OU' }); set(g, 1, 0, { s: 'OU' }); set(g, 3, 2, { s: 'OU' }); },
    meter: g => { clean(g); set(g, 0, 1, { s: 'FL' }); },
    multi: g => { for (let r = 0; r < 5; r++) g[r] = r < 3 ? [{ s: 'RV' }, { s: 'EC' }, { s: 'OU' }] : r === 3 ? [{ s: 'EV' }, { s: 'PH' }, { s: 'EV' }] : [{ s: 'PH' }, { s: 'EV' }, { s: 'PH' }]; }, // 3 separate wins (t116u)
    boost: g => { clean(g); set(g, 1, 0, { s: 'BG' }); set(g, 2, 2, { s: 'BG' }); set(g, 3, 1, { s: 'BG' }); },
    boost2: g => { clean(g); set(g, 1, 0, { s: 'BG' }); set(g, 2, 2, { s: 'BG' }); },
    charge: g => { clean(g); set(g, 0, 0, { s: 'PL' }); set(g, 2, 1, { s: 'PL' }); set(g, 4, 2, { s: 'PL' }); },
  };
  if (grids[kind]) F.force = grids[kind];
  if (kind === 'drift') { F.drift = 2; }
  if (kind === 'meter') F.meter = true;
  if (kind === 'charge' || kind === 'full72' || kind === 'surge') { F.force = grids.charge; F.trigger = { type: 'charge', via: 'plugs' }; F.opts = kind === 'full72' ? { forceFull: true } : kind === 'surge' ? { forceSurgeAt: 30 } : {}; }
  if (/^wheel[345]$/.test(kind)) { const n = +kind[5]; F.force = flags(n); F.trigger = { type: 'wheel', tier: n - 2, via: 'flags' }; }
  { const m = /^w([123]):(\d+)$/.exec(kind); if (m) { F.force = flags(+m[1] + 2); F.trigger = { type: 'wheel', tier: +m[1], via: 'flags' }; F.idx = +m[2]; F.revUp = false; } }
  const wheelTo = (id, tier = 3, extra = {}) => { F.force = flags(tier + 2); F.trigger = { type: 'wheel', tier, via: 'flags' }; F.idx = WIDX(id); F.revUp = false; Object.assign(F, extra); };
  if (/^(turbo|nitro|rally|offroad)$/.test(kind)) wheelTo(kind);
  if (kind === 'madspins') wheelTo('madness', 3, { rich: true });
  if (kind === 'gearup') wheelTo('turbo', 3, { opts: { forceGearUp: true } });
  if (/^grow(turbo|nitro|madness)?$/.test(kind)) wheelTo(kind.slice(4) || 'turbo', 3, { opts: { forceGrow: true } }); // t143u: first free spin lands 3 flags -> the reels grow one more row
  if (kind === 'rally1') wheelTo('rally', 3, { opts: { forcePlace: 1, forceNitro: true } });
  if (kind === 'summit') wheelTo('offroad', 3, { opts: { forceStuck: -1 } });
  if (kind === 'rescue') wheelTo('offroad', 3, { opts: { forceStuck: 1, forceRescue: true } });
  if (kind === 'wcharge') wheelTo('charge', 3);
  if (kind === 'c10' || kind === 'c25') wheelTo(kind); // t141u: 10x / 25x BET wheel wedges -> BIG / MEGA bonus finale
  if (/^(grandwheel|major|minor|mini)$/.test(kind)) wheelTo(kind === 'grandwheel' ? 'grand' : kind);
  if (kind === 'boost') { F.force = grids.boost; F.trigger = { type: 'wheel', tier: M.BOOST_TIER, via: 'boost' }; }
  if (kind === 'boost2') { F.force = grids.boost2; }
  if (kind === 'almost' || kind === 'almostpl' || kind === 'almostbg') F.force = grids[kind];
  if (kind === 'revup') { F.force = flags(3); F.trigger = { type: 'wheel', tier: 1, via: 'flags' }; F.revUp = true; F.idx = WIDX('madness'); }
  if (kind === 'locked') { F.force = flags(3); F.trigger = { type: 'wheel', tier: 1, via: 'flags' }; F.revUp = false; F.idx = WIDX('major'); }
  if (kind === 'meterwheel') { F.force = grids.meter; F.meter = true; }
  return F;
}
// ---------------- spin ----------------
// t110u: the win banner (and win highlights) go away the instant a new spin is pressed / starts (base, autoplay, free spins)
function clearWinBanner() { stopWinCycle(); try { SH.clear(); } catch (e) {} const wb = $('winBanner'); wb.classList.add('hidden'); wb.textContent = ''; $('frame').classList.remove('winning'); try { reels.clearWin(); } catch (e) {} }
async function spin() {
  A.init(); exitAttract(); if (busy) { quick = true; reels.stopNow(); return; }
  clearWinBanner();
  if (st.cents < betCents()) { auto = false; $('autoBtn').classList.remove('on'); A.play('deny'); toast(st.cents > 0 ? 'Not enough credits for this bet — lower the bet or insert a bill' : 'Insert a $100 bill to play'); $('billBtn').classList.remove('pulse'); void $('billBtn').offsetWidth; $('billBtn').classList.add('pulse'); return; }
  busy = true; quick = false; meters(); $('spinBtn').classList.add('stop'); $('spinBtn').textContent = 'STOP'; A.play('spin');
  st.cents -= betCents(); st.played++; save(); disp.cents = st.cents; disp.win = 0; meters();
  const fk = forceNext; forceNext = null; const F = fk ? forceOf(fk) : {};
  if (F.meter) st.meter = M.METER_MAX - 1;
  const mt = { n: st.meter || 0 };
  const res = M.spin(bet(), rng, { force: F.force, forceDrift: F.drift, noDrift: !!F.force && F.drift == null, forceTrigger: F.trigger, meter: mt });
  st.meter = mt.n; save(); window.__lastSpin = res;
  let total = 0;
  try {
    await animateReels(res, null);
    total = await resolve(res, null);
    if (res.meter) meterPulse(res.meter);
    if (res.trigger) total += await trigger(res.trigger, F);
  } catch (e) { console.error('madness spin error', e); window.__spinErrors = (window.__spinErrors || 0) + 1; glog('spin-error', { msg: String(e && e.message || e).slice(0, 200) });
    recoverScreen(); total = Math.max(total, window.__bonusWin || 0, disp.win || 0); }
  window.__bonusWin = 0;
  window.__lastSpin = { units: total, credits: total * CPU, cents: toCents(total), bet: bet(), betCr: betCr(), betCents: betCents(), denom: st.denom }; // t122u test hook
  if (total > 0) { st.cents += toCents(total); st.lastWin = total; save(); const big = total >= 10 * bet(); await roll('cents', st.cents, big ? 1400 : 600, big); } // t141u: a big total's credits climb with coin ticks
  $('spinBtn').classList.remove('stop'); $('spinBtn').textContent = 'SPIN'; busy = false; quick = false; meters(); idleKick();
  if (st.cents < betCents() && st.cents > 0) toast('Low on credits — insert another bill or lower the bet');
  if (auto) { if (st.cents >= betCents() && !res.trigger) setTimeout(() => { if (auto && !busy) spin(); }, 450 * SPD()); else { auto = false; $('autoBtn').classList.remove('on'); } }
}
async function animateReels(res, mode) {
  curMode = mode; const grid = res.pre || res.grid; clearWinBanner();
  const fl = r => grid[r].some(c => c.s === 'FL'), pl = r => grid[r].some(c => c.s === 'PL'), bg = r => grid[r].some(c => c.s === 'BG');
  const tease = [false, false, false, false, false]; let fsoFar = 0; for (let r = 0; r < 5; r++) { if (fsoFar >= 2 && !mode) tease[r] = true; if (fl(r)) fsoFar++; }
  if (!mode && pl(0) && pl(2)) tease[4] = true; if (!mode && bg(1) && bg(2)) tease[3] = tease[4] = true; // reels always land left to right for (let r = 0; r < 3; r++) tease[r] = false;
  $('frame').classList.add('spinning'); const fast = quick ? .35 : 1; let teased = false; try { SH.spin(); } catch (e) {}
  await reels.spin(grid, { fast, tease,
    onStop: (r, cells) => { try { SH.reelStop(r, cells); if (cells.some(c => /PH|WD|FL|PL/.test(c.s)) && !quick) shake(); } catch (e) {} stopSound(r, cells); },
    onTease: () => { $('frame').classList.add('tease'); A.play('tease'); A.play('heartbeat', true); if (!teased) { teased = true; SH.tease(true); } } });
  A.play('heartbeat', false); if (teased) SH.tease(false); $('frame').classList.remove('spinning', 'tease'); let clearHot = 900;
  if (res.drift) { for (const r of res.drift.reels) { fxs({ kind: 'drift', r }); A.play('drift'); const ks = ['ev', 'phev', 'ec', 'rvr', 'out'];
      await FX.drift(reels.cellRect(r, 0) && (() => { const a = reels.cellRect(r, 0), b = reels.cellRect(r, reels.rows - 1); return { left: a.left, top: a.top, width: a.width, height: b.top + b.height - a.top }; })(), ks[Math.floor(Math.random() * ks.length)], quick ? 500 : 1300, () => { reels.transformReel(r, res.grid[r]); shake(); A.play('crack'); }); }
    toast('DRIFT WILD!', 1100); }
  // t142u: NEAR MISS (2 flags / 2 plugs / 2 boost gauges and the 3rd missed) is a big, short, non-blocking moment: SO CLOSE! over the reels with the landed
  // symbols pulsing, flashing frame, the top-display car revs then stalls, a dramatic sound. It never delays the next spin / autoplay.
  if (!mode && !res.trigger && tease.some(Boolean)) { const nm = res.flags === 2 ? ['FL', '2 CHECKERED FLAGS', 'ONE MORE FOR THE MADNESS WHEEL'] : res.plugs === 2 && pl(0) && pl(2) ? ['PL', '2 CHARGE PLUGS', 'ONE MORE FOR PHEV CHARGE'] : res.boosts === 2 ? ['BG', '2 BOOST GAUGES', 'ONE MORE FOR THE BOOSTED WHEEL'] : null;
    if (nm) { fxs({ kind: 'almost', sym: nm[0] }); nearMiss(nm[0], nm[1], nm[2], res.grid); clearHot = 1800 * SPD(); } }
  setTimeout(() => reels.hot.clear(), clearHot);
  shown = res.grid.map(col => col.map(c => ({ ...c })));
}
function nearMiss(sym, what, sub, grid) { const el = $('near'), fr = $('frame').getBoundingClientRect(), ms = 1600 * SPD() * (quick ? .5 : 1);
  const hot = []; grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === sym) hot.push([r, y]); })); try { reels.lineUp(hot, 5); } catch (e) {}
  $('nearSyms').innerHTML = hot.map(() => `<img src="/madness/art/${sym}.webp?v=5" alt="">`).join(''); $('nearSub').textContent = sub; $('nearTitle').textContent = 'SO CLOSE!';
  el.dataset.what = what; el.style.top = Math.round(fr.top + fr.height / 2) + 'px'; el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('go');
  const f = $('frame'); f.classList.remove('nearflash'); void f.offsetWidth; f.classList.add('nearflash'); A.play('nearMiss'); try { SH.nearMiss(); shake(); } catch (e) {}
  window.__near = { sym, what, at: performance.now() }; clearTimeout(nearMiss.t); nearMiss.t = setTimeout(() => { el.classList.add('hidden'); el.classList.remove('go'); f.classList.remove('nearflash'); }, ms); }
function markWins(res) { const cells = new Set(); for (const w of res.ways) for (const [r, y] of w.cells) cells.add(r + ',' + y);
  if (res.jackpot) res.grid.forEach((col, r) => cells.add(r + ',1'));
  if (res.trigger || res.retrig) res.grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'FL' || (res.trigger && res.trigger.type === 'charge' && c.s === 'PL') || (res.trigger && res.trigger.via === 'boost' && c.s === 'BG')) cells.add(r + ',' + y); }));
  if (cells.size) reels.setWin(cells, res.ways); return cells.size; }
// returns credits won on this spin (base or free)
// t116u: multiple wins are shown one by one so the total visibly adds up: first ALL winning tiles together, then each way in turn
// (its tiles incl. wilds + its path + "3× RVR · 3 WAYS · 0.70"), the WIN meter counting up way by way to the total; the cycle keeps
// going while idle and is cleared the instant SPIN is pressed (clearWinBanner).
const SYMC = { RV: '#2ab4ff', EC: '#ff9a3a', OU: '#4a8cff', EV: '#3fe06a', PH: '#ffd84a' };
let winCyc = null; window.__winCycle = null;
// t123u: ONE amount function for every way: the banner, the win cycle, the WIN meter (credits + $) and the paytable all use M.wayPay / wayAmt,
// so a single 5x RVR way at 50 credits x 10¢ reads 100 credits = $10.00 everywhere. Wild multipliers / the Madness progressive are spelled out.
const wayAmt = (w, res) => w.pay * ((res && res.prog) || 1);
const wayLabel = (w, res) => `${w.len}× ${M.SYM[w.s].name.toUpperCase()} · ${w.ways} WAY${w.ways > 1 ? 'S' : ''}${w.mult > 1 ? ' · WILD ×' + w.mult : ''}${res.prog > 1 ? ' · ×' + res.prog : ''} = ${fmt(wayAmt(w, res))}`;
function stopWinCycle() { if (winCyc) { clearInterval(winCyc.timer); winCyc.dead = true; winCyc = null; } }
function showWay(res, i, total) { const wb = $('winBanner'), ws = res.ways, w = ws[i]; reels.setWin(new Set(w.cells.map(([r, y]) => r + ',' + y)), [w]);
  wb.style.setProperty('--wc', SYMC[w.s] || '#ffd84a'); wb.innerHTML = `<i>${i + 1}/${ws.length}</i> ${wayLabel(w, res)}${total != null ? ` <b>TOTAL ${fmt(total)}</b>` : ''}`; wb.classList.remove('hidden'); }
function showAllWins(res, win) { markWins(res); const wb = $('winBanner'); wb.style.removeProperty('--wc'); wb.innerHTML = res.ways.length > 1 ? `${res.ways.length} WINS · TOTAL ${fmt(win)}` : wayLabel(res.ways[0], res); wb.classList.remove('hidden'); }
async function resolve(res, mode) {
  stopWinCycle(); const n = markWins(res); let win = res.win;
  if (res.jackpot) { await jackpotWin('grand', res.jackpot.win, 'FIVE OUTLANDER PHEVs ON THE CENTRE ROW'); const rest = win - res.jackpot.win; // t122u: the 5 PHEVs also pay their ways win on top - show it in WIN too
    if (rest > 1e-9) { showAllWins(res, win); await roll('win', disp.win + rest, 600, true); } return win; }
  if (win > 0) { const ways = res.ways.slice().sort((a, b) => b.pay - a.pay); res = Object.assign({}, res, { ways }); A.play('win', ways.length); $('frame').classList.add('winning');
    const cyc = winCyc = { res, i: 0, labels: ways.map(w => wayLabel(w, res)), total: win, timer: 0, dead: false }; window.__winCycle = { n: ways.length, labels: cyc.labels, pays: ways.map(w => wayAmt(w, res)), credits: ways.map(w => cr(wayAmt(w, res))), total: win };
    showAllWins(res, win); fxs({ kind: 'winways', n: ways.length });
    const t = M.tier(win, bet()); A.play('symWin', ways[0].s, ['win', 'big', 'mega', 'madness'].indexOf(t)); /* t131u: the top way's own symbol sound */ try { SH.win((ways.find(w => M.CARS.includes(w.s)) || ways[0]).s, '+' + fmt(win), t); } catch (e) {}
    const _t = t, step = quick ? 120 : mode ? 420 : 650, base = disp.win;
    if (t !== 'win') { await bigWin(win, t); disp.win = base + win; meters(); }
    else await sleep(quick ? 150 : 600);
    // first pass: each way in turn, WIN meter climbing way by way
    if (ways.length > 1 && !cyc.dead) { let run = 0; for (let i = 0; i < ways.length && !cyc.dead; i++) { run += wayAmt(ways[i], res); showWay(res, i, run); A.play('coin', i); if (i) A.play('symWin', ways[i].s, 0);
        if (t === 'win') await roll('win', base + Math.min(run, win), step * .8, true); else await sleep(step); }
      if (t === 'win') { disp.win = base + win; meters(); } }
    else if (t === 'win') await roll('win', base + win, Math.min(1400, 400 + win / bet() * 120), true);
    if (!cyc.dead) { showAllWins(res, win);
      // keep cycling while idle (base game); free spins move straight on
      if (!mode && ways.length > 1) { let k = -1; cyc.timer = setInterval(() => { if (cyc.dead) return; k = (k + 1) % (ways.length + 1); if (k === ways.length) showAllWins(res, win); else showWay(res, k, win); }, 1500); } }
    await sleep(quick ? 100 : mode ? 300 : 300); }
  else if (n) await sleep(400);
  return win; }
// t127u reel-stop audio (like Gorilla): each stop that CONTINUES a possible win - a symbol (or wild) on every reel from reel 1 - plays an
// escalating 'lining up' sound (revs climbing + rising tone per reel) and glows the tiles; flags / plugs / PHEVs / wilds have their own landing
// sounds; a stop that continues nothing is a plain clunk.
const lineSt = { cols: [], flags: 0, plugs: 0, boosts: 0 }; window.__stopLog = [];
function stopSound(r, cells) { if (r === 0) { lineSt.cols = []; lineSt.flags = 0; lineSt.plugs = 0; lineSt.boosts = 0; window.__stopLog = []; } lineSt.cols[r] = cells;
  const live = M.PAYSYMS.filter(s => lineSt.cols.slice(0, r + 1).every(col => col && col.some(c => c.s === s || c.s === 'WD')) && lineSt.cols[0].some(c => c.s === s));
  const n = live.length ? r + 1 : 0, top = live.length ? live[live.length - 1] : null, heavy = cells.some(c => /PH|WD|FL|PL/.test(c.s)); let kind = 'plain';
  if (n >= 2) { kind = 'lineUp'; A.play('lineUp', n, M.PAYSYMS.indexOf(top)); const hot = []; for (let k = 0; k <= r; k++) (lineSt.cols[k] || []).forEach((c, y) => { if (live.includes(c.s) || c.s === 'WD') hot.push([k, y]); }); try { reels.lineUp(hot, n); } catch (e) {} }
  else A.play('reelStop', r, false); // t132u: a stop that continues nothing is ONLY the plain clunk (no per-symbol sounds)
  const land = []; cells.forEach(c => { if (c.s === 'FL') { lineSt.flags++; land.push('flag'); A.play('flag', lineSt.flags - 1); } else if (c.s === 'PL') { lineSt.plugs++; land.push('plug'); A.play('plugLand', lineSt.plugs); } else if (c.s === 'BG') { lineSt.boosts++; land.push('boost'); A.play('boostLand', lineSt.boosts); } else if (c.s === 'WD' && n >= 2) { land.push('wild'); A.play('sparkle'); } else if (c.s === 'PH' && n >= 2 && live.includes('PH')) land.push('ph'); });
  if (land.includes('ph')) A.play('phLand', n);
  window.__stopLog.push({ r, kind, n, top, land }); }
// t138u: 3 BOOST GAUGES - the round BOOST gauge needle sweeps from where it is to FULL (rev climbing, flames), then the BOOSTED WHEEL (no locks).
// The flag meter itself (st.meter) is untouched: after the bonus the gauge shows the flag fill again.
async function boostFill() { toast('3 BOOST GAUGES!', 1400); A.play('boostFill'); const p0 = Math.min(1, (st.meter || 0) / M.METER_MAX), ms = 1600 * SPD() * (quick ? .3 : 1), t0 = performance.now();
  window.__boostFill = { p0, done: false };
  await new Promise(res => { const step = now => { const u = Math.min(1, (now - t0) / ms), e = u * u * (3 - 2 * u); try { SH.meter(p0 + (1 - p0) * e); } catch (er) {} if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  try { SH.meter(1, true); } catch (e) {} shake(); window.__boostFill.done = true; await sleep(900); }
function meterPulse(m) { meters(); if (m.full) { SH.meter(1, true); toast('BOOST FULL!', 1500); A.play('turbo'); } }
// ---------------- big wins ----------------
const TIER_TXT = { big: 'BIG WIN', mega: 'MEGA WIN', madness: 'MITSUBISHI MADNESS!', total: 'BONUS TOTAL', bonus: 'BONUS WIN' };
// t141u: BONUS-WIN FINALE. Every bonus round that pays >= 3x bet (wheel credits/locks/jackpots, Rally, S-AWC, PHEV Charge, free-spin totals) ends in a
// full-machine takeover scaled by x-bet tier: BONUS WIN (3-10x) / BIG WIN (10x+) / MEGA WIN (25x+) / MITSUBISHI MADNESS (60x+): giant rolling total, x-bet chip,
// strobes, quakes, coin + confetti + firework bursts, a parade of top-display cars with burnout/horn/rev, and an escalating coin-bell-rev ROLLUP sound
// ending in a fanfare. Tap once = jump to the total (finale fanfare), tap again = close. The pay itself is unchanged.
const FIN = { bonus: { ms: 3200, coins: 3, fw: 0, cars: 1, q: 0 }, total: { ms: 3200, coins: 3, fw: 0, cars: 1, q: 0 }, big: { ms: 5200, coins: 5, fw: 3500, cars: 2, q: 1 }, mega: { ms: 7200, coins: 8, fw: 6000, cars: 3, q: 2 }, madness: { ms: 9500, coins: 12, fw: 9000, cars: 5, q: 3 } };
const bonusTier = (win) => { const t = M.tier(win, bet()); return t === 'win' ? (win >= 3 * bet() ? 'bonus' : null) : t; };
async function bonusWin(win, label) { const t = bonusTier(win); if (!t) return false; await bigWin(win, t, label, { bonus: true }); return true; }
function bigWin(amount, tier, sub, o = {}) { return new Promise(async res => { const b = $('big'), bon = !!o.bonus, F = FIN[tier] || FIN.big, xb = amount / bet(); fxs({ kind: 'big', tier, amount, bonus: bon });
  b.className = tier + (bon ? ' bonus q' + F.q : ''); $('bigTitle').textContent = TIER_TXT[tier] || 'BIG WIN'; $('bigSub').textContent = sub || ''; $('bigAmt').textContent = '0.00'; $('bigX').textContent = bon ? (xb >= 10 ? Math.round(xb) : xb.toFixed(1)) + '× BET' : ''; b.classList.remove('hidden');
  window.__finale = bon ? { tier, amount, xb, skipped: false, done: false, start: performance.now() } : null;
  if (!bon) { A.play('bigWin'); if (tier !== 'big' && tier !== 'total') { A.play('fanfare'); FX.fireworks(3000); } FX.coinRain(tier === 'madness' ? 4200 : 2600, tier === 'big' ? 2 : 4); FX.flyBy(tier === 'madness' ? 'phev' : tier === 'mega' ? 'ev' : 'ec', 1600); }
  const quickK = quick ? .2 : 1, ms = (bon ? F.ms : (tier === 'madness' ? 4200 : tier === 'mega' ? 3200 : tier === 'total' ? 1400 : 2200)) * SPD() * quickK, t0 = performance.now(), timers = [];
  let done = false, rolling = true, lastTick = 0, tickN = 0;
  if (bon) { A.play('rollStart', F.q); FX.coinRain(ms, F.coins); try { FX.confetti(60 + F.q * 50); } catch (e) {} if (F.fw) FX.fireworks(F.fw * SPD());
    const cars = ['ec', 'ev', 'phev', 'out', 'rvr']; for (let k = 0; k < F.cars; k++) timers.push(setTimeout(() => { if (done) return; FX.flyBy(cars[(k * 2 + F.q) % 5], 1500, undefined); A.play('passby', 1); if (k % 2) A.play('burnout'); A.play('rev', 1.4); try { shake(); } catch (e) {} }, (300 + k * (ms / (F.cars + 1))) ));
    for (let k = 1; k <= 2 + F.q * 2; k++) timers.push(setTimeout(() => { if (done || !rolling) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); try { FX.confetti(30 + F.q * 20); FX.coinBurst(innerWidth * (.2 + Math.random() * .6), innerHeight * .55, 40); } catch (e) {} A.play('rollTick', .6, F.q, 3); }, ms * k / (3 + F.q * 2))); }
  const finishRoll = (skip) => { if (!rolling) return; rolling = false; $('bigAmt').textContent = fmt(amount); if (bon) { if (window.__finale) { window.__finale.skipped = !!skip; window.__finale.rolled = true; } A.play('rollEnd', F.q); b.classList.add('landed'); try { FX.confetti(80 + F.q * 60); FX.coinBurst(innerWidth / 2, innerHeight * .5, 80); shake(); } catch (e) {} } };
  const fin = () => { if (done) return; done = true; timers.forEach(clearTimeout); b.onclick = null; finishRoll(false); $('bigAmt').textContent = fmt(amount); if (window.__finale) window.__finale.done = true; setTimeout(() => { b.classList.add('hidden'); b.classList.remove('landed', 'hit'); res(); }, 350 * SPD()); };
  const step = now => { if (done || !rolling) return; const u = Math.min(1, (now - t0) / ms);
    // bonus: the total accelerates (ease-in) so the last few moments are a blur of credits; the tick rate and pitch climb with it
    const e = bon ? u * u * (1.6 - .6 * u) : u; $('bigAmt').textContent = fmt(amount * Math.min(1, e));
    if (bon) { if (now - lastTick > 190 - 150 * u) { lastTick = now; tickN++; A.play('rollTick', u, F.q, tickN); } } else if (Math.random() < .3) A.play('coin', Math.random() * 7 | 0);
    if (u < 1) requestAnimationFrame(step); else { finishRoll(false); timers.push(setTimeout(fin, (bon ? 2600 : 1300) * SPD())); } };
  requestAnimationFrame(step);
  setTimeout(() => { b.onclick = () => { if (bon && rolling) { finishRoll(true); timers.push(setTimeout(fin, 1800 * SPD())); } else fin(); }; }, bon ? 700 : 500); setTimeout(fin, ms + (bon ? 12000 : 6000)); }); }
async function jackpotWin(id, amount, how) { fxs({ kind: 'jackpot', id, amount }); A.play('boom'); await cinematic({ title: M.JP_NAME[id] + '!', sub: 'JACKPOT', color: '#ffc400', car: id === 'grand' ? 'phev' : id === 'major' ? 'out' : id === 'minor' ? 'ec' : 'rvr', dur: 2400 });
  await bigWin(amount, amount >= 60 * bet() ? 'madness' : amount >= 25 * bet() ? 'mega' : 'big', M.JP_NAME[id] + ' JACKPOT' + (how ? ' · ' + how : '')); disp.win += amount; meters(); }
// ---------------- triggers ----------------
async function trigger(t, F) {
  window.__bonusWin = 0; auto = false; $('autoBtn').classList.remove('on');
  if (t.type === 'charge') { fxs({ kind: 'trigger', type: 'charge' }); toast('3 CHARGE PLUGS!', 1200); await sleep(700); return runFeature('charge', F); }
  fxs({ kind: 'trigger', type: 'wheel', tier: t.tier, via: t.via });
  if (t.via === 'boost') { await boostFill(); await cinematic({ title: 'BOOSTED WHEEL!', sub: '3 BOOST GAUGES · NO LOCKS', color: '#c43cff', car: 'phev', dur: 2000 }); }
  else { if (t.via === 'meter') { toast('BOOST FULL — WHEEL TIME!', 1500); await sleep(800); } else await sleep(600);
  await cinematic({ title: 'MADNESS WHEEL', sub: t.via === 'meter' ? 'BOOST FULL' : `${t.tier + 2} CHECKERED FLAGS`, color: '#ffd84a', car: 'ec', dur: 1900 }); }
  const w = await wheel(t.tier, F, t.via); meters(); let total = w.win; window.__bonusWin = total;
  if (w.wedge.jp && !w.locked) await jackpotWin(w.wedge.jp, w.win); else if (w.win) { if (await bonusWin(w.win, w.locked ? 'LOCKED WEDGE' : w.wedge.label)) { disp.win += w.win; meters(); } else await roll('win', disp.win + w.win, 900, true); }
  if (w.feat) total += await runFeature(w.feat, F);
  return total; }
async function runFeature(feat, F) {
  const R = M.feature(bet(), rng, feat, Object.assign({ rich: F.rich }, F.opts || {})); window.__lastFeature = R; fxs({ kind: 'feature', feat, win: R.win });
  const env = { bet: bet(), fmt };
  let win = 0;
  if (R.kind === 'spins') win = await freeRound(R, F);
  else {
    const C = { rally: { title: 'RALLY RACE!', sub: 'PICK YOUR CAR', color: '#ff8a00', car: 'ec' }, offroad: { title: 'S-AWC CHALLENGE!', sub: 'CONQUER THE TRAIL', color: '#30e060', car: 'out' }, charge: { title: 'PHEV CHARGE!', sub: 'CHARGE UP TO 72 km', color: '#22c3ff', car: 'phev', bolt: true } }[R.kind];
    await cinematic(Object.assign({ dur: 2000 }, C)); A.music(true);
    try { win = await SC[R.kind](R, env); } finally { A.music(false); }
    win = R.win; window.__bonusWin = (window.__bonusWin || 0) + win;
    if (win > 0) { if (await bonusWin(win, { rally: 'RALLY RACE', offroad: 'S-AWC CHALLENGE', charge: `PHEV CHARGE · ${R.km} km` }[R.kind])) { disp.win += win; meters(); } else await roll('win', disp.win + win, 900, true); }
  }
  return win; }
// ---------------- Madness Wheel (photo-real: chrome marquee rim + bulbs, lacquered wedges with chrome dividers, rotating alloy hub, chrome pointer) ----------------
const WCOL = { feat: ['#e0182d', '#6a0010'], spins: ['#ff8a00', '#7a2e00'], credit: ['#4a5064', '#1a1d26'], mini: ['#14b8a2', '#04473f'], minor: ['#ff7a2a', '#7a2400'], major: ['#6a4cff', '#200f7a'], grand: ['#ffd34a', '#8a4a00'], charge: ['#1fb4ff', '#053c70'], offroad: ['#2cc858', '#0a4a1c'], rally: ['#e0182d', '#5a000e'] };
const wcol = w => w.jp ? WCOL[w.jp] : w.x ? WCOL.credit : WCOL[w.feat] || WCOL.spins;
const PH = {}; for (const k of ['wheel-rim', 'wheel-hub']) { const i = new Image(); i.src = `/madness/photo/${k}.webp?v=1`; PH[k] = i; }
const RIM_IN = 0.7246, RIM_OUT = 0.9297; // measured radii of the rim photo (fraction of half-size)
const imgOk = i => i && i.complete && i.naturalWidth > 0;
let wheelRot = 0;
function padlock(g, s) { g.save(); g.lineWidth = s * .16; const sg = g.createLinearGradient(-s * .4, 0, s * .4, 0); sg.addColorStop(0, '#8a8f99'); sg.addColorStop(.5, '#ffffff'); sg.addColorStop(1, '#6a6f79'); g.strokeStyle = sg;
  g.beginPath(); g.arc(0, -s * .18, s * .28, Math.PI, 0); g.lineTo(s * .28, 0); g.moveTo(-s * .28, -s * .18); g.lineTo(-s * .28, 0); g.stroke();
  const bg = g.createLinearGradient(0, -s * .05, 0, s * .6); bg.addColorStop(0, '#ffe680'); bg.addColorStop(.45, '#d49a1a'); bg.addColorStop(1, '#6a4000'); g.fillStyle = bg; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = s * .15; g.shadowOffsetY = s * .05;
  g.beginPath(); g.roundRect ? g.roundRect(-s * .42, -s * .04, s * .84, s * .62, s * .1) : g.rect(-s * .42, -s * .04, s * .84, s * .62); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = '#2a1800'; g.beginPath(); g.arc(0, s * .22, s * .08, 0, 7); g.fill(); g.fillRect(-s * .03, s * .22, s * .06, s * .18); g.restore(); }
function drawWheel(rot, locks, hot) { const cv = $('wheel'), g = cv.getContext('2d'), W = cv.width, C = W / 2, n = M.WHEEL.length, a = Math.PI * 2 / n, now = performance.now();
  const S = 2 * (C - 6) / RIM_OUT, rIn = RIM_IN * S / 2, R = rIn + 6; // wedges tuck under the rim
  g.clearRect(0, 0, W, W); g.save(); g.translate(C, C);
  // drop shadow of the whole wheel
  g.save(); g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 40; g.shadowOffsetY = 14; g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, C - 10, 0, 7); g.fill(); g.restore();
  g.save(); g.rotate(rot);
  M.WHEEL.forEach((w, i) => { const a0 = -Math.PI / 2 + (i - .5) * a, c = wcol(w);
    // lacquer: deep base, bright mid-band, darker towards the rim (depth)
    const gr = g.createRadialGradient(0, 0, R * .12, 0, 0, R); gr.addColorStop(0, c[1]); gr.addColorStop(.45, c[0]); gr.addColorStop(.82, c[0]); gr.addColorStop(1, c[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + a); g.closePath(); g.fill();
    // metallic flake / brushed sheen across each wedge
    g.save(); g.clip(); g.rotate(a0 + a / 2); const sh = g.createLinearGradient(0, -R * .14, 0, R * .14); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.16)'); sh.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = sh; g.fillRect(0, -R, R, 2 * R); g.restore();
    if (hot === i) { g.fillStyle = `rgba(255,255,255,${.25 + .25 * Math.sin(now / 80)})`; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + a); g.closePath(); g.fill(); }
    // embossed labels, reading outwards
    g.save(); g.rotate(a0 + a / 2); g.textAlign = 'center'; g.textBaseline = 'middle';
    const parts = w.label.split(' '), maxW = R * .5; let fs = 36; g.font = `900 ${fs}px Russo,sans-serif`; while (fs > 14 && Math.max(...parts.map(p => g.measureText(p).width)) > maxW) { fs--; g.font = `900 ${fs}px Russo,sans-serif`; }
    parts.forEach((p, k) => { const x = R * .64, y = (k - (parts.length - 1) / 2) * fs * 1.05; g.fillStyle = 'rgba(0,0,0,.75)'; g.fillText(p, x + 1.5, y + 2.5);
      const tg = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); if (w.jp === 'grand') { tg.addColorStop(0, '#fff'); tg.addColorStop(1, '#5a2a00'); } else { tg.addColorStop(0, '#ffffff'); tg.addColorStop(.55, '#f2f2f2'); tg.addColorStop(1, '#b8bcc6'); } g.fillStyle = w.jp === 'grand' ? '#3a1600' : tg; g.fillText(p, x, y); });
    g.restore();
    if (locks && locks.includes(w.id)) { g.save(); g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + a); g.closePath(); g.fill(); g.rotate(a0 + a / 2); g.translate(R * .86, 0); g.rotate(Math.PI / 2); padlock(g, R * .17); g.restore(); } });
  // chrome dividers between wedges
  for (let i = 0; i < n; i++) { const aa = -Math.PI / 2 + (i - .5) * a; g.save(); g.rotate(aa); const dg = g.createLinearGradient(0, -5, 0, 5); dg.addColorStop(0, '#5a5f69'); dg.addColorStop(.5, '#ffffff'); dg.addColorStop(1, '#3a3f49'); g.fillStyle = dg; g.fillRect(R * .17, -3, R * .85, 6);
    const sg = g.createRadialGradient(R * .93, -2, 1, R * .93, 0, 10); sg.addColorStop(0, '#fff'); sg.addColorStop(.5, '#b8bcc6'); sg.addColorStop(1, '#2a2d33'); g.fillStyle = sg; g.beginPath(); g.arc(R * .93, 0, 8, 0, 7); g.fill(); g.restore(); }
  // inner ambient-occlusion ring under the rim
  const ao = g.createRadialGradient(0, 0, R * .82, 0, 0, R); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = ao; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  // rotating alloy hub (photo)
  const hr = R * .26; g.save(); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 18; g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, hr, 0, 7); g.fill(); g.restore();
  if (imgOk(PH['wheel-hub'])) g.drawImage(PH['wheel-hub'], -hr, -hr, hr * 2, hr * 2);
  g.restore();
  // glass dome highlight (static, does not rotate)
  const hl = g.createLinearGradient(0, -R, 0, R * .2); hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(.5, 'rgba(255,255,255,.05)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.beginPath(); g.ellipse(-R * .1, -R * .42, R * .78, R * .5, -.25, 0, 7); g.fill();
  // chrome marquee rim (photo) + chasing bulb glow
  if (imgOk(PH['wheel-rim'])) g.drawImage(PH['wheel-rim'], -S / 2, -S / 2, S, S); else { g.strokeStyle = '#c8ccd4'; g.lineWidth = (RIM_OUT - RIM_IN) * S / 2; g.beginPath(); g.arc(0, 0, (RIM_IN + RIM_OUT) * S / 4, 0, 7); g.stroke(); }
  const br = (RIM_IN + RIM_OUT) / 2 * S / 2 + S * .002, phase = Math.floor(now / 140) % 3; g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 24; k++) { if ((k % 3) !== phase && hot == null) continue; const aa = -Math.PI / 2 + k * Math.PI / 12, x = Math.cos(aa) * br, y = Math.sin(aa) * br, bg2 = g.createRadialGradient(x, y, 0, x, y, S * .035);
    bg2.addColorStop(0, 'rgba(255,240,190,.95)'); bg2.addColorStop(.4, 'rgba(255,200,90,.45)'); bg2.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = bg2; g.beginPath(); g.arc(x, y, S * .035, 0, 7); g.fill(); }
  g.restore();
  // chrome pointer with red jewel at 12 o'clock
  g.save(); g.translate(0, -C + 4); const pw = W * .052, ph = W * .1; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
  const pg = g.createLinearGradient(-pw, 0, pw, 0); pg.addColorStop(0, '#4a4e57'); pg.addColorStop(.3, '#f4f6fa'); pg.addColorStop(.5, '#9aa0aa'); pg.addColorStop(.7, '#ffffff'); pg.addColorStop(1, '#3a3e47'); g.fillStyle = pg;
  g.beginPath(); g.moveTo(-pw, 0); g.quadraticCurveTo(-pw, -pw * .5, 0, -pw * .55); g.quadraticCurveTo(pw, -pw * .5, pw, 0); g.lineTo(0, ph); g.closePath(); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.stroke();
  const jg = g.createRadialGradient(-pw * .15, pw * .05, 1, 0, pw * .2, pw * .5); jg.addColorStop(0, '#ffd0d6'); jg.addColorStop(.3, '#ff2040'); jg.addColorStop(1, '#4a0008'); g.fillStyle = jg; g.beginPath(); g.arc(0, pw * .2, pw * .42, 0, 7); g.fill(); g.restore();
  g.restore(); }
function wheel(tier, F, via) { return new Promise(async (resolveWheel) => {
  const box = $('wheelBox'), hub = $('wheelHub'); const w = M.spinWheel(bet(), rng, tier, { forceIdx: F.idx, forceRevUp: F.revUp }); window.__lastWheel = w;
  let locks = M.LOCKS[tier]; box.classList.remove('hidden'); box.classList.toggle('boosted', via === 'boost'); $('wheelTitle').textContent = via === 'boost' ? 'BOOSTED WHEEL' : 'MADNESS WHEEL'; $('wheelTier').textContent = `${via === 'boost' ? '3 BOOST GAUGES' : via === 'meter' ? 'BOOST FULL' : tier + 2 + ' FLAGS'} · ${locks.length ? locks.length + ' LOCKED' : 'ALL UNLOCKED'}`; $('wheelMsg').textContent = ''; hub.disabled = true; hub.textContent = 'SPIN';
  drawWheel(wheelRot, locks); A.music(true); const idleAnim = setInterval(() => { if (!box.classList.contains('hidden')) drawWheel(wheelRot, locks); }, 140);
  let finished = false; const safety = setTimeout(() => { if (!finished) { finished = true; window.__wheelSafety = (window.__wheelSafety || 0) + 1; box.classList.add('hidden'); A.music(false); resolveWheel(w); } }, 45000 * SPD());
  try {
    if (w.revUp) { await sleep(600); $('wheelMsg').textContent = 'REV UP!'; A.play('rev', 1.6); fxs({ kind: 'revup' }); await sleep(1500); A.play('unlock'); shakeWheel(); locks = w.locks; drawWheel(wheelRot, locks); $('wheelTier').textContent = `TIER ${w.tier} · ${locks.length ? locks.length + ' LOCKED' : 'ALL UNLOCKED'}`; $('wheelMsg').textContent = 'LOCKS SMASHED!'; FX.sparks(innerWidth / 2, innerHeight / 2, 60, '#ffd84a'); await sleep(900); }
    $('wheelMsg').innerHTML = '<b class=tapme>👆 TAP THE WHEEL TO SPIN</b><small>Win free spins, a bonus round, credits or a jackpot · 🔒 locked wedges pay 5× bet</small>'; hub.disabled = false; hub.classList.add('pulse');
    await new Promise(r => { let fired = false; const go = () => { if (fired) return; fired = true; hub.classList.remove('pulse'); hub.disabled = true; hub.onclick = null; $('wheelWrap').onclick = null; r(); }; hub.onclick = go; $('wheelWrap').onclick = go; setTimeout(go, 7000 * SPD()); });
    clearInterval(idleAnim); $('wheelMsg').textContent = ''; A.play('whoosh');
    const n = M.WHEEL.length, a = Math.PI * 2 / n, target = -w.idx * a + (Math.random() - .5) * a * .5, cur = wheelRot % (Math.PI * 2); let delta = target - cur; while (delta < 0) delta += Math.PI * 2; delta += Math.PI * 2 * 5;
    const T = (quick ? 1200 : 4600) * SPD(), t0 = performance.now(), from = wheelRot; let lastSeg = -1;
    await new Promise(r => { const step = now => { const u = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - u, 4); wheelRot = from + delta * e; drawWheel(wheelRot, locks); const seg = Math.floor((wheelRot + a / 2) / a); if (seg !== lastSeg) { lastSeg = seg; A.play('wheelTick'); } if (u < 1) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); });
    wheelRot = -w.idx * a; drawWheel(wheelRot, locks, w.idx);
    const blink = setInterval(() => drawWheel(wheelRot, locks, w.idx), 60);
    if (w.locked) { A.play('deny'); $('wheelMsg').textContent = `🔒 LOCKED · PAYS ${M.LOCK_X}× BET = ${fmt(w.win)}`; }
    else if (w.wedge.jp) { $('wheelMsg').textContent = M.JP_NAME[w.wedge.jp] + ' JACKPOT!'; A.play('fanfare'); }
    else if (w.wedge.x) { $('wheelMsg').textContent = `${w.wedge.x}× BET = ${fmt(w.win)}`; A.play('win', 3); }
    else { $('wheelMsg').textContent = w.wedge.label + '!'; A.play('turbo'); }
    fxs({ kind: 'wheel', idx: w.idx, id: w.wedge.id, locked: w.locked });
    await sleep(1700); clearInterval(blink);
  } finally { clearInterval(idleAnim); if (!finished) { finished = true; clearTimeout(safety); box.classList.add('hidden'); A.music(false); resolveWheel(w); } }
}); }
function shakeWheel() { const e = $('wheelWrap'); e.classList.remove('shakeX'); void e.offsetWidth; e.classList.add('shakeX'); }
// ---------------- free spins ----------------
const MODE_INFO = { turbo: { c: '#ff8a00', car: 'ec', feats: 'Wilds carry ×2 – ×10 multipliers<br>3 flags = +5 spins AND +1 ROW · may GEAR UP to NITRO' }, nitro: { c: '#22c3ff', car: 'ev', feats: 'REELS GROW TO 5×4 = 1,024 WAYS<br>Multiplier wilds + DRIFT WILD reels<br>3 flags = +5 spins AND +1 ROW (5×5 = 3,125 ways) · may GEAR UP to MADNESS' }, madness: { c: '#ff2040', car: 'phev', feats: 'Multiplier wilds + DRIFT WILD reels<br>Win multiplier climbs ×1 → ×10 with every win<br>3 flags = +5 spins AND +1 ROW (5×4 = 1,024 ways)' } };
function splash(mode, n) { return new Promise(res => { const s = $('splash'), info = MODE_INFO[mode]; s.style.setProperty('--modeC', info.c); $('splashTitle').textContent = M.MODES[mode].name.split(' ')[0]; $('splashSub').textContent = `${n} FREE SPINS`; $('splashFeats').innerHTML = info.feats + '<p class=how>HOW IT WORKS: your free spins play by themselves — no bet needed. Wins add up in BONUS WIN at the top. Tap START when ready.</p>'; s.classList.remove('hidden');
  let done = false; const go = () => { if (done) return; done = true; s.classList.add('hidden'); $('startBtn').onclick = null; s.onclick = null; A.play('rev', 1); res(); }; setTimeout(() => { $('startBtn').onclick = go; s.onclick = go; }, 300); setTimeout(go, (quick ? 1500 : 9000) * SPD()); }); }
// t135u: NITRO SPINS grow the reels to 5x4 (1,024 ways): the cabinet stretches a row taller (top display gives up the space), then shrinks back
async function setRows(n, instant) { if (reels.rows === n && rowsVis === n) return; const from = rowsVis; reels.beginRows(n);
  if (!instant) { A.play(n > from ? 'turbo' : 'blowoff'); if (n > from) { A.play('impact'); toast(`REELS GROW! 5×${n} · ${(n ** 5).toLocaleString()} WAYS`, 1600); $('frame').classList.add('grow'); } }
  const D = instant ? 0 : 750 * SPD(), t0 = performance.now();
  await new Promise(res => { const f = now => { const u = D ? Math.min(1, (now - t0) / D) : 1, e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; rowsVis = from + (n - from) * e;
    $('app').style.setProperty('--reelsH', reelsHeight(rowsVis) + 'px'); reels.resize();
    if (u < 1) requestAnimationFrame(f); else res(); }; if (D) requestAnimationFrame(f); else f(performance.now()); });
  rowsVis = n; reels.endRows(n); layout(); $('frame').classList.remove('grow'); if (!instant && n > from) { try { shake(); } catch (e) {} A.play('reelStop', 0, true); }
  window.__rows = n; }
function setModeLook(mode) { const f = $('frame'); f.classList.remove('mode-turbo', 'mode-nitro', 'mode-madness'); $('app').classList.toggle('free', !!mode); FX.setMode(mode); SH.setTint(mode ? { turbo: 'rgba(255,120,0,.14)', nitro: 'rgba(0,160,255,.16)', madness: 'rgba(255,0,60,.18)' }[mode] : ''); if (mode) { f.classList.add('mode-' + mode); $('modeHud').style.setProperty('--modeC', MODE_INFO[mode].c); $('hudMode').textContent = M.MODES[mode].name; $('hudMultW').classList.toggle('hidden', mode !== 'madness'); } $('modeHud').classList.toggle('hidden', !mode); }
async function freeRound(R, F) {
  const mode0 = R.mode, info = MODE_INFO[mode0];
  await cinematic({ title: M.MODES[mode0].name + '!', sub: `${M.FS_START[mode0]} FREE SPINS`, color: info.c, car: info.car, dur: 2200 });
  await splash(mode0, M.FS_START[mode0]);
  let mode = mode0, won = 0, total = M.FS_START[mode0]; setModeLook(mode); A.music(true); let extra = 0; await setRows(M.rowsOf(mode));
  const hud = (i) => { $('hudSpins').textContent = `${i} OF ${total}`; $('hudWin').textContent = fmt(won); };
  try {
    for (let i = 0; i < R.spins.length; i++) { const s = R.spins[i];
      if (R.gearUp && R.gearUp.at === i) { fxs({ kind: 'gearup', to: R.gearUp.to }); A.play('gear'); await cinematic({ title: 'GEAR UP!', sub: M.MODES[R.gearUp.to].name + ` · +${R.gearUp.add} SPINS`, color: MODE_INFO[R.gearUp.to].c, car: MODE_INFO[R.gearUp.to].car, dur: 2000 }); mode = R.gearUp.to; total += R.gearUp.add; setModeLook(mode); await setRows(M.rowsOf(mode) + extra); }
      hud(i + 1); $('hudMult').textContent = '×' + (s.prog || 1); A.play('spin');
      quick = false; await animateReels(s, mode); // t136u: a STOP tap only hurries the free spin it was tapped on
      const w = await resolve(s, mode); won += w; window.__bonusWin = (window.__bonusWin || 0) + w; hud(i + 1);
      if (s.retrig) { total += s.retrig; fxs({ kind: 'retrig' }); A.play('fanfare'); toast(`+${s.retrig} SPINS!`, 1300); hud(i + 1); await sleep(900); }
      if (s.grow) { // t143u: 3 flags in a free spin = the reels grow ONE more row for the rest of the round (once per round)
        extra = 1; window.__grow = (window.__grow || 0) + 1; fxs({ kind: 'grow', rows: s.grow.to }); A.play('fanfare');
        await sleep(quick ? 150 : 450); await setRows(s.grow.to); toast(`3 FLAGS! +1 ROW · 5×${s.grow.to} · ${(s.grow.to ** 5).toLocaleString()} WAYS`, 2000); await sleep(quick ? 150 : 600); }
      await sleep(quick ? 80 : 250); }
  } finally { A.music(false); setModeLook(null); curMode = null; clearWinBanner(); await setRows(3); }
  if (won > 0) { if (!(await bonusWin(won, `${M.MODES[R.finalMode].name} TOTAL · ${R.played} SPINS`))) await bigWin(won, 'total', `${M.MODES[R.finalMode].name} TOTAL · ${R.played} SPINS`); }
  return won; }
// ---------------- recovery ----------------
function recoverScreen() { try { clearCine('recover'); } catch (e) {} clearWinBanner(); for (const id of ['wheelBox', 'splash', 'big']) $(id).classList.add('hidden'); try { SC.close(); } catch (e) {} setModeLook(null); curMode = null; setRows(3, true); $('frame').classList.remove('spinning', 'tease'); A.music(false); reels.setGrid(shown); }
// ---------------- attract mode ----------------
const ATTRACT = ['WIN THE PHEV GRAND!', 'PHEV CHARGE · UP TO 72 km = 72× BET', 'RALLY RACE · PICK YOUR CAR', 'S-AWC CHALLENGE · CONQUER 5 STAGES', 'DRIFT WILDS!', 'TURBO · NITRO · MADNESS SPINS', '3 FLAGS SPIN THE MADNESS WHEEL'];
let idleT = 0, attractOn = false, attractI = 0, attractTimer = 0;
function idleKick() { clearTimeout(idleT); idleT = setTimeout(enterAttract, (DEBUG ? 600000 : 30000)); }
function enterAttract() { if (busy || attractOn) return; attractOn = true; FX.setAttract(true); SH.setAttract(true); $('attract').classList.remove('hidden'); const tick = () => { $('attractTxt').textContent = ATTRACT[attractI++ % ATTRACT.length]; const t = $('attractTxt'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; }; tick(); attractTimer = setInterval(tick, 3000); }
function exitAttract() { if (!attractOn) { idleKick(); return; } attractOn = false; FX.setAttract(false); SH.setAttract(false); $('attract').classList.add('hidden'); clearInterval(attractTimer); idleKick(); }
addEventListener('pointerdown', exitAttract, { passive: true }); idleKick();
window.__attract = { enter: () => { busy || enterAttract(); }, exit: exitAttract, get on() { return attractOn; } };
// ---------------- menu / paytable ----------------
function showPay() { const b = bet(), cell = (s, n) => { const u = M.wayPay(s, n, b); const x = M.PAY[s][n - 3]; return `<td><b>${fmt(u)}</b><small>${+x.toFixed(2)}× bet · ${cr(u).toLocaleString()} cr</small></td>`; };
  let h = `<div class=payhead>PAYS PER WINNING WAY AT YOUR CURRENT BET<br><b>${betCr()} credits × ${denomTxt(st.denom)} = ${money(betCents())}</b></div>
  <p>243 ways (1,024 ways in NITRO SPINS, 5×4; 3 flags in any free spin grow the reels one more row, up to 3,125 ways): matching symbols on adjacent reels from the left pay, anywhere on each reel. Each separate path through matching tiles is one WAY, so 2 RVRs on reel 2 = 2 ways (pays ×2). A MADNESS WILD with ×2 / ×3 multiplies its ways. The win banner shows exactly this: <i>5× RVR · 1 WAY = ${fmt(M.wayPay('RV', 5, b))}</i>.</p>
  <table class=paytab><tr><th></th><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>`;
  for (const s of M.PAYSYMS.slice().reverse()) h += `<tr class="${M.SYM[s].kind}"><td><img src="/madness/art/${s}.webp?v=4" alt=""></td><td>${M.SYM[s].name}</td>${[3, 4, 5].map(n => cell(s, n)).join('')}</tr>`;
  h += `</table><p>5 of a kind on one way: PHEV ${M.PAY.PH[2]}× bet, Outlander ${M.PAY.OU[2]}×, Sportback EV ${M.PAY.EV[2]}×, Eclipse Cross ${M.PAY.EC[2]}×, RVR ${M.PAY.RV[2]}×. Values above change with your bet and denomination. <b>5 Outlander PHEVs on the centre row = PHEV GRAND (${usd(M.JP.grand * b)})</b>.</p><h3>Specials</h3><p><img src="/madness/art/WD.webp" alt=""> MADNESS WILD (reels 2-4) substitutes for every symbol; in base play it can carry ×2/×3, in free spins ×2 – ×10. Multipliers on one way multiply.</p>
  <p><img src="/madness/art/FL.webp" alt=""> 3 / 4 / 5 CHECKERED FLAGS anywhere spin the MADNESS WHEEL (more flags = fewer locked wedges).</p><p><img src="/madness/art/BG.webp" alt=""> 3 BOOST GAUGES (reels 2, 3, 4) fill the BOOST gauge instantly and spin the BOOSTED WHEEL: the Madness Wheel with every wedge unlocked, jackpots included.</p><p><img src="/madness/art/PL.webp" alt=""> 3 CHARGE PLUGS (reels 1, 3, 5) start PHEV CHARGE: 1 km = 1× bet, full 72 km = 72× bet (${usd(72 * b)}).</p>`;
  $('menuBody').innerHTML = h; window.__payShown = { bet: b, betCr: betCr(), denom: st.denom, rows: Object.fromEntries(M.PAYSYMS.map(s => [s, [3, 4, 5].map(n => ({ usd: fmt(M.wayPay(s, n, b)), cr: cr(M.wayPay(s, n, b)), x: M.PAY[s][n - 3] }))])) }; }
function showRules() { $('menuBody').innerHTML = `<h3>DRIFT WILD</h3><p>Any spin, a car can drift across reel 2, 3 or 4 in a cloud of tyre smoke and turn the whole reel WILD. A drift wild always lands at least one win.</p>
  <h3>BOOST GAUGE</h3><p>The round BOOST gauge in the top display fills with every checkered flag that lands without a wheel. Full BOOST = a free Madness Wheel. <b>New:</b> 3 BOOST GAUGE symbols (reels 2, 3, 4) fill the gauge instantly and launch the BOOSTED WHEEL with no locked wedges. The flag fill keeps going either way.</p>
  <h3>MADNESS WHEEL</h3><p>12 wedges: TURBO / NITRO / MADNESS SPINS, RALLY RACE, S-AWC CHALLENGE, PHEV CHARGE, 10× and 25× bet, and the RVR MINI (${M.JP.mini}×), ECLIPSE MINOR (${M.JP.minor}×), OUTLANDER MAJOR (${M.JP.major}×) and PHEV GRAND (${M.JP.grand}×) jackpots. With 3 flags the GRAND, MAJOR and MADNESS wedges are locked (5× bet); 4 flags lock only the GRAND; 5 flags unlock everything. REV UP can smash the locks before the spin.</p>
  <h3>FREE SPINS</h3><p>TURBO (8): multiplier wilds. NITRO (8): the reels grow to 5×4 for 1,024 ways, + drift wild reels. MADNESS (10): + a win multiplier that climbs to ×10. 3 flags = +5 spins <b>and the reels GROW one more row</b> for the rest of the round (5×3 → 5×4 = 1,024 ways; NITRO 5×4 → 5×5 = 3,125 ways). It happens once per round. GEAR UP can upgrade the round mid-way.</p>
  <h3>RALLY RACE</h3><p>Pick one of four cars and watch the race. 1st = 30× (NITRO FINISH doubles it to 60×), 2nd = 15×, 3rd = 8×, 4th = 4× bet.</p>
  <h3>S-AWC CHALLENGE</h3><p>Five trail stages. Each cleared stage pays 2× – 10× bet. Get STUCK and it ends — but S-AWC can rescue you once. Clear all 5 for a 20× SUMMIT bonus.</p>
  <h3>PHEV CHARGE</h3><p>The Outlander PHEV plugs in. Tap to charge in bursts of 3 – 9 km (REGEN BOOST doubles a burst). A POWER SURGE can stop the charge. Every km pays 1× your bet; a FULL CHARGE is 72 km = 72× bet.</p>`; }
function showAbout() { $('menuBody').innerHTML = `<p><b>MITSUBISHI MADNESS</b> is a play-money game for fun. No real money, no prizes, no cash value. Vehicle names and pictures show the current Mitsubishi line-up; jackpot amounts are play credits, not vehicles.</p><p>Return to player ≈ ${(window.__rtp || 95.5)}% (simulated). Played ${st.played} spins on this device.</p>`; }
// ---------------- wiring ----------------
$('spinBtn').addEventListener('click', spin); $('billBtn').addEventListener('click', insertBill); $('cashBtn').addEventListener('click', cashOut);
$('betUp').addEventListener('click', () => { if (busy) return; st.bet = Math.min(M.BETS.length - 1, st.bet + 1); save(); meters(); A.play('click'); });
$('betDn').addEventListener('click', () => { if (busy) return; st.bet = Math.max(0, st.bet - 1); save(); meters(); A.play('click'); });
$('maxBtn').addEventListener('click', () => { if (busy) return; st.bet = M.BETS.length - 1; save(); meters(); A.play('click'); spin(); });
$('autoBtn').addEventListener('click', () => { auto = !auto; $('autoBtn').classList.toggle('on', auto); if (auto && !busy) spin(); });
const muteIcon = () => $('muteBtn').textContent = A.muted ? '🔇' : '🔊'; muteIcon(); $('muteBtn').addEventListener('click', () => { A.setMuted(!A.muted); muteIcon(); });
$('fsBtn').addEventListener('click', () => { const d = document.documentElement; try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (d.requestFullscreen || d.webkitRequestFullscreen).call(d); } catch (e) {} });
$('menuBtn').addEventListener('click', () => { showPay(); $('menu').classList.remove('hidden'); });
$('payBtn').addEventListener('click', showPay); $('rulesBtn').addEventListener('click', showRules); $('aboutBtn').addEventListener('click', showAbout);
$('denoms').innerHTML = DENOMS.map(d => `<button data-d=${d}>${denomTxt(d)}</button>`).join('');
const markDen = () => document.querySelectorAll('#denoms button').forEach(b => b.classList.toggle('on', +b.dataset.d === st.denom));
$('denomBtn').addEventListener('click', () => { if (busy) return; A.init(); A.play('click'); markDen(); $('denomModal').classList.remove('hidden'); });
$('denoms').addEventListener('click', e => { const d = +e.target.dataset.d; if (!d || busy) return; st.denom = d; save(); markDen(); meters(); A.play('click'); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); spin(); } });
meters();
if (DEBUG) window.__finaleDemo = async (xb, label) => { busy = true; try { await bonusWin(xb * bet(), label || 'DEMO'); } finally { busy = false; } }; // t141u test hook: play the finale for xb x bet
window.G = { st, M, spin, insertBill, cashOut, get busy() { return busy; }, get mode() { return curMode; }, setBet: i => { st.bet = i; save(); meters(); }, setDenom: d => { st.denom = d; save(); meters(); }, DENOMS, CPU, recoverScreen, cinematic, reels, drawWheel };
if (DEBUG) { window.G.force = k => { forceNext = k; }; const d = $('dbg'); d.classList.remove('hidden');
  d.innerHTML = ['rv5', 'ph5', 'win', 'multi', 'big', 'mega', 'madness', 'wild', 'drift', 'almost', 'meter', 'jackpot', 'boost', 'boost2', 'almostpl', 'almostbg', 'c10', 'c25', 'wheel3', 'wheel4', 'wheel5', 'revup', 'locked', 'turbo', 'nitro', 'madspins', 'gearup', 'rally', 'rally1', 'offroad', 'summit', 'rescue', 'charge', 'full72', 'surge', 'wcharge', 'mini', 'minor', 'major', 'grandwheel'].map(k => `<button data-f="${k}">${k}</button>`).join('');
  d.addEventListener('click', e => { const k = e.target.dataset.f; if (k) { forceNext = k; toast('next: ' + k, 900); } }); }
})();
