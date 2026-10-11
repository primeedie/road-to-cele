import { newProgress } from './progression.mjs';
import { SPECIALIZATIONS } from './curriculum.mjs';
export const STORAGE_KEY='cele-atlas.progress.v3';
export function hydrateProgress(raw) {
 if(!raw || raw.version!==3)throw Error('Unsupported progress format');
 const p=newProgress();
 if(![1,2,3,4].includes(raw.academicYear))throw Error('Invalid academic year');
 const r=raw.specializationProgression;
 if(!r || !['UNDECIDED','CONFIRMED'].includes(r.specializationStatus) || !Array.isArray(r.previousSpecializationHistory))throw Error('Invalid specialization record');
 if(r.specializationStatus==='CONFIRMED' && (!SPECIALIZATIONS[r.selectedSpecialization] || r.confirmationMethod!=='SELF_REPORTED' || !r.confirmedAt))throw Error('Invalid confirmation');
 if(r.specializationStatus==='UNDECIDED' && r.selectedSpecialization!==null)throw Error('Invalid undecided path');
 for(const key of ['academicRecords','masteryRecords'])if(!raw[key] || typeof raw[key]!=='object' || Array.isArray(raw[key]))throw Error('Invalid records');
 for(const key of ['quizAttempts','integrationAssessments'])if(!Array.isArray(raw[key]))throw Error('Invalid history');
 return structuredClone({...p,...raw});
}
export function loadProgress(storage) {const raw=storage.getItem(STORAGE_KEY);return raw?hydrateProgress(JSON.parse(raw)):newProgress();}
export function saveProgress(storage,p) {storage.setItem(STORAGE_KEY,JSON.stringify(p));}
// Replace only this app's progression record. A failed write leaves the old record intact.
export function resetProgress(storage) {const clean=newProgress();saveProgress(storage,clean);return clean;}
