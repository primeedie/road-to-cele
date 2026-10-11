// Only a press that starts AND finishes on the backdrop dismisses the dialog.
export function attachBackdropDismiss(dialog,onDismiss){
 let pressedOutside=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.left+r.width||e.clientY<r.top||e.clientY>r.top+r.height);};
 dialog.addEventListener('pointerdown',e=>{pressedOutside=e.button===0&&outside(e);});
 dialog.addEventListener('pointercancel',()=>{pressedOutside=false;});
 dialog.addEventListener('click',e=>{const dismiss=pressedOutside&&outside(e);pressedOutside=false;if(dismiss)onDismiss();});
}
