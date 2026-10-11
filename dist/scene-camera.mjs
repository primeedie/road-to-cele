// A perspective camera looking down onto the constellation plane at 30 degrees.
// Project coordinates before rendering so pointer pan/zoom still operate in screen pixels.
const tilt=Math.PI/3,yaw=-Math.PI/22.5,distance=3000;
export function projectScenePoint(point,center,elevation=0){
 const dx=point.x-center.x,dy=point.y-center.y;
 const horizontal=dx*Math.cos(yaw)-dy*Math.sin(yaw);
 const forward=dx*Math.sin(yaw)+dy*Math.cos(yaw);
 const depth=forward*Math.sin(tilt)+elevation*Math.cos(tilt);
 const scale=distance/(distance-depth);
 return {x:center.x+horizontal*scale,y:center.y+(forward*Math.cos(tilt)-elevation*Math.sin(tilt))*scale,perspective:scale};
}
