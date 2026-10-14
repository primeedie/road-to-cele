// milch pogiman made this, so u cant steal this lol
import { installAuthorMark } from './author-mark.mjs';
import { courseConnections, traceConnection, CONNECTION_TYPES } from './connections.mjs';
import { completionMoment } from './completion.mjs';
import { attachBackdropDismiss } from './dialog-dismiss.mjs';
import { BRANCH_CONSTELLATIONS, SKY_NAMES, NODE_GROUND_X, NODE_GROUND_Y, drawConstellation, starBadge } from './sky-layout.mjs';
import { createSkyMap } from './map-curriculum.mjs';
import { skyAccent } from './sky-palette.mjs';
import { constrainCamera, overviewCamera, resizeCamera, pinchCamera } from './map-camera.mjs';
import { courseSections, courseSectionsUnlocked, renderCoursePanel } from './course-panel.mjs';
import { attachMapPan } from './map-pan.mjs';
import { createFramePainter } from './frame-painter.mjs';
import { createSmoothZoom, wheelZoomFactor } from './smooth-zoom.mjs';
import { showCourseDossier, attachSidePanelDismiss } from './side-panel.mjs';
import { createOrbitLayout, orbitSceneBounds } from './orbit-layout.mjs';
import { attachSkyMotion } from './sky-motion.mjs';
import { attachConstellationRotation } from './constellation-rotation.mjs';
import { attachOverviewTooltip } from './overview-tooltip.mjs';
import { civincoPortalMarkup } from './civinco-portal.mjs';
import { attachComets } from './comets.mjs';
import {COURSE_GRADING_SCHEMES,gradeForecast,gradeForecastText,gradeFormValues} from './grade-calculator.mjs';
import {attachMobileSky,createMobileScene} from './mobile-sky.mjs';
import { COURSES, COURSE_BY_ID, SPECIALIZATIONS, CELE_DOMAINS } from './curriculum.mjs';
import { newProgress, selected, courseAccess, setAcademicYear, setAcademicTerm, currentAcademicTerm, confirmSpecialization, changeSpecialization, recordAcademicProgress, progressSummary, gateStatus } from './progression.mjs';
import { loadProgress } from './storage.mjs';
import { setupAccount } from './account-browser.mjs';
import { avatarBadge, wardrobeMarkup, equipCosmetic, unlockedFrames } from './cosmetics.mjs';
const $=s=>document.querySelector(s);
installAuthorMark(document);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let progress,storageOK=true;
try{progress=loadProgress(localStorage);}catch{progress=newProgress();storageOK=false;setTimeout(()=>toast('Existing storage could not be read. This session will remain unsaved.'),500);}
const view={year:1,branch:selected(progress),preview:false,course:null,connection:null,reward:null,section:0,page:'map',scale:1,x:0,y:0};
const initialAcademic=progressSummary(progress).academic;
let resetOrigin;
let constellationRotation;
let zoomController;
let mobileSky;
let lastSkyScale=null;
const gradeDrafts=new Map();
let transferMode=false,toastTimer,shownMap,mapBounds,previousAcademicFill=100*initialAcademic.complete/initialAcademic.total,sharedCamera=null,lastRenderedBranch=null;
const icon=key=>`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
 bridge:'<path d="M4 35H44M9 35V16M39 35V16M9 19Q24 41 39 19M15 35V27M21 35V30M27 35V30M33 35V27M6 16H12M36 16H42M4 38H44"/>',
 mountain:'<path d="M3 36L17 10L31 36M21 36L32 16L45 36M11 22L17 19L22 23M27 25L32 23L36 26M5 40H44M17 28L14 36M27 40L25 44M35 39L39 44"/>',
 water:'<path d="M5 27Q11 22 17 27T29 27T43 27M5 34Q11 29 17 34T29 34T43 34M5 41Q11 36 17 41T29 41T43 41M25 4Q35 15 35 18A10 10 0 0 1 15 18Q15 15 25 4ZM21 17Q19 21 24 23"/>',
 road:'<path d="M9 43L20 5M39 43L28 5M24 7V13M24 19V25M24 31V38M5 14H17M31 14H43M4 33H12M36 33H44M9 10V18M39 10V18"/>',
 crane:'<path d="M16 41V7L25 3V41M9 41H31M7 7H43L25 3M7 7L16 13H40M7 7V14M39 13V27M36 27Q36 32 40 31M16 14L25 22L16 29L25 37M25 14L16 22L25 29L16 37M3 43H45"/>'
}[key] || ''}</svg>`;
const terrain='';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
const account=setupAccount({storage:localStorage,document,onError:toast,onProgress:next=>{
 gradeDrafts.clear();progress=next;view.course=null;view.reward=null;view.connection=null;view.preview=false;view.branch=selected(next);sharedCamera=null;lastRenderedBranch=null;
 renderAll();requestAnimationFrame(()=>view.branch?focusBranch():fitMap());
}});
function commit(next,message){
 if(!account.model.state().ready){toast('Finish loading or choosing your account journey first.');return;}
 account.model.save(next);progress=next;
 storageOK=account.model.state().phase!=='local-error';renderAll();if(message)toast(message);
}
function isPreview(c){return view.preview || (!!c.specialization && selected(progress)!==c.specialization);}
function pathCard(){
 const branch=selected(progress),s=progressSummary(progress),a=s.academic,fill=100*a.complete/a.total;
 $('#path-card').innerHTML=`<div class="path-summary"><div class="path-identity"><span class="path-dot"></span><strong>${branch?branch+' · Confirmed, self-reported':'Undecided'}</strong><span class="path-scope">${branch?'Shared + '+branch:'Shared curriculum · provisional'}</span></div>${branch?'<button class="path-link" data-action="change">Change specialization</button>':progress.academicYear>=3?'<button class="primary" data-action="confirm">Confirm specialization</button>':''}</div><div class="journey-progress ${fill>previousAcademicFill?'journey-earned':''} ${a.complete===0?'journey-empty':''}"><div class="journey-label"><span>Academic journey</span><strong>${a.complete}<span> / ${a.total} courses</span></strong><b>${a.percent}%</b></div><div id="academic-progress" class="journey-track" role="progressbar" aria-label="Required academic courses completed" aria-valuemin="0" aria-valuemax="${a.total}" aria-valuenow="${a.complete}" aria-valuetext="${a.complete} of ${a.total} required courses completed${s.provisional?', provisional shared curriculum':''}"><div class="journey-fill" style="width:${previousAcademicFill}%"><span aria-hidden="true">✦</span></div></div></div>`;
 // Preserve the previous fill across re-renders so completing a course advances the light.
 void $('#academic-progress').offsetWidth;
 requestAnimationFrame(()=>$('#academic-progress .journey-fill').style.width=fill+'%');
 previousAcademicFill=fill;
}

function courseCard(){
 const dialog=$('#course-card'),c=COURSE_BY_ID[view.course];
 $('.workspace').classList.toggle('inspector-open',!!c);
 if(!c){if(dialog.open)dialog.close();dialog.innerHTML='';return;}
 if(!courseSectionsUnlocked(progress,c))view.section=0;
 dialog.innerHTML=renderCoursePanel(progress,c,{preview:isPreview(c),section:view.section,reward:view.reward});
 const gradeForm=dialog.querySelector('[data-grade-course]');if(gradeForm){const draft=gradeDrafts.get(c.id);if(draft)for(const [key,value] of Object.entries(draft))gradeForm.elements.namedItem(key).value=value;updateGradeCalculator(gradeForm);}
 if(!dialog.open)showCourseDossier(dialog);
}
function updateGradeCalculator(form){
 const scheme=COURSE_GRADING_SCHEMES[form.dataset.gradeCourse];if(!scheme)return;
 try{const values=gradeFormValues(form,scheme);gradeDrafts.set(form.dataset.gradeCourse,values.draft);form.querySelector('output').textContent=gradeForecastText(gradeForecast(values.scheme,values.scores,values.target,{requirements:values.requirements}));}
 catch(failure){form.querySelector('output').textContent=failure.message;}
}
for(const event of ['input','change'])document.addEventListener(event,e=>{const form=e.target.closest('[data-grade-course]');if(form)updateGradeCalculator(form);});
document.addEventListener('submit',e=>{if(e.target.matches('[data-grade-course]'))e.preventDefault();});
function closeCourse(){const id=view.course;view.course=null;courseCard();renderMap();document.querySelector('[data-course="'+id+'"]')?.focus({preventScroll:true});}
function focusCourse(id){
 const p=constellationRotation?.getPosition(id)||shownMap.positions[id];if(!p)return;
 const r=$('#map-viewport').getBoundingClientRect();lastViewport=r;view.scale=Math.max(.6,Math.min(1,view.scale));
 view.x=r.width/2-(p.x+NODE_GROUND_X)*view.scale;view.y=r.height*.45-(p.y+NODE_GROUND_Y)*view.scale;applyTransform();
}
function branchCards(){
 $('#specialization-selection').textContent=view.branch?(view.branch+' · '+(selected(progress)===view.branch?'Active':'Preview')):selected(progress)?selected(progress)+' · Active path':'Explore a branch';
 $('#specialization-menu summary').setAttribute('aria-label','Specializations: '+$('#specialization-selection').textContent);
 $('#branch-cards').innerHTML=Object.entries(SPECIALIZATIONS).map(([id,b])=>`<button class="branch-card ${selected(progress)===id?'current':''} ${view.branch===id?'viewing':''}" style="${skyAccent(BRANCH_CONSTELLATIONS[id])}" data-branch="${id}" aria-pressed="${view.branch===id}" title="${esc((view.branch===id?'Hide ':'Show ')+b.name+' on the shared sky')}"><span class="branch-check" aria-hidden="true">${view.branch===id?'✓':'+'}</span><span class="branch-symbol">${icon(b.icon)}</span><strong>${id}</strong><span class="branch-name">${SKY_NAMES[BRANCH_CONSTELLATIONS[id]]}</span><small>${selected(progress)===id?'Active path':'Preview'}</small></button>`).join('');
}
function courseState(c){
 const preview=isPreview(c),r=progress.academicRecords[c.id],access=courseAccess(progress,c.id);
 return preview?'preview':r?.status==='COMPLETED'?'completed':r?.status==='ACTIVE'?'active-course':access.allowed?'available':'locked';
}
function courseButton(c,p,trace=null){
 const state=courseState(c);
 return `<button class="course-node ${state} ${c.specialization?'specialization-node':''} ${view.course===c.id?'selected-node':''} ${trace?(trace.ids.has(c.id)?'path-member':'path-muted'):''} ${view.reward?.id===c.id?'just-completed':''}" style="left:${p.x}px;top:${p.y}px;--label-x:${p.labelX}px;--label-y:${p.labelY}px;--node-perspective:${p.perspective.toFixed(3)};${skyAccent(p.chart)}" data-course="${c.id}" data-specialization="${c.specialization||''}" data-constellation="${p.chart}" aria-label="${c.id}, ${esc(c.title)}, ${state}">${starBadge()}<span class="node-copy"><strong class="node-code">${c.id}</strong><span class="node-title" aria-hidden="true">${esc(c.title)}</span></span></button>`;
}
function renderMap(reset=false){
 const map=createOrbitLayout(createSkyMap(view.branch)),{courses,positions}=map;shownMap=map;mapBounds=orbitSceneBounds(map);
 $('#map-viewport').classList.toggle('revealing-branch',!!view.branch&&view.branch!==lastRenderedBranch);lastRenderedBranch=view.branch;
 let html=terrain;
 $('#map-title').textContent='Civil Engineering';
 $('#map-mode').textContent=view.preview?'EXPLORE MODE · NO PROGRESS CHANGES':view.branch?(selected(progress)===view.branch?'ACTIVE PATH · ':'PREVIEW BRANCH · ')+view.branch:'YEARS I–IV · SHARED CURRICULUM';
 const outline=(chart,list)=>{
  const recorded=list.filter(c=>!isPreview(c)&&['ACTIVE','COMPLETED'].includes(progress.academicRecords[c.id]?.status));
  const completed=recorded.filter(c=>progress.academicRecords[c.id].status==='COMPLETED').length;
  const lights=recorded.map(c=>({anchor:positions[c.id].anchorIndex,strength:progress.academicRecords[c.id].status==='COMPLETED'?1:.7}));
  return drawConstellation(chart,{bounds:chart.orbit.bounds,scope:list[0]?.id,total:list.length,lights,activated:recorded.length-completed,completed});
 };
 map.charts.forEach(({chart,term,label})=>{
  html+=outline(chart,courses.filter(c=>!c.specialization&&c.term===term));
  html+=`<div class="term-label" data-term="${term}" style="left:${label.x}px;top:${label.y}px;${skyAccent(chart.id)}"><div class="cluster-meta"><span class="cluster-year">Year ${['I','II','III','IV'][Math.ceil(term/3)-1]}</span><span class="cluster-term">Term ${String(term).padStart(2,'0')}</span></div><strong>${chart.name}</strong></div>`;
 });
 if(map.branchChart){
  const chart=map.branchChart;
  html+=`<div class="specialization-constellation">${outline(chart,courses.filter(c=>c.specialization===view.branch))}</div><div class="specialization-heading" style="left:${map.branchLabel.x}px;top:${map.branchLabel.y}px;${skyAccent(chart.id)}"><span>${view.branch} · ${selected(progress)===view.branch?'ACTIVE PATH':'PREVIEW'}</span><strong>${chart.name}</strong><button data-action="shared">Hide constellation</button></div>`;
 }
 const trace=traceConnection(courses,view.connection);
 if(!trace)view.connection=null;
 let lines='',hits='',shadows='';
 courseConnections(courses).forEach(edge=>{
  const start=positions[edge.from],end=positions[edge.to],sx=start.x+NODE_GROUND_X,sy=start.y+NODE_GROUND_Y,ex=end.x+NODE_GROUND_X,ey=end.y+NODE_GROUND_Y,bend=Math.min(180,Math.abs(ex-sx)*.4);
  const d=`M ${sx} ${sy} C ${sx+bend} ${sy}, ${ex-bend} ${ey}, ${ex} ${ey}`;
  const state=trace?(edge.key===view.connection?'path-selected':trace.edges.has(edge.key)?'path-traced':'path-muted'):'';
  const specialist=COURSE_BY_ID[edge.to].specialization || COURSE_BY_ID[edge.from].specialization;
  shadows+=`<path d="${d}"/>`;
  lines+=`<path class="connection-line ${edge.type==='C'?'coreq':''} ${specialist?'specialization-thread':''} ${state}" data-edge="${edge.key}" style="${specialist?skyAccent(BRANCH_CONSTELLATIONS[specialist]):''}" d="${d}"/>`;
  hits+=`<path class="connection-hit" d="${d}" data-connection="${edge.key}" role="button" tabindex="0" aria-pressed="${edge.key===view.connection}" aria-label="${esc(COURSE_BY_ID[edge.from].title+' to '+COURSE_BY_ID[edge.to].title+', '+CONNECTION_TYPES[edge.type])}"/>`;
 });
 html+=`<svg class="graph-lines" viewBox="0 0 ${map.width} ${map.height}" aria-label="Course prerequisite connections"><g class="thread-shadows" transform="translate(10 24)">${shadows}</g>${lines}${hits}</svg>`;
 html+=courses.map(c=>courseButton(c,positions[c.id],trace)).join('');
 html+=civincoPortalMarkup(map.portal,gateStatus(progress));
 $('#map-viewport').classList.toggle('tracing-path',!!trace);
 renderConnectionCard(trace);
 $('#world').innerHTML=html;$('#world').style.width=map.width+'px';$('#world').style.height=map.height+'px';
 constellationRotation?.setMap(map);
 if(mobileSky?.active)mobileSky.setScene(createMobileScene(map,{getState:courseState,selectedCourse:view.course,connectionKey:view.connection,gateLabel:gateStatus(progress).cleared?'CELE Hardmode unlocked':gateStatus(progress).eligible?'Ready for integration':'View gate requirements'}));
 if(reset)fitMap();else applyTransform();
 $('.explore-button').setAttribute('aria-pressed',String(view.preview));
 document.querySelectorAll('[data-year]').forEach(b=>{b.classList.toggle('active',+b.dataset.year===view.year);b.setAttribute('aria-pressed',String(+b.dataset.year===view.year));});
}

function renderConnectionCard(trace){
 const panel=$('#connection-card');panel.hidden=!trace;$('.workspace').classList.toggle('path-inspector-open',!!trace&&!view.course);
 if(!trace){panel.innerHTML='';return;}
 const item=c=>`<button data-course="${c.id}" class="connection-course"><small>${c.id} · Year ${c.year}</small><strong>${esc(c.title)}</strong></button>`;
 panel.innerHTML=`<header><div><span class="connection-eyebrow">CONNECTED PATH</span><h2>Follow the thread</h2></div><button data-action="clear-connection" aria-label="Close connected path">×</button></header><p class="connection-type">${CONNECTION_TYPES[trace.link.type]}</p><div class="connection-pair">${item(COURSE_BY_ID[trace.link.from])}<span aria-hidden="true">↓</span>${item(COURSE_BY_ID[trace.link.to])}</div><div class="connection-chain">${trace.before.length?'<h3>Leads into this link</h3>'+trace.before.map(item).join(''):''}${trace.after.length?'<h3>Builds from this link</h3>'+trace.after.map(item).join(''):''}</div><p class="connection-caption" role="status">${trace.ids.size} connected courses on this map · Click a course to inspect</p>`;
}
function selectConnection(key){view.connection=key;renderMap();document.querySelector('[data-connection="'+key+'"]')?.focus({preventScroll:true});}
function clearConnection(){view.connection=null;renderMap();}
function applyTransform(){
 cameraPainter?.cancel();
 zoomController?.cancel();
 if(mapBounds)Object.assign(view,constrainCamera(view,$('#map-viewport').getBoundingClientRect(),mapBounds));
 paintCamera();
}
function paintCamera(){
 if(!mobileSky?.active)cameraWorld.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;
 mobileSky?.paint();
 const sky=viewport;
 const moving=sky.classList.contains('dragging')||sky.classList.contains('zooming');
 // Keep the scene's inherited SVG styles stable during a gesture. Only the
 // camera transform changes; refresh sharpness once the fingers come to rest.
 if(!moving&&lastSkyScale!==view.scale){
  const overview=Math.max(0,Math.min(1,(.4-view.scale)/.25));
  sky.style.setProperty('--chart-stroke',Math.max(1.8,.4/view.scale).toFixed(3)+'px');
  sky.style.setProperty('--chart-visibility',(.3-.06*overview).toFixed(3));
  sky.style.setProperty('--local-stroke',Math.max(3,.65/view.scale).toFixed(3)+'px');
  sky.style.setProperty('--active-star-size',(1+.25*overview).toFixed(3));
  sky.style.setProperty('--completed-star-size',(1+.4*overview).toFixed(3));
  sky.style.setProperty('--star-edge',Math.max(1.2,.3/view.scale).toFixed(3)+'px');
  lastSkyScale=view.scale;
 }
 if(!moving){
 sky.style.setProperty('--far-x',Math.tanh(view.x/1100)*45+'px');
 sky.style.setProperty('--far-y',Math.tanh(view.y/1800)*45+'px');
 sky.style.setProperty('--near-x',Math.tanh(view.x/1100)*85+'px');
 sky.style.setProperty('--near-y',Math.tanh(view.y/1800)*85+'px');
 sky.style.setProperty('--sky-scale',1+(view.scale-1)*.07);
 }
 const traveling=cameraWorld.classList.contains('navigation-motion');
 if(sky.classList.contains('camera-travel')!==traveling)sky.classList.toggle('camera-travel',traveling);
 const label=Math.round(view.scale*100)+'%';if(cameraLabel.textContent!==label)cameraLabel.textContent=label;
 if(sky.classList.contains('map-overview')!==(view.scale<=.2))sky.classList.toggle('map-overview',view.scale<=.2);
 overviewTooltip.refresh();
}
function fitMap({overview=false}={}){
 const r=$('#map-viewport').getBoundingClientRect();if(!r.width)return;lastViewport=r;
 if(overview)Object.assign(view,overviewCamera(r,mapBounds));
 else {const chart=shownMap.charts.find(c=>c.term===(view.year-1)*3+1).chart;const {center,radius}=chart.orbit;view.scale=Math.max(.4,Math.min(.7,(r.width-80)/(radius*1.5),(r.height-80)/(radius*1.5)));view.x=r.width/2-center.x*view.scale;view.y=r.height/2-center.y*view.scale;}
 applyTransform();
}
function focusBranch(){
 const chart=shownMap.branchChart;if(!chart)return;
 const r=$('#map-viewport').getBoundingClientRect();
 lastViewport=r;const {center,radius}=chart.orbit;view.scale=Math.max(.4,Math.min(.7,(r.width-80)/(radius*1.5),(r.height-80)/(radius*1.5)));
 view.x=r.width/2-center.x*view.scale;
 view.y=r.height/2-center.y*view.scale;
 applyTransform();
}
function revealBranch(branch){
 $('#specialization-menu').open=false;
 stopMapTravel();view.connection=null;view.course=null;
 if(view.branch===branch){
  view.branch=null;if(sharedCamera)view.year=sharedCamera.year;renderAll();
  animateMapTravel(()=>{if(sharedCamera){Object.assign(view,sharedCamera);applyTransform();}else fitMap();});
 }else{
  if(!view.branch)sharedCamera={x:view.x,y:view.y,scale:view.scale,year:view.year};
  view.branch=branch;view.year=3;renderAll();animateMapTravel(focusBranch);
 }
}

let travelTimer;
function stopMapTravel(){
 const world=$('#world');
 if(!world.classList.contains('navigation-motion'))return;
 const match=window.getComputedStyle(world).transform.match(/^matrix(3d)?\(([^)]+)\)$/);
 if(match){const values=match[2].split(',').map(Number);view.scale=values[0];view.x=values[match[1]?12:4];view.y=values[match[1]?13:5];}
 clearTimeout(travelTimer);world.classList.remove('navigation-motion');applyTransform();
}
function animateMapTravel(move){
 if(mobileSky?.active){move();return;}
 void $('#world').offsetWidth;
 $('#world').classList.add('navigation-motion');move();
 travelTimer=setTimeout(()=>{$('#world').classList.remove('navigation-motion');$('#map-viewport').classList.remove('camera-travel');},700);
}
function travelToYear(year){
 stopMapTravel();view.connection=null;view.year=year;view.course=null;renderAll();
 animateMapTravel(fitMap);
}


function zoom(factor,cx,cy){
 stopMapTravel();const r=lastViewport;cx??=r.width/2;cy??=r.height/2;
 cameraPainter.cancel();zoomController.zoom(factor,cx,cy);
}
function milestone(){const visible=progress.academicYear>=3&&!selected(progress);$('#commitment-banner').innerHTML=visible?'<div class="commitment-banner"><div><strong>Year III · Choose your calling</strong><p>Shared subjects stay available while you await acceptance.</p></div><button class="primary" data-action="confirm">Confirm specialization →</button></div>':'';}
function journal(){
 const s=progressSummary(progress),branch=selected(progress),r=progress.specializationProgression;
 const records=Object.entries(progress.academicRecords);
 $('#journal-page').innerHTML=`<div class="eyebrow">EVERY STEP LEAVES A TRACE</div><h1>Your field <em>journal.</em></h1><p>A record of your foundations, your chosen path, and every chapter before it.</p><div class="journal-layout"><div class="paper-card"><div class="card-eyebrow">ACADEMIC STANDING</div><h2>Where are you today?</h2><p>Your academic year is self-reported. Browsing another year on the map does not change this setting.</p><label class="field-label" for="academic-year">My academic year</label><select class="year-select" id="academic-year">${[1,2,3,4].map(y=>`<option value="${y}" ${progress.academicYear===y?'selected':''}>Year ${y}</option>`).join('')}</select><label class="field-label" for="academic-term">My current term</label><select class="year-select" id="academic-term">${[1,2,3].map(t=>{const absolute=(progress.academicYear-1)*3+t;return `<option value="${absolute}" ${currentAcademicTerm(progress)===absolute?'selected':''}>Term ${t}</option>`;}).join('')}</select><p class="card-note">New activations record this term. A lab requires its lecture in this term or an earlier term. Year 3 introduces specialization commitment. Prerequisites still apply to course activation.</p></div><div class="paper-card"><div class="card-eyebrow">YOUR CHOSEN SPECIALIZATION</div><h2>${branch?esc(SPECIALIZATIONS[branch].region):'Still discovering'}</h2><p>${branch?esc(SPECIALIZATIONS[branch].name):'Explore every specialization. There is no selection required during your first two years.'}</p><div class="path-state">${r.specializationStatus} ${branch?'· SELF_REPORTED':''}</div>${branch?`<p class="card-note">Confirmed ${esc(new Date(r.confirmedAt).toLocaleDateString())}. Selection is self-reported, not university-verified.</p><button class="secondary full" data-action="change">Change specialization</button>`:progress.academicYear>=3?'<button class="primary full" data-action="confirm">Confirm my accepted specialization →</button>':''}</div><div class="paper-card"><div class="card-eyebrow">ACTIVE PATH PROGRESS</div><h2>${s.academic.percent}% of the academic journey</h2><p>${s.academic.complete} / ${s.academic.total} required technical courses complete${s.provisional?' · provisional shared scope':''}.</p><div class="progress-track"><div style="width:${s.academic.percent}%"></div></div><p>${s.mastery.complete} / ${s.mastery.total} required mastery nodes. Quizzes are reserved for a later phase.</p><p class="card-note">Shared technical courses plus your confirmed specialization. Labs remain academic requirements and are excluded from the configured mastery scope. General education, PE, NSTP and OJT are outside this app’s technical scope.</p></div><div class="paper-card"><div class="card-eyebrow">YOUR RECORDS BELONG TO YOU</div><h2>Keep a trail.</h2><p>${account.model.state().user?'Your account journey saves to the cloud, with a separate copy on this device.':'Guest progress stays in this browser. Sign in with Google after cloud setup to save across devices.'} Export a copy to keep your course records, specialization history and future quiz attempts safe.</p><button class="secondary full" data-action="export">Export progress backup ↓</button><button class="reset-progress-button journal-reset" data-action="reset-progress">Reset progress</button><p class="card-note">${storageOK?'Browser storage is available.':'Browser storage is unavailable. Export before leaving this session.'} Changing specialization never removes historical records.</p></div></div><div class="journal-records"><h2>Academic records <em>(${records.length})</em></h2>${records.length?`<table class="records-table"><thead><tr><th>COURSE</th><th>SUBJECT</th><th>RECORD</th><th>PATH</th></tr></thead><tbody>${records.map(([id,r])=>{const c=COURSE_BY_ID[id];return `<tr><td>${esc(id)}</td><td>${esc(c?.title || id)}</td><td>${r.status==='COMPLETED'?'Completed':'Active'}</td><td>${c?.specialization?c.specialization+(c.specialization!==branch?' · historical':' · current'):'Shared'}</td></tr>`;}).join('')}</tbody></table>`:'<div class="journal-empty">Your first field note is waiting. Activate an available shared course on the World map.</div>'}</div><div class="journal-records"><h2>Previous specialization history</h2>${r.previousSpecializationHistory.length?r.previousSpecializationHistory.map(h=>`<div class="history-row"><strong>${esc(h.selectedSpecialization)} → ${esc(h.changedTo)}</strong> · ${esc(new Date(h.changedAt).toLocaleDateString())}<br>${esc(h.reason)}<br><span class="muted">Academic records and quiz attempts retained.</span></div>`).join(''):'<p>No transfers or corrections recorded.</p>'}</div><div class="journal-records"><h2>Assessment history</h2><p>${progress.quizAttempts.length} quiz attempts · ${progress.integrationAssessments.length} integration assessment attempts. Assessments are reserved for a later chapter.</p></div>`;
}
function gate(){const g=gateStatus(progress);$('#gate-page').innerHTML=`<div class="eyebrow">THE SHARED SUMMIT</div><h1>One final <em>integration.</em></h1><p>Five specializations lead to the same Civil Engineering integration assessment.</p><div class="gate-layout"><div class="gate-illustration"><svg viewBox="0 0 240 190" aria-hidden="true"><path d="M20 166H221M39 164V57H83V164M157 164V57H201V164M49 57V37H60V49H69V37H79V57M162 57V37H173V49H182V37H193V57M83 78Q120 21 157 78M82 105Q121 49 157 105M94 165V113Q120 78 146 113V165M104 162V117Q120 92 136 117V162M55 76H67V92H55ZM173 76H185V92H173ZM60 121V134M179 121V134M31 170L14 177M215 170L230 178M114 140H127M120 103V165"/><path d="M114 25L120 12L126 25L120 39Z"/></svg><h2>The CIVINCO Gate</h2><div class="path-state">${g.cleared?'CLEARED':g.eligible?'READY FOR ASSESSMENT':'THE JOURNEY CONTINUES'}</div><p>Complete your required academic path and Normal Mode mastery, then clear the common integration assessment.</p><button class="primary full" disabled>Integration assessment · coming later</button><p class="card-note">Quizzes are paused for this skeleton phase.</p></div><div class="paper-card"><div class="card-eyebrow">GATE REQUIREMENTS</div>${[[!!selected(progress),'Confirmed academic path',selected(progress)?selected(progress)+' · self-reported':'Confirm your accepted specialization from Year 3'],[g.summary.academic.complete===g.summary.academic.total,'Required academic completion',g.summary.academic.complete+' / '+g.summary.academic.total+' shared + selected-path courses'],[g.summary.mastery.complete===g.summary.mastery.total,'Required Normal Mode mastery',g.summary.mastery.complete+' / '+g.summary.mastery.total+' configured mastery nodes'],[g.cleared,'Common integration assessment',g.cleared?'Passed · CELE Hardmode unlocked':'A common CIVINCO assessment for all students']].map(([ok,title,note])=>`<div class="gate-check"><span>${ok?'✓':'◇'}</span><div><strong>${title}</strong><small>${esc(note)}</small></div></div>`).join('')}<p class="card-note">Unselected specialization branches never block this gate. A passed CIVINCO assessment is retained through a specialization transfer.</p></div></div><div class="section-heading"><h2>Beyond the gate: <em>CELE Hardmode.</em></h2><span>${g.hardmodeUnlocked?'UNLOCKED':'LOCKED UNTIL CIVINCO IS CLEARED'}</span></div><div class="domains">${CELE_DOMAINS.map((d,i)=>`<div class="domain"><small>EXAMINATION DOMAIN ${String(i+1).padStart(2,'0')}</small><h3>${esc(d)}</h3><p>${g.hardmodeUnlocked?'Unlocked for shared review. Assessment content is coming in a later phase.':'Unlocks after the common integration assessment. Shared by all specializations.'}</p></div>`).join('')}</div><p class="card-note">Specialist knowledge remains accessible as optional review through the world map. Examination domain labels are configurable app groupings.</p>`;}
function renderAll(reset=false){renderCompanion();pathCard();courseCard();branchCards();milestone();renderMap(reset);journal();gate();$('#traveler-year').textContent='Year '+progress.academicYear+' · '+(selected(progress)||'Explorer');$('.local-label').innerHTML=`<i></i>${storageOK?'Saved on this browser':'Session only · export backup'}`;}
function renderCompanion(){
 $('#companion-portrait').innerHTML=avatarBadge(progress);
 const dialog=$('#wardrobe-dialog');
 if(dialog.open)dialog.innerHTML='<button class="account-dialog-close" data-action="close-wardrobe" aria-label="Close wardrobe">×</button>'+wardrobeMarkup(progress);
}
function openPathDialog(change=false){
 transferMode=change;$('#path-form').reset();$('#dialog-error').textContent='';$('#dialog-eyebrow').textContent=change?'A TRANSFER. A CORRECTION. A NEW CHAPTER.':'YEAR III · A NEW CHAPTER';$('#dialog-title').innerHTML=change?'Change your <em>path.</em>':'Choose your <em>calling.</em>';
 $('#dialog-intro').textContent=change?'Choose the specialization you transferred into, or correct an earlier selection. Your past academic and quiz records will be retained.':'Select the specialization you were accepted into. You can keep progressing through shared courses while awaiting acceptance.';
 $('#reason-label').classList.toggle('hidden',!change);$('#transfer-reason').required=change;
 $('#dialog-branches').innerHTML=Object.entries(SPECIALIZATIONS).filter(([id])=>!change||id!==selected(progress)).map(([id,b])=>`<label class="branch-option" style="--branch-color:${b.color}"><input type="radio" name="specialization" value="${id}" required>${icon(b.icon)}<div><strong>${id} · ${esc(b.name)}</strong><span>${esc(b.region)}</span></div></label>`).join('');
 $('#confirm-path').textContent=change?'Confirm change of specialization →':'Confirm my specialization →';$('#path-dialog').showModal();
}
function openResetDialog(origin){
 if(!account.model.state().ready){toast('Finish loading or choosing your account save before resetting.');return;}
 $('#reset-description').textContent='Start again in Year 1 with no selected specialization. This clears course completion, mastery, quiz attempts, specialization history, and CIVINCO / Hardmode progress '+(account.model.state().user?'for this account, including its cloud save.':'saved in this browser.');
 resetOrigin=origin;$('#reset-error').textContent='';$('#reset-dialog').showModal();$('#cancel-reset').focus();
}
function cancelReset(){
 $('#reset-dialog').close();resetOrigin?.focus({preventScroll:true});
}
function resetTestingProgress(){
 if(!$('#reset-dialog').open)return;
 try{
  const clean=account.model.state().user?newProgress():account.model.resetGuest();
  account.model.save(clean);
  stopMapTravel();progress=clean;storageOK=true;transferMode=false;
  Object.assign(view,{year:1,branch:null,preview:false,course:null,connection:null,reward:null,section:0,scale:1,x:0,y:0});
  sharedCamera=null;lastRenderedBranch=null;previousAcademicFill=0;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  renderAll();showPage('map');fitMap();$('#reset-progress').focus({preventScroll:true});
  toast('Progress reset. Your journey starts again in Year 1.');
 }catch{
  $('#reset-error').textContent='The reset could not be saved in this browser. Your current progress is unchanged. Try again after enabling browser storage.';
 }
}
function showPage(page){zoomController?.cancel();view.course=null;courseCard();view.page=page;document.querySelectorAll('main>.page').forEach(s=>s.classList.toggle('hidden',s.id!==page+'-page'));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#page-breadcrumb').textContent={map:'WORLD MAP',journal:'FIELD JOURNAL',gate:'CIVINCO GATE'}[page];if(page==='map')requestAnimationFrame(applyTransform);window.scrollTo({top:0});}
document.addEventListener('click',e=>{
 const edge=e.target.closest('[data-connection]');if(edge){selectConnection(edge.dataset.connection);return;}
 const b=e.target.closest('button');if(!b)return;
 if((b.dataset.academic||['confirm','change','reset-progress'].includes(b.dataset.action))&&!account.model.state().ready){toast('Finish loading or choosing your account journey first.');return;}
 if(b.dataset.action==='wardrobe'){$('#wardrobe-dialog').showModal();renderCompanion();return;}
 if(b.dataset.action==='close-wardrobe'){$('#wardrobe-dialog').close();$('#companion-button').focus();return;}
 if(b.dataset.avatar||b.dataset.frame){try{commit(equipCosmetic(progress,b.dataset.avatar?'avatar':'frame',b.dataset.avatar||b.dataset.frame),'Companion updated.');$('#wardrobe-dialog [data-'+(b.dataset.avatar?'avatar':'frame')+'="'+(b.dataset.avatar||b.dataset.frame)+'"]')?.focus();}catch(error){toast(error.message);}return;}
 if(b.dataset.page){setMapExpanded(false);showPage(b.dataset.page);return;}
 if(b.dataset.year){travelToYear(+b.dataset.year);return;}
 if(b.dataset.branch){revealBranch(b.dataset.branch);return;}
 if(b.dataset.course){const course=COURSE_BY_ID[b.dataset.course];view.reward=null;view.section=0;view.course=course.id;view.year=course.year;renderAll();animateMapTravel(()=>focusCourse(course.id));return;}
 if(b.dataset.courseLink){view.connection=null;view.reward=null;const c=COURSE_BY_ID[b.dataset.courseLink];if(c.specialization)view.branch=c.specialization;view.year=c.year;view.section=0;view.course=c.id;renderAll();return;}
 if(b.dataset.courseSection!==undefined){if(b.disabled||(+b.dataset.courseSection>0&&!courseSectionsUnlocked(progress,COURSE_BY_ID[view.course])))return;view.section=+b.dataset.courseSection;courseCard();$('#course-tab-'+view.section).focus({preventScroll:true});return;}
 if(b.dataset.academic){try{
  const next=recordAcademicProgress(progress,view.course,b.dataset.academic,{preview:isPreview(COURSE_BY_ID[view.course])});
  const beforeFrames=unlockedFrames(progress);view.reward=completionMoment(progress,next,view.course);
  const earned=unlockedFrames(next).filter(f=>!beforeFrames.some(old=>old.id===f.id));
  if(earned.length)setTimeout(()=>toast(earned.map(f=>f.name).join(', ')+' frame unlocked. Open My companion to equip it.'),900);
  commit(next,b.dataset.academic==='COMPLETED'?null:'Course activated on your academic path.');
  if(view.reward)skyMotion.celebrate();
  $('#course-card .reward-return, #course-card [data-academic]')?.focus({preventScroll:true});
 }catch(err){toast(err.message);}return;}
 if(b.dataset.action==='reset-progress'){openResetDialog(b);return;}
 if(b.dataset.action==='cancel-reset'){cancelReset();return;}
 if(b.dataset.action==='confirm-reset'){resetTestingProgress();return;}
 if(b.dataset.action==='clear-connection'){clearConnection();return;}
 if(b.dataset.action==='confirm'){openPathDialog();return;}
 if(b.dataset.action==='change'){openPathDialog(true);return;}
 if(b.dataset.action==='close-inspector'){closeCourse();return;}
 if(b.dataset.action==='shared'){if(view.branch)revealBranch(view.branch);return;}
 if(b.dataset.action==='exit-preview'){view.preview=false;renderAll();return;}
 if(b.dataset.action==='export'){const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='road-to-cele-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Your progress backup has been exported.');return;}
 if(b.classList.contains('dialog-close'))b.closest('dialog').close();
});
$('#explore-toggle').addEventListener('click',()=>{view.preview=!view.preview;$('#specialization-menu').open=view.preview;renderAll();toast(view.preview?'Exploration mode is on. Academic records stay unchanged.':'Returned to your active academic path.');});
$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
$('#path-form').addEventListener('submit',e=>{e.preventDefault();if(!account.model.state().ready){$('#dialog-error').textContent='Finish choosing your account journey first.';return;}const branch=new FormData(e.currentTarget).get('specialization');try{const options={confirmed:$('#acceptance-check').checked,reason:$('#transfer-reason').value};const next=transferMode?changeSpecialization(progress,branch,options):confirmSpecialization(progress,branch,options);$('#path-dialog').close();view.branch=branch;view.course=null;view.preview=false;commit(next,'Your '+branch+' path is confirmed. All previous records are retained.');animateMapTravel(focusBranch);}catch(err){$('#dialog-error').textContent=err.message;}});
document.addEventListener('change',e=>{if(e.target.id==='academic-term'){if(!account.model.state().ready){toast('Finish loading your journey first.');journal();return;}commit(setAcademicTerm(progress,+e.target.value),'Current term updated. Existing records are retained.');return;}if(e.target.id==='academic-year'){if(!account.model.state().ready){toast('Finish loading or choosing your account journey first.');journal();return;}commit(setAcademicYear(progress,+e.target.value),'Academic standing updated. Your records are retained.');}});
$('#zoom-in').addEventListener('click',()=>zoom(1.2));$('#zoom-out').addEventListener('click',()=>zoom(1/1.2));$('#fit-map').addEventListener('click',()=>fitMap({overview:true}));
function setMapExpanded(expanded){
 const panel=$('.map-panel'),button=$('#expand-map');
 if(panel.classList.contains('map-expanded')===expanded)return;
 stopMapTravel();panel.classList.toggle('map-expanded',expanded);
 document.body.classList.toggle('tree-expanded',expanded);
 $('.rail').inert=expanded;$('#commitment-banner').inert=expanded;
 button.setAttribute('aria-pressed',String(expanded));
 button.setAttribute('aria-label',expanded?'Return to page':'Expand tree');
 button.title=expanded?'Return to page (Esc)':'Expand tree';
 button.querySelector('span').textContent=expanded?'Return':'Expand';
 button.querySelector('svg path').setAttribute('d',expanded?'M3 9H9V3M21 9H15V3M15 21V15H21M9 21V15H3M3 3L9 9M21 3L15 9M21 21L15 15M3 21L9 15':'M9 3H3V9M15 3H21V9M21 15V21H15M9 21H3V15M3 3L9 9M21 3L15 9M21 21L15 15M3 21L9 15');
 requestAnimationFrame(resizeMap);
 button.focus({preventScroll:true});
}
$('#expand-map').addEventListener('click',()=>setMapExpanded(!$('.map-panel').classList.contains('map-expanded')));
attachBackdropDismiss($('#course-card'),closeCourse);
attachSidePanelDismiss($('#course-card'),closeCourse);
attachBackdropDismiss($('#wardrobe-dialog'),()=>$('#wardrobe-dialog').close());
$('#reset-dialog').addEventListener('cancel',e=>{e.preventDefault();cancelReset();});
document.addEventListener('keydown',e=>{
 const edge=e.target.closest?.('[data-connection]');
 if(edge&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectConnection(edge.dataset.connection);}
 if(e.key==='Escape'&&$('#course-card').open&&!document.querySelector('dialog[open]:not(#course-card)')){e.preventDefault();closeCourse();return;}
 if(e.key==='Escape'&&!document.querySelector('dialog[open]')){
  if(view.connection){e.preventDefault();clearConnection();}
  else if($('.map-panel').classList.contains('map-expanded')){e.preventDefault();setMapExpanded(false);}
 }
});
$('#course-card').addEventListener('cancel',e=>{e.preventDefault();closeCourse();});
$('#course-card').addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-course-section]');if(!tab)return;
 const offsets={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
 if(!(e.key in offsets)&&e.key!=='Home'&&e.key!=='End')return;
 const c=COURSE_BY_ID[view.course],count=courseSectionsUnlocked(progress,c)?courseSections(c).length:1;
 e.preventDefault();view.section=e.key==='Home'?0:e.key==='End'?count-1:(view.section+offsets[e.key]+count)%count;
 courseCard();$('#course-tab-'+view.section).focus({preventScroll:true});
});
const viewport=$('#map-viewport');
viewport.addEventListener('focusin',e=>{
 const key=e.target.dataset.connection;
 for(const line of viewport.querySelectorAll('.connection-line'))line.classList.toggle('connection-focused',!!key&&line.dataset.edge===key);
 if(mobileSky?.active&&e.target.dataset.course)focusCourse(e.target.dataset.course);
 mobileSky?.paint();
});
viewport.addEventListener('focusout',e=>{if(e.target.dataset.connection)for(const line of viewport.querySelectorAll('.connection-focused'))line.classList.remove('connection-focused');});
const cameraWorld=$('#world'),cameraLabel=$('#zoom-label');
const overviewTooltip=attachOverviewTooltip(viewport,{getCourse:id=>COURSE_BY_ID[id],getScale:()=>view.scale});
const cameraPainter=createFramePainter(paintCamera,{requestFrame:fn=>window.requestAnimationFrame(fn),cancelFrame:id=>window.cancelAnimationFrame(id)});
const zoomPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
zoomController=createSmoothZoom({
 getCamera:()=>({x:view.x,y:view.y,scale:view.scale}),
 onCamera:camera=>{Object.assign(view,camera);paintCamera();},
 constrain:camera=>constrainCamera(camera,lastViewport,mapBounds),
 getLimits:()=>({min:Math.min(.28,overviewCamera(lastViewport,mapBounds).scale),max:1.8}),
 requestFrame:fn=>window.requestAnimationFrame(fn),cancelFrame:id=>window.cancelAnimationFrame(id),now:()=>window.performance.now(),
 reducedMotion:()=>!!zoomPreference?.matches,
 onActivity:active=>{viewport.classList.toggle('zooming',active);overviewTooltip.refresh();}
});
viewport.addEventListener('pointerdown',e=>{if(!e.target.closest('button:not(.course-node),a,input,select,textarea'))zoomController.cancel();});
window.addEventListener('blur',()=>zoomController.cancel());
document.addEventListener('visibilitychange',()=>{if(document.hidden)zoomController.cancel();});
zoomPreference?.addEventListener('change',()=>{if(zoomPreference.matches)zoomController.finish();});
const skyMotion=attachSkyMotion(viewport);
attachComets(viewport);
constellationRotation=attachConstellationRotation(viewport,$('#rotate-sky'));
attachMapPan(viewport,{
 requestFrame:fn=>window.requestAnimationFrame(fn),cancelFrame:id=>window.cancelAnimationFrame(id),getViewport:()=>{lastViewport=viewport.getBoundingClientRect();return lastViewport;},
 getPosition:()=>{stopMapTravel();return {x:view.x,y:view.y};},
 onPan:position=>{Object.assign(view,constrainCamera({...view,...position},lastViewport,mapBounds));return {x:view.x,y:view.y};},
 onPinch:gesture=>{const limits={min:Math.min(.28,overviewCamera(lastViewport,mapBounds).scale),max:1.8};Object.assign(view,constrainCamera(pinchCamera(view,gesture,limits),lastViewport,mapBounds));},
 onFrame:()=>cameraPainter.flush(),onEnd:()=>cameraPainter.flush()
});
viewport.addEventListener('wheel',e=>{e.preventDefault();const r=lastViewport;zoom(wheelZoomFactor(e,r.height),e.clientX-r.left,e.clientY-r.top);},{passive:false});
let lastViewport=viewport.getBoundingClientRect();
mobileSky=attachMobileSky(viewport,{getCamera:()=>view,getViewport:()=>lastViewport,onModeChange:()=>{stopMapTravel();renderMap();}});
viewport.addEventListener('click',e=>{
 if(!mobileSky.active||e.target.closest('button,a,[data-connection]'))return;
 const r=viewport.getBoundingClientRect(),hit=mobileSky.pick({x:e.clientX-r.left,y:e.clientY-r.top});if(!hit)return;
 e.stopPropagation();
 const target=hit.kind==='course'?viewport.querySelector('[data-course="'+hit.id+'"]'):hit.kind==='connection'?viewport.querySelector('[data-connection="'+hit.id+'"]'):hit.kind==='hidebranch'?viewport.querySelector('[data-action="shared"]'):viewport.querySelector('.civinco-portal');
 target?.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));
});
function resizeMap(){
 if(view.page!=='map')return;
 const next=viewport.getBoundingClientRect();if(!next.width||!next.height)return;
 Object.assign(view,resizeCamera(view,lastViewport,next));lastViewport=next;applyTransform();
}
new ResizeObserver(resizeMap).observe(viewport);
renderAll();requestAnimationFrame(()=>view.branch?focusBranch():fitMap());
account.start();
