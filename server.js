'use strict';
// Tricity Hold'em - multiplayer play-money Texas Hold'em (host screen + phones). No real money anywhere.
const express = require('express'), http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), QR = require('qrcode');
const { Table, blindsFor, rankPlayers } = require('./engine');
const Bots = require('./bots');
const Stats = require('./stats');
const app = express(), srv = http.createServer(app), io = require('socket.io')(srv, { cors: { origin: '*' }, pingInterval: 20000, pingTimeout: 30000 });
const PWF = path.join(__dirname, 'data/host_password.txt');
fs.mkdirSync(path.dirname(PWF), { recursive: true });
if (!process.env.HOST_PIN && !fs.existsSync(PWF)) fs.writeFileSync(PWF, String(crypto.randomInt(100000, 999999)), { mode: 0o600 });
const PW = (process.env.HOST_PIN || fs.readFileSync(PWF, 'utf8')).trim();
const pwOk = pw => typeof pw === 'string' && pw.length === PW.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PW));

const VER = (process.env.RENDER_GIT_COMMIT || String(Date.now())).slice(0, 10);
const html = f => { const src = fs.readFileSync(path.join(__dirname, 'public', f), 'utf8').replace(/(href|src)=\/(style\.css|cards\.js|voice\.js|bj\.js|bj\.css)/g, `$1=/$2?v=${VER}`); return (q, r) => { r.set('Cache-Control', 'no-store, max-age=0'); r.type('html').send(src); }; };
app.use(express.json());
app.get(['/', '/play', '/j/:pin'], html('play.html'));
app.get('/host', html('host.html'));
// Free Bet Blackjack table (same server, own socket namespace /bj)
app.get(['/blackjack', '/blackjack/j/:pin'], html('bj-play.html'));
app.get('/blackjack/host', html('bj-host.html'));
app.get(['/bj', '/bj/'], (q, r) => r.redirect('/blackjack')); app.get('/bj/host', (q, r) => r.redirect('/blackjack/host')); app.get('/bj/j/:pin', (q, r) => r.redirect('/blackjack/j/' + encodeURIComponent(q.params.pin)));
app.use(express.static(path.join(__dirname, 'public'), { index: false, setHeaders: (r, f) => { r.set('Cache-Control', f.endsWith('.html') ? 'no-store' : 'no-cache'); if (/manifest[^/]*\.json$/.test(f)) r.type('application/manifest+json'); if (f.endsWith('sw.js')) r.set('Service-Worker-Allowed', '/'); } }));
app.get('/healthz', (q, r) => r.json({ ok: 1, rooms: Object.keys(rooms).length, botErrors: Object.values(rooms).reduce((a, R) => a + (R.botErrors || 0), 0), watchdog: Object.values(rooms).reduce((a, R) => a + (R.watchdog || 0), 0), blackjack: BJ.health() }));
app.post('/api/login', (q, r) => r.json({ ok: pwOk(q.body && q.body.pw) }));
app.get('/api/qr', async (q, r) => r.type('svg').send(await QR.toString(String(q.query.u || ''), { type: 'svg', margin: 1 })));

const rooms = {};
const BOT_MIN = process.env.BOT_MS != null ? +process.env.BOT_MS : null; // tests can speed bots up
const SHOW_MS = +process.env.SHOWDOWN_MS || 9000, FOLD_MS = +process.env.FOLDWIN_MS || 4000, AWAY_MS = +process.env.AWAY_MS || 30000, AWAY_FAST_MS = +process.env.AWAY_FAST_MS || 5000, SITOUT_MS = 1500;
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
    pin: R.pin, stage: t.stage, handNo: t.handNo, paused: R.paused, settings: { levelMin: R.settings.levelMin, turnSec: R.settings.turnSec, stats: !!R.settings.stats }, buyIn: buyInInfo(R), serverNow: Date.now(),
    blinds: t.handNo ? t.blinds : blindsFor(t.level), nextBlinds: blindsFor(t.level), levelUp: t.handNo > 0 && t.level > t.handLevel,
    level: t.level + 1, handLevel: (t.handNo ? t.handLevel : t.level) + 1, turnMs: R.turnMs || 0, upcoming: blindsFor(t.level + 1), levelRemaining: levelRemaining(R),
    board: t.board, pot: t.potTotal ? (inHand || t.stage === 'showdown' ? t.potTotal() : 0) : 0, currentBet: inHand ? t.currentBet : 0,
    dealer: t.players[t.dealerSeat] ? t.players[t.dealerSeat].id : null, sb: t.handNo && t.players[t.sbSeat] ? t.players[t.sbSeat].id : null, bb: t.handNo && t.players[t.bbSeat] ? t.players[t.bbSeat].id : null, order: t.actionOrder(), headsUp: !!t.headsUp,
    toAct: cur ? cur.id : null, turnDeadline: R.turnDeadline || null,
    players: t.players.map(p => { const s = R.seats[p.id] || {}; return { id: p.id, name: p.name, chips: p.chips, bet: p.bet, folded: p.folded && !p.out, allIn: p.allIn, out: p.out, outHand: p.out ? (p.outHand || 0) : 0, sittingOut: !!s.sittingOut, connected: !!(s.sid || s.bot), bot: s.bot || null, pay: s.bot ? 'bot' : payOf(s), mic: !!(s.sid && s.mic), speaking: !!(s.sid && s.mic && s.speaking), lastAction: p.lastAction, hasCards: inHand && p.hole.length === 2 && !p.folded, shown: shown[p.id] ? { hole: shown[p.id].hole, hand: shown[p.id].hand, best: shown[p.id].best } : null }; }),
    log: t.log.slice(-14), seq: t.seq || 0, result: inHand ? null : t.lastResult, winner: t.stage === 'gameover' ? t.winner : null, endedByHost: t.stage === 'gameover' && !!t.endedByHost, standings: t.stage === 'gameover' ? t.standings() : null, nextHandAt: R.nextHandAt || null,
  };
}
function broadcast(R) {
  const pub = publicView(R);
  if (R.hostSid) io.to(R.hostSid).emit('state', pub);
  for (const id in R.seats) {
    const s = R.seats[id]; if (!s.sid) continue;
    const p = R.table.get(id); if (!p) continue;
    io.to(s.sid).emit('state', { ...pub, me: meView(R, id, p) });
  }
}
// Private per-player view. `stats` (beginner hand + win odds) only when the host has Stats on; it is built from this
// player's own cards, the board and the opponent COUNT only - never other players' hole cards.
function meView(R, id, p) {
  const s = R.seats[id] || {}, me = { id, hole: p.hole, legal: R.table.legal(id), sittingOut: !!s.sittingOut };
  if (R.settings.stats && !s.bot) { try { me.stats = statsFor(R, id, p); } catch (e) { console.error(`[${R.pin}] stats failed:`, e && e.stack || e); } }
  return me;
}
function statsFor(R, id, p) {
  const t = R.table; if (!['preflop', 'flop', 'turn', 'river'].includes(t.stage) || p.folded || p.out || !p.hole || p.hole.length !== 2) return null;
  const opps = t.players.filter(o => o.id !== id && !o.folded && !o.out && o.hole && o.hole.length === 2).length; if (!opps) return null;
  const d = Stats.describe(p.hole, t.board), key = `${t.handNo}|${p.hole.join('')}|${t.board.join('')}|${opps}`;
  const out = { hand: d.hand, draw: d.draw, opps, street: t.stage, eq: null };
  const c = (R.statsCache || (R.statsCache = {}))[id];
  if (c && c.key === key) { if (c.eq != null) { out.eq = Math.round(c.eq * 1000) / 10; out.hint = Stats.hint(c.eq, opps); } return out; }
  R.statsCache[id] = { key, eq: null }; const t0 = Date.now();
  Stats.equityJob(p.hole, t.board, opps).then(r => {
    const cur = R.statsCache && R.statsCache[id]; if (!cur || cur.key !== key || rooms[R.pin] !== R) return;
    cur.eq = r.eq; R.statsMs = Date.now() - t0; R.statsN = r.n;
    const st = R.seats[id], pp = R.table.get(id); if (st && st.sid && pp && R.settings.stats) io.to(st.sid).emit('state', { ...publicView(R), me: meView(R, id, pp) });
  }).catch(e => console.error(`[${R.pin}] equity failed:`, e && e.stack || e));
  return out;
}
function voicePeers(R, id) { return Object.keys(R.seats).filter(k => k !== id && R.seats[k].sid); }
function voiceUpdate(R, id) { const st = R.seats[id]; if (!st) return; const v = { id, mic: !!(st.sid && st.mic), speaking: !!(st.sid && st.mic && st.speaking) };
  if (R.hostSid) io.to(R.hostSid).emit('voice', v); for (const k in R.seats) if (R.seats[k].sid) io.to(R.seats[k].sid).emit('voice', v); }
const sockAlive = sid => !!(sid && io.sockets.sockets.get(sid) && io.sockets.sockets.get(sid).connected);
function clear(R, k) { clearTimeout(R.timers[k]); delete R.timers[k]; }

// A turn is identified by hand, street, seat and the engine's turn counter (NOT the log length:
// log lines such as the automatic "blinds go up" used to change the key and silently cancel a pending turn).
const turnKey = t => `${t.handNo}:${t.stage}:${t.toAct}:${t.turnSeq || 0}`;
const safe = (R, what, fn) => { try { fn(); } catch (e) { console.error(`[${R.pin}] ${what} failed:`, e && e.stack || e); try { after(R); } catch (e2) { console.error('after failed', e2); } } };
function armTurn(R) {
  clear(R, 'turn'); R.turnDeadline = null; R.turnArm = null;
  const t = R.table; if (!['preflop', 'flop', 'turn', 'river'].includes(t.stage) || R.paused) return;
  const p = t.players[t.toAct]; if (!p) return; const s = R.seats[p.id] || {};
  if (s.bot) return armBot(R, p, s);
  let ms = 0;
  if (s.sittingOut) ms = SITOUT_MS;
  else if (!s.sid) ms = (s.missed || 0) >= 2 ? Math.min(AWAY_FAST_MS, AWAY_MS) : (R.settings.turnSec > 0 ? R.settings.turnSec * 1000 : AWAY_MS); // away: keep seat + chips, auto check/fold
  else if (R.settings.turnSec > 0) ms = R.settings.turnSec * 1000;
  if (!ms) return;
  R.turnDeadline = Date.now() + ms; R.turnMs = ms;
  const key = turnKey(t); R.turnArm = { key, due: Date.now() + ms };
  R.timers.turn = setTimeout(() => safe(R, 'turn timer', () => {
    delete R.timers.turn; if (turnKey(t) !== key || R.paused) return;
    const L = t.legal(p.id); if (!L) return;
    if (!s.sid && !s.sittingOut) s.missed = (s.missed || 0) + 1;
    t.act(p.id, L.canCheck ? 'check' : 'fold'); for (let i = t.log.length - 1; i >= 0; i--) if (t.log[i].startsWith(p.name + ' ')) { t.log[i] += s.sittingOut || !s.sid ? ' (away)' : ' (time)'; break; }
    after(R);
  }), ms);
}
function armBot(R, p, s) {
  const t = R.table, v = Bots.viewFor(t, p.id); if (!v) return;
  let ms = BOT_MIN != null ? BOT_MIN : Bots.delayMs(v);
  if (R.settings.turnSec > 0) ms = Math.min(ms, R.settings.turnSec * 1000 - 500);
  const key = turnKey(t); R.turnArm = { key, due: Date.now() + ms };
  R.timers.turn = setTimeout(() => safe(R, 'bot turn', () => {
    delete R.timers.turn; if (R.paused || turnKey(t) !== key) return;
    const v2 = Bots.viewFor(t, p.id); if (!v2) return;
    let d; try { d = Bots.decide(s.bot, v2); t.act(p.id, d.action, d.amount); }
    catch (e) { R.botErrors = (R.botErrors || 0) + 1; console.warn('bot fallback', p.name, e.message, JSON.stringify(d)); if (t.legal(p.id)) t.act(p.id, v2.legal.canCheck ? 'check' : 'fold'); }
    after(R);
  }), ms);
}
// called after every state change
function after(R) {
  R.lastActive = Date.now(); R.lastChange = Date.now();
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
  R.timers.next = setTimeout(() => safe(R, 'next hand', () => { delete R.timers.next; R.nextHandAt = null; if (!R.paused && R.table.stage === 'handover') { R.table.startHand(); after(R); } }), ms);
}
// Watchdog: never let a table sit still. Runs every second per room.
function watchdog(R) {
  const t = R.table; if (R.paused) return;
  const log = why => { R.watchdog = (R.watchdog || 0) + 1; console.warn(`[${R.pin}] watchdog: ${why} (hand ${t.handNo} ${t.stage})`); };
  if (t.stage === 'handover' && !R.timers.next) { log('next hand was not scheduled'); return after(R); }
  if (!['preflop', 'flop', 'turn', 'river'].includes(t.stage)) return;
  const p = t.players[t.toAct]; if (!p) return; const s = R.seats[p.id] || {};
  const needsTimer = s.bot || s.sittingOut || !s.sid || R.settings.turnSec > 0;
  const a = R.turnArm;
  if (needsTimer && (!R.timers.turn || !a || a.key !== turnKey(t))) { log(`no live timer for ${p.name}'s turn - re-arming`); return after(R); }
  if (needsTimer && a && Date.now() > a.due + 5000) { log(`timer for ${p.name} overdue - re-arming`); return after(R); }
  // human turn with no timer: make sure the phone has the latest state (in case an update was missed)
  if (!needsTimer && s.sid && Date.now() - (R.lastChange || 0) > 20000 && Date.now() - (R.lastResend || 0) > 20000) {
    R.lastResend = Date.now(); const L = t.legal(p.id); io.to(s.sid).emit('state', { ...publicView(R), me: meView(R, p.id, p) });
  }
}
// blind clock + watchdog
setInterval(() => {
  for (const pin in rooms) {
    const R = rooms[pin], t = R.table;
    try {
      if (Date.now() - R.lastActive > 6 * 3600e3) { Object.keys(R.timers).forEach(k => clear(R, k)); delete rooms[pin]; continue; }
      if (!R.paused && R.levelEndsAt && !['lobby', 'gameover'].includes(t.stage) && Date.now() >= R.levelEndsAt) { bumpLevel(R); broadcast(R); }
      watchdog(R);
    } catch (e) { console.error(`[${pin}] clock/watchdog error:`, e && e.stack || e); }
  }
}, 1000);
function bumpLevel(R) {
  const t = R.table; t.level++; R.levelEndsAt = Date.now() + levelMs(R); R.levelLeft = levelMs(R);
  const [s, b] = blindsFor(t.level); t.addLog(`⬆ Blinds go up to ${s}/${b} from the next hand`);
}
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
function clampSettings(o) {
  const b = o.buyIn || {}, on = !!b.on, cents = Math.round(Number(String(b.amount ?? 5).replace(/[$,\s]/g, '')) * 100), email = String(b.email || '').trim().slice(0, 254);
  if (on && !(cents >= 100 && cents <= 100000)) throw new Error('Buy-in amount must be between $1 and $1,000');
  if (on && !EMAIL.test(email)) throw new Error('Enter a valid e-Transfer email for the buy-in');
  return { stats: !!o.stats, levelMin: Math.min(120, Math.max(1, Math.round(+o.levelMin || 10))), turnSec: [0, 15, 20, 30, 45, 60, 90].includes(+o.turnSec) ? +o.turnSec : 0,
    buyIn: on ? { on: true, cents, email } : { on: false, cents: Number.isFinite(cents) && cents >= 100 ? cents : 500, email: EMAIL.test(email) ? email : '' } };
}
// Who collects the buy-in pot: the best-placed human under the same ranking as the standings. Bots never pay in and never collect.
function payout(R) {
  const t = R.table, isBot = p => !!(R.seats[p.id] || {}).bot, all = rankPlayers(t.players);
  const leaders = all.filter(r => r.rank === 1).map(r => t.get(r.id));
  const botWinner = leaders.length && leaders.every(isBot) ? leaders.map(p => p.name).join(' & ') : null;
  const hs = rankPlayers(t.players.filter(p => !isBot(p)));
  if (!hs.length) return { payTo: null, botWinner };
  return { payTo: hs.filter(r => r.rank === 1).map(r => r.name).join(' & '), botWinner };
}
const payOf = st => (st && st.pay) || 'none';
function buyInInfo(R) {
  const b = R.settings.buyIn || { on: false }; if (!b.on) return { on: false };
  const t = R.table, humans = t.players.filter(p => !(R.seats[p.id] || {}).bot), confirmed = humans.filter(p => payOf(R.seats[p.id]) === 'confirmed').length;
  const n = t.stage === 'lobby' ? confirmed : (R.buyInCount || confirmed);
  const out = { on: true, cents: b.cents, email: b.email, confirmed, humans: humans.length, pot: b.cents * n, unpaid: humans.length - confirmed };
  if (t.stage === 'gameover') Object.assign(out, payout(R));
  return out;
}

io.on('connection', s => {
  const hostRoom = () => { const R = rooms[s.data.hostPin]; return R && R.hostSid === s.id ? R : null; };
  const ok = (cb, x = {}) => typeof cb === 'function' && cb({ ok: 1, ...x }), err = (cb, e, code) => typeof cb === 'function' && cb(code ? { error: e, code } : { error: e });
  // ---- host ----
  s.on('host:create', (o = {}, cb) => {
    if (!pwOk(o.pw)) return err(cb, 'Wrong host PIN');
    let cs; try { cs = clampSettings(o); } catch (e) { return err(cb, e.message); } const R = createRoom(cs); R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R);
  });
  s.on('host:resume', (o = {}, cb) => {
    const R = rooms[o.pin]; if (!pwOk(o.pw) || !R) return err(cb, 'Game not found');
    R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R);
  });
  const H = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = hostRoom(); if (!R) return err(cb, 'Not host'); try { fn(R, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
  H('host:settings', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Game already started'); R.settings = clampSettings(o); R.levelLeft = levelMs(R); });
  H('host:stats', (R, o) => { R.settings.stats = o.on != null ? !!o.on : !R.settings.stats; });
  H('host:start', R => {
    const t = R.table; if (t.stage !== 'lobby') throw new Error('Already started');
    const bi = buyInInfo(R); if (bi.on && bi.unpaid > 0) throw new Error(`${bi.unpaid} player${bi.unpaid > 1 ? 's have' : ' has'} not been confirmed for the buy-in - confirm or remove them first`);
    R.buyInCount = bi.on ? bi.confirmed : 0;
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
  H('host:end', R => { clear(R, 'next'); clear(R, 'turn'); R.nextHandAt = null; R.turnDeadline = null; R.paused = false; R.table.endGame(); });
  H('host:addBot', (R, o) => {
    const t = R.table; if (t.stage !== 'lobby') throw new Error('Only in the lobby');
    const lv = String(o.level || '').toLowerCase(); if (!Bots.LEVELS.includes(lv)) throw new Error('Pick Easy, Medium or Hard');
    if (Object.values(R.seats).filter(x => x.bot).length >= 5) throw new Error('Maximum 5 computer players');
    if (t.players.length >= 20) throw new Error('Table is full (20 players)');
    const name = Bots.pickName(lv, t.players.map(p => p.name)), id = 'b' + crypto.randomBytes(4).toString('hex');
    t.addPlayer(id, name); R.seats[id] = { token: tok(), sid: null, sittingOut: false, bot: lv, mic: false, pay: 'bot' };
    t.addLog(`🤖 ${name} (${lv}) joined the table`);
  });
  s.on('host:rejoin', (o = {}, cb) => {
    const R = hostRoom(); if (!R) return err(cb, 'Not host'); const st = R.seats[o.id], p = R.table.get(o.id);
    if (!st || !p || st.bot) return err(cb, 'No such player');
    const code = crypto.randomBytes(6).toString('hex'), exp = Date.now() + 15 * 60000;
    st.rejoin = { code, exp }; st.rejoinOpenUntil = exp;
    ok(cb, { path: `/j/${R.pin}?r=${code}`, name: p.name, connected: sockAlive(st.sid) });
  });
  if (process.env.TEST_HOOKS === '1') s.on('test:loseTimers', (o, cb) => { const R = hostRoom(); if (R) { clear(R, 'turn'); clear(R, 'next'); } cb && cb({ ok: 1 }); }); // test-only: simulate a lost timer
  H('host:confirm', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Only in the lobby'); const st = R.seats[o.id]; if (!st || !R.table.get(o.id)) throw new Error('No such player'); if (st.bot) throw new Error('Computer players don\'t pay a buy-in'); st.pay = o.on ? 'confirmed' : (st.pay === 'confirmed' ? 'pending' : st.pay); });
  H('host:playAgain', R => { if (R.table.stage !== 'gameover') throw new Error('Game not over'); R.table.resetForNewGame(); for (const k in R.seats) if (!R.seats[k].bot) R.seats[k].pay = 'none'; R.buyInCount = 0; R.paused = false; R.levelEndsAt = 0; R.levelLeft = levelMs(R); });
  // ---- players ----
  s.on('join', (o = {}, cb) => {
    const R = rooms[String(o.pin || '').trim()]; if (!R) return err(cb, 'Game not found - check the PIN');
    if (o.rejoin) { // host-issued reconnect link / QR
      const id = Object.keys(R.seats).find(k => R.seats[k].rejoin && R.seats[k].rejoin.code === String(o.rejoin));
      if (!id || R.seats[id].rejoin.exp < Date.now()) return err(cb, 'That reconnect link has expired - ask the host for a new one', 'rejoinExpired');
      R.seats[id].rejoin = null; return bindSeat(R, id, true, cb, 'via host link');
    }
    if (o.token) { // reconnect to the same seat
      const id = Object.keys(R.seats).find(k => R.seats[k].token === o.token);
      if (id) return bindSeat(R, id, false, cb);
      if (!o.name) return err(cb, 'Session expired - please join again', 'expired');
    }
    if (o.reclaim) { // manual "Rejoin my seat": PIN + name, only while that seat is away (or the host has allowed it)
      const nm = String(o.name || '').trim().toLowerCase(), p = R.table.players.find(q => q.name.toLowerCase() === nm && !R.seats[q.id].bot);
      if (!p) return err(cb, 'No seat with that name in this game', 'noSeat');
      const st = R.seats[p.id], allowed = st.rejoinOpenUntil && st.rejoinOpenUntil > Date.now();
      if (sockAlive(st.sid) && !allowed) return err(cb, `${p.name}'s seat is still connected on another screen. If it's you, ask the host to tap your seat and choose "Let ${p.name} rejoin".`, 'seatConnected');
      return bindSeat(R, p.id, true, cb, 'rejoined their seat');
    }
    const name = String(o.name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!name) return err(cb, 'Enter a nickname');
    if (R.table.stage !== 'lobby') { const p = R.table.players.find(q => q.name.toLowerCase() === name.toLowerCase() && !R.seats[q.id].bot); return p ? err(cb, `There is already a seat for ${p.name} in this game`, 'canReclaim') : err(cb, 'This game has already started'); }
    if (R.table.players.length >= 20) return err(cb, 'Table is full (20 players)');
    if (R.table.players.some(p => p.name.toLowerCase() === name.toLowerCase())) { const p = R.table.players.find(q => q.name.toLowerCase() === name.toLowerCase()); return R.seats[p.id].bot ? err(cb, 'Nickname taken') : err(cb, `${p.name} is already at this table`, 'canReclaim'); }
    const id = 'p' + crypto.randomBytes(4).toString('hex'), token = tok();
    R.table.addPlayer(id, name); R.seats[id] = { token, sid: s.id, sittingOut: false };
    s.data.pin = R.pin; s.data.pid = id; ok(cb, { token, id, name }); after(R);
  });
  function bindSeat(R, id, newToken, cb, how) {
    const st = R.seats[id], p = R.table.get(id); if (!st || !p) return err(cb, 'No such seat');
    if (st.sid && st.sid !== s.id) io.to(st.sid).emit('kicked', { soft: true, msg: 'Your seat was opened on another screen.' });
    const was = st.sid; if (newToken) st.token = tok();
    st.sid = s.id; st.mic = false; st.speaking = false; st.missed = 0; st.rejoinOpenUntil = 0; if (newToken) st.sittingOut = false; s.data.pin = R.pin; s.data.pid = id;
    if (was !== s.id) R.table.addLog(`${p.name} ${how || 'reconnected'}`);
    voiceUpdate(R, id); ok(cb, { token: st.token, id, name: p.name, pin: R.pin }); after(R);
  }
  s.on('seat:check', (o = {}, cb) => {
    const R = rooms[s.data.pin], id = s.data.pid, st = R && R.seats[id], bound = !!(st && st.sid === s.id); ok(cb, { bound, game: !!R });
    if (bound && R.table.get(id)) { const p = R.table.get(id); s.emit('state', { ...publicView(R), me: meView(R, id, p) }); } // heartbeat also resyncs a phone that missed an update
  });
  const P = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = rooms[s.data.pin], id = s.data.pid; if (!R || !R.seats[id] || R.seats[id].sid !== s.id) return err(cb, 'Not in a game', 'rebind'); try { fn(R, id, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
  P('act', (R, id, o) => { R.table.act(id, String(o.action), o.amount); });
  P('buyin:sent', (R, id, o) => { const st = R.seats[id]; if (!(R.settings.buyIn || {}).on) throw new Error('No buy-in for this game'); if (R.table.stage !== 'lobby') throw new Error('Game already started'); if (st.pay === 'confirmed') throw new Error('Already confirmed by the host'); st.pay = o.on ? 'pending' : 'none'; });
  P('sitout', (R, id, o) => { const st = R.seats[id]; st.sittingOut = !!o.on; R.table.addLog(`${R.table.get(id).name} ${st.sittingOut ? 'is sitting out' : 'is back'}`); });
  P('leave', (R, id) => {
    const t = R.table, p = t.get(id);
    if (t.stage === 'lobby') { t.removePlayer(id); delete R.seats[id]; }
    else { R.seats[id].sittingOut = true; R.seats[id].sid = null; R.seats[id].mic = false; t.addLog(`${p.name} left the table`); const L = t.legal(id); if (L) t.act(id, L.canCheck ? 'check' : 'fold'); }
  });
  // ---- voice chat (WebRTC audio, server only relays signaling between seated players) ----
  const seatOf = () => { const R = rooms[s.data.pin], id = s.data.pid; return R && R.seats[id] && R.seats[id].sid === s.id ? [R, id] : [null, null]; };
  s.on('mic', (o = {}, cb) => { const [R, id] = seatOf(); if (!R) return err(cb, 'Not in a game'); const st = R.seats[id]; st.mic = !!o.on; if (!st.mic) st.speaking = false; voiceUpdate(R, id); ok(cb, { peers: voicePeers(R, id) }); });
  s.on('speaking', (o = {}) => { const [R, id] = seatOf(); if (!R) return; const st = R.seats[id], v = !!o.on && !!st.mic; if (v !== !!st.speaking) { st.speaking = v; voiceUpdate(R, id); } });
  s.on('rtc', (m = {}) => {
    const [R, id] = seatOf(); if (!R || typeof m !== 'object' || id === m.to) return;
    const t = R.seats[m.to]; if (!t || !t.sid || JSON.stringify(m).length > 20000) return;
    io.to(t.sid).emit('rtc', { kind: String(m.kind), sdp: m.sdp, cand: m.cand, from: id });
  });
  s.on('rtc:hello', () => { const [R, id] = seatOf(); if (!R) return; for (const k in R.seats) if (k !== id && R.seats[k].sid && R.seats[k].mic) io.to(R.seats[k].sid).emit('rtc:reset', { id }); });
  s.on('disconnect', () => {
    const R = rooms[s.data.pin];
    if (R) { const st = R.seats[s.data.pid]; if (st && st.sid === s.id) { st.sid = null; st.mic = false; st.speaking = false; voiceUpdate(R, s.data.pid); after(R); } }
    const H2 = rooms[s.data.hostPin]; if (H2 && H2.hostSid === s.id) H2.hostSid = null;
  });
});
const BJ = require('./bj/server')({ io, pwOk });
srv.listen(process.env.PORT || 3460, () => console.log('holdem on', process.env.PORT || 3460));
