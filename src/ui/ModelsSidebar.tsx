import {isSystemFolder} from '../model/toolRoles'
import {isSystemAgent} from '../model/builtinAgents'
import AgentIcon from './AgentIcon'
import LibraryIcon from './LibraryIcon'
import LibraryFileIcon from './LibraryFileIcon'
import {useState} from 'react'
import {Bot,Folder,FolderCog,FolderPlus} from 'lucide-react'
import {ModelSection,Workspace} from '../model/types'
import {modelItems} from '../model/modelFolders'
import {orderedTreeEntries} from '../model/treeOrder'
import TreeDisclosure from './TreeDisclosure'
export const modelSectionNames:Record<ModelSection,string>={llm:'LLM 模型',sd:'Stable Diffusion 模型',agents:'Agent'}
export default function ModelsSidebar({workspace,section,selected,onSelect,folderId=null,onFolder,onAddFolder}:{workspace:Workspace;section:ModelSection;selected:string|null;onSelect:(section:ModelSection,id:string|null)=>void;folderId?:string|null;onFolder?:(section:ModelSection,id:string|null)=>void;onAddFolder?:(section:ModelSection,parentId:string|null)=>void}){
 const [open,setOpen]=useState<Record<string,boolean>>({})
 const folder=(kind:ModelSection,id:string|null,name:string):React.ReactNode=>{
  const key=`model:${kind}:folder:${id||'root'}`,expanded=open[key]!==false,items=modelItems(workspace,kind).filter(item=>(item.folderId||null)===id),folders=workspace.modelFolders?.filter(f=>f.section===kind&&f.parentId===id)||[],hasChildren=items.length+folders.length>0
  const toggle=()=>setOpen(value=>({...value,[key]:!expanded})),createName=kind==='llm'?'新建模型':kind==='sd'?'新建工作流':'新建Workflow 智能体'
  const children=expanded?orderedTreeEntries(workspace,[...folders.map(f=>({key:`model:${kind}:folder:${f.id}`,view:folder(kind,f.id,f.name)})),...items.map(item=>{
   const itemKey=`model:${kind}:item:${item.id}`
   return {key:itemKey,view:<div key={itemKey} data-tree-id={itemKey} className={`tree-row ui-tree-row--navigation ${kind===section&&selected===item.id?'active':''} ui-surface ui-tree-row`}><button className="tree-main ui-surface ui-button" data-context-actions={JSON.stringify('preset'in item&&item.preset?isSystemAgent(item)?[]:['删除 Agent']:kind==='llm'?['新建模型','删除模型']:['导入 JSON','导出','删除'])} onClick={()=>onSelect(kind,item.id)}>{kind==='llm'?<Bot size={16}/>:kind==='agents'?<AgentIcon agent={'preset'in item?item:undefined}/>:<LibraryFileIcon kind="sd"/>}<span>{item.name||'未命名'}</span></button></div>}
  })]):[]
  return <div className="tree-node ui-tree-node" key={key}><div data-tree-id={key} data-tree-folder="true" data-tree-readonly={!!id&&isSystemFolder(id)||undefined} className={`tree-row ui-tree-row--navigation ${section===kind&&!selected&&folderId===id?'active':''} ui-surface ui-tree-row`}><button className="tree-main ui-surface ui-button" data-context-actions={JSON.stringify(['新建文件夹',...(id&&!isSystemFolder(id)?['重命名','删除文件夹']:[]),createName,...(kind==='agents'?['新建 ReAct 智能体','新建高级智能体']:[])])} onClick={()=>onFolder?onFolder(kind,id):onSelect(kind,null)} onDoubleClick={toggle}>{id?(isSystemFolder(id)?<FolderCog size={16}/>:<Folder size={16}/>):<LibraryIcon kind={kind}/>}<span>{name}</span></button><button className="icon-button ui-button--icon ui-surface ui-button" title={`在${name}中新建文件夹`} onClick={()=>{setOpen(value=>({...value,[key]:true}));onAddFolder?.(kind,id)}}><FolderPlus size={15}/></button>{hasChildren&&<TreeDisclosure open={expanded} name={name} onToggle={toggle}/>}</div>{expanded&&hasChildren&&<div className="tree-branch ui-tree-branch">{children.map(c=>c.view)}</div>}</div>
 }
 return <div className="tree organized-tree models-sidebar-tree">{(['llm','sd','agents'] as const).map(kind=>folder(kind,null,modelSectionNames[kind]))}</div>
}
