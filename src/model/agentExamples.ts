import {walkWorkflowNodes} from './workflowScopes'
import {conversationAgent} from './workflowTemplates'
import {AgentDefinition,Workspace} from './types'

export const toolUseExampleInput='请调用工具，列出当前世界的所有类名，并根据工具结果回答。'

/** Install once as a real editable Agent, without recreating intentionally deleted copies. */
export function installToolUseTemplate(workspace:Workspace):Workspace {
 if(workspace.toolUseTemplateInstalled)return workspace
 const exists=workspace.agents?.some(agent=>agent.name==='LLM + ToolCalls · 查询世界类名')
 const model=workspace.models?.find(item=>item.enabled&&item.model.trim())
 return {...workspace,toolUseTemplateInstalled:true,agents:exists?workspace.agents:[...(workspace.agents||[]),createToolUseExample(model?.id)]}
}

/** Explicit, editable tool exchange; no hidden system prompt or automatic tool loop. */
export function createToolUseExample(modelId?:string):AgentDefinition {
 const agent=conversationAgent(modelId,['builtin:list_classes'],[{role:'system',content:'你是世界对象查询助手。先调用工具查询，根据结果回答，不编造。'}],'LLM + ToolCalls · 查询世界类名')
 agent.variables.toolUseHistory=agent.variables.history;delete agent.variables.history
 for(const node of walkWorkflowNodes(agent.graph))if(node.settings.name==='history')node.settings.name='toolUseHistory'
 return agent
}
