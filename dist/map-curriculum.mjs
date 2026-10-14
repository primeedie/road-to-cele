import { COURSES, SPECIALIZATIONS } from './curriculum.mjs';
import { TERM_CONSTELLATIONS, BRANCH_CONSTELLATIONS, YEAR_HEIGHT, NODE_GROUND_X, NODE_GROUND_Y, projectConstellation, placeCourses } from './sky-layout.mjs';
import { sceneBounds } from './map-camera.mjs';
import {personalCoursePlan} from './grade-attempts.mjs';

function clusterLabel(positions,courses,gap=98){
 const top=courses.map(c=>positions[c.id]).sort((a,b)=>(a.y+NODE_GROUND_Y-140*a.perspective)-(b.y+NODE_GROUND_Y-140*b.perspective))[0];
 return {x:top.x+NODE_GROUND_X-100,y:top.y+NODE_GROUND_Y-140*top.perspective-gap};
}

const shared=COURSES.filter(c=>!c.specialization);
const sharedCharts=[];
const sharedPositions={};
for(let term=1;term<=11;term++){
 const courses=shared.filter(c=>c.term===term),year=Math.ceil(term/3),col=(term-1)%3,base=(year-1)*YEAR_HEIGHT;
 const dense=TERM_CONSTELLATIONS[term]==='Leo';
 const chart=projectConstellation(TERM_CONSTELLATIONS[term],{x:(dense?-20:105)+col*1600,y:base+(dense?-310:-110),width:dense?1600:1350,height:dense?2600:2200},{depth:true});
 const positions=placeCourses(chart,courses);
 sharedCharts.push({chart,term,label:clusterLabel(positions,courses)});
 Object.assign(sharedPositions,positions);
}
// Close the empty space between year groups without changing course or constellation identities.
const yearBands=[];
for(let year=1;year<=4;year++){
 const courses=shared.filter(c=>c.year===year),charts=sharedCharts.filter(c=>Math.ceil(c.term/3)===year);
 const bounds=sceneBounds({courses,charts,positions:sharedPositions,branchChart:null});
 const shift=year===1?0:yearBands[year-2].maxY+140-bounds.minY;
 for(const {chart,label} of charts){label.y+=shift;chart.vertices.forEach(p=>{p.y+=shift;p.catalogY+=shift;});}
 courses.forEach(c=>sharedPositions[c.id].y+=shift);
 yearBands.push({minY:bounds.minY+shift,maxY:bounds.maxY+shift});
}
const branches=new Map();
const personalMaps=new Map();
function createPersonalMap(branch,progress){
 const scope=COURSES.filter(c=>!c.specialization||c.specialization===branch),plan=personalCoursePlan(progress,scope);
 const hasGrades=scope.some(c=>progress.academicRecords[c.id]?.gradeAttempts?.length);
 if(!plan.failedRoots.length&&(!hasGrades||!plan.courses.some(c=>c.shifted)))return null;
 const key=JSON.stringify([branch,plan.courses.map(c=>[c.id,c.term,c.archivedAttempt?.outcome])]);if(personalMaps.has(key))return personalMaps.get(key);
 const charts=[],positions={};let overflow=Math.max(4,Math.ceil(Math.max(...plan.courses.map(c=>c.term))/3));
 const terms=[...new Set([...Array.from({length:11},(_,i)=>i+1),...plan.courses.map(c=>c.term)])].sort((a,b)=>a-b);
 for(const term of terms){
  const members=plan.courses.filter(c=>c.term===term),chartId=TERM_CONSTELLATIONS[term]||TERM_CONSTELLATIONS[((term-1)%11)+1];
  const template=projectConstellation(chartId,{x:0,y:0,width:chartId==='Leo'?1600:1350,height:chartId==='Leo'?2600:2200},{depth:true}),capacity=template.vertices.length;
  const pages=Math.max(1,Math.ceil(members.length/capacity));
  for(let page=0;page<pages;page++){
   const courses=members.slice(page*capacity,(page+1)*capacity),chart=structuredClone(template),placed=placeCourses(chart,courses),row=page?overflow++:Math.ceil(term/3)-1;
   Object.assign(positions,placed);charts.push({chart,term,key:'term-'+term+'-'+page,layoutRow:row,courseIds:courses.map(c=>c.id),label:courses.length?clusterLabel(placed,courses):{x:0,y:0}});
  }
 }
 const map={courses:plan.courses,positions,charts,branchChart:null,branchLabel:null,personalPlan:true};
 personalMaps.set(key,map);if(personalMaps.size>8)personalMaps.delete(personalMaps.keys().next().value);return map;
}
export function createSkyMap(branch=null,progress=null){
 if(branch && !SPECIALIZATIONS[branch])throw Error('Unknown specialization');
 if(progress){const personal=createPersonalMap(branch,progress);if(personal)return personal;}
 if(!branch)return {courses:[...shared],positions:{...sharedPositions},charts:sharedCharts,branchChart:null,branchLabel:null};
 if(!branches.has(branch)){
  const courses=COURSES.filter(c=>c.specialization===branch);
  // A branch extends the shared sky from Year III; prerequisites keep their original stars.
  const centerY=(yearBands[2].minY+yearBands[3].maxY)/2;
  const chart=projectConstellation(BRANCH_CONSTELLATIONS[branch],{x:5100,y:centerY-1550,width:1850,height:3100},{depth:true});
  const positions=placeCourses(chart,courses);
  branches.set(branch,{courses,chart,positions,label:clusterLabel(positions,courses,124)});
 }
 const overlay=branches.get(branch);
 return {courses:[...shared,...overlay.courses],positions:{...sharedPositions,...overlay.positions},charts:sharedCharts,branchChart:overlay.chart,branchLabel:overlay.label};
}
