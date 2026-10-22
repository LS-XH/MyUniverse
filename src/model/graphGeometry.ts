export const GRAPH_NODE_WIDTH = 210
export const GRAPH_NODE_HEIGHT = 88
export type Point = { x: number; y: number }
/** Top-left world position that places a card at the unobscured viewport center. */
export function viewportNodePosition(pan:Point,scale:number,width:number,height:number,coveredRight=0):Point{
 return {x:(Math.max(0,width-coveredRight)/2-pan.x)/scale-GRAPH_NODE_WIDTH/2,y:(height/2-pan.y)/scale-GRAPH_NODE_HEIGHT/2}
}
export const GRAPH_MIN_SCALE = .08
export const GRAPH_MAX_SCALE = 3
export function relationGeometry(a:Point,b:Point,width:number,border:number) {
  const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||1,ux=dx/distance,uy=dy/distance,nx=-uy,ny=ux
  const inset=Math.min(distance,(GRAPH_NODE_WIDTH/2+8+border)/Math.max(Math.abs(ux),.0001),(GRAPH_NODE_HEIGHT/2+8+border)/Math.max(Math.abs(uy),.0001))
  const tip={x:b.x+GRAPH_NODE_WIDTH/2-ux*inset,y:b.y+GRAPH_NODE_HEIGHT/2-uy*inset}
  const length=Math.max(12,width*3),half=Math.max(6,width*1.5),base={x:tip.x-ux*length,y:tip.y-uy*length}
  return {start:{x:a.x+GRAPH_NODE_WIDTH/2,y:a.y+GRAPH_NODE_HEIGHT/2},end:{x:base.x-ux*border,y:base.y-uy*border},tip,base,left:{x:base.x+nx*half,y:base.y+ny*half},right:{x:base.x-nx*half,y:base.y-ny*half}}
}
/** Route parallel inference edges and self-references without hiding their labels. */
export function curvedRelationGeometry(a:Point,b:Point,bend:number,width:number,border:number){
 const center=(p:Point)=>({x:p.x+GRAPH_NODE_WIDTH/2,y:p.y+GRAPH_NODE_HEIGHT/2})
 const ac=center(a),bc=center(b),self=a.x===b.x&&a.y===b.y
 const dx=bc.x-ac.x,dy=bc.y-ac.y,distance=Math.hypot(dx,dy)||1
 const control={x:(ac.x+bc.x)/2-dy/distance*bend,y:(ac.y+bc.y)/2+dx/distance*bend}
 const boundary=(c:Point,toward:Point)=>{const vx=toward.x-c.x,vy=toward.y-c.y,len=Math.hypot(vx,vy)||1,ux=vx/len,uy=vy/len,inset=Math.min((GRAPH_NODE_WIDTH/2+8+border)/Math.max(Math.abs(ux),.0001),(GRAPH_NODE_HEIGHT/2+8+border)/Math.max(Math.abs(uy),.0001));return {x:c.x+ux*inset,y:c.y+uy*inset}}
 const start=self?{x:a.x+GRAPH_NODE_WIDTH+8,y:a.y+GRAPH_NODE_HEIGHT*.4}:boundary(ac,control)
 const tip=self?{x:a.x+GRAPH_NODE_WIDTH*.65,y:a.y-8}:boundary(bc,control)
 const radius=Math.max(100,Math.abs(bend)),lastControl=self?{x:tip.x+radius,y:tip.y-radius}:control
 const length=Math.hypot(tip.x-lastControl.x,tip.y-lastControl.y)||1,ux=(tip.x-lastControl.x)/length,uy=(tip.y-lastControl.y)/length
 const arrowLength=Math.max(12,width*3),half=Math.max(6,width*1.5),base={x:tip.x-ux*arrowLength,y:tip.y-uy*arrowLength},end={x:base.x-ux*border,y:base.y-uy*border}
 const path=self?`M ${start.x} ${start.y} C ${start.x+radius} ${start.y-radius}, ${lastControl.x} ${lastControl.y}, ${end.x} ${end.y}`:`M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`
 const label=self?{x:ac.x+GRAPH_NODE_WIDTH/2+radius*.6,y:a.y-radius*.65}:{x:(start.x+2*control.x+end.x)/4,y:(start.y+2*control.y+end.y)/4-12}
 return {path,tip,left:{x:base.x-uy*half,y:base.y+ux*half},right:{x:base.x+uy*half,y:base.y-ux*half},label}
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

/** Personal layout is transient: never replace the full network's saved positions. */
export function personalGraphLayout(center:string,ids:string[]) {
  const neighbors=ids.filter(id=>id!==center),radius=Math.max(280,neighbors.length*250/(2*Math.PI))
  const positions:Record<string,Point>={[center]:{x:-GRAPH_NODE_WIDTH/2,y:-GRAPH_NODE_HEIGHT/2}}
  neighbors.forEach((id,i)=>{const angle=-Math.PI/2+i*2*Math.PI/neighbors.length;positions[id]={x:Math.cos(angle)*radius-GRAPH_NODE_WIDTH/2,y:Math.sin(angle)*radius-GRAPH_NODE_HEIGHT/2}})
  return positions
}

/** Undirected shortest-hop layers. Cycles, parallel edges and incoming links share one card. */
export function personalGraphLayers(center:string,edges:ReadonlyArray<{source:string;target:string}>,depth:number):string[][] {
 const adjacency=new Map<string,Set<string>>()
 for(const {source,target} of edges){if(!adjacency.has(source))adjacency.set(source,new Set());if(!adjacency.has(target))adjacency.set(target,new Set());adjacency.get(source)!.add(target);adjacency.get(target)!.add(source)}
 const layers=[[center]],seen=new Set([center]),limit=Math.max(1,Math.min(5,Math.trunc(depth)||1))
 for(let level=1;level<=limit;level++){
  const next:string[]=[]
  for(const parent of layers[level-1])for(const id of [...(adjacency.get(parent)||[])].sort())if(!seen.has(id)){seen.add(id);next.push(id)}
  if(!next.length)break
  layers.push(next)
 }
 return layers
}
/** Separate concentric rings preserve hop distance without modifying saved full-view positions. */
export function layeredPersonalGraphLayout(layers:string[][]):Record<string,Point>{
 const positions:Record<string,Point>={};let radius=0
 layers.forEach((ids,level)=>{
  if(level===0){for(const id of ids)positions[id]={x:-GRAPH_NODE_WIDTH/2,y:-GRAPH_NODE_HEIGHT/2};return}
  radius=Math.max(radius+300,ids.length*260/(2*Math.PI))
  ids.forEach((id,index)=>{const angle=-Math.PI/2+index*2*Math.PI/ids.length;positions[id]={x:Math.cos(angle)*radius-GRAPH_NODE_WIDTH/2,y:Math.sin(angle)*radius-GRAPH_NODE_HEIGHT/2}})
 })
 return positions
}
