import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScenePoint } from '../src/scene-camera.mjs';
import { projectConstellation, placeCourses, NODE_GROUND_X, NODE_GROUND_Y, NODE_LABEL_Y } from '../src/sky-layout.mjs';
import { COURSES } from '../src/curriculum.mjs';

test('scene camera foreshortens the ground plane and scales the near edge more than the far edge',()=>{
 const center={x:1000,y:1000},near=projectScenePoint({x:1000,y:1400},center),far=projectScenePoint({x:1000,y:600},center);
 assert.ok(near.perspective>1);assert.ok(far.perspective<1);
 assert.ok(near.y-center.y<400);assert.ok(center.y-far.y<400);
 assert.ok(near.x>center.x);assert.ok(far.x<center.x);
 const floor=projectScenePoint(center,center),raised=projectScenePoint(center,center,80);
 assert.ok(raised.y<floor.y-60);
});
test('projected course bases stay on their line anchors and preserve the course assignment used in details',()=>{
 const box={x:85,y:220,width:670,height:1120},courses=COURSES.filter(c=>c.term===1&&!c.specialization);
 const flat=projectConstellation('Ori',box),scene=projectConstellation('Ori',box,{depth:true});
 const flatCourses=placeCourses(flat,courses),sceneCourses=placeCourses(scene,courses);
 for(const c of courses){
  const position=sceneCourses[c.id],anchor=scene.vertices[position.anchorIndex];
  assert.equal(position.anchorIndex,flatCourses[c.id].anchorIndex);
  assert.ok(Math.abs(position.x+NODE_GROUND_X-anchor.x)<1e-8);
  assert.ok(Math.abs(position.y+NODE_GROUND_Y-anchor.y)<1e-8);
  assert.equal(position.labelX,0);assert.ok(position.labelY>=NODE_LABEL_Y);
  assert.ok(position.labelY>NODE_GROUND_Y+31*position.perspective+3);
  assert.equal(position.perspective,anchor.perspective);
 }
});
