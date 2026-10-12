// One gentle 0 → 45° → 0 sweep. The return is continuous, never a snap.
export const ROTATION_LIMIT=Math.PI/4;
export const ROTATION_PERIOD=100;
export function constellationAngle(seconds){
 return ROTATION_LIMIT*(1-Math.cos(seconds/ROTATION_PERIOD*Math.PI*2))/2;
}
