import {WorkflowGraph,WorkflowNode} from './types'
import {defaultVariable,strictValue,variablePort,variableTypes,VariableType} from './workflowValues'

export function controlType(node:WorkflowNode):VariableType {
 const type=node.settings.variableType as VariableType
 if(!variableTypes.includes(type))throw new Error('流程控制必须指定严格类型')
 return type
}
export function configureControl(node:WorkflowNode,type:VariableType):WorkflowNode {
 const port=variablePort(type),value=defaultVariable(type)
 return {...node,settings:{...node.settings,variableType:type},inputs:node.kind==='loop'?
  [{name:'initial',type:port,default:value},{name:'next',type:port,required:true},{name:'continue',type:'BOOLEAN',default:false}]:
  [{name:'condition',type:'BOOLEAN',default:false},{name:'trueValue',type:port,default:value},{name:'falseValue',type:port,default:value}],
 outputs:node.kind==='loop'?[{name:'current',type:port},{name:'iteration',type:'NUMBER'},{name:'result',type:port}]:[{name:'value',type:port}]}
}
/** Bodies are dependency closures, stopping at the owner and its initial dependencies. */
export function loopBodies(graph:WorkflowGraph):Map<string,Set<string>> {
 const bodies=new Map<string,Set<string>>()
 const ancestors=(id:string,stop:Set<string>,found=new Set<string>(),output?:string)=>{
  if(stop.has(id)||found.has(id))return found
  found.add(id)
  if(graph.nodes.find(n=>n.id===id)?.kind==='loop'&&['current','iteration'].includes(output||''))return found
  for(const edge of graph.links.filter(e=>e.to===id))ancestors(edge.from,stop,found,edge.output)
  return found
 }
 for(const loop of graph.nodes.filter(n=>n.kind==='loop')){
  const external=new Set<string>([loop.id])
  for(const edge of graph.links.filter(e=>e.to===loop.id&&e.input==='initial'))for(const id of ancestors(edge.from,new Set([loop.id]),new Set(),edge.output))external.add(id)
  const body=new Set<string>()
  for(const edge of graph.links.filter(e=>e.to===loop.id&&['next','continue'].includes(e.input)))ancestors(edge.from,external,body,edge.output)
  bodies.set(loop.id,body)
 }
 return bodies
}
export function validateControl(graph:WorkflowGraph,complete=true):void {
 const bodies=loopBodies(graph)
 const affected=new Map<string,Set<string>>()
 for(const [id,body] of bodies){
  const reached=new Set<string>(),queue=graph.links.filter(e=>e.from===id&&['current','iteration'].includes(e.output)).map(e=>e.to)
  while(queue.length){const node=queue.shift()!;if(!body.has(node)||reached.has(node))continue;reached.add(node);queue.push(...graph.links.filter(e=>e.from===node).map(e=>e.to))}
  affected.set(id,reached)
 }
 for(const node of graph.nodes.filter(n=>n.kind==='loop'||n.kind==='condition')){
  const type=controlType(node),expected=configureControl(node,type)
  for(const direction of ['inputs','outputs'] as const)if(JSON.stringify(node[direction].map(p=>[p.name,p.type]))!==JSON.stringify(expected[direction].map(p=>[p.name,p.type])))throw new Error('流程控制端口与声明类型不一致')
  if(node.kind==='loop'){
   const max=Number(node.settings.maxIterations||16)
   if(!Number.isSafeInteger(max)||max<1||max>10000)throw new Error('循环上限必须为 1–10000')
   const body=bodies.get(node.id)!
   for(const edge of complete?graph.links:[]){
    if(edge.from===node.id&&['current','iteration'].includes(edge.output)&&!body.has(edge.to))throw new Error('循环中间值只能连接循环体')
    if(affected.get(node.id)!.has(edge.from)&&!body.has(edge.to)&&edge.to!==node.id)throw new Error('循环体结果必须通过循环 result 输出')
    if(edge.from===node.id&&edge.output==='result'&&body.has(edge.to))throw new Error('循环体不能依赖尚未完成的 result')
   }
   if(Object.hasOwn(node.settings,'port:next'))strictValue(type,JSON.parse(node.settings['port:next']))
  }
 }
 const entries=[...bodies]
 for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
  const [aid,as]=entries[a],[bid,bs]=entries[b]
  const intersection=[...affected.get(aid)!].some(id=>affected.get(bid)!.has(id))
  if(intersection&&!as.has(bid)&&!bs.has(aid))throw new Error('不支持交叉循环边界')
 }
 const visited=new Set<string>(),active=new Set<string>()
 const visit=(id:string)=>{
  if(active.has(id))throw new Error('工作流存在循环：回边必须通过循环卡片')
  if(visited.has(id))return
  active.add(id)
  for(const edge of graph.links.filter(e=>e.to===id)){
   const target=graph.nodes.find(n=>n.id===id)
   if(target?.kind==='loop'&&['next','continue'].includes(edge.input))continue
   visit(edge.from)
  }
  active.delete(id);visited.add(id)
 }
 graph.nodes.forEach(n=>visit(n.id))
}
