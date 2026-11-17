// Browser check of voice chat with 3 headless phones (fake mic) + host screen. node test/voice.js <base>  (PWF = host PIN file)
const P=require('puppeteer-core'),fs=require('fs');
const B=process.argv[2]||'http://localhost:3460',PW=fs.readFileSync(process.env.PWF||'data/host_password.txt','utf8').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✖ FAIL ')+m);if(!c)fails++};
// NOTE: this box's Chrome policy disables non-proxied WebRTC UDP, so media can't flow here; this checks the
// full signaling handshake (offer -> answer applied, receive track attached). Real audio has to be checked on phones.
const bytesFrom=(pg,name)=>pg.evaluate(name=>{const id=st.players.find(p=>p.name===name).id,pc=Voice._pcs.inc[id];if(!pc)return -1;
 return pc.remoteDescription&&pc.localDescription&&pc.signalingState==='stable'&&pc.getReceivers().some(r=>r.track&&r.track.kind==='audio')&&document.querySelector(`audio[data-id="${id}"]`)?1000:0},name);
const waitFor=async(fn,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){if(await fn())return true;await sleep(400)}return false};
(async()=>{const html=await (await fetch(B+'/j/1')).text();ok(/voice\.js\?v=/.test(html),'player page loads voice.js with version '+(html.match(/voice\.js\?v=([^ >"]+)/)||[])[1]);
 const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const h=await b.newPage();await h.setViewport({width:1920,height:1080});await h.goto(B+'/host',{waitUntil:'networkidle0'});await h.evaluate(()=>localStorage.clear());await h.type('#pw',PW);await h.click('#login button.red');
 await h.waitForFunction(()=>/\d{4}/.test(document.getElementById('pin').textContent));const pin=await h.$eval('#pin',e=>e.textContent);
 const ph={};for(const n of['Ann','Ben','Cal']){const ctx=await b.createBrowserContext();const m=await ctx.newPage();await m.setViewport({width:390,height:844,isMobile:true});await m.goto(B+'/j/'+pin,{waitUntil:'networkidle0'});await m.type('#nm',n);await m.click('#j button.red');ph[n]=m}
 await sleep(1000);ok(await ph.Ann.$eval('#bMic',e=>e.offsetParent!==null&&/Mic off/.test(e.textContent)),'mic button visible in lobby, default "Mic off"');
 // Ann turns mic on in the lobby
 await ph.Ann.click('#bMic');await sleep(500);ok(await ph.Ann.$eval('#bMic',e=>/Mic on/.test(e.textContent)&&e.className.includes('on')),'Ann: button shows green "Mic on"');
 ok(await waitFor(async()=>(await bytesFrom(ph.Ben,'Ann'))>500),'Ben has a live audio connection from Ann (offer/answer done, track attached)');
 ok(await waitFor(async()=>(await bytesFrom(ph.Cal,'Ann'))>500),'Cal receives Ann\'s audio');
 ok(await ph.Ben.evaluate(()=>!!document.querySelector('audio[data-id]')&&document.querySelector('audio[data-id]').hasAttribute('playsinline')),'Ben has a playsinline <audio> element for Ann');
 ok(await h.evaluate(()=>st.players.find(p=>p.name==='Ann').mic),'host knows Ann\'s mic is on');
 await h.evaluate(()=>cmd('host:start'));await sleep(1500);
 ok(await h.evaluate(()=>[...document.querySelectorAll('.seat')].some(s=>s.querySelector('.nm').textContent==='Ann'&&s.querySelector('.vmic'))),'host seat shows 🎤 on Ann');
 ok(await waitFor(()=>h.evaluate(()=>st.players.find(p=>p.name==='Ann').speaking),8000),'speaking indicator reaches host (fake mic tone)');
 await h.screenshot({path:'screens/v5-host-voice.png'});await ph.Ann.screenshot({path:'screens/v5-phone-voice.png'});
 ok(await ph.Cal.evaluate(()=>/🎤|🗣️/.test(document.getElementById('plist').textContent)),'phones show mic icon in player list');
 // Ben also talks -> Ann hears Ben
 await ph.Ben.click('#bMic');ok(await waitFor(async()=>(await bytesFrom(ph.Ann,'Ben'))>500),'Ann receives Ben\'s audio (two talkers)');
 // Ben reloads (reconnect): keeps seat, mic resets to off, still hears Ann
 await ph.Ben.reload({waitUntil:'networkidle0'});await sleep(1500);
 ok(await ph.Ben.$eval('#bMic',e=>/Mic off/.test(e.textContent)),'after reload Ben\'s mic is off');
 ok(await waitFor(async()=>(await bytesFrom(ph.Ben,'Ann'))>500),'after reload Ben hears Ann again');
 ok(await waitFor(()=>h.evaluate(()=>!st.players.find(p=>p.name==='Ben').mic)),'host shows Ben mic off after reload');
 // Ann mic off -> connections closed everywhere
 await ph.Ann.click('#bMic');await sleep(1500);
 const sb=await ph.Ben.evaluate(()=>Voice.stats),sc=await ph.Cal.evaluate(()=>Voice.stats);ok(sb.inc===0&&sb.audios===0&&sc.inc===0,'Ann mic off: listeners closed her audio '+JSON.stringify([sb,sc]));
 ok(await h.evaluate(()=>!st.players.find(p=>p.name==='Ann').mic&&!document.querySelector('.vmic')),'host: no mic icons');
 // End game + Play again: voice still works
 await h.click('.ctrls button.red');await sleep(200);await h.click('#endModal button.red');await sleep(800);await h.click('#over button.green');await sleep(800);
 await ph.Cal.click('#bMic');ok(await waitFor(async()=>(await bytesFrom(ph.Ann,'Cal'))>500),'after End game + Play again, Ann hears Cal');
 // gameplay still works with voice on
 await h.evaluate(()=>cmd('host:start'));await sleep(1200);ok(await h.evaluate(()=>st.stage==='preflop'&&st.handNo===1),'new game deals normally with a mic on');
 await ph.Cal.click('#bMic');await sleep(600);ok(await ph.Cal.evaluate(()=>!Voice.micOn),'Cal mic off');
 await b.close();console.log(fails?`${fails} FAILURES`:'ALL VOICE CHECKS PASSED');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(2)});
