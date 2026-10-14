import {SYLLABUS_GRADING} from './syllabus-data.mjs';
export const COURSE_GRADING_SCHEMES=Object.freeze(SYLLABUS_GRADING);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateGradingScheme(scheme){
 if(!['weighted-percentage','higher-exam-weight'].includes(scheme?.mode)||typeof scheme.source!=='string'||!scheme.source.trim())throw Error('A reviewed syllabus and supported grading method are required.');
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
 if(scheme.mode==='higher-exam-weight'){
  const comparison=scheme.comparison;
  if(!Array.isArray(comparison?.ids)||comparison.ids.length!==2||new Set(comparison.ids).size!==2||!comparison.ids.every(id=>ids.has(id))||comparison.higher!==50||comparison.lower!==35||comparison.ids.reduce((sum,id)=>sum+components.find(c=>c.id===id).weight,0)!==85)throw Error('The exam comparison must specify the verified 50% / 35% pair.');
 }
 const requirementIds=new Set();
 for(const r of scheme.requirements||[]){if(!r||typeof r.id!=='string'||!/^\w+$/.test(r.id)||requirementIds.has(r.id)||typeof r.label!=='string'||!r.label||typeof r.source!=='string'||!r.source)throw Error('Each additional requirement needs a unique ID, description and source.');requirementIds.add(r.id);}
 return scheme;
}
const unknown=value=>value===null||value===undefined||value==='';
function weightsFor(scheme,scores){
 const weights=Object.fromEntries(scheme.components.map(c=>[c.id,c.weight]));
 if(scheme.mode==='higher-exam-weight'){
  const [a,b]=scheme.comparison.ids,ca=scheme.components.find(c=>c.id===a),cb=scheme.components.find(c=>c.id===b);
  if(unknown(scores[a])||unknown(scores[b]))return null;
  const higher=scores[a]/ca.max>=scores[b]/cb.max?a:b,lower=higher===a?b:a;
  weights[higher]=scheme.comparison.higher;weights[lower]=scheme.comparison.lower;
 }
 return weights;
}
function contribution(scheme,scores){const weights=weightsFor(scheme,scores);if(!weights)return null;return scheme.components.reduce((sum,c)=>sum+(unknown(scores[c.id])?0:scores[c.id]/c.max*weights[c.id]),0);}
export function gradeForecast(scheme,scores={},targetId,{requirements={}}={}){
 validateGradingScheme(scheme);
 const target=scheme.components.find(c=>c.id===targetId);if(!target)throw Error('Choose an assessment to calculate its required score.');
 const missing=[];
 for(const c of scheme.components){const score=scores[c.id];if(unknown(score)){missing.push(c.id);continue;}if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>c.max)throw Error(`Enter ${c.label} between 0 and ${c.max}.`);}
 const weights=weightsFor(scheme,scores),recordedWeight=weights?scheme.components.reduce((sum,c)=>sum+(unknown(scores[c.id])?0:weights[c.id]),0):0;
 const total=contribution(scheme,scores),currentAverage=recordedWeight?total/recordedWeight*100:null,currentTotal=missing.length?null:total;
 const states=(scheme.requirements||[]).map(r=>requirements[r.id]);
 const eligibility=states.includes('not-met')?'not-met':states.some(s=>s!=='met')?'unknown':'met';
 const missingOther=missing.filter(id=>id!==target.id),result={currentAverage,currentTotal,recordedWeight,needed:null,possible:null,missingOther,target,passingPercentage:scheme.passingPercentage,eligibility,hasRequirements:states.length>0};
 if(missingOther.length)return result;
 const totalAt=score=>contribution(scheme,{...scores,[target.id]:score});
 const bestTotal=totalAt(target.max),step=target.scoreStep??1;
 let raw;
 if(scheme.mode==='weighted-percentage'){const other=totalAt(0);raw=(scheme.passingPercentage-other)/target.weight*target.max;}
 else{
  if(bestTotal+1e-9<scheme.passingPercentage)return {...result,possible:false,bestTotal};
  let low=0,high=target.max;if(totalAt(0)+1e-9>=scheme.passingPercentage)high=0;
  else for(let i=0;i<70;i++){const mid=(low+high)/2;if(totalAt(mid)>=scheme.passingPercentage)high=mid;else low=mid;}
  raw=high;
 }
 const needed=Math.max(0,Number((Math.ceil((raw-1e-9)/step)*step).toFixed(6)));
 return {...result,needed,possible:needed<=target.max+1e-9,bestTotal};
}
export function gradeForecastText(result){
 const {currentAverage,currentTotal,passingPercentage,needed,possible,target,missingOther}=result;
 const average=currentTotal!==null?`Calculated numeric total: ${currentTotal.toFixed(2)}% — ${currentTotal+1e-9>=passingPercentage?'meets':'below'} the ${passingPercentage}% passing target.`:currentAverage!==null?`Recorded assessments: ${currentAverage.toFixed(2)}% — ${currentAverage+1e-9>=passingPercentage?'above':'below'} the ${passingPercentage}% target so far.`:'Enter your recorded scores to estimate your grade.';
 const conditions=result.eligibility==='not-met'?' You marked an additional syllabus requirement as unmet; this can override a passing numeric score.':result.eligibility==='unknown'?' Additional syllabus requirements are unconfirmed; this is a numeric estimate only.':'';
 if(missingOther.length)return average+' Enter the other assessment scores before calculating an exact required score.'+conditions;
 if(!possible)return average+` Even ${target.max}/${target.max} in ${target.label} would give ${result.bestTotal.toFixed(2)}%, below the passing target.`+conditions;
 return average+` You need at least ${needed}/${target.max} in ${target.label} to reach the numeric ${passingPercentage}% target.`+conditions;
}
export function gradeFormValues(form,scheme){
 const scores={},draft={},target=form.elements.namedItem('gradeTarget').value,requirements={};
 const components=scheme.components.map(c=>{
  const input=form.elements.namedItem(c.id),raw=input.value;draft[c.id]=raw;scores[c.id]=raw===''?null:Number(raw);
  const maxInput=form.elements.namedItem(c.id+'_max'),max=maxInput?Number(maxInput.value):c.max;if(maxInput)draft[c.id+'_max']=maxInput.value;
  input.max=max;
  return {...c,max,scoreStep:c.id===target?Number(form.elements.namedItem('gradeStep').value):c.scoreStep};
 });
 for(const r of scheme.requirements||[]){const name='req_'+r.id;requirements[r.id]=form.elements.namedItem(name).value;draft[name]=requirements[r.id];}
 draft.gradeTarget=target;draft.gradeStep=form.elements.namedItem('gradeStep').value;
 return {scheme:{...scheme,components},scores,target,requirements,draft};
}
export function renderGradeCalculator(course,scheme=COURSE_GRADING_SCHEMES[course.id]){
 if(!scheme)return `<div class="dossier-placeholder grade-pending"><span class="dossier-small-star" aria-hidden="true">✦</span><h4>Awaiting ${course.courseKind==='LAB'?'laboratory':'course'} grading scheme</h4><p>Upload the syllabus to use its assessment weights and passing rules. Then enter your scores to see your standing and the score needed on a remaining assessment, such as an exam out of 50.</p>${course.courseKind==='LAB'?'<p class="grade-scope-note">This lab will use its own grading breakdown.</p>':''}</div>`;
 validateGradingScheme(scheme);
 const compared=id=>scheme.comparison?.ids.includes(id),target=scheme.defaultTarget||scheme.components.at(-1).id;
 const rows=scheme.components.map(c=>`<label class="grade-row"><span>${esc(c.label)}<small>${compared(c.id)?'35% or 50%':c.weight+'%'} of final grade</small></span><span class="grade-score"><input type="number" name="${esc(c.id)}" min="0" max="${c.max}" step="any" inputmode="decimal" aria-label="${esc(c.label)} score" placeholder="—"><span aria-hidden="true">/</span>${c.raw?`<input class="grade-max" type="number" name="${esc(c.id)}_max" value="${c.max}" min="0.01" step="any" inputmode="decimal" aria-label="${esc(c.label)} maximum score">`:`<small>${c.max}${c.aggregate?'%':''}</small>`}</span></label>`).join('');
 const required=(scheme.requirements||[]).map(r=>`<label class="grade-requirement"><span>${esc(r.label)}</span><select name="req_${esc(r.id)}" aria-label="${esc(r.label)}"><option value="">Not checked</option><option value="met">Met</option><option value="not-met">Not met</option></select></label>`).join('');
 return `<form class="grade-form" data-grade-course="${esc(course.id)}"><p class="grade-source">Numeric passing target: <strong>${scheme.passingPercentage}%</strong></p><p class="grade-scope-note">Use percentages for category averages. For a single assessment, change the total to match your exam (for example, 32 / 50). Leave unknown scores blank.</p><fieldset class="grade-assessments"><legend>Recorded scores</legend>${rows}</fieldset><fieldset class="grade-planning"><legend>Plan a remaining assessment</legend><label class="grade-target">Calculate the score needed on<select name="gradeTarget">${scheme.components.map(c=>`<option value="${esc(c.id)}" ${c.id===target?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label><label class="grade-target">Score precision<select name="gradeStep"><option value="1">Whole points / percentage points</option><option value="0.5">Half points</option><option value="0.1">Tenths</option><option value="0.01">Hundredths</option></select></label></fieldset>${required?'<details class="grade-requirements" open><summary>Other passing requirements</summary><p class="grade-scope-note">Self-reported checks; your instructor handles exceptions and final eligibility.</p>'+required+'</details>':''}<output class="grade-result" aria-live="polite">Enter your recorded scores to estimate your grade.</output><details class="course-source"><summary>Grading notes</summary>${scheme.note?'<p class="grade-policy">'+esc(scheme.note)+'</p>':''}<p>Use your instructor’s aggregation method and adjusted scores. Required-score rounding is a planning choice. Bonuses, penalties and official rounding are not applied automatically.</p><p>Your instructor determines the official grade. This estimate never records course completion.</p></details></form>`;
}
