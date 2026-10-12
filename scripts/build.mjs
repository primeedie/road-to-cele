import { mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import { verifyAttribution, writeProvenance } from './attribution.mjs';
import { build, transform } from 'esbuild';
import { deploymentCloudConfig } from './cloud-config.mjs';
// .env.local is ignored. Cloudflare supplies the same variables at build time.
try { process.loadEnvFile('.env.local'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const productionDefaults=JSON.parse(await readFile('config/public-production.json','utf8'));
const cloudConfig=deploymentCloudConfig(process.env,productionDefaults);
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
// Preserve stylesheet order while avoiding fourteen render-blocking requests.
let html=await readFile('dist/index.html','utf8');
const styleLinks=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
const styleSources=await Promise.all(styleLinks.map(link=>readFile('dist/'+link[1],'utf8')));
const styles=await transform(styleSources.join('\n'),{loader:'css',minify:true});
await writeFile('dist/site.css',styles.code);
html=html.replace(/<link rel="stylesheet" href="[^"]+">/g,'');
html=html.replace('</head>','<link rel="stylesheet" href="site.css"></head>');
await writeFile('dist/index.html',html);
await writeFile('dist/runtime-config.mjs','export const cloudConfig = Object.freeze('+JSON.stringify(cloudConfig)+');\n');
await build({entryPoints:['node_modules/@supabase/supabase-js/dist/index.mjs'],outfile:'dist/supabase-client.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await verifyAttribution('dist');
await writeProvenance('dist',{builder:process.env.CF_PAGES==='1'?'cloudflare-pages':'local',commit:process.env.CF_PAGES_COMMIT_SHA||null,cloudLoginConfigured:!!cloudConfig.url});
console.log('Built static site in dist/');
console.log(cloudConfig.url?'Supabase public configuration included.':'Guest-only build: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set.');
