// GORILLA - play-money slot cabinet: reels, bill acceptor, ticket printer, bonus wheel, THUNDER SPINS, gorilla reactions.
const M = window.GorillaMath, A = window.GorillaAudio, SY = window.GorillaSymbols;
const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search), DEBUG = qs.has('debug');
const sleep = ms => new Promise(r => setTimeout(r, ms * (window.__gorillaSpeed || 1)));
const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const denomTxt = d => d >= 100 ? '$' + d / 100 : d + '¢';
// ---------------- state ----------------
const KEY = 'gorillaState1';
const st = Object.assign({ cents: 0, denom: 1, bet: 0, lastWin: 0, ticketNo: 1000, inserted: 0, played: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
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
  ape.on = ape.kind === 'video' ? { slam: () => shakeDom(), beat: () => shakeDom(), thunder: () => A.play('thunder') } : { beat: () => A.play('beat'), roar: () => A.play('roar'), slam: () => { A.play('slam'); shakeDom(); }, thunder: () => A.play('thunder') };
  ape.onShake = sk => { $('machine').style.transform = sk > .002 ? `translate(${(Math.random() - .5) * sk * 22}px,${(Math.random() - .5) * sk * 18}px)` : ''; }; }
if (qs.get('ape') === '3d') await use3D();
else { try { const { VideoApe, glog } = await import('/gorilla/video.js?v=' + (new URL(import.meta.url).searchParams.get('v') || '4')); window.glog = glog; ape = new VideoApe($('scene'), { quality: qs.get('q') || localStorage.getItem('gorillaVQ') || undefined });
    ape.gameBusy = () => busy; wireApe(); }
  catch (e) { console.warn(e); ape = stub; wireApe(); $('scene').style.background = 'url(/gorilla/media/v3/poster.jpg?v=4) center top/cover no-repeat #050101';
    fetch('/gorilla/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'video-module-failed', msg: String(e && e.message || e), ua: navigator.userAgent }) }).catch(() => {}); } }
function shakeDom() { const m = $('frame'); m.classList.remove('shakeX'); void m.offsetWidth; m.classList.add('shakeX'); }
// ---------------- canvas reels ----------------
let curFree = false;
const reels = new window.GorillaReels($('reelCv'), { randomSym: r => randomSym(r, curFree), coinText: c => money(c.coin * st.denom).replace('.00', ''), onGlint: () => A.play('glint', Math.random() * 7 | 0) }); window.reels = reels;
// ---------------- portrait layout: gorilla on top, reels in the middle, controls at the bottom ----------------
function layout() {
  const vw = innerWidth, vh = innerHeight, land = vw > vh * 1.02, coarse = matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('rotate', land && coarse);
  const app = $('app'), W = Math.min(vw, Math.round(vh * .78)), H = vh, pr = getComputedStyle($('safeProbe')), stp = parseFloat(pr.paddingTop) || 0, sbp = parseFloat(pr.paddingBottom) || 0;
  const k = Math.max(.82, Math.min(2.1, Math.min(W / 390, H / 844))), wide = W / H > .6;
  const barH = Math.round(132 * k + sbp), side = Math.round(6 * k), fw = Math.round(wide ? W * .84 : W - 2 * side), pad = Math.round(7 * k);
  const gap = Math.max(3, (fw - 2 * pad) * .012), colW = (fw - 2 * pad - 2 * gap) / 3, avail = H - barH - Math.round(16 * k);
  const cellH = Math.max(colW * .64, Math.min(colW * .9, (avail - H * (wide ? .47 : .45) - 2 * pad) / 3)), fh = Math.round(3 * cellH + 2 * pad), top = Math.round(avail - fh);
  const v = { '--appW': W + 'px', '--k': k.toFixed(3), '--top': top + 'px', '--fw': fw + 'px', '--fh': fh + 'px', '--fx': Math.round((W - fw) / 2) + 'px', '--pad': pad + 'px', '--barH': barH + 'px', '--st': stp + 'px', '--sb': sbp + 'px' };
  for (const n in v) app.style.setProperty(n, v[n]); app.classList.toggle('wide', wide);
  if (ape && ape.resize) { ape.resize({ top: top + pad * .6, width: W }); if (ape.geom) app.style.setProperty('--gw', Math.round(ape.geom.w) + 'px'); }
  reels.resize(); }
addEventListener('resize', () => setTimeout(layout, 60)); addEventListener('orientationchange', () => setTimeout(layout, 300));
// ---------------- media hooks (optional AI clips in /gorilla/media) ----------------
let mediaFiles = [];
fetch('/gorilla/media/manifest.json').then(r => r.ok ? r.json() : { files: [] }).then(j => { mediaFiles = j.files || []; for (const c of SY.codes) if (mediaFiles.includes(`sym-${c}.png`)) SY.useCustom(c, `/gorilla/media/sym-${c}.png`); }).catch(() => {});
function playMedia(name) { if (!mediaFiles.includes(name) || quick) return Promise.resolve(false); const v = $('cine'); return new Promise(res => { let done = false; const end = () => { if (done) return; done = true; v.pause(); v.classList.add('hidden'); v.onclick = null; res(true); };
  v.src = '/gorilla/media/' + name; v.muted = A.muted; v.classList.remove('hidden'); v.onended = end; v.onerror = end; v.onclick = end; v.play().catch(end); setTimeout(end, 15000); }); }
// ---------------- reels ----------------
let shown = [0, 1, 2].map(r => [0, 1, 2].map(y => ({ s: M.STRIPS[r][(r * 7 + y) % M.STRIPS[r].length] })));
function renderStatic() { reels.setGrid(shown); }
function randomSym(r, free) { const s = (free ? M.FREE_STRIPS : M.STRIPS)[r]; const x = s[Math.floor(Math.random() * s.length)]; return { s: x, mult: x === 'WD' ? [2, 3, 5, 10][Math.random() * 4 | 0] : null, coin: x === 'CN' ? bet() * [.5, 1, 2][Math.random() * 3 | 0] : null }; }
async function animateReels(res, free) {
  curFree = free; const nz = res.nudge, grid = nz ? res.grid.map((col, r) => r === nz.r ? nz.pre : col) : res.grid; // a punch-nudge spin first lands one stop off
  const drums = r => grid[r].some(c => c.s === 'DR'), coins = r => grid[r].filter(c => c.s === 'CN').length;
  const tease = (drums(0) && drums(1)) || (coins(0) + coins(1) >= 2 && Math.random() < .6);
  A.play('whoosh'); clearMarks(); const fast = quick ? .35 : 1, sp = window.__gorillaSpeed || 1;
  const spinSec = ((.95 + 2 * .38 + (tease ? 1.9 : 0)) * fast + .1 + .34) * sp; // last reel's stop + settle (reels.js timing)
  if (!quick) ape.watch(spinSec); // eyes on the reels from the first frame of the spin
  await reels.spin(grid, { free, fast, tease: [false, false, tease],
    onStop: (r, cells) => { A.play('reelStop', r); cells.forEach((c, y) => { if (c.s === 'DR') A.play('drum', r); else if (c.s === 'CN') A.play(c.locked ? 'rattle' : 'glint', r * 3 + y); else if (c.s === 'WD') A.play('glint', 6); }); if (r === 2) $('frame').classList.remove('tease'); },
    onTease: (r, dur) => { $('frame').classList.add('tease'); A.play('tease', dur); if (!quick) ape.anticipate(); } });
  $('frame').classList.remove('tease'); res.teased = tease;
  if (nz) { await sleep(quick ? 80 : 260); // GORILLA PUNCH: the reel jolts one stop on the fist's impact frame
    let jolt = null; await ape.punch(() => { window.__gorillaFx = { kind: 'nudge', at: performance.now() }; A.play('slam'); A.play('crack'); jolt = reels.nudge(nz.r, nz.dir, res.grid[nz.r]); });
    await jolt; await sleep(quick ? 60 : 200); }
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
function applyForce(kind) { // debug / test only
  const set = (g, r, y, c) => { g[r][y] = c; };
  return { bonus: g => { for (let r = 0; r < 3; r++) set(g, r, 1, { s: 'DR' }); }, thunder: g => { for (let r = 0; r < 3; r++) set(g, r, 1, { s: 'DR' }); }, jackpot: g => { for (let r = 0; r < 3; r++) set(g, r, 1, { s: 'DR' }); },
    smash: g => { set(g, 0, 0, { s: 'CN', locked: true }); set(g, 2, 2, { s: 'CN', locked: true }); set(g, 0, 2, { s: 'CN', locked: false }); set(g, 1, 1, { s: 'WD', mult: 2 }); },
    win: g => { set(g, 0, 1, { s: 'BN' }); set(g, 1, 1, { s: 'BN' }); set(g, 2, 1, { s: 'BN' }); },
    big: g => { set(g, 0, 1, { s: 'SB' }); set(g, 1, 1, { s: 'WD', mult: 5 }); set(g, 2, 1, { s: 'SB' }); },
    mega: g => { for (const y of [0, 1]) { set(g, 0, y, { s: 'SB' }); set(g, 2, y, { s: 'SB' }); } set(g, 1, 1, { s: 'WD', mult: 3 }); },
    epic: g => { for (const y of [0, 1, 2]) { set(g, 0, y, { s: 'SB' }); set(g, 2, y, { s: 'SB' }); } set(g, 1, 1, { s: 'WD', mult: 10 }); } }[kind];
}
async function spin() {
  A.init(); if (busy) { quick = true; reels.stopNow(); return; }
  if (st.cents < betCents()) { A.play('deny'); toast(st.cents > 0 ? 'Not enough for this bet — lower the bet or insert a bill' : 'Insert a $100 bill to play'); $('billBtn').classList.remove('pulse'); void $('billBtn').offsetWidth; $('billBtn').classList.add('pulse'); return; }
  busy = true; quick = false; meters(); $('spinBtn').classList.add('stop'); $('spinBtn').textContent = 'STOP';
  st.cents -= betCents(); st.played++; save(); disp.cents = st.cents; disp.win = 0; meters();
  const fk = forceNext; forceNext = null; let res = M.spin(bet(), rng, fk && fk !== 'nudge' ? { force: applyForce(fk) } : {});
  if (fk === 'nudge') for (let i = 0; i < 500 && !(res.nudge && !M.waysWin(res.grid.map((c, r) => r === res.nudge.r ? res.nudge.pre : c))); i++) res = M.spin(bet(), rng, { forceNudge: true }); // debug/test only
  await animateReels(res, false);
  let total = await resolve(res, false);
  if (!total && !res.bonus) { if (res.teased && Math.random() < .5) ape.stare(); else if (Math.random() < .55) ape.lose(); else ape.settle(); }
  if (res.bonus) total += await bonus(fk);
  if (total > 0) { st.cents += total * st.denom; st.lastWin = total; save(); await roll('cents', st.cents, 600, false); }
  $('spinBtn').classList.remove('stop'); $('spinBtn').textContent = 'SPIN'; busy = false; quick = false; meters(); 
  if (st.cents < betCents() && st.cents > 0) toast('Low on cash — insert another bill or lower the bet');
}
// shows locks/smash, highlights, roll-up and tier celebrations for one spin. returns credits won
async function resolve(res, free) {
  const locked = res.coins.list.filter((c, i) => res.grid[c.r][c.y].locked);
  if (res.coins.count >= 3 && locked.length) {
    if (res.coins.smashed) { const tgt = locked[0], rc = reels.cellRect(tgt.r, tgt.y); await sleep(200);
      await ape.slam((rc.left + rc.width / 2) / innerWidth, () => { window.__gorillaFx = { kind: 'smash', at: performance.now() }; A.play('crack'); reels.smash(); }); await sleep(500); }
    else { await sleep(500); toast('🔒 Locked coins — the gorilla didn’t smash them this time', 1400); }
  }
  markWins(res); const win = res.win; if (!win) return 0;
  const lines = res.ways.map(w => `${M.SYM[w.s].name} ×${w.ways}${w.mult > 1 ? ' (×' + (+w.mult.toFixed(1)) + ')' : ''}`); if (res.coins.pay) lines.push(`Prize coins ${money(res.coins.pay * st.denom)}`);
  $('winBanner').textContent = `WIN ${money(win * st.denom)}`; $('winBanner').title = lines.join(' · '); $('winBanner').classList.remove('hidden');
  const t = M.tier(win, bet());
  if (t === 'big' || t === 'mega' || t === 'epic') await bigWin(t, win);
  else { A.play('win', win >= 3 * bet() ? 3 : 1); if (win >= 3 * bet()) ape.chestBeat(); else if (Math.random() < .85) ape.smallWin(); else ape.settle(); await roll('win', disp.win + win, Math.min(2500, 400 + win / bet() * 300), true); }
  if (!t.match(/big|mega|epic/)) {} else disp.win += 0; return win;
}
async function bigWin(t, win) {
  const o = $('big'); o.className = t; $('bigTitle').textContent = t.toUpperCase() + ' WIN'; $('bigAmt').textContent = money(0); o.classList.remove('hidden');
  A.play('fanfare', t === 'epic' ? 3 : t === 'mega' ? 2 : 1); ape.calm && ape.calm(); playMedia(t + '-win.mp4'); coinRain(true, t); // gorilla waits: roar/chest beat play AFTER this screen, in full view
  let skip = false; o.onclick = () => { skip = true; quick = true; };
  const ms = t === 'epic' ? 9000 : t === 'mega' ? 6500 : 4500, from = disp.win, t0 = performance.now(), dur = ms * (window.__gorillaSpeed || 1);
  await new Promise(res => { let last = 0; const step = now => { const u = skip ? 1 : Math.min(1, (now - t0) / dur), v = Math.round(win * (1 - Math.pow(1 - u, 2))); $('bigAmt').textContent = money(v * st.denom); disp.win = from + v; meters(); if (now - last > 90) { last = now; A.play('coin', (now / 90 | 0) % 12); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  await sleep(skip ? 300 : 1400); o.classList.add('hidden'); coinRain(false); await sleep(120); const roar = ape.roar(); if (t !== 'big') ape.chestBeat(); // chest beat queues behind the roar
  await Promise.race([roar, sleep(5400)]); // the roar is the payoff: let it play out in full view before the next spin
}
// ---------------- bonus: drum wheel + THUNDER SPINS ----------------
function drawWheel(ang) { const c = $('wheel'), g = c.getContext('2d'), W = c.width, R = W / 2, n = M.WHEEL.length; g.clearRect(0, 0, W, W); g.save(); g.translate(R, R); g.rotate(ang);
  const col = { c10: ['#7a1a00', '#c2410c'], c15: ['#6a2a00', '#d2691e'], c20: ['#5a1a3a', '#a33a6a'], c30: ['#3a1a5a', '#6a3aa3'], thunder: ['#0a2a6a', '#2a6aff'], bronze: ['#6a3010', '#e08a4a'], silver: ['#4a4a58', '#d6d6e0'], gold: ['#7a5000', '#ffd34a'], titan: ['#7a0e00', '#ff5a1a'] };
  for (let i = 0; i < n; i++) { const w = M.WHEEL[i], a0 = -Math.PI / 2 + (i - .5) * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, [d, l] = col[w.id]; const gr = g.createRadialGradient(0, 0, R * .2, 0, 0, R); gr.addColorStop(0, d); gr.addColorStop(1, l);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 6, a0, a1); g.closePath(); g.fillStyle = gr; g.fill(); g.strokeStyle = '#ffcf3a'; g.lineWidth = 4; g.stroke();
    g.save(); g.rotate((a0 + a1) / 2); g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5; g.font = `900 ${w.jp ? 34 : w.fs ? 24 : 30}px Arial Black, sans-serif`;
    const lab = w.fs ? '⚡ THUNDER' : w.label.replace(' BET', ''); g.strokeText(lab, R - 22, 0); g.fillText(lab, R - 22, 0); if (w.fs) { g.font = '900 20px Arial Black'; g.strokeText('SPINS', R - 22, 26); g.fillText('SPINS', R - 22, 26); } g.restore(); }
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - .5) * 2 * Math.PI / n; g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14), 7, 0, 7); g.fill(); } g.restore(); }
async function bonus(fk) {
  A.play('drum', 0); await sleep(250); A.play('drum', 1); await sleep(250); A.play('drum', 2);
  const clip = await playMedia('bonus-roar.mp4'); if (!clip) { ape.lightning(); await Promise.race([ape.roar(2), sleep(3200)]); }
  const box = $('wheelBox'); box.classList.remove('hidden'); $('wheelMsg').textContent = 'Tap SPIN'; let ang = 0; drawWheel(0);
  const forceIdx = fk === 'thunder' ? 1 : fk === 'jackpot' ? 3 : undefined, w = M.spinWheel(bet(), rng, forceIdx);
  await new Promise(res => { const hub = $('wheelHub'); const go = () => { hub.onclick = null; clearTimeout(auto); res(); }; hub.onclick = go; const auto = setTimeout(go, quick ? 300 : 3500); });
  A.play('drum', 1); const n = M.WHEEL.length, target = -w.idx * 2 * Math.PI / n + (Math.random() - .5) * .5 * 2 * Math.PI / n, spins = 5, end = target - spins * 2 * Math.PI, dur = (quick ? 1500 : 5200) * (window.__gorillaSpeed || 1), t0 = performance.now(); let lastSeg = -1;
  await new Promise(res => { const step = now => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3.2); ang = end * e; drawWheel(ang); const seg = Math.floor(-ang / (2 * Math.PI / n) + .5); if (seg !== lastSeg) { lastSeg = seg; A.play('wheelTick'); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  let won = 0;
  if (w.freeSpins) { $('wheelMsg').textContent = `⚡ ${w.freeSpins} THUNDER SPINS!`; A.play('thunder'); ape.lightning(); playMedia('thunder-intro.mp4'); await sleep(1800); box.classList.add('hidden'); won = await thunderSpins(w.freeSpins); }
  else { const c = w.win; $('wheelMsg').textContent = w.wedge.jp ? `${w.wedge.label} JACKPOT ${money(c * st.denom)}` : `${money(c * st.denom)}`;
    if (w.wedge.jp) { A.play('jackpot'); const pl = document.querySelector('.plq.' + w.wedge.id); pl && pl.classList.add('hit'); setTimeout(() => pl && pl.classList.remove('hit'), 3500); playMedia('jackpot.mp4'); } else A.play('win', 4); // the roar comes after the win screen (bigWin)
    await sleep(2200); box.classList.add('hidden'); const t = M.tier(c, bet()); if (t.match(/big|mega|epic/)) await bigWin(t, c); else await roll('win', disp.win + c, 1200, true); won = c; }
  return won;
}
async function thunderSpins(n) {
  const hud = $('fsHud'); hud.classList.remove('hidden'); let left = n, played = 0, total = 0; const upd = () => { $('fsCount').textContent = `${played} of ${played + left}`; $('fsWin').textContent = money(total * st.denom); }; upd();
  document.body.classList.add('thunder');
  while (left > 0 && played < 40) { left--; played++; upd(); await sleep(quick ? 150 : 600); if (Math.random() < .35) ape.lightning();
    const res = M.spin(bet(), rng, { free: true }); await animateReels(res, true); const w = await resolve(res, true); total += w; if (res.bonus) { left += 4; A.play('thunder'); ape.lightning(); toast('⚡ +4 THUNDER SPINS', 1500); await Promise.race([ape.roar(1.4), sleep(2500)]); } upd(); await sleep(quick ? 200 : 700); }
  hud.classList.add('hidden'); document.body.classList.remove('thunder');
  $('wheelBox').classList.remove('hidden'); $('wheelMsg').textContent = `THUNDER SPINS WON ${money(total * st.denom)}`; await sleep(2200); $('wheelBox').classList.add('hidden');
  const t = M.tier(total, bet()); if (t.match(/big|mega|epic/)) { disp.win = 0; await bigWin(t, total); } return total;
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
$('menuBtn').onclick = () => { $('menu').classList.remove('hidden'); $('qBtn').textContent = 'Video: ' + (ape.q || 'off'); showPay(); };
$('qBtn').onclick = () => ape.setQuality(ape.q === 'low' ? 'high' : 'low');
$('payBtn').onclick = showPay; $('aboutBtn').onclick = () => { $('menuBody').innerHTML = `<p><b>GORILLA</b> is an original play-money slot for game nights. It is not a real-money game: bills, credits and tickets have no cash value.</p><p>The gorilla and the reel symbols are photoreal AI-generated art made for this game (original character and designs, no film likeness). Gorilla sounds are real recordings: “Gorillaschrei” (alpha male roar, zoo in Germany) by J0ck0 on Freesound, CC0 / public domain — freesound.org/s/397054 — layered with the clips’ own synced roar, chest-beat and slam audio. Other effects are synthesized live. Math: 27 ways, target return about 95.5%.</p><p>Played ${st.played.toLocaleString()} spins · inserted ${money(st.inserted)} play money on this device.</p>`; };
function showPay() { const b = betCents(), u = b / 27; const row = s => `<div><img src="${SY.get(s)}"><b>${M.SYM[s].name}</b><span>3 = ${money(M.PAY[s] * u)}/way</span></div>`;
  $('menuBody').innerHTML = `<p>Bet ${bet()} credits (${money(b)}). 27 ways: 3 matching symbols on adjacent reels from left to right, any row. Pays shown per way at this bet.</p><div class=pt>${['SB', 'MK', 'TC', 'ID', 'BN', 'RB', 'EM', 'SP'].map(row).join('')}</div>
  <div class=pt><div><img src="${SY.get('WD')}"><b>Wild ×2–×25</b><span>reel 2 only, multiplies</span></div><div><img src="${SY.get('CN')}"><b>Prize Coins</b><span>3+ anywhere pay their values</span></div><div><img src="${SY.get('CN')}"><b>🔒 Locked</b><span>pay only if the gorilla smashes them</span></div><div><img src="${SY.get('DR')}"><b>Jungle Drums</b><span>3 = Drum Wheel bonus</span></div></div>
  <p>Drum Wheel: credit prizes, BRONZE ${money(25 * b)}, SILVER ${money(75 * b)}, GOLD ${money(250 * b)}, TITAN ${money(1000 * b)} or ⚡ 10 THUNDER SPINS (extra wilds with bigger multipliers; 3 drums add +4 spins, up to 40).</p>`; }
// big-win coin shower (photoreal prize coin sprite)
let rainRAF = 0;
function coinRain(on, tier) { const c = $('coinRain'); cancelAnimationFrame(rainRAF); const g = c.getContext('2d'); if (!on) { g.clearRect(0, 0, c.width, c.height); return; }
  const d = Math.min(devicePixelRatio || 1, 2); c.width = c.clientWidth * d; c.height = c.clientHeight * d; const img = SY.img.CN, n = tier === 'epic' ? 90 : tier === 'mega' ? 60 : 36, W = c.width, H = c.height, sz = Math.min(W, H) * .085;
  const coins = Array.from({ length: n }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: H * (.25 + Math.random() * .35), ph: Math.random() * 6, sp: 4 + Math.random() * 6, s: sz * (.6 + Math.random() * .6) }));
  let last = performance.now(); const step = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, H);
    for (const k of coins) { k.y += k.v * dt; if (k.y > H + k.s) { k.y = -k.s; k.x = Math.random() * W; } k.ph += k.sp * dt; const sx = Math.abs(Math.cos(k.ph)) * .9 + .1; g.save(); g.translate(k.x, k.y); g.scale(sx, 1); g.drawImage(img, -k.s / 2, -k.s / 2, k.s, k.s); g.restore(); }
    rainRAF = requestAnimationFrame(step); }; rainRAF = requestAnimationFrame(step); }
// debug / test hooks
window.G = { st, spin, insertBill, cashOut, get busy() { return busy; }, setDenom: d => { st.denom = d; save(); meters(); }, setBet: i => { st.bet = i; save(); meters(); }, M };
if (DEBUG) { window.G.force = k => { forceNext = k; }; window.__gorillaSpeed = +(qs.get('speed') || 1); const d = $('dbg'); d.classList.remove('hidden'); d.innerHTML = ['win', 'nudge', 'big', 'mega', 'epic', 'smash', 'bonus', 'thunder', 'jackpot'].map(k => `<button data-k=${k}>${k}</button>`).join(''); d.onclick = e => { if (e.target.dataset.k) { forceNext = e.target.dataset.k; toast('next spin: ' + forceNext, 900); } }; }
// boot
layout(); renderStatic(); meters(); requestAnimationFrame(layout); SY.ready.then(layout);
document.addEventListener('pointerdown', () => A.init(), { once: true });
