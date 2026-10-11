import test from 'node:test';
import assert from 'node:assert/strict';
import { courseConnections, traceConnection } from '../src/connections.mjs';
const course=(id,h=[],s=[],c=[])=>({id,term:1,hardPrerequisites:h,softPrerequisites:s,corequisites:c});

test('a selected connection traces ancestors and descendants but excludes parallel sibling paths',()=>{
 const courses=[course('A'),course('B',['A']),course('C',['B']),course('D',['C']),course('E',['A']),course('X'),course('Y',['X'])];
 const original=JSON.stringify(courses),trace=traceConnection(courses,'B:C:H');
 assert.deepEqual([...trace.ids].sort(),['A','B','C','D']);
 assert.deepEqual(trace.before.map(c=>c.id),['A']);assert.deepEqual(trace.after.map(c=>c.id),['D']);
 assert.deepEqual([...trace.edges].sort(),['A:B:H','B:C:H','C:D:H']);
 assert.equal(JSON.stringify(courses),original);
 assert.equal(traceConnection(courses,'A:Y:H'),null);
});
test('trace respects visible graph boundaries, dependency kinds, and cycles',()=>{
 const courses=[course('A',[],[],['C']),course('B',['A','OUTSIDE']),course('C',[],['B'])];
 assert.deepEqual(courseConnections(courses).map(e=>e.type),['C','H','S']);
 const trace=traceConnection(courses,'B:C:S');
 assert.equal(trace.ids.size,3);assert.equal(trace.link.type,'S');
});
