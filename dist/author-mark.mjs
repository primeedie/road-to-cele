// milch pogiman made this, so u cant steal this lol
// Attribution belongs to the app; third-party fonts and chart data keep their own notices.
export const AUTHOR_NOTICE='milch pogiman made this, so u cant steal this lol';
export const AUTHOR_META='road-to-cele-author';
export const OWNERSHIP_NOTICE='property of freshmilch';
const installed=new WeakMap();

export function installAuthorMark(document){
 if(installed.has(document))return installed.get(document);
 const host=document.defaultView;
 const credit=Object.freeze({author:'milch pogiman',notice:AUTHOR_NOTICE,ownership:OWNERSHIP_NOTICE});
 if(!Object.hasOwn(host,'ROAD_TO_CELE_AUTHOR')){
  Object.defineProperty(host,'ROAD_TO_CELE_AUTHOR',{value:credit,writable:false,configurable:false,enumerable:false});
 }
 function preserveNotice(){
  let mark=document.head.querySelector(`meta[name="${AUTHOR_META}"]`);
  if(!mark){mark=document.createElement('meta');mark.name=AUTHOR_META;document.head.append(mark);}
  if(mark.content!==AUTHOR_NOTICE)mark.content=AUTHOR_NOTICE;
 }
 preserveNotice();
 // Keep the embedded page credit through DOM edits without touching the skill tree or records.
 const observer=new host.MutationObserver(preserveNotice);
 observer.observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['name','content']});
 const result=Object.freeze({credit});installed.set(document,result);return result;
}
