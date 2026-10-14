const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isQuizComponent=c=>['quizzes','exams','knowledge','short','long'].includes(c.id);
export const quizPrefix=c=>/knowledge/i.test(c.label)?'KCQ':/short/i.test(c.label)?'SQ':'LQ';
export function quizRows(c,entries=[]){return entries.map((row,i)=>`<div class="grade-quiz-entry" data-quiz-row><strong>${quizPrefix(c)} ${i+1}</strong><div><span class="grade-score"><input type="number" name="quiz_${c.id}_${i}_score" min="0" step="any" inputmode="decimal" aria-label="${quizPrefix(c)} ${i+1} score" value="${esc(row.score??'')}" placeholder="Score"><span aria-hidden="true">/</span><input type="number" name="quiz_${c.id}_${i}_max" min="0.01" step="any" inputmode="decimal" aria-label="${quizPrefix(c)} ${i+1} perfect score" value="${esc(row.max??'')}" placeholder="Perfect"></span><small data-quiz-bonus></small></div><button type="button" data-remove-quiz="${c.id}" data-quiz-index="${i}" aria-label="Remove ${quizPrefix(c)} ${i+1}">×</button></div>`).join('');}
export function quizEntries(form,id){const n=Number(form.elements.namedItem('quiz_count_'+id)?.value||0);if(!Number.isInteger(n)||n<0||n>50)throw Error('Use up to 50 quizzes per category.');return Array.from({length:n},(_,i)=>({score:form.elements.namedItem(`quiz_${id}_${i}_score`).value,max:form.elements.namedItem(`quiz_${id}_${i}_max`).value}));}
export function averageQuizEntries(entries){
 if(!entries.length)return null;let total=0,incomplete=false;
 for(const [i,row] of entries.entries()){
  if(row.score!==''&&(!Number.isFinite(Number(row.score))||Number(row.score)<0))throw Error(`Quiz ${i+1}: enter a nonnegative score.`);
  if(row.max!==''&&(!Number.isFinite(Number(row.max))||Number(row.max)<=0))throw Error(`Quiz ${i+1}: perfect score must be greater than zero.`);
  if(row.score===''||row.max===''){incomplete=true;continue;}total+=Number(row.score)/Number(row.max)*100;
 }
 return incomplete?null:total/entries.length;
}
export function changeQuizRows(form,c,remove){
 const entries=quizEntries(form,c.id);if(remove===undefined){if(entries.length>=50)throw Error('Use up to 50 quizzes per category.');entries.push({score:'',max:''});}
 else {if(!Number.isInteger(remove)||remove<0||remove>=entries.length)throw Error('Unknown quiz');entries.splice(remove,1);}
 form.querySelector(`[data-quiz-rows="${c.id}"]`).innerHTML=quizRows(c,entries);form.elements.namedItem('quiz_count_'+c.id).value=entries.length;
}
