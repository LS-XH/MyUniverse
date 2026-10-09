import{invoke,isTauri}from'@tauri-apps/api/core'
import{listen}from'@tauri-apps/api/event'
import{apiEndpoint}from'./modelHttp'
export async function watchComfyEvents(baseUrl:string,clientId:string,apiKey:string,onMessage:(message:any)=>void,onUnavailable:()=>void,signal?:AbortSignal):Promise<()=>void>{
 if(signal?.aborted)return()=>{}
 const url=new URL(apiEndpoint(baseUrl,'ws'));url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('clientId',clientId)
 let stopped=false,cleanup=()=>{},ready=()=>{};const opened=new Promise<void>(resolve=>{ready=resolve})
 const stop=()=>{if(stopped)return;stopped=true;cleanup();signal?.removeEventListener('abort',stop);ready()};signal?.addEventListener('abort',stop,{once:true})
 if(isTauri()){
  const unlisten=await listen<{kind:string;data?:unknown}>(`workflow_events_${clientId}`,e=>{if(stopped)return;if(e.payload.kind==='ready')ready();else if(e.payload.kind==='message')onMessage(e.payload.data);else{onUnavailable();ready()}})
  if(stopped){unlisten();return stop}
  cleanup=()=>{unlisten();void invoke('stop_workflow_events',{clientId}).catch(()=>{})}
  try{await invoke('watch_workflow_events',{url:url.toString(),clientId,apiKey})}catch{onUnavailable();ready()}
  if(stopped)cleanup()
 }else if(typeof WebSocket!=='undefined'){
  const socket=new WebSocket(url);cleanup=()=>socket.close();socket.onopen=ready;socket.onmessage=e=>{if(stopped)return;try{onMessage(JSON.parse(e.data))}catch{}};socket.onerror=()=>{onUnavailable();ready()}
 }else{ready();onUnavailable()}
 let timer:ReturnType<typeof setTimeout>|undefined;await Promise.race([opened,new Promise<void>(resolve=>{timer=setTimeout(resolve,1000)})]);if(timer)clearTimeout(timer);if(signal?.aborted)stop();return stop
}
