// MITSUBISHI MADNESS - play-money slot cabinet: 5x3 / 243 ways of Mitsubishi models, DRIFT WILDS, Madness Meter, Madness Wheel
// (REV UP lock-break), TURBO / NITRO / MADNESS SPINS (GEAR UP), RALLY RACE, S-AWC CHALLENGE, PHEV CHARGE (72 km = 72 credits x bet).
// Engine patterns carried over from GORILLA: guarded full-screen takeovers (seq token, done guards, stall caps, orphan watchdog),
// spin() try/catch -> recoverScreen(), single-fire taps, auto-advance on every interactive step, ?debug=1 forces, window.G test API.
(function () {
'use strict';
const M = window.MadnessMath, A = window.MadAudio, FX = window.MadFX, SC = window.MadScenes;
const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search), DEBUG = qs.has('debug');
if (DEBUG) window.__madSpeed = +(qs.get('speed') || 1);
const SPD = () => window.__madSpeed || 1;
const sleep = ms => new Promise(r => setTimeout(r, ms * SPD()));
const fmt = c => (Math.round(c * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = c => '$' + Math.round(c).toLocaleString('en-US');
const glog = (kind, o = {}) => { try { fetch('/madness/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, ...o, ua: navigator.userAgent.slice(0, 120) }) }).catch(() => {}); } catch (e) {} };
// ---------------- state ----------------
const KEY = 'madnessState1';
const st = Object.assign({ cents: 0, bet: 0, lastWin: 0, ticketNo: 5000, inserted: 0, played: 0, meter: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
if (!(st.bet >= 0 && st.bet < M.BETS.length)) st.bet = 0;
const save = () => localStorage.setItem(KEY, JSON.stringify(st));
const bet = () => M.BETS[st.bet], betCents = () => bet() * 100, toCents = cr => Math.round(cr * 100);
let busy = false, quick = false, rng = M.cryptoRng(), forceNext = null, auto = false, curMode = null;
window.__madFx = []; const fxs = o => { o.at = performance.now(); window.__madFx.push(o); if (window.__madFx.length > 200) window.__madFx.shift(); };
// ---------------- reels ----------------
const randomSym = (r) => { const s = (curMode ? M.FREE_STRIPS : M.STRIPS)[r]; const x = s[Math.floor(Math.random() * s.length)]; return { s: x, mult: x === 'WD' && curMode ? [2, 3, 5][Math.random() * 3 | 0] : null }; };
const reels = new window.MadReels($('reelCv'), { randomSym }); window.reels = reels;
let shown = [0, 1, 2, 3, 4].map(r => [0, 1, 2].map(y => ({ s: M.STRIPS[r][(r * 5 + y * 3) % M.STRIPS[r].length] })));
reels.setGrid(shown);
FX.stageInit($('stage')); FX.fxInit($('fx'));
// ---------------- layout (portrait cabinet) ----------------
function layout() {
  const vw = innerWidth, vh = innerHeight, land = vw > vh * 1.05, coarse = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('rotate', land && coarse);
  const app = $('app'), W = Math.min(vw, Math.round(vh * .78)), H = vh, k = Math.max(.8, Math.min(2.0, Math.min(W / 390, H / 844))), wide = W / H > .62;
  const fw = Math.round(wide ? W * .92 : W - 2 * Math.round(5 * k)), pad = Math.round(7 * k), rw = fw - 2 * pad, gap = Math.max(2, rw * .008), colW = (rw - 4 * gap) / 5;
  let reelsH = Math.round(3 * colW / 1.25);
  const v = { '--appW': W + 'px', '--k': k.toFixed(3), '--fw': fw + 'px', '--pad': pad + 'px', '--reelsH': reelsH + 'px' };
  for (const n in v) app.style.setProperty(n, v[n]); app.classList.toggle('wide', wide);
  requestAnimationFrame(() => { reels.resize(); const a = app.getBoundingClientRect(), m = $('meter').getBoundingClientRect(), f = $('frame').getBoundingClientRect(); FX.setRoad(m.top - a.top - 34 * k, k); app.style.setProperty('--frameTop', (f.top - a.top) + 'px'); });
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 300)); layout(); setTimeout(layout, 400);
document.fonts && document.fonts.ready.then(layout);
// ---------------- meters ----------------
const disp = { cents: st.cents, win: 0 };
function meters() { $('mCred').textContent = fmt(disp.cents / 100); $('mBet').textContent = bet(); $('mWin').textContent = fmt(disp.win);
  const b = bet(); $('jpG').textContent = usd(M.JP.grand * b); $('jpJ').textContent = usd(M.JP.major * b); $('jpN').textContent = usd(M.JP.minor * b); $('jpM').textContent = usd(M.JP.mini * b);
  $('betDn').disabled = $('betUp').disabled = $('maxBtn').disabled = busy; $('cashBtn').disabled = busy || st.cents <= 0; $('billBtn').disabled = busy;
  const p = Math.round((st.meter || 0) / M.METER_MAX * 100); $('meterFill').style.width = p + '%'; $('meterPct').textContent = p + '%'; }
function roll(key, to, ms, tick) { return new Promise(res => { const from = disp[key], t0 = performance.now(); ms *= SPD(); if (quick) ms = Math.min(ms, 250); let last = 0;
  const step = now => { const u = Math.min(1, (now - t0) / ms); disp[key] = from + (to - from) * u; meters(); if (tick && now - last > 70) { last = now; A.play('tick'); } if (u < 1) requestAnimationFrame(step); else { disp[key] = to; meters(); res(); } }; requestAnimationFrame(step); }); }
function toast(msg, ms = 1800) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), ms); }
function shake() { const m = $('frame'); m.classList.remove('shakeX'); void m.offsetWidth; m.classList.add('shakeX'); }
// ---------------- bill acceptor & ticket ----------------
async function insertBill() { if (busy) return; A.init(); busy = true; meters(); const b = $('bill'); b.classList.remove('hidden', 'go'); void b.offsetWidth; b.classList.add('go'); A.play('bill');
  await sleep(1200); b.classList.add('hidden'); st.cents += 10000; st.inserted += 10000; save(); await roll('cents', st.cents, 1000, true); A.play('coin', 4); A.play('rev', .8); busy = false; meters(); }
async function cashOut() { if (busy || st.cents <= 0) return; A.init(); busy = true; meters(); const amt = st.cents, no = ++st.ticketNo; st.cents = 0; save();
  const t = $('ticket'); t.innerHTML = `<h4>MITSUBISHI MADNESS</h4><div>CASH-OUT VOUCHER</div><div class=amt>$${fmt(amt / 100)}</div><div>PLAY MONEY · NO CASH VALUE</div><div>${new Date().toLocaleString()}</div><div>TICKET #${no}</div><div class=bc></div><div style="text-align:center;margin-top:4px">tap to take ticket</div>`;
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
  const set = (g, r, y, c) => { g[r][y] = c; }, clean = g => { for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (/FL|PL/.test(g[r][y].s)) g[r][y] = { s: 'RV' }; };
  const flags = n => g => { clean(g); for (let r = 0; r < n; r++) set(g, r, r % 3, { s: 'FL' }); };
  const row = (s, n, wild) => g => { clean(g); for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === s) g[r][y] = { s: s === 'RV' ? 'EC' : 'RV' }; for (let r = 0; r < n; r++) set(g, r, 1, { s }); if (wild) set(g, 2, 1, { s: 'WD', mult: wild }); };
  const F = { kind };
  const grids = {
    win: row('EC', 3), big: g => { row('EV', 5)(g); set(g, 1, 0, { s: 'EV' }); set(g, 3, 2, { s: 'EV' }); set(g, 2, 1, { s: 'WD', mult: 2 }); },
    mega: g => { row('PH', 5)(g); set(g, 2, 1, { s: 'WD', mult: 3 }); set(g, 0, 0, { s: 'PH' }); set(g, 1, 0, { s: 'PH' }); },
    madness: g => { row('PH', 5)(g); for (const r of [0, 1, 3, 4]) set(g, r, 0, { s: 'PH' }); set(g, 2, 1, { s: 'WD', mult: 3 }); set(g, 2, 0, { s: 'WD', mult: 2 }); },
    wild: g => { row('OU', 4)(g); set(g, 1, 1, { s: 'WD', mult: 3 }); set(g, 3, 1, { s: 'WD', mult: 2 }); },
    jackpot: g => { clean(g); for (let r = 0; r < 5; r++) set(g, r, 1, { s: 'PH' }); },
    almost: g => { clean(g); set(g, 0, 0, { s: 'FL' }); set(g, 1, 2, { s: 'FL' }); },
    drift: g => { clean(g); for (let r = 0; r < 5; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === 'WD' || g[r][y].s === 'OU') g[r][y] = { s: 'RV' }; set(g, 0, 1, { s: 'OU' }); set(g, 1, 0, { s: 'OU' }); set(g, 3, 2, { s: 'OU' }); },
    meter: g => { clean(g); set(g, 0, 1, { s: 'FL' }); },
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
  if (kind === 'rally1') wheelTo('rally', 3, { opts: { forcePlace: 1, forceNitro: true } });
  if (kind === 'summit') wheelTo('offroad', 3, { opts: { forceStuck: -1 } });
  if (kind === 'rescue') wheelTo('offroad', 3, { opts: { forceStuck: 1, forceRescue: true } });
  if (kind === 'wcharge') wheelTo('charge', 3);
  if (/^(grandwheel|major|minor|mini)$/.test(kind)) wheelTo(kind === 'grandwheel' ? 'grand' : kind);
  if (kind === 'revup') { F.force = flags(3); F.trigger = { type: 'wheel', tier: 1, via: 'flags' }; F.revUp = true; F.idx = WIDX('madness'); }
  if (kind === 'locked') { F.force = flags(3); F.trigger = { type: 'wheel', tier: 1, via: 'flags' }; F.revUp = false; F.idx = WIDX('major'); }
  if (kind === 'meterwheel') { F.force = grids.meter; F.meter = true; }
  return F;
}
// ---------------- spin ----------------
// t110u: the win banner (and win highlights) go away the instant a new spin is pressed / starts (base, autoplay, free spins)
function clearWinBanner() { const wb = $('winBanner'); wb.classList.add('hidden'); wb.textContent = ''; try { reels.clearWin(); } catch (e) {} }
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
  if (total > 0) { st.cents += toCents(total); st.lastWin = total; save(); await roll('cents', st.cents, 600, false); }
  $('spinBtn').classList.remove('stop'); $('spinBtn').textContent = 'SPIN'; busy = false; quick = false; meters(); idleKick();
  if (st.cents < betCents() && st.cents > 0) toast('Low on credits — insert another bill or lower the bet');
  if (auto) { if (st.cents >= betCents() && !res.trigger) setTimeout(() => { if (auto && !busy) spin(); }, 450 * SPD()); else { auto = false; $('autoBtn').classList.remove('on'); } }
}
async function animateReels(res, mode) {
  curMode = mode; const grid = res.pre || res.grid; clearWinBanner();
  const fl = r => grid[r].some(c => c.s === 'FL'), pl = r => grid[r].some(c => c.s === 'PL');
  const tease = [false, false, false, false, false]; let fsoFar = 0; for (let r = 0; r < 5; r++) { if (fsoFar >= 2 && !mode) tease[r] = true; if (fl(r)) fsoFar++; }
  if (!mode && pl(0) && pl(2)) tease[4] = true; for (let r = 0; r < 3; r++) tease[r] = false;
  $('frame').classList.add('spinning'); const fast = quick ? .35 : 1;
  await reels.spin(grid, { fast, tease,
    onStop: (r, cells) => { A.play('reelStop', r); cells.forEach(c => { if (c.s === 'FL') A.play('flag', r); else if (c.s === 'PL') A.play('plug'); else if (c.s === 'WD') A.play('sparkle'); }); },
    onTease: () => { $('frame').classList.add('tease'); A.play('tease'); } });
  $('frame').classList.remove('spinning', 'tease');
  if (res.drift) { for (const r of res.drift.reels) { fxs({ kind: 'drift', r }); A.play('screech', 1.1); A.play('rev', 1); const ks = ['ev', 'phev', 'ec', 'rvr', 'out'];
      await FX.drift(reels.cellRect(r, 0) && (() => { const a = reels.cellRect(r, 0), b = reels.cellRect(r, 2); return { left: a.left, top: a.top, width: a.width, height: b.top + b.height - a.top }; })(), ks[Math.floor(Math.random() * ks.length)], quick ? 500 : 1300, () => { reels.transformReel(r, res.grid[r]); shake(); A.play('crack'); }); }
    toast('DRIFT WILD!', 1100); }
  if (!mode && !res.trigger && res.flags === 2 && tease.some(Boolean)) { fxs({ kind: 'almost' }); toast('SO CLOSE! 2 FLAGS', 1100); }
  shown = res.grid.map(col => col.map(c => ({ ...c })));
}
function markWins(res) { const cells = new Set(); for (const w of res.ways) for (const [r, y] of w.cells) cells.add(r + ',' + y);
  if (res.jackpot) res.grid.forEach((col, r) => cells.add(r + ',1'));
  if (res.trigger || res.retrig) res.grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'FL' || (res.trigger && res.trigger.type === 'charge' && c.s === 'PL')) cells.add(r + ',' + y); }));
  if (cells.size) reels.setWin(cells); return cells.size; }
// returns credits won on this spin (base or free)
async function resolve(res, mode) {
  const n = markWins(res); let win = res.win;
  if (res.jackpot) { await jackpotWin('grand', res.jackpot.win, 'FIVE OUTLANDER PHEVs ON THE CENTRE ROW'); return win; }
  if (win > 0) { const ways = res.ways.length; A.play('win', ways); const best = res.ways.slice().sort((a, b) => b.pay - a.pay)[0];
    const wb = $('winBanner'); wb.textContent = `${best.len}× ${M.SYM[best.s].name.toUpperCase()}${best.mult > 1 ? ' ×' + best.mult : ''}${res.prog > 1 ? ' · MULT ×' + res.prog : ''} · WIN ${fmt(win)}`; wb.classList.remove('hidden');
    const t = M.tier(win, bet()); if (t === 'win') await roll('win', disp.win + win, Math.min(1400, 400 + win / bet() * 120), true); else { await bigWin(win, t); disp.win += win; meters(); }
    await sleep(quick ? 150 : mode ? 500 : 650); }
  else if (n) await sleep(400);
  return win; }
function meterPulse(m) { meters(); if (m.full) { toast('MADNESS METER FULL!', 1500); A.play('turbo'); } }
// ---------------- big wins ----------------
const TIER_TXT = { big: 'BIG WIN', mega: 'MEGA WIN', madness: 'MITSUBISHI MADNESS!', total: 'BONUS TOTAL' };
function bigWin(amount, tier, sub) { return new Promise(async res => { const b = $('big'); fxs({ kind: 'big', tier, amount });
  b.className = tier; $('bigTitle').textContent = TIER_TXT[tier] || 'BIG WIN'; $('bigSub').textContent = sub || ''; $('bigAmt').textContent = '0.00'; b.classList.remove('hidden');
  A.play('bigWin'); if (tier !== 'big' && tier !== 'total') { A.play('fanfare'); FX.fireworks(3000); } FX.coinRain(tier === 'madness' ? 4200 : 2600, tier === 'big' ? 2 : 4); FX.flyBy(tier === 'madness' ? 'phev' : tier === 'mega' ? 'ev' : 'ec', 1600);
  let done = false; const t0 = performance.now(), ms = (tier === 'madness' ? 4200 : tier === 'mega' ? 3200 : tier === 'total' ? 1400 : 2200) * SPD() * (quick ? .2 : 1);
  const fin = () => { if (done) return; done = true; b.onclick = null; $('bigAmt').textContent = fmt(amount); setTimeout(() => { b.classList.add('hidden'); res(); }, 350 * SPD()); };
  const step = now => { if (done) return; const u = Math.min(1, (now - t0) / ms); $('bigAmt').textContent = fmt(amount * u); if (Math.random() < .3) A.play('coin', Math.random() * 7 | 0); if (u < 1) requestAnimationFrame(step); else setTimeout(fin, 1300 * SPD()); };
  requestAnimationFrame(step); setTimeout(() => { b.onclick = fin; }, 500); setTimeout(fin, ms + 6000); }); }
async function jackpotWin(id, amount, how) { fxs({ kind: 'jackpot', id, amount }); await cinematic({ title: M.JP_NAME[id] + '!', sub: 'JACKPOT', color: '#ffc400', car: id === 'grand' ? 'phev' : id === 'major' ? 'out' : id === 'minor' ? 'ec' : 'rvr', dur: 2400 });
  await bigWin(amount, amount >= 60 * bet() ? 'madness' : amount >= 25 * bet() ? 'mega' : 'big', M.JP_NAME[id] + ' JACKPOT' + (how ? ' · ' + how : '')); disp.win += amount; meters(); }
// ---------------- triggers ----------------
async function trigger(t, F) {
  window.__bonusWin = 0; auto = false; $('autoBtn').classList.remove('on');
  if (t.type === 'charge') { fxs({ kind: 'trigger', type: 'charge' }); toast('3 CHARGE PLUGS!', 1200); await sleep(700); return runFeature('charge', F); }
  fxs({ kind: 'trigger', type: 'wheel', tier: t.tier, via: t.via }); if (t.via === 'meter') { toast('MADNESS METER FULL — WHEEL TIME!', 1500); await sleep(800); } else await sleep(600);
  await cinematic({ title: 'MADNESS WHEEL', sub: t.via === 'meter' ? 'METER FULL' : `${t.tier + 2} CHECKERED FLAGS`, color: '#ffd84a', car: 'ec', dur: 1900 });
  const w = await wheel(t.tier, F); let total = w.win; window.__bonusWin = total;
  if (w.wedge.jp && !w.locked) await jackpotWin(w.wedge.jp, w.win); else if (w.win) await roll('win', disp.win + w.win, 900, true);
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
    if (win > 0) { const t = M.tier(win, bet()); if (t !== 'win') { await bigWin(win, t, { rally: 'RALLY RACE', offroad: 'S-AWC CHALLENGE', charge: `PHEV CHARGE · ${R.km} km` }[R.kind]); disp.win += win; meters(); } else await roll('win', disp.win + win, 900, true); }
  }
  return win; }
// ---------------- Madness Wheel ----------------
const WCOL = { feat: ['#ff2040', '#a0001a'], spins: ['#ff8a00', '#a04000'], credit: ['#5a6178', '#2b2f3d'], mini: ['#20d0b8', '#087a6c'], minor: ['#ff8a3a', '#b2400a'], major: ['#7b5cff', '#3a1fb0'], grand: ['#ffdf5a', '#b26a00'], charge: ['#22c3ff', '#0a5fa8'], offroad: ['#30e060', '#147a30'], rally: ['#ff2040', '#90001a'] };
const wcol = w => w.jp ? WCOL[w.jp] : w.x ? WCOL.credit : WCOL[w.feat] || WCOL.spins;
let wheelRot = 0;
function drawWheel(rot, locks, hot) { const cv = $('wheel'), g = cv.getContext('2d'), W = cv.width, R = W / 2 - 10, n = M.WHEEL.length, a = Math.PI * 2 / n; g.clearRect(0, 0, W, W); g.save(); g.translate(W / 2, W / 2);
  g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, R + 8, 0, 7); g.fill(); g.rotate(rot);
  M.WHEEL.forEach((w, i) => { const a0 = -Math.PI / 2 + (i - .5) * a, c = wcol(w), gr = g.createRadialGradient(0, 0, R * .2, 0, 0, R); gr.addColorStop(0, c[1]); gr.addColorStop(.7, c[0]); gr.addColorStop(1, c[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + a); g.closePath(); g.fill(); g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.stroke();
    if (hot === i) { g.fillStyle = `rgba(255,255,255,${.3 + .3 * Math.sin(performance.now() / 80)})`; g.fill(); }
    g.save(); g.rotate(a0 + a / 2); g.fillStyle = w.jp === 'grand' ? '#3a0a00' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; // radial labels, reading outwards
    const parts = w.label.split(' '), maxW = R * .56; let fs = 34; g.font = `900 ${fs}px Russo,sans-serif`; while (fs > 14 && Math.max(...parts.map(p => g.measureText(p).width)) > maxW) { fs--; g.font = `900 ${fs}px Russo,sans-serif`; }
    g.shadowColor = '#000'; g.shadowBlur = 4; parts.forEach((p, k) => g.fillText(p, R * .62, (k - (parts.length - 1) / 2) * fs * 1.05)); g.shadowBlur = 0; g.restore();
    if (locks && locks.includes(w.id)) { g.save(); g.fillStyle = 'rgba(0,0,0,.62)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a0 + a); g.closePath(); g.fill(); g.rotate(a0 + a / 2); g.translate(R * .8, 0); g.rotate(Math.PI / 2); g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🔒', 0, 0); g.restore(); } });
  for (let i = 0; i < n; i++) { const aa = -Math.PI / 2 + (i - .5) * a; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(Math.cos(aa) * (R + 2), Math.sin(aa) * (R + 2), 6, 0, 7); g.fill(); }
  g.restore(); }
function wheel(tier, F) { return new Promise(async (resolveWheel) => {
  const box = $('wheelBox'), hub = $('wheelHub'); const w = M.spinWheel(bet(), rng, tier, { forceIdx: F.idx, forceRevUp: F.revUp }); window.__lastWheel = w;
  let locks = M.LOCKS[tier]; box.classList.remove('hidden'); $('wheelTier').textContent = `${tier + 2} FLAGS · ${locks.length ? locks.length + ' LOCKED' : 'ALL UNLOCKED'}`; $('wheelMsg').textContent = ''; hub.disabled = true; hub.textContent = 'SPIN';
  drawWheel(wheelRot, locks); A.music(true);
  let finished = false; const safety = setTimeout(() => { if (!finished) { finished = true; window.__wheelSafety = (window.__wheelSafety || 0) + 1; box.classList.add('hidden'); A.music(false); resolveWheel(w); } }, 45000 * SPD());
  try {
    if (w.revUp) { await sleep(600); $('wheelMsg').textContent = 'REV UP!'; A.play('rev', 1.6); fxs({ kind: 'revup' }); await sleep(1500); A.play('unlock'); shakeWheel(); locks = w.locks; drawWheel(wheelRot, locks); $('wheelTier').textContent = `TIER ${w.tier} · ${locks.length ? locks.length + ' LOCKED' : 'ALL UNLOCKED'}`; $('wheelMsg').textContent = 'LOCKS SMASHED!'; FX.sparks(innerWidth / 2, innerHeight / 2, 60, '#ffd84a'); await sleep(900); }
    $('wheelMsg').textContent = 'TAP SPIN'; hub.disabled = false;
    await new Promise(r => { let fired = false; const go = () => { if (fired) return; fired = true; hub.disabled = true; hub.onclick = null; $('wheelWrap').onclick = null; r(); }; hub.onclick = go; $('wheelWrap').onclick = go; setTimeout(go, 7000 * SPD()); });
    $('wheelMsg').textContent = ''; A.play('whoosh');
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
  } finally { if (!finished) { finished = true; clearTimeout(safety); box.classList.add('hidden'); A.music(false); resolveWheel(w); } }
}); }
function shakeWheel() { const e = $('wheelWrap'); e.classList.remove('shakeX'); void e.offsetWidth; e.classList.add('shakeX'); }
// ---------------- free spins ----------------
const MODE_INFO = { turbo: { c: '#ff8a00', car: 'ec', feats: 'Wilds carry ×2 – ×10 multipliers<br>3 flags = +5 spins · may GEAR UP to NITRO' }, nitro: { c: '#22c3ff', car: 'ev', feats: 'Multiplier wilds + DRIFT WILD reels<br>3 flags = +5 spins · may GEAR UP to MADNESS' }, madness: { c: '#ff2040', car: 'phev', feats: 'Multiplier wilds + DRIFT WILD reels<br>Win multiplier climbs ×1 → ×10 with every win' } };
function splash(mode, n) { return new Promise(res => { const s = $('splash'), info = MODE_INFO[mode]; s.style.setProperty('--modeC', info.c); $('splashTitle').textContent = M.MODES[mode].name.split(' ')[0]; $('splashSub').textContent = `${n} FREE SPINS`; $('splashFeats').innerHTML = info.feats; s.classList.remove('hidden');
  let done = false; const go = () => { if (done) return; done = true; s.classList.add('hidden'); $('startBtn').onclick = null; s.onclick = null; A.play('rev', 1); res(); }; setTimeout(() => { $('startBtn').onclick = go; s.onclick = go; }, 300); setTimeout(go, (quick ? 1500 : 9000) * SPD()); }); }
function setModeLook(mode) { const f = $('frame'); f.classList.remove('mode-turbo', 'mode-nitro', 'mode-madness'); $('app').classList.toggle('free', !!mode); FX.setMode(mode); if (mode) { f.classList.add('mode-' + mode); $('modeHud').style.setProperty('--modeC', MODE_INFO[mode].c); $('hudMode').textContent = M.MODES[mode].name; $('hudMultW').classList.toggle('hidden', mode !== 'madness'); } $('modeHud').classList.toggle('hidden', !mode); }
async function freeRound(R, F) {
  const mode0 = R.mode, info = MODE_INFO[mode0];
  await cinematic({ title: M.MODES[mode0].name + '!', sub: `${M.FS_START[mode0]} FREE SPINS`, color: info.c, car: info.car, dur: 2200 });
  await splash(mode0, M.FS_START[mode0]);
  let mode = mode0, won = 0, total = M.FS_START[mode0]; setModeLook(mode); A.music(true);
  const hud = (i) => { $('hudSpins').textContent = `${i} OF ${total}`; $('hudWin').textContent = fmt(won); };
  try {
    for (let i = 0; i < R.spins.length; i++) { const s = R.spins[i];
      if (R.gearUp && R.gearUp.at === i) { fxs({ kind: 'gearup', to: R.gearUp.to }); A.play('gear'); await cinematic({ title: 'GEAR UP!', sub: M.MODES[R.gearUp.to].name + ` · +${R.gearUp.add} SPINS`, color: MODE_INFO[R.gearUp.to].c, car: MODE_INFO[R.gearUp.to].car, dur: 2000 }); mode = R.gearUp.to; total += R.gearUp.add; setModeLook(mode); }
      hud(i + 1); $('hudMult').textContent = '×' + (s.prog || 1); A.play('spin');
      await animateReels(s, mode); const w = await resolve(s, mode); won += w; window.__bonusWin = (window.__bonusWin || 0) + w; hud(i + 1);
      if (s.retrig) { total += s.retrig; fxs({ kind: 'retrig' }); A.play('fanfare'); toast(`+${s.retrig} SPINS!`, 1300); hud(i + 1); await sleep(900); }
      await sleep(quick ? 80 : 250); }
  } finally { A.music(false); setModeLook(null); curMode = null; reels.clearWin(); $('winBanner').classList.add('hidden'); }
  if (won > 0) await bigWin(won, M.tier(won, bet()) === 'win' ? 'total' : M.tier(won, bet()), `${M.MODES[R.finalMode].name} TOTAL · ${R.played} SPINS`);
  return won; }
// ---------------- recovery ----------------
function recoverScreen() { try { clearCine('recover'); } catch (e) {} clearWinBanner(); for (const id of ['wheelBox', 'splash', 'big']) $(id).classList.add('hidden'); try { SC.close(); } catch (e) {} setModeLook(null); curMode = null; $('frame').classList.remove('spinning', 'tease'); A.music(false); reels.setGrid(shown); }
// ---------------- attract mode ----------------
const ATTRACT = ['WIN THE PHEV GRAND!', 'PHEV CHARGE · UP TO 72 km = 72 CREDITS × BET', 'RALLY RACE · PICK YOUR CAR', 'S-AWC CHALLENGE · CONQUER 5 STAGES', 'DRIFT WILDS!', 'TURBO · NITRO · MADNESS SPINS', '3 FLAGS SPIN THE MADNESS WHEEL'];
let idleT = 0, attractOn = false, attractI = 0, attractTimer = 0;
function idleKick() { clearTimeout(idleT); idleT = setTimeout(enterAttract, (DEBUG ? 600000 : 30000)); }
function enterAttract() { if (busy || attractOn) return; attractOn = true; FX.setAttract(true); $('attract').classList.remove('hidden'); const tick = () => { $('attractTxt').textContent = ATTRACT[attractI++ % ATTRACT.length]; const t = $('attractTxt'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; }; tick(); attractTimer = setInterval(tick, 3000); }
function exitAttract() { if (!attractOn) { idleKick(); return; } attractOn = false; FX.setAttract(false); $('attract').classList.add('hidden'); clearInterval(attractTimer); idleKick(); }
addEventListener('pointerdown', exitAttract, { passive: true }); idleKick();
window.__attract = { enter: () => { busy || enterAttract(); }, exit: exitAttract, get on() { return attractOn; } };
// ---------------- menu / paytable ----------------
function showPay() { const b = bet(); let h = `<p>243 ways: matching models on adjacent reels from the left pay, anywhere on each reel. Bet ${b} credit${b > 1 ? 's' : ''} (1 credit = $1 play money). Ranked by top-trim MSRP.</p><table><tr><th></th><th>Model</th><th>3</th><th>4</th><th>5</th></tr>`;
  for (const s of M.CARS.slice().reverse()) h += `<tr><td><img src="/madness/art/${s}.webp?v=1" alt=""></td><td>${M.SYM[s].name}<br><small>$${M.SYM[s].msrp.toLocaleString()}</small></td>${M.PAY[s].map(v => `<td>${fmt(v * b)}</td>`).join('')}</tr>`;
  h += `</table><p>Pays shown per way at your bet. <b>5 Outlander PHEVs on the centre row = PHEV GRAND (${usd(M.JP.grand * b)})</b>.</p><h3>Specials</h3><p><img src="/madness/art/WD.webp" alt=""> MADNESS WILD (reels 2-4) substitutes for every model; in base play it can carry ×2/×3, in free spins ×2 – ×10. Multipliers on one way multiply.</p>
  <p><img src="/madness/art/FL.webp" alt=""> 3 / 4 / 5 CHECKERED FLAGS anywhere spin the MADNESS WHEEL (more flags = fewer locked wedges).</p><p><img src="/madness/art/PL.webp" alt=""> 3 CHARGE PLUGS (reels 1, 3, 5) start PHEV CHARGE.</p>`;
  $('menuBody').innerHTML = h; }
function showRules() { $('menuBody').innerHTML = `<h3>DRIFT WILD</h3><p>Any spin, a car can drift across reel 2, 3 or 4 in a cloud of tyre smoke and turn the whole reel WILD.</p>
  <h3>MADNESS METER</h3><p>Every checkered flag that lands without a wheel adds to the meter. Full meter = a free Madness Wheel.</p>
  <h3>MADNESS WHEEL</h3><p>12 wedges: TURBO / NITRO / MADNESS SPINS, RALLY RACE, S-AWC CHALLENGE, PHEV CHARGE, 10× and 25× bet, and the RVR MINI (${M.JP.mini}×), ECLIPSE MINOR (${M.JP.minor}×), OUTLANDER MAJOR (${M.JP.major}×) and PHEV GRAND (${M.JP.grand}×) jackpots. With 3 flags the GRAND, MAJOR and MADNESS wedges are locked (5× bet); 4 flags lock only the GRAND; 5 flags unlock everything. REV UP can smash the locks before the spin.</p>
  <h3>FREE SPINS</h3><p>TURBO (8): multiplier wilds. NITRO (8): + drift wild reels. MADNESS (10): + a win multiplier that climbs to ×10. 3 flags = +5 spins. GEAR UP can upgrade the round mid-way.</p>
  <h3>RALLY RACE</h3><p>Pick one of four cars and watch the race. 1st = 30× (NITRO FINISH doubles it to 60×), 2nd = 15×, 3rd = 8×, 4th = 4× bet.</p>
  <h3>S-AWC CHALLENGE</h3><p>Five trail stages. Each cleared stage pays 2× – 10× bet. Get STUCK and it ends — but S-AWC can rescue you once. Clear all 5 for a 20× SUMMIT bonus.</p>
  <h3>PHEV CHARGE</h3><p>The Outlander PHEV plugs in. Tap to charge in bursts of 3 – 9 km (REGEN BOOST doubles a burst). A POWER SURGE can stop the charge. Every km = 1 credit × bet; a FULL CHARGE is 72 km = 72 credits × bet (exactly 72 credits at bet 1).</p>`; }
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
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); spin(); } });
meters();
window.G = { st, M, spin, insertBill, cashOut, get busy() { return busy; }, get mode() { return curMode; }, setBet: i => { st.bet = i; save(); meters(); }, recoverScreen, cinematic, reels, drawWheel };
if (DEBUG) { window.G.force = k => { forceNext = k; }; const d = $('dbg'); d.classList.remove('hidden');
  d.innerHTML = ['win', 'big', 'mega', 'madness', 'wild', 'drift', 'almost', 'meter', 'jackpot', 'wheel3', 'wheel4', 'wheel5', 'revup', 'locked', 'turbo', 'nitro', 'madspins', 'gearup', 'rally', 'rally1', 'offroad', 'summit', 'rescue', 'charge', 'full72', 'surge', 'wcharge', 'mini', 'minor', 'major', 'grandwheel'].map(k => `<button data-f="${k}">${k}</button>`).join('');
  d.addEventListener('click', e => { const k = e.target.dataset.f; if (k) { forceNext = k; toast('next: ' + k, 900); } }); }
})();
