(function(){var g=["dots","grid","lines","hatch","scallops","shapes","stars","crosses","chevron","graph","lattice","brick","weave","rings","marks"],t=["clay","amber","moss","fern","teal","sky","plum","rose"],K='ktDesk';
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function paint(p,c){var d=document.querySelector('.desk');if(!d)return;
d.className='desk g-'+p;document.body.className='t-'+c;}
window.ktDesk=function(){var p=pick(g),c=pick(t);paint(p,c);
try{sessionStorage.setItem(K,p+'|'+c);}catch(e){}};
document.documentElement.className+=' js';
var s=null;try{s=sessionStorage.getItem(K);}catch(e){}
var v=s?s.split('|'):[];
if(v.length===2&&g.indexOf(v[0])>=0&&t.indexOf(v[1])>=0)paint(v[0],v[1]);else window.ktDesk();})();(function(){var a=document.querySelectorAll('.anim');if(!a.length)return;
if(!('IntersectionObserver' in window)){return;}
var o=new IntersectionObserver(function(es){es.forEach(function(e){
if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target);}});},{threshold:.35});
a.forEach(function(el){el.classList.remove('in');o.observe(el);});})();window.ktPrint=function(id){var f=document.getElementById('f-'+id);
if(!f||!f.contentWindow)return true;try{f.contentWindow.focus();f.contentWindow.print();
return false;}catch(e){return true;}};
/*
 * The homepage picker. Holds the current ring so "another" can walk it, and
 * keeps the Print and Open links pointing at whatever is on screen — a print
 * button aimed at the previous selection is worse than no button.
 */
window.ktPick=function(kind,age){var b=window.KT_BUNDLES;if(!b||!b[kind]||!b[kind][age])return true;
window.__ring=b[kind][age];window.__at=0;window.__kind=kind;window.__age=age;ktShow();return false;};
window.ktAnother=function(){if(!window.__ring||window.__ring.length<2)return false;
window.__at=(window.__at+1)%window.__ring.length;ktShow();return false;};
window.ktShow=function(){var f=document.getElementById('f-today');if(!f)return;
var box=document.getElementById('picked');
if(box&&box.hasAttribute('hidden')){box.removeAttribute('hidden');
/* next frame, or the display change swallows the animation */
requestAnimationFrame(function(){box.classList.add('coming');});}
var u=window.__ring[window.__at];f.setAttribute('src',u);
var p=document.getElementById('pickprint');if(p)p.setAttribute('href',u);
var o=document.getElementById('pickopen');if(o)o.setAttribute('href','/free/bundle/'+window.__kind+'-'+window.__age+'.html');
/* Age 3's day has one possible selection, so there is no other to give. A
   button that silently does nothing is worse than one that is not there. */
var m=document.getElementById('pickmore');if(m)m.hidden=window.__ring.length<2;
var n=document.getElementById('pickname');
if(n)n.textContent=(window.__kind==='day'?'A day':'A week')+' for a '+window.__age+'-year-old'
  +(window.__ring.length>1?' · '+(window.__at+1)+' of '+window.__ring.length:'');};
window.ktFit=function(){var b=document.querySelectorAll('.paper');
for(var i=0;i<b.length;i++){b[i].style.setProperty('--k',(b[i].clientWidth/892.8).toFixed(5));}};
window.ktRoll=function(id){var f=document.getElementById('f-'+id);if(!f)return false;
var r=(f.getAttribute('data-ring')||'').split('|').filter(Boolean);if(r.length<2)return false;
var i=(r.indexOf(f.getAttribute('src'))+1)%r.length;f.setAttribute('src',r[i]);
var p=document.querySelector('a.btn.primary');if(p)p.setAttribute('href',r[i]);return false;};
ktFit();if(window.ResizeObserver){var ro=new ResizeObserver(ktFit);
var ps=document.querySelectorAll('.paper');for(var i=0;i<ps.length;i++)ro.observe(ps[i]);}
else{window.addEventListener('resize',ktFit);}
(function(){var w=document.querySelector('.ad'),v=w&&w.querySelector('video'),b=w&&w.querySelector('.adplay');if(!v||!b)return;
b.addEventListener('click',function(){w.classList.add('playing');v.controls=true;v.muted=false;var p=v.play();if(p&&p.catch)p.catch(function(){});});
v.addEventListener('ended',function(){w.classList.remove('playing');v.controls=false;v.load();});})();
