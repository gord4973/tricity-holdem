'use strict';
// Tricity Hold'em - multiplayer play-money Texas Hold'em (host screen + phones). No real money anywhere.
const express = require('express'), http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), QR = require('qrcode');
const { Table, blindsFor } = require('./engine');
const app = express(), srv = http.createServer(app), io = require('socket.io')(srv, { cors: { origin: '*' }, pingInterval: 20000, pingTimeout: 30000 });
const PWF = path.join(__dirname, 'data/host_password.txt');
fs.mkdirSync(path.dirname(PWF), { recursive: true });
if (!process.env.HOST_PIN && !fs.existsSync(PWF)) fs.writeFileSync(PWF, String(crypto.randomInt(100000, 999999)), { mode: 0o600 });
const PW = (process.env.HOST_PIN || fs.readFileSync(PWF, 'utf8')).trim();
const pwOk = pw => typeof pw === 'string' && pw.length === PW.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PW));

app.use(express.json()); app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get(['/', '/play', '/j/:pin'], (q, r) => r.sendFile(path.join(__dirname, 'public/play.html')));
app.get('/host', (q, r) => r.sendFile(path.join(__dirname, 'public/host.html')));
app.get('/healthz', (q, r) => r.json({ ok: 1, rooms: Object.keys(rooms).length }));
app.post('/api/login', (q, r) => r.json({ ok: pwOk(q.body && q.body.pw) }));
app.get('/api/qr', async (q, r) => r.type('svg').send(await QR.toString(String(q.query.u || ''), { type: 'svg', margin: 1 })));

const rooms = {};
const SHOW_MS = +process.env.SHOWDOWN_MS || 9000, FOLD_MS = +process.env.FOLDWIN_MS || 4000, AWAY_MS = +process.env.AWAY_MS || 12000, SITOUT_MS = 1500;
function newPin() { let p; do p = String(crypto.randomInt(1000, 9999)); while (rooms[p]); return p; }
const tok = () => crypto.randomBytes(16).toString('hex');

function createRoom(settings) {
  const pin = newPin();
  const R = { pin, hostSid: null, settings, seats: {}, paused: false, levelEndsAt: 0, levelLeft: settings.levelMin * 60000, timers: {}, created: Date.now(), lastActive: Date.now() };
  R.table = new Table({ onEvent: () => {} });
  rooms[pin] = R; return R;
}
const levelMs = R => R.settings.levelMin * 60000;
function levelRemaining(R) { return R.paused || !R.levelEndsAt ? R.levelLeft : Math.max(0, R.levelEndsAt - Date.now()); }

function publicView(R) {
  const t = R.table, inHand = ['preflop', 'flop', 'turn', 'river'].includes(t.stage);
  const shown = {}; if (t.lastResult && !inHand) for (const s of t.lastResult.shown) shown[s.id] = s;
  const cur = inHand ? t.players[t.toAct] : null;
  return {
    pin: R.pin, stage: t.stage, handNo: t.handNo, paused: R.paused, settings: R.settings, serverNow: Date.now(),
    blinds: t.handNo ? t.blinds : blindsFor(t.level), nextBlinds: blindsFor(t.level), levelUp: t.handNo > 0 && t.level > t.handLevel,
    level: t.level + 1, handLevel: (t.handNo ? t.handLevel : t.level) + 1, turnMs: R.turnMs || 0, upcoming: blindsFor(t.level + 1), levelRemaining: levelRemaining(R),
    board: t.board, pot: t.potTotal ? (inHand || t.stage === 'showdown' ? t.potTotal() : 0) : 0, currentBet: inHand ? t.currentBet : 0,
    dealer: t.players[t.dealerSeat] ? t.players[t.dealerSeat].id : null, sb: inHand && t.players[t.sbSeat] ? t.players[t.sbSeat].id : null, bb: inHand && t.players[t.bbSeat] ? t.players[t.bbSeat].id : null,
    toAct: cur ? cur.id : null, turnDeadline: R.turnDeadline || null,
    players: t.players.map(p => { const s = R.seats[p.id] || {}; return { id: p.id, name: p.name, chips: p.chips, bet: p.bet, folded: p.folded && !p.out, allIn: p.allIn, out: p.out, sittingOut: !!s.sittingOut, connected: !!s.sid, lastAction: p.lastAction, hasCards: inHand && p.hole.length === 2 && !p.folded, shown: shown[p.id] ? { hole: shown[p.id].hole, hand: shown[p.id].hand, best: shown[p.id].best } : null }; }),
    log: t.log.slice(-14), seq: t.seq || 0, result: inHand ? null : t.lastResult, winner: t.stage === 'gameover' ? t.winner : null, nextHandAt: R.nextHandAt || null,
  };
}
function broadcast(R) {
  const pub = publicView(R);
  if (R.hostSid) io.to(R.hostSid).emit('state', pub);
  for (const id in R.seats) {
    const s = R.seats[id]; if (!s.sid) continue;
    const p = R.table.get(id); if (!p) continue;
    io.to(s.sid).emit('state', { ...pub, me: { id, hole: p.hole, legal: R.table.legal(id), sittingOut: !!s.sittingOut } });
  }
}
function clear(R, k) { clearTimeout(R.timers[k]); delete R.timers[k]; }

function armTurn(R) {
  clear(R, 'turn'); R.turnDeadline = null;
  const t = R.table; if (!['preflop', 'flop', 'turn', 'river'].includes(t.stage) || R.paused) return;
  const p = t.players[t.toAct], s = R.seats[p.id] || {};
  let ms = 0;
  if (s.sittingOut) ms = SITOUT_MS; else if (!s.sid) ms = AWAY_MS; else if (R.settings.turnSec > 0) ms = R.settings.turnSec * 1000;
  if (!ms) return;
  R.turnDeadline = Date.now() + ms; R.turnMs = ms;
  const key = `${t.handNo}:${t.stage}:${t.toAct}:${t.seq}`;
  R.timers.turn = setTimeout(() => {
    if (`${t.handNo}:${t.stage}:${t.toAct}:${t.seq}` !== key) return;
    const L = t.legal(p.id); if (!L) return;
    try { t.act(p.id, L.canCheck ? 'check' : 'fold'); for (let i = t.log.length - 1; i >= 0; i--) if (t.log[i].startsWith(p.name + ' ')) { t.log[i] += s.sittingOut || !s.sid ? ' (away)' : ' (time)'; break; } } catch (e) { }
    after(R);
  }, ms);
}
// called after every state change
function after(R) {
  R.lastActive = Date.now();
  const t = R.table;
  if (t.stage === 'handover' && !R.timers.next) scheduleNext(R);
  if (t.stage === 'gameover') { clear(R, 'next'); R.nextHandAt = null; R.levelEndsAt = 0; R.levelLeft = levelMs(R); }
  armTurn(R); broadcast(R);
}
function scheduleNext(R) {
  clear(R, 'next'); R.nextHandAt = null;
  if (R.paused || R.table.stage !== 'handover') return;
  const ms = R.table.lastResult && R.table.lastResult.byFold ? FOLD_MS : SHOW_MS;
  R.nextHandAt = Date.now() + ms;
  R.timers.next = setTimeout(() => { delete R.timers.next; R.nextHandAt = null; if (!R.paused && R.table.stage === 'handover') { R.table.startHand(); after(R); } }, ms);
}
// blind clock
setInterval(() => {
  for (const pin in rooms) {
    const R = rooms[pin], t = R.table;
    if (Date.now() - R.lastActive > 6 * 3600e3) { Object.keys(R.timers).forEach(k => clear(R, k)); delete rooms[pin]; continue; }
    if (R.paused || !R.levelEndsAt || ['lobby', 'gameover'].includes(t.stage)) continue;
    if (Date.now() >= R.levelEndsAt) { bumpLevel(R); broadcast(R); }
  }
}, 1000);
function bumpLevel(R) {
  const t = R.table; t.level++; R.levelEndsAt = Date.now() + levelMs(R); R.levelLeft = levelMs(R);
  const [s, b] = blindsFor(t.level); t.addLog(`⬆ Blinds go up to ${s}/${b} from the next hand`);
}
const clampSettings = o => ({ levelMin: Math.min(120, Math.max(1, Math.round(+o.levelMin || 10))), turnSec: [0, 15, 20, 30, 45, 60, 90].includes(+o.turnSec) ? +o.turnSec : 0 });

io.on('connection', s => {
  const hostRoom = () => { const R = rooms[s.data.hostPin]; return R && R.hostSid === s.id ? R : null; };
  const ok = (cb, x = {}) => typeof cb === 'function' && cb({ ok: 1, ...x }), err = (cb, e) => typeof cb === 'function' && cb({ error: e });
  // ---- host ----
  s.on('host:create', (o = {}, cb) => {
    if (!pwOk(o.pw)) return err(cb, 'Wrong host PIN');
    const R = createRoom(clampSettings(o)); R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R);
  });
  s.on('host:resume', (o = {}, cb) => {
    const R = rooms[o.pin]; if (!pwOk(o.pw) || !R) return err(cb, 'Game not found');
    R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R);
  });
  const H = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = hostRoom(); if (!R) return err(cb, 'Not host'); try { fn(R, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
  H('host:settings', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Game already started'); R.settings = clampSettings(o); R.levelLeft = levelMs(R); });
  H('host:start', R => {
    const t = R.table; if (t.stage !== 'lobby') throw new Error('Already started');
    t.startGame(); R.paused = false; R.levelEndsAt = Date.now() + levelMs(R); R.levelLeft = levelMs(R);
  });
  H('host:pause', (R, o) => {
    const want = o.paused != null ? !!o.paused : !R.paused; if (want === R.paused) return;
    if (want) { R.levelLeft = levelRemaining(R); R.paused = true; clear(R, 'next'); R.nextHandAt = null; R.table.addLog('⏸ Game paused by host'); }
    else { R.paused = false; if (R.levelEndsAt) R.levelEndsAt = Date.now() + R.levelLeft; R.table.addLog('▶ Game resumed'); }
  });
  H('host:nextLevel', R => { if (['lobby', 'gameover'].includes(R.table.stage)) throw new Error('Game not running'); bumpLevel(R); if (R.paused) R.levelLeft = levelMs(R); });
  H('host:deal', R => { if (R.table.stage !== 'handover') throw new Error('Hand still in play'); clear(R, 'next'); R.nextHandAt = null; R.table.startHand(); });
  H('host:kick', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Only in the lobby'); const st = R.seats[o.id]; if (st && st.sid) io.to(st.sid).emit('kicked'); delete R.seats[o.id]; R.table.removePlayer(o.id); });
  H('host:playAgain', R => { if (R.table.stage !== 'gameover') throw new Error('Game not over'); R.table.resetForNewGame(); R.paused = false; R.levelEndsAt = 0; R.levelLeft = levelMs(R); });
  // ---- players ----
  s.on('join', (o = {}, cb) => {
    const R = rooms[String(o.pin || '').trim()]; if (!R) return err(cb, 'Game not found - check the PIN');
    if (o.token) { // reconnect to the same seat
      const id = Object.keys(R.seats).find(k => R.seats[k].token === o.token);
      if (id) { const st = R.seats[id]; if (st.sid && st.sid !== s.id) io.to(st.sid).emit('kicked', 'Opened on another device'); st.sid = s.id; s.data.pin = R.pin; s.data.pid = id; R.table.addLog(`${R.table.get(id).name} reconnected`); ok(cb, { token: o.token, id, name: R.table.get(id).name }); return after(R); }
      if (!o.name) return err(cb, 'Session expired - please join again');
    }
    const name = String(o.name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!name) return err(cb, 'Enter a nickname');
    if (R.table.stage !== 'lobby') return err(cb, 'This game has already started');
    if (R.table.players.length >= 20) return err(cb, 'Table is full (20 players)');
    if (R.table.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return err(cb, 'Nickname taken');
    const id = 'p' + crypto.randomBytes(4).toString('hex'), token = tok();
    R.table.addPlayer(id, name); R.seats[id] = { token, sid: s.id, sittingOut: false };
    s.data.pin = R.pin; s.data.pid = id; ok(cb, { token, id, name }); after(R);
  });
  const P = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = rooms[s.data.pin], id = s.data.pid; if (!R || !R.seats[id] || R.seats[id].sid !== s.id) return err(cb, 'Not in a game'); try { fn(R, id, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
  P('act', (R, id, o) => { R.table.act(id, String(o.action), o.amount); });
  P('sitout', (R, id, o) => { const st = R.seats[id]; st.sittingOut = !!o.on; R.table.addLog(`${R.table.get(id).name} ${st.sittingOut ? 'is sitting out' : 'is back'}`); });
  P('leave', (R, id) => {
    const t = R.table, p = t.get(id);
    if (t.stage === 'lobby') { t.removePlayer(id); delete R.seats[id]; }
    else { R.seats[id].sittingOut = true; R.seats[id].sid = null; t.addLog(`${p.name} left the table`); const L = t.legal(id); if (L) t.act(id, L.canCheck ? 'check' : 'fold'); }
  });
  s.on('disconnect', () => {
    const R = rooms[s.data.pin];
    if (R) { const st = R.seats[s.data.pid]; if (st && st.sid === s.id) { st.sid = null; after(R); } }
    const H2 = rooms[s.data.hostPin]; if (H2 && H2.hostSid === s.id) H2.hostSid = null;
  });
});
srv.listen(process.env.PORT || 3460, () => console.log('holdem on', process.env.PORT || 3460));
