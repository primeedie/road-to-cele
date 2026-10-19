import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {AUTHOR_NOTICE,OWNERSHIP_NOTICE,installAuthorMark} from '../src/author-mark.mjs';
import {verifyAttribution,writeProvenance} from '../scripts/attribution.mjs';

test('embedded author notice repairs DOM removal without changing academic storage',async()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://credit.test/'});
 try{
  const {document,localStorage}=dom.window;
  localStorage.setItem('cele-atlas.progress.v3','test record remains intact');
  installAuthorMark(document);
  assert.equal(dom.window.ROAD_TO_CELE_AUTHOR.ownership,OWNERSHIP_NOTICE);
  assert.equal(document.body.textContent,'');
  const selector='meta[name="road-to-cele-author"]';
  assert.equal(document.querySelector(selector).content,AUTHOR_NOTICE);
  assert.equal(dom.window.ROAD_TO_CELE_AUTHOR.notice,AUTHOR_NOTICE);
  assert.throws(()=>{dom.window.ROAD_TO_CELE_AUTHOR.notice='removed';},TypeError);
  assert.throws(()=>{delete dom.window.ROAD_TO_CELE_AUTHOR;},TypeError);
  document.querySelector(selector).remove();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(document.querySelector(selector).content,AUTHOR_NOTICE);
  document.querySelector(selector).content='changed';
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(document.querySelector(selector).content,AUTHOR_NOTICE);
  installAuthorMark(document);
  assert.equal(document.querySelectorAll(selector).length,1);
  assert.equal(localStorage.getItem('cele-atlas.progress.v3'),'test record remains intact');
 }finally{dom.window.close();}
});

test('build rejects removed or disconnected credits and records verifiable asset hashes',async()=>{
 const intendedParent=resolve(tmpdir());
 const directory=await mkdtemp(join(intendedParent,'cele-credit-'));
 try{
  const files=['index.html','app.js','curriculum.mjs','author-mark.mjs','AUTHORSHIP.txt'];
  for(const file of files)await cp(new URL('../src/'+file,import.meta.url),join(directory,file));
  await verifyAttribution(directory);
  const appPath=join(directory,'app.js'),app=await readFile(appPath,'utf8');
  await writeFile(appPath,app.replace('installAuthorMark(document);',''));
  await assert.rejects(verifyAttribution(directory),/disconnected/);
  await writeFile(appPath,app);
  const curriculumPath=join(directory,'curriculum.mjs'),curriculum=await readFile(curriculumPath,'utf8');
  await writeFile(curriculumPath,curriculum.replace(AUTHOR_NOTICE,''));
  await assert.rejects(verifyAttribution(directory),/curriculum.mjs/);
  await writeFile(curriculumPath,curriculum);
  const htmlPath=join(directory,'index.html'),html=await readFile(htmlPath,'utf8');
  await writeFile(htmlPath,html.replace(OWNERSHIP_NOTICE,''));
  await assert.rejects(verifyAttribution(directory),/ownership watermark/);
  await writeFile(htmlPath,html);
  await writeProvenance(directory);
  const manifest=JSON.parse(await readFile(join(directory,'provenance.json'),'utf8'));
  assert.equal(manifest.notice,AUTHOR_NOTICE);
  assert.equal(manifest.ownership,OWNERSHIP_NOTICE);
  assert.equal(manifest.files['app.js'],createHash('sha256').update(app).digest('hex'));
  assert.equal(manifest.files['provenance.json'],undefined);
 }finally{
  const target=resolve(directory);
  if(dirname(target)!==intendedParent || !basename(target).startsWith('cele-credit-'))throw Error('Refusing cleanup outside the attribution test directory.');
  await rm(target,{recursive:true,force:true});
 }
});
