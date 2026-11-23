// GORILLA - photoreal video gorilla. Stacked <video> layers on one shared base pose:
// idle (seamless ping-pong loop) under an action layer (roar / chestbeat / slam) that crossfades in and back out.
// Video tracks are muted; sound comes from processed real gorilla recordings (WebAudio, synced to the clip clock).
// Same interface as the three.js Ape (chestBeat, roar, slam, reactBill, nod, lookAt, lightning, busy, resize ...).
const A = window.GorillaAudio;
const CLIPS = { // cue times in clip seconds (found by frame/audio analysis of the source clips)
  roar: { snd: 'roar', peak: 1.15, shakeAt: [[1.0, .25]], flashAt: [1.2] },
  chestbeat: { snd: 'chestbeat', beats: [2.42, 2.62, 2.85, 3.78, 3.95] },
  slam: { snd: 'slam', impacts: [1.12, 1.87] },
};
const DUR = { roar: 5.04, chestbeat: 5.04, slam: 4.04 }; // clip lengths, used to run the cues on a clock if a clip can't play
const MEDIA_V = '3'; // media cache-buster (bump when the mp4s change)
// lightweight error beacon -> POST /gorilla/log (kept in server memory, shown on /healthz)
let beacons = 0;
export function glog(kind, detail = {}) { try { if (beacons++ > 25) return; const c = navigator.connection || {};
  const body = JSON.stringify({ kind, ...detail, ua: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches, saveData: !!c.saveData, net: c.effectiveType || '', sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), t: Math.round(performance.now()) });
  if (!(navigator.sendBeacon && navigator.sendBeacon('/gorilla/log', new Blob([body], { type: 'application/json' })))) fetch('/gorilla/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {}); } catch (e) {} }
const verr = v => v && v.error ? { code: v.error.code, msg: v.error.message || '' } : {};
const LEDGE = 0.80; // fraction of the clip height that sits on the top edge of the reel frame (upper ledge visible, fingers tuck under the frame)
const ASPECT = 704 / 1296;
export class VideoApe {
  constructor(root, opts = {}) {
    this.kind = 'video'; this.root = root; this.on = {}; this.fps = 60; this.frameFrac = opts.frameFrac || .66;
    const conn = navigator.connection || {}; const saved = opts.quality;
    this.q = saved || ((conn.saveData || /2g|3g/.test(conn.effectiveType || '')) ? 'low' : 'high');
    const res = this.q === 'low' ? 'sd' : 'hd', base = '/gorilla/media/';
    root.innerHTML = `<div class=sceneBg style="background-image:url(${base}poster.jpg)"></div><div class=stage><video class=vIdle muted playsinline loop preload=auto poster="${base}poster.jpg"></video><video class=vAct muted playsinline preload=auto></video><div class=vFlash></div></div><canvas class=embers></canvas>`;
    this.stage = root.querySelector('.stage'); this.vIdle = root.querySelector('.vIdle'); this.vAct = root.querySelector('.vAct'); this.flash = root.querySelector('.vFlash'); this.cv = root.querySelector('.embers');
    this.src = n => `${base}${n}-${res}.mp4?v=${MEDIA_V}`;
    this.failed = false; let idleRetry = 0;
    this.ready = new Promise(ok => { this.vIdle.addEventListener('loadeddata', ok, { once: true }); setTimeout(ok, 8000);
      this.vIdle.addEventListener('error', () => { const e = verr(this.vIdle); glog('idle-error', { q: this.q, ...e, src: this.vIdle.currentSrc });
        if (idleRetry++ < 2) setTimeout(() => { this.vIdle.src = this.src('idle') + '&r=' + idleRetry; this.kick('retry'); }, 1500 * idleRetry); else { this.failed = true; ok(); } }); });
    this.vIdle.src = this.src('idle'); this.kick('boot');
    // autoplay can be blocked (battery saver, data saver, some installed-app launches): keep the poster and start on the first touch / return to the page
    const kick = () => this.kick('gesture');
    for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) addEventListener(ev, kick, { capture: true, passive: true });
    for (const ev of ['pageshow', 'focus']) addEventListener(ev, () => this.kick(ev));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick('visible'); });
    document.addEventListener('resume', () => this.kick('resume'));
    setTimeout(() => { const v = this.vIdle; if (v.paused || v.readyState < 2) glog('idle-status', { q: this.q, paused: v.paused, rs: v.readyState, ns: v.networkState, ct: +v.currentTime.toFixed(2), blocked: this.blocked || '', ...verr(v) }); }, 9000);
    // warm the action clips (separate preloading elements keep them in the HTTP cache) and the real-gorilla sounds
    this.ready.then(() => { this.pre = Object.keys(CLIPS).map(n => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = this.src(n); v.load(); return v; }); }).catch(() => {});
    A.fetchSamples({ roar: base + 'roar.mp3?v=' + MEDIA_V, chestbeat: base + 'chestbeat.mp3?v=' + MEDIA_V, slam: base + 'slam.mp3?v=' + MEDIA_V, grunt: base + 'grunt.mp3?v=' + MEDIA_V, roarReal: base + 'roar-real.mp3?v=' + MEDIA_V, idle: base + 'idle.mp3?v=' + MEDIA_V });
    window.__gorillaAmbient = true;
    this.cur = null; this.queue = Promise.resolve(); this.shake = 0; this.particles(); this.resize();
    let last = performance.now(), frames = 0, acc = 0; const loop = now => { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; frames++; acc += dt; if (acc > 1) { this.fps = frames / acc; frames = 0; acc = 0; } this.tick(dt); }; requestAnimationFrame(loop);
  }
  // ---------- layout: the clip's stone ledge lines up with the top of the reel frame ----------
  resize() { const H = innerHeight, W = innerWidth, top = this.frameFrac * H; let h = top / LEDGE, w = h * ASPECT;
    if (w > W * 1.0 && W / H > .7) { /* wide screens keep the full portrait column; the blurred backdrop fills the sides */ }
    this.stage.style.cssText = `height:${h}px;width:${w}px;left:${(W - w) / 2}px;top:0px`; this.root.style.height = top + 'px';
    this.cv.width = Math.round(W * Math.min(devicePixelRatio || 1, 1.5)); this.cv.height = Math.round(top * Math.min(devicePixelRatio || 1, 1.5)); this.cv.style.height = top + 'px'; }
  kick(why) { const v = this.vIdle; if (this.cur || !v.paused || this.failed) return; const p = v.play(); if (p) p.then(() => { this.blocked = ''; }).catch(e => { if (this.blocked !== e.name) glog('idle-play-blocked', { why, name: e.name, msg: e.message, q: this.q }); this.blocked = e.name; }); }
  worldXForScreen(fx) { return fx; }
  busy() { return !!this.cur; }
  lookAt() {} nod() {} setQuality(q) { localStorage.setItem('gorillaVQ', q); location.reload(); }
  // ---------- play one action clip; resolves when it has crossfaded back to idle ----------
  play(name, onCue) {
    if (this.pending >= 1 && name === 'chestbeat') return Promise.resolve(); // don't stack celebrations
    this.pending = (this.pending || 0) + 1; const job = this.queue.then(() => { this.pending--; return this._play(name, onCue); }); this.queue = job.catch(() => {}); return job;
  }
  _play(name, onCue) { return new Promise(resolve => {
    // the clip plays on the action layer; if it can't load or play, its cues (sound, shake, debris, lightning) still run on a clock over the idle/poster
    const v = this.vAct, c = CLIPS[name], rate = window.__gorillaSpeed && window.__gorillaSpeed < 1 ? Math.min(3, 1 / window.__gorillaSpeed) : 1;
    let snd = null, done = false, started = false, virtual = false, t0 = 0, fired = new Set(), raf = 0;
    this.cur = name; this.root.dataset.clip = name;
    const now = () => virtual ? (performance.now() - t0) / 1000 * rate : v.currentTime;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); v.onplaying = v.onerror = v.onended = null; v.classList.remove('on'); if (this.vIdle.paused) { this.vIdle.currentTime = 0; } this.cur = null; this.kick('after-clip');
      setTimeout(() => { this.root.dataset.clip = 'idle'; resolve(); }, 300); };
    const goVirtual = (why, e) => { if (done || virtual) return; const at = started ? v.currentTime : 0; glog('clip-skip', { clip: name, why, q: this.q, ...(e ? { name: e.name, msg: e.message } : verr(v)) });
      virtual = true; t0 = performance.now() - at / rate * 1000; v.classList.remove('on'); try { v.pause(); } catch (x) {} if (this.vIdle.paused) this.kick('clip-skip');
      if (!started) { started = true; snd = A.sample(c.snd, {}); if (snd && rate !== 1) snd.stop(); this.emit('clip', name); } };
    const cue = (key, t, fn) => { if (!fired.has(key) && now() >= t) { fired.add(key); fn(); } };
    const step = () => { raf = requestAnimationFrame(step); if (!started) return;
      (c.impacts || []).forEach((t, i) => cue('i' + i, t, () => { this.shake = Math.max(this.shake, i === 0 ? .9 : .7); this.burst(); this.emit('slam', i); onCue && onCue('impact', i); }));
      (c.beats || []).forEach((t, i) => cue('b' + i, t, () => { this.shake = Math.max(this.shake, .28); this.emit('beat', i); }));
      (c.shakeAt || []).forEach(([t, s], i) => cue('s' + i, t, () => { this.shake = Math.max(this.shake, s); }));
      (c.flashAt || []).forEach((t, i) => cue('f' + i, t, () => this.lightning()));
      const d = virtual ? DUR[name] : (v.duration || DUR[name]);
      if (now() >= d - .32) { if (!virtual) { this.vIdle.currentTime = 0; this.vIdle.play().catch(() => {}); } finish(); } };
    v.onended = () => { if (!virtual) finish(); }; v.onerror = () => goVirtual('error');
    v.onplaying = () => { if (started || virtual || done) return; started = true; v.classList.add('on'); snd = A.sample(c.snd, { offset: v.currentTime }); if (snd && rate !== 1) snd.stop(); this.emit('clip', name);
      setTimeout(() => { if (!done && !virtual) { this.vIdle.pause(); this.vIdle.currentTime = 0; } }, 320); };
    v.src = this.src(name); v.playbackRate = rate; try { v.currentTime = 0; } catch (x) {}
    raf = requestAnimationFrame(step); const p = v.play(); if (p) p.catch(e => goVirtual('play', e));
    setTimeout(() => { if (!started) goVirtual('timeout'); }, 2500);
    setTimeout(finish, 12000);
  }); }
  chestBeat() { return this.play('chestbeat'); }
  roar() { return this.play('roar'); }
  slam() { let hit; const p = new Promise(r => hit = r); this.play('slam', (k, i) => { if (k === 'impact' && i === 0) hit(); }).then(() => hit()); return p; }
  reactBill() { A.sample('grunt', { gain: .9 }); this.stage.classList.remove('lean'); void this.stage.offsetWidth; this.stage.classList.add('lean'); }
  lightning() { this.flash.classList.remove('go'); void this.flash.offsetWidth; this.flash.classList.add('go'); this.emit('thunder'); }
  roarSound() { A.sample('roarReal'); }
  emit(ev, a) { if (this.on && this.on[ev]) this.on[ev](a); }
  // ---------- embers + camera shake ----------
  particles() { this.emb = Array.from({ length: 70 }, () => this.newEmber(true)); this.deb = []; }
  newEmber(any) { return { x: Math.random(), y: any ? Math.random() : 1.05, vy: .03 + Math.random() * .08, vx: (Math.random() - .5) * .02, r: .6 + Math.random() * 1.8, a: .3 + Math.random() * .6, ph: Math.random() * 6 }; }
  burst() { for (let i = 0; i < 60; i++) this.deb.push({ x: .5 + (Math.random() - .5) * .5, y: .96, vx: (Math.random() - .5) * .9, vy: -.35 - Math.random() * .7, life: 1, r: .5 + Math.random() * 1.4 }); }
  tick(dt) { const c = this.cv, g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; const t = performance.now() / 1000;
    for (const e of this.emb) { e.y -= e.vy * dt; e.x += (e.vx + Math.sin(t + e.ph) * .01) * dt; if (e.y < -.05) Object.assign(e, this.newEmber(false)); const fl = .6 + .4 * Math.sin(t * 6 + e.ph); g.fillStyle = `rgba(255,${140 + 60 * fl | 0},60,${e.a * fl})`; g.beginPath(); g.arc(e.x * W, e.y * H, e.r * (Math.min(H, 1100) / 700 + .4), 0, 7); g.fill(); }
    for (const d of this.deb) { d.vy += 1.6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * .9; if (d.life > 0) { g.fillStyle = `rgba(255,${170 + Math.random() * 60 | 0},80,${d.life})`; g.beginPath(); g.arc(d.x * W, d.y * H, d.r * (Math.min(H, 1100) / 600 + .5), 0, 7); g.fill(); } }
    this.deb = this.deb.filter(d => d.life > 0); g.globalCompositeOperation = 'source-over';
    this.shake = Math.max(0, this.shake - dt * 1.8); const sk = this.shake * this.shake; this.stage.style.transform = sk > .002 ? `translate(${(Math.random() - .5) * sk * 26}px,${(Math.random() - .5) * sk * 20}px)` : ''; if (this.onShake) this.onShake(sk); }
}
