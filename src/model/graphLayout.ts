import {GRAPH_NODE_WIDTH as WIDTH,GRAPH_NODE_HEIGHT as HEIGHT,type Point} from './graphGeometry'

export type LayoutNode={id:string;group?:string}
export type LayoutEdge={source:string;target:string}
type Edge=LayoutEdge&{weight:number}
type Rect={left:number;top:number;right:number;bottom:number}
type Cluster={id:string;ids:string[];root:string;points:Record<string,Point>;box:Rect}
const GAP=180
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const intersects=(a:Rect,b:Rect,gap=0)=>a.left<b.right+gap&&a.right+gap>b.left&&a.top<b.bottom+gap&&a.bottom+gap>b.top
const shifted=(box:Rect,p:Point):Rect=>({left:box.left+p.x,right:box.right+p.x,top:box.top+p.y,bottom:box.bottom+p.y})
const crosses=(a:Point,b:Point,c:Point,d:Point)=>{
 const side=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)
 return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0
}
const segmentHits=(a:Point,b:Point,rect:Rect)=>{
 let low=0,high=1
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,rect.left,rect.right],[a.y,b.y-a.y,rect.top,rect.bottom]]){
  if(Math.abs(delta)<.000001){if(start<=min||start>=max)return false;continue}
  const t1=(min-start)/delta,t2=(max-start)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(low>=high)return false
 }
 return high>0&&low<1
}
const cardBox=(p:Point):Rect=>({left:p.x-WIDTH/2-12,right:p.x+WIDTH/2+12,top:p.y-HEIGHT/2-12,bottom:p.y+HEIGHT/2+12})
const shareEndpoint=(a:Edge,b:Edge)=>a.source===b.source||a.source===b.target||a.target===b.source||a.target===b.target
const sample=<T,>(items:T[],limit:number)=>items.length<=limit?items:Array.from({length:limit},(_,i)=>items[Math.floor(i*items.length/limit)])
const bounds=(ids:string[],points:Record<string,Point>):Rect=>({
 left:Math.min(...ids.map(id=>points[id].x))-WIDTH/2-42,
 right:Math.max(...ids.map(id=>points[id].x))+WIDTH/2+42,
 top:Math.min(...ids.map(id=>points[id].y))-HEIGHT/2-48,
 bottom:Math.max(...ids.map(id=>points[id].y))+HEIGHT/2+34
})

/** Separate faction rectangles, then arrange hubs and their branches inside each faction. */
export function clusteredGraphLayout(input:LayoutNode[],rawEdges:LayoutEdge[]):Record<string,Point>{
 if(!input.length)return {}
 const nodes=[...input].sort((a,b)=>a.id.localeCompare(b.id)),byId=new Map(nodes.map(n=>[n.id,n]))
 const adjacent=new Map(nodes.map(n=>[n.id,new Map<string,number>()])),degree=new Map(nodes.map(n=>[n.id,0]))
 const unique=new Map<string,Edge>()
 for(const raw of rawEdges){
  if(!byId.has(raw.source)||!byId.has(raw.target)||raw.source===raw.target)continue
  const [source,target]=[raw.source,raw.target].sort(),key=JSON.stringify([source,target]),edge=unique.get(key)
  if(edge)edge.weight++;else unique.set(key,{source,target,weight:1})
  degree.set(source,degree.get(source)!+1);degree.set(target,degree.get(target)!+1)
  adjacent.get(source)!.set(target,(adjacent.get(source)!.get(target)||0)+1)
  adjacent.get(target)!.set(source,(adjacent.get(target)!.get(source)||0)+1)
 }
 const edges=[...unique.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target))
 const rank=(a:string,b:string)=>degree.get(b)!-degree.get(a)!||a.localeCompare(b)
 const root=nodes.map(n=>n.id).sort(rank)[0]
 const memberOf=new Map<string,string>(),members=new Map<string,string[]>()
 for(const n of nodes)if(n.group){const key='faction:'+n.group;memberOf.set(n.id,key);const ids=members.get(key)||[];ids.push(n.id);members.set(key,ids)}
 // Unaffiliated connected components form their own clusters instead of spanning faction backgrounds.
 for(const n of nodes)if(!memberOf.has(n.id)){
  const key='unaffiliated:'+n.id,ids=[n.id];memberOf.set(n.id,key)
  for(let i=0;i<ids.length;i++)for(const other of adjacent.get(ids[i])!.keys())if(!byId.get(other)!.group&&!memberOf.has(other)){memberOf.set(other,key);ids.push(other)}
  members.set(key,ids.sort())
 }
 const clusters:Cluster[]=[]
 for(const [id,ids] of members){
  const set=new Set(ids),localEdges=edges.filter(e=>set.has(e.source)&&set.has(e.target)),hub=ids.includes(root)?root:[...ids].sort(rank)[0]
  const localDegree=new Map(ids.map(id=>[id,[...adjacent.get(id)!.keys()].filter(n=>set.has(n)).length]))
  // A maximum-affinity spanning tree favors local hubs over a universal high-degree root.
  const representatives=new Map(ids.map(id=>[id,id]))
  const representative=(id:string):string=>{let r=id;while(representatives.get(r)!==r)r=representatives.get(r)!;while(representatives.get(id)!==id){const next=representatives.get(id)!;representatives.set(id,r);id=next}return r}
  const affinity=(edge:Edge)=>{
   let common=0;for(const n of adjacent.get(edge.source)!.keys())if(set.has(n)&&adjacent.get(edge.target)!.has(n))common++
   return (Math.log2(edge.weight+1)+2*common)/Math.sqrt(Math.max(1,localDegree.get(edge.source)!*localDegree.get(edge.target)!))
  }
  const tree=new Map(ids.map(id=>[id,[] as string[]]))
  for(const {edge} of localEdges.map(edge=>({edge,score:affinity(edge)})).sort((a,b)=>b.score-a.score||rank(a.edge.source,b.edge.source)||rank(a.edge.target,b.edge.target))){
   const a=representative(edge.source),b=representative(edge.target);if(a===b)continue
   representatives.set(a,b);tree.get(edge.source)!.push(edge.target);tree.get(edge.target)!.push(edge.source)
  }
  // Faction members can have no recorded path to their faction hub; use a layout-only branch.
  for(const other of [...ids].sort(rank))if(representative(other)!==representative(hub)){
   representatives.set(representative(other),representative(hub));tree.get(hub)!.push(other);tree.get(other)!.push(hub)
  }
  const children=new Map(ids.map(id=>[id,[] as string[]])),order=[hub],parents=new Map([[hub,'']])
  for(let i=0;i<order.length;i++)for(const child of tree.get(order[i])!.sort(rank))if(!parents.has(child)){
   parents.set(child,order[i]);children.get(order[i])!.push(child);order.push(child)
  }
  const spans=new Map<string,number>()
  for(const id of [...order].reverse())spans.set(id,Math.max(1,children.get(id)!.reduce((s,n)=>s+spans.get(n)!,0)))
  const points:Record<string,Point>={[hub]:{x:0,y:0}},stride=HEIGHT+78
  const branch=(id:string,x:number,y:number,sign:number)=>{
   points[id]={x,y};const list=children.get(id)!;let cursor=y-(spans.get(id)!*stride)/2
   for(const child of list){const span=spans.get(child)!*stride;branch(child,x+sign*(WIDTH+105+Math.min(75,Math.sqrt(spans.get(child)!)*12)),cursor+span/2,sign);cursor+=span}
  }
  const sides:[string[],string[]]=[[],[]],sizes=[0,0]
  for(const child of children.get(hub)!.sort((a,b)=>spans.get(b)!-spans.get(a)!||rank(a,b))){const side=sizes[0]<=sizes[1]?0:1;sides[side].push(child);sizes[side]+=spans.get(child)!}
  sides.forEach((list,side)=>{let cursor=-sizes[side]*stride/2;for(const child of list){const height=spans.get(child)!*stride;branch(child,(side?-1:1)*(WIDTH+135),cursor+height/2,side?-1:1);cursor+=height}})
  const initial=Object.fromEntries(ids.map(id=>[id,{...points[id]}]))
  // Springs create local centers at peripheral hubs; the tree seed retains nested branch structure.
  for(let iteration=0;iteration<120;iteration++){
   const forces=Object.fromEntries(ids.map(id=>[id,{x:0,y:0}]))
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=points[ids[i]],b=points[ids[j]],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),force=18000/(d*d)
    forces[ids[i]].x-=dx/d*force;forces[ids[i]].y-=dy/d*force;forces[ids[j]].x+=dx/d*force;forces[ids[j]].y+=dy/d*force
    const overlapX=WIDTH+38-Math.abs(dx),overlapY=HEIGHT+38-Math.abs(dy)
    if(overlapX>0&&overlapY>0){const axis=overlapX<overlapY?'x':'y',delta=axis==='x'?dx:dy,amount=(axis==='x'?overlapX:overlapY)*.65,direction=delta>=0?1:-1;forces[ids[i]][axis]-=amount*direction;forces[ids[j]][axis]+=amount*direction}
   }
   for(const e of localEdges){const a=points[e.source],b=points[e.target],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),force=(d-285)*.045*Math.sqrt(Math.log2(e.weight+1));forces[e.source].x+=dx/d*force;forces[e.source].y+=dy/d*force;forces[e.target].x-=dx/d*force;forces[e.target].y-=dy/d*force}
   const limit=18*(1-iteration/120)+2
   for(const id of ids)if(id!==hub){const f=forces[id];f.x+=(initial[id].x-points[id].x)*.012;f.y+=(initial[id].y-points[id].y)*.012;const d=Math.max(limit,Math.hypot(f.x,f.y));points[id].x+=f.x/d*limit;points[id].y+=f.y/d*limit}
  }
  // Resolve rectangular card collisions without scaling the entire network.
  const placed:string[]=[]
  for(const id of [...ids].sort((a,b)=>a===hub?-1:b===hub?1:rank(a,b))){
   const origin={...points[id]},clear=(p:Point)=>placed.every(other=>Math.abs(p.x-points[other].x)>=WIDTH+36||Math.abs(p.y-points[other].y)>=HEIGHT+36)
   if(!clear(origin)){
    let found=false
    for(let ring=1;!found;ring++)for(let step=0;step<24;step++){
     const angle=step*Math.PI/12,p={x:origin.x+Math.cos(angle)*ring*(WIDTH+40)/3,y:origin.y+Math.sin(angle)*ring*(HEIGHT+40)/3}
     if(clear(p)){points[id]=p;found=true;break}
    }
   }
   placed.push(id)
  }
  // Explicit crossing minimization: exchange comparable branch endpoints, keeping hubs in their roles.
  const scoringEdges=sample(localEdges,320),incident=new Map(ids.map(id=>[id,new Set<number>()]))
  scoringEdges.forEach((e,i)=>{incident.get(e.source)!.add(i);incident.get(e.target)!.add(i)})
  const affectedScore=(a:string,b:string)=>{
   const affected=new Set([...incident.get(a)!,...incident.get(b)!]);let score=0
   for(const i of affected){const e=scoringEdges[i];score+=distance(points[e.source],points[e.target])*.02
    for(const id of ids)if(id!==e.source&&id!==e.target&&segmentHits(points[e.source],points[e.target],cardBox(points[id])))score+=300000
    for(let j=0;j<scoringEdges.length;j++){if(i===j||affected.has(j)&&j<i)continue;const other=scoringEdges[j];if(!shareEndpoint(e,other)&&crosses(points[e.source],points[e.target],points[other.source],points[other.target]))score+=100000}
   }
   return score
  }
  let attempts=0
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length&&attempts<220;j++){
   const a=ids[i],b=ids[j];if(a===hub||b===hub||parents.get(a)!==parents.get(b)||children.get(a)!.length||children.get(b)!.length)continue
   const da=localDegree.get(a)!,db=localDegree.get(b)!;if(Math.max(da,db)>2&&Math.abs(da-db)>1)continue
   attempts++;const before=affectedScore(a,b);[points[a],points[b]]=[points[b],points[a]]
   if(affectedScore(a,b)>=before)[points[a],points[b]]=[points[b],points[a]]
  }
  clusters.push({id,ids,root:hub,points,box:bounds(ids,points)})
 }
 const clusterById=new Map(clusters.map(c=>[c.id,c])),rootCluster=memberOf.get(root)!
 const connectivity=new Map(clusters.map(c=>[c.id,new Map<string,number>()]))
 for(const e of edges){const a=memberOf.get(e.source)!,b=memberOf.get(e.target)!;if(a!==b){connectivity.get(a)!.set(b,(connectivity.get(a)!.get(b)||0)+e.weight);connectivity.get(b)!.set(a,(connectivity.get(b)!.get(a)||0)+e.weight)}}
 const clusterRank=(a:string,b:string)=>rank(clusterById.get(a)!.root,clusterById.get(b)!.root)
 const clusterOrder=[rootCluster],visited=new Set(clusterOrder)
 for(let i=0;i<clusterOrder.length;i++)for(const id of [...connectivity.get(clusterOrder[i])!.keys()].sort(clusterRank))if(!visited.has(id)){visited.add(id);clusterOrder.push(id)}
 clusterOrder.push(...clusters.map(c=>c.id).filter(id=>!visited.has(id)).sort(clusterRank))
 const offsets=new Map<string,Point>([[rootCluster,{x:0,y:0}]])
 const local=new Map(clusters.flatMap(c=>c.ids.map(id=>[id,c.points[id]] as const)))
 // Crossing scoring is always active; very dense graphs use a deterministic edge sample.
 const scoreEdges=sample([...edges].sort((a,b)=>Number(memberOf.get(b.source)!==memberOf.get(b.target)!)-Number(memberOf.get(a.source)!==memberOf.get(a.target)!)),400)
 const globalPoint=(id:string,moving:string,offset:Point)=>{const p=local.get(id)!,t=memberOf.get(id)===moving?offset:offsets.get(memberOf.get(id)!)!;return {x:p.x+t.x,y:p.y+t.y}}
 const candidates=(cluster:Cluster,anchors:string[],preferred:Point)=>{
  const box=cluster.box,cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2,result=[preferred]
  for(const id of anchors){const other=shifted(clusterById.get(id)!.box,offsets.get(id)!),ox=(other.left+other.right)/2,oy=(other.top+other.bottom)/2
   for(const y of [oy-cy,preferred.y]){result.push({x:other.right+GAP-box.left,y},{x:other.left-GAP-box.right,y})}
   for(const x of [ox-cx,preferred.x,ox-cx-WIDTH*2.5,ox-cx+WIDTH*2.5]){result.push({x,y:other.bottom+GAP-box.top},{x,y:other.top-GAP-box.bottom})}
   for(const x of [other.right+GAP-box.left,other.left-GAP-box.right])for(const y of [other.bottom+GAP-box.top,other.top-GAP-box.bottom])result.push({x,y})
   // Longer diagonals can route a bridge around a third faction instead of through its hub.
   for(const factor of [1.75,2.5])for(const sign of [-1,1]){
    const x=ox-cx+sign*WIDTH*2.5
    result.push({x,y:other.top-GAP-box.bottom-(factor-1)*(box.bottom-box.top+GAP)},{x,y:other.bottom+GAP-box.top+(factor-1)*(box.bottom-box.top+GAP)})
   }
  }
  return result
 }
 const clear=(cluster:Cluster,p:Point)=>[...offsets].every(([id,t])=>id===cluster.id||!intersects(shifted(cluster.box,p),shifted(clusterById.get(id)!.box,t),GAP-1))
 const score=(cluster:Cluster,p:Point)=>{
  const active=scoreEdges.filter(e=>(memberOf.get(e.source)===cluster.id||offsets.has(memberOf.get(e.source)!))&&(memberOf.get(e.target)===cluster.id||offsets.has(memberOf.get(e.target)!)))
  const affected=new Set(active.flatMap((e,i)=>memberOf.get(e.source)===cluster.id||memberOf.get(e.target)===cluster.id?[i]:[]));let cost=0
  const points=new Map(nodes.filter(n=>memberOf.get(n.id)===cluster.id||offsets.has(memberOf.get(n.id)!)).map(n=>[n.id,globalPoint(n.id,cluster.id,p)]))
  const segments=active.map(e=>({a:points.get(e.source)!,b:points.get(e.target)!}))
  for(const i of affected){const e=active[i],{a,b}=segments[i]
   if(memberOf.get(e.source)!==memberOf.get(e.target)!)cost+=distance(a,b)*Math.sqrt(e.weight)
   for(const [id,point] of points)if(id!==e.source&&id!==e.target&&segmentHits(a,b,cardBox(point)))cost+=10000000
   if(memberOf.get(e.source)!==memberOf.get(e.target)!)for(const [id,offset] of offsets){
    if(id===memberOf.get(e.source)||id===memberOf.get(e.target))continue
    if(segmentHits(a,b,shifted(clusterById.get(id)!.box,id===cluster.id?p:offset)))cost+=600000
   }
   for(let j=0;j<active.length;j++){if(i===j||affected.has(j)&&j<i)continue;const other=active[j];if(!shareEndpoint(e,other)&&crosses(a,b,segments[j].a,segments[j].b))cost+=2000000}
  }
  // Existing links can also be obstructed by a cluster moved between their endpoints.
  for(let i=0;i<active.length;i++)if(!affected.has(i)){
   const {a,b}=segments[i]
   for(const id of cluster.ids)if(segmentHits(a,b,cardBox(points.get(id)!)))cost+=10000000
   const e=active[i];if(memberOf.get(e.source)!==memberOf.get(e.target)!&&segmentHits(a,b,shifted(cluster.box,p)))cost+=600000
  }
  const boxes=[shifted(cluster.box,p),...[...offsets].filter(([id])=>id!==cluster.id).map(([id,t])=>shifted(clusterById.get(id)!.box,t))]
  const width=Math.max(...boxes.map(b=>b.right))-Math.min(...boxes.map(b=>b.left)),height=Math.max(...boxes.map(b=>b.bottom))-Math.min(...boxes.map(b=>b.top))
  return cost+width*height*.0008+Math.hypot(p.x,p.y)*.08
 }
 for(const id of clusterOrder.slice(1)){
  const cluster=clusterById.get(id)!,neighbors=[...connectivity.get(id)!.keys()].filter(n=>offsets.has(n)).sort(clusterRank)
  const anchors=neighbors.length?neighbors:[rootCluster],preferred={x:anchors.reduce((s,id)=>s+offsets.get(id)!.x,0)/anchors.length,y:anchors.reduce((s,id)=>s+offsets.get(id)!.y,0)/anchors.length}
  // Include every placed rectangle as a packing anchor so a free location always exists.
  let best:Point|undefined,bestCost=Infinity
  for(const p of candidates(cluster,[...new Set([...anchors,...offsets.keys()])],preferred))if(clear(cluster,p)){const cost=score(cluster,p);if(cost<bestCost){best=p;bestCost=cost}}
  offsets.set(id,best!)
 }
 // Revisit cluster placements with all cross-faction edges present, not just the spanning tree.
 for(const id of clusterOrder.slice(1).reverse()){
  const cluster=clusterById.get(id)!,current=offsets.get(id)!,anchors=[...connectivity.get(id)!.keys()].sort(clusterRank)
  let best=current,bestCost=score(cluster,current)
  for(const p of candidates(cluster,anchors.slice(0,8),current))if(clear(cluster,p)){const cost=score(cluster,p);if(cost<bestCost){best=p;bestCost=cost}}
  offsets.set(id,best)
 }
 // Reflect an entire cluster to align its bridge endpoints with neighboring clusters.
 // Its background stays in exactly the same rectangle; nested branches move together.
 for(const id of clusterOrder.slice(1)){
  const cluster=clusterById.get(id)!,original=Object.fromEntries(cluster.ids.map(id=>[id,{...cluster.points[id]}])),box=cluster.box,offset=offsets.get(id)!
  let bestCost=score(cluster,offset),bestPoints=cluster.points,bestBox=box,bestOffset=offset
  for(const [sx,sy] of [[-1,1],[1,-1],[-1,-1]]){
   cluster.points=Object.fromEntries(cluster.ids.map(id=>[id,{x:original[id].x*sx,y:original[id].y*sy}]))
   cluster.box=bounds(cluster.ids,cluster.points)
   const p={x:offset.x+(box.left+box.right-cluster.box.left-cluster.box.right)/2,y:offset.y+(box.top+box.bottom-cluster.box.top-cluster.box.bottom)/2}
   for(const id of cluster.ids)local.set(id,cluster.points[id])
   const cost=score(cluster,p)
   if(cost<bestCost){bestCost=cost;bestPoints=cluster.points;bestBox=cluster.box;bestOffset=p}
  }
  cluster.points=bestPoints;cluster.box=bestBox;offsets.set(id,bestOffset)
  for(const id of cluster.ids)local.set(id,cluster.points[id])
 }
 const result:Record<string,Point>={}
 for(const cluster of clusters){const offset=offsets.get(cluster.id)!;for(const id of cluster.ids)result[id]={x:cluster.points[id].x+offset.x-WIDTH/2,y:cluster.points[id].y+offset.y-HEIGHT/2}}
 return result
}

