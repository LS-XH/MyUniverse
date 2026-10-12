import {WorkflowGraph,WorkflowNode,WorkflowPort,VariableBinding} from './types'
import {poolEntries} from './variablePool'
import {variablePort} from './workflowValues'

/** Pair by operation semantics, not merely by coincidentally equal types. */
export function pairedOutput(node:WorkflowNode,input:WorkflowPort):string|undefined {
 const replacement=node.kind==='valueMethod'&&!((['Tools','Agents'].includes(node.settings.variableType)&&node.settings.member==='get')||(node.settings.variableType==='Image'&&['fromUrl','fromSD'].includes(node.settings.member)))
 const primary=node.kind==='variable'?'value':replacement?'self':undefined
 if(input.name!==primary)return
 return node.outputs.find(p=>p.name==='value'&&p.type===input.type)?.name
}
export function bindVariable(graph:WorkflowGraph,variables:Record<string,unknown>,nodeId:string,portName:string,direction:'in'|'out',variableId:string):WorkflowGraph {
 const entry=poolEntries(variables).find(v=>v.id===variableId),node=graph.nodes.find(n=>n.id===nodeId)
 const port=(direction==='in'?node?.inputs:node?.outputs)?.find(p=>p.name===portName)
 if(!entry?.type||!node||!port)throw new Error('变量或端口不存在')
 if(port.type!==variablePort(entry.type))throw new Error(`端口需要 ${port.type}，变量为 ${entry.type}`)
 const binding:VariableBinding={variableId:entry.id,name:entry.name,...(direction==='in'&&pairedOutput(node,port)?{output:pairedOutput(node,port)}:{})}
 return {...graph,nodes:graph.nodes.map(n=>n.id===nodeId?{...n,bindings:{...n.bindings,[`${direction}:${portName}`]:binding}}:n)}
}
export function unbindVariable(graph:WorkflowGraph,nodeId:string,key:string):WorkflowGraph {
 return {...graph,nodes:graph.nodes.map(n=>{if(n.id!==nodeId)return n;const bindings={...n.bindings};delete bindings[key];return {...n,bindings}})}
}
