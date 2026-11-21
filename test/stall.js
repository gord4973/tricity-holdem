// Regression: blind level-up while a bot/away/timer turn is pending must not freeze the table.
// Server: BOT_MS=2500 SHOWDOWN_MS=300 FOLDWIN_MS=300 AWAY_MS=8000 AWAY_FAST_MS=2000.  node test/stall.js <base> [seconds]   (PWF = host PIN file, never printed)
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3463', SECS = +process.argv[3] || 150, PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const em = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let fails = 0; const host = await conn(); const { pin } = await em(host, 'host:create', { pw: PW, levelMin: 1 }); let st; host.on('state', x => st = x);
  for (const lv of ['easy', 'medium', 'hard', 'easy', 'medium']) await em(host, 'host:addBot', { level: lv });
  // one human who checks/calls, one who drops and comes back, so away timers + reconnects happen too
  const mk = async name => { const s = await conn(); s.on('state', x => { if (x.me && x.me.legal && !s.idle) s.emit('act', { action: x.me.legal.canCheck ? 'check' : 'call' }, () => {}); }); const r = await em(s, 'join', { pin, name }); return { s, r }; };
  const a = await mk('Gord'); let b = await mk('Sam');
  await em(host, 'host:start', {}); const t0 = Date.now(); let last = '', since = Date.now(), maxGap = 0, levels = new Set(), games = 1, drops = 0;
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(250);
    const k = `${st.handNo}:${st.stage}:${st.toAct}:${st.pot}:${st.log.length}:${st.log.slice(-1)}`;
    if (k !== last) { last = k; since = Date.now(); } const gap = Date.now() - since; maxGap = Math.max(maxGap, gap);
    levels.add(st.level);
    if (gap > 20000) { fails++; console.log(`  ✖ STALL ${gap}ms at hand ${st.handNo} ${st.stage}, toAct ${(st.players.find(p => p.id === st.toAct) || {}).name}`); break; }
    if (st.stage === 'gameover') { await em(host, 'host:playAgain', {}); await em(host, 'host:start', {}); games++; }
    if (Math.random() < 0.01) { b.s.close(); drops++; await sleep(1500 + Math.random() * 4000); const s = await conn(); s.on('state', x => { if (x.me && x.me.legal) s.emit('act', { action: x.me.legal.canCheck ? 'check' : 'call' }, () => {}); }); await em(s, 'join', { pin, token: b.r.token }); b = { s, r: b.r }; }
    if (Math.random() < 0.004) { await em(host, 'host:pause', { paused: true }); await sleep(1500); await em(host, 'host:pause', { paused: false }); }
  }
  const hz = await (await fetch(B + '/healthz')).json();
  console.log(`  ran ${SECS}s: ${games} game(s), hand ${st.handNo}, blind levels seen ${[...levels].join(',')}, Sam dropped/rejoined ${drops}x, longest quiet gap ${(maxGap / 1000).toFixed(1)}s, bot fallbacks ${hz.botErrors}, watchdog ${hz.watchdog ?? 'n/a'}`);
  console.log(fails ? 'STALL FOUND' : 'NO STALLS'); process.exit(fails ? 1 : 0);
})();
