
const $=id=>document.getElementById(id);
const vis=new Map(),io=new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)));
function loop(el,fn){vis.set(el,true);io.observe(el);let last=0;(function f(ms){requestAnimationFrame(f);if(!vis.get(el))return;const t=ms/1000;fn(t,Math.min(t-last,.05));last=t})(0)}
function setup(c){const o={c,x:c.getContext('2d'),W:300,H:300};const f=()=>{const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);o.W=r.width;o.H=r.height;c.width=r.width*d;c.height=r.height*d;o.x.setTransform(d,0,0,d,0,0)};f();new ResizeObserver(f).observe(c);return o}
function ptr(c,mv,lv,dn){const P=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};mv&&c.addEventListener('pointermove',e=>mv(...P(e)));lv&&c.addEventListener('pointerleave',lv);dn&&c.addEventListener('pointerdown',e=>dn(...P(e)))}

// 133 fireworks
(function(){const o=setup($('c133')),x=o.x;let R=[],P=[],F=[],nx=0;
 function rocket(tx,ty){R.push({x:tx==null?o.W*(.15+Math.random()*.7):tx,y:o.H+5,ty:ty==null?o.H*(.15+Math.random()*.3):ty,vy:-(4.4+Math.random()*1.4),h:Math.random()*360,t:[]})}
 function burst(X,Y,h){F.push({x:X,y:Y,r:10,l:1});const k=Math.random(),add=(vx,vy,hh,d,g)=>P.push({x:X,y:Y,vx,vy,l:1,d,g,h:hh,t:[]});
  if(k<.3){for(let i=0;i<90;i++){const a=Math.random()*6.283,s=Math.random()*4.5+.5;add(Math.cos(a)*s,Math.sin(a)*s,h+Math.random()*90,.011+Math.random()*.01,.035)}}
  else if(k<.55){for(let i=0;i<60;i++){const a=i/60*6.283;add(Math.cos(a)*4,Math.sin(a)*4,h,.013,.03);if(i%2)add(Math.cos(a)*2,Math.sin(a)*2,h+180,.016,.03)}}
  else if(k<.8){for(let i=0;i<80;i++){const t=i/80*6.283,hx=16*Math.pow(Math.sin(t),3),hy=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));add(hx*.24,hy*.24,330+Math.random()*30,.012,.018)}}
  else{for(let i=0;i<70;i++){const a=Math.random()*6.283,s=Math.random()*3.2+1;add(Math.cos(a)*s,Math.sin(a)*s,40+Math.random()*20,.006,.05)}}}
 const line=(arr,tail)=>{x.beginPath();arr.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));if(tail)x.lineTo(tail[0],tail[1]);x.stroke()};
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);x.globalCompositeOperation='lighter';if(t>nx){rocket();nx=t+.7+Math.random()*.8}
  R=R.filter(r=>{r.t.push([r.x,r.y]);if(r.t.length>10)r.t.shift();r.y+=r.vy;r.vy*=.992;x.strokeStyle='rgba(255,230,160,.9)';x.lineWidth=2.5;line(r.t);if(r.y<=r.ty||r.vy>-1.2){burst(r.x,r.y,r.h);return false}return true});
  F=F.filter(f=>{f.r+=5;f.l-=.07;if(f.l<=0)return false;const g=x.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);g.addColorStop(0,`rgba(255,255,255,${f.l*.8})`);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2);return true});
  P=P.filter(p=>{p.t.push([p.x,p.y]);if(p.t.length>7)p.t.shift();p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.vx*=.985;p.vy*=.985;p.l-=p.d;if(p.l<=0)return false;
   x.strokeStyle=`hsla(${p.h%360},100%,62%,${Math.min(1,p.l*1.4)})`;x.lineWidth=2.2;line(p.t,[p.x,p.y]);x.fillStyle=`hsla(${p.h%360},100%,85%,${p.l})`;x.beginPath();x.arc(p.x,p.y,1.6,0,7);x.fill();return true});
  x.globalCompositeOperation='source-over'});
 ptr(o.c,0,0,(a,b)=>rocket(a,b))})();
// 134 swirl
(function(){const o=setup($('c134')),x=o.x,P=[];let m=null;for(let i=0;i<240;i++)P.push({x:Math.random()*320,y:Math.random()*300,vx:0,vy:0,h:i/240*360,k:.8+Math.random()*.6,t:[]});
 ptr(o.c,(a,b)=>m=[a,b],()=>m=null);
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);const cx=m?m[0]:o.W/2+Math.cos(t*.8)*o.W*.28,cy=m?m[1]:o.H/2+Math.sin(t*1.1)*o.H*.25;x.lineCap='round';x.lineJoin='round';x.lineWidth=2.4;
  P.forEach(p=>{const dx=cx-p.x,dy=cy-p.y,d=Math.hypot(dx,dy)+1;p.vx+=dx*.0045*p.k-dy/d*.26*p.k;p.vy+=dy*.0045*p.k+dx/d*.26*p.k;p.vx*=.95;p.vy*=.95;p.t.push([p.x,p.y]);if(p.t.length>12)p.t.shift();p.x+=p.vx;p.y+=p.vy;
   x.strokeStyle=`hsl(${(p.h+t*50)%360},95%,56%)`;x.beginPath();p.t.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.stroke()})})})();
// 135 bubbles
(function(){const o=setup($('c135')),x=o.x;let B=[],S=[];
 function nb(init){const r=14+Math.random()*30;return{x:Math.random()*o.W,y:init?Math.random()*o.H:o.H+r+Math.random()*60,r,vy:.4+Math.random()*.7,ph:Math.random()*6.28,h:Math.random()*360}}
 for(let i=0;i<16;i++)B.push(nb(1));
 function pop(q){for(let i=0;i<14;i++){const a=i/14*6.283;S.push({x:q.x+Math.cos(a)*q.r,y:q.y+Math.sin(a)*q.r,vx:Math.cos(a)*2.2,vy:Math.sin(a)*2.2,l:1,h:q.h+i*12})}}
 ptr(o.c,(a,b)=>{o.c.style.cursor=B.some(q=>Math.hypot(q.x-a,q.y-b)<q.r)?'pointer':'default'},0,(a,b)=>{for(let i=B.length-1;i>=0;i--){const q=B[i];if(Math.hypot(q.x-a,q.y-b)<q.r){pop(q);B[i]=nb();break}}});
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);B.forEach((q,i)=>{q.y-=q.vy;q.x+=Math.sin(t*1.2+q.ph)*.4;if(q.y<-q.r-10){B[i]=nb();return}
   const g=x.createRadialGradient(q.x-q.r*.3,q.y-q.r*.3,q.r*.1,q.x,q.y,q.r);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.7,'rgba(255,255,255,.1)');g.addColorStop(1,`hsla(${(q.h+t*40)%360},95%,70%,.5)`);
   x.fillStyle=g;x.beginPath();x.arc(q.x,q.y,q.r,0,7);x.fill();
   const lg=x.createLinearGradient(q.x-q.r,q.y-q.r,q.x+q.r,q.y+q.r);['#ff6ab0','#ffd93c','#4ade80','#38bdf8','#a78bfa'].forEach((c,k)=>lg.addColorStop(k/4,c));x.strokeStyle=lg;x.globalAlpha=.85;x.lineWidth=2.2;x.stroke();x.globalAlpha=1;
   x.fillStyle='rgba(255,255,255,.95)';x.beginPath();x.ellipse(q.x-q.r*.4,q.y-q.r*.42,q.r*.22,q.r*.12,-.7,0,7);x.fill()});
  S=S.filter(s=>{s.x+=s.vx;s.y+=s.vy;s.vx*=.93;s.vy*=.93;s.l-=.045;if(s.l<=0)return false;x.fillStyle=`hsla(${s.h%360},95%,62%,${s.l})`;x.beginPath();x.arc(s.x,s.y,3*s.l+1,0,7);x.fill();return true})})})();
// 137 rainbow text
(function(){const r=$('rt');[...'COLORFUL'].forEach((c,i)=>{const s=document.createElement('span');s.textContent=c;s.style.color=`hsl(${i*45},95%,58%)`;s.style.setProperty('--i',i);r.appendChild(s)})})();
// 138 rainbow trail
(function(){const o=setup($('c138')),x=o.x,T=[];let m=null;ptr(o.c,(a,b)=>m=[a,b],()=>m=null);
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);const px=m?m[0]:o.W/2+Math.sin(t*1.3)*o.W*.36,py=m?m[1]:o.H/2+Math.sin(t*2.1)*o.H*.3;T.push({x:px,y:py});if(T.length>46)T.shift();x.lineCap='round';
  for(let s=-1;s<=1;s++)for(let i=1;i<T.length;i++){const k=i/T.length;x.strokeStyle=`hsl(${(t*120+i*8+s*55)%360},95%,58%)`;x.globalAlpha=k;x.lineWidth=2+k*9;x.beginPath();x.moveTo(T[i-1].x,T[i-1].y+s*8);x.lineTo(T[i].x,T[i].y+s*8);x.stroke()}
  x.globalAlpha=1;const h=T[T.length-1];x.fillStyle='#fff';x.beginPath();x.arc(h.x,h.y,8,0,7);x.fill();x.strokeStyle=`hsl(${t*120%360},95%,58%)`;x.lineWidth=3;x.stroke()})})();
// 139 kaleidoscope
(function(){const o=setup($('c139')),x=o.x,N=9,S=[];for(let i=0;i<16;i++)S.push({sp:.3+Math.random()*.7,ph:Math.random()*6.28,sa:.4+Math.random()*.9,pa:Math.random()*6.28,s:8+Math.random()*16,h:Math.random()*360,ty:i%3,rr:.3+Math.random()*.7});
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);const sc=Math.min(o.W,o.H)/300;x.save();x.translate(o.W/2,o.H/2);x.scale(sc,sc);x.rotate(t*.15);
  for(let k=0;k<N;k++)for(let m=0;m<2;m++){x.save();x.rotate(k*6.2832/N);if(m)x.scale(1,-1);
   S.forEach(s=>{const r=20+120*(.5+.5*Math.sin(t*s.sp+s.ph))*s.rr+20,a=.34*Math.sin(t*s.sa+s.pa),px=Math.cos(a)*r,py=Math.sin(a)*r,z=s.s*(.7+.3*Math.sin(t*2+s.ph));
    x.fillStyle=`hsla(${(s.h+t*40)%360},95%,60%,.8)`;x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=1.5;x.beginPath();
    if(s.ty===0)x.arc(px,py,z,0,7);else if(s.ty===1)x.rect(px-z,py-z,z*2,z*2);else{x.moveTo(px,py-z*1.2);x.lineTo(px+z,py+z);x.lineTo(px-z,py+z);x.closePath()}x.fill();x.stroke()});x.restore()}
  x.restore()})})();
// 140 waves
(function(){const o=setup($('c140')),x=o.x,L=[{h:335,a:30,f:.011,s:1,b:.5,p:0},{h:195,a:26,f:.014,s:-1.3,b:.56,p:2},{h:50,a:22,f:.017,s:1.7,b:.62,p:4},{h:270,a:34,f:.009,s:-.8,b:.48,p:1},{h:150,a:20,f:.02,s:2.1,b:.68,p:3}];
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);x.globalCompositeOperation='multiply';L.forEach(w=>{const by=o.H*w.b,g=x.createLinearGradient(0,by-w.a,0,o.H);g.addColorStop(0,`hsla(${w.h},95%,66%,.85)`);g.addColorStop(1,`hsla(${w.h+40},95%,72%,.4)`);x.fillStyle=g;x.beginPath();x.moveTo(0,o.H);
  for(let X=0;X<=o.W+6;X+=6){x.lineTo(X,by+Math.sin(X*w.f+t*w.s+w.p)*w.a+Math.sin(X*w.f*2.3-t*w.s*1.4)*w.a*.4)}x.lineTo(o.W,o.H);x.closePath();x.fill()});x.globalCompositeOperation='source-over'})})();
// 141 balls
(function(){const o=setup($('c141')),x=o.x;let B=[],m=null;
 function nb(px,py,bu){const r=10+Math.random()*16;return{x:px==null?Math.random()*o.W:px,y:py==null?Math.random()*o.H*.5:py,vx:(Math.random()-.5)*(bu?600:200),vy:bu?-Math.random()*500:0,r,h:Math.random()*360}}
 for(let i=0;i<14;i++)B.push(nb());
 ptr(o.c,(a,b)=>m=[a,b],()=>m=null,(a,b)=>{for(let i=0;i<6;i++)B.push(nb(a,b,1));while(B.length>46)B.shift()});
 loop(o.c,(t,dt)=>{x.clearRect(0,0,o.W,o.H);const W=o.W,H=o.H;
  B.forEach(b=>{b.vy+=1100*dt;if(m){const dx=b.x-m[0],dy=b.y-m[1],d=Math.hypot(dx,dy);if(d<90&&d>0){b.vx+=dx/d*1800*dt;b.vy+=dy/d*1800*dt}}b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=.998;
   if(b.x<b.r){b.x=b.r;b.vx*=-.85}if(b.x>W-b.r){b.x=W-b.r;b.vx*=-.85}if(b.y>H-b.r){b.y=H-b.r;b.vy*=-.82;b.vx*=.97;if(Math.abs(b.vy)<30)b.vy=0}if(b.y<b.r){b.y=b.r;b.vy*=-.8}});
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],c=B[j],dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy),mn=a.r+c.r;if(d<mn&&d>0){const nx=dx/d,ny=dy/d,ov=(mn-d)/2;a.x-=nx*ov;a.y-=ny*ov;c.x+=nx*ov;c.y+=ny*ov;const rv=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny;if(rv<0){const q=-rv*.9;a.vx-=q*nx;a.vy-=q*ny;c.vx+=q*nx;c.vy+=q*ny}}}
  B.forEach(b=>{x.fillStyle='rgba(60,40,120,.12)';x.beginPath();x.ellipse(b.x,H-4,b.r*(1-(H-b.y)/H*.5),4,0,0,7);x.fill();const g=x.createRadialGradient(b.x-b.r*.35,b.y-b.r*.35,b.r*.1,b.x,b.y,b.r);g.addColorStop(0,`hsl(${b.h},95%,82%)`);g.addColorStop(1,`hsl(${b.h},85%,52%)`);x.fillStyle=g;x.beginPath();x.arc(b.x,b.y,b.r,0,7);x.fill()})})})();
// 142 prism ring
(function(){const r=$('rg3');['音乐','影视','订阅','博客','相册','日记','摄影','旅行','读书','关于'].forEach((l,i)=>{const d=document.createElement('div');d.textContent=l;d.style.setProperty('--i',i);d.style.setProperty('--h',i*36);r.appendChild(d)})})();
// 143 bulb sign
(function(){const s=$('sign'),W=280,H=170,p=[];for(let x=12;x<=W-12;x+=20)p.push([x,7]);for(let y=27;y<=H-27;y+=20)p.push([W-7,y]);for(let x=W-12;x>=12;x-=20)p.push([x,H-7]);for(let y=H-27;y>=27;y-=20)p.push([7,y]);
 p.forEach((q,i)=>{const b=document.createElement('i');b.style.cssText=`left:${q[0]}px;top:${q[1]}px;--c:hsl(${i*18},100%,58%);animation-delay:${-i*.08}s`;s.appendChild(b)})})();
// 144 rainbow waves
(function(){const rw=$('rw'),C=['#ff4f6d','#ff9a3c','#ffd93c','#4ade80','#38bdf8','#6a5cff','#c04bff'],d='M0,40 C100,0 100,80 200,40 S300,0 400,40 S500,80 600,40 S700,0 800,40 V100 H0Z';
 C.forEach((c,i)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 800 100');s.setAttribute('preserveAspectRatio','none');s.style.cssText=`--h:${200-i*20}px;--d:${9+i*1.7}s;--dl:${-i*1.3}s;${i%2?'animation-direction:reverse;':''}`;s.innerHTML=`<path fill="${c}" d="${d}"/>`;rw.appendChild(s)});
 const st=$('s144');for(let i=0;i<9;i++){const b=document.createElement('i'),z=8+Math.random()*16;b.style.cssText=`left:${Math.random()*95}%;width:${z}px;height:${z}px;animation-duration:${4+Math.random()*4}s;animation-delay:${-Math.random()*6}s`;st.appendChild(b)}})();
// 145 sparkles
(function(){const o=setup($('c145')),x=o.x,C=['#fff','#ffe14d','#ff9ad5','#9be7ff','#c7b3ff'];let S=[],F=[];
 function star(px,py,r,rot,col){x.fillStyle=col;x.beginPath();for(let i=0;i<4;i++){const a=rot+i*1.5708,tx=px+Math.cos(a)*r,ty=py+Math.sin(a)*r;i?x.quadraticCurveTo(px,py,tx,ty):x.moveTo(tx,ty)}x.quadraticCurveTo(px,py,px+Math.cos(rot)*r,py+Math.sin(rot)*r);x.fill()}
 for(let i=0;i<30;i++)S.push({x:Math.random()*330,y:Math.random()*300,r:4+Math.random()*10,ph:Math.random()*6.28,sp:.6+Math.random()*1.4,c:C[i%5],vy:.08+Math.random()*.2});
 const sp=(a,b,n,sp0)=>{for(let i=0;i<n;i++){const an=Math.random()*6.28,s=Math.random()*sp0;F.push({x:a,y:b,vx:Math.cos(an)*s,vy:Math.sin(an)*s-.3,r:4+Math.random()*8,l:1,c:C[Math.random()*5|0],rot:Math.random()*3})}};
 ptr(o.c,(a,b)=>{if(Math.random()<.6)sp(a,b,1,1.2)},0,(a,b)=>sp(a,b,22,4));
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);x.shadowBlur=12;
  S.forEach(s=>{s.y-=s.vy;if(s.y<-20){s.y=o.H+20;s.x=Math.random()*o.W}const k=.55+.45*Math.sin(t*s.sp*3+s.ph);x.shadowColor=s.c;star(s.x,s.y,s.r*k,t*s.sp*.5,s.c)});
  F=F.filter(f=>{f.x+=f.vx;f.y+=f.vy;f.vy+=.05;f.vx*=.97;f.l-=.02;if(f.l<=0)return false;x.globalAlpha=f.l;x.shadowColor=f.c;star(f.x,f.y,f.r*f.l+1,f.rot+f.l*3,f.c);return true});x.globalAlpha=1;x.shadowBlur=0})})();
// 146 aurora
(function(){const st=$('st146'),bs=[...st.querySelectorAll('.ab')],pos=bs.map(()=>[150,150]);let m=null;
 st.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect();m=[e.clientX-r.left,e.clientY-r.top]});st.addEventListener('pointerleave',()=>m=null);
 loop(st,t=>{const W=st.clientWidth,H=st.clientHeight;bs.forEach((b,i)=>{const tx=m?m[0]+Math.cos(t*1.1+i*1.3)*50:W/2+Math.cos(t*.5+i*1.2)*W*.3,ty=m?m[1]+Math.sin(t*1.3+i*1.3)*50:H/2+Math.sin(t*.7+i*1.5)*H*.25,k=.03+i*.012;pos[i][0]+=(tx-pos[i][0])*k;pos[i][1]+=(ty-pos[i][1])*k;b.style.transform=`translate(${pos[i][0]-80}px,${pos[i][1]-80}px)`})})})();
// 147 gauge
(function(){const s=$('g147');let h='<defs><linearGradient id="rg" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="270" y2="0"><stop offset="0" stop-color="#ff4f6d"/><stop offset=".2" stop-color="#ffb03c"/><stop offset=".4" stop-color="#ffe14d"/><stop offset=".6" stop-color="#4ade80"/><stop offset=".8" stop-color="#38bdf8"/><stop offset="1" stop-color="#8b6bff"/></linearGradient></defs>';
 h+='<path d="M30,160 A120,120 0 0 1 270,160" pathLength="100" fill="none" stroke="url(#rg)" stroke-width="22" stroke-linecap="round" opacity=".25"/><path id="ga" d="M30,160 A120,120 0 0 1 270,160" pathLength="100" fill="none" stroke="url(#rg)" stroke-width="22" stroke-linecap="round" stroke-dasharray="0.1 100" style="transition:stroke-dasharray 1.6s cubic-bezier(.34,1.2,.64,1)"/>';
 for(let i=0;i<=20;i++){const a=Math.PI+i/20*Math.PI,r2=i%5?102:110;h+=`<line x1="${150+Math.cos(a)*96}" y1="${160+Math.sin(a)*96}" x2="${150+Math.cos(a)*r2}" y2="${160+Math.sin(a)*r2}" stroke="#2b2350" stroke-opacity=".5" stroke-width="${i%5?1.5:2.5}"/>`}
 h+='<g id="gn" style="transform-origin:150px 160px;transition:transform 1.6s cubic-bezier(.34,1.56,.64,1);transform:rotate(-90deg)"><path d="M150,58 L157,160 L143,160Z" fill="#2b2350"/></g><circle cx="150" cy="160" r="12" fill="#2b2350"/><circle cx="150" cy="160" r="5" fill="#fff"/>';s.innerHTML=h;
 let cur=0;function go(){const v=20+Math.round(Math.random()*78);$('ga').style.strokeDasharray=v+' 100';$('gn').style.transform=`rotate(${-90+v*1.8}deg)`;const from=cur,t0=performance.now();(function tw(n){const k=Math.min(1,(n-t0)/1400);cur=Math.round(from+(v-from)*(1-Math.pow(1-k,3)));$('gvn').textContent=cur;if(k<1)requestAnimationFrame(tw)})(t0)}
 setTimeout(go,300);setInterval(go,3200)})();
// 148 confetti
(function(){const o=setup($('c148')),x=o.x,C=['#ff4f6d','#ffb03c','#ffe14d','#4ade80','#38bdf8','#8b6bff','#ff4fa3'];let P=[];
 function mk(px,py,bu){const a=-Math.PI/2+(Math.random()-.5)*1.8,s=6+Math.random()*9;return{x:px==null?Math.random()*o.W:px,y:py==null?-Math.random()*o.H:py,vx:bu?Math.cos(a)*s:0,vy:bu?Math.sin(a)*s:Math.random()*.5,w:6+Math.random()*7,h:10+Math.random()*8,ph:Math.random()*6.28,sp:.05+Math.random()*.1,rot:Math.random()*6.28,vr:(Math.random()-.5)*.2,c:C[Math.random()*7|0],b:bu}}
 for(let i=0;i<110;i++){const p=mk();p.y=Math.random()*o.H;P.push(p)}
 ptr(o.c,0,0,(a,b)=>{for(let i=0;i<70;i++)P.push(mk(a,b,1))});
 loop(o.c,()=>{x.clearRect(0,0,o.W,o.H);P=P.filter(p=>{p.vy+=.035;p.vy*=.985;p.vx*=.985;p.ph+=p.sp;p.x+=p.vx+Math.sin(p.ph)*.7;p.y+=p.vy;p.rot+=p.vr;
   if(p.y>o.H+14){if(p.b)return false;p.y=-14;p.x=Math.random()*o.W;p.vy=.3}
   x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.scale(1,Math.cos(p.ph*2));x.fillStyle=p.c;x.fillRect(-p.w/2,-p.h/2,p.w,p.h);x.restore();return true})})})();
// 149 spectrum
(function(){const o=setup($('c149')),x=o.x,N=30,pk=Array(N).fill(0);
 function rr(a,b,w,h,r){x.beginPath();x.moveTo(a,b+h);x.lineTo(a,b+r);x.quadraticCurveTo(a,b,a+r,b);x.lineTo(a+w-r,b);x.quadraticCurveTo(a+w,b,a+w,b+r);x.lineTo(a+w,b+h);x.closePath()}
 loop(o.c,t=>{x.clearRect(0,0,o.W,o.H);const W=o.W,H=o.H,base=H*.7,bw=W/N,mh=base-24,hs=[];
  for(let i=0;i<N;i++){const v=(Math.sin(t*2.2+i*.5)+Math.sin(t*3.7+i*.9)+Math.sin(t*1.3-i*.3)+3)/6;hs.push(Math.max(6,Math.pow(v,1.4)*mh*(.75+.25*Math.sin(t*6.5))))}
  hs.forEach((h,i)=>pk[i]=Math.max(pk[i]-1.2,h));
  for(let pass=0;pass<2;pass++){x.save();if(pass){x.translate(0,base*2);x.scale(1,-1);x.globalAlpha=.2}
   hs.forEach((h,i)=>{const px=i*bw+bw*.16,w=bw*.68,g=x.createLinearGradient(0,base-h,0,base);g.addColorStop(0,`hsl(${i/N*300},95%,62%)`);g.addColorStop(1,`hsl(${i/N*300+40},95%,70%)`);x.fillStyle=g;rr(px,base-h,w,h,w/2);x.fill();x.fillStyle=`hsl(${i/N*300},95%,45%)`;x.fillRect(px,base-pk[i]-6,w,3)});x.restore()}})})();
// 150 gooey
(function(){const st=$('st150'),mb=$('mb');let m=null,p=[0,0];st.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect();m=[e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2]});st.addEventListener('pointerleave',()=>m=null);
 loop(st,t=>{const tx=m?m[0]:Math.cos(t*.9)*60,ty=m?m[1]:Math.sin(t*1.2)*40;p[0]+=(tx-p[0])*.12;p[1]+=(ty-p[1])*.12;mb.style.transform=`translate(${p[0]}px,${p[1]}px)`})})();
// 151 wiggle text
(function(){const w=$('wg');[...'炫彩世界'].forEach((c,i)=>{const s=document.createElement('span');s.textContent=c;s.style.setProperty('--i',i);w.appendChild(s)})})();
// 152 spirograph
(function(){const o=setup($('c152')),x=o.x,RS=[20,25,30,35,40,45,50,60,75];let R=100,r,d,t,lim,prev,h0,state='draw';
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 function init(){r=RS[Math.random()*RS.length|0];d=r*(.5+Math.random()*.9);lim=Math.PI*2*r/gcd(R,r);t=0;prev=null;h0=Math.random()*360;state='draw'}init();
 loop(o.c,()=>{if(state!=='draw')return;const s=Math.min(o.W,o.H)/280,cx=o.W/2,cy=o.H/2;x.lineCap='round';x.lineWidth=2;
  for(let k=0;k<10;k++){t+=.04;const px=cx+((R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t))*s,py=cy+((R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t))*s;
   if(prev){x.strokeStyle=`hsl(${(h0+t*28)%360},92%,52%)`;x.beginPath();x.moveTo(prev[0],prev[1]);x.lineTo(px,py);x.stroke()}prev=[px,py];
   if(t>=lim){state='hold';setTimeout(()=>o.c.style.opacity=0,1400);setTimeout(()=>{x.clearRect(0,0,o.W,o.H);init();o.c.style.opacity=1},2300);break}}})})();
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
