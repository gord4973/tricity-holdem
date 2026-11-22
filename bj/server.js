'use strict';
// Free Bet Blackjack table: socket.io namespace /bj, same host PIN, lobby, buy-in, stats, voice and seat recovery as Hold'em.
const crypto = require('crypto');
const { Table, total, handLabel, fmt, START_CHIPS } = require('./engine');
const Strat = require('./strategy'), Bots = require('./bots');
const { rankPlayers } = require('../engine');

module.exports = function attach({ io, pwOk }) {
  const nsp = io.of('/bj'), rooms = {};
  const E = process.env, BOT_MIN = E.BJ_BOT_MS != null ? +E.BJ_BOT_MS : null;
  const DEALER_MS = +E.BJ_DEALER_MS || 900, SPLIT_MS = +E.BJ_SPLIT_MS || 900, RESULT_MS = +E.BJ_RESULT_MS || 7000, AWAY_MS = +E.BJ_AWAY_MS || 10000, SITOUT_MS = 1500, READY_MS = +E.BJ_READY_MS || 900, INS_MS = +E.BJ_INS_MS || 12000;
  const tok = () => crypto.randomBytes(16).toString('hex');
  function newPin() { let p; do p = String(crypto.randomInt(1000, 9999)); while (rooms[p]); return p; }
  const sockAlive = sid => { const k = sid && nsp.sockets.get(sid); return !!(k && k.connected); };
  const clear = (R, k) => { clearTimeout(R.timers[k]); delete R.timers[k]; };
  const clearAll = R => Object.keys(R.timers).forEach(k => clear(R, k));
  const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
  const pick = (v, list, d) => list.includes(+v) ? +v : d;
  function clampSettings(o) {
    const b = o.buyIn || {}, on = !!b.on, cents = Math.round(Number(String(b.amount ?? 5).replace(/[$,\s]/g, '')) * 100), email = String(b.email || '').trim().slice(0, 254);
    if (on && !(cents >= 100 && cents <= 100000)) throw new Error('Buy-in amount must be between $1 and $1,000');
    if (on && !EMAIL.test(email)) throw new Error('Enter a valid e-Transfer email for the buy-in');
    const minBet = pick(o.minBet, [5, 10, 25, 50, 100], 5) * 100; let maxBet = pick(o.maxBet, [100, 200, 300, 400, 500, 1000], 500) * 100; if (maxBet < minBet * 2) maxBet = minBet * 10;
    return { stats: !!o.stats, minBet, maxBet, pog: o.pog !== false && o.pog !== 'false', turnSec: pick(o.turnSec, [0, 15, 20, 30, 45, 60], 30), betSec: pick(o.betSec, [0, 15, 20, 30, 45, 60], 20),
      buyIn: on ? { on: true, cents, email } : { on: false, cents: Number.isFinite(cents) && cents >= 100 ? cents : 500, email: EMAIL.test(email) ? email : '' } };
  }
  function createRoom(settings) { const pin = newPin(); const R = { pin, game: 'bj', hostSid: null, settings, seats: {}, paused: false, timers: {}, created: Date.now(), lastActive: Date.now() }; R.table = new Table({ stepSplits: true, minBet: settings.minBet, maxBet: settings.maxBet, pog: settings.pog }); rooms[pin] = R; return R; }
  const applySettings = R => { const t = R.table; t.minBet = R.settings.minBet; t.maxBet = R.settings.maxBet; t.pog = R.settings.pog; };
  const isBot = (R, id) => !!(R.seats[id] || {}).bot;
  const payOf = st => (st && st.pay) || 'none';
  function payout(R) {
    const t = R.table, all = rankPlayers(t.players), leaders = all.filter(r => r.rank === 1).map(r => t.get(r.id));
    const botWinner = leaders.length && leaders.every(p => isBot(R, p.id)) ? leaders.map(p => p.name).join(' & ') : null;
    const hs = rankPlayers(t.players.filter(p => !isBot(R, p.id))); return { payTo: hs.length ? hs.filter(r => r.rank === 1).map(r => r.name).join(' & ') : null, botWinner };
  }
  function buyInInfo(R) {
    const b = R.settings.buyIn || { on: false }; if (!b.on) return { on: false };
    const t = R.table, humans = t.players.filter(p => !isBot(R, p.id)), confirmed = humans.filter(p => payOf(R.seats[p.id]) === 'confirmed').length;
    const n = t.stage === 'lobby' ? confirmed : (R.buyInCount || confirmed);
    const out = { on: true, cents: b.cents, email: b.email, confirmed, humans: humans.length, pot: b.cents * n, unpaid: humans.length - confirmed };
    if (t.stage === 'gameover') Object.assign(out, payout(R)); return out;
  }
  const IN_ROUND = ['insurance', 'playing', 'dealer', 'settled'];
  function dealerView(t) {
    const d = t.dealer; if (!d.cards.length) return { cards: [], label: '' };
    if (!d.revealed) return { cards: [d.cards[0], 'back'], label: handLabel([d.cards[0]]), up: d.cards[0] };
    const dt = total(d.cards).total; return { cards: d.cards, label: dt === 21 && d.cards.length === 2 ? 'Blackjack' : dt === 22 ? '22 · Push' : handLabel(d.cards), total: total(d.cards).total, up: d.cards[0] };
  }
  function publicView(R) {
    const t = R.table, cur = t.cur();
    return {
      game: 'bj', pin: R.pin, stage: t.stage, round: t.round, tseq: t.turnSeq, paused: R.paused, pausedLeft: R.paused && R.frozen ? (R.frozen.turn != null ? R.frozen.turn : R.frozen.bet) : null, serverNow: Date.now(), buyIn: buyInInfo(R),
      settings: { stats: !!R.settings.stats, minBet: R.settings.minBet, maxBet: R.settings.maxBet, pog: R.settings.pog, turnSec: R.settings.turnSec, betSec: R.settings.betSec, pogMin: t.pogMin, pogMax: t.pogMax },
      shoe: { remaining: t.shoe.remaining, total: t.shoe.cards.length, cut: t.shoe.cards.length - t.shoe.cutAt, shuffles: t.shoe.shuffles },
      dealer: dealerView(t), turn: cur ? { id: cur.b.id, hand: t.turn.hi, of: cur.b.hands.length, pending: !!t.pendingCard } : null, turnDeadline: R.turnDeadline || null, turnMs: R.turnMs || 0, betDeadline: R.betDeadline || null, nextRoundAt: R.nextRoundAt || null,
      players: t.players.map((p, i) => { const s = R.seats[p.id] || {}, b = t.boxes.find(x => x.id === p.id);
        return { id: p.id, name: p.name, seat: i, chips: p.chips, out: p.out, outHand: p.outHand, bet: { main: p.bet.main, pog: p.bet.pog, ready: p.bet.ready }, sittingOut: !!s.sittingOut, connected: !!(s.sid || s.bot), bot: s.bot || null, pay: s.bot ? 'bot' : payOf(s), mic: !!(s.sid && s.mic), speaking: !!(s.sid && s.mic && s.speaking),
          box: b ? { unit: b.unit, pog: b.pog, lammers: b.lammers, insurance: b.insurance, net: t.stage === 'settled' ? b.net : null, pogPaid: b.pogPaid || 0,
            hands: b.hands.map(h => ({ cards: h.cards, cash: h.cash, free: h.free, label: h.bj ? 'Blackjack' : handLabel(h.cards), total: total(h.cards).total, bust: !!h.bust, bj: !!h.bj, done: h.done, doubled: h.doubled, freeDouble: !!h.freeDouble, freeSplit: !!h.freeSplit, result: h.result || null, paid: h.paid || 0 })) } : null }; }),
      log: t.log.slice(-12), seq: t.seq, result: t.stage === 'settled' || t.stage === 'gameover' ? t.result : null,
      winner: t.stage === 'gameover' ? t.winner : null, endedByHost: t.stage === 'gameover' && !!t.endedByHost, standings: t.stage === 'gameover' ? t.standings() : null,
    };
  }
  function unseen(t) { const w = [0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 96].map(x => x * t.shoe.decks / 6); for (let v = 1; v <= 10; v++) w[v] = Math.max(0, w[v] - t.seen[v]); return w; }
  function statsFor(R, id) {
    const t = R.table, b = t.boxes.find(x => x.id === id); if (!b || !['insurance', 'playing', 'dealer'].includes(t.stage)) return null;
    const up = t.dealer.cards[0], w = unseen(t), peeked = t.stage !== 'insurance', d = Strat.dealerOdds(up, w, peeked);
    const out = { dealerBust: Math.round(d.bust * 1000) / 10, dealer22: Math.round(d.d22 * 1000) / 10, up, hands: b.hands.map(h => { const tt = total(h.cards); return h.bj ? 'Blackjack' : tt.total > 21 ? `Bust (${tt.total})` : `${tt.soft && tt.total < 21 ? 'Soft' : 'Hard'} ${tt.total}`; }) };
    if (t.stage === 'insurance') out.rec = b.insurance === null ? 'No insurance (basic strategy never takes it)' : null;
    const L = t.legal(id);
    if (L) { const h = b.hands[t.turn.hi]; out.active = t.turn.hi; out.rec = Strat.recommend(h.cards, up, L, h.cash === 0).label; out.bust = Math.round(Strat.bustIfHit(h.cards, w) * 1000) / 10; out.freeHand = h.cash === 0; }
    return out;
  }
  function meView(R, id) {
    const t = R.table, p = t.get(id), s = R.seats[id] || {}; if (!p) return null;
    const me = { id, legal: t.legal(id), sittingOut: !!s.sittingOut, last: p.last, canInsure: t.stage === 'insurance' && (t.boxes.find(b => b.id === id) || {}).insurance === null };
    if (R.settings.stats && !s.bot) { try { me.stats = statsFor(R, id); } catch (e) { console.error(`[bj ${R.pin}] stats failed:`, e && e.stack || e); } }
    return me;
  }
  function broadcast(R) {
    const pub = publicView(R); if (R.hostSid) nsp.to(R.hostSid).emit('state', pub);
    for (const id in R.seats) { const s = R.seats[id]; if (s.sid && R.table.get(id)) nsp.to(s.sid).emit('state', { ...pub, me: meView(R, id) }); }
  }
  const voicePeers = (R, id) => Object.keys(R.seats).filter(k => k !== id && R.seats[k].sid);
  function voiceUpdate(R, id) { const st = R.seats[id]; if (!st) return; const v = { id, mic: !!(st.sid && st.mic), speaking: !!(st.sid && st.mic && st.speaking) }; if (R.hostSid) nsp.to(R.hostSid).emit('voice', v); for (const k in R.seats) if (R.seats[k].sid) nsp.to(R.seats[k].sid).emit('voice', v); }

  // ---- scheduling (same pattern as Hold'em: keyed timers, safe callbacks, watchdog) ----
  const tkey = t => `${t.round}:${t.stage}:${t.turn ? t.turn.bi + '.' + t.turn.hi : '-'}:${t.turnSeq}`;
  const safe = (R, what, fn) => { try { fn(); } catch (e) { console.error(`[bj ${R.pin}] ${what} failed:`, e && e.stack || e); try { after(R); } catch (e2) { console.error('bj after failed', e2); } } };
  const activeHuman = (R, p) => { const s = R.seats[p.id] || {}; return !s.bot && !p.out && !!s.sid && !s.sittingOut; };
  function botBets(R) { const t = R.table; for (const p of t.players) { const s = R.seats[p.id]; if (!s || !s.bot || p.out || p.bet.ready) continue; const b = Bots.bet(s.bot, p.chips, t.minBet, t.maxBet, t.pog); if (b.main) { try { t.setBet(p.id, b.main, b.pog); t.betReady(p.id, true); } catch (e) { R.botErrors = (R.botErrors || 0) + 1; } } } }
  function arm(R) {
    const t = R.table; if (R.paused || t.stage === 'lobby' || t.stage === 'gameover') { clear(R, 'turn'); clear(R, 'bet'); clear(R, 'step'); R.turnDeadline = null; R.arm = null; return; }
    const key = tkey(t), c0 = t.cur(), s0 = c0 ? R.seats[c0.b.id] || {} : {}, sig = `${key}|${s0.sid ? 1 : 0}${s0.sittingOut ? 1 : 0}${s0.missed || 0}|${R.settings.turnSec}`;
    if (t.stage !== 'betting' && R.arm && R.arm.sig === sig && R.arm.live()) return; // already scheduled for exactly this moment (don't restart the clock)
    clear(R, 'turn'); clear(R, 'bet'); clear(R, 'step'); R.turnDeadline = null; R.nextRoundAt = null;
    const set = (k, ms, fn, what) => { if (R.resume) { if (R.resume.key === key && R.resume.ms != null) { ms = Math.max(400, Math.min(ms, R.resume.ms)); if (k === 'turn' && R.turnDeadline) R.turnDeadline = Date.now() + ms; } R.resume = null; } const due = Date.now() + ms; R.timers[k] = setTimeout(() => safe(R, what, () => { delete R.timers[k]; if (R.paused || tkey(t) !== key) return; fn(); after(R); }), ms); R.arm = { key, sig, due, live: () => !!R.timers[k] }; };
    if (t.stage === 'betting') {
      botBets(R);
      const humans = t.players.filter(p => activeHuman(R, p)), bettors = t.bettors();
      if (!humans.length) { R.betDeadline = null; R.arm = { key, sig, due: Infinity, live: () => true }; return; } // nobody at the table: wait
      const allReady = humans.every(p => p.bet.ready) && bettors.length;
      if (allReady) return set('bet', READY_MS, () => t.deal(), 'deal');
      if (R.settings.betSec > 0) { if (!R.betDeadline || R.betRound !== t.round) { R.betDeadline = Date.now() + R.settings.betSec * 1000; R.betRound = t.round; }
        return set('bet', Math.max(50, R.betDeadline - Date.now()), () => { if (t.bettors().length) t.deal(); else { R.betDeadline = Date.now() + R.settings.betSec * 1000; } }, 'betting clock'); }
      R.arm = { key, sig, due: Infinity, live: () => true }; return;
    }
    if (t.stage === 'insurance') {
      for (const b of t.boxes) { const s = R.seats[b.id] || {}; if (b.insurance === null && s.bot) t.insure(b.id, Bots.insurance(s.bot) && t.get(b.id).chips >= b.unit / 2); }
      if (t.stage !== 'insurance') return arm(R);
      const waiting = t.boxes.filter(b => b.insurance === null).map(b => t.get(b.id)), anyHere = waiting.some(p => activeHuman(R, p));
      const ms = anyHere ? INS_MS : Math.min(SITOUT_MS, INS_MS); R.turnDeadline = Date.now() + ms; R.turnMs = ms;
      return set('turn', ms, () => t.closeInsurance(), 'insurance clock');
    }
    if (t.stage === 'playing') {
      const c = t.cur(); if (!c) return; const s = R.seats[c.b.id] || {}, p = t.get(c.b.id);
      if (t.pendingCard) return set('step', SPLIT_MS, () => t.dealPending(), 'split card'); // next split hand gets its 2nd card a beat after the last one finished
      if (s.bot) return set('turn', BOT_MIN != null ? BOT_MIN : Bots.delayMs(), () => { const L = t.legal(p.id); if (!L) return; let a; try { a = Bots.decide(s.bot, c.h, t.dealer.cards[0], L); t.act(p.id, a); } catch (e) { R.botErrors = (R.botErrors || 0) + 1; console.warn('bj bot fallback', p.name, e.message, a); if (t.legal(p.id)) t.act(p.id, 'stand'); } }, 'bot turn');
      let ms = 0; if (s.sittingOut) ms = SITOUT_MS; else if (!s.sid) ms = (s.missed || 0) >= 2 ? Math.min(3000, AWAY_MS) : AWAY_MS; else if (R.settings.turnSec > 0) ms = R.settings.turnSec * 1000;
      if (!ms) { R.arm = { key, sig, due: Infinity, live: () => true }; return; }
      R.turnDeadline = Date.now() + ms; R.turnMs = ms;
      return set('turn', ms, () => { if (!t.legal(p.id)) return; if (!s.sid && !s.sittingOut) s.missed = (s.missed || 0) + 1; t.act(p.id, 'stand'); t.log[t.log.length - 1] += s.sittingOut || !s.sid ? ' (away)' : ' (time)'; }, 'turn timer');
    }
    if (t.stage === 'dealer') return set('step', DEALER_MS, () => t.dealerStep(), 'dealer');
    if (t.stage === 'settled') { R.nextRoundAt = Date.now() + RESULT_MS; return set('step', RESULT_MS, () => { if (!t.players.some(p => !p.out && !isBot(R, p.id))) t.finish(false); else t.next(); }, 'next round'); }
  }
  function after(R) { R.lastActive = Date.now(); R.lastChange = Date.now(); arm(R); broadcast(R); }
  function watchdog(R) {
    const t = R.table; if (R.paused || ['lobby', 'gameover'].includes(t.stage)) return;
    const a = R.arm, log = why => { R.watchdog = (R.watchdog || 0) + 1; console.warn(`[bj ${R.pin}] watchdog: ${why} (round ${t.round} ${t.stage})`); };
    if (!a || a.key !== tkey(t) || !a.live()) { log('no live timer - re-arming'); R.arm = null; return after(R); }
    if (a.due !== Infinity && Date.now() > a.due + 5000) { log('timer overdue - re-arming'); R.arm = null; return after(R); }
    if (a.due === Infinity && t.stage === 'betting') { const humans = t.players.filter(p => activeHuman(R, p)); if (humans.length && humans.every(p => p.bet.ready) && t.bettors().length) { log('everyone ready but no deal - re-arming'); R.arm = null; return after(R); } }
    if (t.stage === 'playing' && a.due === Infinity) { const c = t.cur(), s = c && R.seats[c.b.id]; if (s && s.sid && Date.now() - (R.lastChange || 0) > 20000 && Date.now() - (R.lastResend || 0) > 20000) { R.lastResend = Date.now(); nsp.to(s.sid).emit('state', { ...publicView(R), me: meView(R, c.b.id) }); } }
  }
  setInterval(() => { for (const pin in rooms) { const R = rooms[pin]; try { if (Date.now() - R.lastActive > 6 * 3600e3) { clearAll(R); delete rooms[pin]; continue; } watchdog(R); } catch (e) { console.error(`[bj ${pin}] watchdog error:`, e && e.stack || e); } } }, 1000);

  nsp.on('connection', s => {
    const hostRoom = () => { const R = rooms[s.data.hostPin]; return R && R.hostSid === s.id ? R : null; };
    const ok = (cb, x = {}) => typeof cb === 'function' && cb({ ok: 1, ...x }), err = (cb, e, code) => typeof cb === 'function' && cb(code ? { error: e, code } : { error: e });
    s.on('host:create', (o = {}, cb) => { if (!pwOk(o.pw)) return err(cb, 'Wrong host PIN'); let cs; try { cs = clampSettings(o); } catch (e) { return err(cb, e.message); } const R = createRoom(cs); R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R); });
    s.on('host:resume', (o = {}, cb) => { const R = rooms[o.pin]; if (!pwOk(o.pw) || !R) return err(cb, 'Game not found'); R.hostSid = s.id; s.data.hostPin = R.pin; ok(cb, { pin: R.pin }); broadcast(R); });
    const H = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = hostRoom(); if (!R) return err(cb, 'Not host'); try { fn(R, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
    H('host:settings', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Game already started'); R.settings = clampSettings(o); applySettings(R); });
    H('host:stats', (R, o) => { R.settings.stats = o.on != null ? !!o.on : !R.settings.stats; });
    H('host:start', R => { const t = R.table; if (t.stage !== 'lobby') throw new Error('Already started'); if (!t.players.some(p => !isBot(R, p.id))) throw new Error('Need at least one player');
      const bi = buyInInfo(R); if (bi.on && bi.unpaid > 0) throw new Error(`${bi.unpaid} player${bi.unpaid > 1 ? 's have' : ' has'} not been confirmed for the buy-in - confirm or remove them first`);
      R.buyInCount = bi.on ? bi.confirmed : 0; applySettings(R); t.startGame(); R.paused = false; R.betDeadline = null; });
    H('host:pause', (R, o) => { const want = o.paused != null ? !!o.paused : !R.paused; if (want === R.paused) return; R.paused = want; if (want) { const now = Date.now(), a = R.arm, t = R.table; // freeze: remember how much time was left on whatever clock was running
        R.frozen = { key: tkey(t), ms: a && a.key === tkey(t) && a.due !== Infinity && a.live() ? Math.max(0, a.due - now) : null, bet: t.stage === 'betting' && R.betDeadline ? Math.max(0, R.betDeadline - now) : null, turn: R.turnDeadline ? Math.max(0, R.turnDeadline - now) : null };
        clearAll(R); R.arm = null; R.turnDeadline = null; t.addLog('⏸ Game paused by host'); }
      else { const f = R.frozen || {}, t = R.table; R.frozen = null; R.arm = null; R.resume = f.key === tkey(t) ? { key: f.key, ms: f.ms } : null;
        if (t.stage === 'betting' && f.key === tkey(t) && f.bet != null) R.betDeadline = Date.now() + Math.max(1000, f.bet); else R.betDeadline = null;
        t.addLog('▶ Game resumed'); } });
    H('host:deal', R => { const t = R.table; if (R.paused) throw new Error('Game is paused - press Resume first'); if (t.stage === 'settled') { clear(R, 'step'); t.next(); return; } if (t.stage !== 'betting') throw new Error('Round in play'); t.deal(); });
    H('host:kick', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Only in the lobby'); const st = R.seats[o.id]; if (st && st.sid) nsp.to(st.sid).emit('kicked'); delete R.seats[o.id]; R.table.removePlayer(o.id); });
    H('host:end', R => { clearAll(R); R.arm = null; R.turnDeadline = null; R.paused = false; if (R.table.stage === 'lobby') throw new Error('Game not started'); if (R.table.stage !== 'gameover') R.table.endGame(); });
    H('host:addBot', (R, o) => { const t = R.table; if (t.stage !== 'lobby') throw new Error('Only in the lobby'); const lv = String(o.level || '').toLowerCase(); if (!Bots.LEVELS.includes(lv)) throw new Error('Pick Easy, Medium or Hard');
      if (Object.values(R.seats).filter(x => x.bot).length >= 5) throw new Error('Maximum 5 computer players'); if (t.players.length >= 7) throw new Error('Table is full (7 seats)');
      const name = Bots.pickName(lv, t.players.map(p => p.name)), id = 'b' + crypto.randomBytes(4).toString('hex'); t.addPlayer(id, name); R.seats[id] = { token: tok(), sid: null, sittingOut: false, bot: lv, mic: false, pay: 'bot' }; t.addLog(`🤖 ${name} (${lv}) sat down`); });
    H('host:confirm', (R, o) => { if (R.table.stage !== 'lobby') throw new Error('Only in the lobby'); const st = R.seats[o.id]; if (!st || !R.table.get(o.id)) throw new Error('No such player'); if (st.bot) throw new Error("Computer players don't pay a buy-in"); st.pay = o.on ? 'confirmed' : (st.pay === 'confirmed' ? 'pending' : st.pay); });
    H('host:playAgain', R => { if (R.table.stage !== 'gameover') throw new Error('Game not over'); R.table.resetForNewGame(); for (const k in R.seats) if (!R.seats[k].bot) R.seats[k].pay = 'none'; R.buyInCount = 0; R.paused = false; R.betDeadline = null; });
    s.on('host:rejoin', (o = {}, cb) => { const R = hostRoom(); if (!R) return err(cb, 'Not host'); const st = R.seats[o.id], p = R.table.get(o.id); if (!st || !p || st.bot) return err(cb, 'No such player');
      const code = crypto.randomBytes(6).toString('hex'), exp = Date.now() + 15 * 60000; st.rejoin = { code, exp }; st.rejoinOpenUntil = exp; ok(cb, { path: `/blackjack/j/${R.pin}?r=${code}`, name: p.name, connected: sockAlive(st.sid) }); });
    if (E.TEST_HOOKS === '1') s.on('test:loseTimers', (o, cb) => { const R = hostRoom(); if (R) { clearAll(R); } cb && cb({ ok: 1 }); });
    if (E.TEST_HOOKS === '1') s.on('test:rig', (o = {}, cb) => { const R = hostRoom(); if (R && Array.isArray(o.cards)) R.table.shoe.rigged = o.cards.map(String); cb && cb({ ok: 1 }); });
    // ---- players ----
    s.on('join', (o = {}, cb) => {
      const R = rooms[String(o.pin || '').trim()]; if (!R) return err(cb, 'Game not found - check the PIN'); const t = R.table;
      if (o.rejoin) { const id = Object.keys(R.seats).find(k => R.seats[k].rejoin && R.seats[k].rejoin.code === String(o.rejoin)); if (!id || R.seats[id].rejoin.exp < Date.now()) return err(cb, 'That reconnect link has expired - ask the host for a new one', 'rejoinExpired'); R.seats[id].rejoin = null; return bindSeat(R, id, true, cb, 'via host link'); }
      if (o.token) { const id = Object.keys(R.seats).find(k => R.seats[k].token === o.token); if (id) return bindSeat(R, id, false, cb); if (!o.name) return err(cb, 'Session expired - please join again', 'expired'); }
      if (o.reclaim) { const nm = String(o.name || '').trim().toLowerCase(), p = t.players.find(q => q.name.toLowerCase() === nm && !isBot(R, q.id)); if (!p) return err(cb, 'No seat with that name in this game', 'noSeat');
        const st = R.seats[p.id], allowed = st.rejoinOpenUntil && st.rejoinOpenUntil > Date.now();
        if (sockAlive(st.sid) && !allowed) return err(cb, `${p.name}'s seat is still connected on another screen. If it's you, ask the host to tap your seat and choose "Let ${p.name} rejoin".`, 'seatConnected');
        return bindSeat(R, p.id, true, cb, 'rejoined their seat'); }
      const name = String(o.name || '').replace(/\s+/g, ' ').trim().slice(0, 16); if (!name) return err(cb, 'Enter a nickname');
      const same = t.players.find(q => q.name.toLowerCase() === name.toLowerCase());
      if (t.stage !== 'lobby') return same && !isBot(R, same.id) ? err(cb, `There is already a seat for ${same.name} in this game`, 'canReclaim') : err(cb, 'This game has already started');
      if (same) return isBot(R, same.id) ? err(cb, 'Nickname taken') : err(cb, `${same.name} is already at this table`, 'canReclaim');
      if (t.players.length >= 7) return err(cb, 'Table is full (7 seats)');
      const id = 'p' + crypto.randomBytes(4).toString('hex'), token = tok(); t.addPlayer(id, name); R.seats[id] = { token, sid: s.id, sittingOut: false };
      s.data.pin = R.pin; s.data.pid = id; ok(cb, { token, id, name }); after(R);
    });
    function bindSeat(R, id, newToken, cb, how) {
      const st = R.seats[id], p = R.table.get(id); if (!st || !p) return err(cb, 'No such seat');
      if (st.sid && st.sid !== s.id) nsp.to(st.sid).emit('kicked', { soft: true, msg: 'Your seat was opened on another screen.' });
      const was = st.sid; if (newToken) st.token = tok();
      st.sid = s.id; st.mic = false; st.speaking = false; st.missed = 0; st.rejoinOpenUntil = 0; if (newToken) st.sittingOut = false; s.data.pin = R.pin; s.data.pid = id;
      if (was !== s.id) R.table.addLog(`${p.name} ${how || 'reconnected'}`);
      voiceUpdate(R, id); ok(cb, { token: st.token, id, name: p.name, pin: R.pin }); after(R);
    }
    s.on('seat:check', (o = {}, cb) => { const R = rooms[s.data.pin], id = s.data.pid, st = R && R.seats[id], bound = !!(st && st.sid === s.id); ok(cb, { bound, game: !!R }); if (bound && R.table.get(id)) s.emit('state', { ...publicView(R), me: meView(R, id) }); });
    const FROZEN = new Set(['bet:add', 'bet:clear', 'bet:rebet', 'bet:ready', 'insure', 'act']); // blocked while the host has the game paused
    const P = (ev, fn) => s.on(ev, (o = {}, cb) => { const R = rooms[s.data.pin], id = s.data.pid; if (!R || !R.seats[id] || R.seats[id].sid !== s.id) return err(cb, 'Not in a game', 'rebind'); if (R.paused && FROZEN.has(ev)) { err(cb, 'Paused by the host'); return broadcast(R); } try { fn(R, id, o || {}); ok(cb); } catch (e) { err(cb, e.message); } after(R); });
    P('bet:add', (R, id, o) => R.table.betAdd(id, o.spot === 'pog' ? 'pog' : 'main', o.chip));
    P('bet:clear', (R, id) => R.table.betClear(id));
    P('bet:rebet', (R, id, o) => R.table.rebet(id, o.x2 ? 2 : 1));
    P('bet:ready', (R, id, o) => R.table.betReady(id, o.on !== false));
    P('insure', (R, id, o) => R.table.insure(id, !!o.yes));
    P('act', (R, id, o) => { if (o.seq != null && +o.seq !== R.table.turnSeq) throw new Error('That hand already moved on'); R.table.act(id, String(o.action)); }); // seq = the exact decision the phone saw, so a double tap or a network retry can't spill onto the next split hand
    P('buyin:sent', (R, id, o) => { const st = R.seats[id]; if (!(R.settings.buyIn || {}).on) throw new Error('No buy-in for this game'); if (R.table.stage !== 'lobby') throw new Error('Game already started'); if (st.pay === 'confirmed') throw new Error('Already confirmed by the host'); st.pay = o.on ? 'pending' : 'none'; });
    P('sitout', (R, id, o) => { const st = R.seats[id]; st.sittingOut = !!o.on; R.table.addLog(`${R.table.get(id).name} ${st.sittingOut ? 'is sitting out' : 'is back'}`); });
    P('leave', (R, id) => { const t = R.table, p = t.get(id); if (t.stage === 'lobby') { delete R.seats[id]; t.removePlayer(id); t.addLog(`${p.name} left`); s.data.pin = null; return; }
      R.seats[id].sittingOut = true; R.seats[id].sid = null; R.seats[id].mic = false; t.addLog(`${p.name} left the table`); if (t.stage === 'betting' && !p.bet.ready) { p.bet.main = 0; p.bet.pog = 0; } if (t.legal(id)) t.act(id, 'stand'); });
    const seatOf = () => { const R = rooms[s.data.pin], id = s.data.pid; return R && R.seats[id] && R.seats[id].sid === s.id ? [R, id] : [null, null]; };
    s.on('mic', (o = {}, cb) => { const [R, id] = seatOf(); if (!R) return err(cb, 'Not in a game'); const st = R.seats[id]; st.mic = !!o.on; if (!st.mic) st.speaking = false; voiceUpdate(R, id); ok(cb, { peers: voicePeers(R, id) }); });
    s.on('speaking', (o = {}) => { const [R, id] = seatOf(); if (!R) return; const st = R.seats[id], v = !!o.on && !!st.mic; if (v !== !!st.speaking) { st.speaking = v; voiceUpdate(R, id); } });
    s.on('rtc', (m = {}) => { const [R, id] = seatOf(); if (!R || typeof m !== 'object' || id === m.to) return; const t = R.seats[m.to]; if (!t || !t.sid || JSON.stringify(m).length > 20000) return; nsp.to(t.sid).emit('rtc', { kind: String(m.kind), sdp: m.sdp, cand: m.cand, from: id }); });
    s.on('rtc:hello', () => { const [R, id] = seatOf(); if (!R) return; for (const k in R.seats) if (k !== id && R.seats[k].sid && R.seats[k].mic) nsp.to(R.seats[k].sid).emit('rtc:reset', { id }); });
    s.on('disconnect', () => { const R = rooms[s.data.pin]; if (R) { const st = R.seats[s.data.pid]; if (st && st.sid === s.id) { st.sid = null; st.mic = false; st.speaking = false; voiceUpdate(R, s.data.pid); after(R); } } const H2 = rooms[s.data.hostPin]; if (H2 && H2.hostSid === s.id) H2.hostSid = null; });
  });
  return { health: () => ({ rooms: Object.keys(rooms).length, watchdog: Object.values(rooms).reduce((a, R) => a + (R.watchdog || 0), 0), botErrors: Object.values(rooms).reduce((a, R) => a + (R.botErrors || 0), 0) }) };
};
