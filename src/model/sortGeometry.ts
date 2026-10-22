/** Visual offsets leave a full-size slot for the dragged item without mutating data. */
export function sortOffsets(heights:number[],gap:number,from:number,to:number):number[] {
  const order=heights.map((_,i)=>i),[item]=order.splice(from,1)
  order.splice(Math.max(0,Math.min(order.length,to)),0,item)
  let original=0,next=0
  const tops=heights.map(height=>{const top=original;original+=height+gap;return top})
  const offsets=heights.map(()=>0)
  for(const index of order){offsets[index]=next-tops[index];next+=heights[index]+gap}
  return offsets
}

/** Pack selected rows into one slot while retaining both groups' relative order. */
export function sortGroupOffsets(heights:number[],gap:number,moving:number[],to:number):number[]{
 const selected=new Set(moving),group=heights.map((_,i)=>i).filter(i=>selected.has(i)),order=heights.map((_,i)=>i).filter(i=>!selected.has(i))
 order.splice(Math.max(0,Math.min(order.length,to)),0,...group)
 let original=0,next=0
 const tops=heights.map(height=>{const top=original;original+=height+gap;return top}),offsets=heights.map(()=>0)
 for(const index of order){offsets[index]=next-tops[index];next+=heights[index]+gap}
 return offsets
}
