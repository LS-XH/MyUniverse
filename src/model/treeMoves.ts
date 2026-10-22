import {isSystemFolder} from './toolRoles'
import { Workspace } from './types'

export function moveTreeItem(workspace:Workspace,source:string,target:string,inside:boolean,after:boolean):Workspace {
  if(source===target)return workspace
  const [scope,group,kind,...sourceId]=source.split(':'),[targetScope,targetGroup,targetKind,...destinationId]=target.split(':')
  const id=sourceId.join(':'),targetId=destinationId.join(':')
  if((scope==='plugin'||scope==='model')&&kind==='folder'&&isSystemFolder(id))return workspace
  if(scope!==targetScope)return workspace
  if(scope==='world'&&kind==='root'&&targetKind==='root'&&!inside){const worlds=[...workspace.worlds],item=worlds.find(w=>w.id===group);if(!item)return workspace;const rest=worlds.filter(w=>w.id!==group),index=rest.findIndex(w=>w.id===targetGroup);if(index<0)return workspace;rest.splice(index+(after?1:0),0,item);return {...workspace,worlds:rest}}
  if(group!==targetGroup)return workspace
  const reorder=<T extends {id:string}>(items:T[],sourceId:string,targetId:string,patch:Partial<T>):T[]=>{
    const item=items.find(i=>i.id===sourceId);if(!item)return items
    const rest=items.filter(i=>i.id!==sourceId),index=rest.findIndex(i=>i.id===targetId)
    const parentKey='parentId' in patch?'parentId':'folderId',destination=(patch as Record<string,unknown>)[parentKey],section=(item as Record<string,unknown>).section
    const child=inside?rest.findIndex(entry=>((entry as Record<string,unknown>)[parentKey]||null)===(destination||null)&&(entry as Record<string,unknown>).section===section):-1
    rest.splice(inside?(child<0?rest.length:child):index<0?rest.length:index+(after?1:0),0,{...item,...patch});return rest
  }
  if(scope==='world')return {...workspace,worlds:workspace.worlds.map(world=>{
    if(world.id!==group||kind==='root')return world
    const item=world.nodes.find(n=>n.id===kind),destination=world.nodes.find(n=>n.id===targetKind)
    if(!item||item.type==='collection'&&item.protected||(!destination&&targetKind!=='root')||(inside&&destination?.type!=='collection'&&targetKind!=='root'))return world
    const parentId=inside?(targetKind==='root'?null:targetKind):destination?.parentId||null
    // Data views stay under their source file; other objects cannot enter a file.
    const view=world.views?.[item.id],parent=world.nodes.find(n=>n.id===parentId)
    if(view&&parentId!==world.nodes.find(n=>n.type==='file'&&n.classId===view.parentClassId)?.id)return world
    if(parent?.type==='file'&&!view)return world
    let ancestor=parentId;const seen=new Set<string>()
    while(ancestor){if(ancestor===item.id||seen.has(ancestor))return world;seen.add(ancestor);ancestor=world.nodes.find(n=>n.id===ancestor)?.parentId||null}
    return {...world,nodes:reorder(world.nodes,item.id,targetKind,{parentId})}
  })}
  if(scope==='model') {
    if(!['llm','sd','agents'].includes(group))return workspace
    const key=group==='llm'?'models':group==='sd'?'sdWorkflows':'agents',items:{id:string;folderId?:string|null}[]=workspace[key]||[]
    // Read legacy flat tree keys too; new keys distinguish folders and entries.
    const sourceKind=kind==='folder'?'folder':'item',sourceItem=kind==='folder'||kind==='item'?id:kind,targetType=targetKind==='folder'?'folder':'item',targetItem=targetKind==='folder'||targetKind==='item'?targetId:targetKind
    const folders=workspace.modelFolders||[],exists=(type:string,item:string)=>type==='folder'?item==='root'||folders.some(f=>f.section===group&&f.id===item):items.some(itemValue=>itemValue.id===item)
    if(sourceItem==='root'||!exists(sourceKind,sourceItem)||!exists(targetType,targetItem)||inside&&targetType!=='folder')return workspace
    const destination=folders.find(f=>f.id===targetItem),parentId=inside?(targetItem==='root'?null:targetItem):targetType==='folder'?destination?.parentId||null:items.find(i=>i.id===targetItem)?.folderId||null
    if(sourceKind==='folder'){let ancestor=parentId;const seen=new Set<string>();while(ancestor){if(ancestor===sourceItem||seen.has(ancestor))return workspace;seen.add(ancestor);ancestor=folders.find(f=>f.id===ancestor)?.parentId||null}}
    const keys=[...folders.map(f=>`model:${f.section}:folder:${f.id}`),...items.map(item=>`model:${group}:item:${item.id}`)]
    const ordered=[...(workspace.sidebarTreeOrder||[]),...keys.filter(k=>!workspace.sidebarTreeOrder?.includes(k))].filter(k=>k!==source),slot=ordered.indexOf(target)
    ordered.splice(slot<0?ordered.length:slot+(after?1:0),0,source)
    if(inside){ordered.splice(ordered.indexOf(source),1);const child=ordered.findIndex(k=>{const [scope,section,type,...rest]=k.split(':');if(scope!=='model'||section!==group)return false;const id=rest.join(':');return type==='folder'?folders.some(f=>f.id===id&&(f.parentId||null)===parentId):items.some(i=>i.id===id&&(i.folderId||null)===parentId)});ordered.splice(child<0?ordered.length:child,0,source)}
    return sourceKind==='folder'?{...workspace,sidebarTreeOrder:ordered,modelFolders:reorder(folders,sourceItem,targetItem,{parentId})}:{...workspace,sidebarTreeOrder:ordered,[key]:reorder(items,sourceItem,targetItem,{folderId:parentId})}
  }
  if(scope!=='plugin'||id==='root')return workspace
  const exists=(kind:string,id:string)=>kind==='folder'?id==='root'||workspace.pluginFolders?.some(f=>f.id===id&&f.section===group):kind==='function'?group==='functions'&&workspace.functions?.some(f=>f.id===id):kind==='tool'?group==='tools'&&workspace.tools?.some(t=>t.id===id):kind==='skill'?group==='skills'&&workspace.skills?.some(s=>s.id===id):false
  if(!exists(kind,id)||!exists(targetKind,targetId))return workspace
  const keys=[...(workspace.pluginFolders||[]).map(f=>`plugin:${f.section}:folder:${f.id}`),...(workspace.skills||[]).map(s=>`plugin:skills:skill:${s.id}`),...(workspace.functions||[]).map(f=>`plugin:functions:function:${f.id}`),...(workspace.tools||[]).map(t=>`plugin:tools:tool:${t.id}`)]
  const ordered=[...(workspace.sidebarTreeOrder||[]),...keys.filter(k=>!workspace.sidebarTreeOrder?.includes(k))].filter(k=>k!==source)
  const slot=ordered.indexOf(target);ordered.splice(slot<0?ordered.length:slot+(after?1:0),0,source)
  const withOrder={...workspace,sidebarTreeOrder:ordered}
  const folders=workspace.pluginFolders||[],destination=folders.find(f=>f.id===targetId)
  if(inside&&targetKind!=='folder')return workspace
  const parentId=inside?(targetId==='root'?null:targetId):targetKind==='folder'?destination?.parentId||null:targetKind==='skill'?workspace.skills?.find(s=>s.id===targetId)?.folderId||null:targetKind==='function'?workspace.functions?.find(f=>f.id===targetId)?.folderId||null:workspace.tools?.find(t=>t.id===targetId)?.folderId||null
  if(inside){ordered.splice(ordered.indexOf(source),1);const child=ordered.findIndex(k=>{const [scope,section,type,...rest]=k.split(':');if(scope!=='plugin'||section!==group)return false;const key=rest.join(':');if(type==='folder')return folders.some(f=>f.id===key&&(f.parentId||null)===parentId);const list=type==='skill'?workspace.skills:type==='function'?workspace.functions:workspace.tools;return list?.some(i=>i.id===key&&(i.folderId||null)===parentId)});ordered.splice(child<0?ordered.length:child,0,source)}
  if(kind==='folder'){
    let ancestor=parentId;const seen=new Set<string>()
    while(ancestor){if(ancestor===id||seen.has(ancestor))return workspace;seen.add(ancestor);ancestor=folders.find(f=>f.id===ancestor)?.parentId||null}
    return {...withOrder,pluginFolders:reorder(folders,id,targetId,{parentId})}
  }
  if(kind==='skill')return {...withOrder,skills:reorder(workspace.skills||[],id,targetId,{folderId:parentId})}
  if(kind==='function')return {...withOrder,functions:reorder(workspace.functions||[],id,targetId,{folderId:parentId})}
  return {...withOrder,tools:reorder(workspace.tools||[],id,targetId,{folderId:parentId})}
}
