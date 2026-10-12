// A nonmodal course dossier leaves the central map and navigation usable.
export function showCourseDossier(dialog){
 if(dialog.open)return;
 if(typeof dialog.show==='function')dialog.show();
 else dialog.showModal(); // DOM test environments without nonmodal dialog APIs.
}
export function attachSidePanelDismiss(dialog,onDismiss){
 const doc=dialog.ownerDocument;let outside=false;
 const isBackground=event=>dialog.open&&!dialog.contains(event.target)&&!event.target.closest?.('button,a,input,select,textarea,summary,[data-connection],dialog,.course-node');
 const down=event=>{outside=event.button===0&&isBackground(event);};
 const cancel=()=>{outside=false;};
 const click=event=>{const dismiss=outside&&isBackground(event);outside=false;if(dismiss)onDismiss();};
 doc.addEventListener('pointerdown',down);doc.addEventListener('pointercancel',cancel);doc.addEventListener('click',click);
 return ()=>{doc.removeEventListener('pointerdown',down);doc.removeEventListener('pointercancel',cancel);doc.removeEventListener('click',click);};
}
