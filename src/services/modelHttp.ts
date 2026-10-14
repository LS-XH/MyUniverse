import {logOperation} from './runtimeLog'
import { Channel, invoke, isTauri } from '@tauri-apps/api/core'
import {SSEDecoder} from './sse'

export interface HttpRequest {url:string;method?:'GET'|'POST';apiKey?:string;body?:unknown;timeoutSeconds?:number;signal?:AbortSignal}
const requestLabel=(url:string)=>{try{const parsed=new URL(url);return parsed.origin+parsed.pathname}catch{return '无效接口地址'}}
export function modelStream(request:HttpRequest,onData:(data:string)=>void|Promise<void>):Promise<void>{return logOperation('网络 / SSE',requestLabel(request.url),()=>executeModelStream(request,onData))}
export function modelRequest<T=any>(request:HttpRequest):Promise<T>{return logOperation('网络 / HTTP',`${request.method||'GET'} ${requestLabel(request.url)}`,()=>executeModelRequest<T>(request))}
export function modelImage(url:string,apiKey='',signal?:AbortSignal):Promise<string>{return logOperation('网络 / 图片',requestLabel(url),()=>executeModelImage(url,apiKey,signal))}
async function executeModelStream({url,apiKey='',body,timeoutSeconds=120,signal}:HttpRequest,onData:(data:string)=>void|Promise<void>):Promise<void> {
 const parsed=new URL(url)
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('接口需要 http(s) URL，不允许在 URL 中包含密钥')
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 const decoder=new SSEDecoder(),dispatch=async(bytes:Uint8Array)=>{for(const data of decoder.push(bytes))await onData(data)}
 if(isTauri()){
  const requestId=crypto.randomUUID(),channel=new Channel<{kind:'ready'|'chunk'|'complete'|'error';data?:number[];error?:string}>()
  let queue=Promise.resolve(),failure:unknown,completed=false,finish!:()=>void
  const terminal=new Promise<void>(resolve=>{finish=resolve})
  channel.onmessage=event=>{queue=queue.then(async()=>{if(signal?.aborted){void invoke('cancel_model_stream',{requestId});return}if(event.kind==='chunk')await dispatch(new Uint8Array(event.data||[]));else if(event.kind==='complete')completed=true;else if(event.kind==='error')throw new Error(event.error||'SSE 连接失败')}).catch(error=>{failure??=error;void invoke('cancel_model_stream',{requestId})}).finally(()=>{if(event.kind==='complete'||event.kind==='error'||failure)finish()})}
  const abort=()=>{void invoke('cancel_model_stream',{requestId})}
  signal?.addEventListener('abort',abort,{once:true})
  try{let transportError:unknown;try{await invoke('model_stream',{url,apiKey,body,timeoutSeconds,requestId,channel})}catch(error){transportError=error}if(!transportError)await terminal;await queue;if(signal?.aborted)throw new DOMException('已取消','AbortError');if(failure)throw failure;if(transportError)throw transportError;if(!completed)throw new Error('SSE 连接异常结束')}
  finally{signal?.removeEventListener('abort',abort);channel.onmessage=()=>{}}
 }else{
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,timeoutSeconds*1000)
  signal?.addEventListener('abort',abort,{once:true})
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream',...(apiKey?{Authorization:`Bearer ${apiKey}`}:{})},body:JSON.stringify(body),signal:controller.signal,redirect:'error'})
   if(!response.ok)throw new Error(`HTTP ${response.status}\n${(await response.text()).slice(0,4096)}`)
   if(!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')||!response.body)throw new Error('服务未返回 SSE 流')
   const reader=response.body.getReader();let size=0
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32000000)throw new Error('模型响应超过大小限制');await dispatch(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  }catch(error){if(signal?.aborted)throw new DOMException('已取消','AbortError');if(controller.signal.aborted)throw new Error('模型 SSE 请求超时');throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
 for(const data of decoder.finish())await onData(data)
}
async function executeModelRequest<T=any>({url,method='GET',apiKey='',body,timeoutSeconds=60,signal}:HttpRequest):Promise<T> {
  const parsed=new URL(url)
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('接口需要 http(s) URL，不允许在 URL 中包含密钥')
  if(signal?.aborted)throw new DOMException('已取消','AbortError')
  if(isTauri()){
    const job=invoke<{status:number;text:string}>('model_http',{url,method,apiKey,body:body??null,timeoutSeconds})
    const response=await new Promise<{status:number;text:string}>((resolve,reject)=>{
      const abort=()=>reject(new DOMException('已取消','AbortError'))
      signal?.addEventListener('abort',abort,{once:true})
      job.then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort))
    })
    if(response.status<200||response.status>=300)throw new Error(`HTTP ${response.status}\n${response.text}`)
    try{return JSON.parse(response.text)}catch{throw new Error('接口返回了非 JSON 内容')}
  }
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,timeoutSeconds*1000)
  signal?.addEventListener('abort',abort,{once:true})
  try{
    const response=await fetch(url,{method,headers:{...(apiKey?{Authorization:`Bearer ${apiKey}`}:{ }),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal})
    const text=await response.text()
    if(!response.ok)throw new Error(`HTTP ${response.status}\n${text}`)
    try{return JSON.parse(text)}catch{throw new Error('接口返回了非 JSON 内容')}
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export function apiEndpoint(base:string,path:string):string {
  const url=new URL(base.trim())
  if(!['http:','https:'].includes(url.protocol))throw new Error('请输入 http(s) 接口地址')
  url.pathname=url.pathname.replace(/\/(chat\/completions|models)\/?$/,'').replace(/\/$/,'')+'/'+path.replace(/^\//,'')
  url.hash='';url.search=''
  return url.toString()
}
async function executeModelImage(url:string,apiKey='',signal?:AbortSignal):Promise<string> {
  if(isTauri()){
    const result=await invoke<{status:number;text:string}>('model_http',{url,method:'GET',apiKey,body:null,timeoutSeconds:30,asImage:true})
    if(signal?.aborted)throw new DOMException('已取消','AbortError')
    if(result.status<200||result.status>=300)throw new Error(`HTTP ${result.status}\n${result.text}`)
    return result.text
  }
  const response=await fetch(url,{headers:apiKey?{Authorization:`Bearer ${apiKey}`}:{},signal})
  if(!response.ok)throw new Error(`图片获取失败 HTTP ${response.status}`)
  const blob=await response.blob()
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
}
