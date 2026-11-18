// Browser check of final standings: 1 human + 5 bots, human busts 3rd, End game; then a natural game over.
// Needs a fast server: BOT_MS=120 SHOWDOWN_MS=150 FOLDWIN_MS=100.  node test/standings.js <base>   (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs');
const B=process.argv[2]||'http://localhost:3461',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
const AUTO=()=>{clearInterval(window._auto);window._auto=setInterval(()=>{const L=st&&st.me&&st.me.legal;if(!L||window._busy)return;window._busy=1;const alive=st.players.filter(p=>!p.out).length;
  s.emit('act',alive<=3?{action:'allin'}:{action:L.canCheck?'check':'fold'},()=>{window._busy=0})},60)};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});h.on('dialog',d=>d.accept());
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#bion');await h.type('#biemail','host.test@example.com');await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 for(const lv of['easy','medium','hard','hard','medium'])await h.evaluate(lv=>new Promise(r=>s.emit('host:addBot',{level:lv},r)),lv);
 const ctx=await b.createBrowserContext();const m=await ctx.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(600);
 const st=()=>h.evaluate(()=>st);let x=await st();const gid=x.players.find(p=>p.name==='Gord').id;
 let got=false;
 for(let g=1;g<=14&&!got;g++){
  x=await st();await h.evaluate(id=>new Promise(r=>s.emit('host:confirm',{id,on:true},r)),gid);await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));await m.evaluate(AUTO);
  const t0=Date.now();let lastH=0;while(Date.now()-t0<300000){x=await st();const me=x.players.find(p=>p.id===gid);if(x.stage==='gameover'||me.out)break;if(x.handNo!==lastH&&x.handNo%25===0&&(lastH=x.handNo)&&x.stage==='handover')await h.evaluate(()=>new Promise(r=>s.emit('host:nextLevel',{},r)));await sleep(100)}
  const alive=x.players.filter(p=>!p.out).length;
  const me2=x.players.find(p=>p.id===gid);const sameHand=x.players.filter(p=>p.out&&p.id!==gid&&p.outHand===me2.outHand).length;
  if(x.stage!=='gameover'&&alive===2&&!sameHand){await h.evaluate(()=>new Promise(r=>s.emit('host:pause',{paused:true},r)));x=await st();got=x.stage!=='gameover';if(got)break}
  console.log(`  (game ${g}: Gord finished with ${alive} left${sameHand?' (tied hand)':''}, retrying)`);
  if(x.stage!=='gameover')await h.evaluate(()=>new Promise(r=>s.emit('host:end',{},r)));await sleep(300);await h.evaluate(()=>new Promise(r=>s.emit('host:playAgain',{},r)));await sleep(300);
 }
 ok(got,'reached: Gord busted 3rd with 2 bots left');
 await m.evaluate(()=>clearInterval(window._auto));
 // reconnect the phone before End (elimination data must survive)
 await m.reload({waitUntil:'networkidle0'});await sleep(1200);
 await h.click('.ctrls button.red');await sleep(200);await h.click('#endModal button.red');await sleep(1200);
 x=await st();const names=x.standings.map(r=>r.name);
 ok(x.stage==='gameover'&&x.endedByHost,'host ended the game');
 ok(x.standings[2].id===gid&&x.standings[2].rank===3,'Gord is 3rd on the leaderboard: '+x.standings.map(r=>`${r.rank}.${r.name}(${r.chips}${r.out?',out#'+r.outHand:''})`).join(' '));
 ok(x.standings.slice(2).every((r,i,a)=>!i||a[i-1].outHand>=r.outHand),'0-chip players listed last-out first, first-out at the bottom');
 const hostRows=await h.$$eval('#stand .stand>div',d=>d.map(e=>e.innerText.replace(/\s+/g,' ')));ok(/Gord/.test(hostRows[2])&&/🥉/.test(hostRows[2]),'host screen row 3: '+hostRows[2]);
 const phoneRows=await m.$$eval('#res .stand>div',d=>d.map(e=>e.innerText.replace(/\s+/g,' ')));ok(/Gord/.test(phoneRows[2]),'phone leaderboard row 3: '+phoneRows[2]);
 const msg=await m.$eval('#status',e=>e.innerText);ok(/finished #3/.test(msg),'phone says: '+msg);
 ok(x.buyIn.payTo==='Gord'&&x.buyIn.botWinner,'payout uses same ranking: pay to '+x.buyIn.payTo+', bot winner '+x.buyIn.botWinner);
 await h.screenshot({path:'screens/v8-host-standings.png'});await m.screenshot({path:'screens/v8-phone-standings.png'});
 // natural game over
 await h.click('#over button.green');await sleep(600);x=await st();ok(x.players.every(p=>p.chips===120&&!p.out),'Play again resets chips/out');
 await h.evaluate(id=>new Promise(r=>s.emit('host:confirm',{id,on:true},r)),gid);await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));await m.evaluate(AUTO);
 const t1=Date.now();while(Date.now()-t1<240000){x=await st();if(x.stage==='gameover')break;if(x.handNo%10===0&&x.stage==='handover')await h.evaluate(()=>new Promise(r=>s.emit('host:nextLevel',{},r)));await sleep(150)}
 await m.evaluate(()=>clearInterval(window._auto));await sleep(800);x=await st();
 ok(x.stage==='gameover'&&!x.endedByHost,'natural game over');
 ok(x.standings[0].name===x.winner&&x.standings[0].chips===720&&x.standings.slice(1).every((r,i,a)=>!i||a[i-1].outHand>=r.outHand),'natural: winner then reverse elimination order: '+x.standings.map(r=>`${r.rank}.${r.name}${r.out?'(out#'+r.outHand+')':''}`).join(' '));
 const pos=x.standings.findIndex(r=>r.id===gid)+1,msg2=await m.$eval('#status',e=>e.innerText);
 ok(x.winner==='Gord'?/won/.test(msg2):new RegExp('finished #'+x.standings[pos-1].rank).test(msg2),`phone message matches leaderboard (row ${pos}): ${msg2}`);
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL STANDINGS CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
