
const $=id=>document.getElementById(id);
const vis=new Map(),io=new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)));
function loop(el,fn){vis.set(el,true);io.observe(el);let last=0;(function f(ms){requestAnimationFrame(f);if(!vis.get(el))return;const t=ms/1000;fn(t,Math.min(t-last,.05));last=t})(0)}
function setup(c){const o={c,x:c.getContext('2d'),W:300,H:300};const f=()=>{const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);o.W=r.width;o.H=r.height;c.width=r.width*d;c.height=r.height*d;o.x.setTransform(d,0,0,d,0,0)};f();new ResizeObserver(f).observe(c);return o}
function track(el,mv,lv){el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();mv(e.clientX-r.left,e.clientY-r.top,r)});lv&&el.addEventListener('pointerleave',lv)}

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
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float f3(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n3(p);p=p*2.03+vec3(1.3,7.1,3.7);a*=.5;}return v;}
`;
function glInit(canvas,stage,frag){const gl=canvas.getContext('webgl',{antialias:false,alpha:false});if(!gl){canvas.style.display='none';return null}
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(x));return x};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,GLH+frag));gl.linkProgram(pr);gl.useProgram(pr);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 const uR=gl.getUniformLocation(pr,'R'),uT=gl.getUniformLocation(pr,'T'),uM=gl.getUniformLocation(pr,'M');const o={m:[.5,.5],mt:[.5,.5]};
 track(stage,(x,y,r)=>o.mt=[x/r.width,1-y/r.height],()=>o.mt=[.5,.5]);
 loop(canvas,t=>{const d=Math.min(devicePixelRatio||1,1.5),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  o.m[0]+=(o.mt[0]-o.m[0])*.05;o.m[1]+=(o.mt[1]-o.m[1])*.05;gl.uniform2f(uR,w,h);gl.uniform1f(uT,t);gl.uniform2f(uM,o.m[0],o.m[1]);gl.drawArrays(gl.TRIANGLES,0,3)});return o}

// 153 mesh gradient
glInit($('c153'),$('s153'),`void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;p+=(M-.5)*.3;float t=T*.1;
vec2 q=vec2(fbm(p*1.5+t),fbm(p*1.5+vec2(5.2,1.3)-t));
vec2 r=vec2(fbm(p*1.5+3.*q+vec2(1.7,9.2)+t*1.3),fbm(p*1.5+3.*q+vec2(8.3,2.8)-t));
float f=fbm(p*1.4+3.*r);
vec3 cream=vec3(.97,.93,.86),peach=vec3(1.,.67,.56),violet=vec3(.5,.4,.9),navy=vec3(.1,.16,.45);
vec3 col=mix(cream,peach,smoothstep(.15,.6,f));
col=mix(col,violet,smoothstep(.35,.9,length(q)*f*2.));
col=mix(col,navy,smoothstep(.6,1.2,length(r)*f*1.6));
col+=vec3(1.,.92,.8)*pow(f,3.)*.15;
col+=(hash(gl_FragCoord.xy+fract(T))-.5)*.04;
col*=1.-.3*dot(uv-.5,uv-.5);
gl_FragColor=vec4(col,1.);}`);
// 154 liquid pearl
glInit($('c154'),$('s154'),`float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float map(vec3 p){float t=T*.6;
float d=length(p-vec3(sin(t)*.5,cos(t*1.3)*.35,sin(t*.7)*.3))-.56;
d=smin(d,length(p-vec3(cos(t*.9)*.55,sin(t*1.1)*.4,cos(t)*.3))-.46,.5);
d=smin(d,length(p-vec3(sin(t*1.4+2.)*.4,cos(t*.8+1.)*.5,0.))-.38,.5);
return d+.012*sin(p.x*9.+T)*sin(p.y*9.-T*1.2)*sin(p.z*9.);}
vec3 nor(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
vec3 env(vec3 d){float y=d.y*.5+.5;vec3 c=mix(vec3(.96,.86,.8),vec3(.55,.62,.96),y);
c+=vec3(1.,.92,.75)*pow(max(dot(d,normalize(vec3(.5,.8,.3))),0.),22.)*2.2;
c+=vec3(.4,.6,1.)*pow(max(dot(d,normalize(vec3(-.7,.2,.5))),0.),10.)*.8;return c;}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
vec3 ro=vec3(0.,0.,-2.5),rd=normalize(vec3(p-(M-.5)*.25,1.5));
vec3 bg=mix(vec3(.93,.9,.86),vec3(.98,.96,.93),uv.y);bg=mix(bg,vec3(.85,.86,.95),smoothstep(.0,.9,length(p)));
float tt=0.,d=0.;bool hit=false;for(int i=0;i<72;i++){d=map(ro+rd*tt);if(d<.001){hit=true;break;}tt+=d;if(tt>6.)break;}
vec3 col=bg;
// soft ground shadow
col*=1.-.22*smoothstep(.55,.0,length(vec2(p.x*.9,p.y+.52))-.0)*smoothstep(-.3,-.62,p.y);
if(hit){vec3 pos=ro+rd*tt,n=nor(pos);vec3 rf=reflect(rd,n);float fr=pow(1.-max(dot(-rd,n),0.),3.);
vec3 ir=.5+.5*cos(6.2831*(fr*1.1+vec3(0.,.33,.67)+T*.04));
vec3 c=env(rf)*.92;c=mix(c,ir,.42*fr+.12);
c+=.28*env(refract(rd,n,.8))*(1.-fr);c+=pow(fr,4.)*.45;col=c;}
col+=(hash(gl_FragCoord.xy+fract(T))-.5)*.03;gl_FragColor=vec4(col,1.);}`);
// 164 planet
glInit($('c164'),$('s164'),`void main(){vec2 p=(gl_FragCoord.xy-.5*R)/R.y;p+=(M-.5)*.04;
vec3 col=vec3(.012,.016,.04);
vec2 sp=gl_FragCoord.xy/R.y*70.;float h=hash(floor(sp));col+=vec3(step(.986,h))*pow(hash(floor(sp)+7.),2.)*(.55+.45*sin(T*2.+h*40.));
col+=vec3(.07,.05,.16)*fbm(p*2.2+T*.01)*1.4;
float rad=.36,d=length(p);vec3 L=normalize(vec3(-.65,.45,.65));
if(d<rad){float z=sqrt(rad*rad-d*d);vec3 n=normalize(vec3(p,z));float a=T*.09;float cs=cos(a),sn=sin(a);vec3 s3=vec3(n.x*cs+n.z*sn,n.y,-n.x*sn+n.z*cs);
float h2=f3(s3*2.3)+.35*f3(s3*7.);
vec3 ocean=mix(vec3(.02,.1,.28),vec3(.05,.3,.5),smoothstep(.3,.62,h2));
vec3 land=mix(vec3(.2,.38,.17),vec3(.62,.52,.34),smoothstep(.66,.9,h2));
float lm=smoothstep(.64,.68,h2);vec3 c=mix(ocean,land,lm);
c=mix(c,vec3(.95),smoothstep(.74,.95,abs(s3.y)+h2*.15)*.85);
float cl=f3(s3*3.2+vec3(T*.03,0.,0.)+9.);c=mix(c,vec3(1.),smoothstep(.52,.78,cl)*.75);
float diff=max(dot(n,L),0.);c*=.05+diff*1.25;
vec3 H=normalize(L+vec3(0.,0.,1.));c+=vec3(1.,.95,.8)*pow(max(dot(n,H),0.),70.)*(1.-lm)*.7;
float fr=pow(1.-n.z,2.6);c+=vec3(.3,.55,1.)*fr*(.25+diff*1.3);col=c;}
float g=exp(-pow(max(d-rad,0.)*18.,1.2))*step(rad,d);col+=vec3(.2,.45,1.)*g*.55*(.25+.75*max(dot(normalize(p),normalize(L.xy)),0.));
col+=(hash(gl_FragCoord.xy+fract(T))-.5)*.02;gl_FragColor=vec4(col,1.);}`);

// 155 silk flow field
(function(){const o=setup($('c155')),x=o.x;let P=[],age=0,seed=Math.random()*100;
 const hs=(a,b)=>{const s=Math.sin(a*127.1+b*311.7+seed)*43758.5453;return s-Math.floor(s)};
 const nz=(a,b)=>{const i=Math.floor(a),j=Math.floor(b);let u=a-i,v=b-j;u=u*u*(3-2*u);v=v*v*(3-2*v);return hs(i,j)*(1-u)*(1-v)+hs(i+1,j)*u*(1-v)+hs(i,j+1)*(1-u)*v+hs(i+1,j+1)*u*v};
 function reset(){seed=Math.random()*100;age=0;x.globalCompositeOperation='source-over';x.fillStyle='#0d1230';x.fillRect(0,0,o.W,o.H);P=[];for(let i=0;i<1400;i++)P.push({x:Math.random()*o.W,y:Math.random()*o.H,g:Math.random()<.18})}
 reset();let fading=false;
 loop(o.c,t=>{if(fading)return;x.lineWidth=.7;
  for(const p of P){const a=(nz(p.x*.0042,p.y*.0042)*2+nz(p.x*.011+9,p.y*.011)*.5)*Math.PI*2.4,nx=p.x+Math.cos(a)*1.6,ny=p.y+Math.sin(a)*1.6;
   x.strokeStyle=p.g?'rgba(238,208,140,.16)':'rgba(140,170,255,.11)';x.beginPath();x.moveTo(p.x,p.y);x.lineTo(nx,ny);x.stroke();p.x=nx;p.y=ny;if(p.x<-5||p.x>o.W+5||p.y<-5||p.y>o.H+5){p.x=Math.random()*o.W;p.y=Math.random()*o.H}}
  if(++age>1100){fading=true;o.c.style.opacity=0;setTimeout(()=>{reset();o.c.style.opacity=1;fading=false},1000)}})})();

// 156 dawn mountains
(function(){const s=$('mts'),W=400,H=300;let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 function mk(base,amp,f,off){const r=Array.from({length:64},()=>rnd());const n=x=>{const i=Math.floor(x),t=x-i,a=r[((i%64)+64)%64],b=r[(((i+1)%64)+64)%64],u=t*t*(3-2*t);return a+(b-a)*u};
  let d=`M-80,${H+10}`;for(let x=-80;x<=W+80;x+=5){const y=base-amp*(.62*n(x*f+off)+.28*n(x*f*2.1+off+9)+.1*n(x*f*4.3+off+3));d+=` L${x},${y.toFixed(1)}`}return d+` L${W+80},${H+10} Z`}
 const L=[{b:198,a:60,f:.011,c:['#cdb4e8','#f3cbc2']},{b:216,a:74,f:.013,c:['#9c90d2','#e3b8c6']},{b:238,a:70,f:.016,c:['#6b73b9','#b896c0']},{b:260,a:56,f:.021,c:['#404f91','#7d76ad']},{b:284,a:40,f:.027,c:['#222d60','#3b4678']}];
 let h=`<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2155"/><stop offset=".38" stop-color="#5a4a96"/><stop offset=".64" stop-color="#e58ba2"/><stop offset=".82" stop-color="#ffbf8c"/><stop offset="1" stop-color="#ffe3ac"/></linearGradient>
 <radialGradient id="sg"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset=".25" stop-color="#ffc27a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a7a" stop-opacity="0"/></radialGradient><filter id="bf" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>${L.map((l,i)=>`<linearGradient id="m${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l.c[0]}"/><stop offset="1" stop-color="${l.c[1]}"/></linearGradient>`).join('')}</defs>`;
 h+=`<g class="ly" data-d="0.02"><rect x="-60" y="-30" width="520" height="360" fill="url(#sk)"/>`;for(let i=0;i<40;i++){const y=Math.random()*130;h+=`<circle class="tw" cx="${Math.random()*400}" cy="${y}" r="${.5+Math.random()*.9}" fill="#fff" opacity="${(1-y/130)*.9}" style="animation-delay:${-Math.random()*3}s"/>`}h+='</g>';
 h+=`<g class="ly" data-d="0.05"><circle class="sn" cx="268" cy="190" r="110" fill="url(#sg)"/><circle cx="268" cy="192" r="20" fill="#fff4cf"/></g>`;
 const fog=(y,c,cls,d)=>`<g class="ly" data-d="${d}"><g class="${cls}"><ellipse cx="90" cy="${y}" rx="170" ry="13" fill="#fff" opacity=".4" filter="url(#bf)"/><ellipse cx="330" cy="${y+8}" rx="150" ry="11" fill="#ffe9d4" opacity=".35" filter="url(#bf)"/></g></g>`;
 L.forEach((l,i)=>{h+=`<g class="ly" data-d="${(.1+i*.16).toFixed(2)}"><path d="${mk(l.b,l.a,l.f,i*13)}" fill="url(#m${i})"/></g>`;if(i===1)h+=fog(232,0,'fg',.3);if(i===3)h+=fog(262,0,'fg2',.58)});
 h+=`<g class="bd" fill="none" stroke="#2c2450" stroke-width="1.3" stroke-linecap="round"><path d="M0,0 q5,-6 10,0 q5,-6 10,0"/></g><g class="bd" fill="none" stroke="#2c2450" stroke-width="1.1" stroke-linecap="round"><path d="M0,0 q4,-5 8,0 q4,-5 8,0"/></g>`;
 s.innerHTML=h;const ly=[...s.querySelectorAll('.ly')];let mx=0,my=0,tx=0,ty=0;const st=$('mt');track(st,(x,y,r)=>{tx=x/r.width-.5;ty=y/r.height-.5},()=>{tx=0;ty=0});
 loop(st,t=>{if(!st.matches(':hover')){tx=Math.sin(t*.35)*.35;ty=Math.cos(t*.27)*.2}mx+=(tx-mx)*.05;my+=(ty-my)*.05;ly.forEach(g=>{const d=+g.dataset.d;g.style.transform=`translate(${-mx*d*46}px,${-my*d*16}px)`})})})();

// 157 watch
(function(){const s=$('wsv');let h='<defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe9bd"/><stop offset=".5" stop-color="#c99650"/><stop offset="1" stop-color="#f5dca3"/></linearGradient><filter id="hs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="2.5" flood-color="#000" flood-opacity=".55"/></filter></defs><g transform="translate(150 150)">';
 for(let i=0;i<60;i++){if(i%5)h+=`<line x1="0" y1="-117" x2="0" y2="-121" stroke="#ffffff88" stroke-width=".9" transform="rotate(${i*6})"/>`}
 for(let i=0;i<12;i++){if(i===3)continue;const L=i%3?15:24;h+=`<rect x="-3" y="-117" width="6" height="${L}" rx="1" fill="url(#gd)" stroke="#0006" stroke-width=".5" transform="rotate(${i*30})"/>`}
 const d=new Date();h+=`<rect x="84" y="-10" width="30" height="20" rx="2" fill="#f4efe3" stroke="url(#gd)" stroke-width="2"/><text x="99" y="5" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#14204e">${d.getDate()}</text>`;
 h+=`<text y="-56" text-anchor="middle" font-family="Noto Serif SC,serif" font-size="12" letter-spacing="5" fill="#f3dca6">ARCHIVE</text><text y="-42" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="6" letter-spacing="3" fill="#fff9">AUTOMATIC · 200M</text>`;
 h+=`<g filter="url(#hs)"><g id="hh"><path d="M-5,14 L-3.5,-56 L0,-66 L3.5,-56 L5,14Z" fill="url(#gd)" stroke="#0007" stroke-width=".6"/><path d="M-1.6,-8 L-1.2,-54 L0,-58 L1.2,-54 L1.6,-8Z" fill="#cfe9ff" opacity=".9"/></g>
 <g id="mm"><path d="M-4,16 L-2.8,-92 L0,-102 L2.8,-92 L4,16Z" fill="url(#gd)" stroke="#0007" stroke-width=".6"/><path d="M-1.2,-8 L-.9,-90 L0,-94 L.9,-90 L1.2,-8Z" fill="#cfe9ff" opacity=".9"/></g>
 <g id="ss"><line y1="30" y2="-108" stroke="#e8553d" stroke-width="1.5"/><circle cy="24" r="4.5" fill="#e8553d"/><circle cy="-80" r="3.2" fill="#e8553d"/></g></g><circle r="7" fill="url(#gd)" stroke="#0007" stroke-width=".6"/><circle r="2.4" fill="#14204e"/></g>`;
 s.innerHTML=h;const hh=$('hh'),mm=$('mm'),ss=$('ss');const w=$('wsv').parentElement.parentElement;
 loop(w,()=>{const n=new Date(),sec=n.getSeconds()+n.getMilliseconds()/1000,min=n.getMinutes()+sec/60,hr=(n.getHours()%12)+min/60;ss.setAttribute('transform',`rotate(${sec*6})`);mm.setAttribute('transform',`rotate(${min*6})`);hh.setAttribute('transform',`rotate(${hr*30})`)})})();

// 158 holo card
(function(){const st=$('hs'),c=$('holo');let tx=50,ty=50,cx=50,cy=50,act=false;
 track(st,(x,y,r)=>{act=true;tx=x/r.width*100;ty=y/r.height*100},()=>act=false);
 loop(st,t=>{if(!act){tx=50+Math.sin(t*.8)*34;ty=50+Math.cos(t*.6)*30}cx+=(tx-cx)*.12;cy+=(ty-cy)*.12;
  c.style.setProperty('--mx',cx+'%');c.style.setProperty('--my',cy+'%');c.style.setProperty('--ry',((cx-50)*.36)+'deg');c.style.setProperty('--rx',(-(cy-50)*.3)+'deg')})})();

// 159 siri waves
(function(){const o=setup($('c159')),x=o.x,L=[{c:'#00d4ff',a:1,f:1.1,s:1.6,p:0},{c:'#7a5cff',a:.85,f:1.5,s:-1.3,p:1.7},{c:'#ff4fa3',a:.7,f:1.9,s:2.1,p:3.1},{c:'#ffd27a',a:.5,f:2.4,s:-1.8,p:4.4},{c:'#ffffff',a:.35,f:3,s:2.6,p:.6}];
 loop(o.c,t=>{const W=o.W,H=o.H,cy=H/2,vol=.45+.55*Math.abs(Math.sin(t*1.1)*Math.sin(t*.37+1));x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';x.lineJoin='round';
  L.forEach(l=>{for(const m of[1,-1]){x.beginPath();for(let X=0;X<=W;X+=3){const u=X/W*2-1,env=Math.pow(1-u*u,2.4),y=cy+m*Math.sin(u*Math.PI*l.f*2+t*l.s+l.p)*H*.3*l.a*env*vol*(.6+.4*Math.sin(u*5+t*2));X?x.lineTo(X,y):x.moveTo(X,y)}
   x.lineWidth=m>0?2.6:1.2;x.strokeStyle=l.c;x.shadowColor=l.c;x.shadowBlur=m>0?16:6;x.globalAlpha=m>0?.95:.5;x.stroke()}});
  x.globalAlpha=1;x.shadowBlur=0;const g=x.createRadialGradient(W/2,cy,0,W/2,cy,H*.45);g.addColorStop(0,`rgba(140,160,255,${.1+vol*.2})`);g.addColorStop(1,'rgba(140,160,255,0)');x.fillStyle=g;x.fillRect(0,0,W,H);x.globalCompositeOperation='source-over'})})();

// 160 area chart
(function(){const box=$('chart'),svg=$('csv'),tip=$('ctip'),W=520,H=240,P={l:38,r:14,t:14,b:26},N=30;let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const A=[],B=[];for(let i=0;i<N;i++){A.push(260+i*9+Math.sin(i/3.2)*60+rnd()*50);B.push(220+i*6+Math.sin(i/3.6+1)*45+rnd()*40)}
 const mx=Math.max(...A,...B)*1.12,X=i=>P.l+i/(N-1)*(W-P.l-P.r),Y=v=>P.t+(1-v/mx)*(H-P.t-P.b),pa=A.map((v,i)=>[X(i),Y(v)]),pb=B.map((v,i)=>[X(i),Y(v)]);
 const cv=p=>{let d=`M${p[0][0]},${p[0][1]}`;for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`}return d};
 const dA=cv(pa),dB=cv(pb),today=new Date(),lab=i=>{const d=new Date(today);d.setDate(d.getDate()-(N-1-i));return`${d.getMonth()+1}/${d.getDate()}`};
 let h=`<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6366f1" stop-opacity=".32"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></linearGradient><linearGradient id="ln" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#c026d3"/></linearGradient><filter id="gw" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
 for(let k=0;k<=4;k++){const v=mx*k/4,y=Y(v);h+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y}" y2="${y}" stroke="#15151a" stroke-opacity="${k?.07:.2}" ${k?'stroke-dasharray="3 5"':''}/><text x="${P.l-8}" y="${y+3.5}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="10" fill="#85817a">${(v/1000).toFixed(1)}k</text>`}
 [0,10,20,29].forEach(i=>h+=`<text x="${X(i)}" y="${H-6}" text-anchor="${i?i===29?'end':'middle':'start'}" font-family="JetBrains Mono,monospace" font-size="10" fill="#85817a">${lab(i)}</text>`);
 h+=`<path class="ap" d="${dA} L${X(N-1)},${Y(0)} L${X(0)},${Y(0)}Z" fill="url(#ar)"/><path d="${dB}" fill="none" stroke="#b8bcc8" stroke-width="1.6" stroke-dasharray="4 5"/><path class="lp" id="lg" d="${dA}" fill="none" stroke="url(#ln)" stroke-width="7" opacity=".35" filter="url(#gw)"/><path class="lp" id="lp" d="${dA}" fill="none" stroke="url(#ln)" stroke-width="3" stroke-linecap="round"/>
 <g id="chx" opacity="0"><line id="cxl" y1="${P.t}" y2="${H-P.b}" stroke="#15151a" stroke-opacity=".25"/><circle id="cxg" r="11" fill="#6366f1" opacity=".22"/><circle id="cxc" r="5" fill="#fff" stroke="#6366f1" stroke-width="3"/></g><rect id="hit" x="${P.l}" y="0" width="${W-P.l-P.r}" height="${H}" fill="transparent"/>`;
 svg.innerHTML=h;const lp=$('lp'),lg=$('lg'),ap=svg.querySelector('.ap'),L=lp.getTotalLength();[lp,lg].forEach(e=>e.style.setProperty('--L',L));
 function play(){[lp,lg].forEach(e=>{e.style.transition='none';e.style.strokeDashoffset=L});ap.style.transition='none';ap.style.opacity=0;void svg.getBoundingClientRect();[lp,lg].forEach(e=>{e.style.transition='';e.style.strokeDashoffset=0});ap.style.transition='';ap.style.opacity=1;
  const t0=performance.now(),target=A.reduce((a,b)=>a+b,0)|0;(function tw(n){const k=Math.min(1,(n-t0)/1600);$('cn').textContent=Math.round(target*(1-Math.pow(1-k,3))).toLocaleString();if(k<1)requestAnimationFrame(tw)})(t0)}
 play();setInterval(play,11000);
 $('hit').addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W,i=Math.max(0,Math.min(N-1,Math.round((px-P.l)/(W-P.l-P.r)*(N-1)))),x=X(i),y=Y(A[i]);
  $('chx').setAttribute('opacity',1);$('cxl').setAttribute('x1',x);$('cxl').setAttribute('x2',x);$('cxg').setAttribute('cx',x);$('cxg').setAttribute('cy',y);$('cxc').setAttribute('cx',x);$('cxc').setAttribute('cy',y);
  tip.innerHTML=`${lab(i)}<b>${Math.round(A[i]).toLocaleString()}</b><span style="opacity:.6">上期 ${Math.round(B[i]).toLocaleString()}</span>`;tip.style.left=x/W*100+'%';tip.style.top=y/H*100+'%';tip.style.opacity=1});
 $('hit').addEventListener('pointerleave',()=>{$('chx').setAttribute('opacity',0);tip.style.opacity=0})})();

// 161 dock
(function(){const d=$('dock'),I=[['音乐','#ff6a88,#ff9a6a','<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'],['影视','#7f5cff,#5b8cff','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="#fff"/>'],['订阅','#ff9a3c,#ffd23c','<path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8"/><circle cx="6" cy="18" r="1.4" fill="#fff"/>'],['博客','#34d399,#0ea5a4','<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'],['相册','#38bdf8,#6366f1','<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'],['设置','#a1a8b8,#6b7385','<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>']];
 I.forEach(([n,g,p])=>{const e=document.createElement('div');e.className='di';e.style.setProperty('--g',`linear-gradient(145deg,${g.split(',')[0]},${g.split(',')[1]})`);e.innerHTML=`<svg viewBox="0 0 24 24">${p}</svg><em>${n}</em>`;e.onclick=()=>{e.classList.remove('bn');void e.offsetWidth;e.classList.add('bn')};d.appendChild(e)});
 const els=[...d.children],B=54,MX=104,gap=10,pad=14,rw=els.length*B+(els.length-1)*gap+pad*2;
 function z(mx){const r=d.getBoundingClientRect(),cx=r.left+r.width/2,left=cx-rw/2+pad;els.forEach((e,i)=>{const c=left+i*(B+gap)+B/2,dist=mx==null?999:Math.abs(mx-c),s=B+(MX-B)*Math.exp(-(dist*dist)/(2*56*56));e.style.width=e.style.height=s+'px'})}
 d.addEventListener('pointermove',e=>z(e.clientX));d.addEventListener('pointerleave',()=>z(null))})();

// 162 particle text
(function(){const o=setup($('c162')),x=o.x,st=$('s162');let P=[],m=null,lw=0,ready=false,st2=3;
 const go=()=>ready=true;document.fonts&&document.fonts.load('900 80px "Noto Serif SC"','ARCHIVE').then(go,go);setTimeout(go,2500);
 function build(){const W=Math.round(o.W),H=Math.round(o.H),off=document.createElement('canvas');off.width=W;off.height=H;const g=off.getContext('2d'),fs=Math.min(W/3.9,H*.4);g.fillStyle='#000';g.font=`900 ${fs}px "Noto Serif SC",Georgia,serif`;g.textAlign='center';g.textBaseline='middle';g.fillText('ARCHIVE',W/2,H*.46);g.font=`400 ${Math.max(10,fs*.13)}px "JetBrains Mono",monospace`;g.fillText('SINCE 2024 · SELF-HOSTED',W/2,H*.46+fs*.66);
  const d=g.getImageData(0,0,W,H).data,pts=[];st2=Math.max(3,Math.round(W/170));for(let y=0;y<H;y+=st2)for(let xx=0;xx<W;xx+=st2)if(d[(y*W+xx)*4+3]>128)pts.push([xx,y]);
  P=pts.map(([tx,ty],i)=>P[i]?Object.assign(P[i],{tx,ty}):{x:Math.random()*W,y:Math.random()*H,vx:0,vy:0,tx,ty});lw=W}
 track(st,(a,b)=>m=[a,b],()=>m=null);st.addEventListener('pointerdown',()=>P.forEach(p=>{const a=Math.random()*6.28,s=6+Math.random()*14;p.vx+=Math.cos(a)*s;p.vy+=Math.sin(a)*s}));
 let nx=6;loop(o.c,t=>{if(!ready)return;if(Math.round(o.W)!==lw)build();if(t>nx){nx=t+7;P.forEach(p=>{const a=Math.random()*6.28,s=3+Math.random()*7;p.vx+=Math.cos(a)*s;p.vy+=Math.sin(a)*s})}
  x.clearRect(0,0,o.W,o.H);const sz=st2*.62;let ink=[],acc=[];
  for(const p of P){if(m){const dx=p.x-m[0],dy=p.y-m[1],dd=Math.hypot(dx,dy)+.1;if(dd<90){const f=(1-dd/90)*5;p.vx+=dx/dd*f;p.vy+=dy/dd*f}}
   p.vx+=(p.tx-p.x)*.045;p.vy+=(p.ty-p.y)*.045;p.vx*=.87;p.vy*=.87;p.x+=p.vx;p.y+=p.vy;(Math.abs(p.tx-p.x)+Math.abs(p.ty-p.y)>7?acc:ink).push(p)}
  x.fillStyle='#17171d';ink.forEach(p=>x.fillRect(p.x,p.y,sz,sz));x.fillStyle='#c8452c';acc.forEach(p=>x.fillRect(p.x,p.y,sz*1.15,sz*1.15))})})();

// 163 glass cards
(function(){const st=$('s163'),gp=$('gp'),cs=[...gp.querySelectorAll('.gc')];
 track(st,(x,y,r)=>{gp.style.setProperty('--ry',((x/r.width-.5)*14)+'deg');gp.style.setProperty('--rx',(-(y/r.height-.5)*10)+'deg');cs.forEach(c=>{const b=c.getBoundingClientRect();c.style.setProperty('--mx',(x+r.left-b.left)+'px');c.style.setProperty('--my',(y+r.top-b.top)+'px')})},()=>{gp.style.setProperty('--ry','0deg');gp.style.setProperty('--rx','0deg')})})();
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
