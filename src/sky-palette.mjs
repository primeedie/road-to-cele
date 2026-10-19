// The same constellation carries the same light wherever it appears in the sky.
export const SKY_COLORS = {
 Ori:'#8ec9ef', Cyg:'#76d6cb', UMa:'#e7ba83', Gem:'#e8a6c3',
 Leo:'#dbce8b', Aur:'#98a8ee', Cas:'#c2a0ec', Peg:'#83c9a9',
 Aql:'#a4bee5', Aqr:'#83d6e8', Vir:'#d3b0a0', Lyr:'#dc9ddb'
};
// Richer cuts on the stars retain their constellation hue beside a bright core.
export const STAR_COLORS = {
 Ori:'#52ade8', Cyg:'#31c7b5', UMa:'#ed9c4b', Gem:'#ee679b',
 Leo:'#d9bc47', Aur:'#7f89ee', Cas:'#ae78eb', Peg:'#44bd85',
 Aql:'#7da6ea', Aqr:'#39c4e3', Vir:'#ed8169', Lyr:'#db65cf'
};
export function skyAccent(id){return `--sky-accent:${SKY_COLORS[id] || '#a9b8ce'};--star-accent:${STAR_COLORS[id] || SKY_COLORS[id] || '#a9b8ce'}`;}
