import type {ClassDocument, Workspace, World, FunctionScript, Entity,FunctionContext,ToolDefinition} from '../model/types'
import type {FunctionJob} from './functions'
import {parseDocumentMarkdown,documentMarkdown,markdownLocations,markdownHeadingLevels,exportFiles} from '../model/markdown'
import {functionJobs,runFunctionValue,resolveFunctionJob} from './functions'
import {bindScriptHost} from './scriptHost'
import {lineDiff} from '../model/textDiff'
import type {CreationFile} from '../model/manualSave'
import {fieldPath} from '../model/functionAppend'
import {runTool} from './tools'
import {normalizeWorkspace} from '../model/themes'

export interface BackgroundTasks {
 normalize:{input:Workspace|string;output:Workspace}
 parse:{input:{text:string;doc:ClassDocument;world?:World;options?:Parameters<typeof parseDocumentMarkdown>[3]};output:ClassDocument}
 preview:{input:{doc:ClassDocument;baseline?:string;baselineDocument?:ClassDocument};output:{source:string;locations:ReturnType<typeof markdownLocations>;levels:number[];rows:ReturnType<typeof lineDiff>}}
 jobs:{input:{workspace:Workspace;scope?:{worldId:string;docId?:string;entityId?:string}};output:FunctionJob[]}
 job:{input:{workspace:Workspace;identity:FunctionJob};output:FunctionJob|undefined}
 function:{input:{world:World;fn:FunctionScript;job:FunctionJob};output:{entity?:Entity;job?:FunctionJob;output:Awaited<ReturnType<typeof runFunctionValue>>}}
 directFunction:{input:{world?:World;fn:FunctionScript;input:string;context?:FunctionContext;job?:FunctionJob};output:{world?:World;output:Awaited<ReturnType<typeof runFunctionValue>>}}
 tool:{input:{world?:World;tool:ToolDefinition;parameters:unknown};output:{world?:World;value:unknown}}
 export:{input:{workspace:Workspace;scope?:CreationFile|'preferences'};output:Record<string,Record<string,string>>}
 stringify:{input:Workspace;output:string}
}
export async function executeBackgroundTask<K extends keyof BackgroundTasks>(kind:K,input:BackgroundTasks[K]['input']):Promise<BackgroundTasks[K]['output']>{
 let result:unknown
 switch(kind){
  case 'normalize':{
   const value=typeof input==='string'?JSON.parse(input):input
   if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray((value as Workspace).worlds))throw new Error('工作区 JSON 存档结构无效，未覆盖原文件')
   result=normalizeWorkspace(value as Workspace);break
  }
  case 'parse':{const v=input as BackgroundTasks['parse']['input'];result=parseDocumentMarkdown(v.text,v.doc,v.world,{...v.options,mode:'fill'});break}
  case 'preview':{const v=input as BackgroundTasks['preview']['input'],source=documentMarkdown(v.doc),baseline=v.baselineDocument?documentMarkdown(v.baselineDocument):v.baseline;result={source,locations:markdownLocations(v.doc),levels:markdownHeadingLevels(source),rows:baseline===undefined?source.split('\n').map((text,i)=>({kind:'context',text,after:i+1})):lineDiff(baseline,source,true)};break}
  case 'jobs':{const v=input as BackgroundTasks['jobs']['input'];result=functionJobs(v.workspace,true,v.scope);break}
  case 'job':{const v=input as BackgroundTasks['job']['input'];result=resolveFunctionJob(v.workspace,v.identity);break}
  case 'function':{
   const v=input as BackgroundTasks['function']['input'];let workspace:Workspace={worlds:[v.world],activeWorldId:v.world.id,functions:[v.fn]}
   const job=resolveFunctionJob(workspace,v.job)
   if(!job){result={output:{value:''}};break}
   if(job.error){result={job,output:{value:''}};break}
   const unbind=bindScriptHost({autoSave:false,get:()=>workspace,update:change=>{workspace=change(workspace)}})
   try{const output=await runFunctionValue(v.fn,job.input,v.world,job.context,undefined,job);const entity=workspace.worlds[0].documents.find(d=>d.id===job.docId)?.entities.find(e=>job.context?e.id===job.context.self.entityId:!!fieldPath(e.fields,job.fieldId));if(!entity)throw new Error('函数目标实例不存在');result={entity,job,output}}finally{unbind()}
   break
  }
  case 'directFunction':{
   const v=input as BackgroundTasks['directFunction']['input'];let workspace:Workspace={worlds:v.world?[v.world]:[],activeWorldId:v.world?.id||null,functions:[v.fn]}
   const unbind=bindScriptHost({autoSave:false,get:()=>workspace,update:change=>{workspace=change(workspace)}})
   try{const output=await runFunctionValue(v.fn,v.input,v.world,v.context,undefined,v.job);result={world:workspace.worlds[0],output}}finally{unbind()}
   break
  }
  case 'tool':{
   const v=input as BackgroundTasks['tool']['input'];let workspace:Workspace={worlds:v.world?[v.world]:[],activeWorldId:v.world?.id||null,tools:[v.tool]}
   const unbind=bindScriptHost({autoSave:false,get:()=>workspace,update:change=>{workspace=change(workspace)}})
   try{const value=await runTool(v.tool,v.parameters,v.world);result={world:workspace.worlds[0],value}}finally{unbind()}
   break
  }
  case 'export':{const v=input as BackgroundTasks['export']['input'];result=Object.fromEntries(v.workspace.worlds.filter(w=>v.scope!=='preferences'&&(!v.scope||w.id===v.scope.worldId)).map(w=>{
   const scope=v.scope as CreationFile|undefined
   const files=exportFiles(w,scope?.kind==='document'?new Set([scope.id]):scope?new Set():undefined)
   if(!scope||scope.kind==='world')return [w.id,files]
   const names=new Set(['world-index.json',...(scope.kind==='document'?w.documents.filter(d=>d.id===scope.id).flatMap(d=>[d.fileName,d.fileName.replace(/\.md$/i,'.schema.json')]):scope.kind==='view'?[w.views?.[scope.id]?.fileName]:scope.kind==='chat'?['聊天框配置.json']:[])])
   return [w.id,Object.fromEntries(Object.entries(files).filter(([name])=>names.has(name)))]
  }));break}
  case 'stringify':result=JSON.stringify(input);break
 }
 return result as BackgroundTasks[K]['output']
}
