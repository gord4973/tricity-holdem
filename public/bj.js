// Tricity Free Bet Blackjack - shared client helpers (needs cards.js for cardHTML/esc/money)
const DEN=[{v:10000,c:'k100',l:'100'},{v:2500,c:'k25',l:'25'},{v:500,c:'k5',l:'5'},{v:250,c:'k2',l:'2½'}];
const POG=[[1,3],[2,12],[3,30],[4,60],[5,100],[6,250],[7,1000]];
// color-up: break any amount into the fewest $100/$25/$5/$2.50 chips
function breakChips(c){const out=[];for(const d of DEN){const n=Math.floor(c/d.v);out.push({...d,n});c-=n*d.v}return out}
const chipHTML=(d,cls='')=>`<span class="chip ${d.c} ${cls}"><span>${d.l}</span></span>`;
function stackHTML(c,max=8){if(!c)return'';return `<span class=stk>${breakChips(c).filter(d=>d.n).map(d=>`<span class=col>${Array.from({length:Math.min(d.n,max)},()=>chipHTML(d)).join('')}${d.n>max?`<span class=cnt>×${d.n}</span>`:''}</span>`).join('')}</span>`}
// real chip rack: {10000:n,2500:n,500:n,250:n}
const rackAvail=(p)=>{const r=p.rack||{},m=(p.bet&&p.bet.mc)||{},g=(p.bet&&p.bet.pc)||{},a={};for(const d of DEN)a[d.v]=(r[d.v]||0)-(m[d.v]||0)-(g[d.v]||0);return a};
function rackHTML(r,max=8){const cols=DEN.filter(d=>r[d.v]>0);if(!cols.length)return'';return `<span class=stk>${cols.map(d=>`<span class=col>${Array.from({length:Math.min(r[d.v],max)},()=>chipHTML(d)).join('')}${r[d.v]>max?`<span class=cnt>×${r[d.v]}</span>`:''}</span>`).join('')}</span>`}
const rackTxt=r=>DEN.filter(d=>r[d.v]>0).map(d=>`${r[d.v]} × $${d.v===250?'2.50':d.v/100}`).join(' · ');
const CHG=[['break100','Break $100 → 4 × $25',10000,1],['break25','Break $25 → 5 × $5',2500,1],['up5','Color up 5 × $5 → $25',500,5],['up25','Color up 4 × $25 → $100',2500,4],['up250','Trade 2 × $2.50 → $5',250,2]];
const lammerHTML=c=>`<span class=lammer title="Free bet ${money(c)}"><b>${money(c).replace('$','$')}</b></span>`;
const RES={win:'WIN',blackjack:'BLACKJACK 3:2',push:'PUSH',push22:'PUSH 22',lose:'LOSE',bust:'BUST'};
const resHTML=r=>r?`<span class="res ${r}">${RES[r]||r}</span>`:'';
// remember which cards have already been shown so only new ones animate in
const _seenCards=new Set();
function cardsHTML(cards,key){return cards.map((c,i)=>{const k=key+':'+i+':'+c;const isNew=!_seenCards.has(k);_seenCards.add(k);return cardHTML(c,isNew?'deal':'')}).join('')}
function handHTML(h,key,{active=false,unit=0,idx=0,count=1,dim=false}={}){
 const bet=count>1?`<div class=hbet>${[h.cash?money(h.cash):'',h.free?`<span style="color:#f3c432">🪙${money(h.free)} free</span>`:''].filter(Boolean).join(' + ')}</div>`:'';
 return `<div class="hand${active?' act':''}${dim?' dim':''}">${count>1?`<div class=htag>${active?'▶ ':''}HAND ${idx+1} of ${count}</div>`:''}<div class=cards>${cardsHTML(h.cards,key)}</div><div class=lbl>${esc(h.label)}</div><div class=lams>${h.freeSplit?lammerHTML(unit):''}${h.freeDouble?lammerHTML(unit):''}</div>${h.cash?`<div class=hcash>${stackHTML(h.cash,5)}</div>`:''}${bet}${resHTML(h.result)}</div>`}
const lamCount=b=>b?b.lammers:0;
function payTableHTML(){return `<table class=paytab><tr><td colspan=2 style="color:#f3c432;text-align:center">🪙 POT OF GOLD</td></tr>${POG.map(([n,p])=>`<tr><td>${n}${n===7?'+':''} lammer${n>1?'s':''}</td><td>${p}:1</td></tr>`).join('')}</table>`}
function rulesHTML(st){const s=st.settings;return `<ul class=rules style="text-align:left;padding-left:1.1em;margin:.4em 0">
<li><b>Blackjack pays 3 to 2.</b> Dealer hits soft 17. 6-deck shoe, reshuffled at the cut card.</li>
<li><b>FREE DOUBLE</b> on any two-card hard 9, 10 or 11 — a gold lammer matches your bet.</li>
<li><b>FREE SPLIT</b> on every pair except 10s. Resplit up to 4 hands (aces too). Split aces get one card.</li>
<li>Paid doubles on any other two cards, paid split of 10s, double after split allowed. No surrender.</li>
<li><b>DEALER 22 PUSHES</b> every hand still in play (your blackjack still pays 3:2).</li>
<li>Free bets: a winning hand is paid even money on the lammer too; a losing hand only loses your own chips.</li>
<li>Insurance pays 2 to 1 when the dealer shows an Ace. Dealer peeks for blackjack on an Ace or 10.</li>
<li>Table limits ${money(s.minBet)} – ${money(s.maxBet)}.${s.pog?` Pot of Gold side bet ${money(s.pogMin)} – ${money(s.pogMax)}, paid on the lammers you collect in the round:`:''}</li></ul>${s.pog?payTableHTML():''}`}
function announce(x){const r=x.result;if(!r)return'';return r.dealerBJ?'Dealer has Blackjack':r.d22?'Dealer has 22 — all hands push!':r.dBust?`Dealer busts with ${r.dealer}!`:`Dealer has ${r.dealer}`}
function netTxt(n){return n>0?'+'+money(n):n<0?'−'+money(-n):'Push'}
