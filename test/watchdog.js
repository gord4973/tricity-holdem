// Watchdog: if a turn/next-hand timer is lost, the table restarts itself within a few seconds (no Pause/Resume needed).
// Server: TEST_HOOKS=1 BOT_MS=800 SHOWDOWN_MS=1500 FOLDWIN_MS=1500.  node test/watchdog.js <base>   (PWF = host PIN file, never printed)
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3464', PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const em = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✖ FAIL ') + m); if (!c) fails++; };
(async () => {
  const host = await conn(); const { pin } = await em(host, 'host:create', { pw: PW, levelMin: 10 }); let st; host.on('state', x => st = x);
  for (const lv of ['easy', 'medium', 'hard']) await em(host, 'host:addBot', { level: lv });
  await em(host, 'host:start', {}); let recovered = 0;
  for (let i = 0; i < 6; i++) {
    await sleep(400 + Math.random() * 600);
    const before = JSON.stringify([st.handNo, st.stage, st.toAct, st.pot, st.log.length]);
    await em(host, 'test:loseTimers', {}); const t0 = Date.now();
    while (Date.now() - t0 < 8000 && JSON.stringify([st.handNo, st.stage, st.toAct, st.pot, st.log.length]) === before) await sleep(100);
    const dt = Date.now() - t0; if (dt < 8000) recovered++; console.log(`    lost timers at ${before} -> table moved again after ${(dt / 1000).toFixed(1)}s`);
  }
  const hz = await (await fetch(B + '/healthz')).json();
  ok(recovered === 6, `table recovered by itself every time (${recovered}/6)`); ok(hz.watchdog > 0, 'watchdog fired and logged: ' + hz.watchdog);
  console.log(fails ? fails + ' FAILURES' : 'ALL WATCHDOG CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();
