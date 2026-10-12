// Coalesce high-frequency input into one DOM paint per display frame.
export function createFramePainter(paint,{requestFrame,cancelFrame}){
 let frame=null;
 return {
  schedule(){if(frame===null)frame=requestFrame(()=>{frame=null;paint();});},
  cancel(){if(frame!==null)cancelFrame(frame);frame=null;},
  flush(){this.cancel();paint();}
 };
}
