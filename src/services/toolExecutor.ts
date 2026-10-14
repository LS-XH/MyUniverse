import {background} from './background'
import {readScriptWorld,commitBackgroundTool} from './scriptHost'
import type {ToolDefinition,World} from '../model/types'
export async function executeToolInBackground(tool:ToolDefinition,parameters:unknown,world?:World,signal?:AbortSignal){
 const base=readScriptWorld(world),result=await background('tool',{world:base,tool,parameters},signal)
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 commitBackgroundTool(base,result.world,tool);return result.value
}
