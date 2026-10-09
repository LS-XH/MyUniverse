export const GRAPH_NODE_WIDTH = 210
export const GRAPH_NODE_HEIGHT = 88
export type Point = { x: number; y: number }
export const GRAPH_MIN_SCALE = .08
export const GRAPH_MAX_SCALE = 3
export function relationGeometry(a:Point,b:Point,width:number,border:number) {
  const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||1,ux=dx/distance,uy=dy/distance,nx=-uy,ny=ux
  const inset=Math.min(distance,(GRAPH_NODE_WIDTH/2+8+border)/Math.max(Math.abs(ux),.0001),(GRAPH_NODE_HEIGHT/2+8+border)/Math.max(Math.abs(uy),.0001))
  const tip={x:b.x+GRAPH_NODE_WIDTH/2-ux*inset,y:b.y+GRAPH_NODE_HEIGHT/2-uy*inset}
  const length=Math.max(12,width*3),half=Math.max(6,width*1.5),base={x:tip.x-ux*length,y:tip.y-uy*length}
  return {start:{x:a.x+GRAPH_NODE_WIDTH/2,y:a.y+GRAPH_NODE_HEIGHT/2},end:{x:base.x-ux*border,y:base.y-uy*border},tip,base,left:{x:base.x+nx*half,y:base.y+ny*half},right:{x:base.x-nx*half,y:base.y-ny*half}}
}
export function zoomAt(pan:Point,scale:number,factor:number,anchor:Point) {
  const next=Math.max(GRAPH_MIN_SCALE,Math.min(GRAPH_MAX_SCALE,scale*factor))
  return {scale:next,pan:{x:anchor.x-(anchor.x-pan.x)*next/scale,y:anchor.y-(anchor.y-pan.y)*next/scale}}
}
// Screen pixels per second: accelerate near an edge and stop in the interior.
export function edgePanVelocity(pointer:Point,rect:{left:number;right:number;top:number;bottom:number},card?:{left:number;right:number;top:number;bottom:number}):Point {
  const axis=(value:number,min:number,max:number,low=value,high=value)=>{
    const margin=Math.min(160,(max-min)/3)
    if(margin<=0)return 0
    const gain=(distance:number)=>Math.max(0,Math.min(1,(margin-distance)/margin))
    return 1400*(gain(low-min)-gain(max-high))
  }
  return {x:axis(pointer.x,rect.left,rect.right,card?.left,card?.right),y:axis(pointer.y,rect.top,rect.bottom,card?.top,card?.bottom)}
}

// A single pointer displacement applies to each initial node position. No
// incremental rounding or dependence on the last React render while dragging.
export function translateSelection(initial: Record<string, Point>, offset: Point): Record<string, Point> {
  return Object.fromEntries(Object.entries(initial).map(([id, point]) => [id, { x: point.x + offset.x, y: point.y + offset.y }]))
}

export function graphBounds(points: Point[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const x = Math.min(0, ...xs) - 100, y = Math.min(0, ...ys) - 100
  return { x, y, width: Math.max(1, ...xs.map(value => value + GRAPH_NODE_WIDTH)) - x + 100, height: Math.max(1, ...ys.map(value => value + GRAPH_NODE_HEIGHT)) - y + 100 }
}
