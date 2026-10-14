
const $=id=>document.getElementById(id);
document.querySelector('.rp').addEventListener('click',e=>{const b=e.currentTarget,r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,i=document.createElement('i');i.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;b.appendChild(i);setTimeout(()=>i.remove(),700)});
$('hb').onclick=e=>{const b=e.currentTarget;if(b.classList.contains('on')){b.classList.remove('on')}else{b.classList.remove('on');void b.offsetWidth;b.classList.add('on')}};
$('eq').onclick=e=>e.currentTarget.classList.toggle('p');
$('vn').onclick=e=>e.currentTarget.classList.toggle('on');
$('pp').onclick=e=>e.currentTarget.classList.toggle('play');
// progress
let p=0;setInterval(()=>{p=p>=100?0:Math.min(100,p+Math.random()*14);$('pb').style.width=p+'%';$('pn').textContent=Math.round(p)+'%'},700);
// tabs
const tabs=$('tabs'),ind=tabs.querySelector('.ind'),bs=[...tabs.querySelectorAll('button')];
function mv(b){ind.style.left=b.offsetLeft+'px';ind.style.width=b.offsetWidth+'px'}
bs.forEach(b=>b.onclick=()=>{bs.forEach(x=>x.classList.toggle('on',x===b));mv(b)});
document.fonts.ready.then(()=>mv(bs[0]));mv(bs[0]);
// toast
let tt;$('tb').onclick=()=>{const t=$('ts');clearTimeout(tt);t.classList.remove('show');void t.offsetWidth;t.classList.add('show');tt=setTimeout(()=>t.classList.remove('show'),2500)};
// back-to-top
addEventListener('scroll',()=>{const h=document.documentElement,pr=h.scrollTop/(h.scrollHeight-h.clientHeight||1);$('upp').style.strokeDashoffset=151*(1-pr);$('up').classList.toggle('show',h.scrollTop>200)},{passive:true});
$('up').onclick=()=>scrollTo({top:0,behavior:'smooth'});
$('th').onclick=()=>{const r=document.documentElement;const d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark'};
