// Browser check of the +5/+10/+20/~10 bet buttons: node test/buttons.js <base>  (PWF = host PIN file)
const P=require('puppeteer-core'),fs=require('fs'),{io}=require('socket.io-client');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const h=io(B,{transports:['websocket']});const {pin}=await new Promise(r=>h.emit('host:create',{pw:PW,levelMin:10,turnSec:0},r));let hs;h.on('state',x=>hs=x);
const bots=[];for(const n of ['Gord','Sam']){const s=io(B,{transports:['websocket']});await new Promise(r=>s.emit('join',{pin,name:n},r));bots.push(s);let last='';
 s.on('state',st=>{const L=st.me&&st.me.legal;if(!L)return;const k=st.handNo+st.stage+st.currentBet+L.bet;if(k===last)return;last=k;setTimeout(()=>s.emit('act',{action:L.canCheck?'check':'call'},()=>{}),300)})}
const m=await b.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Phone_Phil');await m.click('#j button.red');await sleep(800);
await new Promise(r=>h.emit('host:start',{},r));
const myTurn=()=>m.waitForFunction(()=>!document.getElementById('actbox').classList.contains('hidden'),{timeout:60000});
const box=()=>m.$eval('#rzn',e=>+e.value),slider=()=>m.$eval('#rzr',e=>+e.value),label=()=>m.$eval('#bConfirm',e=>e.textContent);
await myTurn();await sleep(300);await m.click('#bRaise');await sleep(200);
const L=await m.evaluate(()=>st.me.legal);console.log(`  legal: min ${L.minTo}, all-in ${L.maxTo}, ${L.isBet?'bet':'raise'}`);
const v0=await box();ok(v0===L.minTo,`opens at min ${v0}`);
await m.click('.add button:nth-child(1)');await m.click('.add button:nth-child(1)');ok(await box()===v0+10,`+5 twice -> ${await box()}`);
await m.click('.add button:nth-child(3)');ok(await box()===v0+30,`+20 -> ${await box()}`);ok(await slider()===await box(),'slider in sync');
await m.click('.add button:nth-child(2)');ok(await box()===v0+40,`+10 -> ${await box()}`);
await m.evaluate(()=>setVal(22));await m.click('.add button:nth-child(4)');ok(await box()===30,`22 then ~10 -> ${await box()}`);
await m.click('.add button:nth-child(4)');ok(await box()===40,`30 then ~10 -> ${await box()}`);
await m.evaluate(()=>setVal(3));ok(await box()===L.minTo,`below min clamps to ${await box()}`);
for(let i=0;i<8;i++)await m.click('.add button:nth-child(3)');ok(await box()===L.maxTo&&/All-in/.test(await label()),`capped at all-in: ${await box()} "${await label()}"`);
// place a real bet via buttons: min, +5 twice, ~10
await m.click('.quick button:nth-child(1)');await m.click('.add button:nth-child(1)');await m.click('.add button:nth-child(1)');await m.click('.add button:nth-child(4)');
const want=await box();await m.screenshot({path:'screens/v3-raise-buttons.png'});await m.click('#bConfirm');await sleep(1200);
const line=hs.log.find(l=>/^Phone_Phil (raises to|bets) /.test(l));ok(line&&line.endsWith(' '+want),`server accepted: "${line}" (wanted ${want})`);
// next turn: bet over stack via +20s -> all-in accepted
await myTurn().catch(()=>{});
b.close();h.close();bots.forEach(s=>s.close());console.log(fails?`${fails} FAILURES`:'ALL BUTTON CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
