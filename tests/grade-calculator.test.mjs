import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {gradeForecast,gradeForecastText,validateGradingScheme,renderGradeCalculator,COURSE_GRADING_SCHEMES} from '../src/grade-calculator.mjs';
import {courseSections,renderCoursePanel} from '../src/course-panel.mjs';
import {COURSE_BY_ID} from '../src/curriculum.mjs';
import {newProgress} from '../src/progression.mjs';
// Hypothetical test data only, not a DLSU syllabus or an imported grading scheme.
const scheme={mode:'weighted-percentage',source:'Synthetic test fixture',passingPercentage:60,components:[{id:'work',label:'Coursework',weight:60,max:100},{id:'exam',label:'Final exam',weight:40,max:50}]};

test('required raw score rounds up to the first attainable passing mark and recognizes below-target grades',()=>{
 const result=gradeForecast(scheme,{work:55,exam:32},'exam');assert.equal(result.needed,34);assert.equal(result.currentTotal,58.6);assert.equal(result.possible,true);assert.match(gradeForecastText(result),/below.*passing target.*34\/50/);
 assert.ok(gradeForecast(scheme,{work:55,exam:result.needed},'exam').currentTotal>=60);
 assert.ok(gradeForecast(scheme,{work:55,exam:result.needed-1},'exam').currentTotal<60);
 const fractional={...scheme,components:[scheme.components[0],{...scheme.components[1],scoreStep:.5}]};assert.equal(gradeForecast(fractional,{work:54},'exam').needed,34.5);assert.equal(gradeForecast(scheme,{work:54},'exam').needed,35);
});

test('unknown scores are never treated as zero; zero is a real score; impossible targets and already-secured targets are explicit',()=>{
 const missing=gradeForecast(scheme,{exam:40},'exam');assert.equal(missing.needed,null);assert.equal(missing.currentTotal,null);assert.deepEqual(missing.missingOther,['work']);assert.match(gradeForecastText(missing),/Enter the other assessment scores/);
 const onlyWork=gradeForecast(scheme,{work:55},'exam');assert.ok(Math.abs(onlyWork.currentAverage-55)<1e-9);assert.equal(onlyWork.needed,34);assert.match(gradeForecastText(onlyWork),/so far/);
 const impossible=gradeForecast(scheme,{work:0},'exam');assert.equal(impossible.possible,false);assert.equal(impossible.needed,75);assert.match(gradeForecastText(impossible),/Even 50\/50.*below/);
 assert.equal(gradeForecast(scheme,{work:100},'exam').needed,0);
 for(const score of [-1,51,NaN,Infinity,'30'])assert.throws(()=>gradeForecast(scheme,{work:55,exam:score},'exam'));
});

test('unsupported syllabus policies and incomplete or malformed schemes fail instead of producing misleading passing predictions',()=>{
 for(const invalid of [{...scheme,source:''},{...scheme,passingPercentage:null},{...scheme,transmutation:true},{...scheme,extraPassingConditions:['minimum final exam']},{...scheme,components:[scheme.components[0]]},{...scheme,components:[scheme.components[0],scheme.components[0]]}])assert.throws(()=>validateGradingScheme(invalid));
 assert.throws(()=>gradeForecast(scheme,{work:55},'unknown'));
 assert.equal(Object.keys(COURSE_GRADING_SCHEMES).length,19);
 const pending=renderGradeCalculator(COURSE_BY_ID.CEORIEN);assert.match(pending,/Awaiting course grading scheme/);assert.ok(!pending.includes('<input'));
 const dom=new JSDOM(renderGradeCalculator(COURSE_BY_ID.FNDMATH,{...scheme,source:'<script>bad</script>'}));assert.equal(dom.window.document.querySelector('script'),null);assert.equal(dom.window.document.querySelector('[name="exam"]').max,'100');dom.window.close();
});

test('lectures put grade calculator fourth and mastery fifth; labs end at their own fourth tab without granting progress',()=>{
 const progress=newProgress();for(const id of ['FNDMATH','LBYPH1A'])progress.academicRecords[id]={status:'ACTIVE'};const before=JSON.stringify(progress);
 for(const [id,count] of [['FNDMATH',5],['LBYPH1A',4]]){
  const c=COURSE_BY_ID[id],sections=courseSections(c);assert.equal(sections.length,count);assert.equal(sections[3].title,'Grade calculator');
  const dom=new JSDOM(renderCoursePanel(progress,c,{section:3}));assert.equal(dom.window.document.querySelectorAll('[role="tab"]').length,count);assert.match(dom.window.document.querySelector('#course-section').textContent,id==='FNDMATH'?/passing target: 55%/:/grading scheme/);
  assert.equal(!!dom.window.document.querySelector('#course-tab-4'),count===5);dom.window.close();
 }
 assert.equal(JSON.stringify(progress),before);
});
