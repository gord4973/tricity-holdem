// Live/socket test for host "Stats on": stats only when on, only in the owner's private view, from the owner's own cards,
// updated every street and on folds, hidden after folding, toggled mid-game, kept for Play Again, bots unaffected.
// Local: BOT_MS=300 SHOWDOWN_MS=600 FOLDWIN_MS=300 PORT=3465 node server.js ; node test/stats.js http://localhost:3465
const { io } = require('socket.io-client'), fs = require('fs'), S = require('../stats');
const B = process.argv[2] || 'http://localhost:3465', PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { console.log(`  ${c ? '✓' : '✖ FAIL'} ${m}`); if (!c) fails++; };
(async () => {
  const host = await conn(); let hs; host.on('state', x => hs = x);
  const c = await emit(host, 'host:create', { pw: PW, levelMin: 30, stats: false }); const pin = c.pin;
  for (const lv of ['easy', 'medium']) await emit(host, 'host:addBot', { level: lv });
  const log = { Ann: [], Ben: [] }, socks = {}; let phase = 'off', annFoldHand = 0;
  for (const name of ['Ann', 'Ben']) {
    const s = await conn(); socks[name] = s;
    s.on('state', x => { log[name].push({ phase, x });
      if (!x.me || !x.me.legal) return;
      // Ann folds pre-flop on her first turn once stats are on (and on hands divisible by 4), so we can check stats disappear after a fold
      const fold = name === 'Ann' && phase === 'on' && x.stage === 'preflop' && (!annFoldHand || x.handNo % 4 === 0);
      if (fold) annFoldHand = x.handNo;
      setTimeout(() => s.emit('act', { action: fold ? 'fold' : x.me.legal.canCheck ? 'check' : 'call' }, () => {}), 60); });
    await emit(s, 'join', { pin, name });
  }
  await sleep(300); check(hs && hs.settings && hs.settings.stats === false, 'lobby: stats off by default when unticked');
  await emit(host, 'host:start', {}); await sleep(5000);
  check(log.Ann.concat(log.Ben).every(e => !e.x.me || !('stats' in e.x.me)), 'stats OFF: no stats sent to any phone');
  phase = 'on'; await emit(host, 'host:stats', { on: true }); await sleep(300);
  check(hs.settings.stats === true, 'host toggled Stats ON mid-game');
  await sleep(40000); phase = 'off2'; await emit(host, 'host:stats', { on: false }); await sleep(400); const cut = { Ann: log.Ann.length, Ben: log.Ben.length }; await sleep(4000);
  const on = n => log[n].filter(e => e.phase === 'on' && e.x.me);
  for (const n of ['Ann', 'Ben']) {
    const withStats = on(n).filter(e => e.x.me.stats), streets = new Set(withStats.filter(e => e.x.me.stats.eq != null).map(e => e.x.me.stats.street));
    check(withStats.length > 10, `${n}: received stats (${withStats.length} states)`);
    check(['preflop', 'flop', 'turn', 'river'].every(s => streets.has(s)), `${n}: odds shown on every street (${[...streets].join(', ')})`);
    let badDesc = 0, badOpp = 0, badEq = 0, badKeys = 0, leak = 0;
    for (const { x } of withStats) { const st = x.me.stats, d = S.describe(x.me.hole, x.board);
      if (st.hand !== d.hand || st.draw !== d.draw) badDesc++;
      const opps = x.players.filter(p => p.id !== x.me.id && !p.folded && !p.out && p.hasCards).length; if (st.opps !== opps) badOpp++;
      if (st.eq != null && !(st.eq >= 0 && st.eq <= 100)) badEq++;
      if (Object.keys(st).some(k => !['hand', 'draw', 'opps', 'street', 'eq', 'hint'].includes(k))) badKeys++;
      if (x.players.some(p => p.hole || (p.shown && !['handover', 'gameover', 'showdown'].includes(x.stage)))) leak++; }
    check(!badDesc, `${n}: best-hand text always matches own cards + board (${badDesc} bad)`);
    check(!badOpp, `${n}: opponent count matches players still in (${badOpp} bad)`);
    check(!badEq && !badKeys, `${n}: odds 0-100% and stats carry no extra data`);
    check(!leak, `${n}: no other player's hole cards in any in-hand state`);
    const wrong = on(n).filter(e => e.x.me.stats && (e.x.me.stats.hand !== S.describe(e.x.me.hole, e.x.board).hand)); check(!wrong.length, `${n}: stats are always for the owner's own hand`);
    const pre = withStats.filter(e => e.x.stage === 'preflop' && e.x.me.stats.eq != null).map(e => e.x.me.stats.eq);
    check(pre.length > 0, `${n}: pre-flop odds e.g. ${pre[0]}% (${withStats.find(e => e.x.stage === 'preflop').x.me.stats.hand})`);
  }
  // opponent-count changes on a fold must refresh odds
  const oppChange = on('Ben').some((e, i, a) => i && e.x.me.stats && a[i - 1].x.me.stats && e.x.handNo === a[i - 1].x.handNo && e.x.board.length === a[i - 1].x.board.length && e.x.me.stats.opps < a[i - 1].x.me.stats.opps);
  check(oppChange, 'Ben: odds recalculated when an opponent folded mid-street');
  const afterFold = on('Ann').filter(e => e.x.handNo === annFoldHand && e.x.me.hole.length && e.x.players.find(p => p.id === e.x.me.id).folded && ['preflop', 'flop', 'turn', 'river'].includes(e.x.stage));
  check(annFoldHand && afterFold.length && afterFold.every(e => !e.x.me.stats), `Ann: stats hidden after folding (hand #${annFoldHand}, ${afterFold.length} states)`);
  check(on('Ann').filter(e => !['preflop', 'flop', 'turn', 'river'].includes(e.x.stage)).every(e => !e.x.me.stats), 'no stats between hands');
  check(log.Ann.slice(cut.Ann).concat(log.Ben.slice(cut.Ben)).every(e => !e.x.me || !e.x.me.stats), 'stats OFF again: phones stop getting stats');
  check(true, 'host screen never gets a private view'); if (hs.me) { fails++; console.log('  ✖ FAIL host got me'); }
  // persistence for Play Again
  await emit(host, 'host:stats', { on: true }); await emit(host, 'host:end', {}); await sleep(500); await emit(host, 'host:playAgain', {}); await sleep(500);
  check(hs.stage === 'lobby' && hs.settings.stats === true, 'Stats setting kept for Play Again');
  const hz = await (await fetch(B + '/healthz')).json(); check(!hz.botErrors, 'computer players unaffected (0 bot errors)');
  console.log(fails ? fails + ' FAILURES' : 'ALL STATS CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();
