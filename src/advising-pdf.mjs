import {parseAdvisingPages} from './advising-parser.mjs';
export const BOOKLET_MAX_BYTES=10*1024*1024;
export async function readAdvisingPdf(file,{signal,onProgress=()=>{},pdfjs:provided,standardFontDataUrl}={}){
 if(!file||file.size<=0||file.size>BOOKLET_MAX_BYTES||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf'))throw Error('Choose a PDF booklet up to 10 MB.');
 const data=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw Error('This file is not a readable PDF.');
 if(signal?.aborted)throw Error('Import canceled.');
 const libraryUrl=new URL('./vendor/pdf.mjs',import.meta.url).href;
 const pdfjs=provided||await import(libraryUrl);
 if(!provided)pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
 const fonts=standardFontDataUrl||(!provided?new URL('./vendor/standard_fonts/',import.meta.url).href:undefined);
 const task=pdfjs.getDocument({data,standardFontDataUrl:fonts,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWasm:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true});
 const abort=()=>{void task.destroy();};signal?.addEventListener('abort',abort,{once:true});
 try{
  const doc=await task.promise;if(doc.numPages>80)throw Error('This booklet is too long. Use a PDF with up to 80 pages.');
  const pages=[];
  for(let i=1;i<=doc.numPages;i++){if(signal?.aborted)throw Error('Import canceled.');const page=await doc.getPage(i),content=await page.getTextContent();pages.push({number:i,items:content.items});page.cleanup();onProgress(i,doc.numPages);}
  const result=parseAdvisingPages(pages);if(!result.rows.length)throw Error('No course tables were found. Use a text-based advising booklet PDF; scanned or handwritten pages need to be entered manually.');return result;
 }catch(error){if(signal?.aborted)throw Error('Import canceled.');if(error.name==='PasswordException')throw Error('Use an unlocked copy of the PDF booklet.');throw error;}
 finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
