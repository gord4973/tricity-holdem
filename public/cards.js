const SUITSYM={s:'♠',h:'♥',d:'♦',c:'♣'};
function cardHTML(c,cls=''){if(!c)return `<span class="pc empty ${cls}"></span>`;if(c==='back')return `<span class="pc back ${cls}"></span>`;
 const r=c[0]==='T'?'10':c[0],red=c[1]==='h'||c[1]==='d';return `<span class="pc ${red?'red':''} ${cls}"><span class=r>${r}</span><span class=s>${SUITSYM[c[1]]}</span></span>`}
function boardHTML(b,win=[]){let h='';for(let i=0;i<5;i++)h+=cardHTML(b[i],b[i]&&win.length?(win.includes(b[i])?'win':'dim'):'');return h}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmss=ms=>{ms=Math.max(0,ms);const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function resultLines(st){const r=st.result;if(!r)return[];return r.pots.filter(p=>!p.uncalled).map(p=>`${r.pots.filter(x=>!x.uncalled).length>1?`<b>${esc(p.label)}</b> (${p.amount}): `:''}${p.winners.map(w=>esc(w.name)).join(' & ')} ${p.winners.length>1?'split':'wins'} ${p.winners.length>1?p.amount:p.winners[0].amount}${p.hand?` with <b>${esc(p.hand)}</b>`:''}`)}
function toast(m){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#e60012;color:#fff;font-weight:700;padding:10px 18px;border-radius:12px;z-index:99;box-shadow:0 6px 20px #0008;max-width:90vw;text-align:center';document.body.appendChild(t)}t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',2600)}
