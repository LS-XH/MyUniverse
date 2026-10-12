import {AgentDefinition,Workspace,uid} from '../model/types'
import {WorkflowEvent,emitWorkflowEvent} from './workflowExecution'

export interface AgentMemoryChange {agentId:string;scope:string;base:Record<string,unknown>|undefined;definition:string;variables:Record<string,unknown>}
export interface AgentRuntime {
 runId:string;sequence:number;nodes:number;calls:number;limits:{depth:number;nodes:number;calls:number};staged:Map<string,AgentMemoryChange>
}
export interface AgentInvocation {runtime:AgentRuntime;id:string;parentId?:string;agentId:string;depth:number}
export class AgentLimitError extends Error {}
export function isAgentLimit(error:unknown):boolean {return error instanceof AgentLimitError||error instanceof Error&&error.cause!==undefined&&isAgentLimit(error.cause)}
export const agentDefinitionSignature=(agent:AgentDefinition)=>JSON.stringify({variables:agent.variables,graph:agent.graph,inputSchema:agent.inputSchema})
export function newAgentRuntime(agent:AgentDefinition):AgentRuntime {
 const limits={depth:agent.limits?.depth??8,nodes:agent.limits?.nodes??10000,calls:agent.limits?.calls??128}
 for(const [name,value] of Object.entries(limits))if(!Number.isSafeInteger(value)||value<1||value>(name==='depth'?64:name==='nodes'?1000000:10000))throw new Error('无效 Agent 运行预算：'+name)
 return {runId:uid(),sequence:0,nodes:0,calls:0,limits,staged:new Map()}
}
export function spend(runtime:AgentRuntime,kind:'nodes'|'calls'):void {
 if(++runtime[kind]>runtime.limits[kind])throw new AgentLimitError(`Agent ${kind==='nodes'?'节点':'调用'}预算已耗尽`)
}
export async function emitAgentEvent(invocation:AgentInvocation|undefined,listener:((event:WorkflowEvent)=>void|Promise<void>)|undefined,event:WorkflowEvent,frame?:string):Promise<void> {
 await emitWorkflowEvent(listener,invocation?{...event,runId:invocation.runtime.runId,sequence:++invocation.runtime.sequence,invocationId:invocation.id,parentInvocationId:invocation.parentId,agentId:invocation.agentId,frame}:event)
}
/** Check every baseline before changing any memory, then commit immutably. */
export function commitAgentMemory(workspace:Workspace,changes:AgentMemoryChange[]):Workspace {
 for(const change of changes){
  const agent=workspace.agents?.find(a=>a.id===change.agentId)
  if(!agent||agentDefinitionSignature(agent)!==change.definition||JSON.stringify(agent.memory?.[change.scope])!==JSON.stringify(change.base))throw new Error('Agent 记忆或定义已变化，未覆盖并发修改')
 }
 return {...workspace,agents:workspace.agents?.map(agent=>{
  const own=changes.filter(c=>c.agentId===agent.id)
  return own.length?{...agent,memory:{...agent.memory,...Object.fromEntries(own.map(c=>[c.scope,structuredClone(c.variables)]))}}:agent
 })}
}
