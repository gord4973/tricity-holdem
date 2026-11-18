// Browser + socket check: computer players. node test/bots.js <base>   (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});h.on('dialog',d=>d.accept());
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);
 await h.click('#bion');await h.type('#biemail','host.test@example.com');await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 const add=lv=>h.evaluate(lv=>new Promise(r=>s.emit('host:addBot',{level:lv},r)),lv);
 for(const lv of['easy','medium','hard','hard','easy'])ok((await add(lv)).ok,'added '+lv+' bot');
 const r6=await add('medium');ok(r6.error&&/5/.test(r6.error),'6th bot refused: '+r6.error);
 ok((await add('silly')).error,'bad level refused');
 let hs=await h.evaluate(()=>st);const bots=hs.players.filter(p=>p.bot);
 ok(bots.every(p=>p.name[0]===p.bot[0].toUpperCase()),'names match level letter: '+bots.map(p=>p.name+'('+p.bot+')').join(', '));
 ok(new Set(hs.players.map(p=>p.name)).size===hs.players.length,'no duplicate names');
 ok(bots.every(p=>p.pay==='bot'&&!p.mic&&p.connected),'bots: no buy-in, no mic, shown connected');
 ok(await h.$eval('#botbar',e=>[...e.querySelectorAll('button')].every(b=>b.disabled)),'Add buttons disabled at 5 bots');
 const easy2=bots.filter(p=>p.bot==='easy')[1];await h.evaluate(id=>cmd('host:kick',{id}),easy2.id);await sleep(400);
 hs=await h.evaluate(()=>st);ok(hs.players.filter(p=>p.bot).length===4,'host removed a bot (4 left)');
 ok((await h.$$eval('#plist .botb',e=>e.length))===4,'lobby shows 🤖 badges');
 // one human
 const ctx=await b.createBrowserContext();const m=await ctx.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(800);
 ok(await h.$eval('#startBtn',e=>e.disabled),'Start blocked: the human is unconfirmed (bots never block)');
 hs=await h.evaluate(()=>st);ok(hs.buyIn.humans===1&&hs.buyIn.unpaid===1,'buy-in counts humans only');
 const me=hs.players.find(p=>p.name==='Gord');await h.evaluate(id=>cmd('host:confirm',{id,on:true}),me.id);await sleep(400);
 hs=await h.evaluate(()=>st);ok(hs.buyIn.pot===500&&!(await h.$eval('#startBtn',e=>e.disabled)),'pot $5 (bots add nothing), Start enabled');
 await h.screenshot({path:'screens/v7-host-lobby-bots.png'});
 await h.click('#startBtn');await sleep(500);
 // human auto-plays check/call from the phone
 await m.evaluate(()=>{window._auto=setInterval(()=>{const L=st&&st.me&&st.me.legal;if(L&&!window._busy){window._busy=1;s.emit('act',{action:L.canCheck?'check':'call'},()=>{window._busy=0})}},250)});
 let seen=new Set(),acts=0,lastSeq=-1,t0=Date.now();
 while(Date.now()-t0<60000){const x=await h.evaluate(()=>st);if(x.handNo>=3&&Date.now()-t0>15000)break;if(x.toAct)seen.add(x.toAct);if(x.log.length&&x.log.join()!==lastSeq){acts++;lastSeq=x.log.join()}await sleep(300)}
 hs=await h.evaluate(()=>st);ok(hs.handNo>=2,`bots + 1 human played ${hs.handNo} hands in ${((Date.now()-t0)/1000).toFixed(0)}s`);ok(hs.players.filter(p=>p.bot).every(p=>seen.has(p.id)||p.out),'every bot took turns');
 await m.screenshot({path:'screens/v7-phone-bots.png'});await h.screenshot({path:'screens/v7-host-table-bots.png'});
 ok((await m.$$eval('#plist .botb',e=>e.length))>=1,'phone shows 🤖 badges');ok((await h.$$eval('.seat .botb, .nm .botb',e=>e.length))>=1,'host table shows 🤖 badges');
 // pause stops bots
 await h.evaluate(()=>cmd('host:pause',{paused:true}));await sleep(300);const a=await h.evaluate(()=>JSON.stringify([st.handNo,st.stage,st.toAct,st.pot,st.log.length]));await m.evaluate(()=>clearInterval(window._auto));
 await sleep(5000);const bb=await h.evaluate(()=>JSON.stringify([st.handNo,st.stage,st.toAct,st.pot,st.log.length]));ok(a===bb,'nothing moves while paused');
 await m.evaluate(()=>{window._auto=setInterval(()=>{const L=st&&st.me&&st.me.legal;if(L&&!window._busy){window._busy=1;s.emit('act',{action:L.canCheck?'check':'call'},()=>{window._busy=0})}},250)});
 await h.evaluate(()=>cmd('host:pause',{paused:false}));
 // wait until a bot leads (or the game ends), then End game
 t0=Date.now();while(Date.now()-t0<90000){const x=await h.evaluate(()=>st);if(x.stage==='gameover')break;const mx=Math.max(...x.players.map(p=>p.chips));const lead=x.players.filter(p=>p.chips===mx);if(lead.every(p=>p.bot)&&x.stage==='handover')break;await sleep(400)}
 if(await h.evaluate(()=>st.stage!=='gameover')){await h.click('.ctrls button.red');await sleep(200);await h.click('#endModal button.red')}await sleep(1500);
 hs=await h.evaluate(()=>st);ok(hs.stage==='gameover','game over');
 const lead=hs.standings[0];const leadBot=hs.players.find(p=>p.id===lead.id).bot;
 if(leadBot){ok(hs.buyIn.botWinner&&hs.buyIn.payTo==='Gord','bot won → pot goes to best human: '+JSON.stringify({bw:hs.buyIn.botWinner,payTo:hs.buyIn.payTo}));
   const ht=await h.$eval('#bipot',e=>e.innerText);ok(/pay to Gord/.test(ht)&&/computer/.test(ht),'host payout line: '+ht.replace(/\n/g,' | '))}
 else ok(hs.buyIn.payTo==='Gord','human leads → pay to Gord');
 const pt=await m.$eval('#res',e=>e.innerText);ok(/pay to Gord/.test(pt),'phone shows pay to Gord');
 await h.screenshot({path:'screens/v7-host-over-bots.png'});await m.screenshot({path:'screens/v7-phone-over-bots.png'});
 await m.evaluate(()=>clearInterval(window._auto));
 await h.click('#over button.green');await sleep(900);hs=await h.evaluate(()=>st);
 ok(hs.stage==='lobby'&&hs.players.filter(p=>p.bot).length===4&&hs.players.every(p=>p.chips===120),'Play again keeps bots, chips reset to 120');
 ok(hs.players.find(p=>p.name==='Gord').pay==='none'&&hs.players.filter(p=>p.bot).every(p=>p.pay==='bot'),'Play again resets human buy-in only');
 const hz=await (await fetch(B+'/healthz')).json();ok(hz.botErrors===0,'server bot fallbacks: '+hz.botErrors);
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL BOT CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
