import {background} from './background'
import {readScriptWorld,commitBackgroundWorld} from './scriptHost'
import type {FunctionScript,FunctionContext,World} from '../model/types'
import type {FunctionJob} from './functions'
export async function executeFunctionInBackground(fn:FunctionScript,input:string,world?:World,context?:FunctionContext,signal?:AbortSignal,job?:FunctionJob){
 const base=readScriptWorld(world),result=await background('directFunction',{world:base,fn,input,context,job},signal)
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 commitBackgroundWorld(base,result.world,fn);return result.output
}
