
const $=id=>document.getElementById(id);
$('b71').onclick=e=>{const b=e.currentTarget;if(b.classList.contains('ld')||b.classList.contains('ok'))return;b.classList.add('ld');setTimeout(()=>{b.classList.replace('ld','ok');setTimeout(()=>b.classList.remove('ok'),1400)},1400)};
$('b82').onclick=()=>{const i=$('i82');i.classList.remove('err');void i.offsetWidth;i.classList.add('err');setTimeout(()=>i.classList.remove('err'),900)};
document.querySelectorAll('[data-tilt]').forEach(c=>{c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform=`perspective(500px) rotateY(${x*28}deg) rotateX(${-y*28}deg) scale(1.05)`});c.addEventListener('pointerleave',()=>c.style.transform='')});
$('cf').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),cs=['#ff6a4a','#6fa0ff','#f0b429','#2fb45a','#9b6bff'];for(let i=0;i<28;i++){const p=document.createElement('i');p.style.cssText=`left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;background:${cs[i%5]};--x:${(Math.random()-.5)*260}px;--y:${-60-Math.random()*160}px;--r:${Math.random()*720}deg`;document.body.appendChild(p);setTimeout(()=>p.remove(),1250)}};
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
