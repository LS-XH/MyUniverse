export type LogLevel='debug'|'info'|'warn'|'error'
export interface LogEntry {id:number;time:number;lastTime:number;level:LogLevel;source:string;message:string;count:number}
const LIMIT=2000,MAX_TEXT=12000
let entries:LogEntry[]=[],sequence=0,notification:ReturnType<typeof setTimeout>|undefined
const listeners=new Set<()=>void>()

/** Bounded formatting never invokes getters or traverses an entire world snapshot. */
export function logText(value:unknown):string {
 try{if(value instanceof Error)return (value.stack||`${value.name}: ${value.message}`).slice(0,MAX_TEXT)}catch{return '[无法格式化日志内容]'}
 if(typeof value==='string')return value.slice(0,MAX_TEXT)
 const seen=new WeakSet<object>();let budget=160
 const format=(v:unknown,depth:number):unknown=>{
  if(typeof v==='bigint'||typeof v==='symbol'||typeof v==='function')return String(v)
  if(!v||typeof v!=='object')return typeof v==='string'?v.slice(0,2000):v
  if(seen.has(v))return '[Circular]';seen.add(v)
  if(depth>=4||budget--<=0)return '[…]'
  if(v instanceof Error)return v.message
  if(Array.isArray(v))return [...v.slice(0,30).map(item=>format(item,depth+1)),...(v.length>30?[`… ${v.length-30} 项`]:[])]
  return Object.fromEntries(Object.keys(v).slice(0,30).map(key=>{const descriptor=Object.getOwnPropertyDescriptor(v,key);return [key,descriptor&&'value'in descriptor?format(descriptor.value,depth+1):'[Getter]']}))
 }
 try{return (JSON.stringify(format(value,0))??String(value)).slice(0,MAX_TEXT)}catch{return '[无法格式化日志内容]'}
}
function notify(){if(notification!==undefined)return;notification=setTimeout(()=>{notification=undefined;for(const listener of listeners){try{listener()}catch{/* Log observers must not interrupt application work. */}}},50)}
export function writeLog(level:LogLevel,source:string,value:unknown,time=Date.now()):void {
 if(!['debug','info','warn','error'].includes(level))level='info'
 try{source=String(source).slice(0,160)}catch{source='日志'}if(!Number.isFinite(time))time=Date.now()
 const message=logText(value)
 if(typeof document==='undefined'&&typeof self!=='undefined'&&typeof self.postMessage==='function'){self.postMessage({log:{level,source,message,time}});return}
 const last=entries.at(-1)
 const entry:LogEntry=last&&last.level===level&&last.source===source&&last.message===message&&time-last.lastTime<2000?{...last,lastTime:time,count:last.count+1}:{id:++sequence,time,lastTime:time,level,source,message,count:1}
 entries=last&&entry.id===last.id?[...entries.slice(0,-1),entry]:[...entries.slice(-(LIMIT-1)),entry]
 notify()
}
export const runtimeLog={getSnapshot:()=>entries,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},clear:()=>{entries=[];notify()},limit:LIMIT}
export const appLog={info:(source:string,value:unknown)=>writeLog('info',source,value),warn:(source:string,value:unknown)=>writeLog('warn',source,value),error:(source:string,value:unknown)=>writeLog('error',source,value)}
export async function logOperation<T>(source:string,label:string,run:()=>Promise<T>):Promise<T>{
 const start=Date.now();appLog.info(source,`${label}：开始`)
 try{const result=await run();appLog.info(source,`${label}：完成（${Date.now()-start}ms）`);return result}
 catch(error){if(error instanceof Error&&error.name==='AbortError')appLog.info(source,`${label}：已取消`);else appLog.error(source,`${label}：失败\n${logText(error)}`);throw error}
}

let users=0,stop:undefined|(()=>void),started=false
/** Covers uncaught errors, console output and caught errors already presented by existing pages. */
export function installRuntimeLogging():()=>void {
 if(typeof window==='undefined')return()=>{}
 if(users++===0){
  const consoleMethods=['debug','info','log','warn','error'] as const,originals=new Map<string,typeof console.log>()
  for(const method of consoleMethods){const original=console[method];originals.set(method,original);console[method]=(...args:unknown[])=>{writeLog(method==='log'?'info':method,'Console',args.map(logText).join(' '));original.apply(console,args)}}
  const onError=(event:ErrorEvent)=>{if(event.error||event.message)writeLog('error','程序',event.error||`${event.message}${event.filename?` (${event.filename}:${event.lineno})`:''}`);else if(event.target instanceof Element)writeLog('error','资源加载',event.target.getAttribute('src')||event.target.getAttribute('href')||event.target.tagName)}
  const onRejection=(event:PromiseRejectionEvent)=>writeLog('error','异步任务',event.reason)
  window.addEventListener('error',onError,true);window.addEventListener('unhandledrejection',onRejection)
  const selector='[role="alert"],.function-error,.document-error,.markdown-edit-error,.error-message,.error-text,.flow-error,.editor-error'
  const seen=new WeakMap<Element,string>(),pending=new Set<Element>();let alertTimer:ReturnType<typeof setTimeout>|undefined
  const collect=(element:Element)=>{if(element.closest('.runtime-log-panel'))return;const alert=element.closest(selector);if(alert)pending.add(alert);element.querySelectorAll(selector).forEach(e=>pending.add(e))}
  const report=()=>{alertTimer=undefined;for(const el of pending){if(!el.isConnected||el.closest('.runtime-log-panel'))continue;const text=el.textContent?.trim();if(text&&seen.get(el)!==text){seen.set(el,text);writeLog('error','界面提示',text)}}pending.clear()}
  const observer=new MutationObserver(records=>{for(const record of records){const target=record.target instanceof Element?record.target:record.target.parentElement;if(target?.closest(selector))collect(target);if(record.type==='childList')for(const node of record.addedNodes)if(node instanceof Element)collect(node)}if(pending.size&&alertTimer===undefined)alertTimer=setTimeout(report,50)})
  collect(document.body);report();observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['role']})
  if(!started){started=true;writeLog('info','程序','MyUniverse 已启动，日志记录已启用')}
  stop=()=>{for(const method of consoleMethods)console[method]=originals.get(method)!;window.removeEventListener('error',onError,true);window.removeEventListener('unhandledrejection',onRejection);observer.disconnect();clearTimeout(alertTimer)}
 }
 return()=>{if(users>0&&--users===0){stop?.();stop=undefined}}
}

/** A noisy user script cannot flood the main thread with unbounded console messages. */
export function installWorkerConsoleLogging(){
 let windowStart=Date.now(),sent=0,suppressed=0
 for(const method of ['debug','info','log','warn','error'] as const){
  const original=console[method]
  console[method]=(...args:unknown[])=>{
   const now=Date.now()
   if(now-windowStart>=250){if(suppressed)writeLog('warn','脚本 Console',`已合并 ${suppressed} 条高频输出`);windowStart=now;sent=0;suppressed=0}
   if(sent++<25)writeLog(method==='log'?'info':method,'脚本 Console',args.map(logText).join(' '),now);else suppressed++
   // Suppressed output must also stay out of the developer console's hot loop.
   if(sent<=25)original.apply(console,args)
  }
 }
 return()=>{if(suppressed){writeLog('warn','脚本 Console',`已合并 ${suppressed} 条高频输出`);suppressed=0}}
}
