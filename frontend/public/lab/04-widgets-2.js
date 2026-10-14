
const $=id=>document.getElementById(id);
// 47 magnetic
const ms=$('mgs'),mb=$('mgb'),mi=mb.firstElementChild;
ms.addEventListener('pointermove',e=>{const r=mb.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);mb.style.transform=`translate(${dx*.35}px,${dy*.35}px)`;mi.style.transform=`translate(${dx*.15}px,${dy*.15}px)`});
ms.addEventListener('pointerleave',()=>{mb.style.transform='';mi.style.transform=''});
// 50 accordion
document.querySelectorAll('#ac button').forEach(b=>b.onclick=()=>b.parentElement.classList.toggle('o'));
// 51 glow border
const gc=$('gc');gc.addEventListener('pointermove',e=>{const r=gc.getBoundingClientRect();gc.style.setProperty('--mx',e.clientX-r.left+'px');gc.style.setProperty('--my',e.clientY-r.top+'px')});
// 52 ring
(function(){const v=$('rv'),n=$('rn');function s(){const p=Math.round(20+Math.random()*80);v.style.strokeDashoffset=283*(1-p/100);let c=0;const t=setInterval(()=>{c+=Math.ceil((p-c)/6)||1;if(c>=p){c=p;clearInterval(t)}n.textContent=c+'%'},60)}s();setInterval(s,2800)})();
// 55 hamburger
$('hm').onclick=e=>e.currentTarget.classList.toggle('x');
// 56 volume
const vr=$('vr');function uv(){vr.style.setProperty('--v',vr.value+'%');$('vv').textContent=vr.value}vr.oninput=uv;uv();
// 59 bubbles
(function(){const b=$('bb');for(let i=0;i<16;i++){const e=document.createElement('i'),s=8+Math.random()*26;e.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;--dx:${(Math.random()-.5)*60}px;animation-duration:${4+Math.random()*5}s;animation-delay:${-Math.random()*8}s`;b.prepend(e)}})();
// 60 stars
(function(){const b=$('sf');for(let i=0;i<46;i++){const e=document.createElement('i'),s=1+Math.random()*2.5;e.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;--s:${s}px;--d:${1.5+Math.random()*3}s;animation-delay:${-Math.random()*4}s`;b.prepend(e)}})();
// 62 dots
(function(){const d=[...$('cd').children];let i=0;setInterval(()=>{d[i].classList.remove('on');i=(i+1)%d.length;d[i].classList.add('on')},3000)})();
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
