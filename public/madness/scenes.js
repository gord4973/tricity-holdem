// MITSUBISHI MADNESS - full-screen bonus scenes on #scene: RALLY RACE, S-AWC OFF-ROAD CHALLENGE, PHEV CHARGING.
// Every outcome is decided by MadnessMath before the scene opens; the scene only acts it out. Each scene auto-advances if the player
// does nothing (so it can never strand anyone), and has a hard safety cap that resolves with the already-decided win. window.MadScenes
(function () {
  const $ = id => document.getElementById(id), F = () => window.MadFX, A = () => window.MadAudio;
  const sp = () => window.__madSpeed || 1;
  const sleep = ms => new Promise(r => setTimeout(r, ms * sp()));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const RACERS = [{ k: 'rvr', name: 'RVR', c: '#11b8a6' }, { k: 'ec', name: 'ECLIPSE CROSS', c: '#ff7a1a' }, { k: 'ev', name: 'SPORTBACK EV', c: '#00c8ff' }, { k: 'phev', name: 'OUTLANDER PHEV', c: '#e0182d' }];
  const ORD = ['', '1ST', '2ND', '3RD', '4TH'];
  // ---------------- scene controller ----------------
  const S = { draw: null, alive: false, raf: 0, seq: 0 };
  function open(title, sub) { S.seq++; const el = $('scene'); el.classList.remove('hidden'); $('sceneTitle').textContent = title; $('sceneSub').textContent = sub || ''; $('sceneHud').innerHTML = ''; $('sceneBtns').innerHTML = ''; $('sceneMsg').classList.add('hidden'); S.alive = true; F().pauseStage(true);
    const cv = $('sceneCv'), g = cv.getContext('2d'); const loop = now => { if (!S.alive) return; S.raf = requestAnimationFrame(loop); const { W, H, d } = F().fit(cv); g.setTransform(d, 0, 0, d, 0, 0); try { S.draw && S.draw(g, W, H, now); } catch (e) { console.warn('scene draw', e); } }; S.raf = requestAnimationFrame(loop); return S.seq; }
  function close() { try { prompt(''); const h = $('sceneHow'); h && h.classList.add('hidden'); } catch (e) {} S.alive = false; S.draw = null; cancelAnimationFrame(S.raf); $('scene').classList.add('hidden'); $('sceneBtns').innerHTML = ''; $('sceneMsg').classList.add('hidden'); F().pauseStage(false); }
  function msg(html, color, ms) { const m = $('sceneMsg'); m.style.setProperty('--msgC', color || '#ffb000'); m.innerHTML = html; m.classList.remove('hidden'); m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; if (ms) setTimeout(() => m.classList.add('hidden'), ms * sp()); }
  // t114u: clear directions - a HOW TO PLAY card before every interactive round, a persistent prompt bar, pulsing tap targets
  function howTo(title, lines, go = "GOT IT — LET'S GO!") { return new Promise(res => { const sc = $('scene'); let el = $('sceneHow'); if (!el) { el = document.createElement('div'); el.id = 'sceneHow'; sc.appendChild(el); }
    el.innerHTML = `<div class=hcard><b>HOW TO PLAY</b><h3>${title}</h3><ol>${lines.map(l => `<li>${l}</li>`).join('')}</ol><button class="sbtn big pulse">${go}</button><small>starts by itself in <i>10</i>s</small></div>`; el.classList.remove('hidden');
    let done = false, left = 10; const fin = () => { if (done) return; done = true; clearInterval(tm); el.classList.add('hidden'); A().play('pick'); res(); }; window.__howTo = (window.__howTo || 0) + 1; window.__howTitle = title;
    el.querySelector('button').addEventListener('click', fin); el.addEventListener('click', e => { if (e.target === el) fin(); });
    const tm = setInterval(() => { left--; const i = el.querySelector('i'); if (i) i.textContent = Math.max(0, left); if (left <= 0) fin(); }, 1000 * sp()); }); }
  function prompt(html) { let el = $('scenePrompt'); if (!el) { el = document.createElement('div'); el.id = 'scenePrompt'; $('scene').appendChild(el); } if (!html) { el.classList.add('hidden'); return; } el.innerHTML = html; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    const place = () => { const bx = $('sceneBtns'), sc = $('scene').getBoundingClientRect(), r = bx.getBoundingClientRect(), has = bx.children.length && r.height > 0; el.style.bottom = has ? Math.round(sc.bottom - r.top + 22) + 'px' : ''; };
    place(); clearInterval(S.pt); S.pt = setInterval(() => { if (el.classList.contains('hidden') || !S.alive) { clearInterval(S.pt); return; } place(); }, 200); }
  // show buttons, resolve with the chosen index; auto-picks after autoMs (countdown shown) so nobody is ever stuck
  function choose(items, autoMs, hudLabel) { return new Promise(res => { const box = $('sceneBtns'); box.innerHTML = ''; let done = false, left = Math.round(autoMs / 1000);
    const fin = i => { if (done) return; done = true; clearInterval(t); box.querySelectorAll('button').forEach((b, k) => { b.disabled = true; b.classList.remove('pulse'); b.classList.toggle('picked', k === i); }); A().play('pick'); res(i); };
    items.forEach((it, i) => { const b = document.createElement('button'); b.className = 'sbtn pulse ' + (it.cls || ''); b.innerHTML = it.html; b.dataset.i = i; b.addEventListener('click', () => fin(i)); box.appendChild(b); });
    const hud = () => { if (hudLabel) $('sceneHud').innerHTML = `${hudLabel}<br><small style="font-size:.6em;opacity:.7">auto in ${left}s</small>`; }; hud();
    const t = setInterval(() => { left--; hud(); if (left <= 0) fin(Math.floor(Math.random() * items.length)); }, 1000 * sp()); }); }
  // run fn with a hard safety cap; on timeout/error the scene closes and the decided win stands
  async function guarded(maxMs, R, fn) { let timer; const cap = new Promise(r => { timer = setTimeout(() => r('cap'), maxMs * sp()); });
    try { const r = await Promise.race([fn(), cap]); if (r === 'cap') { window.__sceneCap = (window.__sceneCap || 0) + 1; } } catch (e) { console.error('scene error', e); window.__sceneErr = (window.__sceneErr || 0) + 1; }
    finally { clearTimeout(timer); close(); } return R.win; }
  // ---------------- RALLY RACE ----------------
  function rally(R, env) { return guarded(60000, R, async () => {
    open('RALLY RACE', 'PICK YOUR CAR — FINISH 1ST FOR ' + (30) + '× BET');
    const st = { phase: 'grid', t0: 0, pick: -1, prog: [0, 0, 0, 0], places: null, lights: 0, cam: 0, flash: 0 };
    const scroll = { x: 0 };
    S.draw = (g, W, H, now) => { const speed = st.phase === 'race' ? 26 : st.phase === 'finish' ? 6 : 0; scroll.x = (scroll.x + speed * sp() ** -1) % 80; scroll.px = (scroll.px || 0) + speed * 1.6;
      // photo-real circuit (grandstand + asphalt), scrolling with motion blur while racing
      const ph = F().photo('bg-rally'); g.fillStyle = '#111'; g.fillRect(0, 0, W, H); const m = F().cover(g, ph, W, H, { scroll: scroll.px });
      if (speed > 10) { g.globalAlpha = .35; F().cover(g, ph, W, H, { scroll: scroll.px - 14 }); g.globalAlpha = .2; F().cover(g, ph, W, H, { scroll: scroll.px - 28 }); g.globalAlpha = 1; }
      const top = m.ok ? m.y(.475) : H * .3, bot = m.ok ? m.y(.885) : H * .74, laneH = (bot - top) / 4;
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let l = 1; l < 4; l++) { const y = top + l * laneH; for (let x = -80 + scroll.x; x < W; x += 80) g.fillRect(x, y - 1, 40, 2); }
      const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,.35)'); vg.addColorStop(.2, 'rgba(0,0,0,0)'); vg.addColorStop(.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      // finish line (comes in from the left near the end)
      const lead = Math.max(...st.prog), camP = st.phase === 'grid' || st.phase === 'lights' ? 0 : Math.min(lead, 1.02) - .12, worldX = p => W * .62 - (p - camP) * W * 2.6;
      const fx = worldX(1); if (fx > -30 && fx < W + 30) { for (let r = 0; r < 4 * 3; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? '#000' : '#fff'; g.fillRect(fx - 12 + c * 12, top + r * (bot - top) / 12, 12, (bot - top) / 12); } }
      // start gantry lights
      if (st.phase === 'lights' || st.phase === 'grid') { const n = 5, cw = 26; for (let i = 0; i < n; i++) { const x = W / 2 - (n * cw) / 2 + i * cw + cw / 2; g.fillStyle = '#111'; g.fillRect(x - 11, H * .14, 22, 34); g.fillStyle = st.lights > 5 ? '#30e060' : i < st.lights ? '#ff2030' : '#330'; g.shadowColor = g.fillStyle; g.shadowBlur = i < st.lights || st.lights > 5 ? 18 : 0; g.beginPath(); g.arc(x, H * .14 + 17, 8, 0, 7); g.fill(); g.shadowBlur = 0; } }
      // cars
      const w = Math.min(W * .3, laneH * 2.3);
      for (let i = 0; i < 4; i++) { const y = top + (i + 1) * laneH - laneH * .12, x = worldX(st.prog[i]) + (st.phase === 'race' ? Math.sin(now / 90 + i) * 1.5 : 0); const mine = i === st.pick;
        F().drawCar(g, RACERS[i].k, x, y, w, { flame: st.phase === 'race' && (st.boost && st.boost[i]) ? 1.6 : st.phase === 'race' ? .6 : 0, glow: mine ? '#ffd84a' : null });
        g.fillStyle = RACERS[i].c; g.font = `900 ${Math.round(laneH * .2)}px Russo,sans-serif`; g.textAlign = 'center'; { const lab = (mine ? '★ YOU · ' : '') + RACERS[i].name, tw = g.measureText(lab).width; g.fillText(lab, Math.max(tw / 2 + 6, Math.min(W - tw / 2 - 6, x)), y - w * .36); }
        if (st.places && st.phase === 'done') { g.fillStyle = '#ffd84a'; g.font = `900 ${Math.round(laneH * .32)}px Russo,sans-serif`; g.fillText(ORD[st.places[i]], x + w * .62, y - w * .12); } }
      // speed lines
      if (st.phase === 'race') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = rnd(top, bot), x = rnd(0, W); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(40, 120), y); g.stroke(); } }
      if (st.flash > 0) { g.fillStyle = `rgba(255,255,255,${st.flash})`; g.fillRect(0, 0, W, H); st.flash = Math.max(0, st.flash - .04); } };
    await howTo('RALLY RACE', ['Tap one of the <b>4 cars</b> at the bottom to pick your racer.', 'The start lights count down, then it\'s <b>GO!</b> — watch your car (★ YOU) race.', 'Prize: <b>1st 30× bet</b> (NITRO FINISH doubles it), 2nd 15×, 3rd 8×, 4th 4×.']);
    prompt('👇 TAP A CAR TO PICK YOUR RACER');
    const pick = await choose(RACERS.map(r => ({ cls: 'car', html: `<img src="/madness/art/car-${{ rvr: 'rvr', ec: 'eclipse-cross', ev: 'eclipse-sportback', phev: 'outlander-phev' }[r.k]}.webp?v=1" alt="">${r.name}` })), 9000, 'CHOOSE A CAR');
    st.pick = pick; $('sceneBtns').innerHTML = ''; $('sceneHud').innerHTML = ''; window.__rallyPick = pick; prompt(`★ YOU PICKED THE ${RACERS[pick].name} — WATCH IT RACE!`);
    // finishing order: your car gets R.place; the others fill the rest at random
    const others = [1, 2, 3, 4].filter(p => p !== R.place).sort(() => Math.random() - .5); st.places = RACERS.map((_, i) => i === pick ? R.place : others.pop());
    $('sceneSub').textContent = 'GET READY…'; st.phase = 'lights'; A().play('rev', 1.4);
    for (let i = 1; i <= 5; i++) { st.lights = i; A().play('lights', 0); await sleep(380); }
    await sleep(300); st.lights = 6; A().play('lights', 4); A().play('turbo'); $('sceneSub').textContent = 'GO GO GO!';
    const eng = A().engine(); st.phase = 'race'; const T = 5200 * sp(), t0 = performance.now(), fin = st.places.map(p => T * (0.86 + p * 0.045)), wob = st.places.map(() => [rnd(.03, .07), rnd(1.5, 3.5), rnd(0, 6)]);
    st.boost = [0, 0, 0, 0]; A().play('crowd', 5);
    await new Promise(res => { const step = () => { if (!S.alive) return res(); const t = performance.now() - t0; let all = true;
        for (let i = 0; i < 4; i++) { const u = Math.min(1.08, t / fin[i]), env2 = Math.sin(Math.min(1, u) * Math.PI), w2 = wob[i]; st.prog[i] = u + w2[0] * env2 * Math.sin(u * w2[1] * 6.283 + w2[2]); if (u < 1.06) all = false;
          st.boost[i] = st.places[i] === 1 && u > .7 && u < 1 ? 1 : 0; }
        eng.set(Math.min(1, .5 + t / T * .5)); if (Math.abs(t - T * .75) < 30 && st.places[pick] === 1) A().play('turbo');
        if (all || t > T * 1.4) { res(); return; } requestAnimationFrame(step); }; requestAnimationFrame(step); });
    eng.stop(); st.phase = 'done'; st.flash = .9; A().play('screech', .8); A().play('crack');
    const place = R.place; $('sceneSub').textContent = 'PHOTO FINISH';
    await sleep(500);
    if (place === 1) { A().play('fanfare'); F().fireworks(2200); F().confetti(140); } else A().play('win', 2);
    prompt(place === 1 ? '🏆 YOUR CAR WON THE RACE!' : `YOUR CAR CAME ${ORD[place]} · TAP TO CONTINUE`);
    msg(`YOU FINISHED ${ORD[place]}!<small>${R.nitro ? 'NITRO FINISH ×2 · ' : ''}${R.x}× BET = ${env.fmt(R.win)}</small>`, place === 1 ? '#ffd84a' : '#22c3ff');
    if (R.nitro) { await sleep(700); A().play('turbo'); F().speedLines(900, 'rgba(120,220,255,.8)'); }
    await tapOrWait(3200);
  }); }
  function tapOrWait(ms) { return new Promise(res => { let done = false; const el = $('scene'); const fin = () => { if (done) return; done = true; el.removeEventListener('click', fin); res(); }; setTimeout(() => el.addEventListener('click', fin), 600); setTimeout(fin, ms * sp()); }); }
  // ---------------- S-AWC OFF-ROAD CHALLENGE ----------------
  const TCOL = { GRAVEL: ['#5a4a3a', '#8a7a64', '#c9b28a'], MUD: ['#2e1d10', '#5a3a1e', '#7a4f28'], SNOW: ['#bcd6f0', '#e8f2ff', '#ffffff'], ROCKS: ['#3a3a44', '#6a6a78', '#9a9aa8'], SAND: ['#9a6a2a', '#d8a050', '#f4cf8a'] };
  const TRAILS = { GRAVEL: ['SWITCHBACK', 'RIDGE RUN', 'QUARRY CUT'], MUD: ['BOG HOLE', 'RUT ROAD', 'RIVER BANK'], SNOW: ['ICE SHELF', 'POWDER PASS', 'SNOW DRIFT'], ROCKS: ['ROCK CRAWL', 'BOULDER FIELD', 'LEDGE STEP'], SAND: ['DUNE CREST', 'WASHOUT', 'DESERT WASH'] };
  function offroad(R, env) { return guarded(120000, R, async () => {
    open('S-AWC CHALLENGE', 'PICK A TRAIL AT EACH STAGE · 5 STAGES TO THE SUMMIT');
    const st = { terrain: R.stages[0].terrain, drive: 0, stuck: 0, rescue: 0, total: 0, stage: 0, summit: false, t: 0, bump: 0 };
    let scrollX = 0;
    S.draw = (g, W, H, now) => { const c = TCOL[st.terrain] || TCOL.GRAVEL;
      const spd = st.drive ? 7 : st.stuck ? .4 : 0; scrollX += spd;
      // photo-real terrain for each stage (gravel / mud / snow / rocks / sand), scrolling as you drive
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H); const m = F().cover(g, F().photo('bg-' + String(st.terrain || 'GRAVEL').toLowerCase()), W, H, { scroll: scrollX * 1.2, fy: .6 });
      const base = m.ok ? Math.min(H * .86, m.y(.8)) : H * .66; const gy = x => base + Math.sin((x - scrollX) / 55) * 6 + Math.sin((x - scrollX) / 17) * 2;
      const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,.55)'); vg.addColorStop(.3, 'rgba(0,0,0,.05)'); vg.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      if (st.summit) { g.fillStyle = '#fff'; g.fillRect(W * .2, H * .2, 3, 50); g.fillStyle = '#ff2040'; g.fillRect(W * .2 + 3, H * .2, 30, 18); }
      const w = W * .55, cx = W * .48, y = gy(cx) + 4 + (st.drive ? Math.sin(now / 50) * 3 : 0) + (st.stuck ? Math.sin(now / 25) * 2 : 0);
      const tilt = (gy(cx + 30) - gy(cx - 30)) / 60 * .6 + (st.stuck ? Math.sin(now / 40) * .02 : 0);
      if (st.rescue) { g.save(); g.globalAlpha = .5 + .5 * Math.sin(now / 80); g.strokeStyle = '#22c3ff'; g.lineWidth = 6; g.shadowColor = '#22c3ff'; g.shadowBlur = 30; g.beginPath(); g.ellipse(cx, y - w * .15, w * .6, w * .25, 0, 0, 7); g.stroke(); g.restore(); }
      F().drawCar(g, 'out', cx, y, w, { tilt, flame: st.rescue ? 1.2 : 0 });
      if ((st.drive || st.stuck) && Math.random() < .9) for (let k = 0; k < (st.stuck ? 3 : 1); k++) { g.fillStyle = c[2]; const px = cx + w * rnd(-.35, .4), py = y - rnd(0, 30); g.globalAlpha = .8; g.beginPath(); g.arc(px + rnd(0, 30), py, rnd(2, 6), 0, 7); g.fill(); g.globalAlpha = 1; }
      // stage progress dots
      for (let i = 0; i < 5; i++) { const x = W / 2 + (i - 2) * 34, yy = H * .2; g.fillStyle = i < st.stage ? '#30e060' : i === st.stage ? '#ffd84a' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x, yy, 10, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = '900 11px Russo,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, x, yy + 1); }
      g.fillStyle = '#fff'; g.font = '900 16px Russo,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('WON ' + env.fmt(st.total), W / 2, H * .27); };
    await howTo('S-AWC OFF-ROAD CHALLENGE', ['Drive <b>5 stages</b> to reach the summit.', 'At each stage, <b>tap ONE of the 3 trail buttons</b> at the bottom of the screen.', 'A <b>clear</b> trail pays 2× – 10× bet and you drive on to the next stage.', 'A <b>STUCK</b> trail ends the challenge — but S-AWC can rescue you once.', 'Clear all 5 stages for a <b>20× SUMMIT</b> bonus.']);
    for (let i = 0; i < R.stages.length; i++) { const s = R.stages[i]; st.stage = i; prompt(`STAGE ${i + 1} OF 5 · ${s.terrain}<br><b>👇 TAP ONE OF THE 3 TRAILS BELOW</b>`); st.terrain = s.terrain; $('sceneSub').textContent = `STAGE ${i + 1} OF 5 · ${s.terrain}`;
      const names = TRAILS[s.terrain]; const pick = await choose(names.map(n => ({ html: `${n}<small>${s.terrain}</small>` })), 8000, 'PICK A TRAIL');
      prompt(`DRIVING THE ${names[pick]}…`); A().play('rev', 1); st.drive = 1; if (s.terrain === 'MUD') A().play('mud'); await sleep(1400); st.drive = 0;
      // reveal the other two trails (what they would have been)
      const btns = [...$('sceneBtns').querySelectorAll('button')];
      if (s.stuck || s.rescue) { st.stuck = 1; A().play('stuck'); msg('STUCK!<small>That trail was blocked</small>', '#ff2040'); await sleep(1300); st.stuck = 0; }
      if (s.rescue) { st.rescue = 1; A().play('turbo'); A().play('unlock'); msg('S-AWC ENGAGED!<small>Super All-Wheel Control pulls you free</small>', '#22c3ff'); st.drive = 1; await sleep(1500); st.drive = 0; st.rescue = 0; }
      if (s.stuck) { prompt('STUCK — THE CHALLENGE ENDS HERE. The other trails are shown on the buttons.'); btns.forEach((b, k) => { if (k !== pick) b.innerHTML = `${names[k]}<small>${[2, 3, 4, 5][Math.floor(Math.random() * 4)]}× would pay</small>`; }); await sleep(1600); break; }
      st.total += s.prize * env.bet; A().play('coin', i); A().play('win', i); const r = $('sceneCv').getBoundingClientRect(); F().coinBurst(r.width * .5, r.height * .55, 24 + s.prize * 3);
      msg(`TRAIL CLEARED! +${s.prize}× BET<small>${env.fmt(s.prize * env.bet)} won · ${i < 4 ? 'on to stage ' + (i + 2) : 'last stage done!'}</small>`, '#30e060'); prompt('✅ CLEAR! The buttons now show what the other trails would have done.');
      btns.forEach((b, k) => { if (k !== pick) b.innerHTML = `${names[k]}<small>${Math.random() < .3 ? 'STUCK' : [2, 3, 4, 5, 8][Math.floor(Math.random() * 5)] + '×'}</small>`; });
      await sleep(1500); $('sceneMsg').classList.add('hidden'); }
    st.stage = R.cleared;
    if (R.summit) { st.summit = true; st.total += 20 * env.bet; A().play('fanfare'); F().fireworks(2500); F().confetti(160); msg(`SUMMIT!<small>+20× BET bonus · total ${env.fmt(R.win)}</small>`, '#ffd84a'); }
    else msg(`CHALLENGE OVER<small>${R.cleared} stage${R.cleared === 1 ? '' : 's'} cleared · ${env.fmt(R.win)}</small>`, '#ffb000');
    window.__offroadDone = true; await tapOrWait(3000);
  }); }
  // ---------------- PHEV CHARGING ----------------
  function charge(R, env) { return guarded(120000, R, async () => {
    open('PHEV CHARGE', 'TAP TO CHARGE · EVERY km PAYS 1× BET · 72 km MAX');
    const st = { km: 0, shown: 0, flow: 0, surge: 0, full: 0, pulses: [], flick: 0, regen: 0 };
    S.draw = (g, W, H, now) => { g.fillStyle = '#02060e'; g.fillRect(0, 0, W, H);
      // photo-real night charging station (pedestal + canopy are in the photo)
      const m = F().cover(g, F().photo('bg-charge'), W, H, { fx: .62, fy: .55 });
      if (st.surge) { g.fillStyle = 'rgba(120,0,10,.35)'; g.fillRect(0, 0, W, H); }
      const carW = W * .74, cx = m.ok ? Math.min(W * .42, m.x(.5)) : W * .44, cy = m.ok ? m.y(.74) : H * .6, I = F().cars.phev, ch = I.naturalWidth ? carW * I.naturalHeight / I.naturalWidth : carW * .33;
      const px = m.ok ? m.x(.86) : W * .92, py = m.ok ? m.y(.5) + H * .12 : H * .6; // cable holster on the pedestal
      // pedestal LED reacts to the charge state
      if (m.ok) { g.save(); g.globalCompositeOperation = 'lighter'; const lc = st.full ? '48,224,96' : st.surge ? '255,32,64' : '34,195,255', lx = m.x(.72), ly = m.y(.32); const lg = g.createRadialGradient(lx, ly, 0, lx, ly, W * .18); lg.addColorStop(0, `rgba(${lc},${.35 + .25 * Math.sin(now / 200)})`); lg.addColorStop(1, `rgba(${lc},0)`); g.fillStyle = lg; g.fillRect(lx - W * .2, ly - W * .2, W * .4, W * .4); g.restore(); }
      // glow under the car while charging
      if (st.flow) { const gl = g.createRadialGradient(cx, cy, 10, cx, cy, carW * .6); gl.addColorStop(0, 'rgba(34,195,255,.45)'); gl.addColorStop(1, 'rgba(34,195,255,0)'); g.fillStyle = gl; g.fillRect(0, cy - carW * .4, W, carW * .6); }
      F().drawCar(g, 'phev', cx, cy, carW, { glow: st.full ? '#30e060' : st.flow ? '#22c3ff' : null });
      // cable post -> charge port (rear quarter of the car)
      const ex = cx + carW * .36, ey = cy - ch * .62; g.strokeStyle = '#111'; g.lineWidth = 7; g.beginPath(); g.moveTo(px - 8, py - H * .12); g.bezierCurveTo(px - 30, py + 20, ex + 40, ey + 70, ex, ey); g.stroke();
      g.strokeStyle = st.surge ? '#ff2040' : st.flow ? '#22c3ff' : '#334'; g.lineWidth = 3; g.stroke();
      if (st.flow && Math.random() < .7) st.pulses.push(0);
      g.fillStyle = '#bff4ff'; for (let i = st.pulses.length - 1; i >= 0; i--) { st.pulses[i] += .03; const t = st.pulses[i]; if (t >= 1) { st.pulses.splice(i, 1); continue; } const P0 = [px - 8, py - H * .12], P1 = [px - 30, py + 20], P2 = [ex + 40, ey + 70], P3 = [ex, ey], b = (a, k) => (1 - t) ** 3 * P0[k] + 3 * (1 - t) ** 2 * t * P1[k] + 3 * (1 - t) * t * t * P2[k] + t ** 3 * P3[k];
        g.shadowColor = '#22c3ff'; g.shadowBlur = 10; g.beginPath(); g.arc(b(0, 0), b(0, 1), 4, 0, 7); g.fill(); g.shadowBlur = 0; }
      g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill();
      // battery gauge
      st.shown += (st.km - st.shown) * .12; if (Math.abs(st.km - st.shown) < .05) st.shown = st.km;
      const bw = W * .84, bh = Math.max(44, H * .075), bx = (W - bw) / 2, by = H * .7; g.fillStyle = '#0a0f18'; g.strokeStyle = st.full ? '#30e060' : '#9fe8ff'; g.lineWidth = 4; rr(g, bx, by, bw, bh, 10); g.fill(); g.stroke(); g.fillStyle = g.strokeStyle; g.fillRect(bx + bw, by + bh * .3, 10, bh * .4);
      const f = st.shown / 72, segs = 24; for (let i = 0; i < segs; i++) { const on = (i + 1) / segs <= f + 1e-6, part = !on && i / segs < f; const sx = bx + 6 + i * (bw - 12) / segs; const hue = st.full ? (now / 8 + i * 15) % 360 : 190 - i * 2.5;
        g.fillStyle = on || part ? `hsl(${hue},95%,${on ? 55 : 35}%)` : '#151c28'; g.fillRect(sx + 1, by + 6, (bw - 12) / segs - 2, bh - 12); }
      g.fillStyle = '#fff'; g.font = `900 ${Math.round(bh * .9)}px Russo,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = st.full ? '#30e060' : '#22c3ff'; g.shadowBlur = 16;
      g.fillText(`${Math.round(st.shown)} km`, W / 2, by + bh + bh * 1.05); g.shadowBlur = 0; g.font = `800 italic ${Math.round(bh * .34)}px Barlow,sans-serif`; g.fillStyle = '#9fe8ff'; g.fillText(`of 72 km electric range  ·  ${env.fmt(Math.round(st.shown) * env.bet)}`, W / 2, by + bh + bh * 1.5);
      if (st.flick > 0) { g.fillStyle = `rgba(255,30,50,${st.flick * (Math.random() < .5 ? .6 : .1)})`; g.fillRect(0, 0, W, H); st.flick -= .02; }
      if (st.surge && Math.random() < .25) { g.strokeStyle = '#ffe0e0'; g.lineWidth = 3; g.shadowColor = '#ff2040'; g.shadowBlur = 16; g.beginPath(); let x = px, y = py - H * .2; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += rnd(-40, 10); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; }
      if (st.full) { g.save(); g.globalAlpha = .5 + .5 * Math.sin(now / 120); g.fillStyle = '#30e060'; g.font = `900 ${Math.round(W * .06)}px Russo,sans-serif`; g.fillText('100%', W / 2, by - 10); g.restore(); } };
    await howTo('PHEV CHARGE', ['Tap the big <b>⚡ TAP TO CHARGE</b> button at the bottom.', 'Each tap adds <b>3 – 9 km</b> of electric range (REGEN BOOST doubles it).', 'Every km pays <b>1× bet</b> — fill all <b>72 km</b> for a FULL CHARGE.', 'Watch out: a <b>POWER SURGE</b> stops the charge.']);
    A().play('plug'); const hum = A().hum(); let tapped = null; prompt('👇 TAP ⚡ TO CHARGE — KEEP TAPPING!');
    await sleep(500);
    const box = $('sceneBtns'), btn = document.createElement('button'); btn.className = 'sbtn big pulse'; btn.innerHTML = 'TAP TO CHARGE ⚡<small>auto-charges if you wait</small>'; box.appendChild(btn);
    const waitTap = ms => new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; btn.removeEventListener('click', fin); res(); }; btn.addEventListener('click', fin); tapped = fin; setTimeout(fin, ms * sp()); });
    const rect = () => $('sceneCv').getBoundingClientRect();
    for (let i = 0; i <= R.bursts.length; i++) {
      if (i === R.bursts.length && R.full) break;
      await waitTap(2600);
      if (i === R.bursts.length) { // POWER SURGE
        st.flow = 1; hum.set(.9); await sleep(350); st.flow = 0; st.surge = 1; st.flick = 1; hum.stop(); A().play('surge'); const r = rect(); F().sparks(r.width * .9, r.height * .45, 40, '#ff8080'); F().sparks(r.width * .8, r.height * .5, 30, '#ffe0e0');
        $('sceneMsg').style.top = '18%'; msg(`POWER SURGE!<small>Charging stopped at ${R.km} km</small>`, '#ff2040'); btn.disabled = true; btn.classList.remove('pulse'); prompt(`⚡ SURGE — YOU KEEP YOUR ${R.km} km`); break; }
      const b = R.bursts[i]; st.flow = 1; hum.set(b.total / 72); A().play('zap', i); A().play('sparkle');
      if (b.regen) { A().play('turbo'); $('sceneMsg').style.top = '18%'; msg(`REGEN BOOST ×2!<small>+${b.km} km</small>`, '#30e060', 1100 / sp()); }
      st.km = b.total; const r = rect(); F().sparks(r.width * .8, r.height * .45, 14); prompt(`+${b.km} km · ${b.total} of 72 km · <b>TAP ⚡ AGAIN!</b>`);
      await sleep(650); st.flow = 0;
    }
    if (R.full) { prompt('🔋 FULL CHARGE!'); hum.stop(); st.full = 1; btn.disabled = true; A().play('full'); F().fireworks(3200); F().confetti(200); F().coinRain(2600, 3); $('sceneMsg').style.top = '18%';
      msg(`FULL CHARGE 72 km!<small>72 km × BET = ${env.fmt(R.win)}</small>`, '#30e060'); }
    else { await sleep(900); $('sceneMsg').style.top = '18%'; msg(`${R.km} km CHARGED<small>${R.km} km × BET = ${env.fmt(R.win)}</small>`, '#22c3ff'); A().play('win', 1); }
    try { hum.stop(); } catch (e) {}
    window.__chargeDone = { km: st.km, full: !!st.full };
    await tapOrWait(3200); $('sceneMsg').style.top = '';
  }); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  window.MadScenes = { rally, offroad, charge, close, get open() { return S.alive; } };
})();
