// GORILLA - play-money slot cabinet: reels, bill acceptor, ticket printer, Temple Drum Wheel, JUNGLE / FURY / INFERNO SPINS, Rampage Meter, gorilla reactions.
const M = window.GorillaMath, A = window.GorillaAudio, SY = window.GorillaSymbols;
const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search), DEBUG = qs.has('debug');
const sleep = ms => new Promise(r => setTimeout(r, ms * (window.__gorillaSpeed || 1)));
const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const denomTxt = d => d >= 100 ? '$' + d / 100 : d + '¢';
// ---------------- state ----------------
const KEY = 'gorillaState1';
const st = Object.assign({ cents: 0, denom: 1, bet: 0, lastWin: 0, ticketNo: 1000, inserted: 0, played: 0, meter: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
if (!M.DENOMS.includes(st.denom)) st.denom = 1; if (!(st.bet >= 0 && st.bet < M.BETS.length)) st.bet = 0;
const save = () => localStorage.setItem(KEY, JSON.stringify(st));
const bet = () => M.BETS[st.bet], betCents = () => bet() * st.denom, credits = () => Math.floor(st.cents / st.denom);
let busy = false, rng = M.cryptoRng(), forceNext = null, quick = false;
// ---------------- gorilla: photoreal video director (3D only with ?ape=3d) ----------------
const Q = qs.get('q') || localStorage.getItem('gorillaQ') || undefined;
let ape = null;
const stub = { chestBeat: () => sleep(800), roar: () => sleep(1500), slam: (x, f) => sleep(900).then(() => f && f()), punch: f => sleep(900).then(() => f && f()), stare: () => 0, watch: () => 0, anticipate: () => 0, lose: () => 0, smallWin: () => 0, settle: () => 0, reactBill: () => 0, nod: () => 0, lookAt: () => 0, lightning: () => 0, busy: () => false, on: {}, fps: 60, setQuality: q => { localStorage.setItem('gorillaQ', q); location.reload(); } };
async function use3D() { // only with ?ape=3d
  try { const { Ape } = await import('/gorilla/ape.js'); $('scene').classList.add('hidden'); $('ape').classList.remove('hidden'); ape = new Ape($('ape'), { quality: Q === 'low' ? 'low' : 'med', frameFrac: .5 }); for (const k of ['watch', 'anticipate', 'lose', 'smallWin', 'settle', 'stare']) ape[k] = ape[k] || (() => 0); if (!ape.punch) ape.punch = f => Promise.resolve(ape.slam && ape.slam()).then(() => f && f()); }
  catch (e) { console.warn('3D gorilla unavailable', e); ape = stub; $('ape').classList.add('hidden'); $('fallbackBg').classList.remove('hidden'); }
  wireApe(); requestAnimationFrame(() => layout());
}
function wireApe() { window.ape = ape;
  const marked = f => Promise.resolve(sleep(700)).then(() => { f && f(); return sleep(500); }); // non-video apes: the cue fires on a clock
  for (const k of ['thunder', 'awaken', 'swipe', 'lunge', 'heave', 'fistThrow']) if (!ape[k]) ape[k] = marked;
  for (const k of ['pound', 'breath', 'dismiss', 'look', 'loadBonus', 'calm']) if (!ape[k]) ape[k] = () => Promise.resolve();
  if (ape.punch && ape.kind !== 'video') { const p = ape.punch.bind(ape); ape.punch = (f) => p(f); }
  ape.on = ape.kind === 'video' ? { slam: () => shakeDom(), beat: () => shakeDom(), thunder: () => A.play('thunder') } : { beat: () => A.play('beat'), roar: () => A.play('roar'), slam: () => { A.play('slam'); shakeDom(); }, thunder: () => A.play('thunder') };
  ape.onShake = sk => { $('machine').style.transform = sk > .002 ? `translate(${(Math.random() - .5) * sk * 22}px,${(Math.random() - .5) * sk * 18}px)` : ''; }; }
if (qs.get('ape') === '3d') await use3D();
else { try { const { VideoApe, glog } = await import('/gorilla/video.js?v=' + (new URL(import.meta.url).searchParams.get('v') || '4')); window.glog = glog; ape = new VideoApe($('scene'), { quality: qs.get('q') || localStorage.getItem('gorillaVQ') || undefined });
    ape.gameBusy = () => busy; wireApe(); }
  catch (e) { console.warn(e); ape = stub; wireApe(); $('scene').style.background = 'url(/gorilla/media/v3/poster.jpg?v=4) center top/cover no-repeat #050101';
    fetch('/gorilla/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'video-module-failed', msg: String(e && e.message || e), ua: navigator.userAgent }) }).catch(() => {}); } }
function shakeDom() { const m = $('frame'); m.classList.remove('shakeX'); void m.offsetWidth; m.classList.add('shakeX'); }
// ---------------- canvas reels ----------------
let curFree = false, curRows = 3;
const reels = new window.GorillaReels($('reelCv'), { randomSym: r => randomSym(r, curFree), coinText: c => money(c.coin * st.denom).replace('.00', ''), onGlint: () => A.play('glint', Math.random() * 7 | 0) }); window.reels = reels;
// ---------------- portrait layout: gorilla on top, reels in the middle, controls at the bottom ----------------
function layout() {
  const vw = innerWidth, vh = innerHeight, land = vw > vh * 1.02, coarse = matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('rotate', land && coarse);
  const app = $('app'), W = Math.min(vw, Math.round(vh * .78)), H = vh, pr = getComputedStyle($('safeProbe')), stp = parseFloat(pr.paddingTop) || 0, sbp = parseFloat(pr.paddingBottom) || 0;
  const k = Math.max(.82, Math.min(2.1, Math.min(W / 390, H / 844))), wide = W / H > .6;
  const barH = Math.round(132 * k + sbp), side = Math.round(6 * k), fw = Math.round(wide ? W * .84 : W - 2 * side), pad = Math.round(7 * k);
  const gap = Math.max(3, (fw - 2 * pad) * .012), colW = (fw - 2 * pad - 2 * gap) / 3, avail = H - barH - Math.round(34 * k);
  const cellH = Math.max(colW * .64, Math.min(colW * .9, (avail - H * (wide ? .47 : .45) - 2 * pad) / 3)), fh3 = Math.round(3 * cellH + 2 * pad), top3 = Math.round(avail - fh3);
  // v5 growing reels: the frame grows UP over the gorilla's ledge (he stays put); cells shrink so 7 rows still fit under the plaques
  const rows = curRows, maxFh = avail - Math.round(stp + H * (wide ? .1 : .12)), cellR = rows > 3 ? Math.min(cellH, (maxFh - 2 * pad) / rows) : cellH, fh = Math.round(rows * cellR + 2 * pad), top = Math.round(avail - fh);
  const v = { '--appW': W + 'px', '--k': k.toFixed(3), '--top': top + 'px', '--top3': top3 + 'px', '--fbot': avail + 'px', '--fw': fw + 'px', '--fh': fh + 'px', '--fx': Math.round((W - fw) / 2) + 'px', '--pad': pad + 'px', '--barH': barH + 'px', '--st': stp + 'px', '--sb': sbp + 'px' };
  for (const n in v) app.style.setProperty(n, v[n]); app.classList.toggle('wide', wide); app.classList.toggle('grown', rows > 3);
  if (ape && ape.resize) { ape.resize({ top: top3 + pad * .6, width: W }); if (ape.geom) app.style.setProperty('--gw', Math.round(ape.geom.w) + 'px'); }
  reels.resize(); }
let mediaFiles = [];
fetch('/gorilla/media/manifest.json').then(r => r.ok ? r.json() : { files: [] }).then(j => { mediaFiles = j.files || []; for (const c of SY.codes) if (mediaFiles.includes(`sym-${c}.png`)) SY.useCustom(c, `/gorilla/media/sym-${c}.png`); }).catch(() => {});
function playMedia(name) { if (!mediaFiles.includes(name) || quick) return Promise.resolve(false); const v = $('cine'); return new Promise(res => { let done = false; const end = () => { if (done) return; done = true; v.pause(); v.classList.add('hidden'); v.onclick = null; res(true); };
  v.src = '/gorilla/media/' + name; v.muted = A.muted; v.classList.remove('hidden'); v.onended = end; v.onerror = end; v.onclick = end; v.play().catch(end); setTimeout(end, 15000); }); }
// full-screen cinematic takeover (bonus trigger, mega/monster wins). skippable, short on purpose so play stays snappy
function playTakeover(o = {}) {
  if (quick) return Promise.resolve(false);
  const v = $('cine'), q = (ape && ape.res === 'sd') ? 'sd' : 'hd', startAt = o.startAt == null ? 1.8 : o.startAt, dur = o.dur || 2800;
  v.src = `/gorilla/media/v5/rampage-${q}.mp4?v=6`; v.muted = A.muted; v.classList.add('full'); v.classList.remove('hidden'); $('app').classList.add('quake');
  if (o.snd !== false) { A.play('roar'); A.play('thunder'); } shakeDom();
  return new Promise(res => { let done = false;
    const end = () => { if (done) return; done = true; v.pause(); v.classList.add('hidden'); v.classList.remove('full'); $('app').classList.remove('quake'); v.onclick = null; res(true); };
    const go = () => { try { v.currentTime = startAt; } catch (e) {} v.play().catch(end); };
    v.onended = end; v.onerror = end; v.onclick = end;
    if (v.readyState >= 1) go(); else v.onloadedmetadata = go;
    setTimeout(end, dur * (window.__gorillaSpeed || 1) + 500); }); }
// ---------------- reels ----------------
let shown = [0, 1, 2].map(r => [0, 1, 2].map(y => ({ s: M.STRIPS[r][(r * 7 + y) % M.STRIPS[r].length] })));
function renderStatic() { reels.setGrid(shown); }
function randomSym(r, free) { const s = (free ? (M.MODE_STRIPS[free] || M.FREE_STRIPS) : M.STRIPS)[r]; const x = s[Math.floor(Math.random() * s.length)]; return { s: x, mult: x === 'WD' ? [2, 3, 5, 10][Math.random() * 4 | 0] : null, coin: x === 'CN' ? bet() * [.5, 1, 2][Math.random() * 3 | 0] : null }; }
async function animateReels(res, mode) {
  curFree = mode || false; const nz = res.nudge; // a punch-nudge spin first lands one stop off; Totem Stacks land as the pre-stack symbols, then transform
  let grid = res.pre || res.grid; if (nz) grid = grid.map((col, r) => r === nz.r ? nz.pre : col);
  if (res.thunder) grid = grid.map((col, r) => col.map((c, y) => r === res.thunder.r && y === res.thunder.y ? { ...c, mult: null } : c)); // thunder wild lands plain
  const drums = r => grid[r].some(c => c.s === 'DR'), coins = r => grid[r].filter(c => c.s === 'CN').length;
  const tease = !mode && ((drums(0) && drums(1)) || (coins(0) + coins(1) >= 2 && Math.random() < .6));
  A.play('whoosh'); clearMarks(); const fast = quick ? .35 : 1, sp = window.__gorillaSpeed || 1;
  const spinSec = ((.95 + 2 * .38 + (tease ? 1.9 : 0)) * fast + .1 + .34) * sp; // last reel's stop + settle (reels.js timing)
  if (!quick) { const hot = [0, 1, 2].filter(r => grid[r].some(c => c.s === 'DR' || c.s === 'CN' || (c.s === 'WD' && c.mult > 1)));
    const side = nz ? nz.r : (hot.length ? hot[hot.length - 1] : (Math.random() * 3 | 0));
    if (mode && Math.random() < .4) ape.look(spinSec); else ape.watch(spinSec, side); } // eyes on the left, middle or right reel
  await reels.spin(grid, { free: !!mode, fast, tease: [false, false, tease],
    onStop: (r, cells) => { A.play('reelStop', r); cells.forEach((c, y) => { if (c.s === 'DR') A.play('drum', r); else if (c.s === 'CN') A.play(c.locked ? 'rattle' : 'glint', r * 3 + y); else if (c.s === 'WD' || c.s === 'FI') A.play('glint', 6); }); if (r === 2) $('frame').classList.remove('tease'); },
    onTease: (r, dur) => { $('frame').classList.add('tease'); A.play('tease', dur); if (!quick) ape.anticipate(); } });
  $('frame').classList.remove('tease'); res.teased = tease;
  if (nz) { await sleep(quick ? 80 : 420); // GORILLA PUNCH: a beat, then one fist; fire column + shake on the impact frame
    let jolt = null; await ape.punch(() => { fxs({ kind: 'nudge', at: performance.now() }); A.play('slam'); A.play('crack'); A.play('thunder'); reels.fireCol(nz.r); shakeDom(); jolt = reels.nudge(nz.r, nz.dir, res.grid[nz.r]); }, nz.r);
    await jolt; await sleep(quick ? 60 : 280); }
  if (res.stack) { await sleep(quick ? 60 : 220); reels.transform(res.stack.cells, res.stack.s); A.play('sparkle'); A.play('glint', 3); fxs({ kind: 'stack', at: performance.now() }); await sleep(quick ? 150 : 650); }
  shown = res.grid.map(col => col.map(c => ({ ...c })));
}
function clearMarks() { reels.clearWin(); $('winBanner').classList.add('hidden'); }
function markWins(res) { const cells = new Set(); for (const w of res.ways) for (let r = 0; r < 3; r++) res.grid[r].forEach((c, y) => { if (c.s === w.s || (r === 1 && c.s === 'WD')) cells.add(r + ',' + y); });
  if (res.coins.pay) res.coins.list.forEach(c => { if (!c.locked || res.coins.smashed) cells.add(c.r + ',' + c.y); }); if (res.bonus) res.grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'DR') cells.add(r + ',' + y); }));
  if (!cells.size) return; reels.setWin(cells); A.play('sparkle'); }
// ---------------- meters ----------------
const disp = { cents: st.cents, win: 0 }; let rollRAF = 0;
function meters() { $('mCash').textContent = money(disp.cents); $('mCred').textContent = Math.floor(disp.cents / st.denom).toLocaleString(); $('mBet').textContent = bet(); $('mBetD').textContent = money(betCents()); $('mWin').textContent = Math.round(disp.win).toLocaleString();
  $('denomTxt').textContent = denomTxt(st.denom); const b = betCents(); $('jpT').textContent = money(1000 * b); $('jpG').textContent = money(250 * b); $('jpS').textContent = money(75 * b); $('jpB').textContent = money(25 * b);
  $('spinBtn').disabled = false; $('betDn').disabled = $('betUp').disabled = $('maxBtn').disabled = $('denomBtn').disabled = busy; $('cashBtn').disabled = busy || st.cents <= 0; }
function roll(key, to, ms, tick) { return new Promise(res => { const from = disp[key], t0 = performance.now(); ms *= (window.__gorillaSpeed || 1); if (quick) ms = Math.min(ms, 300); let last = 0;
  const step = now => { const u = Math.min(1, (now - t0) / ms); disp[key] = from + (to - from) * u; meters(); if (tick && now - last > 70) { last = now; A.play('tick'); } if (u < 1) requestAnimationFrame(step); else { disp[key] = to; meters(); res(); } }; requestAnimationFrame(step); }); }
function toast(msg, ms = 1800) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), ms); }
// ---------------- bill acceptor & ticket ----------------
async function insertBill() { if (busy) return; A.init(); busy = true; meters(); const b = $('bill'); b.classList.remove('hidden', 'go'); void b.offsetWidth; b.classList.add('go'); A.play('bill'); ape.reactBill();
  await sleep(1250); b.classList.add('hidden'); st.cents += 10000; st.inserted += 10000; save(); playMedia('bill-insert.mp4'); await roll('cents', st.cents, 1100, true); A.play('coin', 7); busy = false; meters(); }
async function cashOut() { if (busy || st.cents <= 0) return; A.init(); busy = true; meters(); const amt = st.cents, no = ++st.ticketNo; st.cents = 0; save();
  const t = $('ticket'); t.innerHTML = `<h4>GORILLA</h4><div>CASH-OUT VOUCHER</div><div class=amt>${money(amt)}</div><div>PLAY MONEY · NO CASH VALUE</div><div>${new Date().toLocaleString()}</div><div>TICKET #${no}</div><div class=bc></div><div style="text-align:center;margin-top:4px">tap to take ticket</div>`;
  t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; A.play('ticket'); await roll('cents', 0, 1300, false); disp.win = 0; busy = false; meters();
  t.onclick = () => t.classList.add('hidden'); setTimeout(() => t.classList.add('hidden'), 12000); ape.nod(); }
// ---------------- spin ----------------
// ---------------- spin ----------------
// debug / test forces (?debug=1): each feature on demand
const fxs = o => { window.__gorillaFx = o; (window.__fxBy = window.__fxBy || {})[o.kind] = o; };
const WIDX = id => M.WHEEL.findIndex(w => w.id === id);
function forceOf(kind) {
  const set = (g, r, y, c) => { g[r][y] = c; }, drums = n => g => { for (let r = 0; r < 3; r++) for (let y = 0; y < 3; y++) if (g[r][y].s === 'DR') g[r][y] = { s: 'EM' }; for (let r = 0; r < n; r++) set(g, r, 1, { s: 'DR' }); };
  const grids = {
    smash: g => { set(g, 0, 0, { s: 'CN', locked: true }); set(g, 2, 2, { s: 'CN', locked: true }); set(g, 0, 2, { s: 'CN', locked: false }); set(g, 1, 1, { s: 'WD', mult: 2 }); },
    win: g => { set(g, 0, 1, { s: 'BN' }); set(g, 1, 1, { s: 'BN' }); set(g, 2, 1, { s: 'BN' }); },
    thunder: g => { set(g, 0, 1, { s: 'MK' }); set(g, 1, 1, { s: 'WD', mult: 5 }); set(g, 2, 1, { s: 'MK' }); for (const r of [0, 2]) for (const y of [0, 2]) if (g[r][y].s === 'MK') g[r][y] = { s: 'RB' }; },
    respin: g => { set(g, 0, 0, { s: 'CN', locked: false }); set(g, 1, 1, { s: 'CN', locked: false }); set(g, 1, 2, { s: 'CN', locked: false }); set(g, 2, 2, { s: 'CN', locked: false }); },
    big: g => { set(g, 0, 1, { s: 'SB' }); set(g, 1, 1, { s: 'WD', mult: 5 }); set(g, 2, 1, { s: 'SB' }); },
    mega: g => { for (const y of [0, 1]) { set(g, 0, y, { s: 'SB' }); set(g, 2, y, { s: 'SB' }); } set(g, 1, 1, { s: 'WD', mult: 3 }); },
    monster: g => { for (const y of [0, 1, 2]) { set(g, 0, y, { s: 'SB' }); set(g, 2, y, { s: 'SB' }); } set(g, 1, 1, { s: 'WD', mult: 10 }); },
    meter: drums(1),
  };
  const F = { kind, force: grids[kind] };
  if (kind === 'respin') F.respin = 3;
  if (kind === 'meter') F.meter = true;
  if (/^wheel[123]$/.test(kind)) { const n = +kind[5]; F.force = drums(n); F.tier = n; }
  if (kind === 'awaken') { F.force = drums(1); F.tier = 1; F.awaken = true; F.idx = WIDX('inferno'); }
  if (kind === 'locked') { F.force = drums(1); F.tier = 1; F.awaken = false; F.idx = WIDX('silver'); }
  if (kind === 'jackpot') { F.force = drums(3); F.tier = 3; F.idx = WIDX('gold'); }
  if (/^(jungle|fury|inferno)$/.test(kind)) { F.force = drums(3); F.tier = 3; F.idx = WIDX(kind); F.rich = true; F.awaken = false; }
  return F;
}
async function spin() {
  A.init(); if (busy) { quick = true; reels.stopNow(); return; }
  if (st.cents < betCents()) { A.play('deny'); toast(st.cents > 0 ? 'Not enough for this bet — lower the bet or insert a bill' : 'Insert a $100 bill to play'); $('billBtn').classList.remove('pulse'); void $('billBtn').offsetWidth; $('billBtn').classList.add('pulse'); return; }
  busy = true; quick = false; meters(); $('spinBtn').classList.add('stop'); $('spinBtn').textContent = 'STOP';
  st.cents -= betCents(); st.played++; save(); disp.cents = st.cents; disp.win = 0; meters();
  if (curRows !== 3) await setRows(3);
  const fk = forceNext; forceNext = null; const F = fk ? forceOf(fk) : {};
  if (F.meter) st.meter = M.METER_MAX - 1;
  const mt = { n: st.meter || 0 }, opts = () => ({ force: F.force, forceRespin: F.respin, forceTrigger: F.tier, meter: { ...mt } });
  let o = opts(), res = M.spin(bet(), rng, o);
  if (fk === 'nudge') for (let i = 0; i < 500 && !(res.nudge && !M.waysWin(res.grid.map((c, r) => r === res.nudge.r ? res.nudge.pre : c))); i++) { o = { forceNudge: true, meter: { ...mt } }; res = M.spin(bet(), rng, o); } // debug/test only
  st.meter = o.meter.n; save();
  await animateReels(res, null);
  let total = await resolve(res, null);
  if (res.meter) await meterUpdate(res.meter);
  if (!total && !res.bonus) { if (res.teased && Math.random() < .5) ape.stare(); else if (Math.random() < .55) ape.lose(); else ape.settle(); }
  if (res.bonus) total += await bonus(res.bonus, F);
  if (total > 0) { st.cents += total * st.denom; st.lastWin = total; save(); await roll('cents', st.cents, 600, false); }
  $('spinBtn').classList.remove('stop'); $('spinBtn').textContent = 'SPIN'; busy = false; quick = false; meters();
  if (ape.loadBonus) ape.loadBonus(); // bonus clips download in the background after the first spin
  if (st.cents < betCents() && st.cents > 0) toast('Low on cash — insert another bill or lower the bet');
}
// shows locks/smash, thunder wild, highlights, coin respins, roll-up and tier celebrations for one spin. returns credits won
async function resolve(res, mode) {
  const locked = res.coins.list.filter(c => res.grid[c.r][c.y].locked);
  if (!mode && res.coins.count >= 3 && locked.length) {
    if (res.coins.smashed) { const tgt = locked[0], rc = reels.cellRect(tgt.r, tgt.y); await sleep(200);
      await ape.slam((rc.left + rc.width / 2) / innerWidth, () => { fxs({ kind: 'smash', at: performance.now() }); A.play('slam'); A.play('crack'); reels.smash(); }); await sleep(500); }
    else { await sleep(500); toast('🔒 Locked coins — the gorilla didn’t smash them this time', 1400); }
  }
  if (res.thunder) { const t = res.thunder; await sleep(quick ? 50 : 180); // THUNDER WILD: one short roar, the multiplier stamps on at its peak
    await ape.thunder(() => { fxs({ kind: 'thunder', at: performance.now() }); A.play('thunder'); reels.stamp(t.r, t.y, t.mult); }); await sleep(quick ? 100 : 450); }
  markWins(res); const win = res.win; if (!win) return 0;
  const lines = res.ways.map(w => `${M.SYM[w.s].name} ×${w.ways}${w.mult > 1 ? ' (×' + (+w.mult.toFixed(1)) + ')' : ''}`); if (res.coins.pay) lines.push(`Prize coins ${money(res.coins.pay * st.denom)}`);
  let shownWin = win - (res.respin ? res.respin.pay : 0);
  const banner = v => { $('winBanner').textContent = `WIN ${money(v * st.denom)}`; $('winBanner').title = lines.join(' · '); $('winBanner').classList.remove('hidden'); };
  if (shownWin > 0) banner(shownWin);
  if (res.respin) { const rp = res.respin; await sleep(quick ? 80 : 400); toast('🪙 COIN RESPIN', 1100); A.play('tease', 1.2);
    await reels.respin(rp.r, rp.steps, { randomSym: () => Math.random() < .35 ? { s: 'CN', coin: bet() * [.5, 1, 2, 3][Math.random() * 4 | 0] } : randomSym(rp.r), holdSym: () => randomSym(rp.r), dur: quick ? .35 : .8,
      onStep: async (c, y) => { if (c) { A.play('coin', 6); A.play('glint', 2); shownWin += c.coin; banner(shownWin); fxs({ kind: 'respin', at: performance.now() });
        if (y >= 0) { const cells = reels.win ? new Set(reels.win.cells) : new Set(); cells.add(rp.r + ',' + y); reels.setWin(cells); }
        await sleep(quick ? 60 : 350); } else { A.play('reelStop', 1); await sleep(quick ? 60 : 250); } } });
    if (rp.pay) lines.push(`Coin respins ${money(rp.pay * st.denom)}`); }
  banner(win);
  if (mode) { // bonus spins: the round total gets the big celebration; here just the meter and a small reaction
    A.play('win', win >= 5 * bet() ? 3 : 1); if (win >= 8 * bet() && Math.random() < .5) ape.smallWin(); await roll('win', disp.win + win, Math.min(1800, 300 + win / bet() * 160), true); return win; }
  const t = M.tier(win, bet());
  if (t === 'big' || t === 'mega' || t === 'monster') await bigWin(t, win);
  else { A.play('win', win >= 3 * bet() ? 3 : 1); if (win >= 3 * bet()) ape.chestBeat(); else if (Math.random() < .85) ape.smallWin(); else ape.settle(); await roll('win', disp.win + win, Math.min(2500, 400 + win / bet() * 300), true); }
  return win;
}
const TIER_TXT = { big: 'BIG WIN', mega: 'MEGA WIN', monster: 'MONSTER WIN' };
// win overlay: counts up first; the gorilla's big moves play AFTER it closes, in full view
async function bigWin(t, win, o = {}) {
  if ((t === 'mega' || t === 'monster') && !o.noTakeover) await playTakeover({ dur: t === 'monster' ? 3400 : 2600, startAt: 1.6 });
  const ov = $('big'); ov.className = t || 'big'; $('bigTitle').textContent = o.title || TIER_TXT[t] || 'WIN'; $('bigSub').textContent = ''; $('bigAmt').textContent = money(0); ov.classList.remove('hidden');
  A.play('fanfare', t === 'monster' ? 3 : t === 'mega' ? 2 : 1); ape.calm && ape.calm(); coinRain(true, t || 'big');
  let skip = false; ov.onclick = () => { skip = true; quick = true; };
  const ms = t === 'monster' ? 9000 : t === 'mega' ? 6500 : 4500, from = disp.win, t0 = performance.now(), dur = ms * (window.__gorillaSpeed || 1);
  await new Promise(res => { let last = 0; const step = now => { const u = skip ? 1 : Math.min(1, (now - t0) / dur), v = Math.round(win * (1 - Math.pow(1 - u, 2))); $('bigAmt').textContent = money(v * st.denom); disp.win = from + v; meters(); if (now - last > 90) { last = now; A.play('coin', (now / 90 | 0) % 12); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  if (o.title && TIER_TXT[t] && !o.noTier) { $('bigSub').textContent = TIER_TXT[t]; A.play('jackpot'); } // bonus total / jackpot: the tier stamps on after the count
  await sleep(skip ? 300 : 1400); ov.classList.add('hidden'); coinRain(false); await sleep(120);
  const roar = ape.roar(); // roar, then the chest beat (mega+, jackpots), then the victory pound (monster only) - one after another, in full view
  roar.then(async () => { if (t !== 'big' || o.chest) await ape.chestBeat(); if (t === 'monster' && !o.noPound) await ape.pound(); });
  await Promise.race([roar, sleep(5400)]); // the roar is the payoff: let it play out before the next spin
}
// ---------------- Rampage Meter ----------------
function meterDraw(n, flash) { const f = Math.min(1, (n || 0) / M.METER_MAX); $('meterFill').style.width = (f * 100).toFixed(1) + '%'; $('meterPct').textContent = Math.round(f * 100) + '%'; if (flash) { const m = $('meter'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); } }
async function meterUpdate(m) {
  if (m.full) { meterDraw(M.METER_MAX, true); $('meter').classList.add('full'); toast('RAMPAGE! The meter is full', 1500); A.play('tease', 1.4); await sleep(quick ? 100 : 700);
    const rc = $('meter').getBoundingClientRect(); await ape.slam((rc.left + rc.width / 2) / innerWidth, () => { fxs({ kind: 'meter', at: performance.now() }); A.play('slam'); A.play('crack'); $('meter').classList.add('crack'); });
    await sleep(quick ? 100 : 600); $('meter').classList.remove('full', 'crack'); meterDraw(0); return; }
  if (m.added) { meterDraw(m.n, true); A.play('tick'); }
}
// ---------------- bonus: Temple Drum Wheel ----------------
const WIMG = new Image(), CHAIN = new Image(); WIMG.src = '/gorilla/media/v4/art/wheel@2x.webp?v=1'; CHAIN.src = '/gorilla/media/v4/art/chains.webp?v=1';
const WEDGE_STYLE = { jungle: ['#7fd4ff', '#06223a', 'JUNGLE', 'SPINS'], fury: ['#9dff5a', '#0e2a04', 'FURY', 'SPINS'], inferno: ['#ff7a2a', '#3a0800', 'INFERNO', 'SPINS'], titan: ['#ff5a1a', '#2a0400', 'TITAN', 'JACKPOT'], gold: ['#ffd34a', '#3a2400', 'GOLD', 'JACKPOT'], silver: ['#eef0ff', '#2a2a38', 'SILVER', 'JACKPOT'], bronze: ['#ffb27a', '#3a1404', 'BRONZE', 'JACKPOT'], c8: ['#fff4d0', '#2a1204', '8×', 'BET'], c15: ['#fff4d0', '#2a1204', '15×', 'BET'] };
const wheel = { ang: 0, locks: new Set(), pieces: [], raf: 0, glow: -1 };
const wedgeAngle = i => (15 + i * 30) * Math.PI / 180; // wedge centre, clockwise from 12 o'clock (a spoke sits at the top of the art)
function drawWheel() { const c = $('wheel'), g = c.getContext('2d'), W = c.width, R = W / 2, n = M.WHEEL.length; g.clearRect(0, 0, W, W); g.save(); g.translate(R, R); g.rotate(wheel.ang);
  if (WIMG.complete && WIMG.naturalWidth) g.drawImage(WIMG, -R, -R, W, W); else { g.fillStyle = '#2a1206'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); }
  for (let i = 0; i < n; i++) { const w = M.WHEEL[i], a = wedgeAngle(i) - Math.PI / 2, [fc, sc, l1, l2] = WEDGE_STYLE[w.id]; g.save(); g.rotate(a + Math.PI / 2);
    if (wheel.glow === i) { g.save(); g.globalCompositeOperation = 'lighter'; const p = .5 + .5 * Math.sin(performance.now() / 90); g.fillStyle = `rgba(255,200,80,${.25 + .25 * p})`; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * .86, -Math.PI / 2 - Math.PI / 12, -Math.PI / 2 + Math.PI / 12); g.closePath(); g.fill(); g.restore(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const txt = (s, y, size) => { g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; let fs = size; while (g.measureText(s).width > R * .27 && fs > 12) { fs -= 1; g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; } g.lineWidth = fs * .3; g.strokeStyle = sc; g.strokeText(s, 0, y); g.fillStyle = fc; g.shadowColor = fc; g.shadowBlur = 10; g.fillText(s, 0, y); g.shadowBlur = 0; };
    txt(l1, -R * .7, R * .1); txt(l2, -R * .58, R * .062); if (w.x && w.jp) txt(String(w.x) + '×', -R * .47, R * .06);
    if (wheel.locks.has(i)) { g.save(); g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * .9, -Math.PI / 2 - Math.PI / 12, -Math.PI / 2 + Math.PI / 12); g.closePath(); g.fill(); g.restore(); if (CHAIN.complete && CHAIN.naturalWidth) { const s = R * .5; g.drawImage(CHAIN, -s / 2, -R * .6 - s / 2, s, s); } }
    g.restore(); }
  g.restore();
  wheel.pieces = wheel.pieces.filter(p => (p.t += 1 / 60) < 1.1); for (const p of wheel.pieces) { p.vy += 900 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.rot += p.vr / 60; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - p.t / 1.1);
    if (p.img) { g.beginPath(); g.rect(p.half ? 0 : -p.s / 2, -p.s / 2, p.s / 2, p.s); g.clip(); g.drawImage(CHAIN, -p.s / 2, -p.s / 2, p.s, p.s); } else { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,190,90,1)'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); } g.restore(); } }
function wheelLoop(on) { cancelAnimationFrame(wheel.raf); if (!on) return; const f = () => { drawWheel(); wheel.raf = requestAnimationFrame(f); }; wheel.raf = requestAnimationFrame(f); }
function shatterChains(ids) { const c = $('wheel'), R = c.width / 2;
  for (const i of ids) { const a = wedgeAngle(i) - Math.PI / 2 + wheel.ang, x = R + Math.cos(a) * R * .62, y = R + Math.sin(a) * R * .62, s = R * .36; wheel.locks.delete(i);
    for (let h = 0; h < 2; h++) wheel.pieces.push({ img: 1, half: h, x, y, s, vx: (h ? 1 : -1) * (120 + Math.random() * 160), vy: -380 - Math.random() * 200, rot: 0, vr: (h ? 1 : -1) * (5 + Math.random() * 5), t: 0 });
    for (let k = 0; k < 30; k++) { const b = Math.random() * 6.28, v = 150 + Math.random() * 400; wheel.pieces.push({ x, y, vx: Math.cos(b) * v, vy: Math.sin(b) * v - 100, rot: 0, vr: 0, t: Math.random() * .3 }); } } }
const lockedIdx = tier => new Set(M.WHEEL.map((w, i) => M.LOCKS[tier].includes(w.id) ? i : -1).filter(i => i >= 0));
function eruption() { const e = $('erupt'); e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); A.play('thunder'); A.play('slam'); ape.lightning && ape.lightning(); return sleep(quick ? 300 : 1100); }
async function bonus(b, F = {}) {
  A.play('drum', 0); await sleep(250); A.play('drum', 1); await sleep(250); A.play('drum', 2);
  if (ape.loadBonus) ape.loadBonus();
  const w = M.spinWheel(bet(), rng, b.tier, { forceIdx: F.idx, forceAwaken: F.awaken });
  window.__lastWheel = w;
  fxs({ kind: 'bonus', at: performance.now() });
  await playTakeover({ dur: 2600, startAt: 1.8 });
  await eruption();
  const box = $('wheelBox'); wheel.locks = lockedIdx(w.start); wheel.glow = -1; wheel.ang = -(Math.random() * 2 * Math.PI); box.className = 'tier' + w.start; box.classList.remove('hidden'); wheelLoop(true);
  $('wheelTitle').textContent = 'TEMPLE DRUM WHEEL'; $('wheelTier').textContent = `${w.start} DRUM${w.start > 1 ? 'S' : ''}${b.via === 'meter' ? ' · RAMPAGE' : ''}`; $('wheelMsg').textContent = w.start < 3 ? `${wheel.locks.size} wedges chained` : 'Every wedge is open';
  await sleep(quick ? 200 : 1200);
  if (w.awaken) { $('wheelMsg').textContent = 'The silverback awakens…'; // AWAKENING: one huge roar, the chains explode at its peak
    await ape.awaken(() => { const free = [...lockedIdx(w.start)].filter(i => !lockedIdx(w.tier).has(i)); shatterChains(free); A.play('crack'); A.play('rattle'); A.play('thunder'); fxs({ kind: 'awaken', at: performance.now() }); box.className = 'tier' + w.tier; $('wheelTier').textContent = `AWAKENED · ${w.tier} DRUMS`; });
    $('wheelMsg').textContent = wheel.locks.size ? `${wheel.locks.size} wedges still chained` : 'Every wedge is open'; await sleep(quick ? 200 : 1500); }
  $('wheelMsg').textContent = 'Tap the wheel'; $('wheelHub').classList.add('ready');
  await new Promise(res => { const hub = $('wheelHub'); const go = () => { hub.onclick = null; clearTimeout(auto); res(); }; hub.onclick = go; const auto = setTimeout(go, quick ? 300 : 3000); });
  $('wheelHub').classList.remove('ready'); $('wheelMsg').textContent = '';
  const n = M.WHEEL.length, cur = wheel.ang; let target = -wedgeAngle(w.idx) + (Math.random() - .5) * .6 * (2 * Math.PI / n); while (target > cur) target -= 2 * Math.PI;
  const end = target - 5 * 2 * Math.PI, dur = (quick ? 1500 : 5200) * (window.__gorillaSpeed || 1);
  await ape.swipe(() => { A.play('whoosh'); A.play('drum', 1); fxs({ kind: 'swipe', at: performance.now() }); }); // the gorilla's sweep starts the wheel
  const t0 = performance.now(); let lastSeg = null;
  await new Promise(res => { const step = now => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3.2); wheel.ang = cur + (end - cur) * e; const seg = Math.floor(-wheel.ang / (2 * Math.PI / n)); if (seg !== lastSeg) { lastSeg = seg; A.play('wheelTick'); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  wheel.glow = w.idx; let won = 0; const lab = w.wedge;
  if (w.locked) { $('wheelMsg').textContent = `CHAINED — ${money(w.win * st.denom)}`; A.play('rattle'); ape.dismiss && ape.dismiss(); await sleep(quick ? 300 : 2200); closeWheel(); await roll('win', disp.win + w.win, 1000, true); return w.win; }
  if (w.mode) { $('wheelMsg').textContent = `${M.MODES[w.mode].name}!`; A.play('jackpot'); await sleep(quick ? 300 : 1600); closeWheel(); return await freeRound(w.mode, F); }
  const c = w.win; $('wheelMsg').textContent = lab.jp ? `${lab.label} JACKPOT ${money(c * st.denom)}` : money(c * st.denom);
  if (lab.jp) { A.play('jackpot'); const pl = document.querySelector('.plq.' + lab.id); pl && pl.classList.add('hit'); setTimeout(() => pl && pl.classList.remove('hit'), 3500); } else A.play('win', 4);
  await sleep(quick ? 300 : 2000); closeWheel();
  const t = M.tier(c, bet()); if (lab.jp) await bigWin(t === 'win' ? 'big' : t, c, { title: `${lab.label} JACKPOT`, chest: true }); else if (/big|mega|monster/.test(t)) await bigWin(t, c); else await roll('win', disp.win + c, 1200, true);
  return c;
}
function closeWheel() { $('wheelBox').classList.add('hidden'); wheelLoop(false); }
// ---------------- bonus rounds: JUNGLE / FURY / INFERNO SPINS ----------------
const MODE_FEATS = {
  jungle: [['FI', 'FIREFIST', '+1 SPIN'], ['CN', 'COINS', 'REEL 2'], ['SB', 'TOTEM', 'STACKS'], ['WD', 'WILDS', '×2–×16']],
  fury: [['FI', 'FIREFIST', '+1 SPIN'], ['CN', 'COINS', 'REEL 2'], ['SB', 'TOTEM', 'STACKS'], ['GROW', 'GROWING', '343 WAYS']],
  inferno: [['FI', 'FIREFIST', '+1 SPIN'], ['CN', 'COINS', 'ALL REELS'], ['JP', 'JACKPOT', 'COINS'], ['GROW', 'GROWING', '343 WAYS']],
};
async function splash(mode) { const s = $('splash'); $('splashTitle').textContent = M.MODES[mode].name.split(' ')[0]; $('splashSub').textContent = `${M.FS_START} FREE SPINS`;
  $('splashFeats').innerHTML = MODE_FEATS[mode].map(([ic, a, b]) => `<div class=feat><i class="ic ${ic}">${/GROW|JP/.test(ic) ? (ic === 'GROW' ? '<svg viewBox="0 0 24 24"><path d="M12 2l7 8h-4v5h-6v-5H5z M5 18h14v4H5z"/></svg>' : '<b>JP</b>') : `<img src="${SY.get(ic)}" alt="">`}</i><b>${a}</b><span>${b}</span></div>`).join('');
  s.className = 'mode-' + mode; s.classList.remove('hidden'); A.play('fanfare', 2);
  await new Promise(res => { const b = $('startBtn'); const go = () => { b.onclick = null; clearTimeout(auto); res(); }; b.onclick = go; const auto = setTimeout(go, quick ? 400 : 7000); });
  A.play('click'); s.classList.add('hidden'); }
async function setRows(n, viaHeave) { if (n === curRows) return;
  const go = () => { curRows = n; reels.setRows(n); $('frame').classList.add('grow'); layout(); A.play(n > 3 ? 'slam' : 'whoosh'); if (n > 3) A.play('crack'); fxs({ kind: 'grow', rows: n, at: performance.now() }); };
  if (viaHeave && n > 3 && ape.heave) await ape.heave(go); else go();
  await sleep(quick ? 120 : 520); $('frame').classList.remove('grow'); reels.resize(); }
async function fistFly(res) { const hudN = $('hudSpins').getBoundingClientRect(), cells = []; res.grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'FI') cells.push([r, y]); }));
  for (const [r, y] of cells) reels.pulse(r, y); await sleep(quick ? 50 : 250);
  await ape.fistThrow(() => { fxs({ kind: 'fist', at: performance.now() }); A.play('whoosh');
    for (const [r, y] of cells) { const rc = reels.cellRect(r, y), f = document.createElement('img'); f.src = SY.get('FI'); f.className = 'flyFist'; f.style.cssText = `left:${rc.left + rc.width * .15}px;top:${rc.top + rc.height * .1}px;width:${rc.width * .7}px`; document.body.appendChild(f);
      requestAnimationFrame(() => { f.style.transform = `translate(${hudN.left + hudN.width / 2 - rc.left - rc.width / 2}px,${hudN.top + hudN.height / 2 - rc.top - rc.height / 2}px) scale(.35) rotate(-25deg)`; f.style.opacity = '.2'; }); setTimeout(() => f.remove(), 900); } });
  await sleep(quick ? 100 : 650); A.play('coin', 9); $('hudSpins').classList.remove('bump'); void $('hudSpins').offsetWidth; $('hudSpins').classList.add('bump'); toast(`🔥 +${res.added} SPIN${res.added > 1 ? 'S' : ''}`, 1100); }
async function freeRound(mode, F = {}) {
  const R = M.bonusRound(bet(), rng, mode, { rich: F.rich }); window.__lastRound = R;
  document.body.classList.add('bonus', 'mode-' + mode);
  await ape.lunge(() => { document.body.classList.add('graded'); A.play('thunder'); fxs({ kind: 'lunge', at: performance.now() }); }); // he leans into the camera as the colour changes
  await sleep(quick ? 100 : 1300);
  await splash(mode);
  const hud = $('modeHud'); $('hudMode').textContent = M.MODES[mode].name; hud.classList.remove('hidden'); let total = 0, played = 0, left = M.FS_START;
  const upd = (s) => { $('hudSpins').textContent = `${played} OF ${played + left}`; $('hudWays').textContent = (s ? s.waysN : 27) + ' WAYS'; $('hudWin').textContent = money(total * st.denom); }; upd();
  disp.win = 0; meters();
  for (const s of R.spins) { played++; left--; upd({ waysN: curRows ** 3 }); await sleep(quick ? 120 : 550);
    const rows = s.rows[0]; if (rows !== curRows) await setRows(rows, rows > 3); upd(s);
    await animateReels(s, mode);
    if (s.added) { left += s.added; await fistFly(s); upd(s); }
    const w = await resolve(s, mode); total += s.win; upd(s); window.__bonusSpin = played;
    await sleep(quick ? 150 : (w ? 700 : 450)); }
  if (curRows !== 3) await setRows(3);
  hud.classList.add('hidden'); clearMarks();
  const t = M.tier(total, bet()); disp.win = 0;
  await bigWin(t === 'win' || !t ? 'big' : t, total, { title: `${M.MODES[mode].name.split(' ')[0]} TOTAL`, noTier: !/big|mega|monster/.test(t) });
  document.body.classList.remove('bonus', 'graded', 'mode-' + mode);
  return total;
}
// ---------------- controls ----------------
$('spinBtn').onclick = spin; $('billBtn').onclick = insertBill; $('cashBtn').onclick = cashOut; $('reels').onclick = () => { if (busy) { quick = true; reels.stopNow(); } else spin(); };
addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); spin(); } if (e.key === 'b') insertBill(); });
$('betUp').onclick = () => { if (busy) return; A.init(); A.play('click'); st.bet = Math.min(M.BETS.length - 1, st.bet + 1); save(); meters(); };
$('betDn').onclick = () => { if (busy) return; A.init(); A.play('click'); st.bet = Math.max(0, st.bet - 1); save(); meters(); };
$('maxBtn').onclick = () => { if (busy) return; A.init(); A.play('click'); st.bet = M.BETS.length - 1; save(); meters(); spin(); };
$('denoms').innerHTML = M.DENOMS.map(d => `<button data-d=${d}>${denomTxt(d)}</button>`).join('');
const markDen = () => document.querySelectorAll('#denoms button').forEach(b => b.classList.toggle('on', +b.dataset.d === st.denom));
$('denomBtn').onclick = () => { if (busy) return; A.init(); A.play('click'); markDen(); $('denomModal').classList.remove('hidden'); };
$('denoms').onclick = e => { const d = +e.target.dataset.d; if (!d) return; st.denom = d; save(); markDen(); meters(); renderStatic(); A.play('click'); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).classList.add('hidden'));
const muteIcon = () => $('muteBtn').textContent = A.muted ? '🔇' : '🔊'; muteIcon();
$('muteBtn').onclick = () => { A.init(); A.setMuted(!A.muted); muteIcon(); };
$('fsBtn').onclick = () => { const d = document.documentElement; if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); else document.exitFullscreen(); };
$('menuBtn').onclick = () => { $('menu').classList.remove('hidden'); $('qBtn').textContent = 'Video Res: ' + (ape.q ? ape.q[0].toUpperCase() + ape.q.slice(1) : 'Off'); showPay(); };
$('qBtn').onclick = () => ape.setQuality(ape.q === 'low' ? 'high' : 'low');
$('payBtn').onclick = showPay; $('aboutBtn').onclick = () => { $('menuBody').innerHTML = `<p><b>GORILLA</b> is an original play-money slot for game nights. It is not a real-money game: bills, credits and tickets have no cash value.</p><p>The gorilla and the reel symbols are photoreal AI-generated art made for this game (original character and designs, no film likeness). Gorilla sounds are real recordings: “Gorillaschrei” (alpha male roar, zoo in Germany) by J0ck0 on Freesound, CC0 / public domain — freesound.org/s/397054 — layered with the clips’ own synced roar, chest-beat and slam audio. Other effects are synthesized live. Math: 27 ways, target return about 95.5%.</p><p>Played ${st.played.toLocaleString()} spins · inserted ${money(st.inserted)} play money on this device.</p>`; };
function showPay() { const b = betCents(), u = b / 27; const row = s => `<div><img src="${SY.get(s)}"><b>${M.SYM[s].name}</b><span>3 = ${money(M.PAY[s] * u)}/way</span></div>`;
  $('menuBody').innerHTML = `<p>Bet ${bet()} credits (${money(b)}). 27 ways: 3 matching symbols on adjacent reels from left to right, any row. Pays shown per way at this bet.</p><div class=pt>${['SB', 'MK', 'TC', 'ID', 'BN', 'RB', 'EM', 'SP'].map(row).join('')}</div>
  <div class=pt><div><img src="${SY.get('WD')}"><b>Wild</b><span>reel 2; gold ×2 ×3 ×5 ×10 badges (and rarer ×8 ×16). A hitting badge is a thunder wild</span></div><div><img src="${SY.get('CN')}"><b>Prize Coins</b><span>3+ pay their values; a coin column can respin up to 5 times</span></div><div><img src="${SY.get('CN')}"><b>Chained Coins</b><span>locked with chains; they pay only if the gorilla smashes them</span></div><div><img src="${SY.get('DR')}"><b>Temple Wheel</b><span>1, 2 or 3 badges can start the Temple Drum Wheel</span></div><div><img src="${SY.get('FI')}"><b>Firefist</b><span>bonus spins: +1 spin</span></div></div>
  <p><b>Temple Drum Wheel.</b> 3 drums open every wedge. With 1 or 2 drums the top wedges are chained (a chained wedge pays ${M.LOCK_X}× bet), unless the gorilla's roar breaks the chains. Wedges: ${money(8 * b)}, ${money(15 * b)}, BRONZE ${money(25 * b)}, SILVER ${money(75 * b)}, GOLD ${money(250 * b)}, TITAN ${money(1000 * b)}, or a bonus round.</p>
  <p><b>Bonus rounds</b> start with ${M.FS_START} spins (up to 50): <b>JUNGLE</b> stacks and wilds ×2–×16 · <b>FURY</b> adds growing reels up to 7 rows (343 ways) · <b>INFERNO</b> puts coins and jackpot coins on every reel.</p>
  <p><b>Rampage Meter.</b> Every drum that lands without a wheel fills the meter; when full the gorilla smashes it and a 2-drum wheel starts. Return to player about 95.4% (play money only).</p>`; }
// big-win coin shower (photoreal prize coin sprite)
let rainRAF = 0;
function coinRain(on, tier) { const c = $('coinRain'); cancelAnimationFrame(rainRAF); const g = c.getContext('2d'); if (!on) { g.clearRect(0, 0, c.width, c.height); return; }
  const d = Math.min(devicePixelRatio || 1, 2); c.width = c.clientWidth * d; c.height = c.clientHeight * d; const img = SY.img.CN, n = tier === 'monster' ? 90 : tier === 'mega' ? 60 : 36, W = c.width, H = c.height, sz = Math.min(W, H) * .085;
  const coins = Array.from({ length: n }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: H * (.25 + Math.random() * .35), ph: Math.random() * 6, sp: 4 + Math.random() * 6, s: sz * (.6 + Math.random() * .6) }));
  let last = performance.now(); const step = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, H);
    for (const k of coins) { k.y += k.v * dt; if (k.y > H + k.s) { k.y = -k.s; k.x = Math.random() * W; } k.ph += k.sp * dt; const sx = Math.abs(Math.cos(k.ph)) * .9 + .1; g.save(); g.translate(k.x, k.y); g.scale(sx, 1); g.drawImage(img, -k.s / 2, -k.s / 2, k.s, k.s); g.restore(); }
    rainRAF = requestAnimationFrame(step); }; rainRAF = requestAnimationFrame(step); }
// debug / test hooks
window.G = { wheel, get rows() { return curRows; }, st, spin, insertBill, cashOut, get busy() { return busy; }, setDenom: d => { st.denom = d; save(); meters(); }, setBet: i => { st.bet = i; save(); meters(); }, M };
if (DEBUG) { window.G.force = k => { forceNext = k; }; window.__gorillaSpeed = +(qs.get('speed') || 1); const d = $('dbg'); d.classList.remove('hidden'); d.innerHTML = ['win', 'nudge', 'thunder', 'smash', 'respin', 'big', 'mega', 'monster', 'meter', 'wheel1', 'wheel2', 'wheel3', 'awaken', 'locked', 'jackpot', 'jungle', 'fury', 'inferno'].map(k => `<button data-k=${k}>${k}</button>`).join(''); d.onclick = e => { if (e.target.dataset.k) { forceNext = e.target.dataset.k; toast('next spin: ' + forceNext, 900); } }; }
// boot
layout(); renderStatic(); meters(); meterDraw(st.meter); requestAnimationFrame(layout); SY.ready.then(layout);
document.addEventListener('pointerdown', () => A.init(), { once: true });
