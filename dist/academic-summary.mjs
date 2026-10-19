import {COURSE_BY_ID} from './curriculum.mjs';
import {NON_MAJOR_BY_ID} from './non-major-courses.mjs';
import {normalizeNonMajorRecords} from './non-major-checklist.mjs';
import {normalizeAdvisingNonMajor} from './advising-import.mjs';
import {bookletGradeLabel} from './advising-grade.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function academicSummaryRows(progress){
 const majors=Object.entries(progress.academicRecords).flatMap(([id,r])=>{
  const c=COURSE_BY_ID[id];if(!c)return [];
  const grades=r.gradeAttempts||[],rows=grades.map(a=>({code:id,title:c.title,units:c.units,term:a.term,grade:bookletGradeLabel(a),status:a.outcome==='PASSED'?'Passed':'Not passed',outcome:a.outcome}));
  if(!rows.length||r.status==='ACTIVE'&&!grades.some(a=>a.term===r.takenInTerm))rows.push({code:id,title:c.title,units:c.units,term:r.takenInTerm??c.term,grade:'—',status:r.status==='COMPLETED'?'Completed':r.status==='FAILED'?'Not passed':'Active',outcome:r.status==='COMPLETED'?'PASSED':r.status==='FAILED'?'FAILED':'ACTIVE'});
  return rows;
 }).sort((a,b)=>a.term-b.term||a.code.localeCompare(b.code));
 const history=normalizeAdvisingNonMajor(progress.advisingNonMajor),nonMajors=history.map(r=>({code:r.code,title:r.title,units:r.units,term:r.term,grade:bookletGradeLabel(r),status:r.outcome==='PASSED'?'Passed':'Not passed',outcome:r.outcome}));
 for(const [id,r]of Object.entries(normalizeNonMajorRecords(progress.nonMajorRecords))){if(!r.taken||history.some(h=>h.targetId===id))continue;const c=NON_MAJOR_BY_ID[id];nonMajors.push({code:r.code||c.code,title:r.title||c.title,units:c.units,term:(r.year-1)*3+r.term,grade:'—',status:'Taken',outcome:'TAKEN'});}
 return {majors,nonMajors:nonMajors.sort((a,b)=>a.code.localeCompare(b.code)||a.term-b.term)};
}
export function renderAcademicSummary(progress){
 const {majors,nonMajors}=academicSummaryRows(progress);
 const table=(rows,major)=>rows.length?`<div class="advising-table-scroll" tabindex="0" role="region" aria-label="${major?'Major courses by journey term':'Non-major course records'}"><table class="advising-table"><thead><tr><th scope="col">Subject</th><th scope="col">Course title</th><th scope="col">Units</th><th scope="col">Year / term</th><th scope="col">Grade</th><th scope="col">Record</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${esc(r.code)}</th><td>${esc(r.title)}</td><td>${r.units}</td><td>Year ${Math.ceil(r.term/3)} · Term ${(r.term-1)%3+1}${major?'<small>Journey term '+r.term+'</small>':''}</td><td class="advising-grade" data-outcome="${r.outcome}">${esc(r.grade)}</td><td>${r.status}</td></tr>`).join('')}</tbody></table></div>`:'<p class="card-note">No subjects recorded yet.</p>';
 return `<section class="academic-summary"><h2>Subjects taken</h2><p class="card-note">Final grades, retakes and active subjects in your journey. Records are self-reported; a failed attempt stays visible after a retake.</p><h3>Major courses <span>${majors.length} records · ordered by term</span></h3>${table(majors,true)}<h3>Non-major courses <span>${nonMajors.length} records</span></h3>${table(nonMajors,false)}</section>`;
}
