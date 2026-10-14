import type {Workspace,Entity} from '../model/types'
import {background,yieldToUI} from './background'
import {runFunctionValue,applyFunctionResult} from './functions'
import {mergeThreeWay,retainReferences} from '../model/merge'
import {functionFile,functionRevision} from '../model/functions'
import {appLog} from './runtimeLog'

/** Replan only the target instance, execute off-thread, and commit only that instance. */
export async function recomputeFunctions(get:()=>Workspace,update:(change:(state:Workspace)=>Workspace)=>void,scope:{worldId:string;docId?:string},onProgress:(done:number,total:number)=>void,signal?:AbortSignal){
 const initial=await background('jobs',{workspace:get(),scope},signal)
 let done=0
 for(const identity of initial){
  if(signal?.aborted)throw new DOMException('已取消','AbortError')
  const state=get(),world=state.worlds.find(w=>w.id===scope.worldId);if(!world)break
  const entityId=identity.entityId||identity.context?.self.entityId||world.documents.find(d=>d.id===identity.docId)?.entities.find(e=>contains(e,identity.fieldId))?.id
  const fn=state.functions?.find(f=>f.id===identity.fn.id);if(!fn){onProgress(++done,initial.length);continue}
  let job={...identity,fn}
  const before=world.documents.find(d=>d.id===job.docId)?.entities.find(e=>e.id===entityId)
  if(!before)continue
  let error:string|undefined,output:Awaited<ReturnType<typeof runFunctionValue>>={value:''}
  try{
   if(job.fn.language==='py'){
    const fresh=await background('job',{workspace:state,identity:job},signal);if(!fresh){onProgress(++done,initial.length);continue};job=fresh
    if(job.error)throw new Error(job.error)
    output=await runFunctionValue(job.fn,job.input,world,job.context,signal,job)
   }
   else{
    const computed=await background('function',{world,fn:job.fn,job},signal);output=computed.output
    if(!computed.job){onProgress(++done,initial.length);continue};job=computed.job
    if(job.error)throw new Error(job.error)
    const entity=computed.entity;if(!entity)throw new Error('函数没有提交目标实例')
    update(current=>{
     if(!current.functions?.some(f=>f.id===job.fn.id&&functionRevision(f)===functionRevision(job.fn)))throw new Error('计算期间函数已改变，未提交旧结果')
     return {...current,worlds:current.worlds.map(w=>w.id!==world.id?w:{...w,documents:w.documents.map(d=>d.id!==job.docId?d:{...d,entities:d.entities.map(e=>{
      if(e.id!==before.id)return e
      const merged=mergeThreeWay(before,e,entity);if(merged.conflicts.length)throw new Error('计算期间目标成员被修改，未覆盖当前编辑');return retainReferences(e,merged.value)
     })})})}
    })
   }
  }catch(failure){if(signal?.aborted)throw failure;appLog.error(`Function / ${job.fn.name}`,failure);error=String(failure)}
  update(current=>applyFunctionResult(current,job,{functionId:job.fn.id,name:job.fn.name,fileName:`../../functions/${functionFile(job.fn)}`,input:job.input,...output,source:job.source,...(job.contextKey?{contextKey:job.contextKey}:{}),...(error?{error}:{})}))
  onProgress(++done,initial.length);await yieldToUI()
 }
}
function contains(entity:Entity,id:string):boolean {const walk=(fields:Entity['fields']):boolean=>fields.some(f=>f.id===id||walk(f.children));return walk(entity.fields)}
