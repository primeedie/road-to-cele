import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const notice='milch pogiman made this, so u cant steal this lol';
export async function verifyAttribution(root='src'){
 const [html,app,curriculum,mark,authorship]=await Promise.all(['index.html','app.js','curriculum.mjs','author-mark.mjs','AUTHORSHIP.txt'].map(file=>readFile(join(root,file),'utf8')));
 for(const [file,source] of [['index.html',html],['app.js',app],['curriculum.mjs',curriculum],['author-mark.mjs',mark],['AUTHORSHIP.txt',authorship]]){
  if(!source.includes(notice))throw Error(`Author watermark missing or changed in ${file}. Preserve the project attribution.`);
 }
 if(!html.includes(`<meta name="road-to-cele-author" content="${notice}">`))throw Error('Embedded author metadata is missing.');
 if(!app.includes("import { installAuthorMark } from './author-mark.mjs';")||!app.includes('installAuthorMark(document);'))throw Error('Runtime author attribution is disconnected.');
 if(!mark.includes(`export const AUTHOR_NOTICE='${notice}';`))throw Error('Runtime author notice has changed.');
}

export async function writeProvenance(root='dist'){
 const files={};
 async function collect(directory,prefix=''){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const relative=prefix+entry.name,path=join(directory,entry.name);
   if(entry.isDirectory())await collect(path,relative+'/');
   else if(relative!=='provenance.json')files[relative]=createHash('sha256').update(await readFile(path)).digest('hex');
  }
 }
 await collect(root);
 await writeFile(join(root,'provenance.json'),JSON.stringify({project:'Road to CELE',author:'milch pogiman',notice,scope:'Application authorship; third-party assets retain their own attribution.',algorithm:'SHA-256',files},null,2)+'\n');
}
