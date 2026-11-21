// Socket test for Free Bet Blackjack: full games with bots + humans, chip accounting every round, stats privacy,
// dealer hole card never leaked, rigged free double + Pot of Gold, disconnect/rejoin, pause/resume, watchdog, end + play again.
// Server: TEST_HOOKS=1 BJ_BOT_MS=150 BJ_DEALER_MS=120 BJ_RESULT_MS=400 BJ_READY_MS=100 BJ_AWAY_MS=2000 BJ_INS_MS=3000 PORT=3470 node server.js
// node test/bj-socket.js http://localhost:3470 [rounds]
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3470', ROUNDS = +process.argv[3] || 40, PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B + '/bj', { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { console.log(`  ${c ? '✓' : '✖ FAIL'} ${m}`); if (!c) fails++; };
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(50); } return false; };
function autoPlayer(s, name, opts = {}) {
  const P = { s, name, states: [], busy: false, paused: false, st: null }; s.on('connect', () => { P.busy = false; }); s.on('disconnect', () => { P.busy = false; });
  s.on('state', x => { P.st = x; P.states.push(x); if (P.paused || !x.me) return; const me = x.players.find(p => p.id === x.me.id); if (!me) return;
    const go = (ev, o) => { if (P.busy) return; P.busy = true; setTimeout(() => s.emit(ev, o, r => { P.busy = false; if (r && r.error && !/not your turn|closed|locked|No insurance/i.test(r.error)) console.log('   ', name, ev, r.error); }), 30); };
    if (x.stage === 'betting' && !me.out && !me.bet.ready) { if (me.bet.main < x.settings.minBet) return go('bet:add', { spot: 'main', chip: me.chips - me.bet.main - me.bet.pog >= 2500 && Math.random() < .3 ? 2500 : 500 }); if (opts.pog && !me.bet.pog && me.chips - me.bet.main >= 1000) return go('bet:add', { spot: 'pog', chip: 500 }); return go('bet:ready', {}); }
    if (x.me.canInsure) return go('insure', { yes: Math.random() < 0.3 });
    const L = x.me.legal; if (L) { const t = L.total; return go('act', { action: L.canSplit && L.splitFree ? 'split' : L.canDouble && L.doubleFree ? 'double' : L.canHit && (t < 12 || (t < 17 && !L.soft && Math.random() < .5) || (L.soft && t < 18)) ? 'hit' : 'stand' }); }
  }); return P;
}
(async () => {
  // ---------- 1. rigged round: free double + Pot of Gold paid through the sockets ----------
  if (!process.env.LIVE) {
    const host = await conn(); let hs; host.on('state', x => hs = x);
    const { pin } = await emit(host, 'host:create', { pw: PW, minBet: 10, betSec: 0, turnSec: 0 }); const a = await conn(); let as; a.on('state', x => as = x);
    await emit(a, 'join', { pin, name: 'Ann' }); await emit(host, 'host:start', {}); await waitFor(() => as && as.stage === 'betting');
    await emit(a, 'bet:add', { spot: 'main', chip: 500 }); await emit(a, 'bet:add', { spot: 'main', chip: 500 }); await emit(a, 'bet:add', { spot: 'pog', chip: 500 });
    const r1 = await emit(a, 'bet:add', { spot: 'pog', chip: 10000 }); check(r1.error, 'Pot of Gold max enforced: ' + r1.error);
    await emit(host, 'test:rig', { cards: ['5s', '9h', '6d', '7c', 'Th', 'Tc'] }); await emit(a, 'bet:ready', {});
    await waitFor(() => as.me && as.me.legal); const L = as.me.legal; check(L && L.canDouble && L.doubleFree, 'phone sees Double = FREE on 5+6');
    check(as.dealer.cards[1] === 'back' && hs.dealer.cards[1] === 'back', 'dealer hole card hidden from phone and TV');
    await emit(a, 'act', { action: 'double' }); await waitFor(() => as.stage === 'settled');
    const box = as.players[0].box; check(box.lammers === 1 && box.hands[0].freeDouble, 'gold lammer placed for the free double');
    check(as.result.dealer === 26 && box.hands[0].result === 'win', 'dealer busts 26, hand wins');
    check(box.net === 1000 + 1000 + 1500, `paid $10 + $10 on the free bet + Pot of Gold 3:1 = +$35 (got ${box.net / 100})`);
    check(as.players[0].chips === 40000 + 3500, 'balance $435');
    host.close(); a.close();
  }
  // ---------- 2. long game: 2 humans + 3 bots, stats toggled mid-game, disconnects, pauses, watchdog ----------
  const host = await conn(); let hs, hostStates = []; host.on('state', x => { hs = x; hostStates.push(x); });
  const { pin } = await emit(host, 'host:create', { pw: PW, minBet: 5, maxBet: 500, betSec: 15, turnSec: 0, pog: true, stats: false });
  for (const lv of ['hard', 'medium', 'easy']) await emit(host, 'host:addBot', { level: lv });
  const ann = autoPlayer(await conn(), 'Ann', { pog: true }), ben = autoPlayer(await conn(), 'Ben');
  const ja = await emit(ann.s, 'join', { pin, name: 'Ann' }), jb = await emit(ben.s, 'join', { pin, name: 'Ben' });
  const tooMany = await emit(host, 'host:addBot', { level: 'hard' }); check(!tooMany.error, '4th computer player added'); await emit(host, 'host:addBot', { level: 'hard' });
  check((await emit(host, 'host:addBot', { level: 'hard' })).error, 'max 5 computer players / 7 seats enforced');
  await emit(host, 'host:start', {});
  let last = '', lastChange = Date.now(), maxGap = 0, statsOn = false, round0 = {}, badAcct = 0, rounds = 0, holeLeak = 0, dropped = 0, pauses = 0, lostTimers = 0;
  const t0 = Date.now();
  while (hs.stage !== 'gameover' && rounds < ROUNDS && Date.now() - t0 < 600000) {
    await sleep(100); const k = hs.seq + ':' + hs.stage + ':' + hs.round; if (k !== last) { last = k; maxGap = Math.max(maxGap, Date.now() - lastChange); lastChange = Date.now(); }
    if (hs.paused) lastChange = Date.now();
    if (Date.now() - lastChange > (hs.stage === 'betting' ? hs.settings.betSec * 1000 + 3000 : 9000)) { check(false, `stall at round ${hs.round} ${hs.stage} turn=${JSON.stringify(hs.turn)}`); break; }
    if (hs.stage === 'betting' && round0.r !== hs.round) { round0 = { r: hs.round, chips: Object.fromEntries(hs.players.map(p => [p.id, p.chips])) }; }
    if (hs.stage === 'settled' && round0.r === hs.round && !round0.done) { round0.done = true; rounds++;
      for (const p of hs.players) if (p.box && p.chips - round0.chips[p.id] !== p.box.net) { badAcct++; console.log('   acct', p.name, p.chips, round0.chips[p.id], p.box.net); }
      if (rounds === 6 && !statsOn) { statsOn = true; await emit(host, 'host:stats', { on: true }); }
      if (rounds % 7 === 3) { ben.paused = true; ben.s.disconnect(); dropped++; setTimeout(async () => { ben.s.connect(); await new Promise(r => ben.s.once('connect', r)); await emit(ben.s, 'join', { pin, token: jb.token }); ben.paused = false; }, 4000); }
      if (rounds % 9 === 5) { await emit(host, 'host:pause', {}); pauses++; await sleep(1500); await emit(host, 'host:pause', {}); }
      if (rounds % 11 === 8 && !process.env.LIVE) { await emit(host, 'test:loseTimers', {}); lostTimers++; }
    }
  }
  for (const x of hostStates) if (['insurance', 'playing'].includes(x.stage) && !(x.dealer.cards.length === 2 && x.dealer.cards[1] === 'back')) holeLeak++;
  for (const x of ann.states.concat(ben.states)) if (['insurance', 'playing'].includes(x.stage) && x.dealer.cards[1] !== 'back') holeLeak++;
  check(rounds >= Math.min(ROUNDS, 10), `played ${rounds} rounds, longest quiet gap ${(maxGap / 1000).toFixed(1)}s, Ben dropped/rejoined ${dropped}x, ${pauses} pauses, ${lostTimers} lost-timer drills`);
  check(!badAcct, `chip change = net result for every player every round (${badAcct} bad)`);
  check(!holeLeak, 'dealer hole card never sent before the dealer plays');
  const preStats = ann.states.filter(x => x.round < 6 && x.me && x.me.stats); check(!preStats.length, 'no stats while Stats is off');
  const withStats = ann.states.filter(x => x.me && x.me.stats), recs = withStats.filter(x => x.me.stats.rec && x.me.legal);
  check(withStats.length > 0 && recs.length > 0, `Ann gets stats once on (${withStats.length} states, ${recs.length} with a recommendation, e.g. "${recs[0] && recs[0].me.stats.rec}", bust if hit ${recs[0] && recs[0].me.stats.bust}%, dealer busts ${recs[0] && recs[0].me.stats.dealerBust}%)`);
  check(withStats.every(x => { const b = x.players.find(p => p.id === x.me.id).box; return b && x.me.stats.hands.length === b.hands.length; }), 'stats always describe the owner\'s own hands');
  check(hostStates.every(x => !x.me), 'host screen never gets a private view');
  const hz = await (await fetch(B + '/healthz')).json(); check(lostTimers === 0 || hz.blackjack.watchdog > 0, `watchdog recovered lost timers (count ${hz.blackjack.watchdog})`); check(!hz.blackjack.botErrors, 'no bot errors');
  if (hs.stage !== 'gameover') { await emit(host, 'host:end', {}); await waitFor(() => hs.stage === 'gameover'); }
  check(hs.stage === 'gameover' && hs.standings && hs.standings.length === 7, 'host ended the game: standings for all 7 seats');
  const st = hs.standings; check(st.every((r, i) => !i || (st[i - 1].out ? r.out && r.outHand <= st[i - 1].outHand : r.out || r.chips <= st[i - 1].chips)), 'standings: chips first, then by when they went out');
  await emit(host, 'host:playAgain', {}); await waitFor(() => hs.stage === 'lobby'); check(hs.stage === 'lobby' && hs.settings.stats === true && hs.players.every(p => p.chips === 40000), 'Play again: back to $400, Stats setting kept');
  console.log(fails ? fails + ' FAILURES' : 'ALL BLACKJACK SOCKET CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
