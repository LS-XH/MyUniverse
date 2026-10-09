import { invoke, isTauri } from '@tauri-apps/api/core'

export interface HttpRequest {url:string;method?:'GET'|'POST';apiKey?:string;body?:unknown;timeoutSeconds?:number;signal?:AbortSignal}
export async function modelRequest<T=any>({url,method='GET',apiKey='',body,timeoutSeconds=60,signal}:HttpRequest):Promise<T> {
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
export async function modelImage(url:string,apiKey='',signal?:AbortSignal):Promise<string> {
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
