import {USERNAME_DOMAIN} from './username-account.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sharesLeaderboardIdentity=user=>user?.user_metadata?.leaderboard_show_identity===true;
export function publicLeaderboardName(user){
 if(user?.email?.endsWith('@'+USERNAME_DOMAIN))return user.email.slice(0,-USERNAME_DOMAIN.length-1);
 const value=user?.user_metadata?.full_name||user?.user_metadata?.name;
 return typeof value==='string'&&!/[@\x00-\x1f\x7f]/.test(value)&&value.trim()?value.trim().slice(0,60):null;
}
export function leaderboardPrivacyForm(user){
 const name=publicLeaderboardName(user);
 return `<form data-leaderboard-privacy-form class="leaderboard-privacy-form"><h3>Leaderboard privacy</h3><label><input type="checkbox" name="showLeaderboardIdentity"${sharesLeaderboardIdentity(user)?' checked':''}>Show my account name to other students on my batch leaderboard.</label><p class="card-note">${name?'If enabled, your public name will be <strong>'+esc(name)+'</strong>.':'No public account name is available; your entry will stay anonymous.'} Otherwise, students see a randomized label such as Anon 122 #0001. Profile photos, email addresses and individual grades are never displayed.</p><button type="submit" class="secondary">Save leaderboard privacy</button><p class="leaderboard-privacy-status" role="status"></p></form>`;
}
