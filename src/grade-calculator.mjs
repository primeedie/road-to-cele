// Populate only from reviewed course syllabi. No guessed grading weights or thresholds.
export const COURSE_GRADING_SCHEMES=Object.freeze({});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateGradingScheme(scheme){
 if(scheme?.mode!=='weighted-percentage'||typeof scheme.source!=='string'||!scheme.source.trim())throw Error('A reviewed syllabus and supported grading method are required.');
 if(!Number.isFinite(scheme.passingPercentage)||scheme.passingPercentage<=0||scheme.passingPercentage>100)throw Error('The syllabus must specify a valid passing percentage.');
 if(scheme.transmutation||scheme.extraPassingConditions?.length)throw Error('This syllabus has additional grading rules that must be supported before calculating a passing score.');
 const components=scheme.components;
 if(!Array.isArray(components)||!components.length)throw Error('The syllabus grading components are missing.');
 const ids=new Set();let weight=0;
 for(const c of components){
  if(typeof c.id!=='string'||!/^[a-z][a-z0-9_-]*$/i.test(c.id)||['gradeTarget','constructor','prototype'].includes(c.id)||ids.has(c.id)||typeof c.label!=='string'||!c.label)throw Error('Each grading component needs a unique ID and label.');
  if(!Number.isFinite(c.weight)||c.weight<=0||!Number.isFinite(c.max)||c.max<=0||!Number.isFinite(c.scoreStep??1)||(c.scoreStep??1)<=0)throw Error('Grading weights, maximum scores and score increments must be positive.');
  ids.add(c.id);weight+=c.weight;
 }
 if(Math.abs(weight-100)>1e-6)throw Error('Syllabus grading weights must add up to 100%.');
 return scheme;
}
export function gradeForecast(scheme,scores={},targetId){
 validateGradingScheme(scheme);
 const target=scheme.components.find(c=>c.id===targetId);if(!target)throw Error('Choose an assessment to calculate its required score.');
 let contribution=0,recordedWeight=0,otherContribution=0;const missing=[];
 for(const c of scheme.components){
  const score=scores[c.id];
  if(score===null||score===undefined||score===''){missing.push(c.id);continue;}
  if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>c.max)throw Error(`Enter ${c.label} between 0 and ${c.max}.`);
  const part=score/c.max*c.weight;contribution+=part;recordedWeight+=c.weight;if(c.id!==target.id)otherContribution+=part;
 }
 const currentAverage=recordedWeight?contribution/recordedWeight*100:null;
 const currentTotal=missing.length?null:contribution;
 const missingOther=missing.filter(id=>id!==target.id);
 if(missingOther.length)return {currentAverage,currentTotal,recordedWeight,needed:null,possible:null,missingOther,target,passingPercentage:scheme.passingPercentage};
 const raw=(scheme.passingPercentage-otherContribution)/target.weight*target.max,step=target.scoreStep??1;
 const needed=Math.max(0,Number((Math.ceil((raw-1e-9)/step)*step).toFixed(6)));
 return {currentAverage,currentTotal,recordedWeight,needed,possible:needed<=target.max+1e-9,missingOther,target,passingPercentage:scheme.passingPercentage,bestTotal:otherContribution+target.weight};
}
export function gradeForecastText(result){
 const {currentAverage,currentTotal,passingPercentage,needed,possible,target,missingOther}=result;
 const average=currentTotal!==null?`Calculated total: ${currentTotal.toFixed(1)}% — ${currentTotal+1e-9>=passingPercentage?'meets':'below'} the ${passingPercentage}% passing target.`:currentAverage!==null?`Recorded assessments: ${currentAverage.toFixed(1)}% — ${currentAverage+1e-9>=passingPercentage?'above':'below'} the ${passingPercentage}% target so far.`:'Enter your recorded scores to estimate your grade.';
 if(missingOther.length)return average+' Enter the other assessment scores before calculating an exact required score.';
 if(!possible)return average+` Even ${target.max}/${target.max} in ${target.label} would give ${result.bestTotal.toFixed(1)}%, below the passing target.`;
 return average+` You need at least ${needed}/${target.max} in ${target.label} to reach ${passingPercentage}%.`;
}
export function renderGradeCalculator(course,scheme=COURSE_GRADING_SCHEMES[course.id]){
 if(!scheme)return `<div class="dossier-placeholder grade-pending"><span class="dossier-small-star" aria-hidden="true">✦</span><h4>Awaiting ${course.courseKind==='LAB'?'laboratory':'course'} grading scheme</h4><p>Upload the syllabus to use its assessment weights and passing rules. Then enter your scores to see your standing and the score needed on a remaining assessment, such as an exam out of 50.</p>${course.courseKind==='LAB'?'<p class="grade-scope-note">This lab will use its own grading breakdown.</p>':''}</div>`;
 validateGradingScheme(scheme);
 return `<form class="grade-form" data-grade-course="${esc(course.id)}"><p class="grade-source">Source: ${esc(scheme.source)} · Passing target: ${scheme.passingPercentage}%</p>${scheme.components.map(c=>`<label class="grade-row"><span>${esc(c.label)}<small>${c.weight}% of final grade</small></span><span class="grade-score"><input type="number" name="${esc(c.id)}" min="0" max="${c.max}" step="any" inputmode="decimal" aria-label="${esc(c.label)} score" placeholder="—"><small>/ ${c.max}</small></span></label>`).join('')}<label class="grade-target">Calculate the score needed on<select name="gradeTarget">${scheme.components.map(c=>`<option value="${esc(c.id)}">${esc(c.label)} · out of ${c.max}</option>`).join('')}</select></label><output class="grade-result" aria-live="polite">Enter your recorded scores to estimate your grade.</output><p class="grade-scope-note">An estimate using the entered scores and syllabus rules. Your instructor determines the official grade.</p></form>`;
}
