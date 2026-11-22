// Socket test: real chip denominations + making change (Nov 21 2026). Real client events only.
// Server: TEST_HOOKS=1 BJ_BOT_MS=150 BJ_DEALER_MS=120 BJ_RESULT_MS=400 BJ_READY_MS=100 BJ_INS_MS=1500 PORT=3472 node server.js
// node test/bj-chips.js http://localhost:3472
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3472', PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B + '/bj', { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { console.log(`  ${c ? '✓' : '✖ FAIL'} ${m}`); if (!c) fails++; };
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); } return false; };
const sum = r => 10000 * r[10000] + 2500 * r[2500] + 500 * r[500] + 250 * r[250];
const rk = r => [r[10000], r[2500], r[500], r[250]].join('/');
(async () => {
  const host = await conn(); let hs, bad = 0, seen = 0; host.on('state', x => { hs = x; for (const p of x.players) { seen++; if (!p.rack || sum(p.rack) !== p.chips) { bad++; if (bad < 4) console.log('    mismatch', p.name, x.stage, p.chips, p.rack); } } });
  const { pin } = await emit(host, 'host:create', { pw: PW, minBet: 5, betSec: 0, turnSec: 0, pog: true });
  const a = await conn(); let as; a.on('state', x => as = x); await emit(a, 'join', { pin, name: 'Ann' });
  const me = () => as.players.find(p => p.name === 'Ann');
  const r0 = await emit(a, 'chips:change', { op: 'break100' }); check(/not started/.test(r0.error || ''), 'no change in the lobby: ' + r0.error);
  await emit(host, 'host:addBot', { level: 'hard' }); await emit(host, 'host:addBot', { level: 'easy' }); await emit(host, 'host:start', {}); await waitFor(() => as && as.stage === 'betting');
  check(rk(me().rack) === '1/4/40/0', 'start rack: 1 × $100, 4 × $25, 40 × $5');
  await emit(a, 'bet:add', { spot: 'main', chip: 10000 }); const r1 = await emit(a, 'bet:add', { spot: 'main', chip: 10000 }); check(/Change/.test(r1.error || ''), 'second $100 refused with the Change hint: ' + r1.error);
  const r2 = await emit(a, 'chips:change', { op: 'break100' }); check(/no \$100/.test(r2.error || ''), "the $100 sitting in the betting circle can't be broken");
  await emit(a, 'bet:clear', {}); const r3 = await emit(a, 'chips:change', { op: 'break100' }); await waitFor(() => me().rack[10000] === 0);
  check(!r3.error && rk(me().rack) === '0/8/40/0' && me().chips === 40000, 'Break $100 → 4 × $25 (value still $400)');
  await emit(a, 'chips:change', { op: 'break25' }); await waitFor(() => me().rack[500] === 45); check(rk(me().rack) === '0/7/45/0', 'Break $25 → 5 × $5');
  check(hs.players.find(p => p.name === 'Ann').changing && /break25/.test(hs.players.find(p => p.name === 'Ann').changing.op), 'TV sees the change at Ann\'s seat');
  await emit(a, 'chips:change', { op: 'up5' }); await emit(a, 'chips:change', { op: 'up25' }); await waitFor(() => me().rack[10000] === 1); check(rk(me().rack) === '1/4/40/0', 'Color up 5 × $5 → $25 and 4 × $25 → $100');
  const r4 = await emit(a, 'chips:change', { op: 'up250' }); check(/2 × \$2.50/.test(r4.error || ''), 'trade pinks refused when you have none');
  const r5 = await emit(a, 'chips:change', { op: 'hack' }); check(/Unknown/.test(r5.error || ''), 'bad op rejected');
  await emit(host, 'host:pause', {}); const r6 = await emit(a, 'chips:change', { op: 'break100' }); check(/Paused/.test(r6.error || ''), 'change blocked while paused'); await emit(host, 'host:pause', {});
  // bet $25 with real chips, lose/win, then rebet when we have no $25s left -> dealer makes change
  await emit(a, 'bet:add', { spot: 'main', chip: 2500 }); await emit(a, 'bet:ready', {}); await waitFor(() => as.stage !== 'betting');
  for (let i = 0; i < 6 && !(as.stage === 'betting'); i++) { await waitFor(() => (as.me && as.me.legal) || as.me.canInsure || as.stage === 'betting', 20000); if (as.me.canInsure) await emit(a, 'insure', { yes: false }); else if (as.me.legal) await emit(a, 'act', { action: 'stand', seq: as.tseq }); }
  await waitFor(() => as.stage === 'betting', 20000);
  // force the "no $25 chips" situation by breaking every $25
  while (me().rack[2500] > 0) { await emit(a, 'chips:change', { op: 'break25' }); await sleep(30); }
  if (me().rack[10000] === 0) { /* lost the $100? fine */ }
  const before = me().chips; const rr = await emit(a, 'bet:rebet', {}); await sleep(150);
  check(!rr.error && me().bet.main === 2500 && me().chips === before, `Rebet $25 with no $25 chips works (${rk(me().rack)}; bet chips ${JSON.stringify(me().bet.mc)})`);
  check(as.log.some(l => /made change|Ann/.test(l)), 'log shows the dealer making change or the bet');
  // long run with bots: rack always equals the balance
  await emit(a, 'bet:ready', {}); let rounds = 0; const t0 = Date.now();
  while (rounds < 25 && Date.now() - t0 < 120000 && as.stage !== 'gameover') {
    if (as.stage === 'betting' && !me().out && !me().bet.ready) { const res = await emit(a, 'bet:rebet', {}); if (res.error) await emit(a, 'bet:add', { spot: 'main', chip: 500 }); await emit(a, 'bet:ready', {}); rounds++; }
    if (as.me && as.me.canInsure) await emit(a, 'insure', { yes: true });
    if (as.me && as.me.legal) { const L = as.me.legal; await emit(a, 'act', { action: L.canSplit ? 'split' : L.canDouble ? 'double' : L.total < 13 ? 'hit' : 'stand', seq: as.tseq }); }
    if (me().out) break; await sleep(60);
  }
  check(rounds >= 10, `played ${rounds} rounds with 2 computer players`); check(bad === 0, `rack always adds up to the balance (${seen} player snapshots, ${bad} mismatches)`);
  const bots = hs.players.filter(p => p.bot); check(bots.every(p => p.out || sum(p.rack) === p.chips), 'computer players kept real chips too: ' + bots.map(p => p.name + ' ' + rk(p.rack)).join(', '));
  await emit(host, 'host:end', {}); await waitFor(() => as.stage === 'gameover'); check(as.standings && as.standings.length === 3, 'leaderboard still works on total value');
  console.log(fails ? `\n${fails} FAILED` : '\nALL CHIP CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
