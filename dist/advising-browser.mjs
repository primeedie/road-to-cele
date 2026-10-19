import {readAdvisingPdf} from './advising-pdf.mjs';
import {buildAdvisingPlan,applyAdvisingImport} from './advising-import.mjs';
import {COURSES,SPECIALIZATIONS} from './curriculum.mjs';
import {nonMajorCourses,validChecklistBatch} from './non-major-courses.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachAdvisingImport({document,getProgress,getState,save,onSaved=()=>{},reader=readAdvisingPdf}){
 const dialog=document.querySelector('#booklet-dialog');let epoch=0,abort=null,owner=null,parsed=null,plan=null,baseline=null,busy=false,message='',mappings={},choices=new Map(),replacements=new Set(),active=new Set(),settings={};
 const identity=()=>getState().owner+':batch-'+(getState().batch??'guest');
 const effectiveBatch=()=>getState().batch??getProgress().nonMajorBatchId??null;
 function clear(){epoch++;abort?.abort();abort=null;parsed=null;plan=null;baseline=null;busy=false;message='';mappings={};choices.clear();replacements.clear();active.clear();settings={};}
 function reset(){clear();if(dialog.open)dialog.close();}
 function syncIdentity(){if(owner!==identity()){owner=identity();reset();}}
 function makePlan(){plan=buildAdvisingPlan(getProgress(),parsed,{batch:effectiveBatch(),mappings});baseline=JSON.stringify(getProgress());choices=new Map(plan.rows.map(r=>[r.key,r.defaultSelected]));replacements.clear();active.clear();settings={currentTerm:plan.suggestedTerm,branch:getProgress().specializationProgression.selectedSpecialization||(plan.branches.length===1&&plan.suggestedTerm>=7?plan.branches[0]:''),confirmed:false};}
const mappingOptions=r=>'<option value="">Automatic match</option>'+((/^(GE|LC|PE|NSTP|SAS|LASARE)/.test(r.code))?'<option value="EXTRA">Keep as extra non-major record</option>':'')+'<option value="SKIP">Leave out</option><optgroup label="Major courses">'+COURSES.map(c=>`<option value="${c.id}">${c.id} — ${esc(c.title)}</option>`).join('')+'</optgroup><optgroup label="Non-major checklist">'+nonMajorCourses(effectiveBatch()).map(c=>`<option value="${c.id}">${c.code} — ${esc(c.title)}</option>`).join('')+'</optgroup>';
 function preview(){
  const count=[...choices.values()].filter(Boolean).length+active.size;
  const groups=[['Major courses','MAJOR'],['Non-major courses','NON_MAJOR'],['Additional non-major courses','EXTRA'],['Needs a course match','REVIEW']];

  return `<p class="advising-preview-count">${plan.rows.length} rows found · <strong>${count} selected</strong></p>${plan.warnings.length?'<details><summary>Reading notes ('+plan.warnings.length+')</summary><ul>'+plan.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></details>':''}<div class="advising-import-settings"><label>Current journey term<select data-booklet-setting="currentTerm">${Array.from({length:18},(_,i)=>i+1).map(n=>`<option value="${n}"${settings.currentTerm===n?' selected':''}>Year ${Math.ceil(n/3)} · Term ${(n-1)%3+1} (journey ${n})</option>`).join('')}</select></label><label>Academic path to confirm<select data-booklet-setting="branch"><option value="">Keep my current path</option>${Object.entries(SPECIALIZATIONS).map(([id,b])=>`<option value="${id}"${settings.branch===id?' selected':''}>${id} — ${esc(b.name)}</option>`).join('')}</select></label></div><p class="card-note">Blank grades are left out. Select “Currently active” only for courses you are enrolled in now. Existing records are kept unless you explicitly choose to replace a conflict.</p>${groups.map(([label,kind])=>{
   const rows=plan.rows.filter(r=>r.kind===kind);if(!rows.length)return '';
   return `<section class="advising-preview-group"><h3>${label} <small>${rows.length} rows</small></h3><div class="advising-table-scroll" tabindex="0"><table class="advising-table"><thead><tr><th>Import</th><th>Subject</th><th>Units</th><th>Year / term</th><th>Grade</th><th>Review</th></tr></thead><tbody>${rows.map(r=>`<tr data-booklet-row="${r.key}"><td><label class="advising-row-check"><input type="checkbox" data-booklet-select="${r.key}"${choices.get(r.key)?' checked':''}${r.issue||r.same||r.outcome==='UNGRADED'?' disabled':''}><span class="sr-only">Import ${esc(r.code)} in journey term ${r.term}</span></label></td><th scope="row">${esc(r.code)}${r.targetId&&r.targetId!==r.code?'<small>→ '+r.targetId+'</small>':''}</th><td>${r.units}</td><td>Year ${Math.ceil(r.term/3)} · Term ${(r.term-1)%3+1}<small>Journey ${r.term}</small></td><td class="advising-grade" data-outcome="${r.outcome}">${esc(r.gradeText||'—')}</td><td>${r.issue?'<span class="advising-warning">'+esc(r.issue)+'</span>':r.same?'Already saved':r.conflict?'<label class="advising-row-check"><input type="checkbox" data-booklet-replace="'+r.key+'"'+(replacements.has(r.key)?' checked':'')+'>Use booklet instead of saved record</label>':r.outcome==='UNGRADED'?r.kind==='MAJOR'?'<label class="advising-row-check"><input type="checkbox" data-booklet-active="'+r.key+'"'+(active.has(r.key)?' checked':'')+'>Currently active</label>':'No grade — left out':r.outcome==='PASSED'?'Passed':'Not passed'}<details class="advising-mapping" data-booklet-map-details="${r.key}"><summary>Match course</summary><label>Save this row as<select data-booklet-mapping="${r.key}"><option value="">Automatic match</option>${mappings[r.key]?`<option value="${esc(mappings[r.key])}" selected>${esc(mappings[r.key])}</option>`:""}</select></label></details></td></tr>`).join('')}</tbody></table></div></section>`;
  }).join('')}<label class="advising-confirm"><input type="checkbox" data-booklet-confirm${settings.confirmed?' checked':''}>I reviewed the subjects, grades, term and academic path. Apply these records to my ${getState().admin?'separate admin workspace':'journey'}.</label><button type="button" class="primary" data-booklet-action="apply"${!settings.confirmed||!count?' disabled':''}>Apply ${count} course record${count===1?'':'s'}</button>`;
 }
 function paint(){
  const scroll=dialog.scrollTop;
  dialog.innerHTML=`<button type="button" class="dialog-close" data-booklet-action="close" aria-label="Close booklet import">×</button><div class="eyebrow">ACADEMIC ADVISING</div><h2 id="booklet-title">Bring your journey in.</h2><p>Choose your advising booklet PDF, review the detected course tables, then apply them together.</p><p class="card-note">The PDF is read on this device. Only the course records you confirm are saved with your journey. Contact details and adviser notes are ignored.</p><label class="advising-upload">${busy?'Reading your booklet…':plan?'Choose another booklet':'Choose booklet PDF'}<input type="file" accept="application/pdf,.pdf" data-booklet-file${busy?' disabled':''}></label>${!validChecklistBatch(effectiveBatch())?'<p class="advising-warning">Choose your batch in Account (or the guest checklist) to match PE courses correctly.</p>':''}<p class="advising-import-status" role="status">${esc(message)}</p>${plan?preview():''}`;
  if(plan)for(const [key,value]of Object.entries(mappings)){const input=[...dialog.querySelectorAll('[data-booklet-mapping]')].find(i=>i.dataset.bookletMapping===key);if(input)input.value=value;}
  dialog.scrollTop=scroll;
 }
 function ready(){if(getState().ready===false)throw Error('Finish loading or choosing your account journey first.');if(owner!==identity())throw Error('Your account view changed. Open the import again.');}
 function open(){syncIdentity();ready();clear();dialog.showModal();paint();}
 async function choose(file){
  clear();owner=identity();const token=epoch,currentOwner=owner;abort=new AbortController();busy=true;paint();
  try{const result=await reader(file,{signal:abort.signal,onProgress:(page,total)=>{if(token===epoch&&currentOwner===identity()){message='Reading page '+page+' of '+total;const status=dialog.querySelector('[role="status"]');if(status)status.textContent=message;}}});if(token!==epoch||currentOwner!==identity()||!dialog.open)return;ready();parsed=result;makePlan();message='Review the preview. Nothing has been saved yet.';
  }catch(error){if(token!==epoch||currentOwner!==identity())return;message=error.message;}finally{if(token===epoch){busy=false;paint();}}
 }
 document.addEventListener('click',event=>{if(event.target.closest('[data-action="import-booklet"]')){try{open();}catch(error){message=error.message;getState().onError?.(message);}}});
 dialog.addEventListener('click',async event=>{
  const action=event.target.closest('[data-booklet-action]')?.dataset.bookletAction;if(action==='close'){reset();return;}if(action!=='apply')return;
  try{ready();if(!parsed||!plan)throw Error('Choose a booklet first.');if(JSON.stringify(getProgress())!==baseline){makePlan();message='Your journey changed while reviewing. Check the refreshed preview and confirm again.';paint();return;}
   const next=applyAdvisingImport(getProgress(),plan,{confirmed:settings.confirmed,selectedKeys:[...choices].filter(([,v])=>v).map(([k])=>k),replaceKeys:[...replacements],activeKeys:[...active],currentTerm:settings.currentTerm,branch:settings.branch||null,batch:effectiveBatch(),admin:getState().admin===true});
   save(next);reset();onSaved(next);
  }catch(error){message=error.message;paint();}
 });
 dialog.addEventListener('toggle',event=>{const details=event.target;if(!details.matches?.('[data-booklet-map-details]')||!details.open)return;const row=plan?.rows.find(r=>r.key===details.dataset.bookletMapDetails),select=details.querySelector('select');if(!row||!select||select.dataset.loaded)return;select.innerHTML=mappingOptions(row);select.value=mappings[row.key]||'';select.dataset.loaded='true';},true);
 dialog.addEventListener('change',event=>{
  const input=event.target;if(input.matches('[data-booklet-file]')){if(input.files?.[0])void choose(input.files[0]);return;}
  try{ready();if(!plan)return;
   if(input.dataset.bookletMapping!==undefined){const key=input.dataset.bookletMapping;if(input.value)mappings[key]=input.value;else delete mappings[key];makePlan();message='Course match updated. Review and confirm again.';}
   else if(input.dataset.bookletSetting){settings[input.dataset.bookletSetting]=input.dataset.bookletSetting==='currentTerm'?Number(input.value):input.value;settings.confirmed=false;}
   else if(input.dataset.bookletSelect){choices.set(input.dataset.bookletSelect,input.checked);settings.confirmed=false;}
   else if(input.dataset.bookletReplace){const key=input.dataset.bookletReplace;if(input.checked)replacements.add(key);else replacements.delete(key);choices.set(key,input.checked);settings.confirmed=false;}
   else if(input.dataset.bookletActive){const key=input.dataset.bookletActive;if(input.checked)active.add(key);else active.delete(key);settings.confirmed=false;}
   else if(input.matches('[data-booklet-confirm]'))settings.confirmed=input.checked;
   const selector=input.matches('[data-booklet-confirm]')?'[data-booklet-confirm]':input.dataset.bookletSetting?'[data-booklet-setting="'+input.dataset.bookletSetting+'"]':null;paint();if(selector)dialog.querySelector(selector)?.focus({preventScroll:true});
  }catch(error){message=error.message;paint();}
 });
 dialog.addEventListener('close',clear);dialog.addEventListener('cancel',clear);
 return {open,syncIdentity,reset};
}
