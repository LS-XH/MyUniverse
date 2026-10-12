import { FunctionAppendScope } from '../model/functionAppend'
import { createHostWorldApi } from '../model/hostWorldApi'
import { mergeThreeWay, sameData } from '../model/merge'
import { Workspace, World } from '../model/types'

export interface ScriptHost {autoSave?:boolean;get:()=>Workspace;update:(change:(workspace:Workspace)=>Workspace)=>void;save?:()=>Promise<void>}
let host:ScriptHost|undefined
export function bindScriptHost(next:ScriptHost){host=next;return ()=>{if(host===next)host=undefined}}
export function readScriptWorld(world?:World){return world?(host?host.get().worlds.find(w=>w.id===world.id):world):undefined}
export function beginScript(world?:World,excludeFunctionId?:string,readOnly=false,scope?:FunctionAppendScope){
  const owner=host,base=readScriptWorld(world)
  if(owner&&world&&!base)throw new Error('调用世界已删除')
  let draft=base,open=true,saveRequested=false
  // Recompute only this binding's generated additions; user values remain intact.
  if(draft&&scope){
    const clean=(fields:import('../model/types').FieldValue[]):import('../model/types').FieldValue[]=>fields.filter(f=>!(f.functionOrigin?.functionId===scope.functionId&&f.functionOrigin.bindingFieldId===scope.path.at(-1))).map(f=>({...f,children:clean(f.children)}))
    draft={...draft,documents:draft.documents.map(d=>d.id===scope.classId?{...d,entities:d.entities.map(e=>e.id===scope.entityId?{...e,fields:clean(e.fields)}:e)}:d)}
  }
  const check=()=>{if(!open)throw new Error('脚本调用已结束')}
  const api=createHostWorldApi(()=>{check();return draft},next=>{check();if(readOnly)throw new Error('此调用只允许读取世界对象');if(!owner)throw new Error('当前没有可写的主程序工作区');draft=next},excludeFunctionId,scope)
  const app={world:api,storage:{save:async()=>{check();saveRequested=true}}}
  return {world:api,app,read:()=>draft,close:()=>{open=false},commit:async(project?:(workspace:Workspace)=>Workspace)=>{
    check();open=false
    if(base&&draft&&scope){
      const reuse=(fields:import('../model/types').FieldValue[],old:import('../model/types').FieldValue[]):import('../model/types').FieldValue[]=>{
        const used=new Set<string>()
        return fields.map(f=>{
          const owned=f.functionOrigin?.functionId===scope.functionId&&f.functionOrigin.bindingFieldId===scope.path.at(-1)
          const prior=old.find(p=>!used.has(p.id)&&(owned?p.schemaId===f.schemaId&&p.key===f.key&&p.functionOrigin?.functionId===scope.functionId&&p.functionOrigin.bindingFieldId===scope.path.at(-1):p.id===f.id))
          if(prior)used.add(prior.id)
          return {...f,...(owned&&prior?{id:prior.id}:{}),children:reuse(f.children,prior?.children||[])}
        })
      }
      draft={...draft,documents:draft.documents.map(d=>({...d,entities:d.entities.map(e=>({...e,fields:reuse(e.fields,base!.documents.find(p=>p.id===d.id)?.entities.find(p=>p.id===e.id)?.fields||[])}))}))}
    }
    if(owner&&(project||base&&draft&&!sameData(base,draft)))owner.update(workspace=>{
      let next=workspace
      if(base&&draft&&!sameData(base,draft)){
        const latest=workspace.worlds.find(w=>w.id===base.id);if(!latest)throw new Error('调用世界已删除')
        const merged=mergeThreeWay(base,latest,draft);if(merged.conflicts.length)throw new Error('脚本与界面同时修改了同一对象: '+merged.conflicts.join(', '))
        next={...workspace,worlds:workspace.worlds.map(w=>w.id===base.id?merged.value:w)}
      }
      return project?project(next):next
    })
    if(owner&&owner.autoSave!==false&&(saveRequested||base&&draft&&!sameData(base,draft)))await owner.save?.()
  }}
}
const compiled=new Map<string,Function>()
export function scriptEntry(code:string,entry:'transform'|'execute'){
  const key=entry+'\n'+code;let factory=compiled.get(key)
  if(!factory){factory=new Function('world','values','app','"use strict";\n'+code+`\n;return typeof ${entry} === "function" ? ${entry} : null;`);if(compiled.size>=64)compiled.delete(compiled.keys().next().value!);compiled.set(key,factory)}
  return factory
}
export async function executeHostScript(code:string,entry:'transform'|'execute',runtime:ReturnType<typeof beginScript>,values:unknown,args:unknown[],signal?:AbortSignal){
  if(signal?.aborted)throw new DOMException('已取消','AbortError')
  if(code.length>1000000)throw new Error('脚本超过 1 MB')
  const fn=scriptEntry(code,entry)(runtime.world,values,runtime.app);if(typeof fn!=='function')throw new Error(`需要定义 ${entry}`)
  let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined
  try{return await Promise.race([Promise.resolve().then(()=>fn(...args)),new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('异步脚本等待超过 5 秒；主线程同步代码无法强制中断')),5000)
    abort=()=>reject(new DOMException('已取消','AbortError'));signal?.addEventListener('abort',abort,{once:true})
  })])}finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort)}
}
