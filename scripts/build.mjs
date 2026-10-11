import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { verifyAttribution, writeProvenance } from './attribution.mjs';
await verifyAttribution('src');
await mkdir('dist', { recursive: true });
await cp('src', 'dist', { recursive: true });
let fontFace=await readFile('src/font-face.css','utf8');
for(const [extension,format] of [['woff2','woff2'],['woff','woff'],['otf','opentype'],['ttf','truetype']]){
  const fontPath=`assets/fonts/HYWenHei-85W.${extension}`;
  try{await access(`src/${fontPath}`);}catch{continue;}
  fontFace=fontFace.replace('/* HANYI_FILE_SOURCE */',`, url('${fontPath}') format('${format}')`);
  break;
}
await writeFile('dist/font-face.css',fontFace);
await verifyAttribution('dist');
await writeProvenance('dist');
console.log('Built static site in dist/');
