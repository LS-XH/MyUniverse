import {AgentsValue,strictValue} from '../model/workflowValues'
import {AgentDefinition,Workspace} from '../model/types'
import {agentCapability,agentSpec} from '../model/agents'

export function resolveWorkflowAgents(value:unknown,workspace:Workspace):AgentDefinition[] {
 return (strictValue('Agents',value) as AgentsValue).agentIds.map(id=>{
  const agent=workspace.agents?.find(a=>a.id===id)
  if(!agent||agent.enabled===false)throw new Error('Agent 不存在或已停用: '+id)
  return agent
 })
}
export function workflowAgentValue(key:string,value:AgentsValue,settings:Record<string,string>,workspace:Workspace):unknown {
 if(key==='get'){
  if(!settings.agentId)throw new Error('请选择注册 Agent')
  const result:AgentsValue={type:'Agents',version:1,agentIds:[settings.agentId]};resolveWorkflowAgents(result,workspace);return result
 }
 if(key==='metadata')return JSON.stringify(resolveWorkflowAgents(value,workspace).map(agentSpec))
 throw new Error('未知 Agent 成员')
}
export const agentCapabilities=(value:unknown,workspace:Workspace)=>value===undefined?[]:resolveWorkflowAgents(value,workspace).map(agentCapability)
