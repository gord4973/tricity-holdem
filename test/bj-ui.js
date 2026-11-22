// Browser test: Blackjack host TV + phone. Chip-click betting, FREE double button, lammer coin, stats panel, payouts. node test/bj-ui.js <base>  (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs');const B=process.argv[2]||'http://localhost:3470',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
 const errs=[];h.on('pageerror',e=>errs.push('host: '+e.message));
 await h.goto(B+'/blackjack/host',{waitUntil:'networkidle0'});await h.evaluate(()=>{localStorage.clear();localStorage.setItem('bjVoice','0')});await h.reload({waitUntil:'networkidle0'});
 await h.type('#pw',PW);await h.click('#ston');await h.select('#bt','0');await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 ok(/Stats for players: on/.test(await h.$eval('#lset',e=>e.innerText)),'lobby shows settings incl. Stats on');ok((await h.$eval('#url',e=>e.textContent)).endsWith('/blackjack'),'lobby join URL is /blackjack');
 const c=await b.createBrowserContext();const m=await c.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});m.on('pageerror',e=>errs.push('phone: '+e.message));
 await m.goto(B+'/blackjack/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(600);
 ok(await m.$eval('#w',e=>!e.classList.contains('hidden')),'phone joined the lobby');
 for(const lv of['hard','easy'])await h.evaluate(lv=>new Promise(r=>s.emit('host:addBot',{level:lv},r)),lv);

 await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));await m.waitForFunction(()=>st&&st.stage==='betting');await sleep(300);
 const tray=await m.$$eval('#tray .chip',e=>e.map(x=>x.innerText));ok(tray.join(',')==='$5,$25,$100','chip tray: $5 red, $25 green, $100 black ('+tray.join(',')+')');
 const bal0=await m.$eval('#bal',e=>e.textContent);ok(bal0==='$400','starting balance $400 ('+bal0+')');
 const stack=await m.$$eval('#mystack .chip',e=>e.length);ok(stack>=3,'balance drawn as chip stacks');
 await m.click('#tray .chip.k25');await sleep(250);await m.click('#tray .chip.k5');await sleep(250);await m.click('#cPog');await sleep(150);await m.click('#tray .chip.k5');await sleep(300);
 const x1=await m.evaluate(()=>st.players.find(p=>p.id===st.me.id).bet);ok(x1.main===3000&&x1.pog===500,'tapping chips built a $30 bet + $5 Pot of Gold');
 ok((await m.$eval('#bal',e=>e.textContent))==='$365','balance shows $365 while bets are out');
 await m.screenshot({path:'screens/bj-phone-bet'+(process.env.SHOT||'')+'.png'});
 const rig=process.env.LIVE?null:await h.evaluate(()=>new Promise(r=>s.emit('test:rig',{cards:['5c','9h','7d','5s','6d','Tc','2h','Th','Tc']},r)));
 await m.click('#bReady');await m.waitForFunction(()=>st&&(st.stage==='playing'||st.stage==='insurance'||st.stage==='settled'),{timeout:20000});
 // seat order: Gord, then the two bots. Deal order: p1 p2 p3 dealer-up p1 p2 p3 dealer-hole -> Gord gets 5+6
 await m.waitForFunction(()=>st.me&&st.me.legal||st.stage==='settled',{timeout:20000});const L=await m.evaluate(()=>st.me.legal);
 const LIVE=!!process.env.LIVE;if(L&&LIVE){const stx=await m.$eval('#stats',e=>e.innerText);ok(/Recommended: /.test(stx),'stats panel (live, random cards): '+stx.replace(/\n/g,' / '));await m.screenshot({path:'screens/bj-phone-turn-live.png'});await h.screenshot({path:'screens/bj-host-play-live.png'});
  while(await m.evaluate(()=>!!(st.me&&st.me.legal))){await m.click('#bStand').catch(()=>{});await sleep(700)}}
 else if(L){const dbl=await m.$eval('#bDbl',e=>e.innerText);ok(L.doubleFree&&/FREE/.test(dbl),'Double button shows FREE on 5+6 ('+dbl.replace(/\n/g,' ')+')');
  const stx=await m.$eval('#stats',e=>e.innerText);ok(/Recommended: Double \(free\)/.test(stx)&&/Dealer .* busts: \d+%/.test(stx),'stats panel: '+stx.replace(/\n/g,' / '));
  await m.screenshot({path:'screens/bj-phone-turn'+(process.env.SHOT||'')+'.png'});await h.screenshot({path:'screens/bj-host-play'+(process.env.SHOT||'')+'.png'});
  await m.click('#bDbl');await sleep(500);ok(await m.$$eval('#spot .lammer',e=>e.length)===1,'gold lammer coin appears on the hand');
 }else ok(false,'did not get a turn (rig mismatch)');
 const res=await (await m.waitForFunction(()=>{if(st.stage!=='settled')return false;const b=st.players.find(p=>p.id===st.me.id).box;return b&&{net:b.net,res:b.hands[0].result,lam:b.lammers,d:st.result.dealer}},{timeout:30000,polling:20})).jsonValue();
 ok(res.res&&(LIVE||res.lam===1),'round settled: '+JSON.stringify(res));
 const status=await m.$eval('#status',e=>e.innerText);ok(/win|lose|Push/i.test(status),'phone result line: '+status);
 await m.screenshot({path:'screens/bj-phone-result'+(process.env.SHOT||'')+'.png'});await h.screenshot({path:'screens/bj-host-result'+(process.env.SHOT||'')+'.png'});
 const ann=await h.$eval('#ann',e=>e.innerText);ok(/Dealer/.test(ann),'TV announces: '+ann.replace(/\n/g,' / '));
 ok(!(await h.evaluate(()=>document.body.innerText)).includes('Recommended'),'TV never shows a player\'s stats');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL BLACKJACK UI CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
