// Browser check: showdown summary sorted best → worst on host and phone. node test/showdown.js <base>  (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs');const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 for(const lv of['easy','easy','easy'])await h.evaluate(lv=>new Promise(r=>s.emit('host:addBot',{level:lv},r)),lv);
 const c=await b.createBrowserContext();const m=await c.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(500);
 await m.evaluate(()=>setInterval(()=>{const L=st&&st.me&&st.me.legal;if(L&&!window._b){window._b=1;send('act',{action:L.canCheck?'check':'call'},()=>{window._b=0})}},200));
 await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));
 let x;const t0=Date.now();while(Date.now()-t0<240000){x=await h.evaluate(()=>st);if(x.result&&!x.result.byFold&&x.result.shown.length>=3&&x.stage==='handover')break;await sleep(250)}
 ok(x.result&&x.result.shown.length>=3,'reached a showdown with '+(x.result?x.result.shown.length:0)+' hands');await sleep(600);
 const ranks=x.result.shown.map(s=>s.rank);ok(ranks.every((r,i)=>!i||ranks[i-1]<=r),'server order best → worst: '+x.result.shown.map(s=>s.rank+'.'+s.name+' '+s.hand).join(' | '));
 const hostRows=await h.$$eval('.sdlist>div',d=>d.map(e=>e.innerText));ok(hostRows.length===x.result.shown.length+(x.result.folded||[]).length&&hostRows.slice(0,x.result.shown.length).every((t,i)=>t.includes(x.result.shown[i].name)),'host list in the same order: '+hostRows.join(' | '));
 const phRows=await m.$$eval('#res .sd',d=>d.map(e=>e.innerText.replace(/\s+/g,' ')));ok(phRows.slice(0,x.result.shown.length).every((t,i)=>t.includes(x.result.shown[i].name)),'phone list in the same order: '+phRows.join(' | '));
 ok((x.result.folded||[]).every(f=>phRows.slice(x.result.shown.length).some(t=>t.includes(f.name))),'folded players listed below the shown hands');
 await h.screenshot({path:'screens/v10-host-showdown.png'});await m.screenshot({path:'screens/v10-phone-showdown.png'});
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL SHOWDOWN CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
