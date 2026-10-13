// Rare decoration: one small comet, then a long quiet interval. No progression writes.
export function attachComets(viewport,{random=Math.random,setTimer,clearTimer}={}){
 const doc=viewport.ownerDocument,win=doc.defaultView,preference=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 setTimer??=(fn,ms)=>win.setTimeout(fn,ms);clearTimer??=id=>win.clearTimeout(id);
 let timer=null,cleanup=null,comet=null,closed=false,blurred=false;
 const paused=()=>closed||blurred||doc.hidden||preference?.matches||viewport.matches('.dragging,.zooming')||!!doc.querySelector('dialog[open],#map-page.hidden');
 function remove(){if(cleanup!==null)clearTimer(cleanup);cleanup=null;comet?.remove();comet=null;}
 function schedule(){if(timer!==null||paused())return;timer=setTimer(fire,35000+random()*45000);}
 function fire(){
  timer=null;if(paused()){schedule();return;}
  comet=doc.createElement('span');comet.className='sky-comet';comet.setAttribute('aria-hidden','true');
  comet.style.cssText=`left:${18+random()*57}%;top:${5+random()*22}%;--comet-distance:${160+random()*140}px;--comet-duration:${2.8+random()*1.2}s`;
  viewport.append(comet);cleanup=setTimer(()=>{remove();schedule();},4200);
 }
 function state(){if(paused()){if(timer!==null)clearTimer(timer);timer=null;remove();}else schedule();}
 const blur=()=>{blurred=true;state();},focus=()=>{blurred=false;state();};
 const observer=new win.MutationObserver(state);observer.observe(viewport,{attributes:true,attributeFilter:['class']});
 for(const element of doc.querySelectorAll('dialog,#map-page'))observer.observe(element,{attributes:true,attributeFilter:['open','class']});
 doc.addEventListener('visibilitychange',state);win.addEventListener('blur',blur);win.addEventListener('focus',focus);preference?.addEventListener('change',state);schedule();
 return {destroy(){closed=true;state();observer.disconnect();doc.removeEventListener('visibilitychange',state);win.removeEventListener('blur',blur);win.removeEventListener('focus',focus);preference?.removeEventListener('change',state);}};
}
