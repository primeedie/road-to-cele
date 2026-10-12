const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filterCourseIndex(courses,value){
 const words=String(value).trim().toLowerCase().split(/\s+/).filter(Boolean);
 return courses.filter(c=>words.every(word=>(c.id+' '+c.title+' '+(c.specialization||'shared')).toLowerCase().includes(word)));
}
export function courseIndexMarkup(courses,query=''){
 const matches=filterCourseIndex(courses,query),list=query?matches.slice(0,30):matches;
 return {count:matches.length,html:list.length?list.map(c=>`<button class="atlas-course-row" data-course-index="${c.id}"><strong>${c.id}</strong><span>${escape(c.title)}</span><small>Y${c.year} · ${c.specialization||'Shared'}</small></button>`).join(''):'<p class="atlas-no-results">No matching courses.</p>',message:matches.length+' matching courses'+(matches.length>list.length?'; refine your search to see more.':'.')};
}
