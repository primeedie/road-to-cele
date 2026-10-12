import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachSkyMotion,pointerOffset} from '../src/sky-motion.mjs';

test('pointer decoration stays bounded and never changes the map camera or progression',()=>{
 assert.deepEqual(pointerOffset({clientX:999,clientY:-999},{left:0,top:0,width:200,height:100}),{x:12,y:-12});
 assert.deepEqual(pointerOffset({clientX:1,clientY:1},{left:0,top:0,width:0,height:0}),{x:0,y:0});
 const dom=new JSDOM('<section id="map-page"><div id="map"><div id="world" style="transform:translate(10px,20px)"></div></div></section>',{url:'https://road.test',pretendToBeVisual:true}),win=dom.window,viewport=win.document.querySelector('#map');
 viewport.getBoundingClientRect=()=>({left:0,top:0,width:200,height:100});let pending,frames=0;
 const motion=attachSkyMotion(viewport,{requestFrame:fn=>{frames++;pending=fn;return 1;},cancelFrame:()=>{pending=null;}});
 const move=(x,y,properties={})=>{const event=new win.MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:y,buttons:properties.buttons||0});Object.defineProperty(event,'pointerType',{value:properties.pointerType||'mouse'});viewport.dispatchEvent(event);};
 try{
  assert.equal(viewport.querySelectorAll('.motion-stars i').length,38);
  move(200,100);move(150,75);assert.equal(frames,1);pending();assert.equal(viewport.style.getPropertyValue('--look-x'),'6px');
  assert.equal(win.document.querySelector('#world').style.transform,'translate(10px,20px)');assert.equal(win.localStorage.length,0);
  move(0,0,{pointerType:'touch'});move(0,0,{buttons:1});assert.equal(frames,1);
  viewport.classList.add('dragging');move(0,0);assert.equal(frames,1);
  viewport.dispatchEvent(new win.Event('pointerleave'));assert.equal(viewport.style.getPropertyValue('--look-x'),'0px');
 }finally{motion.destroy();assert.equal(viewport.querySelector('.motion-stars'),null);win.close();}
});
test('reduced motion disables pointer effects and completion particles',()=>{
 const dom=new JSDOM('<div id="map"></div><div class="completion-reward"></div>',{pretendToBeVisual:true}),win=dom.window;
 win.matchMedia=query=>({matches:query.includes('reduced-motion'),addEventListener:()=>{},removeEventListener:()=>{}});
 const viewport=win.document.querySelector('#map');let requested=false;
 const motion=attachSkyMotion(viewport,{requestFrame:()=>{requested=true;},cancelFrame:()=>{}});
 try{
  viewport.dispatchEvent(new win.MouseEvent('pointermove',{bubbles:true,clientX:50}));motion.celebrate();
  assert.equal(requested,false);assert.equal(win.document.querySelector('.completion-sparks'),null);assert.ok(viewport.classList.contains('motion-reduced'));
 }finally{motion.destroy();win.close();}
});
