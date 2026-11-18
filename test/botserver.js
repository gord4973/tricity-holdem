// Server-level stall test: 1 socket human (check/call) + 5 bots play a whole game fast. Run against a server started with
// BOT_MS=20 SHOWDOWN_MS=150 FOLDWIN_MS=100.  node test/botserver.js <base> [games]
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3461', G = +process.argv[3] || 3, PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r));
(async () => {
  let fails = 0; const host = await conn(); const c = await emit(host, 'host:create', { pw: PW, levelMin: 1 }); const pin = c.pin;
  for (const lv of ['easy', 'medium', 'hard', 'hard', 'medium']) await emit(host, 'host:addBot', { level: lv });
  const me = await conn(); await emit(me, 'join', { pin, name: 'Gord' });
  me.on('state', x => { if (x.me && x.me.legal) me.emit('act', { action: x.me.legal.canCheck ? 'check' : 'call' }, () => {}); });
  let st; host.on('state', x => st = x);
  for (let g = 1; g <= G; g++) {
    await emit(host, 'host:start', {}); const t0 = Date.now(); let last = '', lastChange = Date.now();
    while (st.stage !== 'gameover') { await new Promise(r => setTimeout(r, 200)); const k = st.seq + ':' + st.log.length + st.log.slice(-1); if (k !== last) { last = k; lastChange = Date.now(); }
      if (Date.now() - lastChange > 8000) { console.log('  ✖ FAIL stall', st.stage, st.toAct); fails++; break; }
      if (st.handNo % 15 === 0 && st.stage === 'handover') await emit(host, 'host:nextLevel', {}); }
    console.log(`  game ${g}: ${st.handNo} hands in ${((Date.now() - t0) / 1000).toFixed(0)}s, winner ${st.winner}`);
    await emit(host, 'host:playAgain', {});
  }
  const hz = await (await fetch(B + '/healthz')).json(); if (hz.botErrors) { fails++; console.log('  ✖ FAIL bot fallbacks', hz.botErrors); }
  console.log(fails ? fails + ' FAILURES' : 'ALL BOT SERVER CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();
