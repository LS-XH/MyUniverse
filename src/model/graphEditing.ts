import { uid } from './types'
export interface EditNode {id:string;x:number;y:number;kind?:string;type?:string}
export interface EditEdge {id:string;from:string;to:string}
export interface EditGraph<N extends EditNode=EditNode,E extends EditEdge=EditEdge>{version:1;nodes:N[];links?:E[];edges?:E[]}
export const edgesOf=<N extends EditNode,E extends EditEdge>(graph:EditGraph<N,E>)=>graph.links||graph.edges||[]
export function removeGraphSelection<G extends EditGraph>(graph:G,nodes:string[],edges:string[]):G {
  const removable=new Set(nodes)
  const remaining=edgesOf(graph).filter(e=>!edges.includes(e.id)&&!removable.has(e.from)&&!removable.has(e.to))
  return {...graph,nodes:graph.nodes.filter(n=>!removable.has(n.id)),...(graph.links?{links:remaining}:{edges:remaining})}
}
export function graphFragment<G extends EditGraph>(graph:G,selected:string[]):G {
  const ids=new Set(selected),nodes=graph.nodes.filter(n=>ids.has(n.id)),edges=edgesOf(graph).filter(e=>ids.has(e.from)&&ids.has(e.to))
  return structuredClone({...graph,nodes,...(graph.links?{links:edges}:{edges})})
}
export function pasteGraphFragment<G extends EditGraph>(graph:G,fragment:G,offset={x:36,y:36}):{graph:G;ids:string[]} {
  const nodes=fragment.nodes
  const ids=new Map(nodes.map(n=>[n.id,uid()])),copied=nodes.map(n=>({...structuredClone(n),id:ids.get(n.id)!,x:n.x+offset.x,y:n.y+offset.y}))
  const edges=edgesOf(fragment).filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...structuredClone(e),id:uid(),from:ids.get(e.from)!,to:ids.get(e.to)!}))
  return {graph:{...graph,nodes:[...graph.nodes,...copied],...(graph.links?{links:[...edgesOf(graph),...edges]}:{edges:[...edgesOf(graph),...edges]})},ids:copied.map(n=>n.id)}
}
export interface ConnectionEnd {id:string;port:string;direction:'in'|'out'}
export function directedConnection(a:ConnectionEnd,b:ConnectionEnd){
  if(a.direction===b.direction)throw new Error('请选择一对输入和输出端口')
  const output=a.direction==='out'?a:b,input=a.direction==='in'?a:b
  if(output.id===input.id)throw new Error('不能连接卡片自身')
  return {from:output.id,output:output.port,to:input.id,input:input.port}
}

export function marqueeNodeIds(nodes:EditNode[],a:{x:number;y:number},b:{x:number;y:number},sizes:Map<string,{width:number;height:number}>):string[]{
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y)
 return nodes.filter(n=>{const size=sizes.get(n.id)||{width:300,height:200};return n.x<right&&n.x+size.width>left&&n.y<bottom&&n.y+size.height>top}).map(n=>n.id)
}
