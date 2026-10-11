import { COURSES, SPECIALIZATIONS } from './curriculum.mjs';
import { TERM_CONSTELLATIONS, BRANCH_CONSTELLATIONS, YEAR_HEIGHT, NODE_GROUND_X, NODE_GROUND_Y, projectConstellation, placeCourses } from './sky-layout.mjs';

function clusterLabel(positions,courses,gap=118){
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
const branches=new Map();
export function createSkyMap(branch=null){
 if(branch && !SPECIALIZATIONS[branch])throw Error('Unknown specialization');
 if(!branch)return {courses:[...shared],positions:{...sharedPositions},charts:sharedCharts,branchChart:null,branchLabel:null};
 if(!branches.has(branch)){
  const courses=COURSES.filter(c=>c.specialization===branch);
  // A branch extends the shared sky from Year III; prerequisites keep their original stars.
  const chart=projectConstellation(BRANCH_CONSTELLATIONS[branch],{x:5100,y:YEAR_HEIGHT*2-110,width:1850,height:3100},{depth:true});
  const positions=placeCourses(chart,courses);
  branches.set(branch,{courses,chart,positions,label:clusterLabel(positions,courses,150)});
 }
 const overlay=branches.get(branch);
 return {courses:[...shared,...overlay.courses],positions:{...sharedPositions,...overlay.positions},charts:sharedCharts,branchChart:overlay.chart,branchLabel:overlay.label};
}
