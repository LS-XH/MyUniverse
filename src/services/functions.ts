import { fieldPath, FunctionAppendScope } from '../model/functionAppend'
import { beginScript, executeHostScript } from './scriptHost'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { functionFile, functionInput, functionReferenceIdentity, functionRevision } from '../model/functions'
import { compileFlow } from '../model/flow'
import { rawWorldRevision, worldCatalog } from '../model/worldApi'
import { sameData } from '../model/merge'
import { Entity, FieldSchema, FieldValue, FunctionContext, FunctionResult, FunctionScript, TypedValue, Workspace, World } from '../model/types'
import { createFunctionApi, functionContext, typedValueMarkdown, validateTypedValue } from '../model/functionValues'

export async function runFunction(fn:FunctionScript,input:string,world?:World,context?:FunctionContext):Promise<string> {
  return (await runFunctionValue(fn,input,world,context)).value
}
export async function runFunctionValue(fn:FunctionScript,input:string,world?:World,context?:FunctionContext,signal?:AbortSignal,job?:FunctionJob):Promise<{value:string;typedValue?:TypedValue}> {
  if(signal?.aborted)throw new DOMException('已取消','AbortError')
  const typed=fn.apiVersion===2,contract=fn.returnType||{type:'Text' as const}
  if(typed&&!context)throw new Error('请选择调用实例和绑定属性，提供 self / input 对象。')
  if(typed&&context)context={...context,input:validateTypedValue(context.input,undefined,world,'input')}
  let scope:FunctionAppendScope|undefined
  if(context?.bindingPath?.length)scope={...context.self,path:context.bindingPath,functionId:fn.id,name:fn.name}
  else if(job&&world){const doc=world.documents.find(d=>d.id===job.docId);for(const entity of doc?.entities||[]){const path=fieldPath(entity.fields,job.fieldId);if(path){scope={classId:doc!.id,entityId:entity.id,path,functionId:fn.id,name:fn.name};break}};if(!scope)throw new Error('函数绑定属性已删除')}
  const voidMode=!!scope||fn.executionMode==='void'
  if(voidMode&&!scope)throw new Error('void 函数需要具体的绑定属性，不能无作用域写入世界')
  const code=fn.language==='flow'?compileFlow(fn.flow!,typed,voidMode):fn.code
  const complete=async(session:ReturnType<typeof beginScript>,output:{value:string;typedValue?:TypedValue})=>{
    const source=functionRevision(fn,session.read())
    await session.commit(job?workspace=>applyFunctionResult(workspace,{...job,source},{functionId:fn.id,name:fn.name,fileName:`../../functions/${functionFile(fn)}`,input:job.input,source,...output,...(job.contextKey?{contextKey:job.contextKey}:{})}):undefined)
    return output
  }
  if(fn.language==='py'){
    if(!isTauri())throw new Error('Python 函数需要桌面应用和已安装的 Python 3。')
    const session=beginScript(world,fn.id,false,scope)
    try{
      const response=JSON.parse(await invoke<string>('run_function',{language:'py',code,input,world:worldCatalog(session.read(),fn.id),api:null,context:typed?context:null,runtimeApi:null,contract:voidMode?{type:'Void'}:typed?contract:null,bridge:true}))
      if(signal?.aborted)throw new DOMException('已取消','AbortError')
      for(const mutation of response.mutations||[]){
        if(!Array.isArray(mutation.path)||!mutation.path.length||mutation.path.some((key:unknown)=>typeof key!=='string'))throw new Error('Python 对象操作路径无效')
        let object:any=session.world.get_class(mutation.path[0]);if(mutation.path.length>1)object=object.get_instance(mutation.path[1]);for(const key of mutation.path.slice(2))object=object.get_member(key)
        if(mutation.operation==='delete'&&mutation.path.length<=2)object.delete()
        else if(mutation.operation==='set_value'&&mutation.path.length>=3)object.set_value(mutation.value)
        else if(mutation.operation==='set_markdown'&&mutation.path.length===1)object.set_markdown(mutation.value)
        else if(mutation.operation==='add'&&mutation.path.length>=3){if(typeof mutation.selector==='string')object.add(mutation.selector,mutation.value,mutation.key??undefined);else object.add(mutation.value,mutation.key??undefined)}
        else if(mutation.operation==='append_repeatable'&&mutation.path.length>=3)object.append_repeatable(mutation.selector,mutation.value,mutation.key??undefined)
        else if(mutation.operation==='append_self'&&mutation.path.length>=3)object.append_self(mutation.value,mutation.key??undefined)
        else throw new Error('Python 对象操作无效')
      }
      if(voidMode)return await complete(session,{value:''})
      if(!typed&&typeof response.value!=='string')throw new Error('函数必须返回字符串')
      const typedValue=typed?validateTypedValue(response.value,contract,session.read()):undefined
      const output={value:typedValue?typedValueMarkdown(typedValue,session.read()):response.value,...(typedValue?{typedValue}:{})}
      if(signal?.aborted)throw new DOMException('已取消','AbortError')
    return await complete(session,output)
    }catch(error){session.close();throw error}
  }
  const session=beginScript(world,fn.id,false,scope)
  try{
    const runtime=typed?createFunctionApi(session.world,context!,contract):undefined
    const result=await executeHostScript(code,'transform',session,runtime?.values,runtime?[runtime.self,runtime.input]:[input,session.world],signal)
    if(voidMode)return await complete(session,{value:''})
    if(!typed&&typeof result!=='string')throw new Error('函数必须返回字符串')
    const size=JSON.stringify(result);if(size===undefined||new TextEncoder().encode(size).length>1000000)throw new Error('返回值无效或超过 1 MB')
    const typedValue=typed?validateTypedValue(result,contract,session.read()):undefined
    const output={value:typedValue?typedValueMarkdown(typedValue,session.read()):result as string,...(typedValue?{typedValue}:{})}
    if(signal?.aborted)throw new DOMException('已取消','AbortError')
    return await complete(session,output)
  }catch(error){session.close();throw error}

}
export interface FunctionJob {worldId:string;docId:string;fieldId:string;schemaId:string;fn:FunctionScript;input:string;source:string;error?:string;context?:FunctionContext;contextKey?:string}
export function functionJobs(workspace:Workspace,force=false):FunctionJob[] {
  const jobs:FunctionJob[]=[]
  for(const world of workspace.worlds){
    // A scan is a fixed snapshot: share its world hash and dependency index,
    // without caching mutable worlds across scans or missing external edits.
    let revision:string|undefined
    const worldRevision=()=>revision??=rawWorldRevision(world)
    const revisions=new Map<string,string>()
    const dependencies=new Map<string,string[]>()
    const gather=(fields:FieldValue[])=>fields.forEach(f=>{const target=functionReferenceIdentity(f.value).split('/')[1];dependencies.set(f.id,target?[target]:[]);gather(f.children)})
    for(const d of world.documents)for(const e of d.entities)gather(e.fields)
    const cyclic=(id:string,path=new Set<string>()):boolean=>{if(path.has(id))return true;const next=new Set(path).add(id);return (dependencies.get(id)||[]).some(child=>cyclic(child,next))}
    for(const doc of world.documents){
    const walk=(fields:FieldValue[],schemas:FieldSchema[],entity:Entity)=>fields.forEach(field=>{
      const schema=schemas.find(s=>s.id===field.schemaId);if(!schema||field.functionOrigin)return
      if(!schema.functionIds?.length){walk(field.children,schema.children||[],entity);return}
      const cycle=cyclic(field.id),input=cycle?field.value:functionInput(field,schema,world)
      for(const id of schema.functionIds||[]){
        const fn=workspace.functions?.find(fn=>fn.id===id),prior=field.functionRuns?.find(r=>r.functionId===id)
        if(fn&&!revisions.has(id))revisions.set(id,functionRevision(fn,world,worldRevision))
        const source=fn?revisions.get(id)!:''
        let context:FunctionContext|undefined,error=cycle?'函数返回值引用形成循环，请选择原值或其他属性。':undefined
        if(fn?.apiVersion===2&&!cycle){try{context=functionContext(world,doc,entity,field,schema)}catch(e){error=String(e)}}
        const contextKey=fn?.apiVersion===2?JSON.stringify(context||{self:entity.id,error}):undefined
        const priorSource=fn?.executionMode==='void'?prior?.source?.replace(/\nworld:[^\n]*$/,''):prior?.source
        if(fn&&(force||!prior||prior.input!==input||priorSource!==source||prior.contextKey!==contextKey))jobs.push({worldId:world.id,docId:doc.id,fieldId:field.id,schemaId:schema.id,fn,input,source,context,contextKey,...(error?{error}:{})})
      }
      walk(field.children,schema.children||[],entity)
    });for(const entity of doc.entities)walk(entity.fields,doc.schema,entity)
    }
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
    if(field.id===job.fieldId&&schema.functionIds?.includes(fn.id)&&(job.error?field.value:functionInput(field,schema,world))===job.input&&!sameData(field.functionRuns?.find(r=>r.functionId===fn.id),{functionId:result.functionId,name:result.name,input:result.input,source:job.source,contextKey:job.contextKey,...(result.error?{error:result.error}:{})})){changed=true;next={...field,functionRuns:[...(field.functionRuns||[]).filter(r=>r.functionId!==fn.id),{functionId:result.functionId,name:result.name,input:result.input,source:job.source,contextKey:job.contextKey,...(result.error?{error:result.error}:{})}]}}
    if(next!==field)delete next.functionResults
    const children=walk(next.children,schema.children||[])
    return children.some((c,i)=>c!==next.children[i])?{...next,children}:next
  })
  const worlds=workspace.worlds.map(w=>w.id!==job.worldId?w:{...w,documents:w.documents.map(d=>d.id!==job.docId?d:{...d,entities:d.entities.map(e=>({...e,fields:walk(e.fields,d.schema)}))})})
  return changed?{...workspace,worlds}:workspace
}
