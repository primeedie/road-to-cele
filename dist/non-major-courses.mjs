// Internal provenance: NON_MAJOR_CHECKLIST.md. No term placement is prescribed here.
const course=(id,title,units,extra={})=>Object.freeze({id,code:id,title,units,...extra});
export const NON_MAJOR_COMMON=Object.freeze([
 course('GEARTAP','Art Appreciation',3),
 course('GEETHIC','Ethics',3),
 course('GEMATMW','Mathematics in the Modern World',3),
 course('GEPCOMM','Purposive Communication',3),
 course('GERPHIS','Readings in Philippine History',3),
 course('GERIZAL','Life and Works of Rizal',3),
 course('GESTSOC','Science, Technology and Society',3),
 course('GEUSELF','Understanding the Self',3),
 course('GEWORLD','The Contemporary World',3),
 course('GELECAH','GE Arts & Humanities Elective',3,{editable:true}),
 course('GELECSP','GE Social Science & Philosophy Elective',3,{editable:true}),
 course('GELECST','GE Science & Technology Elective',3,{editable:true}),
 course('LCASEAN','The Filipino and ASEAN',3),
 course('LCENWRD','Encountering the Word in the World',3),
 course('LCFAITH','Faith Worth Living',3),
 course('LCLSONE','Lasallian Studies 1',1,{parenthesized:true}),
 course('LCLSTWO','Lasallian Studies 2',1,{parenthesized:true}),
 course('LCLSTRI','Lasallian Studies 3',1,{parenthesized:true}),
 course('LASARE1','Lasallian Recollection 1',0,{code:'LASARE 1'}),
 course('LASARE2','Lasallian Recollection 2',0,{code:'LASARE 2'}),
 course('LASARE3','Lasallian Recollection 3',0,{code:'LASARE 3'}),
 course('SAS1000','Student Affairs Services 1000',0),
 course('SAS2000','Student Affairs Services 2000',0),
 course('SAS3000','Student Affairs Services 3000',0),
 course('NSTP101','National Service Training Program — General Orientation',0),
 course('NSTPCW1','National Service Training Program 1',3,{parenthesized:true}),
 course('NSTPCW2','National Service Training Program 2',3,{parenthesized:true})
]);
export const LEGACY_PE=Object.freeze([
 course('GEFTWEL','Physical Fitness and Wellness',2),
 course('GEDANCE','Physical Fitness and Wellness in Dance',2),
 course('GESPORTS','Physical Fitness and Wellness in Individual Sports',2),
 course('GETEAMS','Physical Fitness and Wellness in Team Sports',2)
]);
export const CURRENT_PE=Object.freeze([
 course('PE1CRDO','Physical Fitness and Wellness',2),
 course('PE2FTEX','Functional Exercise',2),
 course('PETHREE','Physical Education 3 — generic slot',2,{editable:true}),
 course('PEDFOUR','Physical Education 4 — generic slot',2,{editable:true})
]);
export const validChecklistBatch=n=>Number.isInteger(n)&&n>=119&&n<=128;
export const nonMajorCourses=batch=>[...NON_MAJOR_COMMON,...(validChecklistBatch(batch)?batch<=122?LEGACY_PE:CURRENT_PE:[])];
// All supported identities are retained when a student's batch is corrected.
export const NON_MAJOR_COURSES=Object.freeze([...NON_MAJOR_COMMON,...LEGACY_PE,...CURRENT_PE]);
export const NON_MAJOR_BY_ID=Object.freeze(Object.fromEntries(NON_MAJOR_COURSES.map(c=>[c.id,c])));
export const NON_MAJOR_MAX_YEAR=6;
