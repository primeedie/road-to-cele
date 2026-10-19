// A display name changes presentation only; it never changes login or permissions.
export function parseDisplayName(value){
 if(typeof value!=='string')throw Error('Enter a display name.');
 if(/[@\x00-\x1f\x7f]/.test(value))throw Error('Use a name without email addresses or control characters.');
 const name=value.trim();
 if([...name].length>60)throw Error('Keep your display name to 60 characters or fewer.');
 return name||null;
}
export function customDisplayName(user){
 try{return parseDisplayName(user?.user_metadata?.display_name??'');}catch{return null;}
}
