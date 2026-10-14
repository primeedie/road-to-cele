import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {COURSE_GRADING_SCHEMES,gradeDraftValues,gradeForecast,renderGradeForecast} from '../src/grade-calculator.mjs';
import {gradePoint,gradeThreshold} from '../src/grade-scale.mjs';
import {newProgress,recordAcademicProgress,startCourseRetake,dependencyMet,courseAccess,setAcademicTerm} from '../src/progression.mjs';
import {saveCourseGrade,courseGradeAttempts,personalCoursePlan} from '../src/grade-attempts.mjs';
import {hydrateProgress} from '../src/storage.mjs';
import {createSkyMap} from '../src/map-curriculum.mjs';
import {createOrbitLayout,orbitSceneBounds} from '../src/orbit-layout.mjs';
import {createMobileScene,pickMobileItem} from '../src/mobile-sky.mjs';
import {COURSE_BY_ID} from '../src/curriculum.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';
const draft=(quiz,final=40)=>({quiz_count_quizzes:'1',quiz_quizzes_0_score:String(quiz),quiz_quizzes_0_max:'100',final:String(final),final_max:'100',activities:'100',teacher:'95',gradeTarget:'final',gradeStep:'1',targetGrade:'4'});
const save=(p,d,term=1,options={})=>saveCourseGrade(p,'FNDMATH',{term,draft:d,confirmed:true,...options});

test('all 19 course grade tables preserve their own thresholds without rounding or a generic chemistry/physics scale',()=>{
 for(const scheme of Object.values(COURSE_GRADING_SCHEMES))for(const b of scheme.gradeScale.bands){assert.equal(gradePoint(scheme.gradeScale,b.minimum),b.grade);assert.ok(gradePoint(scheme.gradeScale,b.minimum-.00001)<b.grade);assert.equal(gradeThreshold(scheme.gradeScale,b.grade),b.minimum);}
 assert.equal(gradePoint(COURSE_GRADING_SCHEMES.FNDMATH.gradeScale,94),4);
 assert.equal(gradePoint(COURSE_GRADING_SCHEMES.BASCHEM.gradeScale,94),3.5);
 assert.equal(gradePoint(COURSE_GRADING_SCHEMES.ENGCHEM.gradeScale,95),3.5);
 assert.equal(gradePoint(COURSE_GRADING_SCHEMES.BASPHYS.gradeScale,55),1);
 assert.equal(gradePoint(COURSE_GRADING_SCHEMES.FNDMATH.gradeScale,54.9999),0);
});
test('target selection 1.0–4.0 solves each threshold without changing the actual final outcome; display uses stable weighted contributions',()=>{
 const s=COURSE_GRADING_SCHEMES.FNDMATH,values=gradeDraftValues(draft(40),s),base=gradeForecast(values.scheme,values.scores,'final');
 assert.equal(base.currentTotal,48.75);assert.equal(base.grade,0);assert.equal(base.needed,65);
 const missing=gradeForecast(values.scheme,{...values.scores,final:null},'final');assert.equal(missing.earnedTotal,38.75);assert.equal(missing.currentTotal,null);
 assert.match(renderGradeForecast(missing),/Earned toward final grade/);assert.doesNotMatch(renderGradeForecast(missing),/51.67/);
 for(const b of s.gradeScale.bands){const r=gradeForecast(values.scheme,values.scores,'final',{targetGrade:b.grade});assert.equal(r.currentTotal,48.75);assert.equal(r.grade,0);assert.equal(r.targetPercentage,b.minimum);
  const attained=gradeForecast(values.scheme,{...values.scores,final:r.needed},'final');assert.ok(attained.currentTotal+1e-8>=b.minimum);assert.ok(gradeForecast(values.scheme,{...values.scores,final:r.needed-1},'final').currentTotal<b.minimum);
 }
 const physics={...COURSE_GRADING_SCHEMES.ENGPHYS,components:COURSE_GRADING_SCHEMES.ENGPHYS.components.map(c=>({...c,allowBonus:true}))};
 for(const b of physics.gradeScale.bands){const r=gradeForecast(physics,{exams:70,product:80},'final',{targetGrade:b.grade});assert.ok(gradeForecast(physics,{exams:70,product:80,final:r.needed},'final').currentTotal+1e-8>=b.minimum);}
});
test('only confirmed complete attempts become term grades; failed grades block hard requirements while retaining soft access and tabs',()=>{
 let p=recordAcademicProgress(newProgress(),'FNDMATH','ACTIVE');p=recordAcademicProgress(p,'LBYME1A','COMPLETED');
 const before=JSON.stringify(p);assert.throws(()=>saveCourseGrade(p,'FNDMATH',{term:1,draft:draft(40)}),/Confirm/);assert.throws(()=>save(p,{...draft(40),final:''}),/every assessment/);assert.equal(JSON.stringify(p),before);
 p=save(p,draft(40));assert.equal(p.academicRecords.FNDMATH.status,'FAILED');assert.equal(courseGradeAttempts(p,'FNDMATH')[0].grade,0);
 assert.equal(dependencyMet(p,'FNDMATH','H'),false);assert.equal(dependencyMet(p,'FNDMATH','S'),true);assert.equal(courseAccess(p,'CALENG1').allowed,false);assert.equal(courseAccess(p,'CESURVE').allowed,true);
 assert.throws(()=>recordAcademicProgress(p,'FNDMATH','COMPLETED'),/passing retake/);
 const dom=new JSDOM(renderCoursePanel(p,COURSE_BY_ID.FNDMATH,{section:3}));assert.equal(dom.window.document.querySelectorAll('[role="tab"]:disabled').length,0);assert.ok(dom.window.document.querySelector('[data-grade-retake]'));assert.ok(dom.window.document.querySelector('.grade-assessments').disabled);dom.window.close();
});
test('retakes preserve earlier snapshots, require a later term, use fresh drafts, and restore hard access only after a passing prior-term attempt',()=>{
 let p=save(recordAcademicProgress(newProgress(),'FNDMATH','ACTIVE'),draft(40));const failed=structuredClone(p.academicRecords.FNDMATH.gradeAttempts[0]);
 assert.throws(()=>startCourseRetake(p,'FNDMATH',1),/later term/);assert.throws(()=>save(p,draft(80),2),/activated/);
 p=startCourseRetake(p,'FNDMATH',2);assert.equal(p.academicRecords.FNDMATH.takenInTerm,2);assert.equal(p.academicRecords.FNDMATH.status,'ACTIVE');
 assert.equal(courseAccess(p,'CALENG1').allowed,false);assert.throws(()=>recordAcademicProgress(p,'FNDMATH','COMPLETED'),/passing retake/);
 p=save(p,draft(80,90),2);assert.equal(p.academicRecords.FNDMATH.status,'COMPLETED');assert.deepEqual(p.academicRecords.FNDMATH.gradeAttempts[0],failed);assert.equal(p.academicRecords.FNDMATH.gradeAttempts[1].grade,3);
 assert.equal(p.academicRecords.FNDMATH.gradeAttempts[1].schemeSnapshot.components[0].weight,60);assert.notEqual(p.academicRecords.FNDMATH.gradeAttempts[1].schemeSnapshot.gradeScale,COURSE_GRADING_SCHEMES.FNDMATH.gradeScale);
 assert.equal(courseAccess(p,'CALENG1').allowed,false);p=setAcademicTerm(p,3);assert.equal(courseAccess(p,'CALENG1').allowed,true);
 assert.deepEqual(hydrateProgress(JSON.parse(JSON.stringify(p))),p);
 assert.throws(()=>save(p,draft(95),2),/Edit/);p=save(p,draft(90,90),2,{correction:true});assert.equal(p.academicRecords.FNDMATH.gradeAttempts.length,2);assert.equal(p.academicRecords.FNDMATH.gradeAttempts[1].revisions.length,1);
 assert.equal(p.academicRecords.FNDMATH.gradeAttempts[1].revisions[0].grade,3);
});
test('unmet/unchecked passing conditions override numeric grades and neither drafts nor mastery grant a pass',()=>{
 const id='LBYCV3C',base={...newProgress(),academicYear:3,academicTerm:8,academicRecords:{[id]:{status:'ACTIVE',takenInTerm:8}}},s=COURSE_GRADING_SCHEMES[id];
 const d=Object.fromEntries(s.components.map(c=>[c.id,'95']));for(const req of s.requirements||[])d['req_'+req.id]='met';
 const unknown=gradeDraftValues(d,s),pending=gradeForecast(unknown.scheme,unknown.scores,unknown.target,{requirements:{}});assert.equal(pending.grade,null);assert.equal(pending.numericGrade,4);
 assert.ok(s.requirements.length);const req=s.requirements[0].id;assert.throws(()=>saveCourseGrade(base,id,{term:8,draft:{...d,['req_'+req]:''},confirmed:true}),/passing requirements/);
 const next=saveCourseGrade(base,id,{term:8,draft:{...d,['req_'+req]:'not-met'},confirmed:true});assert.equal(next.academicRecords[id].gradeAttempts[0].numericGrade,4);assert.equal(next.academicRecords[id].gradeAttempts[0].grade,0);assert.equal(next.academicRecords[id].status,'FAILED');assert.deepEqual(next.masteryRecords,{});
});
test('personal plans retain failed nodes, shift hard chains once per delay, preserve independent soft courses and started records, and extend map bounds',()=>{
 let p=save(recordAcademicProgress(newProgress(),'FNDMATH','ACTIVE'),draft(40));let plan=personalCoursePlan(p),find=id=>plan.courses.find(c=>c.id===id);
 assert.equal(find('FNDMATH').term,2);assert.equal(find('CALENG1').term,3);assert.equal(find('CALENG2').term,4);assert.equal(find('CESURVE').term,2);assert.equal(find('CEECONO').term,3);assert.equal(find('FNDMATH~1').archivedAttempt.grade,0);
 p=startCourseRetake(p,'FNDMATH',2);p=save(p,draft(40),2);plan=personalCoursePlan(p);assert.equal(find('CALENG1').term,4);assert.equal(find('CALENG2').term,5);assert.equal(find('FNDMATH').term,3);
 const late=startCourseRetake(p,'FNDMATH',12);
 for(const branch of [null,'STE','TRE']){
  const source=createSkyMap(branch,late),map=createOrbitLayout(source),scene=createMobileScene(map),bounds=orbitSceneBounds(map);
  assert.equal(new Set(map.courses.map(c=>c.id)).size,map.courses.length);assert.ok(map.positions['FNDMATH~1']);assert.ok(map.positions['FNDMATH~2']);assert.ok(map.charts.some(g=>g.term>11));
  assert.ok(scene.nodes.some(n=>n.course.id==='FNDMATH~1'));assert.ok(scene.edges.every(e=>!e.from.includes('~')&&!e.to.includes('~')));
  for(const c of map.courses){const pos=map.positions[c.id];assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y));assert.ok(pos.x+125>=bounds.minX&&pos.x+125<=bounds.maxX);}
  const archive=scene.nodes.find(n=>n.course.id==='FNDMATH~1'),point={x:archive.p.x+125,y:archive.p.y+176+(70*4/3-176)*archive.p.perspective};assert.equal(pickMobileItem(scene,{x:0,y:0,scale:1},point).id,'FNDMATH~1');
 }
 p.academicRecords.CALENG1={status:'ACTIVE',takenInTerm:3};plan=personalCoursePlan(p);assert.equal(find('CALENG1').term,3);
 const extended={...newProgress(),academicYear:4,academicTerm:15};assert.equal(hydrateProgress(extended).academicTerm,15);
});
