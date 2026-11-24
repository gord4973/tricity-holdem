// GORILLA RTP simulator: node tools/gorilla-sim.js [spins=1000000]
const M = require('../public/gorilla/math.js'), n = +(process.argv[2] || 1e6), t0 = Date.now();
const s = M.simulate(n, M.cryptoRng());
const pct = x => (x * 100).toFixed(2) + '%';
console.log(`GORILLA sim · ${n.toLocaleString()} spins · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`RTP ${pct(s.rtp)} · hit rate ${pct(s.hitRate)} · SD/spin ${s.sd.toFixed(2)}x bet · max ${s.maxX.toFixed(0)}x`);
console.log(`bonus 1 in ${s.bonusEvery.toFixed(0)} · meter wheel 1 in ${s.meterEvery.toFixed(0)} · awaken ${pct(s.awakenRate)} of wheels · avg bonus spins ${s.avgFreeSpins.toFixed(2)} · growing ${pct(s.growRate)} of bonus spins`);
console.log(`punch-nudge 1 in ${s.nudgeEvery.toFixed(0)} · thunder wild 1 in ${s.thunderEvery.toFixed(0)} · coin respin 1 in ${s.respinEvery.toFixed(0)} · lock smash ${pct(s.smashRate)}`);
console.log('RTP by feature: ' + Object.entries(s.share).map(([k, v]) => `${k} ${(v * 100).toFixed(2)}`).join(' · '));
console.log(`big ${pct(s.tiers.big / n)} · mega ${pct(s.tiers.mega / n)} · monster ${pct(s.tiers.monster / n)} · wedges ${JSON.stringify(s.wedges)}`);
