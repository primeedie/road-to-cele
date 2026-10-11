// Explicit environment settings win. The checked-in browser configuration is
// used only by the production main branch on Cloudflare Pages, never previews.
export function deploymentCloudConfig(env,productionDefaults){
 const explicit=!!(env.PUBLIC_SUPABASE_URL?.trim()||env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
 const production=env.CF_PAGES==='1'&&env.CF_PAGES_BRANCH==='main';
 return publicCloudConfig(!explicit&&production?productionDefaults:env);
}

export function publicCloudConfig(env) {
 const url=(env.PUBLIC_SUPABASE_URL||'').trim();
 const publishableKey=(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
 if(!url&&!publishableKey)return {url:'',publishableKey:''};
 if(!url||!publishableKey)throw Error('Set both PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
 let parsed;try{parsed=new URL(url);}catch{throw Error('Invalid public Supabase URL.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!/^\/$/.test(parsed.pathname))throw Error('Use the HTTPS Supabase project URL without credentials or a path.');
 if(!publishableKey.startsWith('sb_publishable_')) {
  // Legacy anon keys are also public. Service role / secret keys must never enter a browser build.
  try{const role=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url').toString()).role;if(role!=='anon')throw Error();}
  catch{throw Error('Use a Supabase publishable key or legacy anon key, never a secret/service_role key.');}
 }
 return {url:parsed.origin,publishableKey};
}
