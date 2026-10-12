import Ajv2020 from 'ajv/dist/2020'
import {AgentDefinition,ToolDefinition} from './types'
import {toolSpec} from '../services/tools'

export const defaultAgentSchema={type:'object',properties:{input:{type:'string'}},required:['input'],additionalProperties:false}
const ajv=new Ajv2020({allErrors:true,strict:false,useDefaults:true})
export function agentCapability(agent:AgentDefinition):ToolDefinition & {agentId:string} {
 return {id:agent.id,agentId:agent.id,name:agent.name,enabled:agent.enabled!==false,kind:'js',url:'',method:'POST',apiKey:'',bodyMode:'raw',
  callName:agent.callName||`agent_${agent.id.replace(/[^a-zA-Z0-9_]/g,'_')}`,description:agent.description||agent.name,inputSchema:agent.inputSchema||defaultAgentSchema}
}
export const agentSpec=(agent:AgentDefinition)=>toolSpec(agentCapability(agent))
export function agentParameters(agent:AgentDefinition,value:unknown):Record<string,unknown> {
 const parameters=structuredClone(typeof value==='string'?{input:value}:value)
 const schema=agentSpec(agent).inputSchema,validate=ajv.compile(schema)
 if(!validate(parameters))throw new Error('Agent 参数不符合 inputSchema: '+ajv.errorsText(validate.errors))
 return parameters as Record<string,unknown>
}
export function agentChatReason(agent:AgentDefinition):string|undefined {
 if(agent.enabled===false)return '已停用'
 try{agentParameters(agent,{input:'聊天输入'});return undefined}catch{return '需要额外参数，请通过工作流或模型调用'}
}
