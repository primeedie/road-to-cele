// Lower bounds verified against each supplied syllabus's final-grade table.
// No rounding or upward transmutation is assumed between these thresholds.
const points=[1,1.5,2,2.5,3,3.5,4];
const table=(bounds,source)=>({source,bands:bounds.map((minimum,i)=>({grade:points[i],minimum}))});
export const SYLLABUS_GRADE_SCALES={
 FNDMATH:table([55,62,69,75,82,88,94],'FNDMATH T2.pdf · p. 6'),
 CALENG1:table([55,62,69,75,82,88,94],'CALENG1.pdf · p. 6'),
 CALENG2:table([55,62,69,75,82,88,94],'CALENG2 T2.pdf · p. 4'),
 CALENG3:table([55,62,69,75,82,88,94],'CALENG3.pdf · p. 4; [M-04] CALENG3 Syllabus Ver-2021-Rev-03.pdf · p. 4'),
 BASCHEM:table([60,66,72,78,84,90,95],'BASCHEM.pdf · p. 2'),
 ENGCHEM:table([60,66,72,78,84,90,96],'ENGCHEM T2.pdf · p. 3'),
 BASPHYS:table([50,58,66,73,80,87,94],'BASPHYS.pdf · p. 2'),
 ENGPHYS:table([50,58,66,73,80,87,94],'ENGPHYS T2.pdf · p. 2'),
 CEECONO:table([60,65,70,76,82,88,94],'CEECONO-Syllabus (23-24).pdf · p. 3'),
 ENGMEC1:table([60,65,70,76,82,88,94],'ENGMEC1.pdf · p. 5'),
 ENGMEC2:table([60,65,70,76,82,88,94],'ENGMEC2.pdf · p. 4'),
 ENGMEC3:table([60,65,70,76,82,88,94],'ENGMEC3 T2.pdf · p. 4'),
 CEMEDEF:table([60,65,70,76,82,88,94],'CEMEDEF_Syllabus (23-24).pdf · p. 2'),
 CEHDRA2:table([60,65,70,76,82,88,94],'CEHDRA2-Syllabus (2024 TERM 3).pdf · p. 6'),
 CEHIWAY:table([60,65,70,76,82,88,94],'CEHIWAY SYLLABUS - January 2025.pdf · p. 3'),
 CERCDES:table([60,65,70,76,82,88,94],'CERCDES Syllabus 2nd Term AY 2025-2026 (BAL).pdf · p. 4'),
 LBYCV2C:table([60,65,70,76,82,88,94],'[LBYCV2C] Course Syllabus AY2425 T2_rev00_[sgd].pdf · p. 3'),
 LBYCV3C:table([60,65,70,76,82,88,94],'LBYCV3C_SYLLABUS-T1AY2526_with-Service-Learning.pdf · p. 9'),
 LBYCV4B:table([60,65,70,76,82,88,94],'cv4b syllabus.pdf · p. 7')
};
export function validateGradeScale(scale,passingPercentage){
 if(!scale?.source||scale.bands?.length!==7||scale.bands.some((b,i)=>b.grade!==points[i]||!Number.isFinite(b.minimum)||b.minimum<=0||b.minimum>100||(i&&b.minimum<=scale.bands[i-1].minimum))||scale.bands[0].minimum!==passingPercentage)throw Error('A verified course-specific grade table is required.');
 return scale;
}
export function gradePoint(scale,total){
 if(total===null||!Number.isFinite(total)||total<0)return null;
 return [...scale.bands].reverse().find(b=>total+1e-9>=b.minimum)?.grade??0;
}
export function gradeThreshold(scale,point){
 const band=scale?.bands.find(b=>b.grade===Number(point));if(!band)throw Error('Choose a target grade from 1.0 to 4.0.');return band.minimum;
}
