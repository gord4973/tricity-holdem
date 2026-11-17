const P=require('puppeteer-core'),fs=require('fs'),{io}=require('socket.io-client');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim(),N=+(process.env.N||11);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const h=await b.newPage();await h.setViewport({width:1920,height:1080});
await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.type('#pw',PW);await h.screenshot({path:'screens/host-login.png'});await h.click('#login button.red');
await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
const names=['Gord','Sales_Sam','Fiona','Tech_Tony','Lot_Larry','Service_Sue','Parts_Pat','Mike','Jen','Ravi','Amar','Kelly','Dana','Lee','Omar','Tina','Bob','Zoe','Ken'];
const bots=[];for(let i=0;i<N;i++){const s=io(B,{transports:['websocket']});await new Promise(r=>s.emit('join',{pin,name:names[i]},r));bots.push(s);
 let last='';s.on('state',st=>{const L=st.me&&st.me.legal;if(!L)return;const k=st.handNo+st.stage+st.currentBet+L.bet;if(k===last)return;last=k;setTimeout(()=>s.emit('act',{action:Math.random()<.2&&!L.canCheck?'fold':Math.random()<.15&&L.canRaise?'raise':(L.canCheck?'check':'call'),amount:L.minTo*2},()=>{}),900)})}
const m=await b.newPage();await m.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm','Phone_Phil');await m.click('#j button.red');
await sleep(1200);await h.screenshot({path:'screens/host-lobby.png'});await m.screenshot({path:'screens/player-lobby.png'});
await h.evaluate(()=>cmd('host:start'));
// wait until it's the phone's turn
await m.waitForFunction(()=>!document.getElementById('actbox').classList.contains('hidden'),{timeout:60000});await sleep(500);
await h.screenshot({path:'screens/host-table.png'});await m.screenshot({path:'screens/player-turn.png'});
await m.click('#bRaise');await sleep(300);await m.screenshot({path:'screens/player-raise.png'});await m.click('#bConfirm');
// keep calling until a showdown appears on the host
for(let i=0;i<120;i++){const done=await h.evaluate(()=>st&&st.stage==='handover'&&st.result&&!st.result.byFold);if(done)break;
 const my=await m.evaluate(()=>!document.getElementById('actbox').classList.contains('hidden'));if(my)await m.evaluate(()=>callCheck());await sleep(500)}
await sleep(600);await h.screenshot({path:'screens/host-showdown.png'});await m.screenshot({path:'screens/player-showdown.png'});
await b.close();process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
