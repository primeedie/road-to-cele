import { COURSE_BY_ID } from './curriculum.mjs';

export const AVATARS = Object.freeze([
 {id:'owl',name:'Night owl',color:'#aaa6c8',art:'<path d="M26 31L21 13L43 25L60 23L78 13L74 36Q88 61 68 76Q51 87 32 76Q14 60 26 31Z" fill="#85809d"/><path d="M30 40Q44 31 50 43Q58 31 72 40L68 62Q52 78 32 62Z" fill="#e2d5bf"/><circle cx="37" cy="48" r="8" fill="#28262c"/><circle cx="64" cy="48" r="8" fill="#28262c"/><circle cx="39" cy="46" r="2" fill="#fff1d5"/><circle cx="66" cy="46" r="2" fill="#fff1d5"/><path d="M47 56L53 56L50 63Z" fill="#c69257"/><path d="M40 73L38 82M61 73L63 82" stroke="#c69257" stroke-width="3"/>'},
 {id:'fox',name:'Star fox',color:'#c59976',art:'<path d="M24 46L20 15L44 31L58 31L80 15L76 47Q80 65 50 82Q19 65 24 46Z" fill="#bc805c"/><path d="M25 22L29 42L40 32M75 22L70 43L60 33" fill="#e7c5a1"/><path d="M25 51Q35 46 49 67Q64 45 76 51Q66 74 50 82Q33 72 25 51Z" fill="#ece1c7"/><path d="M34 48Q39 44 44 48M58 48Q63 44 67 48" fill="none" stroke="#342a29" stroke-width="3" stroke-linecap="round"/><path d="M44 66Q50 62 56 66L50 73Z" fill="#342a29"/>'},
 {id:'cat',name:'Moon cat',color:'#a7b8bb',art:'<path d="M23 44L24 17L43 31L61 31L79 17L77 46Q87 79 51 82Q16 78 23 44Z" fill="#82999f"/><path d="M31 27L34 40L40 34M72 27L68 40L63 34" fill="#d7b5ac"/><path d="M32 51Q38 56 44 51M58 51Q64 56 70 51" fill="none" stroke="#192e36" stroke-width="3" stroke-linecap="round"/><path d="M47 61L55 61L51 66M51 66Q45 72 40 67M51 66Q57 72 62 67" fill="none" stroke="#263b42" stroke-width="2"/><path d="M13 56L32 60M12 65L33 65M71 60L88 56M70 65L89 65" stroke="#d7dcd1" stroke-width="2"/><path d="M51 35L54 40L59 40L55 44L56 49L51 46L46 49L47 44L43 40L48 40Z" fill="#dbd4ae"/>'},
 {id:'moth',name:'Lantern moth',color:'#c4b584',art:'<path d="M49 50Q31 12 16 28Q6 44 38 64Q11 60 22 78Q35 90 49 62M53 50Q73 12 86 28Q98 44 66 64Q92 60 80 78Q66 90 53 62Z" fill="#ad9d70"/><path d="M18 35Q36 34 44 56M84 35Q65 34 58 56" fill="none" stroke="#ded2b0" stroke-width="3"/><path d="M40 22Q52 38 62 22" fill="none" stroke="#bdad80" stroke-width="2"/><path d="M51 39L51 73" stroke="#e5dcc2" stroke-width="7" stroke-linecap="round"/><circle cx="51" cy="37" r="5" fill="#e5dcc2"/>'}
]);
export const FRAMES = Object.freeze([
 {id:'wanderer',name:'Wanderer',need:0,color:'#8d8778'},
 {id:'first-light',name:'First light',need:1,color:'#c8b384'},
 {id:'laurel',name:'Silverleaf',need:8,color:'#95b097'},
 {id:'starbound',name:'Starbound',need:24,color:'#b7a5d0'}
]);
export const defaultCosmetics=()=>({avatar:'owl',frame:'wanderer'});
export function hydrateCosmetics(raw) {
 return {avatar:AVATARS.some(a=>a.id===raw?.avatar)?raw.avatar:'owl',frame:FRAMES.some(f=>f.id===raw?.frame)?raw.frame:'wanderer'};
}
export function completedCount(p){return Object.entries(p.academicRecords).filter(([id,r])=>COURSE_BY_ID[id]&&r.status==='COMPLETED').length;}
export function unlockedFrames(p){const count=completedCount(p);return FRAMES.filter(f=>count>=f.need);}
export function equippedCosmetics(p){const c=hydrateCosmetics(p.cosmetics);return {...c,frame:unlockedFrames(p).some(f=>f.id===c.frame)?c.frame:'wanderer'};}
export function equipCosmetic(p,type,id){
 if(type==='avatar'&&!AVATARS.some(a=>a.id===id))throw Error('Unknown avatar');
 if(type==='frame'&&!unlockedFrames(p).some(f=>f.id===id))throw Error('Complete more courses to earn this frame.');
 if(!['avatar','frame'].includes(type))throw Error('Unknown cosmetic type');
 return {...structuredClone(p),cosmetics:{...equippedCosmetics(p),[type]:id}};
}
export function avatarBadge(p,{avatar,frame}={}){
 const current=equippedCosmetics(p),a=AVATARS.find(a=>a.id===(avatar||current.avatar))||AVATARS[0],f=FRAMES.find(f=>f.id===(frame||current.frame))||FRAMES[0];
 const wreath=f.id==='laurel'?'<path d="M18 66Q9 46 22 29M82 66Q91 46 78 29"/><path d="M16 54L9 47M16 45L10 37M19 37L14 28M84 54L91 47M84 45L90 37M81 37L86 28"/>':'';
 return `<span class="avatar-badge frame-${f.id}" style="--portrait-color:${a.color};--frame-color:${f.color}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#121211"/>${a.art}<g fill="none" stroke="${f.color}" stroke-width="1.5"><circle cx="50" cy="50" r="45"/>${wreath}</g>${f.id!=='wanderer'?'<path d="M50 1L53 7L50 13L47 7Z" fill="'+f.color+'"/>':''}${f.id==='starbound'?'<path d="M7 50L10 55L7 60L4 55ZM93 50L96 55L93 60L90 55ZM50 87L53 93L50 99L47 93Z" fill="'+f.color+'"/>':''}</svg></span>`;
}
export function wardrobeMarkup(p){
 const c=equippedCosmetics(p),count=completedCount(p);
 return `<div class="wardrobe-heading"><span class="wardrobe-kicker">A LITTLE PIECE OF YOUR JOURNEY</span><h2 id="wardrobe-title">Your sky companion</h2><p>Choose a companion. Earn a frame as your course stars light up.</p></div><div class="wardrobe-preview">${avatarBadge(p)}<span>${AVATARS.find(a=>a.id===c.avatar).name}<small>${FRAMES.find(f=>f.id===c.frame).name} frame</small></span></div><section class="wardrobe-section" aria-label="Avatars"><h3>Companions</h3><div class="cosmetic-grid">${AVATARS.map(a=>`<button class="cosmetic-option ${c.avatar===a.id?'equipped':''}" data-avatar="${a.id}" aria-pressed="${c.avatar===a.id}">${avatarBadge(p,{avatar:a.id,frame:'wanderer'})}<strong>${a.name}</strong><small>${c.avatar===a.id?'Equipped':'Available'}</small></button>`).join('')}</div></section><section class="wardrobe-section" aria-label="Avatar frames"><h3>Frames <span>${count} courses completed</span></h3><div class="cosmetic-grid">${FRAMES.map(f=>{const unlocked=count>=f.need;return `<button class="cosmetic-option ${c.frame===f.id?'equipped':''} ${unlocked?'':'cosmetic-locked'}" data-frame="${f.id}" aria-pressed="${c.frame===f.id}" ${unlocked?'':'disabled'}>${avatarBadge(p,{frame:f.id})}<strong>${f.name}</strong><small>${c.frame===f.id?'Equipped':unlocked?'Unlocked':`${count} / ${f.need} courses`}</small></button>`;}).join('')}</div></section><p class="wardrobe-footnote">Cosmetic rewards never change academic completion, mastery or gate requirements.</p>`;
}
