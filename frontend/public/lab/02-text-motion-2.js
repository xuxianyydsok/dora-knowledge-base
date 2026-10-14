
document.querySelectorAll('[data-split]').forEach(e=>{const t=e.textContent;e.textContent='';[...t].forEach((c,i)=>{const s=document.createElement('span');s.style.setProperty('--i',i);s.textContent=c;e.appendChild(s)})});
// 16 center-focus marquee
const ct=document.getElementById('ct'),cm=document.getElementById('cm');
['音乐','影视','订阅','收藏','历史','发现','音乐','影视','订阅','收藏','历史','发现'].forEach((w,i)=>{const s=document.createElement('span');s.textContent=w;if(i%2)s.style.color='var(--acc)';ct.appendChild(s)});
const items=[...ct.children];let cx=0;
(function f(){cx-=.7;const half=ct.scrollWidth/2;if(cx<=-half)cx+=half;ct.style.transform=`translateX(${cx}px)`;const b=cm.getBoundingClientRect(),c=b.left+b.width/2;
items.forEach(it=>{const r=it.getBoundingClientRect(),d=Math.min(Math.abs(r.left+r.width/2-c)/(b.width/2),1);it.style.transform=`scale(${1.2-.65*d})`;it.style.opacity=(1-d*.8).toFixed(2)});requestAnimationFrame(f)})();
// 20 slot
const slot=document.getElementById('slot'),target='影音万象',pool='音乐影视订阅库图书夜光海山风云雨雪';
function build(){slot.textContent='';[...target].forEach((ch,i)=>{const col=document.createElement('div');let h='';for(let k=0;k<10+i*3;k++)h+=`<span>${pool[Math.random()*pool.length|0]}</span>`;col.innerHTML=h+`<span>${ch}</span>`;col.dataset.n=10+i*3;slot.appendChild(col)})}
function spin(){build();const cols=[...slot.children];cols.forEach(c=>{c.style.transition='none';c.style.transform='translateY(0)'});void slot.offsetWidth;cols.forEach((c,i)=>{c.style.transition=`transform ${1.3+i*.35}s cubic-bezier(.22,1,.36,1)`;c.style.transform=`translateY(-${c.dataset.n}em)`})}
slot.onclick=spin;spin();setInterval(spin,6000);
// 21 per-letter roll
document.querySelectorAll('[data-roll]').forEach(e=>{const t=e.textContent;e.textContent='';[...t].forEach((c,i)=>{const b=document.createElement('b');b.innerHTML=`<i style="--i:${i}">${c}</i><i style="--i:${i}">${c}</i>`;e.appendChild(b)})});
// 24 3D layers
const txt='3D DEPTH',inn=document.getElementById('t3i');
for(let i=0;i<7;i++){const s=document.createElement('span');s.textContent=txt;s.style.transform=`translateZ(${i*-10}px)`;s.style.color=i===0?'var(--fg)':'var(--acc)';s.style.opacity=i===0?1:.55-.06*i;inn.appendChild(s)}inn.firstChild.style.transform='translateZ(20px)';
const st=inn.parentElement.parentElement;
st.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;inn.style.transform=`rotateY(${x*40}deg) rotateX(${-y*30}deg)`});
st.addEventListener('pointerleave',()=>inn.style.transform='');
// 27 velocity skew
const sk=document.getElementById('sk');let ly=scrollY,v=0;
addEventListener('scroll',()=>{v=Math.max(-30,Math.min(30,(scrollY-ly)*.8));ly=scrollY},{passive:true});
(function g(){v*=.9;document.querySelectorAll('.mqx>div>.big').forEach(e=>e.style.transform=`skewX(${-v}deg)`);requestAnimationFrame(g)})();
document.getElementById('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
