import {registeredTools} from '../model/builtinTools'
import {strictValue,ToolsValue} from '../model/workflowValues'
import {World,Workspace} from '../model/types'
import {runTool,toolResultText,toolSpec} from './tools'
import {ToolCallContext} from './instanceProposals'
import {modelRequest} from './modelHttp'
export function resolveWorkflowTools(value:unknown,workspace:Workspace){
 const v=strictValue('Tools',value) as ToolsValue
 return v.toolIds.map(id=>{const tool=registeredTools(workspace).find(t=>t.id===id);if(!tool||!tool.enabled)throw new Error('Tool 不存在或已停用: '+id);return tool})
}
export async function workflowToolMember(key:string,value:ToolsValue,arg:unknown,settings:Record<string,string>,workspace:Workspace,world?:World,signal?:AbortSignal,http:typeof modelRequest=modelRequest,context?:ToolCallContext,execute?:(tool:import('../model/types').ToolDefinition,parameters:unknown)=>Promise<unknown>){
 if(key==='get'){if(!settings.toolId)throw new Error('请选择注册 Tool');const next:ToolsValue={type:'Tools',version:1,toolIds:[settings.toolId]};resolveWorkflowTools(next,workspace);return next}
 const tools=resolveWorkflowTools(value,workspace)
 if(key==='metadata')return JSON.stringify(tools.map(toolSpec))
 if(key==='execute'){if(tools.length!==1)throw new Error('调用 Tool 需要且只能接入一个工具');const parameters=JSON.parse(strictValue('String',arg) as string);return toolResultText(await (execute?execute(tools[0],parameters):runTool(tools[0],parameters,world,signal,http,context)))}
 throw new Error('未知 Tool 成员')
}
