// GORILLA RTP simulator: node tools/gorilla-sim.js [spins=1000000]
const M = require('../public/gorilla/math.js'), n = +(process.argv[2] || 1e6), t0 = Date.now();
const s = M.simulate(n, M.cryptoRng());
const pct = x => (x * 100).toFixed(2) + '%';
console.log(`GORILLA sim · ${n.toLocaleString()} spins · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`RTP ${pct(s.rtp)} · hit rate ${pct(s.hitRate)} · SD/spin ${s.sd.toFixed(2)}x bet · volatility index (90% CI) ±${(1.645 * s.sd).toFixed(2)}`);
console.log(`bonus 1 in ${s.bonusEvery.toFixed(0)} · lock smash ${pct(s.smashRate)} of spins · coins ${pct(s.coinShare)} of wins · bonus ${pct(s.bonusShare)} of wins · max ${s.maxX.toFixed(0)}x`);
console.log(`big ${pct(s.tiers.big / n)} · mega ${pct(s.tiers.mega / n)} · epic ${pct(s.tiers.epic / n)} · wedges ${JSON.stringify(s.wedges)}`);
