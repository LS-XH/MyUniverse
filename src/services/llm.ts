import {ContextMessage,validateMessages} from '../model/workflowValues'
import { ModelConnection } from '../model/types'
import { apiEndpoint, modelRequest } from './modelHttp'

export type LLMMessage=ContextMessage
export async function discoverModels(model:ModelConnection,signal?:AbortSignal):Promise<string[]> {
  const result=await modelRequest({url:model.modelsUrl?.trim()||apiEndpoint(model.baseUrl,'models'),apiKey:model.apiKey,timeoutSeconds:15,signal})
  const data=Array.isArray(result)?result:result.data||result.models
  if(!Array.isArray(data))throw new Error('模型列表响应缺少 data / models 数组')
  return [...new Set<string>(data.map((item:any)=>typeof item==='string'?item:item.id||item.name||item.model).filter((id:unknown)=>typeof id==='string'&&!!id))].sort()
}
export function llmBody(model:ModelConnection,messages:LLMMessage[]):Record<string,unknown> {
  let extra:unknown={}
  if(model.extraBody?.trim())extra=JSON.parse(model.extraBody)
  if(!extra||typeof extra!=='object'||Array.isArray(extra))throw new Error('附加参数必须是 JSON 对象')
  const number=(value:number|undefined,key:string,min:number,max:number)=>{if(value!==undefined&&(!Number.isFinite(value)||value<min||value>max))throw new Error(`${key} 超出允许范围`);return value===undefined?{}:{[key]:value}}
  return {...extra,model:model.model,messages:messages.map(message=>({...message,...(message.tool_calls?{tool_calls:message.tool_calls.map(call=>({id:call.id,type:call.type,function:call.function}))}:{})})),stream:false,...(model.reasoningEffort?{reasoning_effort:model.reasoningEffort}:{}),...number(model.temperature,'temperature',0,2),...number(model.topP,'top_p',0,1),...number(model.maxTokens,'max_completion_tokens',1,1000000)}
}
export async function callLLMMessage(model:ModelConnection,messages:LLMMessage[],signal?:AbortSignal):Promise<LLMMessage> {
  if(!model.enabled)throw new Error('模型已停用')
  if(!model.model.trim())throw new Error('请选择或输入模型标识')
  const response=await modelRequest({url:model.chatUrl?.trim()||apiEndpoint(model.baseUrl,'chat/completions'),method:'POST',apiKey:model.apiKey,body:llmBody(model,messages),timeoutSeconds:model.timeoutSeconds||120,signal})
  const message=response.choices?.[0]?.message
  if(message&&!message.role)message.role='assistant'
  if(!message||message.role!=='assistant')throw new Error(response.error?.message||'模型响应缺少 assistant 消息')
  if(Array.isArray(message.content))message.content=message.content.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n')
  if(message.content==null&&message.tool_calls?.length)message.content=null
  return validateMessages({type:'Messages',version:1,items:[message]}).items[0]
}
export async function callLLM(model:ModelConnection,messages:LLMMessage[],signal?:AbortSignal):Promise<string>{const message=await callLLMMessage(model,messages,signal);return message.content||''}
