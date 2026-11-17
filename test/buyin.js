// Browser check: buy-in tracker (host + 3 phones). node test/buyin.js <base>  (PWF = host PIN file)
const P=require('puppeteer-core'),fs=require('fs'),{io}=require('socket.io-client');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
const EM='host.test@example.com';
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
 h.on('dialog',d=>d.accept());
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);
 await h.click('#bion');await h.$eval('#biamt',e=>e.value='');await h.type('#biamt','5');await h.type('#biemail','not-an-email');await h.click('#login button.red');await sleep(800);
 ok(await h.evaluate(()=>!/\d{4}/.test(document.getElementById('pin').textContent)),'invalid e-Transfer email is rejected');
 await h.$eval('#biemail',e=>e.value='');await h.type('#biemail',EM);await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 let hs=await h.evaluate(()=>st);ok(hs.buyIn.on&&hs.buyIn.cents===500&&hs.buyIn.email===EM,'host room has buy-in $5 / email');
 // a socket that hasn't joined gets no state (so never sees the email)
 const spy=io(B,{transports:['websocket']});let leaked=false;spy.onAny((ev,x)=>{if(JSON.stringify(x||'').includes(EM))leaked=true});await sleep(1000);
 const phones=[];for(const n of['Gord','Sam','Lee']){const ctx=await b.createBrowserContext();const m=await ctx.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});m.on('dialog',d=>d.accept());await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm',n);await m.click('#j button.red');phones.push(m)}
 await sleep(1000);ok(!leaked,'unjoined socket never receives the host email');spy.close();
 const g=phones[0];ok(await g.$eval('#bicard',e=>!e.classList.contains('hidden')),'phone shows buy-in card');
 const card=await g.$eval('#bicard',e=>e.innerText);ok(card.includes('$5')&&card.includes(EM)&&card.includes("Send an Interac e-Transfer from your banking app, then tap I've sent it."),'card shows amount, email and instructions');
 ok((await g.$eval('#bistatus',e=>e.textContent))==='Not paid','status starts Not paid');
 await g.screenshot({path:'screens/v6-phone-buyin.png'});
 ok(await h.$eval('#startBtn',e=>e.disabled),'Start disabled while players are unconfirmed');
 let r=await h.evaluate(()=>new Promise(res=>s.emit('host:start',{},res)));ok(r&&/not been confirmed/.test(r.error||''),'server refuses host:start: '+(r&&r.error));
 await g.click('#bisent');await sleep(500);ok((await g.$eval('#bistatus',e=>e.textContent))==='Pending confirmation','I\'ve sent it → Pending');
 await g.click('#bisent');await sleep(500);ok((await g.$eval('#bistatus',e=>e.textContent))==='Not paid','Undo → Not paid');
 for(const m of phones.slice(0,2)){await m.click('#bisent');await sleep(300)}await sleep(400);
 hs=await h.evaluate(()=>st);ok(hs.players.filter(p=>p.pay==='pending').length===2,'host sees 2 pending');
 // player can't self-confirm
 r=await g.evaluate(()=>new Promise(res=>s.emit('host:confirm',{id:st.me.id,on:true},res)));await sleep(300);ok((await h.evaluate(()=>st.players.filter(p=>p.pay==='confirmed').length))===0,'a phone cannot confirm itself');
 await h.screenshot({path:'screens/v6-host-lobby-pending.png'});
 for(let i=0;i<2;i++){await h.evaluate(i=>[...document.querySelectorAll('#plist button.green')][0].click(),i);await sleep(400)}
 hs=await h.evaluate(()=>st);ok(hs.buyIn.confirmed===2&&hs.buyIn.pot===1000,'2 confirmed, pot $10');
 ok((await g.$eval('#bistatus',e=>e.textContent))==='Confirmed ✅','phone shows Confirmed ✅');
 ok(await h.$eval('#startBtn',e=>e.disabled),'Start still disabled (Lee unconfirmed)');
 // unconfirm then reconfirm Gord
 await h.evaluate(()=>[...document.querySelectorAll('#plist button.dark')][0].click());await sleep(400);ok((await h.evaluate(()=>st.buyIn.confirmed))===1,'host can un-confirm');
 await h.evaluate(()=>[...document.querySelectorAll('#plist button.green')][0].click());await sleep(400);
 // remove Lee (unconfirmed)
 const leeId=hs.players.find(p=>p.name==='Lee').id;await h.evaluate(id=>cmd('host:kick',{id}),leeId);await sleep(600);
 hs=await h.evaluate(()=>st);ok(hs.players.length===2&&hs.buyIn.unpaid===0&&hs.buyIn.pot===1000,'Lee removed; all confirmed');
 ok(await h.$eval('#startBtn',e=>!e.disabled),'Start enabled');ok((await h.$eval('#bistat',e=>e.innerText)).includes('$10'),'lobby shows pot $10');
 await h.screenshot({path:'screens/v6-host-lobby-ready.png'});
 await h.click('#startBtn');await sleep(1200);hs=await h.evaluate(()=>st);ok(hs.stage!=='lobby'&&hs.buyIn.pot===1000,'game started; pot stays $10');
 ok((await h.$eval('#hand',e=>e.textContent)).includes('$10'),'table shows pot $10');
 await h.click('.ctrls button.red');await sleep(200);await h.click('#endModal button.red');await sleep(1200);
 hs=await h.evaluate(()=>st);const ht=await h.$eval('#bipot',e=>e.innerText);ok(ht.includes('$10')&&ht.includes('pay to')&&ht.includes(hs.winner),'host final: '+ht);
 await h.screenshot({path:'screens/v6-host-over.png'});
 const pt=await g.$eval('#res',e=>e.innerText);ok(pt.includes('Buy-in pot: $10')&&pt.includes('pay to'),'phone final shows pot + pay to');
 await g.screenshot({path:'screens/v6-phone-over.png'});
 await h.click('#over button.green');await sleep(900);hs=await h.evaluate(()=>st);
 ok(hs.stage==='lobby'&&hs.buyIn.on&&hs.buyIn.email===EM&&hs.players.every(p=>p.pay==='none')&&hs.buyIn.pot===0,'Play again: settings kept, statuses reset');
 ok(await h.$eval('#startBtn',e=>e.disabled),'Play again: Start blocked until new buy-ins confirmed');
 // turn buy-in off via Edit -> Start works like before
 await h.evaluate(()=>{editBi();document.getElementById('ebion').checked=false;saveBi()});await sleep(600);hs=await h.evaluate(()=>st);
 ok(!hs.buyIn.on&&(await h.$eval('#startBtn',e=>!e.disabled)),'buy-in off: Start enabled, no gating');
 ok(await g.$eval('#bicard',e=>e.classList.contains('hidden')),'buy-in off: phone card hidden');
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL BUY-IN CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
