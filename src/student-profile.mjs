export const BATCH_IDS=Object.freeze(Array.from({length:10},(_,i)=>119+i));
export function parseBatchId(value){
 const raw=String(value??'');
 if(!/^\d{3}$/.test(raw)||!BATCH_IDS.includes(Number(raw)))throw Error('Choose your batch from ID 119 to ID 128.');
 return Number(raw);
}
export function studentBatch(user){try{return parseBatchId(user?.user_metadata?.batch_id);}catch{return null;}}
export function batchSelect(value=null){
 return `<label class="batch-field">Batch ID<select name="batchId" required><option value="" ${value===null?'selected':''} disabled>Choose your batch</option>${BATCH_IDS.map(id=>`<option value="${id}" ${id===value?'selected':''}>ID ${id}</option>`).join('')}</select></label>`;
}
export function profileForm(user){
 const batch=studentBatch(user);
 return `<form class="student-profile-form" data-profile-form><h3>${batch===null?'Choose your batch':'Student profile'}</h3>${batchSelect(batch)}<p class="card-note">Your batch selects the PE subjects in the Non-major checklist. The technical curriculum map still follows the ID 122 checklist.</p><button type="submit" class="secondary">Save batch</button></form>`;
}
