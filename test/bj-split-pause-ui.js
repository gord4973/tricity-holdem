// Browser regression: split hands one at a time on phone + TV (incl. a fast double-tap on Hit), and the TV's Pause/Resume button.
// node test/bj-split-pause-ui.js <base>   (local server needs TEST_HOOKS=1; host PIN read from PWF, never printed)
const P=require('puppeteer-core'),fs=require('fs');const B=process.argv[2]||'http://localhost:3473',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim(),LIVE=!!process.env.LIVE;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errs=[];
 const h=await b.newPage();await h.setViewport({width:1920,height:1080});h.on('pageerror',e=>errs.push(e.message));
 await h.goto(B+'/blackjack/host',{waitUntil:'networkidle0'});await h.evaluate(()=>{localStorage.clear();localStorage.setItem('bjVoice','0')});await h.reload({waitUntil:'networkidle0'});
 await h.type('#pw',PW);await h.select('#bt','0');await h.click('#login button.red');await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 const c=await b.createBrowserContext();const m=await c.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});m.on('pageerror',e=>errs.push(e.message));
 await m.goto(B+'/blackjack/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(600);
 await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));await m.waitForFunction(()=>st&&st.stage==='betting');
 const hands=()=>m.evaluate(()=>{const b=st.players.find(p=>p.id===st.me.id).box;return b?b.hands.map(h=>h.cards.join(',')):[]});
 const playSplit=async()=>{ // phone: tap chips, deal, split when offered; returns true if we got a split
  await m.waitForFunction(()=>st.stage==='betting');await m.click('#tray .chip.k25');await sleep(150);
  if(!LIVE)await h.evaluate(()=>new Promise(r=>s.emit('test:rig',{cards:['8s','6h','8d','Tc','2c','3d','4h','5s','6s','7c','2h','9d']},r)));
  await m.click('#bReady');await m.waitForFunction(()=>st.stage!=='betting',{timeout:30000});
  await m.waitForFunction(()=>(st.me&&st.me.legal)||st.stage==='settled'||st.me.canInsure,{timeout:30000});
  if(await m.evaluate(()=>st.me.canInsure)){await m.click('#insbox button:last-child').catch(()=>{});await m.waitForFunction(()=>(st.me&&st.me.legal)||st.stage==='settled',{timeout:30000})}
  const L=await m.evaluate(()=>st.me.legal);if(!L||!L.canSplit){while(await m.evaluate(()=>!!(st.me&&st.me.legal))){await m.click('#bStand').catch(()=>{});await sleep(600)}return false}
  await m.click('#bSpl');await m.waitForFunction(()=>st.players.find(p=>p.id===st.me.id).box.hands.length===2&&st.me.legal);return true};
 let got=await playSplit();if(LIVE){let n=0;while(!got&&n++<40){await m.waitForFunction(()=>st.stage==='settled',{timeout:60000});got=await playSplit()}}
 ok(got,'player split a pair'+(LIVE?' (live: waited for a natural pair)':' (rigged 8-8)'));
 if(got){const tags=await m.$$eval('#spot .htag',e=>e.map(x=>x.textContent));ok(tags.length===2&&/HAND 1 of 2/.test(tags[0])&&/HAND 2 of 2/.test(tags[1]),'phone labels each hand: '+tags.join(' | '));
  const cls=await m.$$eval('#spot .hand',e=>e.map(x=>x.className));ok(/act/.test(cls[0])&&/dim/.test(cls[1]),'phone: hand 1 highlighted, hand 2 dimmed ('+cls.join(' | ')+')');
  ok(/hand 1 of 2/.test(await m.$eval('#status',e=>e.innerText)),'phone status: YOUR TURN — hand 1 of 2');
  const ttags=await h.$$eval('.spot .htag',e=>e.map(x=>x.textContent));ok(ttags.length===2&&/▶ HAND 1/.test(ttags[0]),'TV labels the split hands and marks the active one: '+ttags.join(' | '));
  const h0=await hands();await m.screenshot({path:'screens/bj-split-phone.png'});await h.screenshot({path:'screens/bj-split-tv.png'});
  // fast double-tap on Hit
  const bh=await m.$('#bHit');const box=await bh.boundingBox();if(await m.evaluate(()=>st.me.legal.canHit)){await m.mouse.click(box.x+box.width/2,box.y+box.height/2);await m.mouse.click(box.x+box.width/2,box.y+box.height/2);await sleep(900);
   const h1=await hands();ok(h1[0].split(',').length===h0[0].split(',').length+1&&h1[1]===h0[1],`double-tapped Hit: hand 1 got exactly one card, hand 2 untouched (${h0.join(' / ')} -> ${h1.join(' / ')})`)}
  // finish hand 1, hand 2 becomes active
  while(await m.evaluate(()=>!!(st.me&&st.me.legal&&st.me.legal.hand===0))){await m.click('#bStand');await sleep(400)}
  await m.waitForFunction(()=>st.stage!=='playing'||(st.me.legal&&st.me.legal.hand===1),{timeout:20000});
  if(await m.evaluate(()=>!!(st.me.legal&&st.me.legal.hand===1))){const cls2=await m.$$eval('#spot .hand',e=>e.map(x=>x.className));ok(/dim/.test(cls2[0])&&/act/.test(cls2[1]),'phone: hand 2 now highlighted, hand 1 dimmed');ok(/hand 2 of 2/.test(await m.$eval('#status',e=>e.innerText)),'phone status: hand 2 of 2');
   // pause from the TV button mid-turn
   await h.click('#pauseBtn');await m.waitForFunction(()=>st.paused);await sleep(300);
   ok(/PAUSED/.test(await h.$eval('#ann',e=>e.innerText))&&/Resume/.test(await h.$eval('#pauseBtn',e=>e.innerText)),'TV: PAUSED banner and Resume button');
   ok(/PAUSED/.test(await m.$eval('#ann',e=>e.innerText))&&await m.$eval('#actbox',e=>e.classList.contains('hidden')),'phone: PAUSED banner, action buttons hidden');
   await m.screenshot({path:'screens/bj-paused-phone.png'});await h.screenshot({path:'screens/bj-paused-tv.png'});
   await h.click('#pauseBtn');await m.waitForFunction(()=>!st.paused);await sleep(300);
   ok(!(await m.$eval('#actbox',e=>e.classList.contains('hidden')))&&/Pause/.test(await h.$eval('#pauseBtn',e=>e.innerText)),'Resume: phone buttons back, TV shows Pause again');
   while(await m.evaluate(()=>!!(st.me&&st.me.legal))){await m.click('#bStand');await sleep(400)}}
  await m.waitForFunction(()=>st.stage==='settled'||st.stage==='betting',{timeout:30000});}
 ok(!errs.length,'no page errors '+errs.join('; '));
 await b.close();console.log(fails?fails+' FAILURES':'ALL PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(1)});
