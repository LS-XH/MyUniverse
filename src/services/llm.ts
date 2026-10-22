import {modelUsage,ModelUsage} from '../model/modelUsage'
import {isAgentLimit} from './agentRuntime'
import {registeredTools} from '../model/builtinTools'
import {ToolCallContext} from './instanceProposals'
import {modelToolSpec,runTool,toolName,toolResultText} from './tools'
import {ContextMessage,validateMessages} from '../model/workflowValues'
import { ToolDefinition, Workspace, World, ModelConnection } from '../model/types'
import { apiEndpoint, modelRequest,modelStream } from './modelHttp'

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
export async function callLLMMessage(model:ModelConnection,messages:LLMMessage[],signal?:AbortSignal,tools?:ToolDefinition[],options?:{toolChoice?:string;onUsage?:(usage:ModelUsage)=>void|Promise<void>}):Promise<LLMMessage> {
  if(!model.enabled)throw new Error('模型已停用')
  if(!model.model.trim())throw new Error('请选择或输入模型标识')
  const response=await modelRequest({url:model.chatUrl?.trim()||apiEndpoint(model.baseUrl,'chat/completions'),method:'POST',apiKey:model.apiKey,body:requestBody(model,messages,tools,options),timeoutSeconds:model.timeoutSeconds||120,signal})
  const usage=modelUsage(response.usage,model);if(usage)await options?.onUsage?.(usage)
  const message=response.choices?.[0]?.message
  if(message&&!message.role)message.role='assistant'
  if(!message||message.role!=='assistant')throw new Error(response.error?.message||'模型响应缺少 assistant 消息')
  if(Array.isArray(message.content))message.content=message.content.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n')
  if(message.content==null&&message.tool_calls?.length)message.content=null
  return validateMessages({type:'Messages',version:1,items:[message]}).items[0]
}
export async function callLLMStream(model:ModelConnection,messages:LLMMessage[],signal?:AbortSignal,tools?:ToolDefinition[],onDelta?:(delta:{text?:string;reasoning?:string})=>void|Promise<void>,options?:{toolChoice?:string;onUsage?:(usage:ModelUsage)=>void|Promise<void>}):Promise<LLMMessage> {
 if(!model.enabled||!model.model.trim())throw new Error('模型已停用或尚未配置')
 let content='',done=false,sawMessage=false
 const calls=new Map<number,{id:string;type:'function';function:{name:string;arguments:string}}>()
 await modelStream({url:model.chatUrl?.trim()||apiEndpoint(model.baseUrl,'chat/completions'),method:'POST',apiKey:model.apiKey,body:{...requestBody(model,messages,tools,options),stream:true,stream_options:{include_usage:true}},timeoutSeconds:model.timeoutSeconds||120,signal},async data=>{
  if(data==='[DONE]'){done=true;return}
  if(done)throw new Error('模型完成后仍发送数据')
  const chunk=JSON.parse(data);const usage=modelUsage(chunk.usage,model);if(usage)await options?.onUsage?.(usage);if(chunk.error)throw new Error(chunk.error.message||JSON.stringify(chunk.error))
  const choice=chunk.choices?.find((c:any)=>c.index===0||c.index===undefined),delta=choice?.delta;if(!delta)return;sawMessage=true
  if(typeof delta.content==='string'){content+=delta.content;await onDelta?.({text:delta.content})}
  const reasoning=delta.reasoning_content??delta.reasoning;if(typeof reasoning==='string')await onDelta?.({reasoning})
  for(const part of delta.tool_calls||[]){
   if(!Number.isSafeInteger(part.index)||part.index<0)throw new Error('无效 ToolCalls 流索引')
   const call=calls.get(part.index)||{id:'',type:'function' as const,function:{name:'',arguments:''}}
   if(part.id)call.id+=part.id
   if(part.type&&part.type!=='function')throw new Error('不支持的模型调用类型')
   call.function.name+=part.function?.name||'';call.function.arguments+=part.function?.arguments||'';calls.set(part.index,call)
  }
 })
 if(!sawMessage)throw new Error('模型流缺少 assistant 消息')
 if(!done)throw new Error('模型 SSE 异常结束：缺少完成标记')
 const tool_calls=[...calls.entries()].sort(([a],[b])=>a-b).map(([,call])=>call)
 return validateMessages({type:'Messages',version:1,items:[{role:'assistant',content:content||(!tool_calls.length?'':null),...(tool_calls.length?{tool_calls}:{})}]}).items[0]
}
/** Callable inputs are authoritative in both basic HTTP and SSE requests. */
export function requestBody(model:ModelConnection,messages:LLMMessage[],tools?:ToolDefinition[],options?:{toolChoice?:string;onUsage?:(usage:ModelUsage)=>void|Promise<void>}):Record<string,unknown> {
 if(options?.toolChoice&&!tools?.some(t=>toolName(t)===options.toolChoice))throw new Error('指定的结构化答复工具未接入')
 const body=llmBody(model,messages)
 for(const key of ['tools','tool_choice','parallel_tool_calls','functions','function_call'])delete body[key]
 return {...body,...(tools?.length?{tools:tools.map(modelToolSpec),tool_choice:options?.toolChoice?{type:'function',function:{name:options.toolChoice}}:'auto',parallel_tool_calls:false}:{})}
}
export async function callLLM(model:ModelConnection,messages:LLMMessage[],signal?:AbortSignal):Promise<string>{const message=await callLLMMessage(model,messages,signal);return message.content||''}

export async function callLLMWithTools(model:ModelConnection,messages:LLMMessage[],workspace:Workspace,world?:World,signal?:AbortSignal,request:typeof callLLMMessage=callLLMMessage,selectedIds:string[]=[],context?:ToolCallContext,capabilities?:ToolDefinition[],execute?:(tool:ToolDefinition,parameters:unknown,id:string)=>Promise<unknown>):Promise<{message:LLMMessage;messages:LLMMessage[]}>{
  const tools=capabilities||selectedIds.map(id=>{const tool=registeredTools(workspace).find(t=>t.id===id);if(!tool||!tool.enabled)throw new Error('已接入的 Tool 不存在或已停用: '+id);return tool})
  if(new Set(tools.map(toolName)).size!==tools.length)throw new Error('Tool 调用名称重复')
  const conversation=[...messages],generated:LLMMessage[]=[]
  const seen=new Set<string>()
  for(let round=0;round<16;round++){
    if(signal?.aborted)throw new DOMException('已取消','AbortError')
    const message=await request(model,conversation,signal,tools);conversation.push(message);generated.push(message)
    if(!message.tool_calls?.length||!tools.length)return {message,messages:generated}
    for(const call of message.tool_calls){
      if(seen.has(call.id))throw new Error('模型重复使用 tool_call_id');seen.add(call.id)
      let content:string
      try{const tool=tools.find(t=>toolName(t)===call.function.name);if(!tool)throw new Error('Tool 未接入当前模型: '+call.function.name)
        content=toolResultText(await (execute?execute(tool,JSON.parse(call.function.arguments),call.id):runTool(tool,JSON.parse(call.function.arguments),world,signal,undefined,context)))
      }catch(error){if(signal?.aborted||isAgentLimit(error))throw error;content=JSON.stringify({isError:true,error:error instanceof Error?error.message:String(error)})}
      const result:LLMMessage={role:'tool',content,tool_call_id:call.id};conversation.push(result);generated.push(result)
    }
  }
  throw new Error('Tool 调用超过 16 轮，请检查模型或工具描述')
}
