// Parse only bounded course tables. Cover sheets, contacts and adviser notes are ignored.
const clean=s=>String(s||'').replace(/[\u200b-\u200d\ufeff]/g,'').trim();
export const normalizeCourseCode=s=>clean(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
const ordinals=['FIRST','SECOND','THIRD','FOURTH','FIFTH','SIXTH','SEVENTH','EIGHTH','NINTH','TENTH','ELEVENTH','TWELFTH','THIRTEENTH','FOURTEENTH','FIFTEENTH','SIXTEENTH','SEVENTEENTH','EIGHTEENTH','NINETEENTH','TWENTIETH','TWENTYFIRST','TWENTYSECOND','TWENTYTHIRD','TWENTYFOURTH'];
export function bookletTerm(text){
 const normalized=clean(text).toUpperCase().replace(/[-\s]+/g,'');
 const index=ordinals.findIndex(s=>normalized===s+'TERM');if(index>=0)return index+1;
 const number=clean(text).match(/^(?:TERM\s*(\d{1,2})|(\d{1,2})(?:ST|ND|RD|TH)?\s*TERM)$/i);return number?Number(number[1]||number[2]):null;
}
export function parseBookletGrade(value){
 const text=clean(value).toUpperCase();
 if(!text)return {grade:null,gradeText:'',outcome:'UNGRADED'};
 if(/^(P|PASS|PASSED)$/.test(text))return {grade:null,gradeText:'P',outcome:'PASSED'};
 if(/^(F|FAIL|FAILED)$/.test(text))return {grade:0,gradeText:'F',outcome:'FAILED'};
 if(/^(?:0(?:\.0{1,2})?|[1-4](?:\.(?:00?|50?))?)$/.test(text)){
  const grade=Number(text);if(grade<=4)return {grade,gradeText:grade.toFixed(2),outcome:grade>=1?'PASSED':'FAILED'};
 }
 return {grade:null,gradeText:text.slice(0,16),outcome:'REVIEW'};
}
export function pdfTextLines(items){
 const lines=[];
 for(const item of items){if(typeof item.str!=='string'||!clean(item.str)||!Array.isArray(item.transform))continue;
  const x=item.transform[4],y=item.transform[5];if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  let line=lines.find(l=>Math.abs(l.y-y)<=2.5);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,text:clean(item.str)});
 }
 return lines.sort((a,b)=>b.y-a.y).map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x),text:l.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')}));
}
export function parseAdvisingPages(pages){
 const rows=[],warnings=[];const seen=new Map();
 for(const page of pages){
  const lines=pdfTextLines(page.items),headerIndex=lines.findIndex(l=>/COURSE\s*CODE/i.test(l.text)&&/UNITS/i.test(l.text)&&/GRADE/i.test(l.text));
  if(headerIndex<0)continue;
  const termLines=lines.slice(0,headerIndex).map(l=>bookletTerm(l.text)).filter(Boolean),term=termLines.at(-1);
  if(!term||term>60){warnings.push('Page '+page.number+': the table has no recognized journey term.');continue;}
  const header=lines[headerIndex],unitsHeader=header.items.find(i=>/^UNITS$/i.test(i.text)),gradeHeader=header.items.find(i=>/^GRADE$/i.test(i.text));
  if(!unitsHeader||!gradeHeader){warnings.push('Page '+page.number+': the table columns could not be separated.');continue;}
  const codeHeader=header.items.find(i=>/COURSE/i.test(i.text)),left=(codeHeader?.x??0)-100,codeRight=(codeHeader?.x??unitsHeader.x-120)+100;
  const unitsLeft=(codeRight+unitsHeader.x)/2,gradeLeft=(unitsHeader.x+gradeHeader.x)/2;
  for(const line of lines.slice(headerIndex+1)){
   if(/TERM\s*GPA|CGPA|ACCUMULATED\s*FAILURE|ADVISER|ADVISOR|TRIMESTRAL/i.test(line.text))break;
   const codeText=line.items.filter(i=>i.x>=left&&i.x<unitsLeft).map(i=>i.text).join(''),code=normalizeCourseCode(codeText);
   if(!/^[A-Z][A-Z0-9]{3,15}$/.test(code)||!/[0-9]/.test(code)&&!/^(?:GE|LC|CE|ENG|HWR|STE|GTE|TRE|CTM|DATA|FND|BAS)/.test(code))continue;
   const unitsText=line.items.filter(i=>i.x>=unitsLeft&&i.x<gradeLeft).map(i=>i.text).join('');
   if(!/^\(?\d{1,2}(?:\.\d)?\)?$/.test(unitsText)){warnings.push('Page '+page.number+': check the units for '+code+'.');continue;}
   const gradeText=line.items.filter(i=>i.x>=gradeLeft).map(i=>i.text).join(' ').trim(),grade=parseBookletGrade(gradeText),units=Number(unitsText.replace(/[()]/g,''));
   const key=code+':'+term,row={key,code,units,term,page:page.number,...grade},old=seen.get(key);
   if(old){if(old.gradeText!==row.gradeText||old.units!==row.units){old.outcome='REVIEW';old.gradeText='CONFLICT';warnings.push(code+' appears more than once with different values in term '+term+'.');}continue;}
   seen.set(key,row);rows.push(row);
  }
 }
 return {rows:rows.sort((a,b)=>a.term-b.term||a.code.localeCompare(b.code)),warnings};
}
