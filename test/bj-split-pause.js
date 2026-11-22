// Regression test (Nov 21 2026): split hands play one at a time, and host Pause/Resume freezes every phase.
// Server: TEST_HOOKS=1 BJ_BOT_MS=600 BJ_DEALER_MS=400 BJ_RESULT_MS=1500 BJ_READY_MS=100 BJ_INS_MS=3000 BJ_SPLIT_MS=700 PORT=3472 node server.js
// node test/bj-split-pause.js http://localhost:3472
const { io } = require('socket.io-client'), fs = require('fs');
const B = process.argv[2] || 'http://localhost:3472', PW = fs.readFileSync(process.env.PWF || 'data/host_password.txt', 'utf8').trim();
const conn = () => new Promise(r => { const s = io(B + '/bj', { transports: ['websocket'], forceNew: true }); s.once('connect', () => r(s)); });
const emit = (s, e, o) => new Promise(r => s.emit(e, o, r)), sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { console.log(`  ${c ? '✓' : '✖ FAIL'} ${m}`); if (!c) fails++; };
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); } return false; };
const hands = x => (x.players.find(p => p.name === 'Ann').box || { hands: [] }).hands.map(h => h.cards.join(','));
// invariant over every broadcast: from one state to the next, at most ONE hand in a box gains cards
function simulCheck(states) { let bad = 0; for (let i = 1; i < states.length; i++) { const a = states[i - 1], b = states[i]; if (a.round !== b.round) continue;
  for (const p of b.players) { const pa = a.players.find(q => q.id === p.id); if (!p.box || !pa || !pa.box) continue; let grew = 0; p.box.hands.forEach((h, k) => { const o = pa.box.hands[k]; if (o && h.cards.length > o.cards.length && !(k === 0 && pa.box.hands.length < p.box.hands.length)) grew++; }); if (grew > 1) bad++; } } return bad; }
async function table(opts) {
  const host = await conn(); const H = { s: host, st: null, all: [] }; host.on('state', x => { H.st = x; H.all.push(x); });
  const { pin } = await emit(host, 'host:create', { pw: PW, minBet: 5, betSec: 0, turnSec: 0, ...opts }); const a = await conn(); const A = { s: a, st: null, all: [] }; a.on('state', x => { A.st = x; A.at = Date.now(); A.all.push(x); });
  await emit(a, 'join', { pin, name: 'Ann' }); return { H, A, pin };
}
const bet = async (A, H, rig) => { await waitFor(() => A.st && A.st.stage === 'betting'); await emit(A.s, 'bet:add', { spot: 'main', chip: 2500 }); if (rig) await emit(H.s, 'test:rig', { cards: rig }); return emit(A.s, 'bet:ready', {}); };
(async () => {
  console.log('1. split 8s: hand 1 then hand 2, via real phone events');
  { const { H, A } = await table({}); await emit(H.s, 'host:start', {});
    await bet(A, H, ['8s', '6h', '8d', 'Tc', /*h1*/ '2c', '3d', '4h', /*h2*/ '5s', '6s', '2d', /*dealer*/ 'Th']);
    await waitFor(() => A.st.me && A.st.me.legal); check(A.st.me.legal.canSplit && A.st.me.legal.splitFree, 'phone offers FREE split on 8-8');
    await emit(A.s, 'act', { action: 'split', seq: A.st.tseq }); await waitFor(() => hands(A.st).length === 2);
    check(JSON.stringify(hands(A.st)) === '["8s,2c","8d"]', 'after split: hand 1 = 8,2 (playing), hand 2 = 8 waiting ' + JSON.stringify(hands(A.st)));
    check(A.st.turn.hand === 0 && A.st.turn.of === 2, 'turn is hand 1 of 2');
    const seq0 = A.st.tseq; await emit(A.s, 'act', { action: 'hit', seq: seq0 }); await waitFor(() => hands(A.st)[0].split(',').length === 3);
    check(JSON.stringify(hands(A.st)) === '["8s,2c,3d","8d"]', 'hit #1 only touches hand 1 ' + JSON.stringify(hands(A.st)));
    const dup = await emit(A.s, 'act', { action: 'hit', seq: seq0 }); await sleep(150); check(dup.error && JSON.stringify(hands(A.st)) === '["8s,2c,3d","8d"]', 'a duplicate tap / network retry of the same Hit is ignored: ' + (dup.error || 'ACCEPTED'));
    await emit(A.s, 'act', { action: 'hit', seq: A.st.tseq }); await waitFor(() => hands(A.st)[0].split(',').length === 4);
    check(JSON.stringify(hands(A.st)) === '["8s,2c,3d,4h","8d"]', 'hit #2 only touches hand 1 ' + JSON.stringify(hands(A.st)));
    await emit(A.s, 'act', { action: 'stand', seq: A.st.tseq }); await waitFor(() => A.st.turn && A.st.turn.hand === 1);
    check(hands(A.st)[1] === '8d' && A.st.turn.pending && !A.st.me.legal, 'standing on hand 1 moves to hand 2, which then gets its 2nd card a beat later');
    await waitFor(() => A.st.me && A.st.me.legal); check(JSON.stringify(hands(A.st)) === '["8s,2c,3d,4h","8d,5s"]' && A.st.me.legal.hand === 1, 'hand 2 dealt 8,5 and is now live ' + JSON.stringify(hands(A.st)));
    await emit(A.s, 'act', { action: 'hit', seq: A.st.tseq }); await waitFor(() => hands(A.st)[1].split(',').length === 3);
    check(JSON.stringify(hands(A.st)) === '["8s,2c,3d,4h","8d,5s,6s"]', 'hit on hand 2 only touches hand 2 ' + JSON.stringify(hands(A.st)));
    await emit(A.s, 'act', { action: 'stand', seq: A.st.tseq }); await waitFor(() => A.st.stage === 'settled');
    check(A.st.players[0].box.hands.every(h => h.result), 'both hands settled separately: ' + A.st.players[0].box.hands.map(h => h.label + ' ' + h.result).join(' / '));
    check(simulCheck(A.all) === 0 && simulCheck(H.all) === 0, 'no broadcast ever showed two hands gaining cards at once (phone + TV)');
    // split with a free double on hand 1 (the common case Gord hit: double ends hand 1, hand 2 used to get its card in the same instant)
    await waitFor(() => A.st.stage === 'betting'); const before = A.all.length;
    await bet(A, H, ['8s', '6h', '8d', 'Tc', /*h1*/ '3c', /*dbl*/ '9d', /*h2*/ '2h', '7s', /*dealer*/ 'Th']);
    await waitFor(() => A.st.me && A.st.me.legal); await emit(A.s, 'act', { action: 'split', seq: A.st.tseq }); await waitFor(() => A.st.me && A.st.me.legal && A.st.me.legal.doubleFree);
    await emit(A.s, 'act', { action: 'double', seq: A.st.tseq }); await sleep(120);
    check(JSON.stringify(hands(A.st)) === '["8s,3c,9d","8d"]', 'free double on hand 1 does NOT deal hand 2 in the same move ' + JSON.stringify(hands(A.st)));
    await waitFor(() => A.st.me && A.st.me.legal); check(JSON.stringify(hands(A.st)) === '["8s,3c,9d","8d,2h"]', 'hand 2 gets its card next, on its own ' + JSON.stringify(hands(A.st)));
    check(simulCheck(A.all.slice(before)) === 0, 'still never two hands at once');
    H.s.close(); A.s.close(); }

  console.log('2. computer players split one hand at a time');
  { const { H, A } = await table({ betSec: 0 }); await emit(H.s, 'host:addBot', { level: 'hard' }); await emit(H.s, 'host:addBot', { level: 'hard' }); await emit(H.s, 'host:start', {});
    let splits = 0; for (let r = 0; r < 6; r++) { await waitFor(() => A.st.stage === 'betting'); await emit(A.s, 'bet:add', { spot: 'main', chip: 500 });
      await emit(H.s, 'test:rig', { cards: ['Ts', '8s', '8c', '6h', 'Td', '8d', '8h', 'Tc', /*draws*/ '2c', '3c', '2d', '3d', '9s', '9h', '9c', '9d', '7s', '7h'] }); await emit(A.s, 'bet:ready', {});
      await waitFor(() => A.st.stage !== 'betting'); await waitFor(() => { if (A.st.me && A.st.me.legal) { emit(A.s, 'act', { action: 'stand', seq: A.st.tseq }); } return A.st.stage === 'settled'; }, 20000);
      splits += A.st.players.filter(p => p.bot && p.box && p.box.hands.length > 1).length; }
    check(splits >= 6, `bots split 8-8 (${splits} split boxes)`); check(simulCheck(H.all) === 0, 'TV never saw a bot hit two hands at once');
    H.s.close(); A.s.close(); }

  console.log('3. pause / resume in every phase');
  { const { H, A } = await table({ betSec: 20, turnSec: 15 }); await emit(H.s, 'host:addBot', { level: 'medium' }); await emit(H.s, 'host:start', {});
    const left = (x, k) => x[k] - x.serverNow - (Date.now() - A.at);
    // betting
    await waitFor(() => A.st.stage === 'betting' && A.st.betDeadline); await sleep(3000); await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused);
    const pl = A.st.pausedLeft; check(A.st.paused && H.st.paused && pl > 15500 && pl < 17500, `betting: paused with ${Math.round(pl / 1000)}s left; TV + phone show paused`);
    const rb = await emit(A.s, 'bet:add', { spot: 'main', chip: 500 }); check(/Paused/.test(rb.error || ''), 'betting: phone bets blocked while paused: ' + rb.error);
    const rd = await emit(H.s, 'host:deal', {}); check(/paused/i.test(rd.error || ''), 'Deal now blocked while paused');
    await sleep(2500); check(A.st.stage === 'betting', 'betting: clock frozen'); await emit(H.s, 'host:pause', {}); await waitFor(() => !A.st.paused);
    const bl = left(A.st, 'betDeadline'); check(bl > pl - 1500 && bl <= pl + 300, `betting: resume continues with ${Math.round(bl / 1000)}s (not a fresh 20s)`);
    // playing (Ann's turn), insurance and dealer: rig dealer Ace up, Ann 10-6
    await emit(A.s, 'bet:add', { spot: 'main', chip: 2500 }); const seats = H.st.players.map(p => p.name); const annFirst = seats[0] === 'Ann';
    await emit(H.s, 'test:rig', { cards: annFirst ? ['Ts', '9c', 'Ah', '6d', '7c', '5h', /*dealer draws*/ '2s', '2h', '2d', '3c', 'Tc'] : ['9c', 'Ts', 'Ah', '7c', '6d', '5h', '2s', '2h', '2d', '3c', 'Tc'] });
    await emit(A.s, 'bet:ready', {}); await waitFor(() => A.st.stage === 'insurance', 25000);
    await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused); const ri = await emit(A.s, 'insure', { yes: false }); check(/Paused/.test(ri.error || ''), 'insurance: decision blocked while paused');
    await sleep(3800); check(A.st.stage === 'insurance', 'insurance: still open after longer than the insurance clock'); await emit(H.s, 'host:pause', {}); await waitFor(() => !A.st.paused);
    await emit(A.s, 'insure', { yes: false }); await waitFor(() => A.st.stage === 'playing');
    // a bot's turn (pause freezes computer moves)
    if (!annFirst) { await waitFor(() => A.st.turn && A.st.turn.id !== A.st.me.id); await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused); const k = JSON.stringify(A.st.players.map(p => p.box && p.box.hands.map(h => h.cards.length))); await sleep(2000);
      check(JSON.stringify(A.st.players.map(p => p.box && p.box.hands.map(h => h.cards.length))) === k && A.st.turn.id !== A.st.me.id, 'bot turn: computer player frozen while paused'); await emit(H.s, 'host:pause', {}); await waitFor(() => !A.st.paused); }
    await waitFor(() => A.st.me && A.st.me.legal, 20000); await sleep(4000); const tl = left(A.st, 'turnDeadline');
    await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused); check(!A.st.turnDeadline && A.st.pausedLeft > tl - 1500, `my turn: paused with ${Math.round(A.st.pausedLeft / 1000)}s left on the action clock`);
    const ra = await emit(A.s, 'act', { action: 'hit', seq: A.st.tseq }); check(/Paused/.test(ra.error || '') && hands(A.st)[0].split(',').length === 2, 'my turn: Hit blocked while paused');
    await sleep(2500); await emit(H.s, 'host:pause', {}); await waitFor(() => !A.st.paused && A.st.turnDeadline); const tl2 = left(A.st, 'turnDeadline');
    check(tl2 < 15000 - 2500 && tl2 > tl - 2500, `my turn: resume keeps the remaining ${Math.round(tl2 / 1000)}s (not a fresh 15s)`);
    // dealer play
    await emit(A.s, 'act', { action: 'stand', seq: A.st.tseq }); await waitFor(() => A.st.stage === 'dealer', 20000); await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused);
    const dn = A.st.dealer.cards.length; await sleep(2000); check(A.st.stage === 'dealer' && A.st.dealer.cards.length === dn, `dealer play frozen at ${dn} cards`);
    await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.stage === 'settled'); check(A.st.dealer.cards.length > dn, `dealer finishes after resume (${A.st.dealer.cards.join(' ')})`);
    // settled -> next round waits
    await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.paused); const rnd = A.st.round; await sleep(2500); check(A.st.stage === 'settled' && A.st.round === rnd, 'results screen holds while paused');
    await emit(H.s, 'host:pause', {}); await waitFor(() => A.st.stage === 'betting'); check(A.st.round === rnd + 1, 'next round starts after resume');
    H.s.close(); A.s.close(); }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
