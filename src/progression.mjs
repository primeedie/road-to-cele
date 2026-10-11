import { COURSES, COURSE_BY_ID, SPECIALIZATIONS, MASTERY_SCOPE } from './curriculum.mjs';
import { defaultCosmetics } from './cosmetics.mjs';
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
export function courseAccess(p,id,{preview=false}={}) {
 const c=COURSE_BY_ID[id]; if(!c) return {allowed:false,reason:'Unknown course'};
 if(preview) return {allowed:false,reason:'Preview Mode is for exploration only.'};
 if(c.specialization && selected(p)!==c.specialization) return {allowed:false,reason:selected(p) ? 'This branch is preview-only. Your academic path is '+selected(p)+'.' : 'Confirm your accepted specialization from Year 3 before activating a specialist course.'};
 if(p.academicYear<c.year) return {allowed:false,reason:'This course opens in Year '+c.year+'. You can explore it now.'};
 const complete=id=>p.academicRecords[id]?.status==='COMPLETED';
 const begun=id=>['ACTIVE','COMPLETED'].includes(p.academicRecords[id]?.status);
 const missingHard=c.hardPrerequisites.filter(id=>!complete(id));
 const missingSoft=c.softPrerequisites.filter(id=>!begun(id));
 const missingCo=c.corequisites.filter(id=>!begun(id));
 if(missingHard.length || missingSoft.length || missingCo.length) return {allowed:false,reason:'Prerequisites are not yet met.',missingHard,missingSoft,missingCo};
 return {allowed:true,reason:'Available on your academic path.'};
}
export function setAcademicYear(p,year) { if(![1,2,3,4].includes(year))throw Error('Invalid year');const n=clone(p); n.academicYear=year;return n; }
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
 const access=courseAccess(p,id,{preview});if(!access.allowed)throw Error(access.reason);
 const n=clone(p);const old=n.academicRecords[id] || {events:[]};
 n.academicRecords[id]={...old,status,events:[...old.events,{status,at,method:'SELF_REPORTED',specialization:selected(p)}]};return n;
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
