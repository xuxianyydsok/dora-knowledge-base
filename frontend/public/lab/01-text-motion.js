
document.querySelectorAll('[data-split]').forEach(e=>{const t=e.textContent;e.textContent='';[...t].forEach((c,i)=>{const s=document.createElement('span');s.style.setProperty('--i',i);s.textContent=c;e.appendChild(s)})});
// 04 scramble
const sc=document.getElementById('scr'),final=sc.textContent,pool='█▓▒░<>/\\#@&%01';
function scr(){let f=0;const n=final.length;const id=setInterval(()=>{f++;sc.textContent=[...final].map((c,i)=>i<f/2.2?c:pool[Math.random()*pool.length|0]).join('');if(f>n*2.2+2){sc.textContent=final;clearInterval(id)}},45)}
sc.onclick=scr;scr();setInterval(scr,6000);
// 05 typewriter
const words=['听你喜欢的音乐','看你收藏的电影','读你订阅的世界'],tw=document.getElementById('tw');let wi=0,ci=0,del=false;
(function tick(){const w=words[wi];tw.textContent=w.slice(0,ci);if(!del&&ci===w.length){del=true;return setTimeout(tick,1400)}if(del&&ci===0){del=false;wi=(wi+1)%words.length}ci+=del?-1:1;setTimeout(tick,del?50:110)})();
// 03 scroll-velocity marquee
const vi=document.getElementById('velin');let x=0,dir=-1,sp=1.2,lastY=scrollY,boost=0;
addEventListener('scroll',()=>{const d=scrollY-lastY;lastY=scrollY;if(d)dir=d>0?-1:1;boost=Math.min(Math.abs(d)*.6,14)},{passive:true});
(function loop(){boost*=.92;x+=dir*(sp+boost);const half=vi.scrollWidth/2;if(x<=-half)x+=half;if(x>0)x-=half;vi.style.transform=`translateX(${x}px)`;requestAnimationFrame(loop)})();
// theme
document.getElementById('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
