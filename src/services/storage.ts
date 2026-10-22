import {runtimeSkills,upgradeRuntimeSkills} from '../model/runtimeSkills'
import {builtinSkills,upgradeBuiltinSkills,NARRATOR_SKILL} from '../model/builtinSkills'
import {invoke,isTauri} from '@tauri-apps/api/core'
import type {ClassDocument,Workspace,Entity} from '../model/types'
import type {CreationFile} from '../model/manualSave'
import {mergeThreeWay,sameData,retainReferences} from '../model/merge'
import {decodeInterfaceFile} from '../model/interfaceViews'
import {background,yieldToUI} from './background'
import {appLog,logOperation} from './runtimeLog'
import {loadSkillPackages,persistSkillPackages,workspaceArchive} from './skillStorage'

const KEY='myuniverse-workspace-v1'
let queue:Promise<unknown>=Promise.resolve()
let archive:Workspace|null=null,exported:Workspace|null=null
const exportedText=new Map<string,string>()
/** Read the actual export file; never substitute the workspace JSON as its baseline. */
export async function readDocumentMarkdown(worldId:string,fileName:string):Promise<string|null>{
 if(!isTauri())return exportedText.get(JSON.stringify([worldId,fileName]))??null
 const result=await invoke<Record<string,Record<string,string|null>>>('read_document_files',{requests:{[worldId]:[fileName]}})
 return result[worldId]?.[fileName]??null
}
function serialize<T>(action:()=>Promise<T>):Promise<T>{const task=queue.catch(()=>undefined).then(action);queue=task;return task}
async function readArchive(fallback:Workspace):Promise<Workspace>{
 const raw=isTauri()?await invoke<Workspace|string>('load_workspace'):localStorage.getItem(KEY)||fallback
 const workspace=await background('normalize',raw)
 const skills=await loadSkillPackages([...(workspace.skills||[]),...((workspace.systemSkillVersion||0)<4?runtimeSkills():[]),...(workspace.systemSkillVersion?((workspace.systemSkillVersion<3)?builtinSkills().filter(s=>s.id===NARRATOR_SKILL):[]):builtinSkills())]),upgraded=(workspace.systemSkillVersion||0)<6?upgradeBuiltinSkills(skills):skills
 const current=upgradeRuntimeSkills(upgraded,workspace.systemSkillVersion||0)
 if(current.some((s,i)=>s!==skills[i]))await persistSkillPackages(current)
 return {...workspace,systemSkillVersion:6,skills:current}
}
/** JSON is authoritative. Startup never imports external Markdown, schema or view exports. */
export async function loadWorkspace():Promise<Workspace>{return logOperation('工作区','加载 JSON 存档',async()=>{archive=await readArchive({worlds:[],activeWorldId:null});exported=archive;return archive})}
/** Autosave writes only the complete workspace, including stable IDs and generated metadata. */
export function checkpointWorkspace(workspace:Workspace):Promise<Workspace>{
 return serialize(async()=>{
  if(workspace===archive)return workspace
  await persistSkillPackages(workspace.skills||[])
  const text=await background('stringify',{...workspaceArchive(workspace),archiveVersion:2})
  if(isTauri())await invoke('checkpoint_workspace',{text});else localStorage.setItem(KEY,text)
  archive=workspace;appLog.info('JSON 存档','自动存档完成');return workspace
 })
}
/** Save is an explicit export. A scoped export must never replace the authoritative archive. */
export function saveWorkspace(workspace:Workspace,_replacementKeys?:string[],scope?:CreationFile|'preferences'):Promise<Workspace>{
 return logOperation('导出',scope==='preferences'?'导出配置':scope?'导出当前文件':'导出全部文件',()=>serialize(async()=>{
  const files=await background('export',{workspace,scope})
  if(!scope||scope==='preferences')await persistSkillPackages(workspace.skills||[])
  const exportedWorkspace=workspaceArchive(workspace)
  if(isTauri())await invoke('export_workspace',{workspace:scope&&scope!=='preferences'?{...exportedWorkspace,functions:undefined}:exportedWorkspace,files})
  else if(!archive){localStorage.setItem(KEY,await background('stringify',{...exportedWorkspace,archiveVersion:2}));archive=workspace}
  for(const [worldId,documents] of Object.entries(files))for(const [name,text] of Object.entries(documents))exportedText.set(JSON.stringify([worldId,name]),text)
  exported=workspace;return workspace
 }))
}
export const saveAttributeConfig=(workspace:Workspace,_worldId:string,_docId:string)=>checkpointWorkspace(workspace)
export const savedWorkspace=()=>exported
export const archivedWorkspace=()=>archive
export function applySyncResult(submitted:Workspace,current:Workspace,result:Workspace):Workspace{
 if(submitted===result)return current
 const next=mergeThreeWay(submitted,current,result).value;return sameData(current,next)?current:next
}
export interface ImportProgress {worldId:string;docId:string;before:ClassDocument;document:ClassDocument;entity?:Entity;beforeEntity?:Entity;final?:boolean;completed:number;total:number}
export interface ImportOptions {preserveFunctionOrigin?:boolean;signal?:AbortSignal;onProgress?:(progress:ImportProgress)=>void|Promise<void>}
/** Commit only the newly parsed instance; do not repeatedly merge the whole document. */
export function applyImportProgress(current:ClassDocument,progress:ImportProgress):ClassDocument{
 const {before,document}=progress
 if(current.schema!==before.schema&&!sameData(current.schema,before.schema))throw new Error('导入期间属性结构已修改，未覆盖当前编辑')
 if(current.name!==before.name&&current.name!==document.name)throw new Error('导入期间类名已修改，未覆盖当前编辑')
 if(progress.entity){
  const latest=current.entities.find(e=>e.id===progress.entity!.id),merged=mergeThreeWay(progress.beforeEntity,latest,progress.entity)
  if(merged.conflicts.length)throw new Error('导入期间目标成员被修改，未覆盖当前编辑')
  const entity=latest&&merged.value?retainReferences(latest,merged.value):merged.value
  const entities=latest?current.entities.flatMap(e=>e.id===latest.id?entity?[entity]:[]:[e]):entity?[...current.entities,entity]:current.entities
  return {...current,name:document.name,entities}
 }
 if(progress.final){
  const wanted=new Set(document.entities.map(e=>e.id)),old=new Map(before.entities.map(e=>[e.id,e])),latest=new Map(current.entities.map(e=>[e.id,e]))
  for(const e of current.entities)if(!wanted.has(e.id)&&old.has(e.id)&&!sameData(e,old.get(e.id)))throw new Error('导入将删除已编辑实例，已保留当前内容')
  const entities=[...document.entities.flatMap(e=>latest.has(e.id)?[latest.get(e.id)!]:[]),...current.entities.filter(e=>!wanted.has(e.id)&&!old.has(e.id))]
  const ids=new Set(entities.map(e=>e.id))
  return {...current,name:document.name,entities,...(current.entityLabels?{entityLabels:Object.fromEntries(Object.entries(current.entityLabels).filter(([id])=>ids.has(id)))}:{})}
 }
 return current
}
/** Validate off-thread, then expose one complete instance per UI turn. */
export function publishImportedDocument(...args:Parameters<typeof publishImportCards>):ReturnType<typeof publishImportCards>{return logOperation('导入',args[0].fileName,()=>publishImportCards(...args))}
async function publishImportCards(before:ClassDocument,parsed:ClassDocument,worldId:string,options:ImportOptions={}):Promise<void>{
 parsed={...parsed,schema:before.schema}
 const entities=[...before.entities],positions=new Map(entities.map((e,i)=>[e.id,i])),old=new Map(before.entities.map(e=>[e.id,e]))
 for(const [index,entity] of parsed.entities.entries()){
  if(options.signal?.aborted)throw new DOMException('已取消','AbortError')
  const position=positions.get(entity.id)
  if(position===undefined){positions.set(entity.id,entities.length);entities.push(entity)}else entities[position]=entity
  await options.onProgress?.({worldId,docId:before.id,before,document:{...parsed,entities:[...entities]},entity,beforeEntity:old.get(entity.id),completed:index+1,total:parsed.entities.length})
  await yieldToUI()
 }
 if(options.signal?.aborted)throw new DOMException('已取消','AbortError')
 await options.onProgress?.({worldId,docId:before.id,before,document:parsed,final:true,completed:parsed.entities.length,total:parsed.entities.length})
}
export function reloadCreationFile(...args:Parameters<typeof importCreationFile>):ReturnType<typeof importCreationFile>{return logOperation('导入','导入文件并填入 JSON',()=>importCreationFile(...args))}
async function importCreationFile(workspace:Workspace,scope:CreationFile,options:ImportOptions={}):Promise<Workspace>{
  const world=workspace.worlds.find(w=>w.id===scope.worldId);if(!world)throw new Error('项目不存在')
  if(!isTauri())throw new Error('浏览器模式请通过“导入 MD”选择文件；刷新不再从 JSON 回退对象')
  const docs=scope.kind==='document'?world.documents.filter(d=>d.id===scope.id):scope.kind==='world'?world.documents:[]
  const views=options.preserveFunctionOrigin?[]:scope.kind==='view'?[world.views?.[scope.id]].filter((v):v is NonNullable<typeof v>=>!!v):scope.kind==='world'?Object.values(world.views||{}):[]
  if(scope.kind==='document'&&!docs.length)throw new Error('对象文件不存在')
  const names=[...docs.map(d=>d.fileName),...views.map(v=>v.fileName)]
  const snapshots=await invoke<Record<string,Record<string,string|null>>>('read_document_files',{requests:{[world.id]:names}})
  let result=workspace
  for(const before of docs){
   const text=snapshots[world.id]?.[before.fileName];if(text==null)throw new Error(`${before.fileName}：导入文件不存在，请先导出或选择 Markdown 文件`)
   let parsed:ClassDocument
   try{parsed=await background('parse',{text,doc:before,world,options:{preserveFunctionOrigin:options.preserveFunctionOrigin,enforceGeneratedReadOnly:false,functionNames:Object.fromEntries((workspace.functions||[]).map(f=>[f.id,f.name]))}},options.signal)}catch(error){throw new Error(`${before.fileName}：${String(error)}。未导入无效内容。`)}
   await publishImportedDocument(before,parsed,world.id,options)
   result={...result,worlds:result.worlds.map(w=>w.id===world.id?{...w,documents:w.documents.map(d=>d.id===before.id?parsed:d)}:w)}
  }
  for(const view of views){
   const text=snapshots[world.id]?.[view.fileName];if(text==null){if(scope.kind==='view')throw new Error('界面配置导入文件不存在');continue}
   try{const imported=decodeInterfaceFile(text,view,world);result={...result,worlds:result.worlds.map(w=>w.id===world.id?{...w,views:{...w.views,[view.id]:imported}}:w)}}catch(error){throw new Error(`界面配置 ${view.fileName}：${String(error)}`)}
  }
  return result
}
export async function refreshWorkspace(workspace:Workspace):Promise<Workspace>{let result=workspace;for(const world of workspace.worlds)result=await reloadCreationFile(result,{worldId:world.id,kind:'world',id:world.id});return result}
export function reloadPreferences(workspace:Workspace):Promise<Workspace>{return serialize(async()=>({...await readArchive(workspace),worlds:workspace.worlds,activeWorldId:workspace.activeWorldId}))}
