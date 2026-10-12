import test from 'node:test';
import assert from 'node:assert/strict';
import {createFramePainter} from '../src/frame-painter.mjs';

test('bursts of camera input paint once per frame using the latest position, and release flushes pending input',()=>{
 let callback=null,requests=0,position=0;const painted=[];
 const painter=createFramePainter(()=>painted.push(position),{requestFrame:fn=>{requests++;callback=fn;return requests;},cancelFrame:()=>{callback=null;}});
 for(let i=0;i<200;i++){position=i;painter.schedule();}
 assert.equal(requests,1);assert.deepEqual(painted,[]);
 const draw=callback;callback=null;draw();assert.deepEqual(painted,[199]);
 position=250;painter.schedule();position=300;painter.flush();assert.equal(callback,null);assert.deepEqual(painted,[199,300]);
 position=400;painter.schedule();painter.cancel();assert.equal(callback,null);assert.deepEqual(painted,[199,300]);
});
