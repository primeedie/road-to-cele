import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {averageQuizEntries,changeQuizRows} from '../src/quiz-scores.mjs';
import {COURSE_BY_ID} from '../src/curriculum.mjs';
import {COURSE_GRADING_SCHEMES,renderGradeCalculator,gradeFormValues,gradeForecast,gradeForecastText} from '../src/grade-calculator.mjs';
test('quiz percentages are equally weighted and include actual bonus scores without pooling or zero-filling blanks',()=>{
 assert.equal(averageQuizEntries([{score:'105',max:'100'},{score:'40',max:'50'}]),92.5);
 assert.equal(averageQuizEntries([]),null);assert.equal(averageQuizEntries([{score:'0',max:'50'}]),0);
 assert.equal(averageQuizEntries([{score:'20',max:''}]),null);
 for(const rows of [[{score:'20',max:'0'}],[{score:'-1',max:'10'}],[{score:'abc',max:'10'}]])assert.throws(()=>averageQuizEntries(rows));
});
test('quiz rows can be added, removed, renumbered and restored; final exam bonuses affect the weighted total',()=>{
 const s=COURSE_GRADING_SCHEMES.FNDMATH,dom=new JSDOM(renderGradeCalculator(COURSE_BY_ID.FNDMATH)),form=dom.window.document.querySelector('form'),q=s.components[0];
 changeQuizRows(form,q);changeQuizRows(form,q);
 for(const [name,value] of Object.entries({quiz_quizzes_0_score:105,quiz_quizzes_0_max:100,quiz_quizzes_1_score:40,quiz_quizzes_1_max:50,final:55,final_max:50,activities:70,teacher:80}))form.elements.namedItem(name).value=value;
 let v=gradeFormValues(form,s),r=gradeForecast(v.scheme,v.scores,v.target);assert.equal(v.scores.quizzes,92.5);assert.equal(r.currentTotal,94);assert.match(form.querySelector('[data-quiz-bonus]').textContent,/5 bonus/);assert.equal(form.querySelector('[data-final-percentage]').textContent,'110.00%');
 const restored=new JSDOM(renderGradeCalculator(COURSE_BY_ID.FNDMATH,s,{draft:v.draft})),f=restored.window.document.querySelector('form');assert.equal(f.querySelectorAll('[data-quiz-row]').length,2);assert.equal(f.elements.namedItem('quiz_quizzes_1_max').value,'50');
 changeQuizRows(form,q,0);v=gradeFormValues(form,s);assert.equal(v.scores.quizzes,80);assert.match(form.querySelector('[data-quiz-row] strong').textContent,/LQ 1/);
 assert.equal(form.querySelectorAll('[data-add-quiz="final"]').length,0);dom.window.close();restored.window.close();
});
test('bonus-dependent forecasts say when full marks are insufficient rather than promising unawarded bonus points',()=>{
 const s={mode:'weighted-percentage',source:'Synthetic test',passingPercentage:60,components:[{id:'work',label:'Work',weight:60,max:100},{id:'final',label:'Final Exam',weight:40,max:50,allowBonus:true}]};
 const r=gradeForecast(s,{work:0,final:80},'final');assert.equal(r.currentTotal,64);assert.equal(r.needed,75);assert.equal(r.possible,false);assert.match(gradeForecastText(r),/75\/50.*bonus points must actually be awarded/);
});
