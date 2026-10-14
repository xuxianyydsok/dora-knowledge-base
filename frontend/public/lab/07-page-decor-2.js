
const $=id=>document.getElementById(id);
const vis=new Map();const io=new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)));
const watch=el=>{vis.set(el,true);io.observe(el)};
function loop(el,fn){watch(el);(function f(t){requestAnimationFrame(f);if(vis.get(el))fn(t/1000)})(0)}
// 114 tag sphere
(function(){const box=$('ts'),W=['音乐','电影','RSS','博客','摄影','代码','设计','旅行','读书','咖啡','夜晚','爵士','纪录片','Cloudflare','自建','笔记','日记','科幻','独立','相册','播客','效率'],N=W.length,P=[],E=[];
 W.forEach((w,i)=>{const y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y),t=i*2.399963,s=document.createElement('span');s.textContent=w;box.appendChild(s);E.push(s);P.push([Math.cos(t)*r,y,Math.sin(t)*r])});
 let ax=.004,ay=.006;box.addEventListener('pointermove',e=>{const r=box.getBoundingClientRect();ay=((e.clientX-r.left)/r.width-.5)*.04;ax=-((e.clientY-r.top)/r.height-.5)*.04});
 loop(box,()=>{const cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay);P.forEach((p,i)=>{let[x,y,z]=p;let y1=y*cx-z*sx,z1=y*sx+z*cx;let x2=x*cy+z1*sy,z2=-x*sy+z1*cy;P[i]=[x2,y1,z2];const d=(z2+1)/2,s=E[i];s.style.transform=`translate(-50%,-50%) translate(${x2*115}px,${y1*115}px) scale(${.6+d*.7})`;s.style.opacity=.2+.8*d;s.style.color=`hsl(${(i*37+240)%360} 70% ${d>.5?55:70}%)`;s.style.zIndex=Math.round(d*10)})})})();
// 115 calendar
(function(){const n=new Date(),y=n.getFullYear(),m=n.getMonth(),f=new Date(y,m,1).getDay(),dm=new Date(y,m+1,0).getDate();$('cm').textContent=`${y}年${m+1}月`;const g=$('cg');'日一二三四五六'.split('').forEach(c=>g.insertAdjacentHTML('beforeend',`<b>${c}</b>`));
 for(let i=0;i<f;i++)g.insertAdjacentHTML('beforeend','<i></i>');for(let d=1;d<=dm;d++){const c=['',Math.random()<.4?'p':'',d===n.getDate()?'t':''].join(' ').trim();g.insertAdjacentHTML('beforeend',`<i class="${c}" style="--d:${(f+d)*22}ms">${d}</i>`)}})();
// 117 clock
(function(){const t=$('mt'),d=$('md');function u(){const n=new Date();t.textContent=n.toTimeString().slice(0,5);d.textContent=n.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}u();setInterval(u,10000)})();
// 118 turntable
$('tt').onclick=e=>e.currentTarget.classList.toggle('on');
// 119 progress
(function(){let s=0;setInterval(()=>{s=(s+1)%204;$('pbi').style.width=s/204*100+'%';$('p1').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000)})();
// 120 card stack
(function(){const box=$('ck'),D=[['RSS · 今日精选','十个值得收藏的自建服务','#ff6a4a,#9b6bff'],['博客','我的音乐库是怎么搭起来的','#2b6bd9,#33d6e8'],['影视','本周新入库的纪录片','#9b6bff,#ff4fa3'],['订阅','设计师都在读的周刊','#2fb45a,#2b6bd9']],cs=D.map(d=>{const e=document.createElement('div');e.style.background=`linear-gradient(135deg,${d[2]})`;e.innerHTML=`<small>${d[0]}</small><b>${d[1]}</b>`;box.appendChild(e);return e});let order=[...cs];
 function R(){order.forEach((e,i)=>{e.style.zIndex=10-i;e.style.opacity=1-i*.22;e.style.transform=`translateY(${i*16}px) scale(${1-i*.06})`})}R();
 setInterval(()=>{const top=order[0];top.style.transform='translateX(130%) rotate(14deg)';top.style.opacity=0;setTimeout(()=>{order.push(order.shift());top.style.transition='none';R();void top.offsetWidth;top.style.transition=''},650)},2800)})();
// 121 rain
(function(){const c=$('rain'),x=c.getContext('2d'),fs=15,cols=Math.floor(c.width/fs),dr=Array(cols).fill(0).map(()=>Math.random()*20),ch='音乐影视订阅库01博客夜光海山风云';
 let tick=0;loop(c,()=>{if(++tick%3)return;x.fillStyle='rgba(13,14,20,.14)';x.fillRect(0,0,c.width,c.height);x.font=fs+'px monospace';dr.forEach((y,i)=>{x.fillStyle=`hsl(${230+Math.random()*60},90%,${60+Math.random()*25}%)`;x.fillText(ch[Math.random()*ch.length|0],i*fs,y*fs);dr[i]=y*fs>c.height&&Math.random()>.97?0:y+1})})})();
// 122 galaxy
(function(){const c=$('gal'),x=c.getContext('2d'),P=[];for(let i=0;i<1600;i++){const r=Math.pow(Math.random(),.65)*125,arm=i%3,sp=(Math.random()-.5)*(.5+r/60);P.push({r,a:r*.05+arm*2.094+sp,h:190+r*1.4+Math.random()*30,s:.5+Math.random()*1.3})}
 loop(c,t=>{x.fillStyle='rgba(13,14,20,.35)';x.fillRect(0,0,320,300);P.forEach(p=>{const a=p.a+t*18/(p.r+25);x.fillStyle=`hsla(${p.h},85%,${60+(1-p.r/125)*25}%,${.35+(1-p.r/125)*.6})`;x.beginPath();x.arc(160+Math.cos(a)*p.r,150+Math.sin(a)*p.r*.5,p.s,0,7);x.fill()});const g=x.createRadialGradient(160,150,0,160,150,30);g.addColorStop(0,'#fff');g.addColorStop(.3,'#ffd9a8aa');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(120,110,80,80)})})();
// 123 radar
(function(){const s=$('rd'),L=['写作','摄影','代码','设计','阅读'],cx=150,cy=145,R=100;let h='';[.25,.5,.75,1].forEach(k=>h+=`<polygon class="g1" points="${L.map((_,i)=>{const a=i/5*6.2832-1.5708;return(cx+Math.cos(a)*R*k)+','+(cy+Math.sin(a)*R*k)}).join(' ')}"/>`);
 L.forEach((l,i)=>{const a=i/5*6.2832-1.5708;h+=`<line class="ax" x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*R}" y2="${cy+Math.sin(a)*R}"/><text x="${cx+Math.cos(a)*(R+18)}" y="${cy+Math.sin(a)*(R+18)+4}" text-anchor="middle">${l}</text>`});h+='<polygon class="pg" id="pg"/>'+L.map((_,i)=>`<circle class="pt" r="4" id="pp${i}"/>`).join('');s.innerHTML=h;
 let cur=[.5,.5,.5,.5,.5],tg=cur.slice(),t0=0;function pick(){tg=cur.map(()=>.3+Math.random()*.7)}pick();setInterval(pick,2800);
 loop(s,()=>{cur=cur.map((v,i)=>v+(tg[i]-v)*.05);const pts=cur.map((v,i)=>{const a=i/5*6.2832-1.5708;return[cx+Math.cos(a)*R*v,cy+Math.sin(a)*R*v]});$('pg').setAttribute('points',pts.map(p=>p.join(',')).join(' '));pts.forEach((p,i)=>{const e=$('pp'+i);e.setAttribute('cx',p[0]);e.setAttribute('cy',p[1])})})})();
// 124 rank
(function(){const box=$('bar'),it=[['摇滚',60],['爵士',52],['电子',44],['民谣',38],['古典',30],['嘻哈',22]].map(([n,v])=>({n,v}));const els=it.map(o=>{const e=document.createElement('div');e.innerHTML=`<span>${o.n}</span><i></i><em></em>`;box.appendChild(e);return e});
 function R(){const s=[...it].sort((a,b)=>b.v-a.v),mx=s[0].v;it.forEach((o,i)=>{const e=els[i];e.style.transform=`translateY(${s.indexOf(o)*36}px)`;e.querySelector('i').style.width=o.v/mx*72+'%';e.querySelector('em').textContent=Math.round(o.v)})}R();setInterval(()=>{it.forEach(o=>o.v+=Math.random()*12);R()},1200)})();
// 125 dot ripple
(function(){const c=$('dc'),w=$('dw'),x=c.getContext('2d');let W,H,m=null,auto=0;function rs(){W=c.width=w.clientWidth;H=c.height=w.clientHeight||300}rs();addEventListener('resize',rs);
 w.addEventListener('pointermove',e=>{const r=w.getBoundingClientRect();m=[e.clientX-r.left,e.clientY-r.top]});w.addEventListener('pointerleave',()=>m=null);
 loop(c,t=>{x.clearRect(0,0,W,H);const o=m||[W/2+Math.cos(t*.5)*W*.25,H/2+Math.sin(t*.7)*H*.25],S=18;for(let i=S/2;i<W;i+=S)for(let j=S/2;j<H;j+=S){const d=Math.hypot(i-o[0],j-o[1]),k=Math.max(0,Math.sin(d*.045-t*4))*Math.exp(-d*.006);x.fillStyle=`hsla(${230+d*.3},85%,${55+k*30}%,${.25+k*.75})`;x.beginPath();x.arc(i,j,1.3+k*4.2,0,7);x.fill()}})})();
// 126 coverflow
(function(){const b=$('cfw'),N=7,E=[];for(let i=0;i<N;i++){const e=document.createElement('i'),h=i*51;e.style.background=`linear-gradient(135deg,hsl(${h},75%,60%),hsl(${(h+50)%360},70%,42%))`;e.onclick=()=>{cur=i;R()};b.appendChild(e);E.push(e)}
 let cur=3;function R(){E.forEach((e,i)=>{const o=i-cur;e.style.transform=`translateX(${o*62}px) translateZ(${-Math.abs(o)*70}px) rotateY(${-Math.sign(o)*Math.min(Math.abs(o),1)*52}deg) scale(${o===0?1.15:1})`;e.style.zIndex=10-Math.abs(o);e.style.filter=`brightness(${1-Math.min(Math.abs(o),3)*.18})`})}R();setInterval(()=>{cur=(cur+1)%N;R()},2200)})();
// 128 terminal
(function(){const pre=$('tm'),S=[['$ rss fetch --all','c'],['✔ 24 feeds updated','o'],['$ library scan music','c'],['✔ 1,280 tracks indexed','o'],['$ deploy --cloudflare','c'],['✔ live in 4.2s','o']];let html='';
 function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
 (async function run(){while(1){html='';pre.innerHTML='<span class="cu"></span>';for(const[l,k]of S){if(k==='c'){for(let i=1;i<=l.length;i++){pre.innerHTML=html+l.slice(0,i)+'<span class="cu"></span>';await sleep(45)}html+=l+'\n';await sleep(400)}else{html+=`<span class="ok">${l}</span>\n`;pre.innerHTML=html+'<span class="cu"></span>';await sleep(700)}}await sleep(2600)}})()})();
// 129 clock
(function(){const box=$('ck2'),ds=[];function mk(){const d=document.createElement('div');d.className='dg';d.innerHTML='<span>0</span>';return d}
 [0,1,'c',2,3,'c',4,5].forEach(v=>{if(v==='c'){const e=document.createElement('em');e.textContent=':';box.appendChild(e)}else{const d=mk();box.appendChild(d);ds.push(d)}});
 function set(d,v){if(d.dataset.v===String(v))return;d.dataset.v=v;const old=d.lastElementChild,n=document.createElement('span');n.textContent=v;n.className='in';d.appendChild(n);void n.offsetWidth;old.className='out';n.className='';setTimeout(()=>old.remove(),600)}
 function u(){const n=new Date(),s=[n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join('');[...s].forEach((c,i)=>set(ds[i],c))}u();setInterval(u,1000)})();
// 130 fireworks
(function(){const c=$('fc'),w=$('fw'),x=c.getContext('2d');let P=[];function L(px,py){const h=Math.random()*360;for(let i=0;i<70;i++){const a=Math.random()*6.2832,s=1+Math.random()*3.6;P.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,h:h+Math.random()*40})}}
 w.addEventListener('pointerdown',e=>{const r=c.getBoundingClientRect();L((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height)});setInterval(()=>L(40+Math.random()*260,40+Math.random()*130),1300);
 loop(c,()=>{x.fillStyle='rgba(13,14,20,.22)';x.fillRect(0,0,c.width,c.height);P=P.filter(p=>p.l>0);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.04;p.vx*=.985;p.l-=.012;x.fillStyle=`hsla(${p.h},90%,62%,${p.l})`;x.beginPath();x.arc(p.x,p.y,1.8,0,7);x.fill()})})})();
// 132 liquid
(function(){const l=$('lq'),ws=l.querySelectorAll('i'),n=$('lqn');function go(){const v=20+Math.round(Math.random()*70);ws.forEach((w,i)=>w.style.top=(180*(1-v/100)-(i?4:0)+0)+'px');let k=parseInt(n.textContent)||0;const t=setInterval(()=>{k+=Math.sign(v-k)*Math.ceil(Math.abs(v-k)/8);n.textContent=k+'%';if(k===v)clearInterval(t)},60)}setTimeout(go,300);setInterval(go,4200)})();
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
