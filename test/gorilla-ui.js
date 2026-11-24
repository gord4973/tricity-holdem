// GORILLA browser test: insert bill, change denom, spin/win, forced smash/big/bonus/THUNDER SPINS, cash out; plus viewport + perf checks.
// Run against a server: PORT=3480 node server.js ; then GORILLA_URL=http://localhost:3480 node test/gorilla-ui.js
const P = require('puppeteer-core'), assert = require('assert'), BASE = process.env.GORILLA_URL || 'http://localhost:3480', SHOTS = process.env.SHOTS || '/workspace/gorilla-shots';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await P.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(BASE + '/gorilla?debug=1&speed=0.35', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  const idle = () => p.waitForFunction(() => window.G && !G.busy, { timeout: 180000 }), cents = () => p.evaluate(() => G.st.cents);
  await idle(); assert.strictEqual(await cents(), 0);
  // photoreal video gorilla director: an idle clip on screen, reactions cut in and return to idle, sounds decode
  await p.waitForFunction(() => window.ape && ape.kind === 'video', { timeout: 15000 }); await p.evaluate(() => ape.ready);
  const onScreen = () => p.evaluate(() => [...document.querySelectorAll('#scene video.v')].some(v => !v.paused && +v.style.opacity > .5 && v.readyState >= 2));
  await p.waitForFunction(() => [...document.querySelectorAll('#scene video.v')].some(v => !v.paused && +v.style.opacity > .5), { timeout: 10000 }); assert.ok(await onScreen(), 'idle clip playing');
  assert.ok(await p.evaluate(() => /^idle-/.test(ape.lastIdle)), 'idle director picked an idle clip');
  await p.mouse.click(200, 200); // unlock audio
  for (const n of ['roar', 'chestbeat', 'punch', 'smallwin', 'lose', 'watch', 'anticipate', 'stare']) { await p.evaluate(n => { window.__done = false; ape.play(n).then(() => window.__done = true); }, n);
    await p.waitForFunction(n => document.getElementById('scene').dataset.clip === n && [...document.querySelectorAll('#scene video.v')].some(v => !v.paused && +v.style.opacity > .9), { timeout: 8000 }, n);
    await p.waitForFunction(() => /idle|still/.test(document.getElementById('scene').dataset.clip) && window.__done, { timeout: 15000 }); console.log(`✔ ${n} clip played and returned to idle`); }
  await p.waitForFunction(() => ['roar', 'chestbeat', 'punch', 'stare', 'smallwin', 'lose', 'anticipate', 'br1', 'br4', 'huff1', 'grunt1', 'roarReal'].every(k => GorillaAudio.loaded(k)), { timeout: 15000 }); console.log('✔ gorilla sounds + breath one-shots decoded');
  await p.waitForFunction(() => GorillaSymbols.codes.every(c => GorillaSymbols.img[c].naturalWidth >= 512), { timeout: 10000 }); console.log('✔ photoreal symbols loaded (2x webp)');
  await p.click('#spinBtn'); await wait(300); assert.ok(await p.$eval('#toast', e => !e.classList.contains('hidden') && /Insert/.test(e.textContent)), 'spin with no cash asks for a bill');
  await p.click('#billBtn'); await p.waitForFunction(() => document.getElementById('bill').classList.contains('go'), { timeout: 5000 }); await idle();
  assert.strictEqual(await cents(), 10000); assert.strictEqual(await p.$eval('#mCash', e => e.textContent), '$100.00'); console.log('✔ bill inserted, CASH rolled to $100.00');
  await p.click('#denomBtn'); await p.click('#denoms button[data-d="25"]'); await p.click('[data-close=denomModal]');
  assert.strictEqual(await p.$eval('#denomTxt', e => e.textContent), '25¢'); assert.strictEqual(await p.$eval('#mBetD', e => e.textContent), '$12.50'); assert.strictEqual(await p.$eval('#mCred', e => e.textContent), '400'); console.log('✔ denom 25¢: bet 50 credits = $12.50, 400 credits');
  await p.click('#denomBtn'); await p.click('#denoms button[data-d="5"]'); await p.click('[data-close=denomModal]');
  await p.click('#betUp'); assert.strictEqual(await p.$eval('#mBet', e => e.textContent), '100'); await p.click('#betDn');
  const run = async (k, check) => { await p.evaluate(k => G.force(k), k); const c0 = await cents(); await p.click('#spinBtn'); if (check) await check(); await idle(); const c1 = await cents(); console.log(`✔ ${k}: ${c0} -> ${c1} cents (${await p.$eval('#winBanner', e => e.textContent)})`); return c1 - c0; };
  // v4: watch starts with the spin; hit impact frame and reel effect land together (+-50 ms)
  await p.evaluate(() => { window.__hits = []; const o = ape.on.slam; ape.on.slam = i => { __hits.push({ clip: ape.action && ape.action.name, busy: G.busy }); o && o(i); }; });
  await p.evaluate(() => { window.__w = null; const t0 = performance.now(); const iv = setInterval(() => { if (ape.action && ape.action.name === 'watch') { window.__w = performance.now() - t0; clearInterval(iv); } }, 5); G.spin(); });
  await p.waitForFunction(() => window.__w != null, { timeout: 3000 }); const wms = await p.evaluate(() => __w); assert.ok(wms < 100, 'watch starts with the spin: ' + wms); console.log(`✔ watch began ${wms.toFixed(0)} ms after SPIN`); await idle();
  const sync = async k => { const r = await p.evaluate(() => ({ fx: window.__gorillaFx, hit: ape.lastImpact })); const d = r.fx.at - r.hit.at, vd = (r.hit.ct - r.hit.cue) * 1000;
    assert.ok(Math.abs(d) <= 50 && Math.abs(vd) <= 50, k + ' sync ' + JSON.stringify(r)); console.log(`✔ ${k}: reel effect ${d.toFixed(1)} ms after the impact cue; clip clock ${vd.toFixed(0)} ms past the impact frame (${r.hit.clip} @ ${r.hit.cue}s)`); return { d, vd }; };
  await run('nudge', async () => { await p.waitForFunction(() => window.__gorillaFx && __gorillaFx.kind === 'nudge', { timeout: 60000 }); await wait(60); await p.screenshot({ path: SHOTS + '/ui-nudge.png' }); });
  await sync('punch-nudge'); assert.ok(await p.evaluate(() => reels.winCount()) >= 3, 'nudge punched the reel into a win');
  
  assert.ok(await run('win') > -250, 'win pays'); assert.ok(await p.evaluate(() => reels.winCount()) >= 3, 'winning cells highlighted');
  await run('smash', async () => { await p.waitForFunction(() => reels.locksGone > 0, { timeout: 60000 }); await p.screenshot({ path: SHOTS + '/ui-smash.png' }); }); await sync('lock smash');
  await run('big', async () => { await p.waitForSelector('#big:not(.hidden)', { timeout: 60000 }); await wait(600); await p.screenshot({ path: SHOTS + '/ui-bigwin.png' });
    assert.ok(!(await p.evaluate(() => ape.action && /roar|chestbeat/.test(ape.action.name))), 'no roar behind the win screen');
    await p.waitForFunction(() => document.getElementById('big').classList.contains('hidden') && ape.action && ape.action.name === 'roar', { timeout: 30000 }); await wait(1300); await p.screenshot({ path: SHOTS + '/ui-roar-after.png' }); console.log('✔ roar starts only after the big-win screen closes'); });
  const hits = await p.evaluate(() => __hits); assert.ok(hits.every(h => h.busy && /punch|slam|smallwin/.test(h.clip)), 'hits only during a spin event: ' + JSON.stringify(hits)); console.log(`✔ ${hits.length} gorilla hits so far, all tied to a spin event (${[...new Set(hits.map(h => h.clip))].join(', ')})`);
  await run('bonus', async () => { await p.waitForSelector('#wheelBox:not(.hidden)', { timeout: 60000 }); await wait(300); await p.screenshot({ path: SHOTS + '/ui-wheel.png' }); });
  await run('thunder', async () => { await p.waitForSelector('#fsHud:not(.hidden)', { timeout: 90000 }); await wait(1500); await p.screenshot({ path: SHOTS + '/ui-thunder.png' }); });
  const before = await cents(); assert.ok(before > 0); await p.click('#cashBtn'); await wait(1600); await p.screenshot({ path: SHOTS + '/ui-ticket.png' }); await idle();
  assert.strictEqual(await cents(), 0); assert.ok((await p.$eval('#ticket', e => e.textContent)).includes((before / 100).toFixed(2)), 'ticket shows cashed-out amount'); console.log('✔ cash out printed ticket for $' + (before / 100).toFixed(2));
  await p.reload({ waitUntil: 'load' }); await idle(); assert.strictEqual(await cents(), 0, 'state persisted in localStorage');
  // portrait viewports: nothing overflows, gorilla on top, reels in the middle, controls at the bottom, touch targets >= 44px
  for (const [n, w, h, d] of [['phone-390', 390, 844, 3], ['phone-412', 412, 915, 3], ['ipad-834', 834, 1194, 2], ['ipad-1024', 1024, 1366, 2]]) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: true, hasTouch: true }); await p.goto(BASE + '/gorilla', { waitUntil: 'load' }); await wait(2500);
    const m = await p.evaluate(() => { const f = document.getElementById('frame').getBoundingClientRect(), bar = document.getElementById('bar').getBoundingClientRect(), st = document.querySelector('#scene .stage').getBoundingClientRect();
      const small = [...document.querySelectorAll('#bar button, #topBtns button')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(b => b.id);
      return { top: f.top / innerHeight, fb: f.bottom, barTop: bar.top, barBottom: bar.bottom, H: innerHeight, sw: document.documentElement.scrollWidth, W: innerWidth, fps: window.ape && ape.fps, gw: st.width / innerWidth, small, c3d: !document.getElementById('ape').classList.contains('hidden') }; });
    assert.ok(m.sw <= m.W + 1 && m.barBottom <= m.H + 1 && m.fb <= m.barTop + 1, n + ' fits ' + JSON.stringify(m)); assert.ok(m.top > .38 && m.top < .6, n + ' reel frame top at ' + m.top.toFixed(2)); assert.deepStrictEqual(m.small, [], n + ' touch targets'); assert.ok(!m.c3d, 'no 3D');
    await p.screenshot({ path: `${SHOTS}/view-${n}.png` }); console.log(`✔ ${n} ${w}x${h}@${d}x: frame top ${(m.top * 100).toFixed(0)}% · gorilla ${(m.gw * 100).toFixed(0)}% wide · fps(swiftshader) ${Math.round(m.fps || 0)}`);
  }
  await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true }); await p.goto(BASE + '/gorilla', { waitUntil: 'load' }); await wait(800);
  assert.ok(await p.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'), 'landscape phone shows rotate overlay'); console.log('✔ landscape phone: rotate-to-portrait overlay');
  // perf: mobile viewport on low/med quality (headless SwiftShader is CPU rendering, so this is a floor, not a device number)
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const q of ['low', 'high']) { await p.goto(BASE + '/gorilla?q=' + q, { waitUntil: 'load' }); await p.evaluate(() => ape.ready); await wait(4000);
    const r = await p.evaluate(() => { const v = [...document.querySelectorAll('#scene video.v')].find(v => +v.style.opacity > .5) || document.querySelector('#scene video.v'), q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {}; return { fps: ape.fps, src: ape.res + ' ' + ape.lastIdle, w: v.videoWidth, dropped: q.droppedVideoFrames, total: q.totalVideoFrames }; });
    console.log(`✔ perf ${q}: ${r.src} ${r.w}px · page ${r.fps.toFixed(0)} fps · video frames ${r.total} dropped ${r.dropped}`); }
  // autoplay blocked (battery/data saver, Android installed app): photoreal poster stays, video starts on first tap, never the 3D gorilla;
  // a clip that fails to load is skipped but its effects still fire and the gorilla returns to idle
  { const q = await b.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.emulate({ viewport: { width: 384, height: 854, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-G998W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
    await q.evaluateOnNewDocument(() => { let act = false; for (const ev of ['pointerdown', 'touchstart']) addEventListener(ev, () => act = true, true); const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { return act ? o.call(this) : Promise.reject(new DOMException('blocked', 'NotAllowedError')); }; });
    await q.goto(BASE + '/gorilla', { waitUntil: 'load' }); await wait(3000);
    const s1 = await q.evaluate(() => ({ kind: window.ape && ape.kind, paused: [...document.querySelectorAll('#scene video.v')].every(v => v.paused), c3d: !document.getElementById('ape').classList.contains('hidden'), poster: getComputedStyle(document.querySelector('#scene .stage')).backgroundImage }));
    assert.ok(s1.kind === 'video' && s1.paused && !s1.c3d && /poster\.jpg/.test(s1.poster), 'blocked autoplay keeps the photoreal poster: ' + JSON.stringify(s1));
    await q.touchscreen.tap(190, 300); await q.waitForFunction(() => [...document.querySelectorAll('#scene video.v')].some(v => !v.paused && v.currentTime > .3 && +v.style.opacity > .5), { timeout: 8000 });
    assert.ok(await q.evaluate(() => document.getElementById('ape').classList.contains('hidden')), 'no 3D gorilla'); console.log('✔ autoplay blocked: poster, then video after first tap, no 3D fallback');
    await q.evaluate(() => { window.__ev = []; ape.on = { ...ape.on, slam: i => __ev.push('slam' + i) }; const s = ape.src.bind(ape); ape.src = n => n === 'slam' ? '/gorilla/media/missing.mp4' : s(n); ape.slam(); });
    await q.waitForFunction(() => __ev.includes('slam0') && /idle|still/.test(document.getElementById('scene').dataset.clip) && !ape.action, { timeout: 12000 });
    assert.ok(await q.evaluate(() => document.getElementById('ape').classList.contains('hidden')), 'no 3D after a failed clip'); await q.waitForFunction(() => [...document.querySelectorAll('#scene video.v')].some(v => !v.paused && +v.style.opacity > .5) || document.getElementById('scene').dataset.clip === 'still', { timeout: 8000 }); console.log('✔ failed clip skipped: impacts still fired, back to idle, no 3D fallback');
    const lg = await (await fetch(BASE + '/gorilla/log')).json(); assert.ok(lg.entries.some(e => e.kind === 'clip-skip'), 'error beacon recorded'); console.log('✔ error beacon: ' + lg.total + ' entries on /gorilla/log');
    await q.close(); }
  assert.deepStrictEqual(errs, [], 'no page errors'); console.log('GORILLA UI: all checks passed'); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
