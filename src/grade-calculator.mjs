import {isQuizComponent,quizRows,quizEntries,averageQuizEntries} from './quiz-scores.mjs';
import {SYLLABUS_GRADING} from './syllabus-data.mjs';
import {SYLLABUS_GRADE_SCALES,validateGradeScale,gradePoint,gradeThreshold} from './grade-scale.mjs';
export const COURSE_GRADING_SCHEMES=Object.freeze(Object.fromEntries(Object.entries(SYLLABUS_GRADING).map(([id,s])=>[id,{...s,gradeScale:SYLLABUS_GRADE_SCALES[id]}])));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateGradingScheme(scheme){
 if(!['weighted-percentage','higher-exam-weight'].includes(scheme?.mode)||typeof scheme.source!=='string'||!scheme.source.trim())throw Error('A reviewed syllabus and supported grading method are required.');
 if(!Number.isFinite(scheme.passingPercentage)||scheme.passingPercentage<=0||scheme.passingPercentage>100)throw Error('The syllabus must specify a valid passing percentage.');
 if(scheme.transmutation||scheme.extraPassingConditions?.length)throw Error('This syllabus has additional grading rules that must be supported before calculating a passing score.');
 if(scheme.gradeScale)validateGradeScale(scheme.gradeScale,scheme.passingPercentage);
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
export function gradeForecast(scheme,scores={},targetId,{requirements={},targetGrade=null}={}){
 validateGradingScheme(scheme);
 const target=scheme.components.find(c=>c.id===targetId);if(!target)throw Error('Choose an assessment to calculate its required score.');
 const missing=[];
 for(const c of scheme.components){const score=scores[c.id];if(unknown(score)){missing.push(c.id);continue;}if(typeof score!=='number'||!Number.isFinite(score)||score<0||(!c.allowBonus&&score>c.max))throw Error(`Enter ${c.label} between 0 and ${c.max}.`);}
 const weights=weightsFor(scheme,scores),recordedWeight=weights?scheme.components.reduce((sum,c)=>sum+(unknown(scores[c.id])?0:weights[c.id]),0):0;
 const total=contribution(scheme,scores),currentAverage=recordedWeight?total/recordedWeight*100:null,currentTotal=missing.length?null:total;
 const states=(scheme.requirements||[]).map(r=>requirements[r.id]);
 const eligibility=states.includes('not-met')?'not-met':states.some(s=>s!=='met')?'unknown':'met';
 const targetPercentage=targetGrade===null?scheme.passingPercentage:gradeThreshold(scheme.gradeScale,targetGrade);
 const numericGrade=currentTotal===null||!scheme.gradeScale?null:gradePoint(scheme.gradeScale,currentTotal);
 const outcome=currentTotal===null?'INCOMPLETE':eligibility==='unknown'?'UNCONFIRMED':eligibility==='not-met'||currentTotal+1e-9<scheme.passingPercentage?'FAILED':'PASSED';
 const missingOther=missing.filter(id=>id!==target.id),result={currentAverage,currentTotal,earnedTotal:recordedWeight?total:null,recordedWeight,numericGrade,grade:outcome==='FAILED'?0:outcome==='PASSED'?numericGrade:null,outcome,targetPercentage,targetGrade,needed:null,possible:null,missingOther,target,passingPercentage:scheme.passingPercentage,eligibility,hasRequirements:states.length>0};
 if(missingOther.length)return result;
 const totalAt=score=>contribution(scheme,{...scores,[target.id]:score});
 const bestTotal=totalAt(target.max),step=target.scoreStep??1;
 let raw;
 if(scheme.mode==='weighted-percentage'){const other=totalAt(0);raw=(targetPercentage-other)/target.weight*target.max;}
 else{
  if(bestTotal+1e-9<targetPercentage&&!target.allowBonus)return {...result,possible:false,bestTotal};
  let low=0,high=target.max;if(target.allowBonus)while(totalAt(high)<targetPercentage)high*=2;if(totalAt(0)+1e-9>=targetPercentage)high=0;
  else for(let i=0;i<70;i++){const mid=(low+high)/2;if(totalAt(mid)>=targetPercentage)high=mid;else low=mid;}
  raw=high;
 }
 const needed=Math.max(0,Number((Math.ceil((raw-1e-9)/step)*step).toFixed(6)));
 return {...result,needed,possible:needed<=target.max+1e-9,bestTotal};
}
export function gradeForecastText(result){
 const {currentAverage,currentTotal,passingPercentage,needed,possible,target,missingOther,targetPercentage=passingPercentage,targetGrade}=result;
 const average=currentTotal!==null?`Calculated numeric total: ${currentTotal.toFixed(2)}% — ${currentTotal+1e-9>=passingPercentage?'meets':'below'} the ${passingPercentage}% passing target.${result.grade!==null&&result.grade!==undefined?' Course grade: '+Number(result.grade).toFixed(1)+'.':''}`:result.earnedTotal!==null&&result.earnedTotal!==undefined?`Weighted points earned so far: ${result.earnedTotal.toFixed(2)} out of 100; ${100-result.recordedWeight}% of the course is still unrecorded.`:'Enter your recorded scores to estimate your grade.';
 const conditions=result.eligibility==='not-met'?' You marked an additional syllabus requirement as unmet; this can override a passing numeric score.':result.eligibility==='unknown'?' Additional syllabus requirements are unconfirmed; this is a numeric estimate only.':'';
 if(missingOther.length)return average+' Enter the other assessment scores before calculating an exact required score.'+conditions;
 if(!possible&&target.allowBonus&&needed!==null)return average+` Reaching the target would need ${needed}/${target.max} in ${target.label}, including ${(needed-target.max).toFixed(2)} points above the perfect score. Those bonus points must actually be awarded.`+conditions;
 if(!possible)return average+` Even ${target.max}/${target.max} in ${target.label} would give ${result.bestTotal.toFixed(2)}%, below the passing target.`+conditions;
 return average+` You need at least ${needed}/${target.max} in ${target.label} to reach the numeric ${targetPercentage}% target${targetGrade===null||targetGrade===undefined?'':' for '+Number(targetGrade).toFixed(1)}.`+conditions;
}
export function renderGradeForecast(result){
 const {currentTotal,passingPercentage,needed,possible,target,missingOther,eligibility,targetPercentage=passingPercentage,targetGrade}=result;
 const value=currentTotal??result.earnedTotal,known=value!==null;
 const tone=eligibility==='not-met'?'warning':!known||currentTotal===null?'neutral':value+1e-9>=passingPercentage?'positive':'warning';
 const standing=!known?'Add your recorded scores':currentTotal!==null?(value+1e-9>=passingPercentage?'meets':'below')+' the '+passingPercentage+'% numeric target':result.recordedWeight+'% assessed · '+(100-result.recordedWeight)+'% remaining';
 const exact=!missingOther.length&&needed!==null;
 const required=exact?esc(needed)+'<small>/'+esc(target.max)+'</small>':'—';
 const targetTone=!exact?'neutral':possible===false?'warning':'accent';
 const note=missingOther.length?'Fill in the other categories to calculate the required score.':possible===false&&target.allowBonus?'Requires '+(needed-target.max).toFixed(2)+' points above full marks. Count them only if awarded.':possible===false?'Full marks would give '+result.bestTotal.toFixed(2)+'%, below the selected target.':needed===0?'Your other scores cover the numeric target. Complete any required assessments.':'To reach '+(targetGrade===null||targetGrade===undefined?'the passing grade':Number(targetGrade).toFixed(1))+' ('+targetPercentage+'%).';
 const conditions=eligibility==='not-met'?'<span class="grade-condition-note" data-tone="warning">An additional passing requirement is unmet. A passing numeric score alone is insufficient.</span>':eligibility==='unknown'?'<span class="grade-condition-note" data-tone="warning">Additional passing requirements are still unconfirmed.</span>':'';
 const actual=result.numericGrade===null||result.numericGrade===undefined?'':`<span class="grade-course-outcome" data-tone="${result.outcome==='FAILED'?'warning':result.outcome==='PASSED'?'positive':'neutral'}"><span>Course grade</span><strong>${result.outcome==='UNCONFIRMED'?'—':Number(result.grade).toFixed(1)}</strong><span>${result.outcome==='FAILED'?'Not passed':result.outcome==='PASSED'?'Passed':'Confirm passing requirements'} · ${result.saved?'confirmed term result':'calculated, not saved'}</span></span>`;
 return `<span class="grade-result-grid"><span class="grade-stat" data-tone="${tone}"><span class="grade-stat-label">${currentTotal!==null?'Final course total':'Earned toward final grade'}</span><strong class="grade-stat-value">${known?value.toFixed(2)+'<small>%</small>':'—'}</strong><span class="grade-stat-context">${standing}</span></span><span class="grade-stat" data-tone="${targetTone}"><span class="grade-stat-label">Required score</span><strong class="grade-stat-value">${required}</strong><span class="grade-stat-context">${esc(target.label)}</span></span></span><span class="grade-result-note">${note}</span>${actual}${conditions}`;
}
export function gradeDraftValues(draft,scheme){
 const scores={},requirements={},target=draft.gradeTarget||scheme.defaultTarget||scheme.components.at(-1).id;
 const step=Number(draft.gradeStep??1);if(![1,.5,.1,.01].includes(step))throw Error('Choose a supported score rounding increment.');
 const components=scheme.components.map(c=>{
  if(isQuizComponent(c)){
   const count=Number(draft['quiz_count_'+c.id]??0);if(!Number.isInteger(count)||count<0||count>50)throw Error('Invalid quiz count.');
   scores[c.id]=averageQuizEntries(Array.from({length:count},(_,i)=>({score:draft['quiz_'+c.id+'_'+i+'_score']??'',max:draft['quiz_'+c.id+'_'+i+'_max']??''})));
   return {...c,max:100,allowBonus:true,scoreStep:c.id===target?step:c.scoreStep};
  }
  const raw=draft[c.id];scores[c.id]=unknown(raw)?null:Number(raw);
  return {...c,max:c.id==='final'?Number(draft.final_max??100):100,allowBonus:c.id==='final',scoreStep:c.id===target?step:c.scoreStep};
 });
 for(const r of scheme.requirements||[])requirements[r.id]=draft['req_'+r.id]||'';
 return {scheme:{...scheme,components},scores,target,requirements,targetGrade:draft.targetGrade===undefined?null:Number(draft.targetGrade),draft};
}
export function gradeFormValues(form,scheme){
 const scores={},draft={},target=form.elements.namedItem('gradeTarget').value,requirements={};
 for(const field of form.querySelectorAll('input[name],select[name]'))draft[field.name]=field.value;
 const components=scheme.components.map(c=>{
  if(isQuizComponent(c)){
   const entries=quizEntries(form,c.id),average=averageQuizEntries(entries);scores[c.id]=average;
   const output=form.elements.namedItem(c.id);output.value=average===null?'Awaiting quiz scores':average.toFixed(2)+'%';
   form.querySelectorAll('[data-quiz-rows="'+c.id+'"] [data-quiz-row]').forEach((row,i)=>{const e=entries[i],bonus=e.score!==''&&e.max!==''?Number(e.score)-Number(e.max):0;row.querySelector('[data-quiz-bonus]').textContent=bonus>0?'+'+bonus+' bonus points':'';});
   return {...c,max:100,allowBonus:true,scoreStep:c.id===target?Number(form.elements.namedItem('gradeStep').value):c.scoreStep};
  }
  const raw=form.elements.namedItem(c.id).value;scores[c.id]=raw===''?null:Number(raw);
  const max=c.id==='final'?Number(form.elements.namedItem('final_max').value):100;
  if(c.id==='final')form.querySelector('[data-final-percentage]').textContent=raw!==''&&max>0&&Number.isFinite(Number(raw)/max)?(Number(raw)/max*100).toFixed(2)+'%':'Awaiting exam scores';
  return {...c,max,allowBonus:c.id==='final',scoreStep:c.id===target?Number(form.elements.namedItem('gradeStep').value):c.scoreStep};
 });
 for(const r of scheme.requirements||[])requirements[r.id]=form.elements.namedItem('req_'+r.id).value;
 return {scheme:{...scheme,components},scores,target,requirements,targetGrade:form.elements.namedItem('targetGrade')?Number(form.elements.namedItem('targetGrade').value):null,draft};
}
export function renderGradeCalculator(course,scheme=COURSE_GRADING_SCHEMES[course.id],{draft={},term=null,saved=null,readOnly=false}={}){
 if(!scheme)return '<div class="dossier-placeholder grade-pending"><h4>Awaiting '+(course.courseKind==='LAB'?'laboratory':'course')+' grading scheme</h4><p>Upload the syllabus to use its assessment weights and passing rules.</p></div>';
 validateGradingScheme(scheme);
 const compared=id=>scheme.comparison?.ids.includes(id),target=scheme.defaultTarget||scheme.components.at(-1).id;
 const rows=scheme.components.map(c=>{
  const weight=(compared(c.id)?'35% or 50%':c.weight+'%')+' of final grade';
  if(isQuizComponent(c)){
   const count=Math.max(0,Math.min(50,Number(draft['quiz_count_'+c.id])||0)),entries=Array.from({length:count},(_,i)=>({score:draft['quiz_'+c.id+'_'+i+'_score']??'',max:draft['quiz_'+c.id+'_'+i+'_max']??''}));
   return '<section class="grade-quiz-category"><h4>'+esc(c.label)+'</h4><small>'+weight+'</small><input type="hidden" name="quiz_count_'+c.id+'" value="'+count+'"><div data-quiz-rows="'+c.id+'">'+quizRows(c,entries)+'</div><button type="button" class="grade-add-quiz" data-add-quiz="'+c.id+'">+ Add quiz</button><div class="grade-quiz-average"><span>Quiz average</span><output name="'+c.id+'">Awaiting quiz scores</output></div></section>';
  }
  return '<label class="grade-row"><span>'+esc(c.id==='final'?'Final Exam':c.label)+'<small>'+weight+'</small></span><span class="grade-score"><input type="number" name="'+c.id+'" min="0" '+(c.id==='final'?'':'max="100"')+' step="any" inputmode="decimal" aria-label="'+esc(c.label)+' score" placeholder="Score"><span aria-hidden="true">/</span>'+(c.id==='final'?'<input class="grade-max" type="number" name="final_max" value="100" min="0.01" step="any" inputmode="decimal" aria-label="Final examination perfect score">':'<small>100</small>')+'</span>'+(c.id==='final'?'<output class="grade-fe-average" data-final-percentage>Awaiting exam scores</output>':'')+'</label>';
 }).join('');
 const required=(scheme.requirements||[]).map(r=>'<label class="grade-requirement"><span>'+esc(r.label)+'</span><select name="req_'+r.id+'" aria-label="'+esc(r.label)+'"><option value="">Not checked</option><option value="met">Met</option><option value="not-met">Not met</option></select></label>').join('');
 const targets=scheme.gradeScale?'<label class="grade-target">Target course grade<select name="targetGrade">'+scheme.gradeScale.bands.map(b=>'<option value="'+b.grade+'">'+b.grade.toFixed(1)+' · '+b.minimum+'%</option>').join('')+'</select></label>':'';
 const summary=saved?'<div class="grade-saved-summary" data-tone="'+(saved.outcome==='PASSED'?'positive':'warning')+'"><span>Confirmed · '+esc(termLabel(saved.term))+'</span><strong>'+saved.grade.toFixed(1)+'</strong><span>'+saved.total.toFixed(2)+'% · '+(saved.outcome==='PASSED'?'Passed':'Not passed')+'</span><small>Self-reported term grade</small></div>':'';
 const save=term===null?'':readOnly?'<button type="button" class="secondary grade-edit" data-edit-grades>Edit this term’s saved grades</button>':'<div class="grade-confirmation"><label><input type="checkbox" name="gradeConfirmed">I confirm these are my final scores for '+esc(termLabel(term))+'.</label><button type="button" class="primary" data-save-grades disabled>Confirm and save term grade</button><p class="grade-save-status" role="status">Complete all categories and passing checks before saving.</p></div>';
 return '<form class="grade-form" data-grade-course="'+course.id+'" data-grade-term="'+(term??'')+'" data-grade-readonly="'+readOnly+'">'+summary+'<p class="grade-source">Numeric passing target: <strong>'+scheme.passingPercentage+'%</strong></p><p class="grade-scope-note">Quiz percentages average equally; awarded bonuses count as entered. Other requirements use averages out of 100.</p><fieldset class="grade-assessments" '+(readOnly?'disabled':'')+'><legend>Recorded scores'+(term===null?'':' · '+esc(termLabel(term)))+'</legend>'+rows+'</fieldset><fieldset class="grade-planning"><legend>Plan an assessment</legend>'+targets+'<label class="grade-target">Assessment<select name="gradeTarget">'+scheme.components.map(c=>'<option value="'+c.id+'" '+(c.id===target?'selected':'')+'>'+esc(c.label)+'</option>').join('')+'</select></label><details class="grade-settings"><summary>Score rounding</summary><label class="grade-target">Round the required score up to<select name="gradeStep"><option value="1">Whole points</option><option value="0.5">Half points</option><option value="0.1">Tenths</option><option value="0.01">Hundredths</option></select></label></details></fieldset>'+(required?'<details class="grade-requirements" open><summary>Other passing requirements</summary><p class="grade-scope-note">Self-reported checks; your instructor handles exceptions and final eligibility.</p><fieldset '+(readOnly?'disabled':'')+'>'+required+'</fieldset></details>':'')+'<output class="grade-result" aria-live="polite">Enter your recorded scores to estimate your grade.</output>'+save+'<details class="course-source"><summary>Grading notes</summary>'+(scheme.note?'<p class="grade-policy">'+esc(scheme.note)+'</p>':'')+'<p>Unrounded totals use the course’s grade thresholds. Required-score rounding is a planning choice; it does not round your course grade. Your instructor determines the official grade.</p><p>Only confirmed term grades update your academic record. Drafts and target-grade choices do not.</p></details></form>';
}
export const termLabel=term=>'Year '+Math.ceil(term/3)+' · Term '+((term-1)%3+1)+' (journey term '+term+')';
