import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmoothZoom,wheelZoomFactor} from '../src/smooth-zoom.mjs';
import {constrainCamera} from '../src/map-camera.mjs';

function harness({initial={x:-120,y:-80,scale:.5},constrain=c=>c,reduced=false}={}){
 let camera={...initial},time=0,next=null,requests=0;const paints=[],activity=[];
 const zoom=createSmoothZoom({getCamera:()=>camera,onCamera:c=>{camera=c;paints.push({...c});},constrain,getLimits:()=>({min:.1,max:1.8}),requestFrame:fn=>{assert.equal(next,null);next=fn;return ++requests;},cancelFrame:()=>{next=null;},now:()=>time,reducedMotion:()=>reduced,onActivity:value=>activity.push(value)});
 return {zoom,paints,activity,get camera(){return camera;},get requests(){return requests;},get pending(){return !!next;},step(dt){time+=dt;const fn=next;next=null;if(fn)fn(time);},settle(hz=144){for(let i=0;i<400&&next;i++)this.step(1000/hz);assert.equal(next,null);}};
}
test('smooth zoom paints on display frames, preserves the cursor anchor throughout and settles exactly',()=>{
 const h=harness(),anchor={x:240,y:160},world={x:(anchor.x-h.camera.x)/h.camera.scale,y:(anchor.y-h.camera.y)/h.camera.scale};
 h.zoom.zoom(1.4,anchor.x,anchor.y);assert.equal(h.paints.length,0);assert.equal(h.zoom.active,true);
 h.step(1000/144);assert.ok(h.camera.scale>.5&&h.camera.scale<.7);
 h.settle();assert.equal(h.camera.scale,.7);assert.deepEqual(h.activity,[true,false]);
 for(const p of h.paints){assert.ok(Math.abs(p.x+world.x*p.scale-anchor.x)<1e-8);assert.ok(Math.abs(p.y+world.y*p.scale-anchor.y)<1e-8);}
});
test('60 Hz and 144 Hz follow the same time-based easing, with a paint available on every display frame',()=>{
 const a=harness(),b=harness();a.zoom.zoom(1.8,300,200);b.zoom.zoom(1.8,300,200);
 for(let i=0;i<10;i++)a.step(1000/60);for(let i=0;i<24;i++)b.step(1000/144);
 for(const key of ['x','y','scale'])assert.ok(Math.abs(a.camera[key]-b.camera[key])<1e-8);
 assert.equal(a.paints.length,10);assert.equal(b.paints.length,24);a.settle(60);b.settle(144);assert.deepEqual(a.camera,b.camera);
});
test('wheel bursts accumulate targets, reversing or moving the cursor retargets without jumping, and limits stay bounded',()=>{
 const h=harness();h.zoom.zoom(1.2,200,100);h.zoom.zoom(1.2,200,100);assert.equal(h.requests,1);assert.equal(h.paints.length,0);
 h.step(12);const before={...h.camera};h.zoom.zoom(.7,450,250);assert.deepEqual(h.camera,before);
 const world={x:(450-before.x)/before.scale,y:(250-before.y)/before.scale};h.step(12);
 assert.ok(Math.abs(h.camera.x+world.x*h.camera.scale-450)<1e-8);h.settle();assert.ok(Math.abs(h.camera.scale-.504)<1e-9);
 h.zoom.zoom(1e6,200,100);h.settle();assert.equal(h.camera.scale,1.8);
 h.zoom.zoom(1e-9,200,100);h.settle();assert.equal(h.camera.scale,.1);
});
test('cancellation preserves the displayed pose for direct gestures; reduced motion completes immediately without frames',()=>{
 const h=harness();h.zoom.zoom(2,200,100);h.step(7);const before={...h.camera};h.zoom.cancel();h.step(500);assert.deepEqual(h.camera,before);assert.equal(h.zoom.active,false);assert.equal(h.pending,false);
 const reduced=harness({reduced:true});reduced.zoom.zoom(2,200,100);assert.equal(reduced.camera.scale,1);assert.equal(reduced.requests,0);assert.equal(reduced.pending,false);
});
test('pixel, line, page and trackpad wheel deltas have proportional sensitivity and zero input is inert',()=>{
 assert.equal(wheelZoomFactor({deltaY:0}),1);
 assert.equal(wheelZoomFactor({deltaY:16,deltaMode:0}),wheelZoomFactor({deltaY:1,deltaMode:1}));
 assert.equal(wheelZoomFactor({deltaY:100,deltaMode:0}),wheelZoomFactor({deltaY:.125,deltaMode:2},800));
 assert.ok(wheelZoomFactor({deltaY:-1})>1&&wheelZoomFactor({deltaY:-1})<wheelZoomFactor({deltaY:-100}));
 assert.equal(wheelZoomFactor({deltaY:Infinity}),1);
 const h=harness();h.zoom.zoom(wheelZoomFactor({deltaY:0}),100,100);assert.equal(h.pending,false);
});
test('every smooth frame respects curriculum pan bounds',()=>{
 const viewport={width:800,height:500},bounds={minX:0,minY:0,maxX:3000,maxY:3000,territories:[{minX:0,minY:0,maxX:3000,maxY:3000}]};
 const h=harness({constrain:c=>constrainCamera(c,viewport,bounds)});h.zoom.zoom(.001,0,0);h.settle();
 for(const p of h.paints)assert.deepEqual(constrainCamera(p,viewport,bounds),p);
});
