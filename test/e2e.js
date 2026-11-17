// End-to-end multi-client test: node test/e2e.js <baseUrl>   (host PIN read from $PWF file, never printed)
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3460';
const PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let drops = 0;
const conn = () => new Promise((res, rej) => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => { res(s); s.on('connect', () => s.emit(s._hostPin ? 'host:resume' : 'join', s._hostPin ? { pw: PW, pin: s._hostPin } : { pin: s._pin, token: s._token }, () => {})); }); s.on('disconnect', why => { if (why !== 'io client disconnect') { drops++; console.log('  (socket dropped: ' + why + ', auto-reconnecting)'); } }); s.once('connect_error', rej); });
const emit = (s, ev, o) => new Promise(r => s.emit(ev, o, r));
const CARD = /"[2-9TJQKA][shdc]"/;
let fails = 0; const check = (c, msg) => { if (!c) { fails++; console.log('  ✖ FAIL:', msg); } };
const inHand = st => ['preflop', 'flop', 'turn', 'river'].includes(st.stage);

async function game({ n, label, strategy, settings = {}, maxHands = 200, levelEvery = 6, extra }) {
  console.log(`\n=== ${label}: ${n} players ===`);
  const host = await conn();
  const c = await emit(host, 'host:create', { pw: PW, levelMin: 10, turnSec: 0, ...settings }); check(c.ok, 'create ' + JSON.stringify(c));
  const pin = c.pin; host._hostPin = pin; let hstate = null, hands = 0, sidePotHands = 0, splitHands = 0, showdowns = 0, maxPots = 0, levelsSeen = new Set();
  const done = new Promise(res => {
    host.on('state', st => {
      hstate = st;
      // host never sees hole cards during a hand
      if (inHand(st)) { check(!CARD.test(JSON.stringify(st.players)), 'host saw hole cards in hand'); check(st.result === null, 'result during hand'); }
      levelsSeen.add(st.blinds.join('/'));
      const total = st.players.reduce((a, p) => a + p.chips, 0) + (inHand(st) ? st.pot : 0);
      if (st.stage !== 'lobby') check(total === n * 120, `chip total ${total} != ${n * 120} (stage ${st.stage})`);
      if ((st.stage === 'handover' || st.stage === 'gameover') && st.result) {
        const key = 'h' + st.handNo; if (!game[key + pin]) {
          game[key + pin] = 1; hands++;
          const r = st.result, real = r.pots.filter(p => !p.uncalled);
          if (real.length > 1) sidePotHands++; if (real.some(p => p.winners.length > 1)) splitHands++; if (!r.byFold) showdowns++; maxPots = Math.max(maxPots, real.length);
          if (!r.byFold) check(r.shown.every(s => s.hole.length === 2 && s.hand), 'showdown reveal');
          if (hands % levelEvery === 0) host.emit('host:nextLevel', {}, () => {});
          if (st.stage === 'gameover') return res('gameover');
          if (hands >= maxHands) return res('maxhands');
          setTimeout(() => host.emit('host:deal', {}, () => {}), 30);
        }
      }
      if (st.stage === 'gameover') res('gameover');
    });
  });
  const ps = [];
  for (let i = 0; i < n; i++) {
    const s = await conn(); const r = await emit(s, 'join', { pin, name: `${label[0]}${i}` }); check(r.ok, 'join ' + i + ' ' + JSON.stringify(r));
    s._pin = pin; s._token = r.token; const P = { s, i, token: r.token, id: r.id, last: '', holeByHand: {} }; ps.push(P); bindBot(P, strategy, n);
  }
  if (n === 20) { const s = await conn(); const r = await emit(s, 'join', { pin, name: 'TwentyFirst' }); check(r.error && /full/i.test(r.error), '21st player must be rejected: ' + JSON.stringify(r)); s.close(); }
  const st0 = await emit(host, 'host:start', {}); check(st0.ok, 'start');
  const late = await conn(); const lr = await emit(late, 'join', { pin, name: 'Late' }); check(lr.error, 'late join rejected'); late.close();
  if (extra) await extra({ host, ps, pin, get st() { return hstate; } });
  let lastLog = ''; const wd = setInterval(() => { const k = hstate && hstate.seq; if (k === lastLog && !wd.s) { wd.s = 1; console.log('  STALL', JSON.stringify({ stage: hstate.stage, toAct: hstate.toAct, paused: hstate.paused, dl: hstate.turnDeadline, log: hstate.log.slice(-5), p: hstate.players.map(p => [p.name, p.chips, p.bet, p.folded, p.allIn, p.connected, p.sittingOut]) })); } lastLog = k; }, 20000);
  const t0 = Date.now(); const how = await done; clearInterval(wd);
  console.log(`  finished by ${how} after ${hands} hands in ${((Date.now() - t0) / 1000).toFixed(0)}s; showdowns ${showdowns}, side-pot hands ${sidePotHands} (max ${maxPots} pots), split pots ${splitHands}`);
  console.log(`  blind levels seen: ${[...levelsSeen].join(', ')}`);
  if (how === 'gameover') { check(hstate.players.filter(p => p.chips > 0).length === 1, 'one winner'); console.log(`  winner: ${hstate.winner}`); }
  host.close(); ps.forEach(p => p.s.close());
  return { hands, sidePotHands, showdowns, splitHands };
}
function bindBot(P, strategy, n) {
  P.s.on('state', st => {
    P.st = st; if (!st.me) return;
    if (inHand(st)) {
      check(st.me.hole.length === 2 || st.players.find(p => p.id === P.id).out, 'own hole cards');
      // no other player's cards anywhere in my state during a hand
      const others = JSON.stringify({ players: st.players, result: st.result });
      check(!CARD.test(others), `player ${P.i} saw other cards`);
      const h = P.holeByHand[st.handNo]; if (h && st.me.hole.length) check(h === st.me.hole.join(), 'hole cards stable'); else P.holeByHand[st.handNo] = st.me.hole.join();
    }
    const L = st.me.legal; if (!L || P.paused) return;
    const key = st.handNo + ':' + st.stage + ':' + st.currentBet + ':' + st.me.legal.bet; if (P.last === key) return; P.last = key;
    const [a, amt] = strategy(P, st, L);
    setTimeout(() => P.s.emit('act', { action: a, amount: amt }, r => { if (r.error) { check(false, `act ${a} ${amt} -> ${r.error}`); P.s.emit('act', { action: L.canCheck ? 'check' : 'fold' }, () => {}); } }), 5);
  });
}
const mixed = (P, st, L) => {
  const r = Math.random();
  if (L.toCall > 0.3 * L.chips && r < 0.6) return ['fold'];
  if (!L.canCheck && r < 0.25) return ['fold'];
  if (L.canRaise && r < 0.40) return [L.isBet ? 'bet' : 'raise', Math.min(L.maxTo, L.minTo + Math.floor(Math.random() * 10))];
  if (L.canRaise && r < 0.47) { const half = st.currentBet + Math.floor((st.pot + L.toCall) / 2); return [L.isBet ? 'bet' : 'raise', Math.max(L.minTo, Math.min(L.maxTo, half))]; }
  if (r < 0.43) return ['allin'];
  return [L.canCheck ? 'check' : 'call'];
};
const shove = (P, st, L) => { const r = Math.random(); return r < 0.35 ? ['allin'] : r < 0.8 ? [L.canCheck ? 'check' : 'call'] : [L.canCheck ? 'check' : 'fold']; };
const callStation = (P, st, L) => [L.canCheck ? 'check' : 'call'];

(async () => {
  const t0 = Date.now();
  const r1 = await game({ n: 20, label: 'Twenty', strategy: mixed, levelEvery: 5, maxHands: 120, extra: async ({ ps, host }) => {
    // reconnect test: player 3 drops and comes back with the same seat & cards
    await sleep(1500); const P = ps[3]; const before = P.st && P.st.me && P.st.me.hole.join(); const hand = P.st && P.st.handNo;
    P.s.close(); await sleep(800);
    const s = await conn(); P.s = s; bindBot(P, mixed, 20);
    s._pin = P.st.pin; s._token = P.token; const r = await emit(s, 'join', { pin: P.st.pin, token: P.token }); check(r.ok && r.id === P.id, 'reconnect same seat ' + JSON.stringify(r));
    await sleep(500); if (P.st.handNo === hand && P.st.me.hole.length) check(P.st.me.hole.join() === before, 'same hole cards after reconnect');
    console.log('  reconnect: OK (same seat' + (P.st.handNo === hand ? ', same hole cards' : '') + ')');
    // leaving player: auto-folds and blinds out
    await emit(ps[7].s, 'leave', {}); console.log('  player 7 left the table (auto-fold / sit out)');
    // pause / resume
    const pz = await emit(host, 'host:pause', {}); check(pz.ok, 'pause'); await sleep(300); const pr = await emit(host, 'host:pause', {}); check(pr.ok, 'resume');
  } });
  let sp = 0; for (let k = 0; k < 5 && !sp; k++) sp += (await game({ n: 6, label: 'Shove', strategy: shove, maxHands: 60, levelEvery: 100 })).sidePotHands;
  check(sp > 0, 'all-in games should produce side pots');
  const r3 = await game({ n: 2, label: 'HeadsUp', strategy: mixed, maxHands: 80, levelEvery: 4 });
  // away/turn-timer test: one player disconnects and never returns -> auto check/fold
  await game({ n: 3, label: 'Away', strategy: callStation, maxHands: 3, levelEvery: 100, extra: async ({ ps }) => { ps[1].paused = true; ps[1].s.close(); console.log('  player 1 disconnected for good (should auto-act after ~12s)'); } });
  // turn timer: connected player who never acts is auto-checked/folded after the host's 15s timer
  await game({ n: 2, label: 'Timer15s', strategy: callStation, settings: { turnSec: 15 }, maxHands: 2, levelEvery: 100, extra: async ({ ps }) => { ps[0].paused = true; console.log('  player 0 is connected but idle (15s turn timer)'); } });
  if (process.env.ONLY_TIMER) {}
  console.log(`  socket drops during run: ${drops}`);
  console.log(`\nE2E done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${fails ? fails + ' FAILURES' : 'ALL CHECKS PASSED'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
