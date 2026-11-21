// Browser check for Stats: host checkbox + toggle button, phone stats panel. node test/stats-ui.js <base>  (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs');const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#ston');await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 await sleep(400);ok(/Stats for players: on/.test(await h.$eval('#lset',e=>e.innerText)),'lobby shows "Stats for players: on"');ok((await h.$eval('#statsBtn2',e=>e.textContent)).includes('ON'),'lobby toggle reads 📊 Stats: ON');
 for(const lv of['easy','medium'])await h.evaluate(lv=>new Promise(r=>s.emit('host:addBot',{level:lv},r)),lv);
 const c=await b.createBrowserContext();const m=await c.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(500);
 await m.evaluate(()=>setInterval(()=>{const L=st&&st.me&&st.me.legal;if(L&&!window._b){window._b=1;setTimeout(()=>send('act',{action:L.canCheck?'check':'call'},()=>{window._b=0}),1200)}},200));
 await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));
 let pre='',post='';const t0=Date.now();while(Date.now()-t0<120000){const x=await m.evaluate(()=>({b:st.board.length,t:document.getElementById('stats').innerText,stage:st.stage}));
  if(!pre&&x.b===0&&/\d+%/.test(x.t)){pre=x.t;await m.screenshot({path:'screens/v11-phone-stats-preflop.png'})}
  if(x.b>=3&&/\d+%/.test(x.t)&&['flop','turn','river'].includes(x.stage)){post=x.t;await m.screenshot({path:'screens/v11-phone-stats-flop.png'});break}await sleep(150)}
 ok(/Best hand: .+/.test(pre)&&/Win odds: \d+%/.test(pre),'phone pre-flop: '+pre.replace(/\n/g,' / '));ok(/Best hand: .+/.test(post)&&/Win odds: \d+%/.test(post),'phone after flop: '+post.replace(/\n/g,' / '));
 const hostTxt=await h.evaluate(()=>document.body.innerText);ok(!/Win odds|Best hand:/.test(hostTxt),'host screen never shows anyone\'s stats');
 ok((await h.$eval('#statsBtn',e=>e.textContent)).includes('ON'),'table toggle reads 📊 Stats: ON');await h.screenshot({path:'screens/v11-host-stats-on.png'});
 await h.click('#statsBtn');await sleep(1500);ok((await h.$eval('#statsBtn',e=>e.textContent)).includes('off'),'host turned Stats off mid-game');ok(!(await m.$eval('#stats',e=>e.innerText)).trim(),'phone stats panel disappears');
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL STATS UI CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
