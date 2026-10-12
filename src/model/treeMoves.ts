import { Workspace } from './types'

export function moveTreeItem(workspace:Workspace,source:string,target:string,inside:boolean,after:boolean):Workspace {
  if(source===target)return workspace
  const [scope,group,kind,id]=source.split(':'),[targetScope,targetGroup,targetKind,targetId]=target.split(':')
  if(scope!==targetScope)return workspace
  if(scope==='world'&&kind==='root'&&targetKind==='root'&&!inside){const worlds=[...workspace.worlds],item=worlds.find(w=>w.id===group);if(!item)return workspace;const rest=worlds.filter(w=>w.id!==group),index=rest.findIndex(w=>w.id===targetGroup);if(index<0)return workspace;rest.splice(index+(after?1:0),0,item);return {...workspace,worlds:rest}}
  if(group!==targetGroup)return workspace
  const reorder=<T extends {id:string}>(items:T[],sourceId:string,targetId:string,patch:Partial<T>):T[]=>{
    const item=items.find(i=>i.id===sourceId);if(!item)return items
    const rest=items.filter(i=>i.id!==sourceId),index=rest.findIndex(i=>i.id===targetId)
    rest.splice(index<0?rest.length:index+(after?1:0),0,{...item,...patch});return rest
  }
  if(scope==='world')return {...workspace,worlds:workspace.worlds.map(world=>{
    if(world.id!==group||kind==='root')return world
    const item=world.nodes.find(n=>n.id===kind),destination=world.nodes.find(n=>n.id===targetKind)
    if(!item||(!destination&&targetKind!=='root')||(inside&&destination?.type!=='collection'&&targetKind!=='root'))return world
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
    if(!['llm','sd','agents'].includes(group)||inside)return workspace
    const key=group==='llm'?'models':group==='sd'?'sdWorkflows':'agents'
    const items: {id:string}[]=workspace[key]||[]
    if(!items.some(item=>item.id===kind)||!items.some(item=>item.id===targetKind))return workspace
    return {...workspace,[key]:reorder(items,kind,targetKind,{})}
  }
  if(scope!=='plugin'||id==='root')return workspace
  const exists=(kind:string,id:string)=>kind==='folder'?id==='root'||workspace.pluginFolders?.some(f=>f.id===id&&f.section===group):kind==='function'?group==='functions'&&workspace.functions?.some(f=>f.id===id):kind==='tool'?group==='tools'&&workspace.tools?.some(t=>t.id===id):false
  if(!exists(kind,id)||!exists(targetKind,targetId))return workspace
  const keys=[...(workspace.pluginFolders||[]).map(f=>`plugin:${f.section}:folder:${f.id}`),...(workspace.functions||[]).map(f=>`plugin:functions:function:${f.id}`),...(workspace.tools||[]).map(t=>`plugin:tools:tool:${t.id}`)]
  const ordered=[...(workspace.sidebarTreeOrder||[]).filter(k=>keys.includes(k)),...keys.filter(k=>!workspace.sidebarTreeOrder?.includes(k))].filter(k=>k!==source)
  const slot=ordered.indexOf(target);ordered.splice(slot<0?ordered.length:slot+(after?1:0),0,source)
  const withOrder={...workspace,sidebarTreeOrder:ordered}
  const folders=workspace.pluginFolders||[],destination=folders.find(f=>f.id===targetId)
  if(inside&&targetKind!=='folder')return workspace
  const parentId=inside?(targetId==='root'?null:targetId):targetKind==='folder'?destination?.parentId||null:targetKind==='function'?workspace.functions?.find(f=>f.id===targetId)?.folderId||null:workspace.tools?.find(t=>t.id===targetId)?.folderId||null
  if(kind==='folder'){
    let ancestor=parentId;const seen=new Set<string>()
    while(ancestor){if(ancestor===id||seen.has(ancestor))return workspace;seen.add(ancestor);ancestor=folders.find(f=>f.id===ancestor)?.parentId||null}
    return {...withOrder,pluginFolders:reorder(folders,id,targetId,{parentId})}
  }
  if(kind==='function')return {...withOrder,functions:reorder(workspace.functions||[],id,targetId,{folderId:parentId})}
  return {...withOrder,tools:reorder(workspace.tools||[],id,targetId,{folderId:parentId})}
}
