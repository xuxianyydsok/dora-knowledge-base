
const $=id=>document.getElementById(id);
const cv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// 102 heatmap
(function(){
 let s=20261014;const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
 const hg=$('hg'),ml=$('ml'),tip=$('tip');const today=new Date();today.setHours(0,0,0,0);
 const start=new Date(today);start.setDate(start.getDate()-52*7-today.getDay());
 let total=0,days=0,best=0,run=0;const mn=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];let lastM=-1;
 for(let w=0;w<53;w++)for(let d=0;d<7;d++){
  const dt=new Date(start);dt.setDate(start.getDate()+w*7+d);const i=document.createElement('i');
  if(dt>today){i.className='fu';hg.appendChild(i);continue}
  let v=rnd(),l=v<.42?0:v<.68?1:v<.85?2:v<.95?3:4;if((d===0||d===6)&&rnd()<.5)l=0;if(w>30&&w<36&&rnd()<.7)l=Math.max(l,2);
  const n=[0,1,2,3,5][l];total+=n;if(n){days++;run++;best=Math.max(best,run)}else run=0;
  i.dataset.l=l;i.style.setProperty('--d',(w*14+d*8)+'ms');i.dataset.t=`${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 · ${n?n+' 篇文章':'没有发文'}`;hg.appendChild(i);
  if(d===0&&dt.getMonth()!==lastM&&w<51){lastM=dt.getMonth();const m=document.createElement('span');m.style.left=w*16+'px';m.textContent=mn[lastM];ml.appendChild(m)}
 }
 $('hs').textContent=`过去一年共发布 ${total} 篇 · ${days} 天有记录 · 最长连续 ${best} 天`;
 hg.addEventListener('pointerover',e=>{if(e.target.dataset.t){const r=e.target.getBoundingClientRect();tip.textContent=e.target.dataset.t;tip.style.left=r.left+r.width/2+'px';tip.style.top=r.top+'px';tip.classList.add('on')}});
 hg.addEventListener('pointerout',()=>tip.classList.remove('on'));
 $('rp').onclick=()=>{hg.querySelectorAll('i').forEach(i=>{i.style.animation='none'});void hg.offsetWidth;hg.querySelectorAll('i').forEach(i=>i.style.animation='')};
})();
// visibility helper
const vis=new Map();const io=new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)));
function watch(el){vis.set(el,true);io.observe(el)}
// 101 globe
(function(){const c=$('gl'),x=c.getContext('2d'),N=460,P=[];for(let i=0;i<N;i++){const y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y),t=i*2.399963;P.push([Math.cos(t)*r,y,Math.sin(t)*r])}
 let a=0;watch(c);(function f(){requestAnimationFrame(f);if(!vis.get(c))return;a+=.007;x.clearRect(0,0,300,300);const R=104,ca=Math.cos(a),sa=Math.sin(a),ct=Math.cos(.45),st=Math.sin(.45);
 const q=P.map(p=>{const X=p[0]*ca+p[2]*sa,Z=-p[0]*sa+p[2]*ca,Y=p[1]*ct-Z*st,Z2=p[1]*st+Z*ct;return[X,Y,Z2]}).sort((u,v)=>u[2]-v[2]);
 q.forEach(p=>{const d=(p[2]+1)/2,h=(p[1]*80+a*50+p[0]*40+360)%360;x.fillStyle=`hsla(${h+200},85%,62%,${.15+.85*d})`;x.beginPath();x.arc(150+p[0]*R,150+p[1]*R,.8+d*2.2,0,7);x.fill()})})()})();
// 104 particles
(function(){const c=$('pc'),w=$('pw'),x=c.getContext('2d');let W,H,m={x:-999,y:-999};const P=[];
 function rs(){W=c.width=w.clientWidth;H=c.height=w.clientHeight||280}rs();addEventListener('resize',rs);
 for(let i=0;i<64;i++)P.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6});
 w.addEventListener('pointermove',e=>{const r=w.getBoundingClientRect();m.x=e.clientX-r.left;m.y=e.clientY-r.top});w.addEventListener('pointerleave',()=>m.x=-999);
 watch(c);(function f(){requestAnimationFrame(f);if(!vis.get(c))return;x.clearRect(0,0,W,H);
 P.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;const dx=m.x-p.x,dy=m.y-p.y,d=Math.hypot(dx,dy);if(d<130){p.x+=dx*.02;p.y+=dy*.02}
  x.fillStyle='#9aa7ff';x.beginPath();x.arc(p.x,p.y,2,0,7);x.fill();
  for(let j=i+1;j<P.length;j++){const q=P[j],e=Math.hypot(p.x-q.x,p.y-q.y);if(e<100){x.strokeStyle=`rgba(140,150,255,${1-e/100})`;x.lineWidth=1;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}})})()})();
// 105 spectrum
(function(){const c=$('sc'),x=c.getContext('2d'),B=72;let t=0;watch(c);(function f(){requestAnimationFrame(f);if(!vis.get(c))return;t+=.03;x.clearRect(0,0,300,300);
 const pulse=(Math.sin(t*2)+1)/2;x.fillStyle=`rgba(120,100,255,${.15+pulse*.15})`;x.beginPath();x.arc(150,150,58+pulse*8,0,7);x.fill();
 for(let i=0;i<B;i++){const a=i/B*Math.PI*2-Math.PI/2,amp=(Math.sin(t*2+i*.3)+Math.sin(t*3.1+i*.17)+Math.sin(t*1.3-i*.5)+3)/6,r0=66,r1=r0+8+amp*66;
  x.strokeStyle=`hsl(${230+i/B*90},85%,${60+amp*15}%)`;x.lineWidth=3.2;x.lineCap='round';x.beginPath();x.moveTo(150+Math.cos(a)*r0,150+Math.sin(a)*r0);x.lineTo(150+Math.cos(a)*r1,150+Math.sin(a)*r1);x.stroke()}})()})();
// 107 rings
(function(){const rs=[[$('r1'),540],[$('r2'),402],[$('r3'),264]],n=$('rn');function go(){const v=[.55+Math.random()*.4,.4+Math.random()*.5,.3+Math.random()*.6];rs.forEach(([e,c],i)=>e.style.strokeDashoffset=c*(1-v[i]));let k=0,tg=Math.round(v[0]*100);const t=setInterval(()=>{k+=Math.ceil((tg-k)/8)||1;if(k>=tg){k=tg;clearInterval(t)}n.textContent=k+'%'},60)}
 setTimeout(go,300);setInterval(go,3600)})();
// 109 bars
(function(){const b=$('br');for(let i=0;i<12;i++){const e=document.createElement('i');e.style.setProperty('--i',i);b.appendChild(e)}
 function go(){b.querySelectorAll('i').forEach(e=>{const v=15+Math.round(Math.random()*85);e.style.setProperty('--h',v+'%');e.dataset.v=v})}
 b.style.cssText+='';b.querySelectorAll('i').forEach(e=>e.style.setProperty('--h','0%'));setTimeout(go,300);b.onclick=go;setInterval(go,4500)})();
// 113 cover wall
(function(){const w=$('cw');for(let c=0;c<7;c++){const d=document.createElement('div');let h='';for(let i=0;i<16;i++){const a=Math.random()*360;h+=`<i style="background:linear-gradient(${Math.random()*360}deg,hsl(${a},75%,60%),hsl(${(a+60)%360},70%,45%))"></i>`}d.innerHTML=h+h;w.appendChild(d)}})();
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
