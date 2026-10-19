import {NON_MAJOR_COURSES,NON_MAJOR_BY_ID,NON_MAJOR_MAX_YEAR,nonMajorCourses,validChecklistBatch} from './non-major-courses.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validYear=n=>Number.isInteger(n)&&n>=1&&n<=NON_MAJOR_MAX_YEAR;
const validTerm=n=>Number.isInteger(n)&&n>=1&&n<=3;
const empty=()=>({year:null,term:null,taken:false});
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function normalizeNonMajorRecords(raw){
 const records={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return records;
 for(const c of NON_MAJOR_COURSES){
  if(!Object.hasOwn(raw,c.id))continue;
  const r=raw[c.id];if(!r||typeof r!=='object'||Array.isArray(r))continue;
  const next={year:validYear(r.year)?r.year:null,term:validTerm(r.term)?r.term:null,taken:false};
  next.taken=r.taken===true&&next.year!==null&&next.term!==null;
  if(c.editable){const code=text(r.code,24),title=text(r.title,160);if(code)next.code=code;if(title)next.title=title;}
  if(next.year!==null||next.term!==null||next.code||next.title)records[c.id]=next;
 }
 return records;
}
export function setNonMajorRecord(progress,id,patch){
 if(!Object.hasOwn(NON_MAJOR_BY_ID,id))throw Error('Unknown checklist subject.');const c=NON_MAJOR_BY_ID[id];
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid checklist change.');
 for(const key of Object.keys(patch)){
  if(!['year','term','taken',...(c.editable?['code','title']:[])].includes(key))throw Error('Invalid checklist field.');
  if(key==='year'&&patch.year!==null&&!validYear(patch.year))throw Error('Choose a valid year.');
  if(key==='term'&&patch.term!==null&&!validTerm(patch.term))throw Error('Choose Term 1, 2 or 3.');
  if(key==='taken'&&typeof patch.taken!=='boolean')throw Error('Invalid checklist status.');
  if(['code','title'].includes(key)&&(typeof patch[key]!=='string'||patch[key].length>(key==='code'?24:160)))throw Error('Course name is too long.');
 }
 const records=normalizeNonMajorRecords(progress.nonMajorRecords),record={...empty(),...records[id],...patch};
 if(patch.taken===true&&(!validYear(record.year)||!validTerm(record.term)))throw Error('Choose the year and term before marking this subject as taken.');
 if(record.year===null||record.term===null)record.taken=false;
 const next=structuredClone(progress),clean=normalizeNonMajorRecords({...records,[id]:record});
 if(Object.keys(clean).length)next.nonMajorRecords=clean;else delete next.nonMajorRecords;
 return next;
}
export function setNonMajorBatch(progress,batch){
 if(batch!==null&&!validChecklistBatch(batch))throw Error('Choose ID 119 to ID 128.');
 const next=structuredClone(progress);if(batch===null)delete next.nonMajorBatchId;else next.nonMajorBatchId=batch;return next;
}
export function nonMajorSummary(progress,batch=null){
 const records=normalizeNonMajorRecords(progress.nonMajorRecords);
 return {taken:nonMajorCourses(batch).filter(c=>records[c.id]?.taken).length,total:31};
}
const options=(max,value,label)=>'<option value="">Select</option>'+Array.from({length:max},(_,i)=>`<option value="${i+1}"${value===i+1?' selected':''}>${label} ${i+1}</option>`).join('');
export function renderNonMajorChecklist(progress,{ready=true,admin=false,batch=null,signedIn=false}={}){
 batch=validChecklistBatch(batch)?batch:!signedIn&&validChecklistBatch(progress.nonMajorBatchId)?progress.nonMajorBatchId:null;
 const records=normalizeNonMajorRecords(progress.nonMajorRecords),summary=nonMajorSummary(progress,batch),disabled=ready?'':' disabled';
 return `<header class="checklist-heading"><div class="eyebrow">THE REST OF YOUR JOURNEY${admin?' · ADMIN WORKSPACE':''}</div><h1>Beyond the <em>major.</em></h1><p>Keep track of GE, Lasallian, PE, NSTP and student formation courses. Record when you took each subject, in any order.</p><div class="checklist-progress"><strong>${summary.taken}<span> / ${summary.total} taken</span></strong><progress max="${summary.total}" value="${summary.taken}" aria-label="Non-major subjects marked as taken"></progress></div></header><div class="checklist-batch">${signedIn?`<span>PE sequence: <strong>${batch?'ID '+batch:'choose your batch in Account'}</strong></span>`:`<label>Batch for PE subjects<select data-checklist-batch aria-label="Batch for PE subjects"${disabled}><option value="">Choose batch</option>${Array.from({length:10},(_,i)=>119+i).map(n=>`<option value="${n}"${batch===n?' selected':''}>ID ${n}</option>`).join('')}</select></label>`}<small>${batch?batch<=122?'GEFTWEL · GEDANCE · GESPORTS · GETEAMS':'PE1CRDO · PE2FTEX · PE 3 · PE 4':'Choose a batch to show the four matching PE subjects.'}</small></div><p id="checklist-guide" class="checklist-guide">Choose the year and term, then tick Taken. These are your own records; they do not change the technical-course tree or prerequisites.</p>${!ready?'<p class="checklist-notice" role="status">Finish loading or choosing your account journey before editing.</p>':''}<div class="checklist-table-wrap"><table class="non-major-table" aria-describedby="checklist-guide"><caption class="sr-only">Non-major course checklist, with year taken and term for each subject</caption><thead><tr><th scope="col">Taken</th><th scope="col">Subject</th><th scope="col">Course title</th><th scope="col">Units</th><th scope="col">Year taken</th><th scope="col">Term</th></tr></thead><tbody>${nonMajorCourses(batch).map(c=>{
 const r=records[c.id]||empty(),code=r.code||c.code,title=r.title||c.title,status=r.taken?'Taken':r.year&&r.term?'Ready to mark':'Not recorded';
 return `<tr data-checklist-row="${c.id}" class="${r.taken?'is-taken':''}"><td class="checklist-taken" data-label="Taken"><label><input type="checkbox" data-non-major="${c.id}" data-field="taken" aria-label="Mark ${esc(code)} as taken"${r.taken?' checked':''}${!ready||!r.year||!r.term?' disabled':''}><small>${status}</small></label></td><th scope="row" class="checklist-code">${esc(code)}</th><td class="checklist-title">${esc(title)}${c.editable?`<details class="checklist-edit"><summary>Name this course</summary><div><label>Course code<input type="text" maxlength="24" data-non-major="${c.id}" data-field="code" value="${esc(r.code||'')}" placeholder="${c.id.startsWith('GE')?'Actual elective code':'Actual PE code'}"${disabled}></label><label>Course title<input type="text" maxlength="160" data-non-major="${c.id}" data-field="title" value="${esc(r.title||'')}" placeholder="Actual course title"${disabled}></label></div></details>`:''}</td><td class="checklist-units" data-label="Units">${c.parenthesized?'('+c.units+')':c.units}</td><td class="checklist-year" data-label="Year taken"><select data-non-major="${c.id}" data-field="year" aria-label="Year taken for ${esc(code)}"${disabled}>${options(NON_MAJOR_MAX_YEAR,r.year,'Year')}</select></td><td class="checklist-term" data-label="Term"><select data-non-major="${c.id}" data-field="term" aria-label="Term taken for ${esc(code)}"${disabled}>${options(3,r.term,'Term')}</select></td></tr>`;
 }).join('')}</tbody></table></div><p class="checklist-footnote">Elective and generic PE slots can be named to match your actual subjects. Units in parentheses are kept as listed. Marking Taken is self-reported and does not certify a passing grade.</p><p class="checklist-save-note">${admin?'Changes stay in this device’s separate admin workspace.':'Changes save with your current journey. Sign in to keep the checklist across devices.'}</p>`;
}
// Save one row without rebuilding the interactive sky. Keep keyboard focus and open editors.
export function attachNonMajorChecklist(root,{getProgress,getState,save,onError=()=>{}}){
 function render(){const focused=root.ownerDocument.activeElement,id=focused?.dataset.nonMajor,field=focused?.dataset.field,open=[...root.querySelectorAll('details[open]')].map(d=>d.closest('[data-checklist-row]').dataset.checklistRow);root.innerHTML=renderNonMajorChecklist(getProgress(),getState());for(const key of open){const d=root.querySelector(`[data-checklist-row="${key}"] details`);if(d)d.open=true;}if(id&&NON_MAJOR_BY_ID[id]&&['year','term','taken','code','title'].includes(field))root.querySelector(`[data-non-major="${id}"][data-field="${field}"]`)?.focus({preventScroll:true});}
 function change(event){if(event.target.matches('[data-checklist-batch]')){try{if(getState().ready===false)throw Error('Finish loading your journey first.');if(getState().signedIn)throw Error('Change your batch in Account.');save(setNonMajorBatch(getProgress(),event.target.value===''?null:Number(event.target.value)));}catch(error){onError(error.message);}render();root.querySelector('[data-checklist-batch]')?.focus({preventScroll:true});return;}const input=event.target.closest('[data-non-major]');if(!input||!root.contains(input))return;
  try{if(getState().ready===false)throw Error('Finish loading or choosing your account journey first.');const field=input.dataset.field,value=field==='taken'?input.checked:['year','term'].includes(field)?input.value===''?null:Number(input.value):input.value;const state=getState(),p=getProgress(),batch=validChecklistBatch(state.batch)?state.batch:!state.signedIn?p.nonMajorBatchId:null;if(!nonMajorCourses(batch).some(c=>c.id===input.dataset.nonMajor))throw Error('This subject is outside your current checklist.');save(setNonMajorRecord(p,input.dataset.nonMajor,{[field]:value}));}catch(error){onError(error.message);}render();
 }
 root.addEventListener('change',change);
 return {render,destroy:()=>root.removeEventListener('change',change)};
}
