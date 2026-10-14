import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {COURSES,COURSE_BY_ID} from '../src/curriculum.mjs';
import {COURSE_CONTENT,SYLLABUS_SOURCES,SYLLABUS_GRADING,LIMITED_SYLLABI} from '../src/syllabus-data.mjs';
import {renderCoursePanel} from '../src/course-panel.mjs';
import {newProgress} from '../src/progression.mjs';
import {validateGradingScheme,gradeForecast,gradeForecastText,renderGradeCalculator,gradeFormValues} from '../src/grade-calculator.mjs';

test('19 supplied courses have compact sourced content, valid grading and supported future links without CIVINCO/CELE claims',()=>{
 assert.equal(Object.keys(COURSE_CONTENT).length,19);assert.deepEqual(Object.keys(SYLLABUS_GRADING).sort(),Object.keys(COURSE_CONTENT).sort());
 for(const [id,data] of Object.entries(COURSE_CONTENT)){
  const c=COURSE_BY_ID[id],s=SYLLABUS_SOURCES[id];assert.ok(c&&s);assert.ok(data.description&&data.topics.length>=5&&data.topics.length<=7);validateGradingScheme(SYLLABUS_GRADING[id]);
  for(const pages of [s.descriptionPages,s.topicPages,s.gradingPages])assert.ok(pages.length&&pages.every(n=>Number.isInteger(n)&&n>0));
  if(c.courseKind==='LAB'){assert.ok(data.labSkills.length);for(const skill of data.labSkills)assert.ok(skill.practice&&skill.evidence&&skill.resume&&skill.pages.length);}
  else for(const link of data.future){assert.ok(COURSE_BY_ID[link.course].term>c.term);assert.ok(SYLLABUS_SOURCES[link.course]);assert.equal(link.inferred,true);assert.ok(link.fromPages.length&&link.toPages.length);assert.ok(!/CIVINCO|CELE/.test(link.why));}
 }
 assert.equal(Object.keys(LIMITED_SYLLABI).length,1);assert.ok(LIMITED_SYLLABI.HWRCORI);assert.equal(COURSE_CONTENT.HWRCORI,undefined);
});

test('reviewed math and CE passing targets differ and raw-score inputs do not guess exam maxima',()=>{
 assert.equal(SYLLABUS_GRADING.FNDMATH.passingPercentage,55);assert.equal(SYLLABUS_GRADING.CALENG3.passingPercentage,55);assert.equal(SYLLABUS_GRADING.CERCDES.passingPercentage,60);
 const dom=new JSDOM(renderGradeCalculator(COURSE_BY_ID.FNDMATH)),form=dom.window.document.querySelector('form');
 for(const [id,value] of Object.entries({quizzes:55,activities:70,teacher:80,final:0,final_max:50}))form.elements.namedItem(id).value=value;
 const values=gradeFormValues(form,SYLLABUS_GRADING.FNDMATH),result=gradeForecast(values.scheme,values.scores,values.target);
 assert.equal(result.needed,22);assert.equal(result.target.max,50);assert.match(gradeForecastText(result),/22\/50/);
 assert.ok(gradeForecast(values.scheme,{...values.scores,final:22},'final').currentTotal>=55);assert.ok(gradeForecast(values.scheme,{...values.scores,final:21},'final').currentTotal<55);
 form.elements.namedItem('final_max').value='';assert.throws(()=>gradeForecast(gradeFormValues(form,SYLLABUS_GRADING.FNDMATH).scheme,values.scores,'final'));dom.window.close();
});

test('physics assigns 50% to the higher percentage and forecasts across either side of the comparison',()=>{
 for(const id of ['BASPHYS','ENGPHYS']){
  const s=SYLLABUS_GRADING[id];assert.equal(s.passingPercentage,50);
  const a=gradeForecast(s,{exams:70,final:50,product:70},'final'),b=gradeForecast(s,{exams:50,final:70,product:70},'final');assert.equal(a.currentTotal,63);assert.equal(b.currentTotal,63);
  const raw={...s,components:s.components.map(c=>({...c,max:c.id==='final'?50:100}))};
  for(const [scores,expected] of [[{exams:60,product:80},12],[{exams:20,product:60},34]]){
   const result=gradeForecast(raw,scores,'final');assert.equal(result.needed,expected);
   assert.ok(gradeForecast(raw,{...scores,final:expected},'final').currentTotal>=50);assert.ok(gradeForecast(raw,{...scores,final:expected-1},'final').currentTotal<50);
  }
  assert.equal(gradeForecast(s,{exams:70},'final').currentAverage,null);
 }
});

test('lab submission and attendance gates remain separate from a passing numeric grade',()=>{
 const s=SYLLABUS_GRADING.LBYCV2C,scores={labex:100,cenmex:100,project:100};
 const unknown=gradeForecast(s,scores,'project');assert.equal(unknown.currentTotal,100);assert.equal(unknown.eligibility,'unknown');assert.match(gradeForecastText(unknown),/requirements are unconfirmed/);
 const requirements=Object.fromEntries(s.requirements.map(r=>[r.id,'met']));assert.equal(gradeForecast(s,scores,'project',{requirements}).eligibility,'met');
 const unmet=gradeForecast(s,scores,'project',{requirements:{...requirements,cenmex:'not-met'}});assert.equal(unmet.eligibility,'not-met');assert.match(gradeForecastText(unmet),/override a passing numeric score/);
 assert.deepEqual(SYLLABUS_GRADING.LBYCV4B.components.map(c=>c.weight),[50,10,40]);assert.deepEqual(SYLLABUS_GRADING.LBYCV3C.components.map(c=>c.weight),[10,50,40]);
});

test('authored course tabs preserve preview/progression scope, lab tab count and pending quizzes',()=>{
 const progress=newProgress(),before=JSON.stringify(progress);
 for(const id of Object.keys(COURSE_CONTENT))for(const section of [0,1,2,3]){
  const dom=new JSDOM(renderCoursePanel(progress,COURSE_BY_ID[id],{section,preview:true})),doc=dom.window.document;
  assert.match(doc.querySelector('#course-section').textContent,section===3?/passing target/:section===1?/Syllabus-based overview/:section===2&&COURSE_BY_ID[id].courseKind==='LAB'?/Keep as evidence/:section===2?/Inferred connections/:/short paraphrase/);
  assert.equal(doc.querySelectorAll('[role="tab"]').length,COURSE_BY_ID[id].courseKind==='LAB'?4:5);assert.equal(doc.querySelector('[data-academic]'),null);assert.equal(doc.querySelector('script'),null);dom.window.close();
 }
 assert.equal(JSON.stringify(progress),before);assert.match(renderCoursePanel(progress,COURSE_BY_ID.HWRCORI),/Full syllabus still needed/);assert.match(renderCoursePanel(progress,COURSE_BY_ID.FNDMATH,{section:4}),/Quiz coming later/);
});
