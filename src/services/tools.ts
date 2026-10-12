import {canonicalTool} from '../model/builtinTools'
import {runBuiltinTool} from './builtinTools'
import {ToolCallContext} from './instanceProposals'
import Ajv2020 from 'ajv/dist/2020'
import { ToolDefinition, World } from '../model/types'
import { modelRequest } from './modelHttp'
import { beginScript, executeHostScript } from './scriptHost'
const ajv=new Ajv2020({allErrors:true,strict:false})
const schemas=new Map<string,ReturnType<typeof ajv.compile>>()
export const toolName=(tool:ToolDefinition)=>tool.callName||`tool_${tool.id.replace(/[^a-zA-Z0-9_]/g,'_')}`
export function toolSpec(tool:ToolDefinition){
  const name=toolName(tool);if(!/^[a-zA-Z0-9_-]{1,64}$/.test(name))throw new Error('Tool 调用名称需要 1–64 位字母、数字、下划线或短横线')
  const inputSchema=tool.inputSchema||{type:'object',properties:{},additionalProperties:true}
  if(inputSchema.type!=='object')throw new Error('Tool inputSchema 的顶层必须为 object')
  const key=JSON.stringify(inputSchema);if(!schemas.has(key)){if(schemas.size>=64)schemas.delete(schemas.keys().next().value!);schemas.set(key,ajv.compile(inputSchema))}
  return {name,description:tool.description||tool.name,inputSchema,...(tool.annotations?{annotations:tool.annotations}:{})}
}
export function toolParameters(tool:ToolDefinition,parameters:unknown){
  if(!tool.inputSchema&&tool.kind!=='js')return // Preserve existing HTTP workflow inputs.
  const spec=toolSpec(tool),validate=schemas.get(JSON.stringify(spec.inputSchema))!
  if(!validate(parameters))throw new Error('Tool 参数不符合 inputSchema: '+ajv.errorsText(validate.errors))
}
export function modelToolSpec(tool:ToolDefinition){
  const spec=toolSpec(tool)
  return {type:'function',function:{name:spec.name,description:spec.description+(spec.annotations?'\nMCP annotations: '+JSON.stringify(spec.annotations):''),parameters:spec.inputSchema}}
}
export async function runTool(tool:ToolDefinition,parameters:unknown,world?:World,signal?:AbortSignal,http:typeof modelRequest=modelRequest,context?:ToolCallContext):Promise<unknown>{
  const canonical=canonicalTool(tool);if(!canonical)throw new Error('官方 Tool 不存在');tool=canonical
  if(!tool.enabled)throw new Error('Tool 已停用')
  if(signal?.aborted)throw new DOMException('已取消','AbortError')
  toolParameters(tool,parameters)
  if(tool.kind==='builtin')return runBuiltinTool(tool,parameters as Record<string,string>,world,context)
  if(tool.kind!=='js'){
    if(!tool.url)throw new Error('Tool URL 为空')
    return http({url:tool.url,method:tool.method,apiKey:tool.apiKey,body:tool.method==='GET'?undefined:tool.bodyMode==='raw'?parameters:{input:parameters},signal})
  }
  const session=beginScript(world,undefined,tool.annotations?.readOnlyHint===true)
  try{const value=await executeHostScript(tool.code||'','execute',session,undefined,[parameters,session.app],signal)
    if(signal?.aborted)throw new DOMException('已取消','AbortError')
    // Validate transport before committing writes, without imposing Function's type contract.
    toolResultText(value);await session.commit();return value
  }catch(error){session.close();throw error}
}
export function toolResultText(value:unknown):string{
  if(typeof value==='string')return value
  const result=JSON.stringify(value);return result===undefined?'null':result
}
export function mcpToolResult(value:unknown){return {content:[{type:'text' as const,text:toolResultText(value)}],...(value&&typeof value==='object'&&!Array.isArray(value)?{structuredContent:value}:{})}}
