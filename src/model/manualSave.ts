import {sameData} from './merge'
import {ClassDocument,Workspace,World} from './types'
export type CreationFile={worldId:string;kind:'document'|'view'|'chat'|'world';id:string}
/** Submit only the requested draft; unrelated creation edits remain in memory. */
export function saveProjection(current:Workspace,saved:Workspace,scope?:CreationFile):Workspace {
 if(!scope)return {...current,worlds:saved.worlds}
 const local=current.worlds.find(w=>w.id===scope.worldId),base=saved.worlds.find(w=>w.id===scope.worldId)
 if(!local)return {...current,worlds:saved.worlds}
 let next:World
 if(!base)next=local
 else if(scope.kind==='document'){
  const doc=local.documents.find(d=>d.id===scope.id)
  next={...base,documents:doc?(base.documents.some(d=>d.id===doc.id)?base.documents.map(d=>d.id===doc.id?doc:d):[...base.documents,doc]):base.documents.filter(d=>d.id!==scope.id)}
  // New files need their logical parents in the flat world index.
  if(doc&&!base.documents.some(d=>d.id===doc.id)){
   const ids=new Set(local.nodes.filter(n=>n.classId===doc.id&&n.type==='file').map(n=>n.id))
   for(const id of [...ids]){let n=local.nodes.find(n=>n.id===id);while(n?.parentId){ids.add(n.parentId);n=local.nodes.find(p=>p.id===n!.parentId)}}
   next.nodes=[...base.nodes,...local.nodes.filter(n=>ids.has(n.id)&&!base.nodes.some(b=>b.id===n.id))]
  }
 }else if(scope.kind==='view'){
  const view=local.views?.[scope.id],views={...base.views};if(view)views[scope.id]=view;else delete views[scope.id]
  next={...base,views,nodes:base.nodes.map(n=>n.id===scope.id?(local.nodes.find(v=>v.id===n.id)||n):n)}
  if(view&&!next.nodes.some(n=>n.id===scope.id))next.nodes=[...next.nodes,...local.nodes.filter(n=>n.id===scope.id)]
 }else if(scope.kind==='chat')next={...base,chat:local.chat}
 else next={...base,name:local.name,nodes:local.nodes,
  documents:local.documents.map(doc=>base.documents.find(d=>d.id===doc.id)||{...doc,entities:[]}),
  views:Object.fromEntries(Object.entries(local.views||{}).map(([id,view])=>[id,base.views?.[id]||view]))}

 return {...saved,activeWorldId:current.activeWorldId,worlds:saved.worlds.some(w=>w.id===next.id)?saved.worlds.map(w=>w.id===next.id?next:w):[...saved.worlds,next]}
}
export function dirtyTreeItems(world:World,saved?:World):Set<string>{
 const dirty=new Set<string>()
 if(!saved){dirty.add(world.id);world.nodes.forEach(n=>dirty.add(n.id));return dirty}
 world.nodes.forEach(n=>{
  const old=saved.nodes.find(v=>v.id===n.id)
  if(!sameData(n,old)||n.type==='file'&&!sameDocumentContent(world.documents.find(d=>d.id===n.classId),saved.documents.find(d=>d.id===n.classId))||n.type==='view'&&!sameData(n.viewType==='chat'?world.chat:world.views?.[n.id],n.viewType==='chat'?saved.chat:saved.views?.[n.id]))dirty.add(n.id)
 })
 const parents=new Set([...world.nodes,...saved.nodes].map(n=>n.parentId))
 for(const parent of parents)if(!sameData(world.nodes.filter(n=>n.parentId===parent).map(n=>n.id),saved.nodes.filter(n=>n.parentId===parent).map(n=>n.id)))dirty.add(parent||world.id)
 // A deleted child has no row, so its parent carries the unsaved marker.
 saved.nodes.filter(n=>!world.nodes.some(v=>v.id===n.id)).forEach(n=>dirty.add(n.parentId||world.id))
 for(const id of [...dirty]){let n=world.nodes.find(n=>n.id===id);while(n?.parentId){dirty.add(n.parentId);n=world.nodes.find(v=>v.id===n!.parentId)}}
 if(dirty.size||!sameData({...world,documents:[],views:{},nodes:[],chat:null},{...saved,documents:[],views:{},nodes:[],chat:null}))dirty.add(world.id)
 return dirty
}

/** Compare each visible instance with the last successfully persisted document. */
export function dirtyEntityItems(doc:ClassDocument,saved?:ClassDocument):Set<string>{
 const baseline=new Map(saved?.entities.map((entity,index)=>[entity.id,{entity,index}]))
 return new Set(doc.entities.filter((entity,index)=>{
  const old=baseline.get(entity.id),label=doc.entityLabels?.[entity.id],oldLabel=saved?.entityLabels?.[entity.id]
  return !old||old.index!==index||entity.name!==old.entity.name||!sameFieldContent(entity.fields,old.entity.fields)||label!==oldLabel||!sameData(doc.labels?.find(v=>v.id===label),saved?.labels?.find(v=>v.id===oldLabel))
 }).map(entity=>entity.id))
}

function sameFieldContent(left:ClassDocument['entities'][number]['fields'],right:ClassDocument['entities'][number]['fields']):boolean{
 return left===right||left.length===right.length&&left.every((f,i)=>{const r=right[i];return f===r||f.key===r.key&&f.value===r.value&&f.functionOrigin?.name===r.functionOrigin?.name&&sameFieldContent(f.children,r.children)})
}
function sameDocumentContent(doc?:ClassDocument,old?:ClassDocument):boolean{
 if(doc===old)return true
 if(!doc||!old)return false
 return doc.name===old.name&&doc.fileName===old.fileName&&sameData(doc.schema,old.schema)&&sameData(doc.labels,old.labels)&&sameData(doc.entityLabels,old.entityLabels)&&doc.entities.length===old.entities.length&&doc.entities.every((e,i)=>e===old.entities[i]||e.name===old.entities[i].name&&sameFieldContent(e.fields,old.entities[i].fields))
}
