import {USERNAME_DOMAIN} from './username-account.mjs';
import {parseDisplayName,customDisplayName} from './display-name.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sharesLeaderboardIdentity=user=>user?.user_metadata?.leaderboard_show_identity===true;
export function publicLeaderboardName(user){
 const custom=user?.user_metadata?.display_name;
 if(custom!==undefined&&custom!==null&&custom!==''){
  try{return parseDisplayName(custom);}catch{return null;}
 }
 if(user?.email?.endsWith('@'+USERNAME_DOMAIN))return user.email.slice(0,-USERNAME_DOMAIN.length-1);
 const value=user?.user_metadata?.full_name||user?.user_metadata?.name;
 return typeof value==='string'&&!/[@\x00-\x1f\x7f]/.test(value)&&value.trim()?[...value.trim()].slice(0,60).join(''):null;
}
export function leaderboardPrivacyForm(user){
 const name=publicLeaderboardName(user);
 return `<form data-leaderboard-privacy-form class="leaderboard-privacy-form"><h3>Display name &amp; privacy</h3><label>Display name <span class="card-note">(optional)</span><input name="displayName" autocomplete="nickname" maxlength="120" value="${esc(customDisplayName(user)||'')}" placeholder="Your name in the sky" aria-describedby="display-name-help"></label><p id="display-name-help" class="card-note">Choose up to 60 characters. Leave blank to use your current account name. This does not change your sign-in username or Google account.</p><label><input type="checkbox" name="showLeaderboardIdentity"${sharesLeaderboardIdentity(user)?' checked':''}>Show my display name to other students on my batch leaderboard.</label><p class="card-note">${name?'Currently saved public name: <strong>'+esc(name)+'</strong>.':'No public account name is available; your entry will stay anonymous.'} Name sharing is optional. Otherwise, students see a randomized label such as Anon 122 #0001. Profile photos, email addresses and individual grades are never displayed.</p><button type="submit" class="secondary">Save name &amp; privacy</button><p class="leaderboard-privacy-status" role="status"></p></form>`;
}
