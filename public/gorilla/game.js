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
// ---------------- gorilla (3D) ----------------
const Q = qs.get('q') || localStorage.getItem('gorillaQ') || undefined;
let ape = null;
const stub = { chestBeat: () => sleep(800), roar: () => sleep(1500), slam: () => sleep(900), reactBill: () => 0, nod: () => 0, lookAt: () => 0, lightning: () => 0, busy: () => false, on: {}, fps: 60, setQuality: q => { localStorage.setItem('gorillaQ', q); location.reload(); } };
async function use3D() { // emergency fallback only (video unsupported / failed)
  try { const { Ape } = await import('/gorilla/ape.js'); $('scene').classList.add('hidden'); $('ape').classList.remove('hidden'); ape = new Ape($('ape'), { quality: Q === 'low' ? 'low' : 'med', frameFrac: .66 }); }
  catch (e) { console.warn('3D gorilla unavailable', e); ape = stub; $('ape').classList.add('hidden'); $('fallbackBg').classList.remove('hidden'); }
  wireApe(); requestAnimationFrame(() => frameSync());
}
function wireApe() { window.ape = ape;
  ape.on = ape.kind === 'video' ? { slam: () => shakeDom(), thunder: () => A.play('thunder') } : { beat: () => A.play('beat'), roar: () => A.play('roar'), slam: () => { A.play('slam'); shakeDom(); }, thunder: () => A.play('thunder') };
  ape.onShake = sk => { $('machine').style.transform = sk > .002 ? `translate(${(Math.random() - .5) * sk * 30}px,${(Math.random() - .5) * sk * 24}px)` : ''; }; }
if (qs.get('ape') === '3d') await use3D();
else { try { const { VideoApe } = await import('/gorilla/video.js'); ape = new VideoApe($('scene'), { quality: Q, frameFrac: .66 }); wireApe(); ape.ready.catch(e => { console.warn('video gorilla failed, using 3D fallback', e); use3D(); }); } catch (e) { console.warn(e); await use3D(); } }
function shakeDom() { const m = $('machine'); m.classList.remove('shakeX'); void m.offsetWidth; m.classList.add('shakeX'); }
function frameSync() { const r = $('frame').getBoundingClientRect(); if (ape.resize) { ape.frameFrac = Math.min(.8, Math.max(.4, (r.top + 4) / innerHeight)); ape.resize(); } layoutReels(); }
addEventListener('resize', () => setTimeout(frameSync, 50));
// ---------------- media hooks (optional AI clips in /gorilla/media) ----------------
let mediaFiles = [];
fetch('/gorilla/media/manifest.json').then(r => r.ok ? r.json() : { files: [] }).then(j => { mediaFiles = j.files || []; for (const c of SY.codes) if (mediaFiles.includes(`sym-${c}.png`)) SY.useCustom(c, `/gorilla/media/sym-${c}.png`); }).catch(() => {});
function playMedia(name) { if (!mediaFiles.includes(name) || quick) return Promise.resolve(false); const v = $('cine'); return new Promise(res => { let done = false; const end = () => { if (done) return; done = true; v.pause(); v.classList.add('hidden'); v.onclick = null; res(true); };
  v.src = '/gorilla/media/' + name; v.muted = A.muted; v.classList.remove('hidden'); v.onended = end; v.onerror = end; v.onclick = end; v.play().catch(end); setTimeout(end, 15000); }); }
// ---------------- reels ----------------
const reelEls = [...document.querySelectorAll('.reel')];
let cellH = 80, shown = [0, 1, 2].map(r => [0, 1, 2].map(y => ({ s: M.STRIPS[r][(r * 7 + y) % M.STRIPS[r].length] })));
function cellHTML(c, opts = {}) { let h = `<img src="${SY.get(c.s)}" alt="${c.s}">`; if (c.s === 'WD' && c.mult) h += `<div class=mult>×${c.mult}</div>`;
  if (c.s === 'CN' && c.coin != null) { h += `<div class=cv>${money(c.coin * st.denom).replace('.00', '')}</div>`; if (c.locked && !opts.unlocked) h += `<div class=lock>🔒</div>`; } return h; }
function mkCell(c, opts) { const d = document.createElement('div'); d.className = 'cell'; d.style.height = cellH + 'px'; d.innerHTML = cellHTML(c, opts); return d; }
function renderStatic() { reelEls.forEach((el, r) => { const s = el.querySelector('.strip'); s.innerHTML = ''; s.style.transform = 'translateY(0)'; shown[r].forEach(c => s.appendChild(mkCell(c))); }); }
function layoutReels() { const h = reelEls[0].clientHeight; if (h > 10) { cellH = h / 3; reelEls.forEach(el => el.querySelectorAll('.cell').forEach(c => c.style.height = cellH + 'px')); } }
const cellEl = (r, y) => reelEls[r].querySelectorAll('.cell')[y];
function randomSym(r, free) { const s = (free ? M.FREE_STRIPS : M.STRIPS)[r]; const x = s[Math.floor(Math.random() * s.length)]; return { s: x, mult: x === 'WD' ? [2, 3, 5, 10][Math.random() * 4 | 0] : null, coin: x === 'CN' ? bet() * [.5, 1, 2][Math.random() * 3 | 0] : null }; }
async function animateReels(res, free) {
  const grid = res.grid, drumsBefore = r => grid.slice(0, r).filter(col => col.some(c => c.s === 'DR')).length;
  A.play('spin'); const fast = quick ? .35 : 1; const proms = [];
  reelEls.forEach(el => el.classList.remove('tease')); clearMarks();
  for (let r = 0; r < 3; r++) {
    const tease = r === 2 && drumsBefore(2) === 2, n = (quick ? 6 : 14) + r * (quick ? 3 : 6) + (tease ? 16 : 0), strip = el => el.querySelector('.strip');
    const s = strip(reelEls[r]); s.innerHTML = ''; grid[r].forEach(c => s.appendChild(mkCell(c, { unlocked: false })));
    for (let i = 0; i < n; i++) s.appendChild(mkCell(randomSym(r, free))); shown[r].forEach(c => s.appendChild(mkCell(c)));
    const total = n + 3, y0 = -total * cellH, dur = (700 + r * 330 + (tease ? 1500 : 0)) * fast * (window.__gorillaSpeed || 1);
    if (tease) setTimeout(() => { reelEls[2].classList.add('tease'); A.play('drum', 2); }, (700 + 330) * fast);
    const anim = s.animate([{ transform: `translateY(${y0}px)`, filter: 'blur(0)' }, { transform: `translateY(${y0 * .55}px)`, filter: 'blur(3px)', offset: .3 }, { transform: `translateY(${cellH * .14}px)`, filter: 'blur(0)', offset: .92 }, { transform: 'translateY(0)' }], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)' });
    proms.push(anim.finished.then(() => { s.style.transform = 'translateY(0)'; while (s.children.length > 3) s.removeChild(s.lastChild); reelEls[r].classList.remove('tease'); A.play('reelStop', r);
      grid[r].forEach((c, y) => { if (c.s === 'DR') { A.play('drum', r); cellEl(r, y).classList.add('land'); } if (c.s === 'CN') A.play('coin', r * 3 + y); if (c.s === 'WD') cellEl(r, y).classList.add('land'); }); }));
  }
  await Promise.all(proms); shown = grid.map(col => col.map(c => ({ ...c })));
}
function clearMarks() { document.querySelectorAll('.cell').forEach(c => c.classList.remove('win', 'dim', 'land')); $('winBanner').classList.add('hidden'); }
function markWins(res) { const cells = new Set(); for (const w of res.ways) for (let r = 0; r < 3; r++) res.grid[r].forEach((c, y) => { if (c.s === w.s || (r === 1 && c.s === 'WD')) cells.add(r + ',' + y); });
  if (res.coins.pay) res.coins.list.forEach(c => { if (!c.locked) cells.add(c.r + ',' + c.y); }); if (res.bonus) res.grid.forEach((col, r) => col.forEach((c, y) => { if (c.s === 'DR') cells.add(r + ',' + y); }));
  if (!cells.size) return; for (let r = 0; r < 3; r++) for (let y = 0; y < 3; y++) cellEl(r, y).classList.add(cells.has(r + ',' + y) ? 'win' : 'dim'); }
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
  A.init(); if (busy) { quick = true; return; }
  if (st.cents < betCents()) { A.play('deny'); toast(st.cents > 0 ? 'Not enough for this bet — lower the bet or insert a bill' : 'Insert a $100 bill to play'); $('billBtn').classList.remove('pulse'); void $('billBtn').offsetWidth; $('billBtn').classList.add('pulse'); return; }
  busy = true; quick = false; meters(); $('spinBtn').classList.add('stop'); $('spinBtn').textContent = 'STOP';
  st.cents -= betCents(); st.played++; save(); disp.cents = st.cents; disp.win = 0; meters(); ape.lookAt('reels');
  const fk = forceNext; forceNext = null; const res = M.spin(bet(), rng, fk ? { force: applyForce(fk) } : {});
  await animateReels(res, false);
  let total = await resolve(res, false);
  if (res.bonus) total += await bonus(fk);
  if (total > 0) { st.cents += total * st.denom; st.lastWin = total; save(); await roll('cents', st.cents, 600, false); }
  $('spinBtn').classList.remove('stop'); $('spinBtn').textContent = 'SPIN'; busy = false; quick = false; meters(); setTimeout(() => !busy && ape.lookAt('idle'), 1500);
  if (st.cents < betCents() && st.cents > 0) toast('Low on cash — insert another bill or lower the bet');
}
// shows locks/smash, highlights, roll-up and tier celebrations for one spin. returns credits won
async function resolve(res, free) {
  const locked = res.coins.list.filter((c, i) => res.grid[c.r][c.y].locked);
  if (res.coins.count >= 3 && locked.length) {
    if (res.coins.smashed) { const tgt = locked[0], rc = cellEl(tgt.r, tgt.y).getBoundingClientRect(); ape.lookAt('reels'); await sleep(200);
      await ape.slam((rc.left + rc.width / 2) / innerWidth); A.play('crack'); document.querySelectorAll('.lock').forEach(l => l.classList.add('gone')); await sleep(450); }
    else { ape.lookAt('reels'); await sleep(500); toast('🔒 Locked coins — the gorilla didn’t smash them this time', 1400); }
  }
  markWins(res); const win = res.win; if (!win) return 0;
  const lines = res.ways.map(w => `${M.SYM[w.s].name} ×${w.ways}${w.mult > 1 ? ' (×' + (+w.mult.toFixed(1)) + ')' : ''}`); if (res.coins.pay) lines.push(`Prize coins ${money(res.coins.pay * st.denom)}`);
  $('winBanner').textContent = `WIN ${money(win * st.denom)}`; $('winBanner').title = lines.join(' · '); $('winBanner').classList.remove('hidden');
  const t = M.tier(win, bet());
  if (t === 'big' || t === 'mega' || t === 'epic') await bigWin(t, win);
  else { A.play('win', win >= 3 * bet() ? 3 : 1); if (win >= 3 * bet() && !ape.busy()) ape.chestBeat(4); else if (Math.random() < .5) ape.nod(); await roll('win', disp.win + win, Math.min(2500, 400 + win / bet() * 300), true); }
  if (!t.match(/big|mega|epic/)) {} else disp.win += 0; return win;
}
async function bigWin(t, win) {
  const o = $('big'); o.className = t; $('bigTitle').textContent = t.toUpperCase() + ' WIN'; $('bigAmt').textContent = money(0); o.classList.remove('hidden');
  A.play('fanfare', t === 'epic' ? 3 : t === 'mega' ? 2 : 1); ape.lookAt('player'); playMedia(t + '-win.mp4'); if (t === 'big') ape.chestBeat(6); else ape.roar(t === 'epic' ? 2.4 : 1.8);
  let skip = false; o.onclick = () => { skip = true; quick = true; };
  const ms = t === 'epic' ? 9000 : t === 'mega' ? 6500 : 4500, from = disp.win, t0 = performance.now(), dur = ms * (window.__gorillaSpeed || 1);
  await new Promise(res => { let last = 0; const step = now => { const u = skip ? 1 : Math.min(1, (now - t0) / dur), v = Math.round(win * (1 - Math.pow(1 - u, 2))); $('bigAmt').textContent = money(v * st.denom); disp.win = from + v; meters(); if (now - last > 90) { last = now; A.play('coin', (now / 90 | 0) % 12); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  await sleep(skip ? 300 : 1400); o.classList.add('hidden'); if (t !== 'big') ape.chestBeat(4);
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
  A.play('drum', 0); await sleep(250); A.play('drum', 1); await sleep(250); A.play('drum', 2); ape.lookAt('player');
  const clip = await playMedia('bonus-roar.mp4'); if (!clip) { ape.lightning(); await Promise.race([ape.roar(2), sleep(3200)]); }
  const box = $('wheelBox'); box.classList.remove('hidden'); $('wheelMsg').textContent = 'Tap SPIN'; let ang = 0; drawWheel(0);
  const forceIdx = fk === 'thunder' ? 1 : fk === 'jackpot' ? 3 : undefined, w = M.spinWheel(bet(), rng, forceIdx);
  await new Promise(res => { const hub = $('wheelHub'); const go = () => { hub.onclick = null; clearTimeout(auto); res(); }; hub.onclick = go; const auto = setTimeout(go, quick ? 300 : 3500); });
  A.play('drum', 1); const n = M.WHEEL.length, target = -w.idx * 2 * Math.PI / n + (Math.random() - .5) * .5 * 2 * Math.PI / n, spins = 5, end = target - spins * 2 * Math.PI, dur = (quick ? 1500 : 5200) * (window.__gorillaSpeed || 1), t0 = performance.now(); let lastSeg = -1;
  await new Promise(res => { const step = now => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3.2); ang = end * e; drawWheel(ang); const seg = Math.floor(-ang / (2 * Math.PI / n) + .5); if (seg !== lastSeg) { lastSeg = seg; A.play('wheelTick'); } if (u < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  let won = 0;
  if (w.freeSpins) { $('wheelMsg').textContent = `⚡ ${w.freeSpins} THUNDER SPINS!`; A.play('thunder'); ape.lightning(); playMedia('thunder-intro.mp4'); await sleep(1800); box.classList.add('hidden'); won = await thunderSpins(w.freeSpins); }
  else { const c = w.win; $('wheelMsg').textContent = w.wedge.jp ? `${w.wedge.label} JACKPOT ${money(c * st.denom)}` : `${money(c * st.denom)}`;
    if (w.wedge.jp) { A.play('jackpot'); const pl = document.querySelector('.plq.' + w.wedge.id); pl && pl.classList.add('hit'); setTimeout(() => pl && pl.classList.remove('hit'), 3500); playMedia('jackpot.mp4'); ape.roar(2.2); } else { A.play('win', 4); ape.chestBeat(5); }
    await sleep(2200); box.classList.add('hidden'); const t = M.tier(c, bet()); if (t.match(/big|mega|epic/)) await bigWin(t, c); else await roll('win', disp.win + c, 1200, true); won = c; }
  return won;
}
async function thunderSpins(n) {
  const hud = $('fsHud'); hud.classList.remove('hidden'); let left = n, played = 0, total = 0; const upd = () => { $('fsCount').textContent = `${played} of ${played + left}`; $('fsWin').textContent = money(total * st.denom); }; upd();
  document.body.classList.add('thunder');
  while (left > 0 && played < 40) { left--; played++; upd(); await sleep(quick ? 150 : 600); if (Math.random() < .35) ape.lightning(); ape.lookAt('reels');
    const res = M.spin(bet(), rng, { free: true }); await animateReels(res, true); const w = await resolve(res, true); total += w; if (res.bonus) { left += 4; A.play('thunder'); ape.lightning(); toast('⚡ +4 THUNDER SPINS', 1500); await Promise.race([ape.roar(1.4), sleep(2500)]); } upd(); await sleep(quick ? 200 : 700); }
  hud.classList.add('hidden'); document.body.classList.remove('thunder');
  $('wheelBox').classList.remove('hidden'); $('wheelMsg').textContent = `THUNDER SPINS WON ${money(total * st.denom)}`; await sleep(2200); $('wheelBox').classList.add('hidden');
  const t = M.tier(total, bet()); if (t.match(/big|mega|epic/)) { disp.win = 0; await bigWin(t, total); } return total;
}
// ---------------- controls ----------------
$('spinBtn').onclick = spin; $('billBtn').onclick = insertBill; $('cashBtn').onclick = cashOut; $('reels').onclick = () => { if (busy) quick = true; else spin(); };
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
$('menuBtn').onclick = () => { $('menu').classList.remove('hidden'); $('qBtn').textContent = 'Graphics: ' + (ape.q || 'off'); showPay(); };
$('qBtn').onclick = () => { const order = ['high', 'med', 'low'], n = order[(order.indexOf(ape.q) + 1) % 3]; ape.setQuality(n); };
$('payBtn').onclick = showPay; $('aboutBtn').onclick = () => { $('menuBody').innerHTML = `<p><b>GORILLA</b> is an original play-money slot made for Tricity game nights. It is not a real-money game: bills, credits and tickets have no cash value.</p><p>The gorilla is photoreal AI-generated video made for this game (original character, no film likeness). Gorilla sounds are real recordings: “Gorillaschrei” (alpha male roar, zoo in Germany) by J0ck0 on Freesound, CC0 / public domain — freesound.org/s/397054 — layered with the clips’ own synced roar, chest-beat and slam audio. Other effects are synthesized live. Math: 27 ways, target return about 95.5%.</p><p>Played ${st.played.toLocaleString()} spins · inserted ${money(st.inserted)} play money on this device.</p>`; };
function showPay() { const b = betCents(), u = b / 27; const row = s => `<div><img src="${SY.get(s)}"><b>${M.SYM[s].name}</b><span>3 = ${money(M.PAY[s] * u)}/way</span></div>`;
  $('menuBody').innerHTML = `<p>Bet ${bet()} credits (${money(b)}). 27 ways: 3 matching symbols on adjacent reels from left to right, any row. Pays shown per way at this bet.</p><div class=pt>${['SB', 'MK', 'TC', 'ID', 'BN', 'RB', 'EM', 'SP'].map(row).join('')}</div>
  <div class=pt><div><img src="${SY.get('WD')}"><b>Wild ×2–×25</b><span>reel 2 only, multiplies</span></div><div><img src="${SY.get('CN')}"><b>Prize Coins</b><span>3+ anywhere pay their values</span></div><div><img src="${SY.get('CN')}"><b>🔒 Locked</b><span>pay only if the gorilla smashes them</span></div><div><img src="${SY.get('DR')}"><b>Jungle Drums</b><span>3 = Drum Wheel bonus</span></div></div>
  <p>Drum Wheel: credit prizes, BRONZE ${money(25 * b)}, SILVER ${money(75 * b)}, GOLD ${money(250 * b)}, TITAN ${money(1000 * b)} or ⚡ 10 THUNDER SPINS (extra wilds with bigger multipliers; 3 drums add +4 spins, up to 40).</p>`; }
// idle personality
setInterval(() => { if (busy || document.hidden || ape.busy()) return; const r = Math.random() * (ape.kind === 'video' ? 2.2 : 1); if (r < .25) ape.chestBeat(3); else if (r < .5) ape.nod(); else if (r < .6) ape.lookAt('player'); }, 14000);
// auto quality: drop pixel ratio if the device struggles (first visit only)
if (ape && ape.renderer && !localStorage.getItem('gorillaQ')) setTimeout(() => { if (ape.fps && ape.fps < 26) { ape.renderer.setPixelRatio(1); localStorage.setItem('gorillaQ', ape.fps < 18 ? 'low' : 'med'); } }, 9000);
// debug / test hooks
window.G = { st, spin, insertBill, cashOut, get busy() { return busy; }, setDenom: d => { st.denom = d; save(); meters(); }, setBet: i => { st.bet = i; save(); meters(); }, M };
if (DEBUG) { window.G.force = k => { forceNext = k; }; window.__gorillaSpeed = +(qs.get('speed') || 1); const d = $('dbg'); d.classList.remove('hidden'); d.innerHTML = ['win', 'big', 'mega', 'epic', 'smash', 'bonus', 'thunder', 'jackpot'].map(k => `<button data-k=${k}>${k}</button>`).join(''); d.onclick = e => { if (e.target.dataset.k) { forceNext = e.target.dataset.k; toast('next spin: ' + forceNext, 900); } }; }
// boot
renderStatic(); meters(); requestAnimationFrame(() => { frameSync(); renderStatic(); });
document.addEventListener('pointerdown', () => A.init(), { once: true });
