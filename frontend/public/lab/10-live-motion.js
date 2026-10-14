
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const vis=new Map(),io=new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)));
function loop(el,fn){vis.set(el,true);io.observe(el);let last=0;(function f(ms){requestAnimationFrame(f);if(!vis.get(el))return;const t=ms/1000;fn(t,Math.min(t-last,.05));last=t})(0)}
function setup(c){const o={c,x:c.getContext('2d'),W:300,H:300};const f=()=>{const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);o.W=r.width;o.H=r.height;c.width=r.width*d;c.height=r.height*d;o.x.setTransform(d,0,0,d,0,0)};f();new ResizeObserver(f).observe(c);return o}
function track(el,mv,lv){el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();mv(e.clientX-r.left,e.clientY-r.top,r)});lv&&el.addEventListener('pointerleave',lv)}
function rr(x,a,b,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
function curve(x,p){x.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length-1;i++){x.quadraticCurveTo(p[i][0],p[i][1],(p[i][0]+p[i+1][0])/2,(p[i][1]+p[i+1][1])/2)}x.lineTo(p[p.length-1][0],p[p.length-1][1])}
function countTo(el,to,dur,fmt){const f0=+el.dataset.v||0,t0=performance.now();el.dataset.v=to;(function s(n){const k=Math.min(1,(n-t0)/dur),v=f0+(to-f0)*(1-Math.pow(1-k,3));el.textContent=fmt?fmt(v):Math.round(v).toLocaleString();if(k<1)requestAnimationFrame(s)})(t0)}

/* ---------- WebGL ---------- */
const GLH=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R;uniform float T;uniform vec2 M;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
`;
function glInit(canvas,stage,frag){const gl=canvas.getContext('webgl',{antialias:false,alpha:false});if(!gl){canvas.style.display='none';return null}
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(x));return x};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,GLH+frag));gl.linkProgram(pr);gl.useProgram(pr);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 const uR=gl.getUniformLocation(pr,'R'),uT=gl.getUniformLocation(pr,'T'),uM=gl.getUniformLocation(pr,'M');const o={m:[.5,.5],mt:[.5,.5]};
 track(stage,(x,y,r)=>o.mt=[x/r.width,1-y/r.height],()=>o.mt=[.5,.5]);
 loop(canvas,t=>{const d=Math.min(devicePixelRatio||1,1.5),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  o.m[0]+=(o.mt[0]-o.m[0])*.05;o.m[1]+=(o.mt[1]-o.m[1])*.05;gl.uniform2f(uR,w,h);gl.uniform1f(uT,t);gl.uniform2f(uM,o.m[0],o.m[1]);gl.drawArrays(gl.TRIANGLES,0,3)});return o}

// 165 aurora
glInit($('c165'),$('s165'),`void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=uv*vec2(R.x/R.y,1.);float t=T*.55;
vec3 col=mix(vec3(.015,.02,.09),vec3(.02,.05,.18),uv.y);
vec2 sp=gl_FragCoord.xy/R.y*85.;float h=hash(floor(sp));col+=vec3(step(.988,h))*pow(hash(floor(sp)+3.),2.)*(.5+.5*sin(T*2.+h*30.))*smoothstep(.25,.9,uv.y);
vec3 au=vec3(0.);
for(int i=0;i<4;i++){float fi=float(i);
 float x=p.x*(1.2+fi*.35)+t*(.7+fi*.3)+fi*3.;
 float wave=sin(x*1.3+sin(x*.7+t)*1.6)*.09+sin(x*2.7-t*1.4)*.04;
 float y0=.46+fi*.07+wave+(M.y-.5)*.12;
 float d=uv.y-y0;
 float cur=smoothstep(.0,.014,d)*exp(-d*(4.6+fi*1.4));
 float rays=.55+.45*sin(p.x*70.+fi*10.+t*3.+sin(p.x*9.+t)*3.);
 cur*=rays*(.65+.6*fbm(vec2(p.x*3.+t*.6,uv.y*4.+fi)));
 vec3 c=mix(vec3(.1,.95,.85),vec3(.4,.35,1.),smoothstep(0.,.5,d)+.25*sin(fi+t));
 c=mix(c,vec3(.95,.3,.95),smoothstep(.45,.95,d)*.75);
 au+=c*cur*(.6-fi*.08);}
col+=au*1.6;
col+=vec3(.05,.22,.3)*exp(-uv.y*6.)*.7;
float m=.13+.05*sin(p.x*3.+1.)+.03*sin(p.x*7.)+.018*sin(p.x*17.);
col=mix(col,vec3(.008,.012,.04),1.-smoothstep(m-.004,m+.004,uv.y));
col+=(hash(gl_FragCoord.xy+fract(T))-.5)*.02;gl_FragColor=vec4(col,1.);}`);
// 166 nebula
glInit($('c166'),$('s166'),`void main(){vec2 p=(gl_FragCoord.xy-.5*R)/R.y;p+=(M-.5)*.12;float r=length(p),a=atan(p.y,p.x),t=T*.3;
float tw=a+1.3/(r+.15)-t*1.4;vec2 q=vec2(cos(tw),sin(tw))*r*2.3;
float f=fbm(q*1.6+t),f2=fbm(q*3.2-t*1.3+5.);float arms=.5+.5*sin(a*3.+3./(r+.12)-t*3.2);
float dens=smoothstep(.0,.9,f*1.3+arms*.55)*exp(-r*2.1);
vec3 c1=vec3(.3,.12,.9),c2=vec3(.1,.5,1.),c3=vec3(.2,.95,.95),c4=vec3(.95,.3,.9);
vec3 col=mix(c1,c2,smoothstep(.2,.7,f2));col=mix(col,c3,smoothstep(.55,.95,f*arms+.1));col=mix(col,c4,smoothstep(.6,1.,f2*arms)*.6);
col*=dens*2.8;col+=vec3(.012,.012,.05);
col+=vec3(.95,.85,1.)*exp(-r*9.)*1.3+vec3(.4,.6,1.)*exp(-r*3.5)*.45;
vec2 sp=gl_FragCoord.xy/R.y*90.;float h=hash(floor(sp));col+=step(.99,h)*pow(hash(floor(sp)+5.),2.)*(.5+.5*sin(T*3.+h*40.));
col=pow(col,vec3(.92));col+=(hash(gl_FragCoord.xy+fract(T))-.5)*.02;gl_FragColor=vec4(col,1.);}`);

// 167 dusk run
(function(){const o=setup($('c167')),x=o.x;
 const hs=n=>{const s=Math.sin(n*127.1)*43758.5453;return s-Math.floor(s)},rg=(w,p)=>{let v=0,a=1,tot=0;for(let i=0;i<3;i++){const f=[1,2.3,5.1][i];v+=a*(1-Math.abs(Math.sin(w*f+p*(i+1))));tot+=a;a*=.5}return v/tot};
 const SK=[[0,'#0c1245'],[.38,'#3b2fb8'],[.62,'#8c4be0'],[.8,'#ff6fb5'],[1,'#ffb58a']];
 const stars=Array.from({length:80},()=>({x:Math.random(),y:Math.random()*.55,s:Math.random()*1.4+.3,p:Math.random()*6}));
 let sh=[],nx=1;const clouds=Array.from({length:7},()=>({x:Math.random()*600,y:.1+Math.random()*.38,w:90+Math.random()*130,v:40+Math.random()*60,a:.25+Math.random()*.3}));
 const birds=Array.from({length:7},(_,i)=>({x:i*-26-40,y:70+i*6,o:i}));
 const LY=[{sp:14,base:.64,amp:.2,fr:.011,ph:1.3,top:'#c7b0f5',bot:'#ffc0d9'},{sp:34,base:.71,amp:.2,fr:.016,ph:4.1,top:'#8f7fe6',bot:'#e9a0d4'},{sp:70,base:.79,amp:.19,fr:.022,ph:2.2,top:'#4b57d4',bot:'#8a6fd6'},{sp:130,base:.9,amp:.14,fr:.03,ph:5.7,top:'#1b2288',bot:'#2a2f9a',trees:1}];
 loop(o.c,(t,dt)=>{const W=o.W,H=o.H;const g=x.createLinearGradient(0,0,0,H*.82);SK.forEach(([p,c])=>g.addColorStop(p,c));x.fillStyle=g;x.fillRect(0,0,W,H);
  stars.forEach(s=>{x.globalAlpha=clamp((.35+.65*Math.abs(Math.sin(t*1.5+s.p)))*(1-s.y/.6),0,1);x.fillStyle='#fff';x.beginPath();x.arc(s.x*W,s.y*H,s.s,0,7);x.fill()});x.globalAlpha=1;
  if(t>nx){nx=t+.8+Math.random()*1.4;sh.push({x:W*(.15+Math.random()*.85),y:Math.random()*H*.3,vx:-(520+Math.random()*320),vy:230+Math.random()*130,l:1})}
  sh=sh.filter(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.l-=dt*1.4;if(s.l<=0)return false;const k=.1,gr=x.createLinearGradient(s.x,s.y,s.x-s.vx*k,s.y-s.vy*k);gr.addColorStop(0,`rgba(255,255,255,${s.l})`);gr.addColorStop(1,'rgba(255,255,255,0)');x.strokeStyle=gr;x.lineWidth=2;x.beginPath();x.moveTo(s.x,s.y);x.lineTo(s.x-s.vx*k,s.y-s.vy*k);x.stroke();return true});
  const sx=W*.7,sy=H*.66+Math.sin(t*.4)*4,sg=x.createRadialGradient(sx,sy,0,sx,sy,H*.55);sg.addColorStop(0,'rgba(255,240,200,.95)');sg.addColorStop(.12,'rgba(255,190,140,.6)');sg.addColorStop(.4,'rgba(255,120,190,.22)');sg.addColorStop(1,'rgba(255,120,190,0)');x.fillStyle=sg;x.fillRect(0,0,W,H);x.fillStyle='#fff4d6';x.beginPath();x.arc(sx,sy,H*.05+Math.sin(t)*1.2,0,7);x.fill();
  clouds.forEach(c=>{c.x-=c.v*dt;if(c.x<-c.w-40)c.x=W+c.w+40;const cy=c.y*H,cg=x.createRadialGradient(0,0,0,0,0,c.w);cg.addColorStop(0,`rgba(255,205,235,${c.a})`);cg.addColorStop(1,'rgba(255,205,235,0)');x.save();x.translate(c.x,cy);x.scale(1,.16);x.fillStyle=cg;x.beginPath();x.arc(0,0,c.w,0,7);x.fill();x.restore()});
  LY.forEach((L,li)=>{const off=t*L.sp;x.beginPath();x.moveTo(0,H);for(let px=0;px<=W+4;px+=4){x.lineTo(px,H*L.base-H*L.amp*rg((px+off)*L.fr,L.ph))}x.lineTo(W,H);x.closePath();const gg=x.createLinearGradient(0,H*(L.base-L.amp),0,H);gg.addColorStop(0,L.top);gg.addColorStop(1,L.bot);x.fillStyle=gg;x.fill();
   if(L.trees){x.fillStyle='#10165e';for(let wi=Math.floor(off/12)-1;wi<=Math.floor((off+W)/12)+1;wi++){if(hs(wi+9)>.72)continue;const wx=wi*12+hs(wi)*5,bx=wx-off,by=H*L.base-H*L.amp*rg(wx*L.fr,L.ph)+3,hh=9+hs(wi+3)*22;x.beginPath();x.moveTo(bx-4.5,by);x.lineTo(bx,by-hh);x.lineTo(bx+4.5,by);x.fill()}}
   if(li===1||li===2){const fg=x.createLinearGradient(0,H*(L.base-.03),0,H*(L.base+.12));fg.addColorStop(0,'rgba(255,190,225,0)');fg.addColorStop(1,'rgba(255,190,225,.3)');x.fillStyle=fg;x.fillRect(0,H*(L.base-.03),W,H*.15)}});
  x.strokeStyle='#1b1f66';x.lineWidth=1.6;x.lineCap='round';birds.forEach(b=>{b.x+=130*dt;if(b.x>W+60)b.x=-60-b.o*8;const fl=Math.sin(t*10+b.o)*5,by=b.y+Math.sin(t+b.o)*4+b.x*.03;x.beginPath();x.moveTo(b.x-9,by-fl);x.quadraticCurveTo(b.x-4,by-3-fl*.2,b.x,by);x.quadraticCurveTo(b.x+4,by-3-fl*.2,b.x+9,by-fl);x.stroke()})})})();

// 168 skeleton movement
(function(){const s=$('gsv'),K=2.7;
 function gear(N,ro,ri,hub,holes){const st=2*Math.PI/N,P=(r,a)=>`${(r*Math.cos(a)).toFixed(2)},${(r*Math.sin(a)).toFixed(2)}`;let d='';
  for(let i=0;i<N;i++){const a=i*st;d+=(i?'L':'M')+P(ri,a+st*.02)+'L'+P(ro,a+st*.1)+'L'+P(ro,a+st*.4)+'L'+P(ri,a+st*.48)}d+='Z';
  const rin=hub*1.3,rout=ri*.8,w=2*Math.PI/holes;for(let k=0;k<holes;k++){const a1=k*w+w*.12,a2=k*w+w*.88;d+=`M${P(rin,a1)}L${P(rout,a1)}A${rout},${rout} 0 0 1 ${P(rout,a2)}L${P(rin,a2)}A${rin},${rin} 0 0 0 ${P(rin,a1)}Z`}
  const h=hub*.42;d+=`M${h},0A${h},${h} 0 1 0 ${-h},0A${h},${h} 0 1 0 ${h},0Z`;return d}
 const G=[{N:36,f:'gG',c:[140,215],w:20},{N:22,f:'gS',par:0,th:-20},{N:16,f:'gB',par:0,th:-130},{N:12,f:'gG',par:1,th:null}];
 // positions & phases
 G[0].ph=G[1].th;G[1].ph=G[1].th+180+180/G[1].N;G[1].w=-G[0].w*G[0].N/G[1].N;
 const mesh=(c,p,th)=>{const d=(p.N+c.N)*K,a=th*Math.PI/180;c.c=[p.c[0]+d*Math.cos(a),p.c[1]+d*Math.sin(a)]};
 mesh(G[1],G[0],G[1].th);mesh(G[2],G[0],G[2].th);G[2].ph=G[2].th+180+180/G[2].N;G[2].w=-G[0].w*G[0].N/G[2].N;
 const step=360/G[1].N;G[3].th=G[1].ph+Math.round((-94-G[1].ph)/step)*step;mesh(G[3],G[1],G[3].th);G[3].ph=G[3].th+180+180/G[3].N;G[3].w=-G[1].w*G[1].N/G[3].N;
 let h=`<defs>
 <linearGradient id="gG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2cc"/><stop offset=".3" stop-color="#e2b565"/><stop offset=".65" stop-color="#9a6422"/><stop offset="1" stop-color="#f7dc9c"/></linearGradient>
 <linearGradient id="gS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#b4bec9"/><stop offset=".7" stop-color="#626d79"/><stop offset="1" stop-color="#eef2f6"/></linearGradient>
 <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6c8ff"/><stop offset=".4" stop-color="#5b7bff"/><stop offset=".75" stop-color="#1c2b86"/><stop offset="1" stop-color="#8fa8ff"/></linearGradient>
 <radialGradient id="rb"><stop offset="0" stop-color="#ff9fb0"/><stop offset=".5" stop-color="#e0173f"/><stop offset="1" stop-color="#6b0018"/></radialGradient>
 <linearGradient id="pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a8f"/><stop offset=".55" stop-color="#101a55"/><stop offset="1" stop-color="#0a1038"/></linearGradient>
 <pattern id="pe" width="16" height="16" patternUnits="userSpaceOnUse"><g fill="none" stroke="#9fb4ff" stroke-opacity=".1"><circle cx="0" cy="0" r="8"/><circle cx="16" cy="0" r="8"/><circle cx="0" cy="16" r="8"/><circle cx="16" cy="16" r="8"/><circle cx="8" cy="8" r="8"/></g></pattern>
 <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000" flood-opacity=".65"/></filter></defs>
 <rect width="400" height="400" fill="url(#pl)"/><rect width="400" height="400" fill="url(#pe)"/>`;
 for(let i=0;i<400;i+=8)h+=`<line x1="${i}" y1="0" x2="${i}" y2="400" stroke="#fff" stroke-opacity=".025"/>`;
 G.forEach((g,i)=>{const pr=g.N*K,ro=pr+5.5,ri=pr-6.5,hub=Math.max(8,ri*.2);g.ro=ro;h+=`<g transform="translate(${g.c[0].toFixed(1)} ${g.c[1].toFixed(1)})" filter="url(#sh)"><g id="g${i}"><path d="${gear(g.N,ro,ri,hub,g.N>20?5:4)}" fill="url(#${g.f})" fill-rule="evenodd" stroke="#0007" stroke-width=".8"/><circle r="${(ri*.88).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/><circle r="${(ri*.8).toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".6"/></g></g>`});
 // balance wheel
 let sp='';for(let a=0;a<=Math.PI*2*5;a+=.2){const r=4+a/(Math.PI*2*5)*22;sp+=(a?'L':'M')+(r*Math.cos(a)).toFixed(1)+','+(r*Math.sin(a)).toFixed(1)}
 h+=`<g transform="translate(305 308)" filter="url(#sh)"><g id="bw"><circle r="47" fill="none" stroke="url(#gG)" stroke-width="7"/><circle r="47" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1" /><line x1="-45" x2="45" stroke="url(#gG)" stroke-width="5"/><line y1="-45" y2="45" stroke="url(#gG)" stroke-width="5"/>${[0,1,2,3,4,5,6,7].map(i=>`<circle cx="${(47*Math.cos(i*.7854)).toFixed(1)}" cy="${(47*Math.sin(i*.7854)).toFixed(1)}" r="3" fill="url(#gB)" stroke="#0008" stroke-width=".6"/>`).join('')}<path id="hsp" d="${sp}" fill="none" stroke="#cfe0ff" stroke-width=".9" stroke-opacity=".9"/></g></g>`;
 // jewels
 [G[0],G[1],G[2],G[3]].forEach(g=>h+=`<g transform="translate(${g.c[0].toFixed(1)} ${g.c[1].toFixed(1)})"><circle r="8.5" fill="url(#gG)" stroke="#0008" stroke-width=".6"/><circle r="5" fill="url(#rb)"/><ellipse cx="-1.4" cy="-1.8" rx="1.6" ry="1" fill="#fff" opacity=".8"/></g>`);
 h+=`<g transform="translate(305 308)"><circle r="8" fill="url(#gG)" stroke="#0008" stroke-width=".6"/><circle r="4.5" fill="url(#rb)"/><ellipse cx="-1.3" cy="-1.6" rx="1.4" ry=".9" fill="#fff" opacity=".8"/></g>`;
 [[26,26],[374,26],[26,374],[374,374]].forEach(([x,y],i)=>h+=`<g transform="translate(${x} ${y}) rotate(${i*37})"><circle r="9" fill="url(#gS)" stroke="#0008" stroke-width=".7"/><line x1="-6" x2="6" stroke="#0009" stroke-width="2"/></g>`);
 h+=`<text x="30" y="372" font-family="JetBrains Mono,monospace" font-size="8" letter-spacing="3" fill="#f3dca6" opacity=".85">ARCHIVE · 17 JEWELS</text><text x="300" y="42" font-family="JetBrains Mono,monospace" font-size="7" letter-spacing="3" fill="#9fb4ff" opacity=".7">SWISS MADE ✦</text>`;
 s.innerHTML=h;const el=G.map((g,i)=>$('g'+i)),bw=$('bw'),hsp=$('hsp');
 loop(s,t=>{G.forEach((g,i)=>el[i].setAttribute('transform',`rotate(${(g.ph+g.w*t-.25*360/g.N).toFixed(2)})`));const o=Math.sin(t*5.4)*205;bw.setAttribute('transform',`rotate(${o.toFixed(1)})`);hsp.setAttribute('transform',`scale(${(1+.1*Math.sin(t*5.4+1.57)).toFixed(3)})`)})})();

// 169 real-time traffic
(function(){const o=setup($('c169')),x=o.x,st=$('s169'),N=60,STEP=.5;
 const S=[{n:'访问',c:'#8b5cf6',b:62,a:22,f:.5,p:0},{n:'音乐',c:'#22d3ee',b:48,a:20,f:.7,p:1.7},{n:'影视',c:'#3b82f6',b:38,a:16,f:.45,p:3.1},{n:'订阅',c:'#e879f9',b:26,a:14,f:.9,p:4.4}];
 const val=(s,t)=>clamp(s.b+s.a*Math.sin(t*s.f+s.p)+s.a*.5*Math.sin(t*s.f*2.3+s.p*2)+(Math.random()-.5)*7,6,96);
 let simT=0,acc=0,cnt=0;S.forEach(s=>{s.d=[];for(let i=0;i<N;i++)s.d.push(val(s,(i-N)*STEP))});
 $('ch169').innerHTML=S.map((s,i)=>`<div class="chip" style="--c:${s.c}"><i></i>${s.n}<b id="v169${i}">0</b></div>`).join('');
 let m=null;track(st,(a,b)=>m=[a,b],()=>m=null);
 loop(o.c,(t,dt)=>{const W=o.W,H=o.H,l=46,r=86,tp=96,bt=34,cw=W-l-r,ch=H-tp-bt,dx=cw/(N-2);acc+=dt;while(acc>=STEP){acc-=STEP;simT+=STEP;cnt++;S.forEach(s=>{s.d.shift();s.d.push(val(s,simT))})}const fr=acc/STEP;
  x.clearRect(0,0,W,H);const Y=v=>tp+(1-v/100)*ch,X=i=>l+(i-fr)*dx;
  x.font='10px "JetBrains Mono",monospace';x.textAlign='right';for(let k=0;k<=4;k++){const y=Y(k*25);x.strokeStyle='rgba(180,170,255,'+(k?.1:.22)+')';x.lineWidth=1;x.setLineDash(k?[3,5]:[]);x.beginPath();x.moveTo(l,y);x.lineTo(l+cw,y);x.stroke();x.fillStyle='rgba(200,195,255,.55)';x.fillText(k*25,l-10,y+3.5)}x.setLineDash([]);
  x.strokeStyle='rgba(180,170,255,.08)';for(let m2=-1;m2<N/5+1;m2++){const vx=l+(m2*5-(cnt%5)-fr)*dx;if(vx>l&&vx<l+cw){x.beginPath();x.moveTo(vx,tp);x.lineTo(vx,tp+ch);x.stroke()}}
  x.save();x.beginPath();x.rect(l-1,0,cw+2,H);x.clip();
  [...S].reverse().forEach(s=>{const pts=s.d.map((v,i)=>[X(i),Y(v)]);const g=x.createLinearGradient(0,tp,0,tp+ch);g.addColorStop(0,s.c+'55');g.addColorStop(1,s.c+'00');x.beginPath();curve(x,pts);x.lineTo(pts[N-1][0],tp+ch);x.lineTo(pts[0][0],tp+ch);x.closePath();x.fillStyle=g;x.fill();
   x.beginPath();curve(x,pts);x.lineWidth=2.4;x.lineJoin='round';x.strokeStyle=s.c;x.shadowColor=s.c;x.shadowBlur=14;x.stroke();x.shadowBlur=0});
  if(m&&m[0]>l&&m[0]<l+cw){const idx=clamp(Math.round((m[0]-l)/dx+fr),0,N-1),vx=X(idx);x.strokeStyle='rgba(255,255,255,.35)';x.beginPath();x.moveTo(vx,tp);x.lineTo(vx,tp+ch);x.stroke();S.forEach(s=>{x.fillStyle='#fff';x.strokeStyle=s.c;x.lineWidth=2.5;x.beginPath();x.arc(vx,Y(s.d[idx]),4.5,0,7);x.fill();x.stroke()})}
  x.restore();
  S.forEach((s,i)=>{const hv=lerp(s.d[N-2],s.d[N-1],fr),hy=Y(hv),hx=l+cw;x.fillStyle=s.c;x.globalAlpha=.25;x.beginPath();x.arc(hx,hy,7+4*Math.abs(Math.sin(t*3+i)),0,7);x.fill();x.globalAlpha=1;x.beginPath();x.arc(hx,hy,4.2,0,7);x.fillStyle='#fff';x.fill();x.strokeStyle=s.c;x.lineWidth=2.4;x.stroke();
   const e=$('v169'+i),n=Math.round(hv);if(e.textContent!=n)e.textContent=n});
  if(m&&m[0]>l&&m[0]<l+cw){const idx=clamp(Math.round((m[0]-l)/dx+fr),0,N-1),bw=92,bh=18+S.length*17,bx=Math.min(m[0]+14,l+cw-bw),by=tp+6;x.fillStyle='rgba(12,14,42,.88)';rr(x,bx,by,bw,bh,10);x.fill();x.strokeStyle='rgba(255,255,255,.2)';x.lineWidth=1;x.stroke();x.textAlign='left';S.forEach((s,i)=>{x.fillStyle=s.c;x.beginPath();x.arc(bx+14,by+19+i*17,3.5,0,7);x.fill();x.fillStyle='#fff';x.font='11px "JetBrains Mono",monospace';x.fillText(s.n,bx+24,by+23+i*17);x.textAlign='right';x.font='700 11px "JetBrains Mono",monospace';x.fillText(Math.round(s.d[idx]),bx+bw-10,by+23+i*17);x.textAlign='left'})}})})();

// 170 radar
(function(){const o=setup($('c170')),x=o.x,A=['音乐','影视','订阅','博客','相册','互动'],n=6;
 const S=[{n:'本周',c:'#8b5cf6',v:A.map(()=>.6),t:A.map(()=>.6)},{n:'上周',c:'#22d3ee',v:A.map(()=>.45),t:A.map(()=>.45)},{n:'目标',c:'#f472b6',v:A.map(()=>.8),t:A.map(()=>.8),dash:1}];
 function rt(){S[0].t=A.map(()=>.45+Math.random()*.5);S[1].t=S[0].t.map(v=>clamp(v*(.6+Math.random()*.35),.2,.95));S[2].t=A.map(()=>.78+Math.random()*.12)}rt();setInterval(rt,2400);
 loop(o.c,(t,dt)=>{const W=o.W,H=o.H,cx=W/2,cy=H/2+16,R=Math.min(W,H)*.3;x.clearRect(0,0,W,H);
  S.forEach(s=>s.v=s.v.map((v,i)=>v+(s.t[i]-v)*.05));const P=(i,k)=>{const a=i/n*Math.PI*2-Math.PI/2;return[cx+Math.cos(a)*R*k,cy+Math.sin(a)*R*k]};
  for(let k=1;k<=5;k++){x.beginPath();for(let i=0;i<n;i++){const p=P(i,k/5);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])}x.closePath();x.strokeStyle=`rgba(180,170,255,${k===5?.3:.12})`;x.lineWidth=1;x.stroke()}
  for(let i=0;i<n;i++){const p=P(i,1);x.strokeStyle='rgba(180,170,255,.16)';x.beginPath();x.moveTo(cx,cy);x.lineTo(p[0],p[1]);x.stroke()}
  if(x.createConicGradient){const g=x.createConicGradient(t*.9-Math.PI/2,cx,cy);g.addColorStop(0,'rgba(139,92,246,.42)');g.addColorStop(.14,'rgba(139,92,246,0)');g.addColorStop(1,'rgba(139,92,246,0)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,R,0,7);x.fill()}
  [S[2],S[1],S[0]].forEach(s=>{const pts=s.v.map((v,i)=>P(i,v));x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();
   if(!s.dash){const g=x.createRadialGradient(cx,cy,0,cx,cy,R);g.addColorStop(0,s.c+'10');g.addColorStop(1,s.c+'66');x.fillStyle=g;x.fill()}
   x.setLineDash(s.dash?[6,5]:[]);x.lineWidth=2.4;x.lineJoin='round';x.strokeStyle=s.c;x.shadowColor=s.c;x.shadowBlur=14;x.stroke();x.setLineDash([]);x.shadowBlur=0;
   if(!s.dash)pts.forEach(p=>{x.fillStyle='#fff';x.strokeStyle=s.c;x.lineWidth=2.4;x.beginPath();x.arc(p[0],p[1],4,0,7);x.fill();x.stroke()})});
  x.textAlign='center';A.forEach((a,i)=>{const p=P(i,1.27);x.fillStyle='rgba(215,210,255,.7)';x.font='11px "Noto Sans SC",sans-serif';x.fillText(a,p[0],p[1]-3);x.fillStyle='#fff';x.font='700 15px "JetBrains Mono",monospace';x.fillText(Math.round(S[0].v[i]*100),p[0],p[1]+14)});
  S.forEach((s,i)=>{const lx=W/2-110+i*80,ly=H-22,av=Math.round(s.v.reduce((a,b)=>a+b,0)/n*100);x.fillStyle=s.c;x.beginPath();x.arc(lx,ly,4,0,7);x.fill();x.textAlign='left';x.fillStyle='rgba(215,210,255,.75)';x.font='11px "Noto Sans SC",sans-serif';x.fillText(s.n,lx+10,ly+4);x.fillStyle='#fff';x.font='700 11px "JetBrains Mono",monospace';x.fillText(av,lx+40,ly+4)})})})();

// 171 donut
(function(){const svg=$('dsv'),st=$('s171'),C0=2*Math.PI*80;const D=[['音乐','#8b5cf6'],['影视','#3b82f6'],['订阅','#22d3ee'],['博客','#e879f9'],['相册','#2dd4bf']].map(([n,c])=>({n,c,v:20,t:20}));
 svg.innerHTML=`<circle cx="115" cy="115" r="80" fill="none" stroke="#dfe2f6" stroke-width="22"/>`+D.map((d,i)=>`<circle class="seg" id="sg${i}" cx="115" cy="115" r="80" stroke="${d.c}" stroke-width="22" transform="rotate(-90 115 115)" stroke-dasharray="0 ${C0}"/>`).join('')+`<g id="tk" stroke="#8b8fc0" stroke-opacity=".35">${Array.from({length:60},(_,i)=>`<line x1="115" y1="12" x2="115" y2="${i%5?15:19}" transform="rotate(${i*6} 115 115)"/>`).join('')}</g>`;
 $('dlg').innerHTML=D.map((d,i)=>`<div style="--c:${d.c}"><i></i><span>${d.n}</span><b id="dp${i}">0%</b><span class="bar"><u id="db${i}"></u></span></div>`).join('');
 let hv=-1,tot=48200;D.forEach((d,i)=>{const e=$('sg'+i);e.addEventListener('pointerenter',()=>hv=i);e.addEventListener('pointerleave',()=>hv=-1)});
 function rt(){D.forEach(d=>d.t=8+Math.random()*50)}rt();setInterval(rt,2600);setInterval(()=>{tot+=Math.round(20+Math.random()*90);countTo($('dtot'),tot,600)},900);countTo($('dtot'),tot,1200);
 loop(st,t=>{D.forEach(d=>d.v+=(d.t-d.v)*.04);const s=D.reduce((a,d)=>a+d.v,0);let cum=0;D.forEach((d,i)=>{const p=d.v/s,L=Math.max(0,p*C0-4),e=$('sg'+i);e.setAttribute('stroke-dasharray',`${L} ${C0-L}`);e.setAttribute('stroke-dashoffset',-cum*C0-2);e.setAttribute('stroke-width',hv===i?30:22);cum+=p;
   $('dp'+i).textContent=(p*100).toFixed(1)+'%';$('db'+i).style.width=p*100*1.7+'%'});$('tk').setAttribute('transform',`rotate(${t*6} 115 115)`)})})();

// 172 isometric bars
(function(){const o=setup($('c172')),x=o.x,G=13;let m=null;track($('s172'),(a,b)=>m=[a,b],()=>m=null);
 loop(o.c,t=>{const W=o.W,H=o.H;x.clearRect(0,0,W,H);const s=Math.min(W*.9/(2*G),H*.8/(G+7.5)),cx=W/2,cy=H*.5-(G+4)*s*.12,S=s*.93,mh=s*7.2,c0=(G-1)/2;
  const gg=x.createRadialGradient(cx,cy+G*s*.55,0,cx,cy+G*s*.55,G*s*1.25);gg.addColorStop(0,'rgba(124,92,255,.38)');gg.addColorStop(1,'rgba(124,92,255,0)');x.fillStyle=gg;x.fillRect(0,0,W,H);
  let mu=-99,mv=-99;if(m){const dx=(m[0]-cx)/s,dy=(m[1]-(cy+mh*.4))/(s*.5);mu=(dx+dy)/2;mv=(dy-dx)/2}
  for(let d=0;d<=2*G-2;d++)for(let i=Math.max(0,d-G+1);i<=Math.min(d,G-1);i++){const j=d-i,u=i-c0,v=j-c0;
   const w1=Math.sin(u*.55+t*1.3),w2=Math.sin(v*.5-t*1.0),w3=Math.sin(Math.hypot(u,v)*.95-t*2.4);let val=(w1*.35+w2*.35+w3*.45+1.15)/2.3;if(m)val+=Math.exp(-((u-mu)**2+(v-mv)**2)/5)*.55;val=clamp(val,0,1.05);
   const h=s*.5+val*mh,px=cx+(u-v)*s,py=cy+(u+v)*s*.5+mh*.4,ty=py-h,r=clamp(val,0,1),hue=268-80*r,l=50+r*14;
   x.fillStyle=`hsl(${hue},88%,${l-20}%)`;x.beginPath();x.moveTo(px-S,ty);x.lineTo(px,ty+S/2);x.lineTo(px,py+S/2);x.lineTo(px-S,py);x.closePath();x.fill();
   x.fillStyle=`hsl(${hue},88%,${l-9}%)`;x.beginPath();x.moveTo(px+S,ty);x.lineTo(px,ty+S/2);x.lineTo(px,py+S/2);x.lineTo(px+S,py);x.closePath();x.fill();
   x.fillStyle=`hsl(${hue},90%,${l+8}%)`;x.beginPath();x.moveTo(px,ty-S/2);x.lineTo(px+S,ty);x.lineTo(px,ty+S/2);x.lineTo(px-S,ty);x.closePath();x.fill();
   if(r>.72){x.globalAlpha=(r-.72)*2.2;x.fillStyle='#fff';x.beginPath();x.moveTo(px,ty-S*.3);x.lineTo(px+S*.6,ty);x.lineTo(px,ty+S*.3);x.lineTo(px-S*.6,ty);x.closePath();x.fill();x.globalAlpha=1}}})})();

// 173 sankey
(function(){const o=setup($('c173')),x=o.x,st=$('s173');
 const Ls=[['搜索','#22d3ee'],['直达','#8b5cf6'],['社交','#e879f9'],['RSS','#3b82f6']],Rs=[['首页','#a78bfa'],['音乐库','#22d3ee'],['影视库','#60a5fa'],['博客','#f472b6']];
 const F=Ls.map(()=>Rs.map(()=>({v:20+Math.random()*40,t:30}))),Pt=[];let hov=null,LP=[],RP=[],sc=1,xs=0,xe=0,m=null;
 function rt(){F.forEach(r=>r.forEach(f=>f.t=8+Math.random()*60))}rt();setInterval(rt,2600);
 track(st,(a,b)=>{m=[a,b]},()=>{m=null;hov=null});
 const hx=(c,a)=>{const n=parseInt(c.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`};
 loop(o.c,(t,dt)=>{const W=o.W,H=o.H;x.clearRect(0,0,W,H);F.forEach(r=>r.forEach(f=>f.v+=(f.t-f.v)*.03));
  const top=64,bot=26,gap=14,pl=96,pr=96;xs=pl;xe=W-pr;const xm=(xs+xe)/2;const tot=F.flat().reduce((a,f)=>a+f.v,0);sc=(H-top-bot-3*gap)/tot;
  const ls=F.map(r=>r.reduce((a,f)=>a+f.v,0)),rs=Rs.map((_,j)=>F.reduce((a,r)=>a+r[j].v,0));LP=[];RP=[];let y=top;ls.forEach(v=>{LP.push(y);y+=v*sc+gap});y=top;rs.forEach(v=>{RP.push(y);y+=v*sc+gap});
  const lo=ls.map(()=>0),ro=rs.map(()=>0),rib=[];
  F.forEach((r,i)=>{r.forEach((f,j)=>{const h=f.v*sc,sy=LP[i]+lo[i],ty=RP[j]+ro[j];lo[i]+=h;ro[j]+=h;rib.push({i,j,h,sy,ty,f})})});
  m&&(()=>{hov=null;const a=m[0],b=m[1];if(a>xs-30&&a<xs+16)LP.forEach((p,i)=>{if(b>p&&b<p+ls[i]*sc)hov=['l',i]});if(a>xe-16&&a<xe+30)RP.forEach((p,j)=>{if(b>p&&b<p+rs[j]*sc)hov=['r',j]})})();
  rib.forEach(r=>{const on=!hov||(hov[0]==='l'?r.i===hov[1]:r.j===hov[1]),g=x.createLinearGradient(xs,0,xe,0);g.addColorStop(0,hx(Ls[r.i][1],on?.5:.08));g.addColorStop(1,hx(Rs[r.j][1],on?.5:.08));
   x.fillStyle=g;x.beginPath();x.moveTo(xs,r.sy);x.bezierCurveTo(xm,r.sy,xm,r.ty,xe,r.ty);x.lineTo(xe,r.ty+r.h);x.bezierCurveTo(xm,r.ty+r.h,xm,r.sy+r.h,xs,r.sy+r.h);x.closePath();x.fill()});
  for(let k=0;k<3;k++){let q=Math.random()*tot,pick=rib[0];for(const r of rib){q-=r.f.v;if(q<=0){pick=r;break}}if(Pt.length<260)Pt.push({i:pick.i,j:pick.j,t:0,sp:.2+Math.random()*.22,off:(Math.random()-.5)*.8})}
  x.globalCompositeOperation='lighter';
  for(let k=Pt.length-1;k>=0;k--){const p=Pt[k];p.t+=p.sp*dt;if(p.t>=1){Pt.splice(k,1);continue}const r=rib.find(q=>q.i===p.i&&q.j===p.j);if(!r)continue;
   const on=!hov||(hov[0]==='l'?r.i===hov[1]:r.j===hov[1]);if(!on)continue;const u=p.t,px=xs+(xe-xs)*(1.5*u-1.5*u*u+u*u*u),py=(r.sy+r.h/2)+(r.ty-r.sy)*(3*u*u-2*u*u*u)+p.off*r.h;
   const c1=Ls[r.i][1],c2=Rs[r.j][1];x.fillStyle=hx(u<.5?c1:c2,.95);x.beginPath();x.arc(px,py,1.9,0,7);x.fill();x.fillStyle=hx(u<.5?c1:c2,.22);x.beginPath();x.arc(px,py,5,0,7);x.fill()}
  x.globalCompositeOperation='source-over';
  Ls.forEach((l,i)=>{const h=ls[i]*sc;x.fillStyle=l[1];x.shadowColor=l[1];x.shadowBlur=14;rr(x,xs-8,LP[i],8,h,3);x.fill();x.shadowBlur=0;x.textAlign='right';x.fillStyle='#fff';x.font='700 12px "Noto Sans SC",sans-serif';x.fillText(l[0],xs-16,LP[i]+h/2-1);x.fillStyle='rgba(215,210,255,.7)';x.font='11px "JetBrains Mono",monospace';x.fillText((ls[i]*12.4|0).toLocaleString(),xs-16,LP[i]+h/2+13)});
  Rs.forEach((l,j)=>{const h=rs[j]*sc;x.fillStyle=l[1];x.shadowColor=l[1];x.shadowBlur=14;rr(x,xe,RP[j],8,h,3);x.fill();x.shadowBlur=0;x.textAlign='left';x.fillStyle='#fff';x.font='700 12px "Noto Sans SC",sans-serif';x.fillText(l[0],xe+16,RP[j]+h/2-1);x.fillStyle='rgba(215,210,255,.7)';x.font='11px "JetBrains Mono",monospace';x.fillText((rs[j]*12.4|0).toLocaleString(),xe+16,RP[j]+h/2+13)})})})();

// 174 heatmap
(function(){const o=setup($('c174')),x=o.x,st=$('s174'),tip=$('tip174'),R=7,C=27,COL=['#e6e2f7','#c6bdf8','#8f86f5','#5b6cf0','#22c7e8'],PV=[0,1,2,3,5];
 let seed=3;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,dow=new Date().getDay(),cells=[];
 for(let c=0;c<C;c++)for(let r=0;r<R;r++){const ago=(C-1-c)*7+(dow-r);if(ago<0)continue;const v=rnd();let l=v<.4?0:v<.65?1:v<.83?2:v<.94?3:4;if((r===0||r===6)&&rnd()<.5)l=0;const d=new Date();d.setDate(d.getDate()-ago);cells.push({c,r,l,pop:0,d})}
 let tot=cells.reduce((a,k)=>a+PV[k.l],0);const hte=$('ht');countTo(hte,tot,1200);
 setInterval(()=>{const k=cells[Math.random()*cells.length|0];const o2=PV[k.l];k.l=Math.random()<.78?Math.min(4,k.l+1):Math.max(0,k.l-1);k.pop=1;tot+=PV[k.l]-o2;countTo(hte,tot,500)},420);
 let L={};let hv=null;
 st.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,cc=Math.floor((px-L.gx)/(L.cs+L.gp)),rw=Math.floor((py-L.gy)/(L.cs+L.gp));hv=cells.find(k=>k.c===cc&&k.r===rw)||null;if(hv){tip.style.opacity=1;tip.style.left=L.gx+hv.c*(L.cs+L.gp)+L.cs/2+'px';tip.style.top=L.gy+hv.r*(L.cs+L.gp)+'px';tip.textContent=`${hv.d.getMonth()+1}月${hv.d.getDate()}日 · ${PV[hv.l]?PV[hv.l]+' 篇文章':'没有发文'}`}else tip.style.opacity=0});
 st.addEventListener('pointerleave',()=>{hv=null;tip.style.opacity=0});
 loop(o.c,(t,dt)=>{const W=o.W,H=o.H;x.clearRect(0,0,W,H);const gp=4,gy=108,mx=44,cs=Math.min((W-mx-24-(C-1)*gp)/C,(H-gy-44-(R-1)*gp)/R),gx=mx+(W-mx-24-(C*cs+(C-1)*gp))/2;L={gx,gy,cs,gp};
  x.font='10px "JetBrains Mono",monospace';x.fillStyle='#8a8fb8';x.textAlign='right';['一','三','五'].forEach((d,i)=>x.fillText(d,gx-10,gy+(1+i*2)*(cs+gp)+cs*.7));
  x.textAlign='left';let lm=-1;cells.forEach(k=>{if(k.r===0||k.c===0&&k.r<2){const mo=k.d.getMonth();if(mo!==lm&&k.c<C-2){lm=mo;x.fillText((mo+1)+'月',gx+k.c*(cs+gp),gy-10)}}});
  const wx=((t*5)%(C+12))-6;
  cells.forEach(k=>{k.pop=Math.max(0,k.pop-dt*2.2);const b=Math.exp(-((k.c-wx)**2)/4),sc=1+.3*b+.55*k.pop*k.pop+(hv===k?.25:0),cx=gx+k.c*(cs+gp)+cs/2,cy=gy+k.r*(cs+gp)+cs/2,w=cs*sc;
   x.fillStyle=COL[k.l];if(k.l===4||k.pop>.1){x.shadowColor='#22c7e8';x.shadowBlur=12*Math.max(k.pop,k.l===4?.6:0)}rr(x,cx-w/2,cy-w/2,w,w,w*.28);x.fill();x.shadowBlur=0;
   if(b>.05){x.globalAlpha=b*.55;x.fillStyle='#fff';rr(x,cx-w/2,cy-w/2,w,w,w*.28);x.fill();x.globalAlpha=1}})})})();

// 175 KPI
(function(){const T=[{n:'今日访客',v:12840,c:'#8b5cf6',c2:'#c084fc',i:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',inc:[2,9]},{n:'音乐播放',v:48210,c:'#3b82f6',c2:'#22d3ee',i:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',inc:[8,34]},{n:'影视观看',v:9632,c:'#06b6d4',c2:'#34d399',i:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',inc:[1,6]},{n:'RSS 新文章',v:3126,c:'#d946ef',c2:'#8b5cf6',i:'<path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8"/><circle cx="6" cy="18" r="1.4"/>',inc:[1,4]}];
 const box=$('kpi');T.forEach((t,k)=>{const d=document.createElement('div');d.className='kt';d.style.cssText=`--c:${t.c};--c2:${t.c2}`;d.innerHTML=`<div class="h"><div class="ic"><svg viewBox="0 0 24 24">${t.i}</svg></div><small>${t.n}</small><span class="lv"><i></i>LIVE</span></div><b id="kv${k}">0</b><span class="dl" id="kd${k}" style="position:absolute;right:14px;top:62px;margin:0">▲ 0%</span><canvas></canvas>`;box.appendChild(d);t.cv=d.querySelector('canvas');t.d=Array.from({length:32},(_,i)=>50+Math.sin(i/3+k)*20+Math.random()*10);t.acc=0;t.vn=0;countTo($('kv'+k),t.v,1200);
  const o=setup(t.cv),x=o.x;let simT=0;
  loop(t.cv,(tm,dt)=>{t.acc+=dt;while(t.acc>=.7){t.acc-=.7;simT+=.7;t.d.shift();t.d.push(clamp(50+Math.sin(simT*.5+k*1.7)*24+Math.sin(simT*1.3+k)*10+Math.random()*10,10,95))}
   const fr=t.acc/.7,W=o.W,H=o.H,dx=W/(t.d.length-3),pts=t.d.map((v,i)=>[(i-1-fr)*dx,H-(v/100)*H*.82-4]);x.clearRect(0,0,W,H);
   const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,t.c+'44');g.addColorStop(1,t.c+'00');x.beginPath();curve(x,pts);x.lineTo(pts[pts.length-1][0],H);x.lineTo(pts[0][0],H);x.closePath();x.fillStyle=g;x.fill();
   x.beginPath();curve(x,pts);x.lineWidth=2.4;x.lineJoin='round';const lg=x.createLinearGradient(0,0,W,0);lg.addColorStop(0,t.c2);lg.addColorStop(1,t.c);x.strokeStyle=lg;x.stroke();
   const hy=pts[pts.length-2][1]*(1-fr)+pts[pts.length-1][1]*fr;x.fillStyle=t.c;x.globalAlpha=.25;x.beginPath();x.arc(W-7,hy,6+3*Math.abs(Math.sin(tm*3)),0,7);x.fill();x.globalAlpha=1;x.fillStyle='#fff';x.strokeStyle=t.c;x.lineWidth=2.2;x.beginPath();x.arc(W-7,hy,3.5,0,7);x.fill();x.stroke()});
  setInterval(()=>{t.v+=Math.round(t.inc[0]+Math.random()*(t.inc[1]-t.inc[0]));countTo($('kv'+k),t.v,700);$('kd'+k).textContent=(Math.random()<.8?'▲ ':'▼ ')+(Math.random()*18+.5).toFixed(1)+'%'},1100+k*170)})})();

// 176 streamgraph
(function(){const o=setup($('c176')),x=o.x,st=$('s176');
 const K=[['音乐','#8b5cf6',.95,.9,0],['影视','#3b82f6',.8,1.25,1.4],['订阅','#22d3ee',.7,.75,2.6],['博客','#e879f9',.6,1.5,3.9],['相册','#6366f1',.5,1.0,5.1],['播客','#2dd4bf',.45,1.8,.7]];
 $('ch176').innerHTML=K.map((k,i)=>`<div class="chip" style="--c:${k[1]}"><i></i>${k[0]}<b id="sv${i}" style="min-width:3.2ch">0</b></div>`).join('');
 let m=null,share=K.map(()=>0);track(st,(a,b)=>m=[a,b],()=>m=null);let lastU=0;
 const th=(k,xn,t)=>k[2]*(.55+.45*Math.sin(xn*3.2*k[3]-t*1.3*k[3]+k[4])*(.6+.4*Math.sin(xn*1.7+t*.4+k[4]*2)));
 loop(o.c,t=>{const W=o.W,H=o.H;x.clearRect(0,0,W,H);const amp=1+.12*Math.sin(t*.7),sc=H*.56/4.6/1.12,cy=H*.47;
  x.strokeStyle='rgba(180,170,255,.09)';x.lineWidth=1;for(let k=0;k<12;k++){const vx=((k*70-t*46)%(W+70)+W+70)%(W+70)-35;x.beginPath();x.moveTo(vx,60);x.lineTo(vx,H-54);x.stroke()}
  const cols=[],step=4;for(let X=0;X<=W+step;X+=step){const xn=X/W;let sum=0;const v=K.map(k=>{const a=th(k,xn,t)*amp*sc;sum+=a;return a});const base=cy-sum/2+Math.sin(xn*5+t*.9)*8;let y=base;cols.push(v.map(a=>{const r=[y,y+a];y+=a;return r}))}
  K.forEach((k,i)=>{const g=x.createLinearGradient(0,cy-H*.3,0,cy+H*.3);g.addColorStop(0,k[1]+'f2');g.addColorStop(1,k[1]+'a8');x.beginPath();cols.forEach((c,j)=>{j?x.lineTo(j*step,c[i][0]):x.moveTo(0,c[i][0])});for(let j=cols.length-1;j>=0;j--)x.lineTo(j*step,cols[j][i][1]);x.closePath();x.fillStyle=g;x.fill();
   x.beginPath();cols.forEach((c,j)=>j?x.lineTo(j*step,c[i][0]):x.moveTo(0,c[i][0]));x.strokeStyle='rgba(255,255,255,.4)';x.lineWidth=1;x.stroke()});
  if(t-lastU>.45){lastU=t;const mid=cols[Math.floor(cols.length/2)],tt=mid.reduce((a,r)=>a+r[1]-r[0],0);mid.forEach((r,i)=>{const e=$('sv'+i);if(e)e.textContent=Math.round((r[1]-r[0])/tt*100)+'%'})}
  if(m&&m[1]>50&&m[1]<H-50){const j=clamp(Math.round(m[0]/step),0,cols.length-1),c=cols[j],vx=j*step;x.strokeStyle='rgba(255,255,255,.55)';x.beginPath();x.moveTo(vx,60);x.lineTo(vx,H-54);x.stroke();const tt=c.reduce((a,r)=>a+r[1]-r[0],0);
   const bw=106,bh=14+K.length*16,bx=Math.min(vx+14,W-bw-8),by=64;x.fillStyle='rgba(12,14,42,.9)';rr(x,bx,by,bw,bh,10);x.fill();x.strokeStyle='rgba(255,255,255,.2)';x.stroke();
   K.forEach((k,i)=>{const r=c[i],my=(r[0]+r[1])/2;x.fillStyle='#fff';x.strokeStyle=k[1];x.lineWidth=2.4;x.beginPath();x.arc(vx,my,3.5,0,7);x.fill();x.stroke();x.fillStyle=k[1];x.beginPath();x.arc(bx+13,by+17+i*16,3.5,0,7);x.fill();x.fillStyle='#fff';x.font='11px "Noto Sans SC",sans-serif';x.textAlign='left';x.fillText(k[0],bx+23,by+21+i*16);x.textAlign='right';x.font='700 11px "JetBrains Mono",monospace';x.fillText(((r[1]-r[0])/sc*10).toFixed(0),bx+bw-10,by+21+i*16)})}})})();

// 177 now playing
(function(){const np=$('np'),cv=$('wf'),o=setup(cv),x=o.x,N=64,DUR=204,SPD=7;let playing=true,pos=34;
 const H=[];let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;for(let i=0;i<N;i++)H.push(.2+.8*Math.pow(Math.abs(Math.sin(i*.31)*.6+Math.sin(i*.9+1)*.25+rnd()*.4),1.1));
 const fm=v=>Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');
 $('pp').onclick=()=>{playing=!playing;np.classList.toggle('ps',!playing);$('ppi').innerHTML=playing?'<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>':'<path d="M7 4l13 8-13 8z"/>'};
 cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect();pos=clamp((e.clientX-r.left)/r.width,0,1)*DUR});
 loop(cv,(t,dt)=>{if(playing){pos+=dt*SPD;if(pos>=DUR)pos=0}const W=o.W,Hh=o.H,bw=W/N,pr=pos/DUR;x.clearRect(0,0,W,Hh);
  const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'#22d3ee');g.addColorStop(.6,'#8b5cf6');g.addColorStop(1,'#e879f9');
  for(let i=0;i<N;i++){const on=i/N<pr,near=Math.max(0,1-Math.abs(i/N-pr)*14),live=playing?near*(.25+.25*Math.sin(t*14+i)):0,h=Math.max(4,(H[i]+live)*Hh*.9);x.fillStyle=on?g:'rgba(255,255,255,.3)';rr(x,i*bw+bw*.18,(Hh-h)/2,bw*.64,h,bw*.32);x.fill()}
  x.fillStyle='#fff';x.shadowColor='#fff';x.shadowBlur=10;x.fillRect(pr*W-1,2,2,Hh-4);x.shadowBlur=0;$('tc').textContent=fm(pos)})})();

// 178 feed
(function(){const fl=$('fl'),K={RSS:['#3b82f6','#22d3ee'],音乐:['#8b5cf6','#c084fc'],影视:['#06b6d4','#34d399'],博客:['#d946ef','#8b5cf6']},ICO={RSS:'R',音乐:'♪',影视:'▶',博客:'✎'};
 const POOL=[['RSS','少数派 · 自建 NAS 的十个进阶玩法'],['音乐','新专辑入库 · Neon Skyline'],['影视','纪录片 · 深海光影 第 3 集'],['博客','新文章 · 我如何用 Cloudflare 部署媒体站'],['RSS','阮一峰的网络日志 · 本周分享'],['音乐','播放列表更新 · 深夜写代码'],['影视','新片入库 · 星际远航 (4K)'],['RSS','Hacker News · 每日精选'],['博客','动效笔记 · 让页面呼吸'],['音乐','最近常听 · Midnight Tapes'],['影视','剧集更新 · 城市夜行者 S2E5'],['RSS','InfoQ · 前端性能优化指南']];
 let items=[],idx=0,cnt=128,hover=false;const H=66,MAX=5;
 function pos(){items.forEach((it,i)=>{it.el.style.transform=`translateY(${i*H}px)`;it.el.style.opacity=i>=MAX?0:1})}
 function add(){const [k,txt]=POOL[idx++%POOL.length],el=document.createElement('div');el.className='fi nw';el.style.cssText=`--c:${K[k][0]};--c2:${K[k][1]};transform:translateY(${-H}px) scale(.96);opacity:0`;el.innerHTML=`<div class="ic">${ICO[k]}</div><div class="tx"><b>${txt}</b><span>刚刚</span></div><span class="tag">${k}</span>`;fl.appendChild(el);items.unshift({el,t0:performance.now(),sp:el.querySelector('.tx span')});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transform='translateY(0)';pos()}));if(items.length>MAX+1){const old=items.pop();old.el.style.opacity=0;setTimeout(()=>old.el.remove(),700)}cnt++;$('fcn').textContent=`今日 ${cnt} 条`;setTimeout(()=>el.classList.remove('nw'),1600)}
 for(let i=0;i<4;i++){add()}items.forEach((it,i)=>it.t0-=(i+1)*9000);
 setInterval(()=>{if(!hover)add()},2200);setInterval(()=>items.forEach(it=>{const s=Math.floor((performance.now()-it.t0)/1000);it.sp.textContent=s<5?'刚刚':s<60?s+' 秒前':Math.floor(s/60)+' 分钟前'}),1000);
 $('s178').addEventListener('pointerenter',()=>hover=true);$('s178').addEventListener('pointerleave',()=>hover=false)})();

$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
