import {passwordField,normalizeUsername} from './username-account.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function recoveryMarkup(screen,codes,{available=false}={}){
 if(screen==='codes')return `<h2>Keep these somewhere safe</h2><p>These eight codes are shown once. Each code can reset your username account’s password once. A new set replaces every previous code.</p><ul class="recovery-codes">${codes.map(c=>'<li><code>'+escape(c)+'</code></li>').join('')}</ul><button class="secondary full" data-account="download-codes">Download recovery codes</button><label class="recovery-saved"><input type="checkbox" data-recovery-saved><span>I saved these codes somewhere outside this browser.</span></label><button class="primary full" data-account="finish-codes" disabled>Done</button>`;
 if(screen==='issue')return `<h2>Recovery codes</h2><p>Save eight single-use codes so you can recover your username account without email. Generating a new set invalidates the previous set.</p>${available?`<form class="username-form" data-recovery-form="issue">${passwordField('password','Current password','current-password')}<button class="primary" type="submit">Generate new codes</button></form>`:'<p class="recovery-notice">Recovery codes are awaiting server setup. Your account and progress are unchanged.</p>'}<button class="recovery-link" data-account="recovery-back">Back to account</button>`;
 if(screen==='success')return '<h2>Password updated</h2><p>Sign in with your username and new password. Your course records and academic path are retained.</p><button class="primary full" data-account="recovery-back">Return to sign-in</button>';
 return `<h2>Recover your account</h2><p>Use one of the codes you saved while signed in. Each code works once. Google accounts recover through Google.</p>${available?`<form class="username-form" data-recovery-form="recover"><label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="24" autocapitalize="none" spellcheck="false"></label><label>Recovery code<input name="code" autocomplete="off" required spellcheck="false" autocapitalize="characters" maxlength="64" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"></label>${passwordField('password','New password','new-password',8)}${passwordField('confirmPassword','Confirm new password','new-password',8)}<button class="primary" type="submit">Reset password</button></form>`:'<p class="recovery-notice">Recovery is awaiting server setup. Google sign-in and ordinary username sign-in are still available.</p>'}<button class="recovery-link" data-account="recovery-back">Back to sign-in</button>`;
}
export function recoveryInput(form){
 const password=form.elements.namedItem('password').value;
 if(form.dataset.recoveryForm==='issue'){if(!password)throw Error('Enter your current password.');return {action:'issue',password};}
 if(password.length<8||password.length>128)throw Error('Choose a password of 8–128 characters.');
 if(password!==form.elements.namedItem('confirmPassword').value)throw Error('Your passwords do not match.');
 return {action:'recover',username:normalizeUsername(form.elements.namedItem('username').value),code:form.elements.namedItem('code').value,password};
}
export async function recoveryRequest(data,token,{fetcher=fetch}={}){
 const result=await fetcher('/api/account-recovery',{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});
 let body;try{body=await result.json();}catch{throw Error('Recovery is awaiting server setup.');}
 if(!result.ok)throw Error(body.error||'Recovery could not connect. Try again later.');
 return body;
}
export function downloadRecoveryCodes(document,codes,name){
 const blob=new Blob(['Road to CELE — recovery codes\nUsername: '+name+'\n\n'+codes.join('\n')+'\n\nEach code works once. Keep this file private. New codes replace the previous set.\n'],{type:'text/plain'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='road-to-cele-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
