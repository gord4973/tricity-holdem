// Browser check: End game (host + 2 phones) and bet buttons on a fresh phone load. node test/endgame.js <base>  (PWF = host PIN file)
const P=require('/workspace/quiz-app/node_modules/puppeteer-core'),fs=require('fs');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const r=await fetch(B+'/j/1234');ok(/no-store/.test(r.headers.get('cache-control')||''),'player page Cache-Control: '+r.headers.get('cache-control'));const body=await r.text();
 ok(/cards\.js\?v=/.test(body)&&/style\.css\?v=/.test(body),'JS/CSS have cache-busting ?v= ('+(body.match(/cards\.js\?v=([^ >"]+)/)||[])[1]+')');ok(body.includes('roundV'),'player page includes the +5/+10/+20/~10 buttons');
 const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 const phones=[];for(const n of['Gord','Sam']){const ctx=await b.createBrowserContext();const m=await ctx.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm',n);await m.click('#j button.red');phones.push(m)}
 await sleep(800);await h.evaluate(()=>cmd('host:start'));await sleep(1200);
 // whoever is to act opens the raise panel; check the add buttons are visible
 let actor=null;for(const m of phones)if(await m.evaluate(()=>!document.getElementById('actbox').classList.contains('hidden')))actor=m;
 ok(!!actor,'a phone has the action buttons');await actor.click('#bRaise');await sleep(300);
 const labels=await actor.$$eval('.add button',bs=>bs.map(b=>b.offsetParent?b.textContent:null));ok(labels.join()==='+5,+10,+20,~10','bet buttons visible on fresh load: '+labels.join(' '));
 await actor.click('.add button:nth-child(3)');await actor.click('#bConfirm');await sleep(800); // raise so chips are in the pot
 const potBefore=await h.evaluate(()=>st.pot);ok(potBefore>3,'chips in the pot before End ('+potBefore+')');
 // End game with confirm: Cancel first, then Yes
 await h.click('.ctrls button.red');await sleep(200);ok(await h.$eval('#endModal',e=>!e.classList.contains('hidden')),'confirm dialog shown');
 await h.click('#endModal button.dark');await sleep(300);ok(await h.evaluate(()=>st.stage!=='gameover'),'Cancel keeps the game going');
 await h.click('.ctrls button.red');await sleep(200);await h.click('#endModal button.red');await sleep(1200);
 const hs=await h.evaluate(()=>st);ok(hs.stage==='gameover'&&hs.endedByHost,'host: game over, ended by host');
 ok(hs.players.reduce((a,p)=>a+p.chips,0)===240&&hs.players.every(p=>p.chips===120),'hand voided, bets returned: '+hs.players.map(p=>p.name+' '+p.chips).join(', '));
 ok(await h.$eval('#over',e=>!e.classList.contains('hidden'))&&await h.$eval('#ended',e=>!e.classList.contains('hidden')),'host shows GAME ENDED BY HOST + standings');
 ok((await h.$$('#stand .stand>div')).length===2,'host standings list 2 players');
 await h.screenshot({path:'screens/v4-host-ended.png'});
 for(const [i,m] of phones.entries()){const t=await m.$eval('#res',e=>e.textContent);ok(/Game ended by host/.test(t)&&/Gord/.test(t)&&/Sam/.test(t),`phone ${i+1} shows "Game ended by host" + standings`);ok(await m.$eval('#actbox',e=>e.classList.contains('hidden')),`phone ${i+1} has no action buttons`)}
 await phones[0].screenshot({path:'screens/v4-phone-ended.png'});
 await h.click('#over button.green');await sleep(800);ok(await h.evaluate(()=>st.stage==='lobby'&&st.players.length===2),'Play again returns to lobby with same players');
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL END-GAME CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
