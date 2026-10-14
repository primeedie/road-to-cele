export const PHOTO_MAX_FILE_BYTES=10*1024*1024;
export const PHOTO_MAX_DATA_LENGTH=48*1024;
export const PHOTO_SIZE=256;
const formats=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
export function normalizeProfilePhoto(value){
 if(typeof value!=='string'||value.length>PHOTO_MAX_DATA_LENGTH||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
 try{const bytes=atob(value.slice(23));return bytes.length>16&&bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255&&bytes.charCodeAt(bytes.length-2)===255&&bytes.charCodeAt(bytes.length-1)===217?value:null;}catch{return null;}
}
export function withProfilePhoto(progress,photo){
 const next=structuredClone(progress),normalized=normalizeProfilePhoto(photo);
 if(photo!==null&&!normalized)throw Error('Choose a valid profile image first.');
 if(normalized)next.profilePhoto=normalized;else delete next.profilePhoto;return next;
}
export function validatePhotoFile(file){
 if(!file||!formats.has(file.type))throw Error('Choose a JPG, PNG or WebP image.');
 if(!Number.isFinite(file.size)||file.size<=0||file.size>PHOTO_MAX_FILE_BYTES)throw Error('Choose an image smaller than 10 MB.');
 return file;
}
async function browserDecode(file,document){
 const win=document.defaultView,url=win.URL.createObjectURL(file),image=new win.Image();
 try{image.src=url;await image.decode();return {image,dispose:()=>win.URL.revokeObjectURL(url)};}
 catch{win.URL.revokeObjectURL(url);throw Error('This image could not be opened. Try saving it as JPG, PNG or WebP.');}
}
export async function prepareProfilePhoto(file,{document=globalThis.document,decode=f=>browserDecode(f,document),createCanvas=()=>document.createElement('canvas')}={}){
 validatePhotoFile(file);const decoded=await decode(file),image=decoded.image;
 try{
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>32*1024*1024)throw Error('Choose an image with dimensions below 32 megapixels.');
  const side=Math.min(width,height),canvas=createCanvas();canvas.width=PHOTO_SIZE;canvas.height=PHOTO_SIZE;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing is unavailable in this browser.');
  ctx.fillStyle='#101010';ctx.fillRect(0,0,PHOTO_SIZE,PHOTO_SIZE);ctx.drawImage(image,(width-side)/2,(height-side)/2,side,side,0,0,PHOTO_SIZE,PHOTO_SIZE);
  for(const quality of [.86,.74,.62,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(normalizeProfilePhoto(data))return data;}
  throw Error('The image could not be resized. Try a different JPG photo.');
 }finally{decoded.dispose?.();}
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function profilePhotoMarkup(saved,{draft=null,busy=false,message='',enabled=true}={}){
 saved=normalizeProfilePhoto(saved);draft=normalizeProfilePhoto(draft);const photo=draft||saved;
 return `<section class="profile-photo-editor" data-photo-editor aria-label="Profile picture"><h3>Profile picture</h3><div class="profile-photo-row"><div class="profile-photo-preview">${photo?'<img src="'+photo+'" alt="Your profile picture" width="88" height="88">':'<span aria-label="No profile picture">＋</span>'}</div><div><label class="profile-photo-choose ${busy?'is-busy':''}"><span>${busy?'Preparing photo…':saved?'Change photo':'Choose photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-profile-photo ${busy||!enabled?'disabled':''} aria-label="Choose a profile picture"></label><p>JPG, PNG or WebP · up to 10 MB.<br>Preview the centered square crop before saving.</p></div></div><div class="profile-photo-actions">${draft?'<button type="button" class="primary" data-photo-action="save" '+(busy||!enabled?'disabled':'')+'>Save photo</button><button type="button" class="secondary" data-photo-action="cancel" '+(busy?'disabled':'')+'>Cancel selection</button>':''}${saved?'<button type="button" class="secondary" data-photo-action="remove" '+(busy||!enabled?'disabled':'')+'>Remove photo</button>':''}</div><p class="profile-photo-status" role="status">${esc(message||(!enabled?'Finish loading or choosing your account save first.':draft?'Preview only · press Save photo to apply.':'Your photo saves with your account journey.'))}</p></section>`;
}
export function createProfilePhotoEditor({document,getState,getProgress,save,flush=async()=>{},onSaved=()=>{},processor=file=>prepareProfilePhoto(file,{document})}){
 let owner=null,epoch=0,draft=null,busy=false,message='';
 const owned=()=>getState().user?.id===owner&&!!owner;
 const enabled=()=>owned()&&getState().ready&&!getState().choice;
 function reset(){epoch++;draft=null;busy=false;message='';}
 function sync(){const next=getState().user?.id||null;if(next!==owner){owner=next;reset();}}
 const markup=()=>{sync();return owner?profilePhotoMarkup(getProgress().profilePhoto,{draft,busy,message,enabled:enabled()}):'';};
 function paint(){const existing=document.querySelector('[data-photo-editor]');if(existing)existing.outerHTML=markup();}
 const status=removed=>{const s=getState();return s.phase==='saved'?'Profile photo '+(removed?'removed.':'saved to your account.'):
  s.choice?'Choose your account save copy to finish syncing this change.':s.deviceSaved?'Photo '+(removed?'removal':'change')+' saved on this device; cloud sync is pending.':'Photo change is session-only. Export a backup before leaving.';};
 document.addEventListener('change',async event=>{
  const input=event.target.closest('[data-profile-photo]');if(!input||busy)return;sync();if(!enabled())return;
  const file=input.files?.[0];if(!file)return;const token=++epoch;busy=true;message='Preparing a small profile image…';paint();
  try{const result=await processor(file);if(token!==epoch||!enabled())return;if(!normalizeProfilePhoto(result))throw Error('This image could not be prepared. Choose another photo.');draft=result;message='Preview only · press Save photo to apply.';}
  catch(error){if(token===epoch&&owned())message=error.message;}
  finally{if(token===epoch&&owned()){busy=false;paint();}}
 });
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-photo-action]');if(!button||busy)return;sync();if(!enabled())return;
  const action=button.dataset.photoAction;if(action==='cancel'){reset();paint();return;}if(!['save','remove'].includes(action))return;
  const token=++epoch;busy=true;message='Saving your profile photo…';paint();
  try{
   const next=withProfilePhoto(getProgress(),action==='remove'?null:draft);
   save(next);onSaved(next);draft=null;await flush();
   if(token===epoch&&owned())message=status(action==='remove');
  }catch(error){if(token===epoch&&owned())message=error.message;}
  finally{if(token===epoch&&owned()){busy=false;paint();}}
 });
 return {markup,sync,reset};
}
