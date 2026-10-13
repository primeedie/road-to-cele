// Wheel input supplies a target; display frames supply the motion, at any refresh rate.
export function wheelZoomFactor(event,pageHeight=800){
 const units=event.deltaMode===1?16:event.deltaMode===2?pageHeight:1;
 const pixels=Number(event.deltaY)*units;
 if(!Number.isFinite(pixels))return 1;
 return Math.exp(-Math.max(-180,Math.min(180,pixels))*(event.ctrlKey ? .006 : .0017));
}
export function createSmoothZoom({getCamera,onCamera,constrain=c=>c,getLimits=()=>({min:.1,max:2}),requestFrame,cancelFrame,now=()=>performance.now(),reducedMotion=()=>false,onActivity=()=>{},response=65}){
 let frame=null,target=null,last=0,active=false;
 function activity(value){if(active===value)return;active=value;onActivity(value);}
 function cancel(){if(frame!==null)cancelFrame(frame);frame=null;target=null;activity(false);}
 function finish(){const final=target;cancel();if(final)onCamera(constrain(final));}
 function tick(time){
  frame=null;if(!target)return;
  const current=getCamera(),dt=Math.max(0,Math.min(48,time-last));last=time;
  const alpha=1-Math.exp(-dt/response);
  const scale=Math.exp(Math.log(current.scale)+(Math.log(target.scale)-Math.log(current.scale))*alpha);
  // Interpolate translation by the same scale fraction to keep the zoom anchor still.
  const fraction=Math.abs(target.scale-current.scale)>1e-10?(scale-current.scale)/(target.scale-current.scale):alpha;
  const next=constrain({scale,x:current.x+(target.x-current.x)*fraction,y:current.y+(target.y-current.y)*fraction});
  const settled=Math.abs(Math.log(target.scale/next.scale))<.0003&&Math.hypot(target.x-next.x,target.y-next.y)<.12;
  if(settled){finish();return;}
  onCamera(next);frame=requestFrame(tick);
 }
 function zoom(factor,cx,cy){
  if(!Number.isFinite(factor)||factor<=0||factor===1)return;
  const current=getCamera(),limits=getLimits();
  const scale=Math.max(limits.min,Math.min(limits.max,(target?.scale??current.scale)*factor));
  const ratio=scale/current.scale;
  target=constrain({scale,x:cx-(cx-current.x)*ratio,y:cy-(cy-current.y)*ratio});
  if(reducedMotion()){finish();return;}
  if(target.scale===current.scale&&target.x===current.x&&target.y===current.y){cancel();return;}
  activity(true);
  if(frame===null){last=now();frame=requestFrame(tick);}
 }
 return {zoom,cancel,finish,get active(){return active;}};
}
