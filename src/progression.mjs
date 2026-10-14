import { COURSES, COURSE_BY_ID, SPECIALIZATIONS, MASTERY_SCOPE } from './curriculum.mjs';
import { defaultCosmetics } from './cosmetics.mjs';
import {latestCourseGrade,courseGradeAttempts} from './grade-attempts.mjs';
export function newProgress() {
 return { version:3, academicYear:1, specializationProgression:{ selectedSpecialization:null, specializationStatus:'UNDECIDED', confirmedAt:null, confirmationMethod:null, previousSpecializationHistory:[] }, academicRecords:{}, masteryRecords:{}, quizAttempts:[], integrationAssessments:[],cosmetics:defaultCosmetics() };
}
const clone = p => structuredClone(p);
export function selected(p) { return p.specializationProgression.specializationStatus === 'CONFIRMED' ? p.specializationProgression.selectedSpecialization : null; }
export function requiredCourses(p) { const branch=selected(p); return COURSES.filter(c => !c.specialization || c.specialization === branch); }
export function requiredMasteryNodes(p, scope=MASTERY_SCOPE) { return requiredCourses(p).filter(c => c.requiredMastery && (c.specialization ? scope.selectedSpecialization : scope.shared)); }
export function previewBranch(p, branch) {
 if (!SPECIALIZATIONS[branch]) throw Error('Unknown specialization');
 return { branch, active:selected(p) === branch, mode:selected(p) === branch ? 'ACTIVE' : 'PREVIEW', courses:COURSES.filter(c=>c.specialization===branch) };
}
const begun=(p,id)=>['ACTIVE','COMPLETED','FAILED'].includes(p.academicRecords[id]?.status);
// Lecture pairs are enrolled together. Labs retain a directional lecture-first rule.
export function lectureGroup(id) {
 const ids=new Set([id]),pending=[id];
 while(pending.length){const current=pending.pop();
  for(const c of COURSES){if(c.courseKind==='LAB')continue;
   for(const other of c.corequisites){if(COURSE_BY_ID[other].courseKind==='LAB')continue;
    const next=c.id===current?other:other===current?c.id:null;
    if(next&&!ids.has(next)){ids.add(next);pending.push(next);}
   }
  }
 }
 return [...ids];
}
export function dependencyMet(p,id,type,{lab=false}={}) {
 const record=p.academicRecords[id];
 if(type==='H')return record?.status==='COMPLETED'&&(!courseGradeAttempts(p,id).length||courseGradeAttempts(p,id).some(a=>a.outcome==='PASSED'));
 return begun(p,id)&&(!lab||!record.takenInTerm||record.takenInTerm<=currentAcademicTerm(p));
}
export const currentAcademicTerm=p=>p.academicTerm??(p.academicYear-1)*3+1;
export function courseAccess(p,id,{preview=false}={}) {
 const c=COURSE_BY_ID[id]; if(!c) return {allowed:false,reason:'Unknown course'};
 if(preview) return {allowed:false,reason:'Preview Mode is for exploration only.'};
 if(p.academicRecords[id]?.status==='FAILED')return {allowed:false,reason:'A failed term grade is recorded. Activate a retake in a later term from Grades.'};
 if(c.specialization && selected(p)!==c.specialization) return {allowed:false,reason:selected(p) ? 'This branch is preview-only. Your academic path is '+selected(p)+'.' : 'Confirm your accepted specialization from Year 3 before activating a specialist course.'};
 if(p.academicYear<c.year) return {allowed:false,reason:'This course opens in Year '+c.year+'. You can explore it now.'};
 const group=c.courseKind==='LAB'?[id]:lectureGroup(id);
 const missingHard=[],missingSoft=[],missingCo=[];
 for(const member of group){const partner=COURSE_BY_ID[member];
  if(partner.year>p.academicYear||(partner.specialization&&partner.specialization!==selected(p)))return {allowed:false,reason:'The lecture co-requisite is not available on your academic path yet.'};
  missingHard.push(...partner.hardPrerequisites.filter(id=>!dependencyMet(p,id,'H')));
  if(!p.academicRecords[member]){
   const sameTerm=partner.hardPrerequisites.filter(id=>{const passed=courseGradeAttempts(p,id).filter(a=>a.outcome==='PASSED');return passed.length&&Math.min(...passed.map(a=>a.term))>=currentAcademicTerm(p);});
   if(sameTerm.length)return {allowed:false,reason:'The confirmed hard-prerequisite grade must be from an earlier term. Advance your journey term after finishing it.',missingHard:sameTerm};
  }
  missingSoft.push(...partner.softPrerequisites.filter(id=>!dependencyMet(p,id,'S')));
  if(partner.courseKind==='LAB')missingCo.push(...partner.corequisites.filter(id=>!dependencyMet(p,id,'C',{lab:true})));
 }
 if(missingHard.length||missingSoft.length||missingCo.length)return {allowed:false,reason:missingCo.length?'Activate the lecture in this term or an earlier term before its lab.':missingHard.length?'Complete the hard prerequisite courses first.':'Activate or complete the soft prerequisite courses first.',missingHard:[...new Set(missingHard)],missingSoft:[...new Set(missingSoft)],missingCo};
 const coactivate=group.filter(other=>other!==id&&!begun(p,other));
 return {allowed:true,coactivate,reason:coactivate.length?'Activates together with '+coactivate.join(', ')+'.':c.courseKind==='LAB'?'Lecture taken in this term or an earlier term.':'Available on your academic path.'};
}
export function setAcademicYear(p,year) { if(![1,2,3,4].includes(year))throw Error('Invalid year');const n=clone(p); if(year!==p.academicYear)n.academicTerm=(year-1)*3+1;n.academicYear=year;return n; }
export function setAcademicTerm(p,term) {
 if(!Number.isInteger(term)||term<1||term>60||(Math.min(4,Math.ceil(term/3))!==p.academicYear))throw Error('Choose a term in your current academic year');
 const n=clone(p);n.academicTerm=term;return n;
}
export function confirmSpecialization(p,branch,{confirmed=false,method='SELF_REPORTED',at=new Date().toISOString()}={}) {
 if(!confirmed)throw Error('Explicit confirmation required');
 if(method!=='SELF_REPORTED')throw Error('Acceptance must be self-reported');
 if(!SPECIALIZATIONS[branch])throw Error('Unknown specialization');
 if(p.academicYear<3)throw Error('Commitment begins in Year 3');
 if(selected(p))throw Error('Use the separate change-specialization workflow');
 const n=clone(p); n.specializationProgression={...n.specializationProgression,selectedSpecialization:branch,specializationStatus:'CONFIRMED',confirmedAt:at,confirmationMethod:method};return n;
}
export function changeSpecialization(p,branch,{confirmed=false,reason='',at=new Date().toISOString()}={}) {
 if(!confirmed)throw Error('Explicit transfer confirmation required');
 if(!selected(p))throw Error('Confirm an initial specialization first');
 if(!SPECIALIZATIONS[branch] || branch===selected(p))throw Error('Choose a different specialization');
 if(!reason.trim())throw Error('A transfer or correction reason is required');
 const n=clone(p);const r=n.specializationProgression;
 r.previousSpecializationHistory.push({selectedSpecialization:r.selectedSpecialization,confirmedAt:r.confirmedAt,confirmationMethod:r.confirmationMethod,changedAt:at,changedTo:branch,reason:reason.trim()});
 Object.assign(r,{selectedSpecialization:branch,specializationStatus:'CONFIRMED',confirmedAt:at,confirmationMethod:'SELF_REPORTED'});return n;
}
export function recordAcademicProgress(p,id,status,{preview=false,at=new Date().toISOString()}={}) {
 if(!['ACTIVE','COMPLETED'].includes(status))throw Error('Invalid academic status');
 if(latestCourseGrade(p,id)?.outcome==='FAILED'&&status==='COMPLETED')throw Error('Confirm a passing retake grade before recording completion.');
 const access=courseAccess(p,id,{preview});if(!access.allowed)throw Error(access.reason);
 if(p.academicRecords[id]?.status==='COMPLETED'&&status==='ACTIVE')throw Error('This course is already completed');
 const n=clone(p);
 for(const member of [id,...(access.coactivate||[])]){
  const old=n.academicRecords[member]||{events:[]},nextStatus=member===id?status:'ACTIVE';
  n.academicRecords[member]={...old,status:nextStatus,takenInTerm:old.takenInTerm??currentAcademicTerm(p),events:[...(old.events||[]),{status:nextStatus,at,term:currentAcademicTerm(p),method:'SELF_REPORTED',specialization:selected(p)}]};
 }
 return n;
}
export function startCourseRetake(p,id,term,{admin=false,preview=false,at=new Date().toISOString()}={}){
 const latest=latestCourseGrade(p,id);if(p.academicRecords[id]?.status!=='FAILED'||!latest)throw Error('A failed attempt is required before activating a retake.');
 if(!Number.isInteger(term)||term<=latest.term||term>60||term<currentAcademicTerm(p))throw Error('Choose a later term, at or after your current journey term.');
 if(preview)throw Error('Preview courses cannot activate retakes.');
 const next=clone(p);next.academicTerm=term;next.academicYear=Math.min(4,Math.ceil(term/3));
 // Evaluate the ordinary prerequisites against the new term without the failed-status guard.
 next.academicRecords[id]={...next.academicRecords[id],status:'ACTIVE',takenInTerm:term};
 if(!admin){const access=courseAccess(next,id);if(!access.allowed)throw Error(access.reason);
  for(const member of access.coactivate||[])next.academicRecords[member]={...(next.academicRecords[member]||{}),status:'ACTIVE',takenInTerm:term,events:[...(next.academicRecords[member]?.events||[]),{status:'ACTIVE',term,at,method:'SELF_REPORTED'}]};
 }
 next.academicRecords[id].events=[...(p.academicRecords[id].events||[]),{status:'ACTIVE',term,at,method:'RETAKE_ACTIVATION'}];return next;
}
// Assessment services can use this boundary later; no quizzes are implemented in this phase.
export function recordMasteryResult(p,id,{passed,attemptId,preview=false,at=new Date().toISOString()}={}) {
 if(!attemptId || typeof passed!=='boolean')throw Error('Assessment result required');
 const c=COURSE_BY_ID[id]; if(!c)throw Error('Unknown course');
 if(preview || (c.specialization && selected(p)!==c.specialization))throw Error('Preview courses cannot affect mastery');
 const n=clone(p);n.quizAttempts.push({id:attemptId,courseId:id,passed,at,specialization:selected(p)});
 if(passed)n.masteryRecords[id]={mastered:true,at,attemptId};return n;
}
export function progressSummary(p,scope=MASTERY_SCOPE) {
 const academic=requiredCourses(p), mastery=requiredMasteryNodes(p,scope);
 const complete=academic.filter(c=>p.academicRecords[c.id]?.status==='COMPLETED').length;
 const mastered=mastery.filter(c=>p.masteryRecords[c.id]?.mastered).length;
 return { academic:{complete,total:academic.length,percent:Math.round(100*complete/academic.length)},mastery:{complete:mastered,total:mastery.length,percent:mastery.length?Math.round(100*mastered/mastery.length):0}, provisional:!selected(p) };
}
export function gateStatus(p,scope=MASTERY_SCOPE) {
 const summary=progressSummary(p,scope);
 const eligible=!!selected(p) && summary.academic.complete===summary.academic.total && summary.mastery.complete===summary.mastery.total;
 const cleared=p.integrationAssessments.some(a=>a.passed);
 return {eligible,cleared,hardmodeUnlocked:cleared,summary};
}
export function recordIntegrationAssessment(p,{passed,attemptId,at=new Date().toISOString()}={}) {
 if(typeof passed!=='boolean' || !attemptId)throw Error('Integration assessment result required');
 if(!gateStatus(p).eligible)throw Error('Complete the active academic path and required mastery before CIVINCO');
 const n=clone(p);n.integrationAssessments.push({passed,attemptId,at,specializationAtAttempt:selected(p)});return n;
}
