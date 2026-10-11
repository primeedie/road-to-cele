import { COURSE_BY_ID } from './curriculum.mjs';
import { requiredCourses, progressSummary, courseAccess } from './progression.mjs';

// Presentation only: every reward is derived from saved academic records.
export function completionMoment(before,after,id){
 if(before.academicRecords[id]?.status==='COMPLETED'||after.academicRecords[id]?.status!=='COMPLETED')return null;
 const required=requiredCourses(after),course=COURSE_BY_ID[id];
 if(!required.some(c=>c.id===id))return null;
 const term=required.filter(c=>c.term===course.term);
 return {id,term:course.term,termComplete:term.every(c=>after.academicRecords[c.id]?.status==='COMPLETED'),academic:progressSummary(after).academic,
  newlyAvailable:required.filter(c=>!after.academicRecords[c.id]&&!courseAccess(before,c.id).allowed&&courseAccess(after,c.id).allowed).map(c=>c.id)};
}
