import { invoke, isTauri } from '@tauri-apps/api/core'
import { functionFile, functionInput, functionReferenceIdentity, functionRevision } from '../model/functions'
import { compileFlow } from '../model/flow'
import { createWorldApi, worldCatalog } from '../model/worldApi'
import { Entity, FieldSchema, FieldValue, FunctionContext, FunctionResult, FunctionScript, TypedValue, Workspace, World } from '../model/types'
import { createFunctionApi, functionContext, typedValueMarkdown, validateTypedValue } from '../model/functionValues'

export async function runFunction(fn:FunctionScript,input:string,world?:World,context?:FunctionContext):Promise<string> {
  return (await runFunctionValue(fn,input,world,context)).value
}
export async function runFunctionValue(fn:FunctionScript,input:string,world?:World,context?:FunctionContext):Promise<{value:string;typedValue?:TypedValue}> {
  const typed=fn.apiVersion===2,contract=fn.returnType||{type:'Text' as const}
  if(typed&&!context)throw new Error('请选择调用实例和绑定属性，提供 self / input 对象。')
  if(typed&&context)context={...context,input:validateTypedValue(context.input,undefined,world,'input')}
  const code=fn.language==='flow'?compileFlow(fn.flow!,typed):fn.code,catalog=worldCatalog(world,fn.id),api=createWorldApi.toString(),runtimeApi=createFunctionApi.toString()
  if(isTauri()){
    const result=await invoke<string>('run_function',{language:fn.language==='flow'?'js':fn.language,code,input,world:catalog,api,context:typed?context:null,runtimeApi:typed?runtimeApi:null,contract:typed?contract:null})
    if(!typed)return {value:result}
    const typedValue=validateTypedValue(JSON.parse(result),contract,world)
    return {value:typedValueMarkdown(typedValue,world),typedValue}
  }
  if(fn.language==='py')throw new Error('Python 函数需要桌面应用和已安装的 Python 3。')
  const workerSource=`self.onmessage=async e=>{try{const {code,input,catalog,api,context,runtimeApi,contract}=e.data;const world=new Function('catalog','return ('+api+')(catalog)')(catalog);const runtime=context?new Function('world','context','contract','return ('+runtimeApi+')(world,context,contract)')(world,context,contract):null;const transform=new Function('world','values',code+'\\n;return typeof transform === "function" ? transform : null;')(world,runtime&&runtime.values);if(!transform)throw new Error('需要定义 transform');const value=runtime?await transform(runtime.self,runtime.input):await transform(input,world);if(runtime?(!value||typeof value!=='object'):typeof value!=='string')throw new Error(runtime?'函数必须返回带 type 的值对象':'函数必须返回字符串');const serialized=JSON.stringify(value);if(new TextEncoder().encode(serialized).length>1000000)throw new Error('返回值过大');self.postMessage({value:JSON.parse(serialized)})}catch(error){self.postMessage({error:error&&error.stack?String(error.stack):String(error)})}}`
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}))
  return new Promise((resolve,reject)=>{
    const worker=new Worker(url),finish=()=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url)}
    const timer=setTimeout(()=>{finish();reject(new Error('函数执行超过 5 秒，已停止。'))},5000)
    worker.onmessage=e=>{finish();if(e.data.error){reject(new Error(e.data.error));return}try{if(typed){const typedValue=validateTypedValue(e.data.value,contract,world);resolve({value:typedValueMarkdown(typedValue,world),typedValue})}else resolve({value:e.data.value})}catch(error){reject(error)}}
    worker.onerror=e=>{finish();reject(new Error(e.message))}
    worker.postMessage({code,input,catalog,api,context:typed?context:null,runtimeApi,contract})
  })
}
export interface FunctionJob {worldId:string;docId:string;fieldId:string;schemaId:string;fn:FunctionScript;input:string;source:string;error?:string;context?:FunctionContext;contextKey?:string}
export function functionJobs(workspace:Workspace):FunctionJob[] {
  const jobs:FunctionJob[]=[]
  for(const world of workspace.worlds)for(const doc of world.documents){
    const dependencies=new Map<string,string[]>()
    const gather=(fields:FieldValue[])=>fields.forEach(f=>{const target=functionReferenceIdentity(f.value).split('/')[1];dependencies.set(f.id,target?[target]:[]);gather(f.children)})
    for(const d of world.documents)for(const e of d.entities)gather(e.fields)
    const cyclic=(id:string,path=new Set<string>()):boolean=>{if(path.has(id))return true;const next=new Set(path).add(id);return (dependencies.get(id)||[]).some(child=>cyclic(child,next))}
    const walk=(fields:FieldValue[],schemas:FieldSchema[],entity:Entity)=>fields.forEach(field=>{
      const schema=schemas.find(s=>s.id===field.schemaId);if(!schema)return
      const cycle=cyclic(field.id),input=cycle?field.value:functionInput(field,schema,world)
      for(const id of schema.functionIds||[]){
        const fn=workspace.functions?.find(fn=>fn.id===id),prior=field.functionResults?.find(r=>r.functionId===id),source=fn?functionRevision(fn,world):''
        let context:FunctionContext|undefined,error=cycle?'函数返回值引用形成循环，请选择原值或其他属性。':undefined
        if(fn?.apiVersion===2&&!cycle){try{context=functionContext(world,doc,entity,field,schema)}catch(e){error=String(e)}}
        const contextKey=fn?.apiVersion===2?JSON.stringify(context||{self:entity.id,error}):undefined
        if(fn&&(!prior||prior.input!==input||prior.source!==source||prior.contextKey!==contextKey||prior.name!==fn.name||prior.fileName!==`../../functions/${functionFile(fn)}`))jobs.push({worldId:world.id,docId:doc.id,fieldId:field.id,schemaId:schema.id,fn,input,source,context,contextKey,...(error?{error}:{})})
      }
      walk(field.children,schema.children||[],entity)
    });for(const entity of doc.entities)walk(entity.fields,doc.schema,entity)
  }
  return jobs
}
export function applyFunctionResult(workspace:Workspace,job:FunctionJob,result:FunctionResult):Workspace {
  const fn=workspace.functions?.find(fn=>fn.id===job.fn.id)
  if(!fn||fn.name!==job.fn.name||fn.language!==job.fn.language)return workspace
  let changed=false
  const world=workspace.worlds.find(w=>w.id===job.worldId)
  if(functionRevision(fn,world)!==job.source)return workspace
  const walk=(fields:FieldValue[],schemas:FieldSchema[]):FieldValue[]=>fields.map(field=>{
    const schema=schemas.find(s=>s.id===field.schemaId);if(!schema)return field
    let next=field
    if(field.id===job.fieldId&&schema.functionIds?.includes(fn.id)&&(job.error?field.value:functionInput(field,schema,world))===job.input){changed=true;next={...field,functionResults:[...(field.functionResults||[]).filter(r=>r.functionId!==fn.id),result]}}
    const children=walk(next.children,schema.children||[])
    return children.some((c,i)=>c!==next.children[i])?{...next,children}:next
  })
  const worlds=workspace.worlds.map(w=>w.id!==job.worldId?w:{...w,documents:w.documents.map(d=>d.id!==job.docId?d:{...d,entities:d.entities.map(e=>({...e,fields:walk(e.fields,d.schema)}))})})
  return changed?{...workspace,worlds}:workspace
}
