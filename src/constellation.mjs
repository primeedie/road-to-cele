// Deterministic, static starfield and orbit geometry. No flicker or external assets.
export const WORLD_WIDTH=1560;
export const WORLD_HEIGHT=1160;
export function starfield(){
 let seed=122;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const stars=Array.from({length:240},()=>`<circle cx="${(rand()*WORLD_WIDTH).toFixed(1)}" cy="${(rand()*WORLD_HEIGHT).toFixed(1)}" r="${(.35+rand()*.9).toFixed(2)}" fill="#b5cedc" opacity="${(.08+rand()*.23).toFixed(2)}"/>`).join('');
 return `<svg class="terrain starfield" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" aria-hidden="true"><defs><radialGradient id="cloud-a"><stop stop-color="#245066" stop-opacity=".18"/><stop offset="1" stop-color="#245066" stop-opacity="0"/></radialGradient><radialGradient id="cloud-b"><stop stop-color="#4d345a" stop-opacity=".13"/><stop offset="1" stop-color="#4d345a" stop-opacity="0"/></radialGradient></defs><ellipse cx="520" cy="450" rx="610" ry="460" fill="url(#cloud-a)"/><ellipse cx="1170" cy="680" rx="430" ry="350" fill="url(#cloud-b)"/>${stars}</svg>`;
}
export function orbitalBadge(glyph){
 return `<svg class="node-orbit" viewBox="0 0 144 112" aria-hidden="true"><circle class="orbit-halo" cx="72" cy="52" r="38"/><ellipse class="orbit-track" cx="72" cy="52" rx="59" ry="21"/><ellipse class="orbit-track" cx="72" cy="52" rx="52" ry="18" transform="rotate(58 72 52)"/><ellipse class="orbit-track" cx="72" cy="52" rx="52" ry="18" transform="rotate(-58 72 52)"/><path class="orbit-track" d="M22 25L122 79M22 79L122 25"/><circle class="orbit-satellite" cx="13" cy="52" r="3"/><circle class="orbit-satellite" cx="131" cy="52" r="3"/><circle class="orbit-satellite" cx="48" cy="8" r="3"/><circle class="orbit-satellite" cx="96" cy="96" r="3"/><circle class="orbit-satellite secondary-orbit" cx="47" cy="94" r="3"/><circle class="orbit-core" cx="72" cy="52" r="19"/><circle class="orbit-inner" cx="72" cy="52" r="13"/><text x="72" y="58" text-anchor="middle" class="orbit-glyph">${glyph}</text></svg>`;
}
