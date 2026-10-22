/** Pick the closest visible row across margins as well as row bodies. */
export function nearestTreeTarget<T extends {top:number;bottom:number}>(rows:T[],y:number):T|undefined{
 let nearest:T|undefined,distance=Infinity
 for(const row of rows){if(row.bottom<=row.top)continue;const gap=Math.max(row.top-y,y-row.bottom,0);if(gap<distance){distance=gap;nearest=row}}
 return nearest
}
