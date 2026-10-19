import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCanvas,Path2D,GlobalFonts} from '@napi-rs/canvas';
import {JSDOM} from 'jsdom';
import {createMobileScene,visibleMobileItems,pickMobileItem,createMobilePainter,attachMobileSky} from '../src/mobile-sky.mjs';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {createOrbitLayout,orbitSceneBounds} from '../src/orbit-layout.mjs';
import {overviewCamera,constrainCamera} from '../src/map-camera.mjs';
import {STORAGE_KEY} from '../src/storage.mjs';

GlobalFonts.registerFromPath(fileURLToPath(new URL('../src/assets/fonts/HYWenHei-85W.ttf',import.meta.url)),'CELE WenHei');
const makeCanvas=(w,h)=>createCanvas(w,h),map=createOrbitLayout(createSkyMap());
const cameraFor=(node,viewport,scale=.7)=>constrainCamera({scale,x:viewport.width/2-(node.p.x+125)*scale,y:viewport.height/2-(node.p.y+120)*scale},viewport,orbitSceneBounds(map));
function canvasAdapter(win){
 const native=new WeakMap(),counts=new WeakMap();win.Path2D=Path2D;
 win.HTMLCanvasElement.prototype.getContext=function(){
  if(!native.has(this)){native.set(this,createCanvas(this.width,this.height));counts.set(this,{clears:0,images:0});}
  const html=this,canvas=native.get(this),ctx=canvas.getContext('2d');
  return new Proxy(ctx,{get(target,key){
   if(key==='canvas')return html;
   const value=target[key];if(typeof value!=='function')return value;
   return (...args)=>{if(canvas.width!==html.width)canvas.width=html.width;if(canvas.height!==html.height)canvas.height=html.height;if(key==='clearRect')counts.get(html).clears++;if(key==='drawImage'){counts.get(html).images++;args[0]=native.get(args[0])||args[0];}return value.apply(target,args);};
  },set(target,key,value){target[key]=value;return true;}});
 };
 return {native,counts};
}

test('mobile scene culls offscreen years but retains cross-viewport prerequisite curves and accurate taps',()=>{
 const scene=createMobileScene(map),viewport={width:428,height:700},node=scene.nodes.find(n=>n.course.id==='FNDMATH'),camera=cameraFor(node,viewport);
 const visible=visibleMobileItems(scene,camera,viewport);
 assert.ok(visible.nodes.length>0&&visible.nodes.length<scene.nodes.length/3);assert.ok(visible.charts.length<scene.charts.length);
 const center={x:node.p.x+125,y:node.p.y+176+(70*4/3-176)*node.p.perspective},point={x:camera.x+center.x*camera.scale,y:camera.y+center.y*camera.scale};
 assert.deepEqual(pickMobileItem(scene,camera,point),{kind:'course',id:'FNDMATH'});
 const far={x:-100000,y:-100000,scale:1};assert.equal(visibleMobileItems(scene,far,viewport).nodes.length,0);assert.equal(pickMobileItem(scene,far,{x:0,y:0}),null);
 const edge=scene.edges.find(e=>e.points.some(p=>pickMobileItem(scene,{scale:1,x:0,y:0},p)?.id===e.key));
 const p=edge.points.find(p=>pickMobileItem(scene,{scale:1,x:0,y:0},p)?.id===edge.key);
 assert.deepEqual(pickMobileItem(scene,{scale:1,x:0,y:0},p),{kind:'connection',id:edge.key});
 const focusedCurve={scale:1,x:viewport.width/2-p.x,y:viewport.height/2-p.y};assert.ok(visibleMobileItems(scene,focusedCurve,viewport).edges.some(e=>e.key===edge.key));
 const portal=scene.portal.bounds;assert.equal(pickMobileItem(scene,{scale:1,x:0,y:0},{x:(portal.minX+portal.maxX)/2,y:(portal.minY+portal.maxY)/2}).kind,'gate');
});

test('cached canvas artwork preserves three brightness levels and draws only visible stars without blur',()=>{
 const viewport={width:428,height:700},scene=createMobileScene(map),node=scene.nodes.find(n=>n.course.id==='FNDMATH'),camera=cameraFor(node,viewport,1);
 let created=0;const painter=createMobilePainter({makeCanvas:(w,h)=>{created++;return createCanvas(w,h);},Path:Path2D}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');
 const levels=[];
 for(const state of ['locked','active-course','completed']){
  const next={...scene,nodes:scene.nodes.map(n=>({...n,state:n.course.id===node.course.id?state:n.state}))};
  const stats=painter.paint(ctx,next,camera,viewport);assert.ok(stats.nodes<scene.nodes.length/3);assert.ok(stats.cacheBytes<=24*1024*1024);assert.equal(ctx.shadowBlur,0);
  const center={x:Math.round(camera.x+(node.p.x+125)*camera.scale),y:Math.round(camera.y+(node.p.y+176+(70*4/3-176)*node.p.perspective)*camera.scale)};
  const pixel=ctx.getImageData(center.x,center.y,1,1).data;levels.push(pixel[3]*(pixel[0]+pixel[1]+pixel[2])/255);
  const before=created;painter.paint(ctx,next,{...camera,x:camera.x+1},viewport);assert.equal(created,before,'panning reuses cached star images');
 }
 assert.ok(levels[0]<levels[1]&&levels[1]<=levels[2]);
 const allCamera=overviewCamera(viewport,orbitSceneBounds(map));painter.paint(ctx,scene,allCamera,viewport);const before=created;painter.paint(ctx,scene,{...allCamera,x:allCamera.x+1},viewport);assert.equal(created,before,'overview sprites also fit in the bounded cache');
 painter.clear();
});

test('canvas surface is screen-sized, capped at 2x density, and falls back to SVG if canvas is unavailable',()=>{
 const dom=new JSDOM('<div id="map"></div>',{pretendToBeVisual:true}),win=dom.window,viewport=win.document.querySelector('#map');canvasAdapter(win);
 let mobile=true,changed,rebuilds=0;win.matchMedia=()=>({get matches(){return mobile;},addEventListener:(_,fn)=>changed=fn,removeEventListener(){}});Object.defineProperty(win,'devicePixelRatio',{value:3});
 const r={width:428,height:700},scene=createMobileScene(map),camera=cameraFor(scene.nodes[0],r);
 const api=attachMobileSky(viewport,{getCamera:()=>camera,getViewport:()=>r,onModeChange:()=>rebuilds++});
 try{
  api.setScene(scene);api.paint();const canvas=viewport.querySelector('canvas');assert.equal(api.active,true);assert.equal(canvas.width,856);assert.equal(canvas.height,1400);assert.ok(viewport.classList.contains('canvas-sky-mode'));
  mobile=false;changed();assert.equal(api.active,false);assert.equal(canvas.hidden,true);assert.equal(rebuilds,1);mobile=true;changed();api.paint();assert.equal(api.active,true);assert.equal(rebuilds,2);
 }finally{api.destroy();win.close();}
 const fallback=new JSDOM('<div id="map"></div>'),w=fallback.window;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.Path2D=Path2D;
 const f=attachMobileSky(w.document.querySelector('#map'),{contextFactory:()=>{throw Error('No canvas');}});assert.equal(f.active,false);assert.equal(w.document.querySelector('.canvas-sky-mode'),null);f.destroy();w.close();
});

test('active and completed red star facets retain visible color while completion stays brighter',()=>{
 const scene=createMobileScene(map),base=scene.nodes.find(n=>n.p.chart==='Vir'),viewport={width:428,height:700},camera=cameraFor(base,viewport,1);
 const painter=createMobilePainter({makeCanvas,Path:Path2D}),ctx=createCanvas(viewport.width,viewport.height).getContext('2d'),samples=[];
 for(const state of ['locked','active-course','completed']){
  const node={...base,state},isolated={...scene,nodes:[node],charts:[],edges:[],portal:null};painter.paint(ctx,isolated,camera,viewport);
  // The upper right cut face lies away from the intentionally white star core.
  const x=Math.round(camera.x+(node.p.x+125+3*4/3*node.p.perspective)*camera.scale),y=Math.round(camera.y+(node.p.y+176+(53*4/3-176)*node.p.perspective)*camera.scale);
  const [r,g,b,a]=ctx.getImageData(x,y,1,1).data;samples.push({chroma:(r-Math.min(g,b))*a/255,light:(r+g+b)*a/255});
 }
 assert.ok(samples[1].chroma>samples[0].chroma);assert.ok(samples[2].chroma>samples[0].chroma);assert.ok(samples[1].chroma>60&&samples[2].chroma>60);assert.ok(samples[2].light>samples[1].light);painter.clear();
});

test('actual mobile app renders a cached surface, selects courses and paths, and frame-batches dragging without changing progress',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8'),dom=new JSDOM(html,{url:'https://mobile.test/',pretendToBeVisual:true}),w=dom.window;
 const names=['document','window','localStorage','ResizeObserver','requestAnimationFrame','FormData'],previous=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{document:w.document,window:w,localStorage:w.localStorage,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),FormData:w.FormData});
 w.matchMedia=media=>({matches:media.includes('pointer: coarse')||media.includes('max-width'),addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:428,height:700,left:0,top:0});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.show=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 Object.defineProperty(w,'devicePixelRatio',{value:3});const {native,counts}=canvasAdapter(w),frames=new Map();let next=0;w.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};w.cancelAnimationFrame=id=>frames.delete(id);
 try{
  await import('../src/app.js?mobile-renderer-regression');
  const doc=w.document,viewport=doc.querySelector('#map-viewport'),canvas=viewport.querySelector('.mobile-sky-canvas'),ctx=native.get(canvas).getContext('2d');
  assert.equal(viewport.classList.contains('canvas-sky-mode'),true);assert.equal(doc.querySelector('#rotate-sky').hidden,true);assert.equal(canvas.width,856);
  const pose=()=>{const m=ctx.getTransform();return {x:m.e/2,y:m.f/2,scale:m.a/2};},scene=createMobileScene(map);
  const node=visibleMobileItems(scene,pose(),{width:428,height:700}).nodes.find(n=>{const x=pose().x+(n.p.x+125)*pose().scale,y=pose().y+(n.p.y+176+(70*4/3-176)*n.p.perspective)*pose().scale;return x>25&&x<403&&y>25&&y<675;});assert.ok(node);
  const point={x:pose().x+(node.p.x+125)*pose().scale,y:pose().y+(node.p.y+176+(70*4/3-176)*node.p.perspective)*pose().scale};
  viewport.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:point.x,clientY:point.y,detail:1}));assert.equal(doc.querySelector('#course-card').open,true);assert.match(doc.querySelector('#dossier-title').textContent,new RegExp(node.course.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(w.localStorage.getItem(STORAGE_KEY),null);
  doc.querySelector('[data-action="close-inspector"]').click();frames.clear();
  const pointer=(type,x,y)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'touch'},isPrimary:{value:true}});viewport.dispatchEvent(e);};
  pointer('pointerdown',200,300);const before=counts.get(canvas).clears;
  for(let i=1;i<=200;i++)pointer('pointermove',200+i/4,300+i/4);assert.equal(counts.get(canvas).clears,before);assert.equal(frames.size,1);
  const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(16));assert.equal(counts.get(canvas).clears,before+1);pointer('pointerup',250,350);assert.equal(w.localStorage.getItem(STORAGE_KEY),null);
  const camera=pose(),pointOnEdge=scene.edges.flatMap(e=>e.points).find(p=>{const x=camera.x+p.x*camera.scale,y=camera.y+p.y*camera.scale;return x>20&&x<408&&y>20&&y<680&&pickMobileItem(scene,camera,{x,y})?.kind==='connection';});assert.ok(pointOnEdge);
  // A fresh tap after dragging restores click eligibility.
  const x=camera.x+pointOnEdge.x*camera.scale,y=camera.y+pointOnEdge.y*camera.scale;pointer('pointerdown',x,y);pointer('pointerup',x,y);viewport.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:x,clientY:y,detail:1}));assert.equal(doc.querySelector('#connection-card').hidden,false);assert.equal(w.localStorage.getItem(STORAGE_KEY),null);
 }finally{dom.window.close();for(const name of names){if(previous[name]===undefined)delete globalThis[name];else globalThis[name]=previous[name];}}
});
