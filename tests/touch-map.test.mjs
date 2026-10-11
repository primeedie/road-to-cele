import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachMapPan } from '../src/map-pan.mjs';
test('pinch keeps the midpoint anchored, pans with two fingers, and resumes one-finger pan without clicks',()=>{
 const dom=new JSDOM('<div id="map"><button class="course-node">FNDMATH</button></div>'),w=dom.window,viewport=w.document.querySelector('#map'),node=viewport.firstChild,captures=new Map();
 w.Element.prototype.setPointerCapture=function(id){captures.set(id,this);};w.Element.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};w.Element.prototype.releasePointerCapture=function(id){captures.delete(id);};
 viewport.getBoundingClientRect=()=>({left:10,top:20});let position={x:0,y:0},scale=1,opened=0,zooms=0;
 const detach=attachMapPan(viewport,{getPosition:()=>position,onPan:p=>(position=p),onZoom:(factor,cx,cy)=>{zooms++;position={x:cx-(cx-position.x)*factor,y:cy-(cy-position.y)*factor};scale*=factor;}});
 node.addEventListener('click',()=>opened++);
 const pointer=(type,id,x,y)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:id},isPrimary:{value:id===1}});node.dispatchEvent(e);};
 try {
  pointer('pointerdown',1,60,70);pointer('pointerdown',2,160,70);pointer('pointermove',2,260,70);
  assert.equal(scale,2);assert.equal(zooms,1);assert.deepEqual(position,{x:-50,y:-50});
  pointer('pointerup',2,260,70);pointer('pointermove',1,70,80);assert.deepEqual(position,{x:-40,y:-40});pointer('pointerup',1,70,80);
  node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));assert.equal(opened,0);assert.equal(captures.size,0);assert.equal(viewport.classList.contains('dragging'),false);
  pointer('pointerdown',1,70,80);pointer('pointerup',1,70,80);node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(opened,1);
  pointer('pointerdown',1,0,0);pointer('pointerdown',2,20,0);detach();assert.equal(captures.size,0);
 }finally{dom.window.close();}
});
