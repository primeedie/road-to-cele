export function portalState(gate){return gate.cleared?'cleared':gate.eligible?'ready':'locked';}
export function civincoPortalMarkup(position,gate){
 const state=portalState(gate),label=state==='cleared'?'CELE Hardmode unlocked':state==='ready'?'Ready for integration':'View gate requirements';
 // Small SVG groups create inward flow without distorting the full map or its hit targets.
 const particles=Array.from({length:8},(_,i)=>`<g class="portal-infall" style="--stream-angle:${i*45}deg;--stream-delay:${-i*1.15}s"><path d="M205 -10Q212 -6 218 0"/><circle cx="218" cy="0" r="${i%3===0?2.8:1.8}"/></g>`).join('');
 return `<button class="civinco-portal gate-${state}" data-page="gate" data-gate-state="${state}" style="left:${position.x}px;top:${position.y}px;width:${position.width}px;height:${position.height}px" aria-label="CIVINCO Gate · ${label}">
 <svg viewBox="0 0 720 480" aria-hidden="true">
 <defs>
 <linearGradient id="portal-disk"><stop stop-color="#8f7050" stop-opacity=".3"/><stop offset=".35" stop-color="#f7ce89"/><stop offset=".65" stop-color="#fff6db"/><stop offset="1" stop-color="#b48349" stop-opacity=".4"/></linearGradient>
 <radialGradient id="portal-edge"><stop offset=".87" stop-color="#000"/><stop offset=".96" stop-color="#241c10"/><stop offset=".987" stop-color="#edc784"/><stop offset="1" stop-color="#fff4d5"/></radialGradient>
 <clipPath id="portal-lens-clip"><path d="M580 225A220 220 0 1 0 140 225A220 220 0 1 0 580 225ZM470 225A110 110 0 1 1 250 225A110 110 0 1 1 470 225Z" clip-rule="evenodd"/></clipPath>
 </defs>
 <g clip-path="url(#portal-lens-clip)" class="portal-lens"><image class="portal-lens-texture" href="assets/galaxy-v1.png" x="110" y="-25" width="500" height="500" preserveAspectRatio="xMidYMid slice"/><g class="portal-lens-arcs"><path d="M196 268C178 104 361 35 498 130M234 106C388 26 548 177 506 322M507 325C382 435 196 346 194 227"/></g></g>
 <g transform="translate(360 225)">${particles}</g>
 <g class="portal-orbits"><ellipse cx="360" cy="225" rx="284" ry="100" transform="rotate(-14 360 225)"/><ellipse class="portal-disk-inner" cx="360" cy="225" rx="267" ry="86" transform="rotate(-14 360 225)"/><path class="portal-stream" d="M88 260C182 86 480 93 624 155"/></g>
 <circle cx="360" cy="225" r="104" fill="url(#portal-edge)"/><circle cx="360" cy="225" r="91" fill="#000"/>
 <path class="portal-front-stream" d="M97 281C218 320 433 304 632 181"/>
 <path class="portal-horizon" d="M257 230Q345 194 463 214"/>
 <path d="M352 176L360 160L368 176L360 192Z" fill="#e7ce98"/><text x="360" y="244" text-anchor="middle" class="portal-seal">C</text>
 </svg><strong>CIVINCO</strong><span>${label}</span></button>`;
}
