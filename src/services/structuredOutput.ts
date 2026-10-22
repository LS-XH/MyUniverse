import {ToolDefinition} from '../model/types'
import {ContextMessage} from '../model/workflowValues'
import {validateMemberOutput} from './agentSessions'
export const RESULT_TOOL='agent_return_result'
export function resultTool(schema:Record<string,unknown>):ToolDefinition{return {id:'runtime:structured-result',name:'提交结构化答复',callName:RESULT_TOOL,description:'结束本次调用，使用参数提交符合约定的最终结果。不要把 JSON 写在正文中。',inputSchema:schema,enabled:true,kind:'builtin',url:'',apiKey:'',method:'POST',bodyMode:'raw'}}
/** Terminal tool arguments become the final assistant value; no world Tool is executed. */
export async function structuredResponse(schema:Record<string,unknown>,messages:ContextMessage[],tools:ToolDefinition[],request:(messages:ContextMessage[],tools:ToolDefinition[],forced?:string)=>Promise<ContextMessage>):Promise<ContextMessage>{
 const terminal=resultTool(schema)
 if(tools.some(t=>(t.callName||t.name)===RESULT_TOOL))throw new Error('工具调用名与结构化答复工具冲突')
 const context:ContextMessage[]=[{role:'system',content:'需要工具时正常调用；最终答复必须通过 '+RESULT_TOOL+' 的参数提交，字段内容可以包含引号和换行，不在正文拼接 JSON。'},...messages]
 const first=await request(context,[...tools,terminal])
 const extract=(message:ContextMessage)=>{
  if(message.tool_calls?.length===1&&message.tool_calls[0].function.name===RESULT_TOOL)return validateMemberOutput(JSON.parse(message.tool_calls[0].function.arguments),schema)
  // Retain compatibility with providers returning valid JSON as assistant text.
  if(!message.tool_calls?.length)return validateMemberOutput(message.content,schema)
  throw new Error('最终答复工具必须单独调用')
 }
 if(first.tool_calls?.length&&!first.tool_calls.some(c=>c.function.name===RESULT_TOOL))return first
 try{return {role:'assistant',content:JSON.stringify(extract(first))}}catch{
  // A format repair is an explicit model turn, never a transport retry.
  const repair:ContextMessage[]=[...context,{role:'user',content:'上次未按最终输出契约提交。请将本次答案填入指定工具的参数，不要输出正文。候选答案：'+(first.content||JSON.stringify(first.tool_calls))}]
  const fixed=await request(repair,[terminal],RESULT_TOOL)
  if(fixed.tool_calls?.length!==1||fixed.tool_calls[0].function.name!==RESULT_TOOL)throw new Error('模型未调用指定的结构化答复工具，未发布本次发言')
  return {role:'assistant',content:JSON.stringify(extract(fixed))}
 }
}
