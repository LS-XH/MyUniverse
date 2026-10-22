import ToolIcon from './ToolIcon'
import {isSystemFolder} from '../model/toolRoles'
import LibraryFileIcon from './LibraryFileIcon'
import LibraryIcon from './LibraryIcon'
import SkillTree,{SkillPart} from './SkillTree'
import {registeredTools,isBuiltinTool} from '../model/builtinTools'
import {orderedTreeEntries} from '../model/treeOrder'
import {useState} from 'react'
import {Folder,FolderCog,FolderPlus} from 'lucide-react'
import {pluginSectionNames} from '../model/pluginFolders'
import TreeDisclosure from './TreeDisclosure'
import {PluginSection,Workspace} from '../model/types'

export default function PluginTree({workspace,section,folderId,selectedFunction,selectedTool,selectedSkill,skillPart,skillEntry,onSkill,onTool,onFolder,onFunction,onAddFolder}:{workspace:Workspace;section:PluginSection;folderId:string|null;selectedFunction:string|null;selectedTool?:string|null;selectedSkill?:string|null;skillPart?:SkillPart;skillEntry?:string|null;onSkill?:(id:string,part?:SkillPart,entry?:string)=>void;onTool?:(id:string)=>void;onFolder:(section:PluginSection,id:string|null)=>void;onFunction:(id:string)=>void;onAddFolder:(section:PluginSection,parentId:string|null)=>void}){
 const [expanded,setExpanded]=useState<Record<string,boolean>>({}),tools=registeredTools(workspace)
 const children=(kind:PluginSection,parentId:string|null):React.ReactNode=>{
  const entries:{key:string;view:React.ReactNode}[]=(workspace.pluginFolders||[]).filter(f=>f.section===kind&&f.parentId===parentId).map(f=>({key:`plugin:${kind}:folder:${f.id}`,view:row(kind,f.id,f.name,false)}))
  if(kind==='functions')for(const fn of (workspace.functions||[]).filter(f=>(f.folderId||null)===parentId)){
   const key=`plugin:${kind}:function:${fn.id}`
   entries.push({key,view:<div data-tree-id={key} key={key} className={`tree-row ui-tree-row--navigation ${section===kind&&selectedFunction===fn.id?'active':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify(['导入脚本','删除函数'])} className="tree-main ui-surface ui-button" onClick={()=>onFunction(fn.id)}><LibraryFileIcon kind={fn.language}/><span>{fn.name}</span></button></div>})
  }
  if(kind==='skills')for(const skill of (workspace.skills||[]).filter(s=>(s.folderId||null)===parentId)){
   const key=`plugin:${kind}:skill:${skill.id}`
   entries.push({key,view:<SkillTree key={key} skill={skill} selected={section===kind&&selectedSkill===skill.id} part={skillPart} entry={skillEntry} onOpen={(part,entry)=>onSkill?.(skill.id,part,entry)}/>})
  }
  if(kind==='tools')for(const tool of tools.filter(t=>(t.folderId||null)===parentId)){
   const key=`plugin:${kind}:tool:${tool.id}`
   entries.push({key,view:<div data-tree-id={key} key={key} className={`tree-row ui-tree-row--navigation ${section===kind&&selectedTool===tool.id?'active':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify(isBuiltinTool(tool)?['新建 Tool']:['新建 Tool','删除 Tool'])} className="tree-main ui-surface ui-button" onClick={()=>onTool?.(tool.id)}><ToolIcon tool={tool}/><span>{tool.name}</span></button></div>})
  }
  return orderedTreeEntries(workspace,entries).map(e=>e.view)
 }
 const row=(kind:PluginSection,id:string,name:string,root:boolean):React.ReactNode=>{
  const parentId=root?null:id,key=`plugin:${kind}:folder:${root?'root':id}`,isOpen=expanded[key]!==false
  const hasChildren=(workspace.pluginFolders||[]).some(f=>f.section===kind&&f.parentId===parentId)||(kind==='functions'&&(workspace.functions||[]).some(f=>(f.folderId||null)===parentId))||(kind==='skills'&&(workspace.skills||[]).some(s=>(s.folderId||null)===parentId))||(kind==='tools'&&tools.some(t=>(t.folderId||null)===parentId))
  const toggle=()=>setExpanded(v=>({...v,[key]:!isOpen})),active=section===kind&&folderId===parentId&&!selectedFunction&&!selectedTool&&!selectedSkill
  return <div className="plugin-tree-node" key={key}><div data-tree-id={key} data-tree-folder="true" data-tree-readonly={!root&&isSystemFolder(id)||undefined} className={`tree-row ui-tree-row--navigation ${root?'plugin-root-row':''} ${active?'active':''} ui-surface ui-tree-row`}><button data-context-actions={JSON.stringify(['新建文件夹',...(!root&&!isSystemFolder(id)?['重命名','删除文件夹']:[]),...(kind==='functions'?['导入脚本','Flow 函数','Python 函数','JS 函数']:kind==='tools'?['新建 Tool']:['新建 Skill'])])} className="tree-main ui-surface ui-button" onClick={()=>onFolder(kind,parentId)} onDoubleClick={toggle}>{root?<LibraryIcon kind={kind}/>:isSystemFolder(id)?<FolderCog size={16}/>:<Folder size={16}/>}<span>{name}</span></button><button className="icon-button ui-button--icon plugin-folder-add ui-surface ui-button" title={`在${name}中新建文件夹`} onClick={()=>onAddFolder(kind,parentId)}><FolderPlus size={15}/></button>{hasChildren&&<TreeDisclosure open={isOpen} name={name} onToggle={toggle}/>}</div>{isOpen&&hasChildren&&<div className="plugin-tree-branch ui-tree-branch">{children(kind,parentId)}</div>}</div>
 }
 return <div className="tree organized-tree plugin-tree">{(['skills','functions','tools'] as const).map(kind=>row(kind,kind,pluginSectionNames[kind],true))}</div>
}
