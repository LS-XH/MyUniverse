import {isSystemFolder} from './toolRoles'
import {ModelFolder,ModelSection,Workspace,uid} from './types'
export const modelItems=(workspace:Workspace,section:ModelSection)=>section==='llm'?workspace.models||[]:section==='sd'?workspace.sdWorkflows||[]:workspace.agents||[]
export function modelFolderPath(workspace:Workspace,id:string|null):ModelFolder[]{const path:ModelFolder[]=[],seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);const f=workspace.modelFolders?.find(f=>f.id===id);if(!f)break;path.unshift(f);id=f.parentId}return path}
export function createModelFolder(workspace:Workspace,section:ModelSection,parentId:string|null,name:string):ModelFolder {
 if(parentId&&!workspace.modelFolders?.some(f=>f.id===parentId&&f.section===section))throw new Error('父目录不存在')
 let label=name.trim()||'新文件夹',n=2;while(workspace.modelFolders?.some(f=>f.section===section&&f.parentId===parentId&&f.name===label))label=`${name.trim()||'新文件夹'} ${n++}`
 return {id:uid(),section,parentId,name:label}
}
export function removeModelFolder(workspace:Workspace,id:string):Workspace {
 const folder=workspace.modelFolders?.find(f=>f.id===id);if(!folder||isSystemFolder(id))return workspace
 const move=<T extends {folderId?:string|null}>(items:T[]|undefined)=>items?.map(item=>item.folderId===id?{...item,folderId:folder.parentId}:item)
 return {...workspace,modelFolders:workspace.modelFolders?.filter(f=>f.id!==id).map(f=>f.parentId===id?{...f,parentId:folder.parentId}:f),models:move(workspace.models),agents:move(workspace.agents),sdWorkflows:move(workspace.sdWorkflows)}
}
