// Tricity Hold'em voice chat: audio-only WebRTC mesh. A player whose mic is on opens one send-only
// connection to every other connected player; listeners answer receive-only. Signaling via socket.io.
const Voice = (() => {
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
  const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
  let s, myId = () => null, micOn = false, stream = null, out = {}, inc = {}, speakersOn = true, unlocked = false, actx = null, levelTimer = null, speaking = false, onChange = () => {};
  const box = document.createElement('div'); box.style.display = 'none'; document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
  const log = (...a) => { if (window.VOICE_DEBUG) console.log('[voice]', ...a); };

  function init(socket, getMyId, changed) {
    s = socket; myId = getMyId; onChange = changed || onChange;
    s.on('rtc', onSignal);
    s.on('rtc:reset', ({ id }) => { if (micOn) { closeOut(id); call(id); } });
    // a one-time tap anywhere unlocks audio playback (iOS/Android autoplay rules)
    const unlock = () => { unlocked = true; if (actx && actx.state === 'suspended') actx.resume(); box.querySelectorAll('audio').forEach(a => a.play().catch(() => {})); onChange(); };
    ['pointerdown', 'touchend', 'click'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
  }
  // called after every (re)join
  function joined() {
    for (const id in inc) closeInc(id);
    s.emit('rtc:hello');
    if (micOn) { for (const id in out) closeOut(id); s.emit('mic', { on: true }, r => r && r.peers && r.peers.forEach(call)); }
  }
  async function toggle() { return micOn ? stop() : start(); }
  async function start() {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) throw new Error('Voice chat is not supported in this browser');
    // create/resume the AudioContext inside the tap itself (iOS Safari requires a user gesture)
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { }
    unlocked = true; box.querySelectorAll('audio').forEach(a => a.play().catch(() => {}));
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: false });
    micOn = true; watchLevel(); onChange();
    s.emit('mic', { on: true }, r => { if (r && r.peers) r.peers.forEach(call); });
  }
  function stop(silent) {
    micOn = false; for (const id in out) { send(id, 'bye'); closeOut(id); }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    clearInterval(levelTimer); levelTimer = null; speaking = false;
    if (!silent && s && s.connected) s.emit('mic', { on: false }, () => {});
    onChange();
  }
  // keep outgoing connections matched to the connected players in the latest game state
  function sync(players) {
    for (const p of players) if (inc[p.id] && (!p.mic || !p.connected)) closeInc(p.id);   // talker went quiet / left / reloaded
    if (!micOn || !stream) return;
    const live = new Set(players.filter(p => p.connected && p.id !== myId()).map(p => p.id));
    for (const id of live) if (!out[id]) call(id);
    for (const id in out) if (!live.has(id)) closeOut(id);
  }
  function send(to, kind, extra = {}) { s.emit('rtc', { to, kind, ...extra }); }
  async function call(id) {
    if (!micOn || !stream || out[id] || id === myId()) return;
    const pc = new RTCPeerConnection(ICE); out[id] = pc;
    for (const tr of stream.getAudioTracks()) pc.addTransceiver(tr, { direction: 'sendonly', streams: [stream] });
    pc._mine = []; pc._q = [];
    pc.onicecandidate = e => { if (!e.candidate) return; if (pc._mine) pc._mine.push(e.candidate); else send(id, 'ice-t', { cand: e.candidate }); };   // talker -> listener
    pc.onconnectionstatechange = () => { log('out', id, pc.connectionState); if (pc.connectionState === 'failed' && out[id] === pc) { closeOut(id); setTimeout(() => call(id), 2000); } };
    try {
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      pc.getSenders().forEach(sn => { try { const p = sn.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 32000; sn.setParameters(p).catch(() => {}); } catch (e) { } });
      send(id, 'offer', { sdp: pc.localDescription }); const mine = pc._mine; pc._mine = null; mine.forEach(c => send(id, 'ice-t', { cand: c }));
    } catch (e) { log('offer fail', e); closeOut(id); }
  }
  async function onSignal(m) {
    const from = m.from;
    if (m.kind === 'offer') {
      closeInc(from);
      const pc = new RTCPeerConnection(ICE); inc[from] = pc; pc._q = []; pc._mine = [];
      pc.onicecandidate = e => { if (!e.candidate) return; if (pc._mine) pc._mine.push(e.candidate); else send(from, 'ice-l', { cand: e.candidate }); };  // listener -> talker
      pc.ontrack = e => { let a = box.querySelector(`audio[data-id="${from}"]`); if (!a) { a = document.createElement('audio'); a.dataset.id = from; a.autoplay = true; a.setAttribute('playsinline', ''); box.appendChild(a); }
        a.srcObject = e.streams[0] || new MediaStream([e.track]); a.muted = !speakersOn; a.play().then(() => { unlocked = true; onChange(); }).catch(() => { unlocked = false; onChange(); }); };
      pc.onconnectionstatechange = () => log('in', from, pc.connectionState);
      await pc.setRemoteDescription(m.sdp); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
      if (inc[from] !== pc) return;
      send(from, 'answer', { sdp: pc.localDescription }); const mine = pc._mine; pc._mine = null; mine.forEach(c => send(from, 'ice-l', { cand: c }));
      for (const c of pc._q) pc.addIceCandidate(c).catch(() => {}); pc._q = null;
    } else if (m.kind === 'answer') { const pc = out[from]; if (pc && pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(m.sdp).catch(() => {}); }
    else if (m.kind === 'ice-t') { const pc = inc[from]; if (pc) { if (pc._q) pc._q.push(m.cand); else pc.addIceCandidate(m.cand).catch(() => {}); } }
    else if (m.kind === 'ice-l') { const pc = out[from]; if (pc) { if (pc._q) pc._q.push(m.cand); else pc.addIceCandidate(m.cand).catch(() => {}); } }
    else if (m.kind === 'bye') closeInc(from);
  }
  function closeOut(id) { const pc = out[id]; if (pc) { try { pc.close(); } catch (e) { } } delete out[id]; }
  function closeInc(id) { const pc = inc[id]; if (pc) { try { pc.close(); } catch (e) { } } delete inc[id]; const a = box.querySelector(`audio[data-id="${id}"]`); if (a) { a.srcObject = null; a.remove(); } }
  // simple voice-activity detection on my own mic -> "speaking" indicator for everyone
  function watchLevel() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
      const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize); let lastLoud = 0;
      clearInterval(levelTimer);
      levelTimer = setInterval(() => {
        if (!micOn) return; an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += (v - 128) ** 2;
        const rms = Math.sqrt(sum / buf.length), now = Date.now(); if (rms > 6) lastLoud = now;
        const sp = now - lastLoud < 600; if (sp !== speaking) { speaking = sp; s.emit('speaking', { on: sp }); }
      }, 120);
    } catch (e) { log('vad', e); }
  }
  function peerVoice(v) { if (!v.mic) closeInc(v.id); }
  function setSpeakers(on) { speakersOn = on; box.querySelectorAll('audio').forEach(a => { a.muted = !on; if (on) a.play().catch(() => {}); }); onChange(); }
  function reset() { stop(true); for (const id in inc) closeInc(id); }
  return { init, joined, peerVoice, toggle, stop, sync, reset, setSpeakers, get micOn() { return micOn; }, get speakersOn() { return speakersOn; }, get unlocked() { return unlocked; }, get speaking() { return speaking; },
    get stats() { return { out: Object.keys(out).length, inc: Object.keys(inc).length, audios: box.querySelectorAll('audio').length }; }, _pcs: { out, inc } };
})();
