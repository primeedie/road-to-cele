export const IMPORT_METHOD='BOOKLET_IMPORT';
export const bookletGradeLabel=a=>a.gradeText||(a.grade===null?'P':Number(a.grade).toFixed(1));
export const isBookletAttempt=a=>a?.method===IMPORT_METHOD;
export function validBookletAttempt(a){
 return a&&Number.isInteger(a.term)&&a.term>=1&&a.term<=60&&a.total===null&&a.draft===null&&typeof a.confirmedAt==='string'&&a.confirmedAt.length<=40&&Array.isArray(a.revisions)&&a.revisions.length<=60&&['PASSED','FAILED'].includes(a.outcome)&&((a.grade===null&&a.gradeText==='P'&&a.outcome==='PASSED')||[0,1,1.5,2,2.5,3,3.5,4].includes(a.grade)&&a.outcome===(a.grade>=1?'PASSED':'FAILED'));
}
