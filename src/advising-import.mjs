import {COURSE_BY_ID,SPECIALIZATIONS} from './curriculum.mjs';
import {NON_MAJOR_BY_ID,nonMajorCourses,validChecklistBatch} from './non-major-courses.mjs';
import {normalizeCourseCode,parseBookletGrade} from './advising-parser.mjs';
import {setNonMajorRecord} from './non-major-checklist.mjs';
import {confirmSpecialization,changeSpecialization,selected,academicLoad,activationLoadReason} from './progression.mjs';
import {IMPORT_METHOD} from './advising-grade.mjs';
export {IMPORT_METHOD,bookletGradeLabel,isBookletAttempt,validBookletAttempt} from './advising-grade.mjs';
// GE elective equivalents explicitly supplied by the owner.
const aliases={LBBCH1A:'LBYCH1A',GESPORT:'GESPORTS',GELITPH:'GELECAH',LCFILIA:'GELECSP',LCFILIB:'GELECST'};
export function normalizeAdvisingNonMajor(raw){
 if(!Array.isArray(raw))return [];
 return raw.slice(0,600).filter(r=>r&&/^[A-Z][A-Z0-9]{3,15}$/.test(r.code)&&Number.isInteger(r.term)&&r.term>=1&&r.term<=60&&Number.isFinite(r.units)&&r.units>=0&&r.units<=20&&['PASSED','FAILED'].includes(r.outcome)&&(r.targetId===null||Object.hasOwn(NON_MAJOR_BY_ID,r.targetId))&&parseBookletGrade(r.gradeText).outcome===r.outcome).map(r=>({code:r.code,targetId:r.targetId,title:typeof r.title==='string'?r.title.slice(0,160):'',term:r.term,units:r.units,...parseBookletGrade(r.gradeText),method:IMPORT_METHOD,confirmedAt:typeof r.confirmedAt==='string'?r.confirmedAt.slice(0,40):'',revisions:Array.isArray(r.revisions)?r.revisions.slice(-20):[]}));
}
export function buildAdvisingPlan(progress,parsed,{batch=null,mappings={}}={}){
 if(!parsed||!Array.isArray(parsed.rows)||parsed.rows.length>600)throw Error('The booklet contains too many or invalid course rows.');
 const allowedNonMajor=new Set(nonMajorCourses(batch).map(c=>c.id));
 const rows=parsed.rows.map(raw=>{
  const code=normalizeCourseCode(raw.code),key=code+':'+raw.term,grade=parseBookletGrade(raw.gradeText),units=Number(raw.units);
  if(!/^[A-Z][A-Z0-9]{3,15}$/.test(code)||!Number.isInteger(raw.term)||raw.term<1||raw.term>60||!Number.isFinite(units)||units<0||units>20)throw Error('An imported course row is invalid.');
  let targetId=aliases[code]||code,kind=Object.hasOwn(COURSE_BY_ID,targetId)?'MAJOR':Object.hasOwn(NON_MAJOR_BY_ID,targetId)?'NON_MAJOR':/^(GE|LC|PE|NSTP|SAS|LASARE)/.test(code)?'EXTRA':'REVIEW';
  if(Object.hasOwn(mappings,key)){
   const target=mappings[key];if(target==='SKIP'){kind='REVIEW';targetId=null;}else if(target==='EXTRA'&&/^(GE|LC|PE|NSTP|SAS|LASARE)/.test(code)){kind='EXTRA';targetId=null;}else if(Object.hasOwn(COURSE_BY_ID,target)){kind='MAJOR';targetId=target;}else if(allowedNonMajor.has(target)){kind='NON_MAJOR';targetId=target;}else throw Error('Choose a valid course mapping.');
  }
  if(kind==='EXTRA'||kind==='REVIEW')targetId=null;
  const course=kind==='MAJOR'?COURSE_BY_ID[targetId]:kind==='NON_MAJOR'?NON_MAJOR_BY_ID[targetId]:null;
  let issue=kind==='REVIEW'?'Unmatched course — map it or leave it out.':kind==='NON_MAJOR'&&!allowedNonMajor.has(targetId)?'This PE course belongs to another batch. Review its mapping.':grade.outcome==='REVIEW'?'Unrecognized grade — left out.':null;
  if(raw.outcome==='REVIEW')issue='The PDF has conflicting or ambiguous values for this row.';
  if(raw.term>18)issue='This entry is outside the Year 1–6 import range.';
  if(course&&course.units!==units)issue='Units differ from the course catalog; review the mapping.';
  const old=kind==='MAJOR'?progress.academicRecords[targetId]?.gradeAttempts?.find(a=>a.term===raw.term):kind==='NON_MAJOR'||kind==='EXTRA'?normalizeAdvisingNonMajor(progress.advisingNonMajor).find(a=>a.code===code&&a.term===raw.term):null;
  const sameGrade=old&&old.grade===grade.grade&&old.outcome===grade.outcome;
  const upgradeMatch=kind==='NON_MAJOR'&&sameGrade&&old.targetId===null&&aliases[code]===targetId;
  const same=sameGrade&&(kind==='MAJOR'||old.targetId===targetId);
  const date=kind==='NON_MAJOR'?progress.nonMajorRecords?.[targetId]:null;
  const dateConflict=date?.taken&&(date.year!==Math.ceil(raw.term/3)||date.term!==(raw.term-1)%3+1||date.code&&normalizeCourseCode(date.code)!==code)&&(!old||old.targetId!==targetId);
  const courseConflict=kind==='MAJOR'&&progress.academicRecords[targetId]?.status==='COMPLETED'&&!progress.academicRecords[targetId]?.gradeAttempts?.length&&grade.outcome==='FAILED';
  return {key,code,units,term:raw.term,page:raw.page,...grade,targetId,kind,title:course?.title||'Additional non-major course',issue,conflict:!!(!same&&old&&!upgradeMatch||dateConflict||courseConflict),same:!!same,old,defaultSelected:!issue&&!same&&(!old||upgradeMatch)&&!dateConflict&&!courseConflict&&grade.outcome!=='UNGRADED'};
 });
 // Two distinct booklet codes must never silently write the same subject in the same term.
 const targets=new Map(),rowKeys=new Set();for(const r of rows){if(rowKeys.has(r.key))throw Error('A course appears more than once in the same term. Review the PDF table.');rowKeys.add(r.key);if(!r.targetId)continue;const key=r.targetId+':'+r.term,other=targets.get(key);if(other){other.issue=r.issue='Two rows map to the same subject and term; choose one mapping.';}else targets.set(key,r);}
 return {rows,warnings:[...(parsed.warnings||[])],suggestedTerm:Math.max(progress.academicTerm??(progress.academicYear-1)*3+1,...rows.filter(r=>!r.issue).map(r=>r.term)),branches:[...new Set(rows.filter(r=>r.kind==='MAJOR').map(r=>COURSE_BY_ID[r.targetId].specialization).filter(Boolean))]};
}
export function applyAdvisingImport(progress,plan,{confirmed=false,selectedKeys=[],replaceKeys=[],activeKeys=[],currentTerm,branch=null,batch=null,admin=false,at=new Date().toISOString()}={}){
 if(!confirmed)throw Error('Confirm the preview before applying your booklet.');
 if(!Number.isInteger(currentTerm)||currentTerm<1||currentTerm>18)throw Error('Choose a current term in Years 1–6.');
 const chosen=new Set(selectedKeys),replace=new Set(replaceKeys),active=new Set(activeKeys),next=structuredClone(progress),affected=new Set(),nonMajorTargets=new Set();let changed=0;
 if(plan.rows.some(r=>(chosen.has(r.key)||active.has(r.key))&&r.term>currentTerm))throw Error('Your current term cannot be earlier than the records being imported.');
 const validRows=new Set(plan.rows.map(r=>r.key));for(const key of [...chosen,...active])if(!validRows.has(key))throw Error('The preview changed. Review the booklet again.');
 for(const row of plan.rows){
  if(!chosen.has(row.key)&&!active.has(row.key))continue;
  if(row.issue||row.outcome==='REVIEW')throw Error('Resolve the highlighted course rows first.');
  if(row.conflict&&!replace.has(row.key))throw Error('Choose Use booklet for conflicting saved records.');
  if(row.same)continue;
  if(row.outcome==='UNGRADED'){
   if(!active.has(row.key)||row.kind!=='MAJOR')continue;
   const record=next.academicRecords[row.targetId];if(record?.status==='COMPLETED')throw Error('An ungraded row cannot replace a passed course.');
   if(record?.gradeAttempts?.some(a=>a.term>=row.term))throw Error('An ungraded active attempt must be later than saved grades.');
   next.academicRecords[row.targetId]={...record,status:'ACTIVE',takenInTerm:row.term,events:[...(record?.events||[]),{status:'ACTIVE',term:row.term,at,method:IMPORT_METHOD}]};affected.add(row.targetId);changed++;continue;
  }
  if(row.kind==='MAJOR'){
   const record=next.academicRecords[row.targetId]||{},attempts=record.gradeAttempts||[],old=attempts.find(a=>a.term===row.term),{revisions,...snapshot}=old||{};
   const attempt={term:row.term,total:null,grade:row.grade,gradeText:row.gradeText,outcome:row.outcome,draft:null,confirmedAt:at,method:IMPORT_METHOD,revisions:old?[...(revisions||[]),snapshot]:[]};
   next.academicRecords[row.targetId]={...record,gradeAttempts:[...attempts.filter(a=>a.term!==row.term),attempt].sort((a,b)=>a.term-b.term),events:[...(record.events||[]),{status:row.outcome==='PASSED'?'COMPLETED':'FAILED',term:row.term,grade:row.grade,at,method:IMPORT_METHOD}]};affected.add(row.targetId);changed++;
  }else if(['NON_MAJOR','EXTRA'].includes(row.kind)){
   const history=normalizeAdvisingNonMajor(next.advisingNonMajor),old=history.find(a=>a.code===row.code&&a.term===row.term),{revisions,...snapshot}=old||{};
   next.advisingNonMajor=[...history.filter(a=>!(a.code===row.code&&a.term===row.term)),{code:row.code,targetId:row.targetId,title:row.title,units:row.units,term:row.term,grade:row.grade,gradeText:row.gradeText,outcome:row.outcome,confirmedAt:at,method:IMPORT_METHOD,revisions:old?[...(revisions||[]),snapshot]:[]}];if(row.targetId)nonMajorTargets.add(row.targetId);changed++;
  }
 }
 if(!changed)throw Error('Select at least one new course record to import.');
 for(const id of affected){const record=next.academicRecords[id],grades=record.gradeAttempts||[],passed=grades.filter(a=>a.outcome==='PASSED'),latest=grades.at(-1);
  if(passed.length){record.status='COMPLETED';record.takenInTerm=passed[0].term;}
  else if(record.status==='ACTIVE'&&(!latest||record.takenInTerm>latest.term)){}else if(latest){record.status='FAILED';record.takenInTerm=latest.term;}
 }
 for(const id of nonMajorTargets){const latest=next.advisingNonMajor.filter(r=>r.targetId===id).sort((a,b)=>a.term-b.term).at(-1);if(latest.term>18)continue;const updated=setNonMajorRecord(next,id,{year:Math.ceil(latest.term/3),term:(latest.term-1)%3+1,taken:true});next.nonMajorRecords=updated.nonMajorRecords;
  if(NON_MAJOR_BY_ID[id].editable){next.nonMajorRecords[id].code=latest.code;if(latest.title!=='Additional non-major course')next.nonMajorRecords[id].title=latest.title;}
 }
 next.academicTerm=currentTerm;next.academicYear=Math.min(4,Math.ceil(currentTerm/3));
 if(validChecklistBatch(batch))next.nonMajorBatchId=batch;
 let result=next;
 if(branch&&branch!==selected(next)){
  if(!SPECIALIZATIONS[branch]||next.academicYear<3)throw Error('Specialization confirmation begins in Year 3.');
  result=selected(next)?changeSpecialization(next,branch,{confirmed:true,reason:'Confirmed while importing academic advising records',at}):confirmSpecialization(next,branch,{confirmed:true,at});
 }
 // Historical results remain importable; only newly opened enrollments use the cap.
 const opensEnrollment=plan.rows.some(r=>active.has(r.key)&&r.outcome==='UNGRADED'&&r.kind==='MAJOR'&&result.academicRecords[r.targetId]?.status==='ACTIVE'&&progress.academicRecords[r.targetId]?.status!=='ACTIVE');
 const load=academicLoad(result);if(!admin&&opensEnrollment&&load.activeUnits>load.limit)throw Error(activationLoadReason(load));
 return result;
}
