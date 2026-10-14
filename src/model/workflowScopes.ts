import {WorkflowGraph,WorkflowNode,uid} from './types'
export function scopeTerminal(kind:'break'|'continue'|'return',x=600,y=100):WorkflowNode {
 return {id:uid(),kind,title:kind==='return'?'返回':kind,x,y,settings:{},inputs:kind==='return'?[{name:'after',type:'ANY'}]:[{name:'condition',type:'BOOLEAN',default:kind==='continue'}],outputs:[]}
}
export function newScopeGraph(scope:'loop'|'method'):WorkflowGraph {
 return {version:1,scope,nodes:scope==='loop'?[scopeTerminal('break',600,100),scopeTerminal('continue',600,300)]:[scopeTerminal('return')],links:[]}
}
export function walkWorkflowNodes(graph:WorkflowGraph):WorkflowNode[]{return graph.nodes.flatMap(n=>[n,...(n.body?walkWorkflowNodes(n.body):[])])}
export function mapWorkflowNodes(graph:WorkflowGraph,fn:(node:WorkflowNode)=>WorkflowNode):WorkflowGraph{return {...graph,nodes:graph.nodes.map(n=>fn(n.body?{...n,body:mapWorkflowNodes(n.body,fn)}:n))}}
export function graphLeaves(graph:WorkflowGraph):WorkflowNode[]{return graph.nodes.filter(n=>!graph.links.some(e=>e.from===n.id))}
/** Scope edits are folded into the root transaction; nested graphs never share wires. */
export function replaceWorkflowBody(graph:WorkflowGraph,nodeId:string,body:WorkflowGraph):WorkflowGraph {
 return {...graph,nodes:graph.nodes.map(n=>n.id===nodeId?{...n,body}:n.body?{...n,body:replaceWorkflowBody(n.body,nodeId,body)}:n)}
}
