// Supabase manages passwords and sessions; this reserved domain is an internal
// identifier only. Nothing is sent to it or shown as a student's email address.
export const USERNAME_DOMAIN='accounts.road-to-cele.invalid';
export function normalizeUsername(value){
 const username=String(value).trim().toLowerCase();
 if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Use 3–24 letters, numbers, or underscores for your username.');
 return username;
}
export const usernameIdentifier=value=>normalizeUsername(value)+'@'+USERNAME_DOMAIN;
export function passwordField(name,label,autocomplete,minlength=1){
 return `<label>${label}<span class="password-field"><input id="account-${name}" name="${name}" type="password" autocomplete="${autocomplete}" required minlength="${minlength}" maxlength="128"><button class="password-toggle" type="button" data-password-toggle="${name}" aria-controls="account-${name}" aria-label="Show ${label.toLowerCase()}" aria-pressed="false">Show</button></span></label>`;
}
export function accountName(user){
 if(!user)return 'Guest journey';
 if(user.email?.endsWith('@'+USERNAME_DOMAIN))return user.email.slice(0,-USERNAME_DOMAIN.length-1);
 return user.user_metadata?.full_name||user.email||'Student account';
}
export function usernameForm(mode='signin'){
 const signup=mode==='signup';
 return `<div class="account-or"><span>or use your username</span></div><h3>${signup?'Create an account':'Username sign-in'}</h3>
 <form class="username-form" data-username-form="${mode}">
 <label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" autocapitalize="none" spellcheck="false" placeholder="Your name in the sky"></label>
 ${passwordField('password',signup?'Password · at least 8 characters':'Password',signup?'new-password':'current-password',signup?8:1)}
 ${signup?passwordField('confirmPassword','Confirm password','new-password',8)+'<p class="card-note">No email needed. After signing in, save recovery codes from Account when recovery is available.</p>':''}
 <button type="submit" class="primary">${signup?'Create account':'Sign in with username'}</button></form>
 <button class="username-switch" data-account="${signup?'username-signin':'username-signup'}">${signup?'Already have an account? Sign in':'Create a username account'}</button><button class="recovery-link" data-account="recover">Forgot password? Use a recovery code</button>`;
}
export function usernameCredentials(form){
 const username=normalizeUsername(form.elements.namedItem('username').value),password=form.elements.namedItem('password').value;
 if(!password)throw Error('Enter your password.');
 if(form.dataset.usernameForm==='signup'){
  if(password.length<8)throw Error('Choose a password with at least 8 characters.');
  if(password!==form.elements.namedItem('confirmPassword').value)throw Error('Your passwords do not match.');
 }
 return {username,password,email:usernameIdentifier(username)};
}
export function usernameAuthError(error){
 return {
  invalid_credentials:'Username or password is incorrect.',
  user_already_exists:'That username is taken. Choose another one or sign in.',
  email_exists:'That username is taken. Choose another one or sign in.',
  email_not_confirmed:'Username accounts are awaiting setup. Google sign-in is available.',
  weak_password:'Choose a stronger password and try again.',
  signup_disabled:'New accounts are not enabled yet. Google sign-in is available.',
  email_provider_disabled:'Username accounts are awaiting setup. Google sign-in is available.',
  over_request_rate_limit:'Too many attempts. Please wait before trying again.'
 }[error?.code]||'That account action could not finish. Your journey is retained. Please try again.';
}
