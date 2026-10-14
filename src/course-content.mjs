import {COURSE_CONTENT,SYLLABUS_SOURCES,LIMITED_SYLLABI,ADDITIONAL_SYLLABI} from './syllabus-data.mjs';
import {COURSE_BY_ID} from './curriculum.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=list=>'pp. '+list.join(', ');
function sourceNote(id,section){
 const s=SYLLABUS_SOURCES[id],refs=section===0?s.descriptionPages:section===1?s.topicPages:[...new Set([...s.descriptionPages,...s.topicPages])];
 return `<details class="course-source"><summary>Source syllabus</summary><p>${esc(s.file)} · ${esc(s.edition)} · ${pages(refs)}</p>${ADDITIONAL_SYLLABI[id]?.map(other=>'<p>'+esc(other.file)+' · '+esc(other.note)+'</p>').join('')||''}</details>`;
}
export function renderSyllabusSection(course,section){
 if(section>2)return null;
 const data=COURSE_CONTENT[course.id];
 if(!data){const limited=LIMITED_SYLLABI[course.id];return limited?`<div class="dossier-placeholder"><h4>Full syllabus still needed</h4><p>${esc(limited.reason)}</p></div>`:null;}
 if(section===0)return `<div class="course-content"><p class="course-description">${esc(data.description)}</p><p class="course-content-note">A short paraphrase of the supplied syllabus. The map’s course placement and requirements continue to follow the ID122 checklist.</p>${sourceNote(course.id,section)}</div>`;
 if(section===1)return `<div class="course-content"><p class="course-content-note">Syllabus-based overview · modules and worked examples can be added later. Take one group at a time.</p><ol class="course-topic-list">${data.topics.map(topic=>`<li><strong>${esc(topic.title)}</strong><span>${esc(topic.summary)}</span></li>`).join('')}</ol>${sourceNote(course.id,section)}</div>`;
 if(course.courseKind==='LAB')return `<div class="course-content"><p class="course-content-note">Practice supported by the lab syllabus. Use resume wording only after you can demonstrate the work; course completion alone does not certify proficiency.</p><div class="course-skill-list">${data.labSkills.map(skill=>`<article><h4>${esc(skill.practice)}</h4>${skill.tools.length?'<p><strong>Tools:</strong> '+esc(skill.tools.join(' · '))+'</p>':''}<p><strong>Keep as evidence:</strong> ${esc(skill.evidence)}</p><details><summary>Resume wording to adapt</summary><p>${esc(skill.resume)}</p></details><small>${esc(SYLLABUS_SOURCES[course.id].file)} · ${pages(skill.pages)}</small></article>`).join('')}</div>${sourceNote(course.id,section)}</div>`;
 return `<div class="course-content"><p class="course-content-note">Inferred connections from the supplied syllabi, not an official topic-equivalence map.</p><div class="course-skill-list">${data.future.map(link=>{const target=COURSE_BY_ID[link.course];return `<article><h4>${esc(link.topic)}</h4><p>This topic will be used and recalled in <button class="future-course-link" data-course-link="${target.id}">${target.id} — ${esc(target.title)}</button>.</p><p>${esc(link.why)}</p><details class="course-source"><summary>Why this link is inferred</summary><p>${esc(SYLLABUS_SOURCES[course.id].file)} · ${pages(link.fromPages)}<br>${esc(SYLLABUS_SOURCES[target.id].file)} · ${pages(link.toPages)}</p></details></article>`;}).join('')}</div><p class="course-content-note">CIVINCO and CELE topic mappings are pending the supporting sets.</p>${sourceNote(course.id,section)}</div>`;
}
