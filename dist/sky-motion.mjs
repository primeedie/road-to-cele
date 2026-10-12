// Decoration is independent of the camera and progression. Hit targets never move.
export function pointerOffset(event,rect,range=12){
 if(!rect.width||!rect.height)return {x:0,y:0};
 const clamp=value=>Math.max(-1,Math.min(1,value));
 return {x:clamp((event.clientX-rect.left)/rect.width*2-1)*range,y:clamp((event.clientY-rect.top)/rect.height*2-1)*range};
}
export function attachSkyMotion(viewport,{requestFrame,cancelFrame}={}){
 const doc=viewport.ownerDocument,win=doc.defaultView;
 requestFrame??=callback=>win.requestAnimationFrame(callback);
 cancelFrame??=id=>win.cancelAnimationFrame(id);
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)'),coarse=win.matchMedia?.('(hover: none)');
 const layer=doc.createElement('div');layer.className='motion-stars';layer.setAttribute('aria-hidden','true');
 // Fixed seed keeps the sky calm across re-renders; only the decoration drifts.
 for(let i=0;i<38;i++){
  const star=doc.createElement('i');star.style.cssText=`left:${(i*61.803)%100}%;top:${(i*37.719+13)%100}%;--star-delay:${-i*1.37}s;--star-period:${20+i%9*2}s;--star-size:${i%7===0?2:1}px;--star-drift:${i%2?-12:12}px;`;
  layer.append(star);
 }
 viewport.prepend(layer);
 let frame=null,next={x:0,y:0},portrait=null,portraitFrame=null;
 const reset=()=>{next={x:0,y:0};viewport.style.setProperty('--look-x','0px');viewport.style.setProperty('--look-y','0px');};
 function paint(){frame=null;viewport.style.setProperty('--look-x',next.x+'px');viewport.style.setProperty('--look-y',next.y+'px');}
 function look(event){
  if(reduced?.matches||coarse?.matches||event.pointerType==='touch'||event.buttons||viewport.classList.contains('dragging'))return;
  next=pointerOffset(event,viewport.getBoundingClientRect());if(frame===null)frame=requestFrame(paint);
 }
 function cancelLook(){if(frame!==null)cancelFrame(frame);frame=null;reset();}
 function resetPortrait(){if(portraitFrame!==null)cancelFrame(portraitFrame);portraitFrame=null;if(portrait){portrait.style.removeProperty('--portrait-x');portrait.style.removeProperty('--portrait-y');portrait=null;}}
 function tilt(event){
  if(reduced?.matches||coarse?.matches||event.pointerType==='touch'||event.buttons)return;
  const target=event.target.closest?.('.dossier-sky');
  if(target!==portrait)resetPortrait();
  if(!target)return;portrait=target;
  const point=pointerOffset(event,target.getBoundingClientRect(),3);
  if(portraitFrame!==null)cancelFrame(portraitFrame);
  portraitFrame=requestFrame(()=>{portraitFrame=null;if(portrait===target){target.style.setProperty('--portrait-x',-point.y+'deg');target.style.setProperty('--portrait-y',point.x+'deg');}});
 }
 function state(){
  const paused=doc.hidden||!!doc.querySelector('dialog[open]')||!!doc.querySelector('#map-page.hidden');
  viewport.classList.toggle('motion-paused',paused);
  viewport.classList.toggle('motion-reduced',!!reduced?.matches);
  if(paused||reduced?.matches){cancelLook();resetPortrait();}
 }
 const observer=win.MutationObserver?new win.MutationObserver(state):null;
 for(const dialog of doc.querySelectorAll('dialog'))observer?.observe(dialog,{attributes:true,attributeFilter:['open']});
 const page=doc.querySelector('#map-page');if(page)observer?.observe(page,{attributes:true,attributeFilter:['class']});
 viewport.addEventListener('pointermove',look,{passive:true});viewport.addEventListener('pointerleave',cancelLook);viewport.addEventListener('pointerdown',cancelLook);
 doc.addEventListener('pointermove',tilt,{passive:true});doc.addEventListener('visibilitychange',state);win.addEventListener('blur',cancelLook);reduced?.addEventListener('change',state);
 state();
 function celebrate(){
  if(reduced?.matches)return;
  const reward=doc.querySelector('.completion-reward');if(!reward||reward.querySelector('.completion-sparks'))return;
  const sparks=doc.createElement('span');sparks.className='completion-sparks';sparks.setAttribute('aria-hidden','true');
  for(let i=0;i<16;i++){
   const angle=i/16*Math.PI*2,spark=doc.createElement('i');
   spark.style.cssText=`--spark-x:${Math.cos(angle)*(28+i%3*10)}px;--spark-y:${Math.sin(angle)*(28+i%3*10)}px;--spark-delay:${i%4*25}ms;`;sparks.append(spark);
  }
  reward.append(sparks);win.setTimeout(()=>sparks.remove(),1100);
 }
 return {celebrate,destroy(){observer?.disconnect();cancelLook();resetPortrait();layer.remove();viewport.classList.remove('motion-paused','motion-reduced');viewport.removeEventListener('pointermove',look);viewport.removeEventListener('pointerleave',cancelLook);viewport.removeEventListener('pointerdown',cancelLook);doc.removeEventListener('pointermove',tilt);doc.removeEventListener('visibilitychange',state);win.removeEventListener('blur',cancelLook);reduced?.removeEventListener('change',state);}};
}
