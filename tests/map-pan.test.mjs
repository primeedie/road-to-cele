import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachMapPan } from '../src/map-pan.mjs';
function setup(){
 const dom=new JSDOM('<div id="viewport"><button class="course-node"><span class="node-copy">Foundation Statistics</span></button><button id="zoom">+</button><img id="image"><svg><path data-connection="A:B:H"></path></svg></div>');
 const w=dom.window,doc=w.document,viewport=doc.querySelector('#viewport'),node=doc.querySelector('.course-node'),label=doc.querySelector('.node-copy'),zoom=doc.querySelector('#zoom');
 const captures=new Map();
 w.Element.prototype.setPointerCapture=function(id){captures.set(id,this);};
 w.Element.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};
 w.Element.prototype.releasePointerCapture=function(id){captures.delete(id);};
 let position={x:20,y:-40},pans=0,inspections=0,zooms=0;
 const detach=attachMapPan(viewport,{getPosition:()=>position,onPan:p=>{position=p;pans++;}});
 doc.addEventListener('click',e=>{if(e.target.closest('.course-node'))inspections++;if(e.target.closest('#zoom'))zooms++;});
 const pointer=(target,type,x,y,{id=1,button=0,primary=true}={})=>{const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:primary}});target.dispatchEvent(event);return event;};
 const click=(target,detail=1)=>{const event=new w.MouseEvent('click',{bubbles:true,cancelable:true,detail});target.dispatchEvent(event);return event;};
 return {w,doc,viewport,node,label,zoom,captures,pointer,click,detach,get position(){return position;},get pans(){return pans;},get inspections(){return inspections;},get zooms(){return zooms;},close:()=>dom.window.close()};
}
test('dragging a course label pans the whole tree, clears selection and never opens the course',()=>{
 const f=setup();try{
  const range=f.doc.createRange();range.selectNodeContents(f.label);f.w.getSelection().addRange(range);
  const down=f.pointer(f.label,'pointerdown',100,100);assert.equal(down.defaultPrevented,true);assert.equal(f.w.getSelection().rangeCount,0);assert.equal(f.captures.get(1),f.node);
  f.pointer(f.viewport,'pointermove',180,142);assert.deepEqual(f.position,{x:100,y:2});assert.equal(f.viewport.classList.contains('dragging'),true);
  f.pointer(f.viewport,'pointerup',180,142);assert.equal(f.viewport.classList.contains('dragging'),false);assert.equal(f.captures.size,0);
  const click=f.click(f.label);assert.equal(click.defaultPrevented,true);assert.equal(f.inspections,0);
 }finally{f.close();}
});
test('clicking a course with minor pointer jitter opens details and does not move the map',()=>{
 const f=setup();try{
  f.pointer(f.label,'pointerdown',100,100);f.pointer(f.viewport,'pointermove',102,102);f.pointer(f.node,'pointerup',102,102);
  assert.deepEqual(f.position,{x:20,y:-40});assert.equal(f.pans,0);assert.equal(f.click(f.node).defaultPrevented,false);assert.equal(f.inspections,1);
  // A second real press is allowed immediately after a drag, without a timing delay.
  f.pointer(f.label,'pointerdown',100,100);f.pointer(f.viewport,'pointermove',130,130);f.pointer(f.viewport,'pointerup',130,130);
  f.pointer(f.label,'pointerdown',110,110);f.pointer(f.node,'pointerup',110,110);f.click(f.label);assert.equal(f.inspections,2);
 }finally{f.close();}
});
test('background drag, cancellation and foreign pointers leave gestures in a usable state',()=>{
 const f=setup();try{
  f.pointer(f.viewport,'pointerdown',10,20);
  f.pointer(f.viewport,'pointermove',80,90,{id:2});assert.equal(f.pans,0);
  f.pointer(f.viewport,'pointerup',80,90,{id:2});
  f.pointer(f.viewport,'pointermove',40,70);assert.deepEqual(f.position,{x:50,y:10});
  f.pointer(f.viewport,'pointercancel',40,70);assert.equal(f.viewport.classList.contains('dragging'),false);assert.equal(f.captures.size,0);
  f.pointer(f.label,'pointerdown',10,20,{id:3});f.pointer(f.label,'pointerup',10,20,{id:3});f.click(f.label);assert.equal(f.inspections,1);
 }finally{f.close();}
});
test('zoom controls, right clicks and secondary contacts do not initiate map panning',()=>{
 const f=setup();try{
  assert.equal(f.pointer(f.zoom,'pointerdown',10,20).defaultPrevented,false);f.click(f.zoom);assert.equal(f.zooms,1);
  f.pointer(f.label,'pointerdown',10,20,{button:2});f.pointer(f.viewport,'pointermove',100,200);assert.equal(f.pans,0);
  f.pointer(f.label,'pointerdown',10,20,{primary:false});assert.equal(f.captures.size,0);
 }finally{f.close();}
});
test('native drag previews are blocked, while keyboard course activation remains available after panning',()=>{
 const f=setup();try{
  const drag=new f.w.Event('dragstart',{bubbles:true,cancelable:true});f.doc.querySelector('#image').dispatchEvent(drag);assert.equal(drag.defaultPrevented,true);
  f.pointer(f.label,'pointerdown',0,0);f.pointer(f.viewport,'pointermove',20,20);f.pointer(f.viewport,'pointerup',20,20);
  assert.equal(f.click(f.node,0).defaultPrevented,false);assert.equal(f.inspections,1);
 }finally{f.close();}
});

test('a prerequisite line retains click targeting but dragging it only pans',()=>{
 const f=setup();try{
  const line=f.doc.querySelector('[data-connection]');let traces=0;
  line.addEventListener('click',()=>traces++);
  f.pointer(line,'pointerdown',100,100);assert.equal(f.captures.get(1),line);
  f.pointer(line,'pointerup',100,100);f.click(line);assert.equal(traces,1);
  f.pointer(line,'pointerdown',100,100);f.pointer(line,'pointermove',170,120);f.pointer(line,'pointerup',170,120);
  assert.equal(f.click(line).defaultPrevented,true);assert.equal(traces,1);assert.equal(f.pans,1);
 }finally{f.close();}
});
