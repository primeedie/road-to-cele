// Follow a selected prerequisite in its direction, without pulling in unrelated siblings.
export const CONNECTION_TYPES={H:'Hard prerequisite · must be completed beforehand',S:'Soft prerequisite · must be taken beforehand',C:'Co-requisite · taken concurrently'};
export function courseConnections(courses){
 const ids=new Set(courses.map(c=>c.id));
 return courses.flatMap(c=>[['H',c.hardPrerequisites],['S',c.softPrerequisites],['C',c.corequisites]].flatMap(([type,list])=>list.filter(id=>ids.has(id)).map(from=>({from,to:c.id,type,key:`${from}:${c.id}:${type}`}))));
}
export function traceConnection(courses,key){
 const edges=courseConnections(courses),link=edges.find(e=>e.key===key);
 if(!link)return null;
 const walk=(start,reverse)=>{
  const seen=new Set([start]),pending=[start];
  while(pending.length){const id=pending.pop();for(const edge of edges){if((reverse?edge.to:edge.from)!==id)continue;const next=reverse?edge.from:edge.to;if(!seen.has(next)){seen.add(next);pending.push(next);}}}
  return seen;
 };
 const before=walk(link.from,true),after=walk(link.to,false),ids=new Set([...before,...after]);
 const sorted=courses.filter(c=>ids.has(c.id)).sort((a,b)=>a.term-b.term||a.id.localeCompare(b.id));
 const tracedEdges=new Set(edges.filter(e=>e.key===key||(before.has(e.from)&&before.has(e.to))||(after.has(e.from)&&after.has(e.to))).map(e=>e.key));
 return {link,ids,edges:tracedEdges,before:sorted.filter(c=>before.has(c.id)&&c.id!==link.from&&c.id!==link.to),after:sorted.filter(c=>after.has(c.id)&&c.id!==link.from&&c.id!==link.to)};
}
