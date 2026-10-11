// The same constellation carries the same light wherever it appears in the sky.
export const SKY_COLORS = {
 Ori:'#8ec9ef', Cyg:'#76d6cb', UMa:'#e7ba83', Gem:'#e8a6c3',
 Leo:'#dbce8b', Aur:'#98a8ee', Cas:'#c2a0ec', Peg:'#83c9a9',
 Aql:'#a4bee5', Aqr:'#83d6e8', Vir:'#d3b0a0', Lyr:'#dc9ddb'
};
export function skyAccent(id){return `--sky-accent:${SKY_COLORS[id] || '#a9b8ce'}`;}
