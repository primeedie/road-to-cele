import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeCamera } from '../src/map-camera.mjs';

test('expanding and rotating the map keeps its center point and zoom, then returns to the original view',()=>{
 const camera={x:-900,y:-1300,scale:.72},small={width:800,height:520},large={width:1440,height:900};
 const expanded=resizeCamera(camera,small,large);
 const center=(c,r)=>({x:(r.width/2-c.x)/c.scale,y:(r.height/2-c.y)/c.scale});
 assert.deepEqual(center(expanded,large),center(camera,small));
 assert.equal(expanded.scale,camera.scale);
 assert.deepEqual(resizeCamera(expanded,large,small),camera);
 assert.deepEqual(resizeCamera(camera,small,{width:0,height:0}),camera);
 assert.deepEqual(resizeCamera(camera,{width:0,height:0},large),camera);
});
