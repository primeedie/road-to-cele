import {COURSE_BY_ID,COURSES} from './curriculum.mjs';
import {COURSE_GRADING_SCHEMES,gradeDraftValues,gradeForecast,termLabel} from './grade-calculator.mjs';
import {isBookletAttempt,bookletGradeLabel} from './advising-grade.mjs';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const courseGradeAttempts=(p,id)=>[...(p.academicRecords[id]?.gradeAttempts||[])].sort((a,b)=>a.term-b.term);
export const latestCourseGrade=(p,id)=>courseGradeAttempts(p,id).at(-1)||null;
export const attemptTerm=(p,id)=>p.academicRecords[id]?.takenInTerm??p.academicTerm??(p.academicYear-1)*3+1;
export function evaluateGradeDraft(id,draft,{scheme=COURSE_GRADING_SCHEMES[id]}={}){
 if(!scheme?.gradeScale)throw Error('This course needs a verified grading scheme and grade table.');
 const values=gradeDraftValues(draft,scheme);
 // The actual outcome always uses the syllabus passing grade, never the planning target.
 return {...values,result:gradeForecast(values.scheme,values.scores,values.target,{requirements:values.requirements})};
}
export function saveCourseGrade(p,id,{term,draft,confirmed=false,correction=false,preview=false,admin=false,at=new Date().toISOString()}={}){
 if(!confirmed)throw Error('Confirm that these are your final scores for this subject and term.');
 if(preview)throw Error('Preview courses cannot save academic grades.');
 const course=COURSE_BY_ID[id],record=p.academicRecords[id];
 if(!course||!record||!['ACTIVE','COMPLETED','FAILED'].includes(record.status))throw Error('Activate this course before saving its grade.');
 if(course.specialization&&p.specializationProgression.selectedSpecialization!==course.specialization&&!admin)throw Error('This course is outside your selected academic path.');
 if(!Number.isInteger(term)||term<1||term>60)throw Error('Choose a valid journey term.');
 const attempts=courseGradeAttempts(p,id),old=attempts.find(a=>a.term===term);
 if(isBookletAttempt(old))throw Error('This is an imported final grade without assessment scores. Correct it by reviewing a new booklet import.');
 if(!old&&term!==attemptTerm(p,id))throw Error('Save grades to the term in which this attempt was activated.');
 if(old&&!correction)throw Error('This term already has a confirmed grade. Choose Edit to correct it.');
 if(!old&&attempts.some(a=>a.outcome==='PASSED'))throw Error('A passing attempt is already recorded.');
 const {result,scheme,scores,requirements}=evaluateGradeDraft(id,draft,{scheme:old?.schemeSnapshot||COURSE_GRADING_SCHEMES[id]});
 if(result.currentTotal===null)throw Error('Enter every assessment category before confirming the term grade.');
 if(result.eligibility==='unknown')throw Error('Check all additional passing requirements before confirming the term grade.');
 const {revisions:priorRevisions,...priorSnapshot}=old||{};
 const attempt={term,total:result.currentTotal,grade:result.grade,outcome:result.outcome,numericGrade:result.numericGrade,scores,requirements,draft:structuredClone(draft),schemeSnapshot:JSON.parse(JSON.stringify(scheme)),confirmedAt:at,method:'SELF_REPORTED',source:scheme.source,gradeSource:scheme.gradeScale.source,revisions:old?[...(priorRevisions||[]),priorSnapshot]:[]};
 const next=structuredClone(p),grades=[...attempts.filter(a=>a.term!==term),attempt].sort((a,b)=>a.term-b.term),latest=grades.at(-1);
 const passed=grades.some(a=>a.outcome==='PASSED');
 // Correcting an older attempt must not close a currently active later retake.
 const status=passed?'COMPLETED':record.status==='ACTIVE'&&record.takenInTerm>latest.term?'ACTIVE':'FAILED';
 next.academicRecords[id]={...record,status,gradeAttempts:grades,events:[...(record.events||[]),{status,term,at,method:'CONFIRMED_TERM_GRADE',grade:attempt.grade}]};
 return next;
}
export function renderGradeHistory(p,id,{selectedTerm=attemptTerm(p,id)}={}){
 const attempts=courseGradeAttempts(p,id),latest=attempts.at(-1),record=p.academicRecords[id];
 const nextTerm=Math.max((latest?.term??0)+1,p.academicTerm??(p.academicYear-1)*3+1);
 const history=attempts.length?'<details class="grade-attempt-history"><summary>Term grades ('+attempts.length+')</summary><div class="grade-attempt-list">'+attempts.map(a=>'<button type="button" data-grade-history="'+a.term+'" aria-pressed="'+(a.term===selectedTerm)+'"><span>'+esc(termLabel(a.term))+'</span><strong class="'+(a.outcome==='PASSED'?'grade-pass':'grade-fail')+'">'+esc(bookletGradeLabel(a))+'</strong><small>'+(a.total===null?'Booklet final grade · ':a.total.toFixed(2)+'% · ')+(a.outcome==='PASSED'?'Passed':'Not passed')+(a.revisions?.length?' · corrected':'')+'</small></button>').join('')+'</div>'+(record?.status==='ACTIVE'&&!attempts.some(a=>a.term===record.takenInTerm)?'<button type="button" class="secondary" data-grade-history="'+record.takenInTerm+'">Current attempt · '+esc(termLabel(record.takenInTerm))+'</button>':'')+'</details>':'';
 const retake=record?.status==='FAILED'&&latest&&latest.term<60?'<div class="grade-retake"><h4>A new term, a fresh attempt</h4><p>Your earlier grade stays in the record. Hard prerequisites require a passing attempt; soft prerequisites recognize that you have taken this course.</p><label>Retake journey term<input type="number" name="retakeTerm" min="'+nextTerm+'" max="60" step="1" value="'+nextTerm+'"></label><button type="button" class="secondary" data-grade-retake>Activate retake</button><small>Updates your current journey term. Confirm actual enrollment and course availability separately.</small></div>':'';
 return history+retake;
}
// A personal schedule, not an assertion about the university's course offerings.
export function personalCoursePlan(p,courses=COURSES){
 const delay={},failedRoots=[],currentTerm=p.academicTerm??(p.academicYear-1)*3+1;
 for(const c of courses){
  const attempts=courseGradeAttempts(p,c.id),failures=attempts.filter(a=>a.outcome==='FAILED'),latest=attempts.at(-1),record=p.academicRecords[c.id];
  if(!failures.length){delay[c.id]=Math.max(0,(record?.takenInTerm??c.term)-c.term);continue;}
  const next=record?.status==='ACTIVE'&&record.takenInTerm>latest.term?record.takenInTerm:latest.outcome==='FAILED'?Math.max(latest.term+1,currentTerm):latest.term;
  delay[c.id]=Math.max(failures.length,next-c.term);failedRoots.push(c.id);
 }
 // Monotone maximum propagation preserves independent soft paths and avoids
 // double-counting convergent chains. Already-started academic records stay put.
 for(let pass=0;pass<courses.length;pass++){
  let changed=false;
  for(const c of courses){if(p.academicRecords[c.id])continue;
   let next=Math.max(delay[c.id]||0,...c.hardPrerequisites.map(id=>delay[id]||0));
   for(const id of c.corequisites){const partner=courses.find(other=>other.id===id);if(partner)next=Math.max(next,partner.term+(delay[id]||0)-c.term);}
   if(next>(delay[c.id]||0)){delay[c.id]=next;changed=true;}
  }
  if(!changed)break;
 }
 const planned=courses.map(c=>{
  const record=p.academicRecords[c.id],latest=latestCourseGrade(p,c.id),failed=record?.status==='FAILED'&&latest;
  const term=failed?Math.max(latest.term+1,currentTerm):record?.takenInTerm??(c.term+(delay[c.id]||0));
  return {...c,originalTerm:c.term,term,year:Math.ceil(term/3),retake:courseGradeAttempts(p,c.id).some(a=>a.outcome==='FAILED'),shifted:term!==c.term};
 });
 const historical=courses.flatMap(c=>courseGradeAttempts(p,c.id).filter(a=>a.outcome==='FAILED'&&a.term!==planned.find(n=>n.id===c.id).term).map(a=>({...c,id:c.id+'~'+a.term,canonicalId:c.id,code:c.id,term:a.term,year:Math.ceil(a.term/3),originalTerm:c.term,archivedAttempt:a,hardPrerequisites:[],softPrerequisites:[],corequisites:[],requiredMastery:false})));
 return {courses:[...planned,...historical],delay,failedRoots};
}
