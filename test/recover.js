// Seat-recovery checks (phone page + host page + raw sockets). Fast server: BOT_MS=300 AWAY_MS=4000 AWAY_FAST_MS=1000
// node test/recover.js <base>   (PWF = host PIN file, never printed)
const P=require('puppeteer-core'),fs=require('fs'),{io}=require('socket.io-client');
const B=process.argv[2]||'http://localhost:3462',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
const until=async(f,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await sleep(150)}return false};
const conn=()=>new Promise(r=>{const s=io(B,{transports:['websocket'],forceNew:true});s.once('connect',()=>r(s))});
const em=(s,e,o)=>new Promise(r=>s.emit(e,o,r));
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const h=await b.newPage();await h.setViewport({width:1920,height:1080});h.on('dialog',d=>d.accept());
 await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 await h.evaluate(()=>new Promise(r=>s.emit('host:addBot',{level:'medium'},r)));await h.evaluate(()=>new Promise(r=>s.emit('host:addBot',{level:'easy'},r)));
 const phone=async()=>{const c=await b.createBrowserContext();const m=await c.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});return [c,m]};
 let [c1,m]=await phone();await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Gord');await m.click('#j button.red');await sleep(600);
 const H=()=>h.evaluate(()=>st),G=async()=>(await H()).players.find(p=>p.name==='Gord'),sec=pg=>pg.evaluate(()=>[...document.querySelectorAll('section')].find(x=>!x.classList.contains('hidden')).id);
 await h.evaluate(()=>new Promise(r=>s.emit('host:start',{},r)));await sleep(800);
 const hole=()=>m.evaluate(()=>st&&st.me&&st.me.hole.join(' '));
 // 1) socket drop mid-hand -> auto reconnect, same seat + cards
 await until(async()=>['preflop','flop','turn','river'].includes((await H()).stage));const h1=await hole();const hand1=(await H()).handNo;
 await m.evaluate(()=>s.io.engine.close());await sleep(300);
 ok(await until(async()=>(await G()).connected&&await m.evaluate(()=>s.connected)),'socket drop mid-hand: phone reconnected automatically');
 const H1=await H();ok(H1.handNo!==hand1||await hole()===h1,'same seat and same cards after reconnect ('+h1+')');
 // 2) token-only rejoin (page reload, new socket)
 await m.reload({waitUntil:'networkidle0'});ok(await until(async()=>(await G()).connected&&(await sec(m))==='g'),'reload: token-only rejoin back to the game screen');
 // 3) action-retry path: seat taken by another socket (the kick notice is lost), which then drops -> the phone is connected but unbound (the original bug)
 const tokenOf=()=>m.evaluate(()=>JSON.parse(localStorage.getItem('holdemSeat')).token);
 await m.evaluate(()=>{s.off('kicked');window._ev=[];const o=s.emit.bind(s);s.emit=(e,...a)=>{window._ev.push(e);return o(e,...a)}});
 ok(await until(()=>m.evaluate(()=>!!(st&&st.me&&st.me.legal)),60000),'Gord has a turn');
 const z=await conn();const zr=await em(z,'join',{pin,token:await tokenOf()});ok(zr.ok,'another socket took the seat with the token (its kick notice to the phone is lost)');z.close();
 ok(await until(async()=>!(await G()).connected,3000),'host shows Gord away while his phone is still connected - the reported dead state');
 const res=await m.evaluate(()=>new Promise(r=>{window._ev=[];const L=st.me.legal;send('act',{action:L.canCheck?'check':'call'},x=>r({x,ev:window._ev.slice()}))}));
 ok(res.x&&res.x.ok&&res.ev.filter(e=>!e.startsWith('rtc')).join()==='act,join,act','tapping an action got "not in a game", rejoined with the token and retried: '+JSON.stringify(res));
 ok((await G()).connected,'host shows Gord connected again');
 // 3b) heartbeat path: unbind again, no action -> heartbeat rebinds within ~12s
 const z2=await conn();await em(z2,'join',{pin,token:await tokenOf()});z2.close();await until(async()=>!(await G()).connected,5000);
 ok(await until(async()=>(await G()).connected,15000),'heartbeat re-binds an idle phone automatically');
 await m.evaluate(()=>s.on('kicked',x=>{if(x&&x.soft){parked=true;Voice.reset();showRejoin(x.msg)}}));
 // 4) manual rejoin by name: rejected while connected
 let [c2,m2]=await phone();await m2.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m2.type('#nm','Gord');await m2.click('#j button.red');await sleep(500);
 ok(await m2.$eval('#errrj',e=>!e.classList.contains('hidden')),'join screen offers "Rejoin my seat" for an existing name');
 await m2.click('#errrj');await sleep(200);await m2.click('#rj button.red');await sleep(600);
 const rjErr=await m2.$eval('#rjerr',e=>e.textContent);ok(/still connected/.test(rjErr),'rejoin by name refused while the seat is connected: '+rjErr);
 // 5) Gord goes away (phone closed); game keeps going with auto check/fold, chips + seat kept
 const chipsBefore=(await G()).chips;await c1.close();
 ok(await until(async()=>!(await G()).connected,60000),'host shows Gord away after his phone closes');
 const hn=(await H()).handNo;ok(await until(async()=>(await H()).handNo>=hn+2,200000),'game keeps going while Gord is away');
 const x5=await H();ok(x5.log.some(l=>/Gord (checks|folds) \(away\)/.test(l))||x5.players.find(p=>p.name==='Gord').lastAction,'away turns auto-acted: '+x5.log.filter(l=>/Gord/.test(l)).slice(-2).join(' | '));ok(x5.players.some(p=>p.name==='Gord'&&!p.out),'Gord keeps his seat');
 await h.screenshot({path:'screens/v9-host-away.png'});
 // host can open the reconnect panel on his seat
 await h.evaluate(()=>rejoinModal(st.players.find(p=>p.name==='Gord').id));await h.click('#rjBtn');await sleep(500);
 const url=await h.$eval('#rjUrl',e=>e.textContent);ok(/\/j\/\d{4}\?r=[0-9a-f]{12}$/.test(url),'host "Let Gord rejoin" shows a reconnect link + QR');await h.screenshot({path:'screens/v9-host-rejoin.png'});
 await h.click('#rjModal button.dark');
 // manual rejoin by name now works
 await m2.click('#rj button.red');ok(await until(async()=>['g','w'].includes(await sec(m2))&&(await G()).connected),'rejoin by PIN + name works while away');
 ok(await m2.evaluate(()=>st.me.hole.length===2||!['preflop','flop','turn','river'].includes(st.stage)),'cards are back on the phone');
 await m2.screenshot({path:'screens/v9-phone-back.png'});
 // 6) host link takes over (e.g. stuck phone); the old screen is parked with a clear choice
 let [c3,m3]=await phone();await m3.goto(B+url.replace(/^https?:\/\/[^/]+/,''),{waitUntil:'networkidle0'});
 ok(await until(async()=>['g','w'].includes(await sec(m3))),'reconnect link puts Gord back in his seat');
 ok(await until(async()=>(await sec(m2))==='rj'&&await m2.$eval('#rjuse',e=>!e.classList.contains('hidden'))),'old screen shows "Use this screen" instead of a dead error');
 await m2.screenshot({path:'screens/v9-phone-parked.png'});
 ok((await em(await conn(),'join',{pin,rejoin:url.split('r=')[1]})).code==='rejoinExpired','a used link cannot be reused');
 const hz=await (await fetch(B+'/healthz')).json();ok(hz.botErrors===0,'bot errors: '+hz.botErrors);
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL RECOVERY CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
