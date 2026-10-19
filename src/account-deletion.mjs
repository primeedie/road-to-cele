import {accountStorageKey} from './account-progress.mjs';
import {adminStorageKey} from './admin-mode.mjs';
export const ACCOUNT_DELETION_PHRASE='DELETE MY ACCOUNT';
export function accountDeletionMarkup({available=false,name='your account'}={}){
 const escaped=String(name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<h2>Delete ${escaped}?</h2><p>This permanently deletes your login, saved student journey, grades, profile photo, recovery codes and leaderboard entry.</p><p class="card-note">Your separate guest journey stays on this browser. Exported files and copies on other devices cannot be removed from here.</p><form data-account-deletion-form><label>Type DELETE MY ACCOUNT<input name="confirmation" autocomplete="off" spellcheck="false" required></label><label class="account-delete-ack"><input type="checkbox" name="acknowledge" required>I understand that this cannot be undone.</label><p class="account-deletion-status" role="status">${available?'':'Account deletion is awaiting server setup.'}</p><div class="dialog-actions"><button type="button" class="secondary" data-account="cancel-deletion">Keep account</button><button type="submit" class="account-delete-confirm"${available?'':' disabled'}>Permanently delete account</button></div></form>`;
}
export async function requestAccountDeletion({token,confirmation,fetcher=fetch}={}){
 const r=await fetcher('/api/account-deletion',token?{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({confirmation}),cache:'no-store'}:{cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Account deletion could not finish.');return data;
}
export function removeDeletedAccountCopies(storage,owner){
 for(const key of [accountStorageKey(owner),accountStorageKey(owner)+'.conflict-backup',accountStorageKey(owner)+'.testing-reset-backup',adminStorageKey(owner)])storage.removeItem(key);
}
