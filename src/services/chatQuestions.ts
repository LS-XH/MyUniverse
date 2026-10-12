import {uid} from '../model/types'
export interface ChatQuestion {id:string;question:string;options:string[];answer?:string}
const pending=new Map<string,(answer:string)=>void>()
export const hasChatQuestion=(id:string)=>pending.has(id)
export function answerChatQuestion(id:string,answer:string){if(!answer.trim())throw new Error('请输入回答');const resolve=pending.get(id);if(!resolve)throw new Error('此提问已结束或中断');resolve(answer.trim())}
export async function askChatQuestion(question:string,options:string[],signal:AbortSignal|undefined,notify:(value:ChatQuestion)=>void|Promise<void>):Promise<string>{
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 const value={id:uid(),question,options}
 let answer:string
 try{answer=await new Promise<string>((resolve,reject)=>{
  const abort=()=>{pending.delete(value.id);reject(new DOMException('已取消','AbortError'))}
  pending.set(value.id,result=>{pending.delete(value.id);signal?.removeEventListener('abort',abort);resolve(result)})
  signal?.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(()=>notify(value)).catch(error=>{pending.delete(value.id);signal?.removeEventListener('abort',abort);reject(error)})
 })}finally{pending.delete(value.id)}
 await notify({...value,answer});return answer
}
