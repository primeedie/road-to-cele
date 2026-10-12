import test from 'node:test';
import assert from 'node:assert/strict';
import {drawConstellation,projectConstellation,starBadge} from '../src/sky-layout.mjs';
test('stars have no circular aura and completion contributes more constellation light than activation',()=>{
 assert.ok(!starBadge().includes('star-aura'));assert.ok(starBadge().includes('star-facet-light'));
 const chart=projectConstellation('Ori',{x:0,y:0,width:100,height:100});
 const level=opts=>Number(drawConstellation(chart,opts).match(/--constellation-brightness:([\d.]+)/)[1]);
 const faint=level({total:4}),active=level({total:4,activated:1}),complete=level({total:4,completed:1}),max=level({total:4,completed:4});
 assert.ok(faint<active&&active<complete&&complete<max);assert.equal(max,1);
 assert.match(drawConstellation(chart,{total:4,activated:1,completed:2}),/data-lit-courses="3" data-completed-courses="2"/);
});
