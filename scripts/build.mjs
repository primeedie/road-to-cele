import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { verifyAttribution, writeProvenance } from './attribution.mjs';
import { build } from 'esbuild';
import { publicCloudConfig } from './cloud-config.mjs';
// .env.local is ignored. Cloudflare supplies the same variables at build time.
try { process.loadEnvFile('.env.local'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const cloudConfig=publicCloudConfig(process.env);
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
await writeFile('dist/runtime-config.mjs','export const cloudConfig = Object.freeze('+JSON.stringify(cloudConfig)+');\n');
await build({entryPoints:['node_modules/@supabase/supabase-js/dist/index.mjs'],outfile:'dist/supabase-client.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await verifyAttribution('dist');
await writeProvenance('dist');
console.log('Built static site in dist/');
