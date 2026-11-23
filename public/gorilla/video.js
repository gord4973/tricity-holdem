// GORILLA - photoreal video gorilla "director". Every clip starts and ends on the same straight-on base pose (front-base),
// so clips can be chained and crossfaded freely. Idle: weighted random idle clips (never the same twice in a row) with
// occasional holds on the still. Reactions (watch / anticipate / lose / smallwin / chestbeat / roar / slam) cut in over idle
// by priority. Video tracks are muted; sound plays from processed mp3s via WebAudio, kept in sync with the clip clock.
// Edit CLIPS to swap or drop files: a missing/broken clip is skipped (its cues still run on a clock).
const A = window.GorillaAudio;
export const CLIPS = {
  'idle-a': { idle: 3 }, 'idle-b': { idle: 3 }, 'idle-c': { idle: 2 },
  watch: { pri: 1, dur: 4.04 },
  anticipate: { pri: 2, dur: 5.04, snd: 'anticipate' },
  lose: { pri: 1, dur: 4.04, snd: 'lose' },
  smallwin: { pri: 2, dur: 4.04, snd: 'smallwin', impacts: [[2.26, .35]] },
  chestbeat: { pri: 3, dur: 6.04, snd: 'chestbeat', beats: [1.5, 1.96, 2.48, 2.98, 3.36] },
  roar: { pri: 4, dur: 5.04, snd: 'roar', shakeAt: [[1.25, .3], [1.9, .15]], flashAt: [1.35] },
  slam: { pri: 4, dur: 4.04, snd: 'slam', impacts: [[1.28, .95]], shakeAt: [[1.56, .3]] },
};
const MEDIA_V = '4', BASE = '/gorilla/media/v3/';
const SOUNDS = ['anticipate', 'lose', 'smallwin', 'chestbeat', 'roar', 'slam', 'roar-real', 'br1', 'br2', 'br3', 'br4', 'br5', 'br6', 'huff1', 'huff2', 'huff3', 'grunt1', 'grunt2'];
export const LEDGE = 0.80;   // fraction of clip height where the reel frame's top edge sits (just under the fingertips)
export const CROP_MAX = 0.12; // how much of the clip top may be cropped (head starts at ~0.16)
export const ASPECT = 720 / 1280;
let beacons = 0;
export function glog(kind, detail = {}) { try { if (beacons++ > 25) return; const c = navigator.connection || {};
  const body = JSON.stringify({ kind, ...detail, ua: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches, saveData: !!c.saveData, net: c.effectiveType || '', sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), t: Math.round(performance.now()) });
  if (!(navigator.sendBeacon && navigator.sendBeacon('/gorilla/log', new Blob([body], { type: 'application/json' })))) fetch('/gorilla/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {}); } catch (e) {} }
const verr = v => v && v.error ? { code: v.error.code, msg: v.error.message || '' } : {};
const rnd = (a, b) => a + Math.random() * (b - a);

export class VideoApe {
  constructor(root, opts = {}) {
    this.kind = 'video'; this.root = root; this.on = {}; this.fps = 60; this.bad = new Set(); this.blobs = {};
    const conn = navigator.connection || {};
    this.q = opts.quality || ((conn.saveData || /2g|3g/.test(conn.effectiveType || '')) ? 'low' : 'high');
    this.res = this.q === 'low' ? 'sd' : 'hd';
    const poster = BASE + (this.res === 'sd' ? 'poster-sd.jpg' : 'poster.jpg') + '?v=' + MEDIA_V;
    root.innerHTML = `<div class=sceneBg style="background-image:url(${poster})"></div><div class=stage style="background-image:url(${poster})"><video class="v v0" muted playsinline preload=auto></video><video class="v v1" muted playsinline preload=auto></video><video class="v v2" muted playsinline preload=auto></video><div class=vFlash></div></div><canvas class=embers></canvas>`;
    this.stage = root.querySelector('.stage'); this.vids = [...root.querySelectorAll('video.v')]; this.flash = root.querySelector('.vFlash'); this.cv = root.querySelector('.embers');
    this.vIdle = this.vids[0]; // compat: "the element currently on screen"
    this.top = 0; this.cur = null; this.action = null; this.pending = null; this.lastIdle = ''; this.z = 1; this.shake = 0;
    this.idleNames = Object.keys(CLIPS).filter(n => CLIPS[n].idle);
    this.ready = new Promise(ok => { this._ok = ok; setTimeout(ok, 8000); });
    this._startIdle(true);
    // warm every clip (sequential blob fetch keeps switching instant; falls back to the URL if it fails)
    this._prefetch();
    A.fetchSamples(Object.fromEntries(SOUNDS.map(k => [k === 'roar-real' ? 'roarReal' : k, BASE + k + '.mp3?v=' + MEDIA_V])));
    window.__gorillaAmbient = true;
    const kick = () => this.kick('gesture');
    for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) addEventListener(ev, kick, { capture: true, passive: true });
    for (const ev of ['pageshow', 'focus']) addEventListener(ev, () => this.kick(ev));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick('visible'); });
    document.addEventListener('resume', () => this.kick('resume'));
    setTimeout(() => { const v = this.vIdle; if (v.paused || v.readyState < 2) glog('idle-status', { q: this.q, paused: v.paused, rs: v.readyState, ns: v.networkState, ct: +v.currentTime.toFixed(2), blocked: this.blocked || '', ...verr(v) }); }, 9000);
    this.particles(); this.resize({ top: innerHeight * .5, width: innerWidth });
    let last = performance.now(), frames = 0, acc = 0; const loop = now => { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; frames++; acc += dt; if (acc > 1) { this.fps = frames / acc; frames = 0; acc = 0; } this.tick(dt); }; requestAnimationFrame(loop);
  }
  src(n) { return this.blobs[n] || `${BASE}${n}-${this.res}.mp4?v=${MEDIA_V}`; }
  async _prefetch() { await this.ready; const order = ['watch', 'lose', 'smallwin', 'slam', 'chestbeat', 'roar', 'anticipate', ...this.idleNames];
    for (const n of order) { if (!CLIPS[n] || this.blobs[n]) continue; try { const r = await fetch(`${BASE}${n}-${this.res}.mp4?v=${MEDIA_V}`); if (!r.ok) { this.bad.add(n); glog('clip-missing', { clip: n, status: r.status }); continue; } this.blobs[n] = URL.createObjectURL(await r.blob()); } catch (e) { /* stream from URL instead */ } } }
  // ---------- layout: the clip's ledge lines up with the top edge of the reel frame ----------
  resize(g = {}) { if (g.top != null) this.top = g.top; const W = g.width || this.root.clientWidth || innerWidth, top = this.top;
    let h = top / (LEDGE - CROP_MAX); const hFill = W / ASPECT; if (h > hFill) h = Math.max(top / LEDGE, hFill); // never wider than needed
    const w = h * ASPECT, y = top - LEDGE * h;
    this.stage.style.cssText = `height:${h}px;width:${w}px;left:${(W - w) / 2}px;top:${y}px;background-image:${this.stage.style.backgroundImage}`;
    this.root.style.height = top + 'px'; this.geom = { w, h, y, W };
    const d = Math.min(devicePixelRatio || 1, 1.5); this.cv.width = Math.round(W * d); this.cv.height = Math.round(top * d); this.cv.style.height = top + 'px'; }
  worldXForScreen(fx) { return fx; }
  busy() { return !!this.action; }
  lookAt() {} nod() {} setQuality(q) { localStorage.setItem('gorillaVQ', q); location.reload(); }
  kick(why) { const v = this.cur && this.cur.el; if (!v || !v.paused || v.ended || this.holding) return; const p = v.play(); if (p) p.then(() => { this.blocked = ''; }).catch(e => { if (this.blocked !== e.name) glog('idle-play-blocked', { why, name: e.name, msg: e.message, q: this.q }); this.blocked = e.name; }); }
  // ---------- low level: put clip `name` on screen in a fresh element ----------
  _show(name, { fade = .18, onPlaying, onEnd, onFail } = {}) {
    const el = this.vids.filter(v => !this.cur || v !== this.cur.el).sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0))[0];
    if (this.loading && !this.loading.started && this.loading !== this.cur) { this.loading.dead = true; clearTimeout(this.loading.timer); }
    const job = { name, el, started: false, dead: false }; this.loading = job;
    const fail = why => { if (job.dead || job.failed) return; job.failed = true; glog('clip-skip', { clip: name, why, q: this.q, ...verr(el) }); if (!this.bad.has(name) && why !== 'play') this.bad.add(name); onFail && onFail(job); };
    el.onplaying = () => { if (job.dead) { try { el.pause(); } catch (e) {} return; } if (job.started) return; job.started = true; this._ok();
      el.style.zIndex = ++this.z; el.style.transition = `opacity ${fade}s linear`; el.style.opacity = 1; const prev = this.cur; this.cur = job;
      if (prev && prev.el !== el) setTimeout(() => { if (this.cur === job) { prev.dead = true; try { prev.el.pause(); } catch (e) {} prev.el.style.opacity = 0; } }, fade * 1000 + 60);
      onPlaying && onPlaying(job); };
    el.onended = () => { if (!job.dead && this.cur === job) onEnd && onEnd(job); };
    el.onerror = () => fail('error');
    el.style.transition = 'none'; el.style.opacity = 0; el.src = this.src(name); try { el.currentTime = 0; } catch (e) {}
    const p = el.play(); if (p) p.catch(e => { if (e.name === 'NotAllowedError') { this.blocked = e.name; glog('idle-play-blocked', { why: 'show', name: e.name, q: this.q }); this._waitGesture(job); } else if (e.name !== 'AbortError') fail('play'); });
    job.timer = setTimeout(() => { if (!job.started && !job.dead && !this.blocked) fail('timeout'); }, 4000);
    return job; }
  _waitGesture(job) { const go = () => { if (!job.dead && !job.started) job.el.play().catch(() => {}); }; addEventListener('pointerdown', go, { once: true, capture: true }); addEventListener('touchstart', go, { once: true, capture: true }); }
  // ---------- idle director ----------
  _pickIdle() { const opts = this.idleNames.filter(n => !this.bad.has(n) && (n !== this.lastIdle || this.idleNames.length < 2)); if (!opts.length) return null;
    let r = Math.random() * opts.reduce((a, n) => a + CLIPS[n].idle, 0); for (const n of opts) if ((r -= CLIPS[n].idle) <= 0) return n; return opts[0]; }
  _startIdle(first) { if (this.action) return; clearTimeout(this.holdT); this.holding = false;
    if (!first && Math.random() < .2) { this.holding = true; this.root.dataset.clip = 'still'; this.holdT = setTimeout(() => { this.holding = false; this._startIdle(); }, rnd(1500, 4500)); return; }
    const n = this._pickIdle(); if (!n) { this.root.dataset.clip = 'still'; this._ok(); return; } this.lastIdle = n;
    this.idleJob = this._show(n, { fade: first ? .25 : .12, onPlaying: () => { if (!this.action) this.root.dataset.clip = 'idle'; }, onEnd: () => { if (!this.action) this._startIdle(); }, onFail: () => { if (!this.action) setTimeout(() => this._startIdle(), 600); } }); }
  // ---------- reactions ----------
  play(name, onCue) { const c = CLIPS[name]; if (!c) return Promise.resolve();
    const a = this.action;
    if (a && (CLIPS[a.name].pri || 0) > (c.pri || 0)) { // something more important is playing: keep only the best pending reaction
      if (c.pri <= 1) return Promise.resolve();
      if (this.pending && (CLIPS[this.pending.name].pri || 0) > c.pri) return Promise.resolve();
      if (this.pending) this.pending.resolve();
      return new Promise(resolve => { this.pending = { name, onCue, resolve }; }); }
    return new Promise(resolve => this._act(name, onCue, resolve)); }
  _act(name, onCue, resolve) {
    const c = CLIPS[name], rate = window.__gorillaSpeed && window.__gorillaSpeed < 1 ? Math.min(3, 1 / window.__gorillaSpeed) : 1;
    if (this.action) this.action.finish(true); clearTimeout(this.holdT); this.holding = false;
    let virtual = false, t0 = 0, fired = new Set(), snd = null, done = false, started = false, raf = 0;
    const act = { name, finish: null }; this.action = act; this.root.dataset.clip = name;
    const sound = off => { if (!c.snd) return; snd = A.sample(c.snd, { offset: off }); if (snd && rate !== 1) { snd.stop(); snd = null; } if (snd) A.duck && A.duck((snd.dur || c.dur) - off + .4); };
    const finish = (preempted) => { if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(act.safety); if (snd) snd.stop(preempted ? .25 : 0);
      if (this.action === act) this.action = null; resolve();
      if (!preempted) { const p = this.pending; this.pending = null; if (p) this._act(p.name, p.onCue, p.resolve); else { this.root.dataset.clip = 'idle'; this._startIdle(); } } };
    act.finish = finish;
    const now = () => virtual ? (performance.now() - t0) / 1000 * rate : job.el.currentTime;
    const goVirtual = () => { if (done || virtual) return; const at = started ? job.el.currentTime : 0; virtual = true; t0 = performance.now() - at / rate * 1000; if (!started) { started = true; sound(0); } };
    const cue = (key, t, fn) => { if (!fired.has(key) && now() >= t) { fired.add(key); fn(); } };
    const step = () => { raf = requestAnimationFrame(step); if (!started || done) return;
      (c.impacts || []).forEach(([t, s], i) => cue('i' + i, t, () => { this.shake = Math.max(this.shake, s); this.burst(s); this.emit('slam', i); onCue && onCue('impact', i); }));
      (c.beats || []).forEach((t, i) => cue('b' + i, t, () => { this.shake = Math.max(this.shake, .28); this.emit('beat', i); }));
      (c.shakeAt || []).forEach(([t, s], i) => cue('s' + i, t, () => { this.shake = Math.max(this.shake, s); }));
      (c.flashAt || []).forEach((t, i) => cue('f' + i, t, () => this.lightning()));
      if (virtual && now() >= c.dur) { finish(); } };
    if (this.bad.has(name)) { started = true; virtual = true; t0 = performance.now(); sound(0); raf = requestAnimationFrame(step); act.safety = setTimeout(() => finish(), 12000); return; }
    const job = this._show(name, { fade: .22, onPlaying: j => { started = true; j.el.playbackRate = rate; sound(j.el.currentTime); }, onEnd: () => finish(), onFail: () => goVirtual() });
    raf = requestAnimationFrame(step); act.safety = setTimeout(() => finish(), 12000); }
  watch() { return this.play('watch'); }
  anticipate() { return this.play('anticipate'); }
  lose() { return this.play('lose'); }
  smallWin() { return this.play('smallwin'); }
  chestBeat() { return this.play('chestbeat'); }
  roar() { return this.play('roar'); }
  slam() { let hit; const p = new Promise(r => hit = r); this.play('slam', (k, i) => { if (k === 'impact' && i === 0) hit(); }).then(() => hit()); return p; }
  reactBill() { A.sample(Math.random() < .5 ? 'grunt1' : 'grunt2', { gain: .8, rate: .9 + Math.random() * .15 }); this.stage.classList.remove('lean'); void this.stage.offsetWidth; this.stage.classList.add('lean'); }
  lightning() { this.flash.classList.remove('go'); void this.flash.offsetWidth; this.flash.classList.add('go'); this.emit('thunder'); }
  roarSound() { A.sample('roarReal'); }
  emit(ev, a) { if (this.on && this.on[ev]) this.on[ev](a); }
  // ---------- embers + debris + camera shake ----------
  particles() { this.emb = Array.from({ length: 70 }, () => this.newEmber(true)); this.deb = []; }
  newEmber(any) { return { x: Math.random(), y: any ? Math.random() : 1.05, vy: .03 + Math.random() * .08, vx: (Math.random() - .5) * .02, r: .6 + Math.random() * 1.8, a: .3 + Math.random() * .6, ph: Math.random() * 6 }; }
  burst(s = 1) { for (let i = 0; i < 70 * s; i++) this.deb.push({ x: .5 + (Math.random() - .5) * .55, y: .97, vx: (Math.random() - .5) * .9, vy: -.35 - Math.random() * .8 * s, life: 1, r: .5 + Math.random() * 1.5 }); }
  tick(dt) { const c = this.cv, g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; const t = performance.now() / 1000, sz = Math.min(H, 1100) / 700 + .4;
    for (const e of this.emb) { e.y -= e.vy * dt; e.x += (e.vx + Math.sin(t + e.ph) * .01) * dt; if (e.y < -.05) Object.assign(e, this.newEmber(false)); const fl = .6 + .4 * Math.sin(t * 6 + e.ph); g.fillStyle = `rgba(255,${140 + 60 * fl | 0},60,${e.a * fl})`; g.beginPath(); g.arc(e.x * W, e.y * H, e.r * sz, 0, 7); g.fill(); }
    this.deb = this.deb.filter(d => (d.life -= dt * .9) > 0); for (const d of this.deb) { d.vy += 1.6 * dt; d.x += d.vx * dt * .5; d.y += d.vy * dt * .5; g.fillStyle = `rgba(255,${120 + 100 * d.life | 0},40,${d.life})`; g.beginPath(); g.arc(d.x * W, d.y * H, d.r * sz, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    if (this.shake > .002) { const s = this.shake; this.stage.style.transform = `translate(${(Math.random() - .5) * s * 26}px,${(Math.random() - .5) * s * 18}px)`; this.shake *= Math.pow(.02, dt); } else if (this.stage.style.transform) this.stage.style.transform = '';
    this.onShake && this.onShake(this.shake); }
}
