import {decodeInterfaceFile} from '../model/interfaceViews'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { FieldSchema, Workspace } from '../model/types'
import { exportFiles, parseDocumentMarkdown } from '../model/markdown'
import { mergeThreeWay, sameData } from '../model/merge'
import { normalizeWorkspace } from '../model/themes'
const KEY='myuniverse-workspace-v1'
type Snapshot = Record<string, Record<string, string | null>>
let queue: Promise<unknown> = Promise.resolve()
let diskWorkspace: Workspace | null = null
let diskFiles: Snapshot = {}
let pendingConflict: MarkdownConflictError | null = null
let queuedCount = 0
const replacements = new Set<string>()
export function replaceDocumentFromImport(worldId: string, docId: string) {
  replacements.add(`${worldId}/${docId}`)
}

export class MarkdownConflictError extends Error {
  constructor(public submitted: Workspace, public local: Workspace, public remote: Workspace, public files: string[]) {
    super(`文件与界面同时修改了相同内容：${files.join('、')}`)
  }
}
export function clearMarkdownConflict() {
  pendingConflict = null
}
function serialize<T>(action: () => Promise<T>): Promise<T> {
  queuedCount++
  const task = queue.catch(() => undefined).then(action)
  queue = task
  return task.finally(() => { queuedCount--;  })
}
async function readFiles(workspace: Workspace, withSchema = false): Promise<Snapshot> {
  if (!isTauri()) return {}
  return invoke<Snapshot>('read_document_files', { requests: Object.fromEntries(workspace.worlds.map(world => [world.id, [...world.documents.flatMap(doc => withSchema ? [doc.fileName, doc.fileName.replace(/\.md$/i, '.schema.json')] : [doc.fileName]),...Object.values(world.views||{}).map(view=>view.fileName)]])) })
}
function isSchema(value: unknown): value is FieldSchema[] {
  return Array.isArray(value) && value.every(field => field && typeof field.id === 'string' && typeof field.key === 'string'
    && ['Const', 'Text', 'Class'].includes(field.keyType) && ['Object', 'Class', 'Data', 'Text', 'Content', 'Integer', 'Decimal', 'Null'].includes(field.valueType)
    && (!field.children || isSchema(field.children)))
}
function decodeDocuments(workspace: Workspace, snapshots: Snapshot, withSchema = false, authorizedReplacements=replacements, catalog:Workspace=workspace): Workspace {
  return { ...(diskWorkspace || workspace), worlds: workspace.worlds.map(world => {
    const oldWorld = diskWorkspace?.worlds.find(item => item.id === world.id)
    const referenceWorld=catalog.worlds.find(item=>item.id===world.id)||world
    const views=Object.fromEntries(Object.values(world.views||{}).map(view=>{
      const previous=oldWorld?.views?.[view.id]||view,text=snapshots[world.id]?.[view.fileName]
      if(text==null){if(diskFiles[world.id]?.[view.fileName]!=null)throw new Error(`${world.name} / ${view.fileName}：界面配置被删除，未覆盖磁盘`);return [view.id,previous]}
      if(!withSchema&&text===diskFiles[world.id]?.[view.fileName])return [view.id,previous]
      try{return [view.id,decodeInterfaceFile(text,previous,referenceWorld)]}catch(error){throw new Error(`${world.name} / ${view.fileName}：${String(error)}。未覆盖磁盘文件。`)}
    }))
    const nodes=(oldWorld||world).nodes.map(n=>views[n.id]?{...n,name:views[n.id].name,classId:views[n.id].parentClassId}:n)
    return { ...(oldWorld || world), views,nodes, documents: world.documents.map(doc => {
      let previous = oldWorld?.documents.find(item => item.id === doc.id) || doc
      // The import dialog explicitly authorizes replacing this document. It also
      // lets a valid import repair an unreadable current Markdown file.
      if (authorizedReplacements.has(`${world.id}/${doc.id}`)) return previous
      const text = snapshots[world.id]?.[doc.fileName]
      try {
        if (withSchema) {
          const schemaText = snapshots[world.id]?.[doc.fileName.replace(/\.md$/i, '.schema.json')]
          if (schemaText != null) {
            const schema: unknown = JSON.parse(schemaText)
            if (!isSchema(schema)) throw new Error('属性配置格式无效')
            previous = { ...previous, schema }
          }
        }
        if (text == null) {
          if (diskFiles[world.id]?.[doc.fileName] != null) throw new Error('文件已被删除，请恢复文件后继续保存')
          return previous
        }
        if (!withSchema && text === diskFiles[world.id]?.[doc.fileName]) return previous
        return parseDocumentMarkdown(text, previous, referenceWorld,{enforceGeneratedReadOnly:false,functionNames:Object.fromEntries((catalog.functions||[]).map(fn=>[fn.id,fn.name]))})
      } catch (error) {
        throw new Error(`${world.name} / ${doc.fileName}：${error instanceof Error ? error.message : String(error)}。未覆盖磁盘文件。`)
      }
    }) }
  }) }
}
export async function loadWorkspace(): Promise<Workspace> {
  diskWorkspace = null
  diskFiles = {}
  clearMarkdownConflict()
  replacements.clear()
  const raw = isTauri() ? await invoke<Workspace>('load_workspace') : JSON.parse(localStorage.getItem(KEY) || '{"worlds":[],"activeWorldId":null}')
  const workspace = normalizeWorkspace(raw)
  const files = await readFiles(workspace, true)
  // Disk content is authoritative: report invalid files instead of silently restoring JSON values.
  const loaded = decodeDocuments(workspace, files, true)
  diskWorkspace = loaded
  // Do not mark files as understood until a strict parse has succeeded.
  diskFiles = files
  return loaded
}

/** Explicit save writes the submitted JSON snapshot. It never reads Markdown. */
export function saveWorkspace(workspace:Workspace,_replacementKeys?:string[],writeScope?:import('../model/manualSave').CreationFile|'preferences'):Promise<Workspace>{
 return serialize(async()=>{
      // A queued schema save may have finished after this projection was captured.
      // Scoped saves retain independently persisted attribute configuration.
      if(writeScope&&diskWorkspace)workspace={...workspace,worlds:workspace.worlds.map(w=>({...w,documents:w.documents.map(d=>{const config=diskWorkspace!.worlds.find(v=>v.id===w.id)?.documents.find(v=>v.id===d.id);return config?{...d,schema:config.schema,labels:config.labels}:d})}))}
      const output:Record<string,Record<string,string>> = Object.fromEntries(workspace.worlds.flatMap(world=>{
        if(writeScope==='preferences'||writeScope&&world.id!==writeScope.worldId)return []
        const exported=exportFiles(world)
        if(!writeScope)return [[world.id,exported]]
        const doc=world.documents.find(d=>d.id===writeScope.id),view=world.views?.[writeScope.id]
        const names=new Set(['world-index.json',...(writeScope.kind==='document'&&doc?[doc.fileName,doc.fileName.replace(/\.md$/i,'.schema.json')]:writeScope.kind==='view'&&view?[view.fileName]:writeScope.kind==='chat'?['聊天框配置.json']:[])])
        // First persistence of a project/file also establishes its required defaults.
        const oldWorld=(diskWorkspace||workspace).worlds.find(w=>w.id===world.id)
        for(const d of world.documents)if(!oldWorld?.documents.some(previous=>previous.id===d.id)){names.add(d.fileName);names.add(d.fileName.replace(/\.md$/i,'.schema.json'))}
        for(const v of Object.values(world.views||{}))if(!oldWorld?.views?.[v.id])names.add(v.fileName)
        return [[world.id,Object.fromEntries(Object.entries(exported).filter(([name])=>names.has(name)))]]
      }))

  if(isTauri())await invoke('save_workspace',{workspace,files:output})
  else localStorage.setItem(KEY,JSON.stringify(workspace))
  diskWorkspace=workspace
  for(const [worldId,entries] of Object.entries(output))for(const [name,text] of Object.entries(entries)){diskFiles[worldId]||={};diskFiles[worldId][name]=text}
  replacements.clear()
  return workspace
 })
}
/** Attribute configuration is persisted independently of instance Markdown. */
export function saveAttributeConfig(workspace:Workspace,worldId:string,docId:string):Promise<Workspace>{
 const localWorld=workspace.worlds.find(w=>w.id===worldId),config=localWorld?.documents.find(d=>d.id===docId)
 if(!localWorld||!config)return Promise.reject(new Error('属性配置不存在'))
 return serialize(async()=>{
  const base=diskWorkspace||workspace,oldWorld=base.worlds.find(w=>w.id===worldId)
  // Only schema and label configuration are submitted, never instance drafts.
  const previous=oldWorld?.documents.find(d=>d.id===docId)
  const doc={...(previous||{...config,entities:[]}),schema:config.schema,labels:config.labels,entityLabels:previous?.entityLabels?Object.fromEntries(Object.entries(previous.entityLabels).filter(([,label])=>config.labels?.some(v=>v.id===label))):undefined}
  const world=oldWorld?{...oldWorld,documents:previous?oldWorld.documents.map(d=>d.id===docId?doc:d):[...oldWorld.documents,doc],nodes:oldWorld.nodes}: {...localWorld,documents:localWorld.documents.map(d=>d.id===docId?doc:{...d,entities:[]})}
  if(!previous)world.nodes=[...world.nodes,...localWorld.nodes.filter(n=>!world.nodes.some(v=>v.id===n.id))]
  const result={...base,worlds:oldWorld?base.worlds.map(w=>w.id===worldId?world:w):[...base.worlds,world]}
  const name=config.fileName.replace(/\.md$/i,'.schema.json'),text=JSON.stringify(config.schema,null,2)
  const files={[worldId]:{[name]:text,'world-index.json':JSON.stringify({version:1,id:world.id,name:world.name,nodes:world.nodes,documents:world.documents.map(({id,name,fileName,protected:protectedFile})=>({id,name,fileName,protected:protectedFile})),views:Object.values(world.views||{}).map(({id,fileName,kind,parentClassId})=>({id,fileName,kind,parentClassId}))},null,2)}}
  if(isTauri())await invoke('save_workspace',{workspace:result,files,jsonOnly:true})
  else localStorage.setItem(KEY,JSON.stringify(result))
  diskWorkspace=result;diskFiles[worldId]||={};diskFiles[worldId][name]=text
  return result
 })
}

/** Explicit refresh replaces drafts with disk content; no pre-save merge. */
export function refreshWorkspace(workspace:Workspace):Promise<Workspace>{
 return serialize(async()=>{
  const base=diskWorkspace||workspace
  const files=await readFiles(base,true)
  const result=isTauri()?decodeDocuments(base,files,true,new Set(),base):normalizeWorkspace(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(base)))
  diskWorkspace=result;diskFiles=files;clearMarkdownConflict();return result
 })
}
/** Configuration refresh reads workspace JSON and scripts, never world Markdown. */
export function reloadPreferences(workspace:Workspace):Promise<Workspace>{
 return serialize(async()=>{
  const raw=isTauri()?await invoke<Workspace>('load_workspace'):JSON.parse(localStorage.getItem(KEY)||JSON.stringify(diskWorkspace||workspace))
  const fresh=normalizeWorkspace(raw)
  diskWorkspace={...fresh,worlds:(diskWorkspace||workspace).worlds}
  return {...fresh,activeWorldId:workspace.activeWorldId,worlds:workspace.worlds}
 })
}
export function applySyncResult(submitted: Workspace, current: Workspace, result: Workspace): Workspace {
  const next = mergeThreeWay(submitted, current, result).value
  return sameData(current, next) ? current : next
}

/** Last successfully read/written disk snapshot, never a mutable creation draft. */
export const savedWorkspace=()=>diskWorkspace
export function reloadCreationFile(workspace:Workspace,scope:import('../model/manualSave').CreationFile):Promise<Workspace>{
 return serialize(async()=>{
  if(pendingConflict)throw pendingConflict
  const base=diskWorkspace||workspace
  const world=base.worlds.find(w=>w.id===scope.worldId)
  if(!world)throw new Error('当前项目尚未保存，请先保存全部文件')
  let remote:Workspace
  let files:Snapshot={}
  if(isTauri()){
   const target={...base,worlds:[{...world,documents:scope.kind==='document'?world.documents.filter(d=>d.id===scope.id):scope.kind==='view'?[]:world.documents,views:scope.kind==='document'?{}:scope.kind==='view'?Object.fromEntries(Object.entries(world.views||{}).filter(([id])=>id===scope.id)):world.views}]}
   files=await readFiles(target,true)
   if(scope.kind==='view'){
    const previous=world.views?.[scope.id];if(!previous)throw new Error('当前界面文件尚未保存')
    const text=files[world.id]?.[previous.fileName];if(text==null)throw new Error('当前界面文件已被删除，未覆盖磁盘')
    remote={...base,worlds:[{...world,views:{...world.views,[scope.id]:decodeInterfaceFile(text,previous,world)}}]}
   }else remote=decodeDocuments(target,files,true,new Set(),base)
  }
  else remote=normalizeWorkspace(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(base)))
  const fresh=remote.worlds.find(w=>w.id===scope.worldId);if(!fresh)throw new Error('磁盘中的项目已不存在')
  const next=workspace.worlds.map(w=>{
   if(w.id!==scope.worldId)return w
   if(scope.kind==='document'){const doc=fresh.documents.find(d=>d.id===scope.id);if(!doc)throw new Error('当前文件尚未保存');return {...w,documents:w.documents.map(d=>d.id===scope.id?doc:d)}}
   if(scope.kind==='view')return {...w,views:{...w.views,[scope.id]:fresh.views![scope.id]}}
   if(scope.kind==='chat')return {...w,chat:fresh.chat}
   return fresh
  })
  // Reloading one file must not consume another file's external change baseline.
  const saved=base.worlds.map(w=>{
   if(w.id!==scope.worldId)return w
   if(scope.kind==='document')return {...w,documents:w.documents.map(d=>d.id===scope.id?fresh.documents.find(v=>v.id===d.id)!:d)}
   if(scope.kind==='view')return {...w,views:{...w.views,[scope.id]:fresh.views![scope.id]}}
   if(scope.kind==='chat')return {...w,chat:fresh.chat}
   return fresh
  })
  diskWorkspace={...base,worlds:saved}
  const names=scope.kind==='document'?world.documents.filter(d=>d.id===scope.id).flatMap(d=>[d.fileName,d.fileName.replace(/\.md$/i,'.schema.json')]):scope.kind==='view'?[world.views![scope.id].fileName]:Object.keys(files[scope.worldId]||{})
  for(const name of names){diskFiles[scope.worldId]||={};diskFiles[scope.worldId][name]=files[scope.worldId]?.[name]??null}
  if(scope.kind==='document')replacements.delete(`${scope.worldId}/${scope.id}`)
  return {...workspace,worlds:next}
 })
}
