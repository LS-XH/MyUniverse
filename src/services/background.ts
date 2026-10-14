import type {BackgroundTasks} from './backgroundTasks'
import {appLog,writeLog} from './runtimeLog'

interface Lane {worker:Worker;pending:Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;start:()=>void;cleanup:()=>void}>}
const lanes=new Map<string,Lane>();let sequence=0
const signalIds=new WeakMap<AbortSignal,number>();let signalSequence=0
export const yieldToUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0))
/** Separate lanes keep previews/storage responsive while user code runs. */
export async function background<K extends keyof BackgroundTasks>(kind:K,input:BackgroundTasks[K]['input'],signal?:AbortSignal):Promise<BackgroundTasks[K]['output']>{
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 if(typeof Worker==='undefined'){await yieldToUI();const {executeBackgroundTask}=await import('./backgroundTasks');try{return await executeBackgroundTask(kind,input)}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))appLog.error(`后台任务 / ${kind}`,error);throw error}}
 const script=kind==='function'||kind==='directFunction'||kind==='jobs'||kind==='job'||kind==='tool'
 const base=kind==='tool'?'tools':script?'functions':kind
 if(script&&signal&&!signalIds.has(signal))signalIds.set(signal,++signalSequence)
 const name=base+(script&&signal?':'+signalIds.get(signal):'')
 let lane=lanes.get(name)
 if(!lane){
  // Bound idle workers; separate run signals prevent cancelling another chat/run.
  for(const [key,old] of lanes){if(lanes.size<8)break;if(!old.pending.size){old.worker.terminate();lanes.delete(key)}}
  lane={worker:new Worker(new URL('./background.worker.ts',import.meta.url),{type:'module'}),pending:new Map()};lanes.set(name,lane)
  const owner=lane
  owner.worker.onmessage=({data})=>{if(data.log){writeLog(data.log.level,data.log.source,data.log.message,data.log.time);return}const p=owner.pending.get(data.id);if(!p)return;if(data.started){p.start();return}owner.pending.delete(data.id);p.cleanup();if(data.error){appLog.error(`后台任务 / ${data.kind||kind}`,data.stack||data.error);p.reject(new Error(data.error))}else p.resolve(data.result)}
  owner.worker.onerror=event=>dispose(new Error(event.message||'后台任务失败'))
  function dispose(error:Error){appLog.error('后台线程',error);owner.worker.terminate();if(lanes.get(name)===owner)lanes.delete(name);for(const p of owner.pending.values()){p.cleanup();p.reject(error)}owner.pending.clear()}
 }
 const owner=lane,id=++sequence
 return new Promise((resolve,reject)=>{
  const stop=(error:Error)=>{if(error.name!=='AbortError')appLog.error(`后台任务 / ${kind}`,error);owner.worker.terminate();if(lanes.get(name)===owner)lanes.delete(name);for(const p of owner.pending.values()){p.cleanup();p.reject(error)}owner.pending.clear()}
  const abort=()=>stop(new DOMException('已取消','AbortError'))
  let timer:ReturnType<typeof setTimeout>|undefined
  owner.pending.set(id,{resolve,reject,start:()=>{if(kind==='function'||kind==='directFunction'||kind==='tool')timer=setTimeout(()=>stop(new Error('脚本执行超过 10 秒，已终止后台任务')),10000)},cleanup:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)}})
  signal?.addEventListener('abort',abort,{once:true})
  try{owner.worker.postMessage({id,kind,input})}catch(error){owner.pending.delete(id);clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(error)}
 })
}
