import { PluginFolder, PluginSection, Workspace, uid } from './types'

export const pluginSectionNames:Record<PluginSection,string>={skills:'技能',functions:'函数',tools:'工具'}
export function createPluginFolder(workspace:Workspace,section:PluginSection,parentId:string|null,name:string):PluginFolder {
  if(parentId&&!workspace.pluginFolders?.some(f=>f.id===parentId&&f.section===section))throw new Error('父文件夹不存在')
  const siblings=(workspace.pluginFolders||[]).filter(f=>f.section===section&&f.parentId===parentId)
  const base=name.trim()||'新文件夹';let unique=base,n=2;while(siblings.some(f=>f.name===unique))unique=`${base}${n++}`
  return {id:uid(),name:unique,section,parentId}
}
export function pluginFolderPath(workspace:Workspace,id:string|null):PluginFolder[] {
  const path:PluginFolder[]=[],seen=new Set<string>();let current=id
  while(current&&!seen.has(current)){seen.add(current);const folder=workspace.pluginFolders?.find(f=>f.id===current);if(!folder)break;path.unshift(folder);current=folder.parentId}
  return path
}
export function removePluginFolder(workspace:Workspace,id:string):Workspace {
  const folder=workspace.pluginFolders?.find(f=>f.id===id);if(!folder)return workspace
  return {...workspace,pluginFolders:workspace.pluginFolders?.filter(f=>f.id!==id).map(f=>f.parentId===id?{...f,parentId:folder.parentId}:f),functions:workspace.functions?.map(fn=>fn.folderId===id?{...fn,folderId:folder.parentId}:fn)}
}
