import {executeBackgroundTask} from './backgroundTasks'
import {installWorkerConsoleLogging} from './runtimeLog'
const flushLogs=installWorkerConsoleLogging()
let queue:Promise<unknown>=Promise.resolve()
self.onmessage=({data})=>{queue=queue.catch(()=>undefined).then(async()=>{
 self.postMessage({id:data.id,started:true})
 try{self.postMessage({id:data.id,result:await executeBackgroundTask(data.kind,data.input)})}catch(error){self.postMessage({id:data.id,kind:data.kind,error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined})}finally{flushLogs()}
})}
