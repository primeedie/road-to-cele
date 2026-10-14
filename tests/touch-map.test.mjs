import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachMapPan } from '../src/map-pan.mjs';
import {pinchCamera,constrainCamera} from '../src/map-camera.mjs';

function framedGesture(){
 const dom=new JSDOM('<div id="map"><button class="course-node">FNDMATH</button></div>'),w=dom.window,viewport=w.document.querySelector('#map'),node=viewport.firstChild;
 let rectReads=0,camera={x:0,y:0,scale:1},pinches=0,pans=0,paints=0,next=0;const frames=new Map();
 viewport.getBoundingClientRect=()=>{rectReads++;return {left:10,top:20,width:400,height:700};};
 const bounds={minX:-10000,minY:-10000,maxX:10000,maxY:10000,targets:[{minX:-10000,minY:-10000,maxX:10000,maxY:10000}]};
 const detach=attachMapPan(viewport,{
  getPosition:()=>camera,
  onPinch:gesture=>{pinches++;camera=constrainCamera(pinchCamera(camera,gesture,{min:.1,max:1.8}),{width:400,height:700},bounds);},
  onPan:p=>{pans++;camera={...camera,...p};return camera;},onFrame:()=>paints++,
  requestFrame:fn=>{frames.set(++next,fn);return next;},cancelFrame:id=>frames.delete(id)
 });
 const pointer=(type,id,x,y)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:id},isPrimary:{value:id===1}});node.dispatchEvent(e);};
 return {w,node,viewport,pointer,frames,step(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();},get camera(){return camera;},get counts(){return {rectReads,pinches,pans,paints};},close(){detach();w.close();}};
}

test('hundreds of two-finger events use one frame, one cached layout read, and the latest midpoint',()=>{
 const h=framedGesture();try{
  h.pointer('pointerdown',1,60,70);h.pointer('pointerdown',2,160,70);
  for(let i=1;i<=200;i++){h.pointer('pointermove',1,60+i/4,70+i/10);h.pointer('pointermove',2,160+i*3/4,70+i/10);}
  assert.equal(h.frames.size,1);assert.deepEqual(h.counts,{rectReads:1,pinches:0,pans:0,paints:0});
  h.step();assert.deepEqual(h.counts,{rectReads:1,pinches:1,pans:0,paints:1});
  assert.equal(h.camera.scale,1.8);assert.deepEqual(h.camera,{scale:1.8,x:20,y:-20});
  // The world point originally under the midpoint follows both fingers even at the zoom limit.
  assert.equal(h.camera.x+100*h.camera.scale,200);assert.equal(h.camera.y+50*h.camera.scale,70);
  h.pointer('pointermove',1,120,100);h.pointer('pointermove',2,320,100);
  h.step();assert.equal(h.counts.rectReads,1);assert.equal(h.camera.x,30);assert.equal(h.camera.y,-10);
 }finally{h.close();}
});

test('lifting a finger flushes its pending pinch and continues panning without a jump or course click',()=>{
 const h=framedGesture();try{
  let opened=0;h.node.addEventListener('click',()=>opened++);
  h.pointer('pointerdown',1,60,70);h.pointer('pointerdown',2,160,70);h.pointer('pointermove',2,210,70);
  h.pointer('pointerup',2,210,70);assert.equal(h.frames.size,0);assert.equal(h.camera.scale,1.5);
  const before={...h.camera};h.pointer('pointermove',1,80,100);assert.deepEqual(h.camera,before);
  h.pointer('pointerup',1,80,100);assert.equal(h.frames.size,0);assert.equal(h.camera.x,before.x+20);assert.equal(h.camera.y,before.y+30);
  h.node.dispatchEvent(new h.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));assert.equal(opened,0);assert.equal(h.viewport.classList.contains('dragging'),false);
  h.step();assert.equal(h.camera.x,before.x+20);
 }finally{h.close();}
});

test('one-finger bursts apply only the latest position and interruptions leave no stale gesture frames',()=>{
 const h=framedGesture();try{
  h.pointer('pointerdown',1,60,70);
  for(let i=1;i<=200;i++)h.pointer('pointermove',1,60+i,70+i/2);
  assert.equal(h.counts.pans,0);assert.equal(h.frames.size,1);h.step();
  assert.equal(h.counts.pans,1);assert.deepEqual(h.camera,{x:200,y:100,scale:1});
  h.pointer('pointermove',1,280,180);h.w.dispatchEvent(new h.w.Event('blur'));
  assert.equal(h.frames.size,0);assert.equal(h.viewport.classList.contains('dragging'),false);
  const before={...h.camera};h.step();assert.deepEqual(h.camera,before);
  h.pointer('pointerdown',1,10,20);h.pointer('pointermove',1,30,40);h.step();assert.equal(h.camera.x,before.x+20);
 }finally{h.close();}
});
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
test('a canceled touch or window interruption releases gestures without opening a course',()=>{
 const dom=new JSDOM('<div id="map"><button class="course-node">FNDMATH</button></div>'),w=dom.window,viewport=w.document.querySelector('#map'),node=viewport.firstChild,captures=new Set();
 w.Element.prototype.setPointerCapture=id=>captures.add(id);w.Element.prototype.hasPointerCapture=id=>captures.has(id);w.Element.prototype.releasePointerCapture=id=>captures.delete(id);
 let opened=0;node.addEventListener('click',()=>opened++);
 const detach=attachMapPan(viewport,{getPosition:()=>({x:0,y:0}),onPan:p=>p});
 const pointer=type=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:1}});node.dispatchEvent(e);};
 try{
  pointer('pointerdown');pointer('pointercancel');node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(opened,0);assert.equal(captures.size,0);
  pointer('pointerdown');w.dispatchEvent(new w.Event('blur'));assert.equal(captures.size,0);assert.equal(viewport.classList.contains('dragging'),false);
  node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(opened,0);
  node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));assert.equal(opened,1);
 }finally{detach();dom.window.close();}
});
