// Quick live check of final standings with 5 socket players who shove every hand, then a game ended by the host after 2 busts.
// node test/standings-live.js <base>   (PWF = host PIN file, never printed)
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2], PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B, { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✖ FAIL ') + m); if (!c) fails++; };
const fmt = x => x.standings.map(r => `${r.rank}.${r.name}(${r.chips}${r.out ? ',out#' + r.outHand : ''})`).join(' ');
const ordered = st => st.every((r, i) => !i || (st[i - 1].chips > 0 && r.chips === 0) || (r.chips > 0 ? st[i - 1].chips >= r.chips : st[i - 1].outHand >= r.outHand));
(async () => {
  const host = await conn(); const { pin } = await emit(host, 'host:create', { pw: PW, levelMin: 10 }); let st; host.on('state', x => st = x);
  const ps = []; for (let i = 0; i < 5; i++) { const s = await conn(); await emit(s, 'join', { pin, name: 'P' + i }); s.on('state', x => { if (x.me && x.me.legal && !s.stop) s.emit('act', { action: Math.random() < 0.25 ? 'allin' : (x.me.legal.canCheck ? 'check' : (Math.random() < 0.5 ? 'call' : 'fold')) }, () => {}); }); ps.push(s); }
  for (const mode of ['natural', 'ended']) {
    await emit(host, 'host:start', {}); const t0 = Date.now();
    while (Date.now() - t0 < 180000) { await sleep(200); if (st.stage === 'gameover') break; if (mode === 'ended' && st.players.filter(p => p.out).length >= 2 && st.stage === 'handover') { await emit(host, 'host:end', {}); await sleep(500); break; } }
    ok(st.stage === 'gameover', mode + ' game over: ' + fmt(st)); ok(ordered(st.standings), mode + ': chips first, then last-out highest');
    ok(st.standings.filter(r => r.out).every(r => r.outHand > 0), mode + ': elimination hand recorded for everyone out');
    await emit(host, 'host:playAgain', {}); await sleep(400);
  }
  ok(st.players.every(p => !p.out && p.chips === 120 && !p.outHand), 'Play again resets elimination data');
  console.log(fails ? fails + ' FAILURES' : 'ALL LIVE STANDINGS CHECKS PASSED'); process.exit(fails ? 1 : 0);
})();
