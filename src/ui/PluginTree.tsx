import { useState } from 'react'
import { FileCode2, Folder, FolderPlus, Wrench } from 'lucide-react'
import { pluginSectionNames } from '../model/pluginFolders'
import TreeDisclosure from './TreeDisclosure'
import { PluginSection, Workspace } from '../model/types'

export default function PluginTree({workspace,section,folderId,selectedFunction,selectedTool,onTool,onFolder,onFunction,onAddFolder}:{workspace:Workspace;section:PluginSection;folderId:string|null;selectedFunction:string|null;selectedTool?:string|null;onTool?:(id:string)=>void;onFolder:(section:PluginSection,id:string|null)=>void;onFunction:(id:string)=>void;onAddFolder:(section:PluginSection,parentId:string|null)=>void}) {
  const [expanded,setExpanded]=useState<Record<string,boolean>>({skills:true,functions:true,tools:true})
  const children=(kind:PluginSection,parentId:string|null):React.ReactNode=><>{(workspace.pluginFolders||[]).filter(f=>f.section===kind&&f.parentId===parentId).map(folder=>row(kind,folder.id,folder.name,false))}{kind==='functions'&&(workspace.functions||[]).filter(fn=>(fn.folderId||null)===parentId).map(fn=><div key={fn.id} className={`tree-row ${section===kind&&selectedFunction===fn.id?'active':''}`}><button data-context-actions={JSON.stringify(['导入脚本','删除函数'])} className="tree-main" onClick={()=>onFunction(fn.id)}><FileCode2 size={16}/><span>{fn.name}</span></button></div>)}{kind==='tools'&&(workspace.tools||[]).filter(tool=>(tool.folderId||null)===parentId).map(tool=><div key={tool.id} className={`tree-row ${section===kind&&selectedTool===tool.id?'active':''}`}><button data-context-actions={JSON.stringify(['新建 Tool','删除 Tool'])} className="tree-main" onClick={()=>onTool?.(tool.id)}><Wrench size={16}/><span>{tool.name}</span></button></div>)}</>
  const row=(kind:PluginSection,id:string,name:string,root:boolean)=>{
    const parentId=root?null:id,isOpen=expanded[id]!==false
    const hasChildren=(workspace.pluginFolders||[]).some(f=>f.section===kind&&f.parentId===parentId)||(kind==='functions'&&(workspace.functions||[]).some(fn=>(fn.folderId||null)===parentId))||(kind==='tools'&&(workspace.tools||[]).some(tool=>(tool.folderId||null)===parentId))
    const active=section===kind&&folderId===parentId&&!selectedFunction&&!selectedTool
    const toggle=()=>setExpanded(previous=>({...previous,[id]:!isOpen}))
    return <div className="plugin-tree-node" key={id}><div className={`tree-row ${root?'plugin-root-row':''} ${active?'active':''}`}><button data-context-actions={JSON.stringify(['新建文件夹',...(!root?['重命名','删除文件夹']:[]),...(kind==='functions'?['导入脚本','Flow 函数','Python 函数','JS 函数']:kind==='tools'?['新建 Tool']:[])])} className="tree-main" onClick={()=>onFolder(kind,parentId)} onDoubleClick={toggle}><Folder size={16}/><span>{name}</span></button><button className="icon-button plugin-folder-add" title={`在${name}中新建文件夹`} onClick={()=>onAddFolder(kind,parentId)}><FolderPlus size={15}/></button><TreeDisclosure open={isOpen} name={name} onToggle={toggle}/></div>{isOpen&&hasChildren&&<div className="plugin-tree-branch">{children(kind,parentId)}</div>}</div>
  }
  return <div className="tree plugin-tree">{(['skills','functions','tools'] as const).map(kind=>row(kind,kind,pluginSectionNames[kind],true))}</div>
}
