// GORILLA - photoreal video gorilla "director". Every clip starts and ends on the same straight-on base pose (front-base),
// so clips can be chained and crossfaded freely. Idle: weighted random idle clips (never the same twice in a row) with
// occasional holds on the still. Reactions (watch / anticipate / lose / smallwin / chestbeat / roar / slam) cut in over idle
// by priority. Video tracks are muted; sound plays from processed mp3s via WebAudio, kept in sync with the clip clock.
// Edit CLIPS to swap or drop files: a missing/broken clip is skipped (its cues still run on a clock).
const A = window.GorillaAudio;
export const CLIPS = { // minor: chains smoothly (waits for / speeds up the clip on screen); major: may cut in. impacts = [t, strength] at the hit frame
  'idle-a': { idle: 3 }, 'idle-b': { idle: 3 }, 'idle-c': { idle: 2 }, // idle-c v4: calm tail only (the ledge drumming read as hitting)
  watch: { pri: 1, dur: 4.04, minor: 1 },
  anticipate: { pri: 2, dur: 5.04, snd: 'anticipate', minor: 1 },
  stare: { pri: 2, dur: 6.04, snd: 'stare', minor: 1 }, // leans in and looks straight at the player
  lose: { pri: 1, dur: 4.04, snd: 'lose', minor: 1 },
  smallwin: { pri: 2, dur: 2.58, snd: 'smallwin', impacts: [[.78, .35]] }, // v4: trimmed to the single fist strike
  chestbeat: { pri: 3, loud: 1, dur: 6.04, snd: 'chestbeat', major: 1, shakeAt: [[1.35, .5], [2.0, .3]], beats: [[1.5, 1], [1.75, .7], [1.96, 1], [2.25, .7], [2.48, 1], [2.75, .75], [3.0, 1], [3.19, .75], [3.38, 1]], dimAt: [[1.4, 2.2]] },
  roar: { pri: 4, loud: 1, dur: 5.04, snd: 'roar', major: 1, shakeAt: [[1.2, .75], [1.55, .45], [2.05, .55], [2.6, .35]], flashAt: [1.3], dimAt: [[1.15, 2.1]], burstAt: [[1.25, 1.3], [2.05, .8]] },
  punch: { pri: 4, dur: 4.04, snd: 'punch', impacts: [[1.70, 1]], shakeAt: [[1.86, .3]] }, // ONE right-fist smash, fist meets the ledge at 1.70 s
  slam: { pri: 4, file: 'punch', dur: 4.04, snd: 'punch', impacts: [[1.70, 1]], shakeAt: [[1.86, .3]] }, // fallback lock smash (single punch)
  // ---- v5 bonus clips (media/v4, lazy-loaded after the first spin). impacts/marks are the frames measured in the clips ----
  'punch-left': { pri: 4, v4: 1, dur: 4.04, snd: 'punch-left', impacts: [[1.67, 1]], shakeAt: [[1.8, .3]] },   // fist lands on the left reel
  'punch-right': { pri: 4, v4: 1, dur: 4.04, snd: 'punch-right', impacts: [[1.61, 1]], shakeAt: [[1.75, .3]] }, // fist lands on the right reel
  smash: { pri: 4, v4: 1, file: 'overhead-smash', dur: 5.04, snd: 'overhead-smash', impacts: [[2.46, 1.2]], shakeAt: [[2.62, .5]], burstAt: [[2.5, 1]] }, // both fists, once
  thunder: { pri: 4, v4: 1, loud: 1, file: 'thunder-roar-short', dur: 3.04, snd: 'thunder-roar-short', major: 1, marks: [[1.0, 'peak']], flashAt: [.9], shakeAt: [[.95, .5], [1.3, .3]], dimAt: [[.8, .9]] },
  awaken: { pri: 5, v4: 1, loud: 1, file: 'awaken-roar', dur: 6.04, snd: 'awaken-roar', major: 1, marks: [[1.75, 'peak']], flashAt: [1.65], shakeAt: [[1.1, .45], [1.75, .85], [2.3, .5], [3.0, .35]], dimAt: [[1.0, 2.8]], burstAt: [[1.75, 1.3]] },
  swipe: { pri: 4, v4: 1, file: 'wheel-swipe', dur: 4.04, snd: 'wheel-swipe', marks: [[1.9, 'swipe']] },
  lunge: { pri: 5, v4: 1, file: 'lunge-in', dur: 3.0, snd: 'lunge-in', major: 1, marks: [[1.45, 'close']], shakeAt: [[1.5, .4]], dimAt: [[1.2, 1.0]] },
  heave: { pri: 4, v4: 1, file: 'ledge-heave', dur: 5.04, snd: 'ledge-heave', marks: [[1.5, 'lift']], shakeAt: [[1.6, .35], [3.0, .3]] },
  fist: { pri: 3, v4: 1, file: 'fist-throw', dur: 3.04, snd: 'fist-throw', marks: [[1.5, 'throw']] },
  pound: { pri: 3, v4: 1, loud: 1, file: 'victory-pound', dur: 5.04, snd: 'victory-pound', major: 1, impacts: [[1.83, .9], [2.79, 1]] },
  breath: { pri: 1, v4: 1, file: 'breath-heavy', dur: 4.04, snd: 'breath-heavy', minor: 1 },
  dismiss: { pri: 2, v4: 1, dur: 3.04, snd: 'dismiss', minor: 1 },
  look: { pri: 1, v4: 1, file: 'look-reels', dur: 3.04, snd: 'look-reels', minor: 1 },
  'watch-left': { pri: 1, v5: 1, dur: 6.04, minor: 1 },
  'watch-right': { pri: 1, v5: 1, dur: 6.04, minor: 1 },
  rampage: { pri: 5, v5: 1, dur: 8.04, snd: 'roar', loud: 1, major: 1, shakeAt: [[1.6, .6], [2.4, .9], [3.2, .7], [4.0, .45]], flashAt: [2.2, 3.1], dimAt: [[1.8, 3.2]], burstAt: [[2.3, 1.3], [3.2, .9]] },
};
const V4 = '/gorilla/media/v4/', V4_V = '1';
const V5 = '/gorilla/media/v5/', V5_V = '6';
const V4_SOUNDS = ['punch-left', 'punch-right', 'overhead-smash', 'thunder-roar-short', 'awaken-roar', 'wheel-swipe', 'lunge-in', 'ledge-heave', 'fist-throw', 'victory-pound', 'breath-heavy', 'dismiss', 'look-reels'];
const SND_V = { chestbeat: '7' }; // per-sound cache bump (v5 chestbeat carried a stray video stream)
const MEDIA_V = '5', BASE = '/gorilla/media/v3/';
const SOUNDS = ['anticipate', 'lose', 'smallwin', 'chestbeat', 'roar', 'punch', 'stare', 'roar-real', 'br1', 'br2', 'br3', 'br4', 'br5', 'br6', 'huff1', 'huff2', 'huff3', 'grunt1', 'grunt2'];
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
    this._startIdle(true); this._stareTimer();
    // warm every clip (sequential blob fetch keeps switching instant; falls back to the URL if it fails)
    this._prefetch();
    // v6 gaze clips: warm left/right looks after the first idle so the first spin can pick any side
    A.fetchSamples(Object.fromEntries(SOUNDS.map(k => [k === 'roar-real' ? 'roarReal' : k, BASE + k + '.mp3?v=' + (SND_V[k] || MEDIA_V)])));
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
  file(n) { return (CLIPS[n] && CLIPS[n].file) || n; }
  url(n) { const c = CLIPS[n] || {}, f = this.file(n); return c.v5 ? `${V5}${f}-${this.res}.mp4?v=${V5_V}` : c.v4 ? `${V4}${f}-${this.res}.mp4?v=${V4_V}` : `${BASE}${f}-${this.res}.mp4?v=${MEDIA_V}`; }
  src(n) { const f = this.file(n); return this.blobs[f] || this.url(n); }
  // v5: bonus clips + sounds load lazily (after the first spin, or when a bonus starts) so the first page load is not heavier
  loadBonus() { if (this.bonusLoading) return this.bonusLoading; A.fetchSamples(Object.fromEntries(V4_SOUNDS.map(k => [k, V4 + k + '.mp3?v=' + V4_V]))); setTimeout(() => V4_SOUNDS.forEach(k => A.decode(k)), 50);
    const order = ['thunder', 'smash', 'punch-left', 'punch-right', 'swipe', 'awaken', 'lunge', 'heave', 'fist', 'look', 'dismiss', 'breath', 'pound'];
    return (this.bonusLoading = (async () => { for (const n of order) { const f = this.file(n); if (this.blobs[f]) continue; try { const r = await fetch(this.url(n)); if (!r.ok) { this.bad.add(f); glog('clip-missing', { clip: n, status: r.status }); continue; } this.blobs[f] = URL.createObjectURL(await r.blob()); } catch (e) { /* stream from URL */ } } })()); }
  async _prefetch() { await this.ready; const order = ['watch', 'lose', 'smallwin', 'punch', 'anticipate', 'chestbeat', 'roar', 'stare', ...this.idleNames];
    for (const n of order) { if (!CLIPS[n] || CLIPS[n].file || this.blobs[n]) continue; try { const r = await fetch(`${BASE}${n}-${this.res}.mp4?v=${MEDIA_V}`); if (!r.ok) { this.bad.add(n); glog('clip-missing', { clip: n, status: r.status }); continue; } this.blobs[n] = URL.createObjectURL(await r.blob()); } catch (e) { /* stream from URL instead */ } }
    for (const n of ['watch-left', 'watch-right', 'rampage']) { const f = this.file(n); if (this.blobs[f] || this.bad.has(f)) continue; try { const r = await fetch(this.url(n)); if (!r.ok) { this.bad.add(f); glog('clip-missing', { clip: n, status: r.status }); continue; } this.blobs[f] = URL.createObjectURL(await r.blob()); } catch (e) { /* stream from URL */ } } }
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
    const fail = why => { if (job.dead || job.failed) return; job.failed = true; glog('clip-skip', { clip: name, why, q: this.q, ...verr(el) }); if (why !== 'play') this.bad.add(this.file(name)); onFail && onFail(job); };
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
    this.idleJob = this._show(n, { fade: first ? .25 : .3, onPlaying: j => { j.el.playbackRate = rnd(.88, 1.08); if (!this.action) this.root.dataset.clip = 'idle'; }, onEnd: () => { if (!this.action) this._startIdle(); }, onFail: () => { if (!this.action) setTimeout(() => this._startIdle(), 600); } }); }
  // ---------- reactions ----------
  // play(name, onCue, {rate, now}) - the director decides HOW it joins what is on screen:
  //  * same minor clip already playing -> keep going (no restart)
  //  * a minor clip (watch/anticipate/stare/lose) is on screen and the new one is not urgent -> queue it and speed the current clip
  //    to its natural end (it ends on the base pose), so the chain is seamless: watch -> anticipate -> lose
  //  * idle clip almost finished -> wait for it; otherwise long dissolve (minor) / short cut (major)
  play(name, onCue, o = {}) { const c = CLIPS[name]; if (!c) return Promise.resolve();
    const a = this.action, ac = a && CLIPS[a.name];
    if (a && a.name === name && c.minor && !a.ending) return Promise.resolve();
    if (a && (ac.pri || 0) > (c.pri || 0)) { // something more important is playing: keep only the best pending reaction
      if (c.pri <= 1) return Promise.resolve();
      if (this.pending && (CLIPS[this.pending.name].pri || 0) > c.pri) return Promise.resolve();
      if (this.pending) this.pending.resolve();
      return new Promise(resolve => { this.pending = { name, onCue, resolve, o }; }); }
    if (a && ac.minor && !o.now && (c.pri || 0) < 4) { // chain after the minor clip on screen
      if (this.pending) this.pending.resolve();
      return new Promise(resolve => { this.pending = { name, onCue, resolve, o }; this.hurry(1.0); }); }
    return new Promise(resolve => this._act(name, onCue, resolve, o)); }
  // finish the minor clip on screen in about `sec` seconds by raising its playback rate (never a hard cut)
  hurry(sec = 1) { const a = this.action; if (!a || !a.el || a.virtual) return; const el = a.el, left = (CLIPS[a.name].dur - el.currentTime) / (el.playbackRate || 1);
    a.ending = true; if (left > sec) el.playbackRate = Math.min(2.4, (CLIPS[a.name].dur - el.currentTime) / sec); }
  // a full-screen win overlay is about to cover him: drop any big move (it would only show faded behind the overlay)
  calm() { if (this.pending) { this.pending.resolve(); this.pending = null; } const a = this.action; if (a && CLIPS[a.name].major) { a.finish(true); this.root.dataset.clip = 'idle'; this._startIdle(); } }
  settle() { const a = this.action; if (a && CLIPS[a.name].minor) this.hurry(1.2); }
  _act(name, onCue, resolve, o = {}) {
    const c = CLIPS[name], speed = window.__gorillaSpeed && window.__gorillaSpeed < 1 ? Math.min(3, 1 / window.__gorillaSpeed) : 1, rate = speed * (o.rate || 1);
    const prevA = this.action; if (prevA) prevA.finish(true); clearTimeout(this.holdT); this.holding = false;
    let virtual = false, t0 = 0, fired = new Set(), snd = null, done = false, started = false, raf = 0;
    const act = { name, finish: null, t0: performance.now() }; this.action = act; this.root.dataset.clip = name;
    const sound = off => { if (!c.snd) return; snd = A.sample(c.snd, { offset: off, loud: !!c.loud }); if (snd && speed !== 1) { snd.stop(); snd = null; } if (snd) { if (rate !== 1 && snd.src && snd.src.playbackRate) snd.src.playbackRate.value = rate; A.duck && A.duck(((snd.dur || c.dur) - off) / rate + .4); } };
    const finish = (preempted) => { if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(act.safety); if (snd) snd.stop(preempted ? .25 : 0); this.dim(0);
      if (this.action === act) this.action = null; resolve();
      if (!preempted) { const p = this.pending; this.pending = null; if (p) this._act(p.name, p.onCue, p.resolve, p.o); else { this.root.dataset.clip = 'idle'; this._startIdle(); } } };
    act.finish = finish;
    const now = () => virtual ? (performance.now() - t0) / 1000 * rate : job.el.currentTime;
    const goVirtual = () => { if (done || virtual) return; const at = started ? job.el.currentTime : 0; virtual = true; act.virtual = true; t0 = performance.now() - at / rate * 1000; if (!started) { started = true; sound(0); } };
    const cue = (key, t, fn) => { if (!fired.has(key) && now() >= t) { fired.add(key); fn(); } };
    const step = () => { raf = requestAnimationFrame(step); if (!started || done) return;
      (c.impacts || []).forEach(([t, s], i) => cue('i' + i, t - .008 * rate, () => { this.lastImpact = { clip: name, cue: t, ct: +now().toFixed(3), at: performance.now() }; this.shake = Math.max(this.shake, s); this.burst(s); this.emit('slam', i); onCue && onCue('impact', i); }));
      (c.beats || []).forEach(([t, s], i) => cue('b' + i, t, () => { this.shake = Math.max(this.shake, .55 * s); this.jolt(s); if (s >= 1) this.burst(.35); this.emit('beat', i); }));
      (c.shakeAt || []).forEach(([t, s], i) => cue('s' + i, t, () => { this.shake = Math.max(this.shake, s); this.jolt(s); }));
      (c.burstAt || []).forEach(([t, s], i) => cue('u' + i, t, () => this.burst(s)));
      (c.dimAt || []).forEach(([t, d], i) => { cue('d' + i, t, () => this.dim(1)); cue('e' + i, t + d, () => this.dim(0)); });
      (c.flashAt || []).forEach((t, i) => cue('f' + i, t, () => this.lightning()));
      (c.marks || []).forEach(([t, k], i) => cue('m' + i, t - .008 * rate, () => { this.lastMark = { clip: name, key: k, cue: t, ct: +now().toFixed(3), at: performance.now() }; onCue && onCue(k); }));
      if (virtual && now() >= c.dur) { finish(); } };
    if (this.bad.has(this.file(name))) { started = true; virtual = true; act.virtual = true; t0 = performance.now(); sound(0); raf = requestAnimationFrame(step); act.safety = setTimeout(() => finish(), 14000); return; }
    // minor clips dissolve in slowly from whatever is on screen; major/hit clips cut in faster (hard breaks only for big moments)
    const fade = c.minor ? (prevA ? .35 : .5) : c.major ? .3 : .22;
    const job = this._show(name, { fade, onPlaying: j => { started = true; act.el = j.el; j.el.playbackRate = rate; sound(j.el.currentTime); }, onEnd: () => finish(), onFail: () => goVirtual() });
    raf = requestAnimationFrame(step); act.safety = setTimeout(() => finish(), 14000); }
  // watch the spin: start now, and stretch/squeeze the clip so his eyes follow the reels for the whole spin (spinSec)
  watch(spinSec, side) { // side: 0 left reel, 1 middle, 2 right; omit to pick at random
    const n = side === 0 ? 'watch-left' : side === 2 ? 'watch-right' : 'watch';
    const name = (side === 0 || side === 2) && this.bad.has(this.file(n)) ? 'watch' : n;
    const r = spinSec ? Math.max(.8, Math.min(1.5, (CLIPS[name].dur || 4) / (spinSec + 1.1))) : 1;
    return this.play(name, null, { now: true, rate: r }); }
  anticipate() { return this.play('anticipate', null, { now: true }); }
  stare() { return this.play('stare'); }
  lose() { return this.play('lose'); }
  smallWin() { return this.play('smallwin', null, { now: true }); }
  chestBeat() { return this.play('chestbeat', null, { now: true }); }
  roar() { return this.play('roar', null, { now: true }); }
  // hit clips: the returned promise resolves ON the impact frame; onImpact runs synchronously in that frame (for the reel effect)
  _hit(name, onImpact) { let hit, fired = false; const p = new Promise(r => hit = r); const go = () => { if (fired) return; fired = true; try { onImpact && onImpact(); } catch (e) { console.warn(e); } hit(); };
    this.play(name, (k, i) => { if (k === 'impact' && i === 0) go(); }, { now: true }).then(go); return p; }
  slam(x, onImpact) { return this._hit(this.bad.has('overhead-smash') ? 'slam' : 'smash', onImpact); } // lock smash: one overhead double-fist strike
  punch(onImpact, r = 1) { const n = r === 0 ? 'punch-left' : r === 2 ? 'punch-right' : 'punch'; return this._hit(this.bad.has(this.file(n)) ? 'punch' : n, onImpact); } // per-reel punch-nudge
  // marked clips: fn runs synchronously on the marked frame; resolves on that frame (the clip keeps playing). .done resolves at the clip end
  _mark(name, key, fn) { let hit, fired = false; const p = new Promise(r => hit = r); const go = () => { if (fired) return; fired = true; try { fn && fn(); } catch (e) { console.warn(e); } hit(); };
    p.done = this.play(name, k => { if (k === key) go(); }, { now: true }).then(() => go()); return p; }
  thunder(fn) { return this._mark('thunder', 'peak', fn); }
  awaken(fn) { return this._mark('awaken', 'peak', fn); }
  swipe(fn) { return this._mark('swipe', 'swipe', fn); }
  lunge(fn) { return this._mark('lunge', 'close', fn); }
  heave(fn) { return this._mark('heave', 'lift', fn); }
  fistThrow(fn) { return this._mark('fist', 'throw', fn); }
  pound() { return this.play('pound', null, { now: true }); }
  breath() { return this.play('breath'); }
  dismiss() { return this.play('dismiss', null, { now: true }); }
  look(spinSec) { const r = spinSec ? Math.max(.8, Math.min(1.5, CLIPS.look.dur / (spinSec + .8))) : 1; return this.play('look', null, { now: true, rate: r }); }
  // random "lean in and stare at you" while the machine sits idle (every 45-90 s)
  _stareTimer() { clearTimeout(this.stareT); this.stareT = setTimeout(() => { const idle = !this.action && !(this.gameBusy && this.gameBusy()) && !document.hidden;
      if (idle) this.stare(); this._stareTimer(); }, rnd(45000, 90000) * (window.__gorillaSpeed || 1)); }
  dim(on) { this.root.classList.toggle('dim', !!on); }
  jolt(s = 1) { this.stage.style.setProperty('--jz', (1 + .035 * s).toFixed(3)); this.stage.classList.remove('jolt'); void this.stage.offsetWidth; this.stage.classList.add('jolt'); }
  reactBill() { A.sample(Math.random() < .5 ? 'grunt1' : 'grunt2', { gain: .8, rate: .9 + Math.random() * .15 }); this.stage.classList.remove('lean'); void this.stage.offsetWidth; this.stage.classList.add('lean'); }
  lightning() { this.flash.classList.remove('go'); void this.flash.offsetWidth; this.flash.classList.add('go'); this.emit('thunder'); }
  roarSound() { A.sample('roarReal', { loud: true }); }
  emit(ev, a) { if (this.on && this.on[ev]) this.on[ev](a); }
  // ---------- embers + debris + camera shake ----------
  particles() { this.emb = Array.from({ length: 70 }, () => this.newEmber(true)); this.deb = []; }
  newEmber(any) { return { x: Math.random(), y: any ? Math.random() : 1.05, vy: .03 + Math.random() * .08, vx: (Math.random() - .5) * .02, r: .6 + Math.random() * 1.8, a: .3 + Math.random() * .6, ph: Math.random() * 6 }; }
  burst(s = 1) { for (let i = 0; i < 70 * s; i++) this.deb.push({ x: .5 + (Math.random() - .5) * .55, y: .97, vx: (Math.random() - .5) * .9, vy: -.35 - Math.random() * .8 * s, life: 1, r: .5 + Math.random() * 1.5 }); }
  tick(dt) { const c = this.cv, g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; const t = performance.now() / 1000, sz = Math.min(H, 1100) / 700 + .4;
    for (const e of this.emb) { e.y -= e.vy * dt; e.x += (e.vx + Math.sin(t + e.ph) * .01) * dt; if (e.y < -.05) Object.assign(e, this.newEmber(false)); const fl = .6 + .4 * Math.sin(t * 6 + e.ph); g.fillStyle = `rgba(255,${140 + 60 * fl | 0},60,${e.a * fl})`; g.beginPath(); g.arc(e.x * W, e.y * H, e.r * sz, 0, 7); g.fill(); }
    this.deb = this.deb.filter(d => (d.life -= dt * .9) > 0); for (const d of this.deb) { d.vy += 1.6 * dt; d.x += d.vx * dt * .5; d.y += d.vy * dt * .5; g.fillStyle = `rgba(255,${120 + 100 * d.life | 0},40,${d.life})`; g.beginPath(); g.arc(d.x * W, d.y * H, d.r * sz, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    if (this.shake > .002) { const s = this.shake; this.stage.style.transform = `translate(${(Math.random() - .5) * s * 34}px,${(Math.random() - .5) * s * 26}px)`; this.shake *= Math.pow(.02, dt); } else if (this.stage.style.transform) this.stage.style.transform = '';
    this.onShake && this.onShake(this.shake); }
}
