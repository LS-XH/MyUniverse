import {LocalWorkflowIcon} from './WorkflowIcon'
const SDIcon=({size=16}:{size?:number})=><LocalWorkflowIcon name="sd" size={size}/>
import { useState } from 'react'
import { Bot, Folder, Network } from 'lucide-react'
import { ModelSection, Workspace } from '../model/types'
import TreeDisclosure from './TreeDisclosure'

export const modelSectionNames:Record<ModelSection,string>={llm:'LLM 模型',sd:'Stable Diffusion 模型',agents:'Agent'}
export default function ModelsSidebar({workspace,section,selected,onSelect}:{workspace:Workspace;section:ModelSection;selected:string|null;onSelect:(section:ModelSection,id:string|null)=>void}) {
  const [open,setOpen]=useState({llm:true,sd:true,agents:true})
  const sections:ModelSection[]=['llm','sd','agents']
  return <div className="tree models-sidebar-tree">{sections.map(key=>{const items=key==='llm'?workspace.models||[]:key==='sd'?workspace.sdWorkflows||[]:workspace.agents||[],Icon=key==='llm'?Bot:key==='sd'?SDIcon:Network;return <div className="tree-node" key={key}><div className={`tree-row ${key===section&&!selected?'active':''}`}><button data-context-actions={JSON.stringify([key==='llm'?'新建模型':key==='sd'?'新建工作流':'新建智能体'])} className="tree-main" onClick={()=>onSelect(key,null)} onDoubleClick={()=>setOpen({...open,[key]:!open[key]})}><Folder size={17}/><span>{modelSectionNames[key]}</span><small>{items.length}</small></button><TreeDisclosure open={open[key]} name={modelSectionNames[key]} onToggle={()=>setOpen({...open,[key]:!open[key]})}/></div>{open[key]&&<div className="tree-branch">{items.map(item=><div className={`tree-row ${key===section&&selected===item.id?'active':''}`} key={item.id}><button data-context-actions={JSON.stringify(key==='llm'?['新建模型','删除模型']:['导入 JSON','导出','删除'])} className="tree-main model-nav-row" onClick={()=>onSelect(key,item.id)}><Icon size={16}/><span>{item.name||'未命名'}</span></button></div>)}</div>}</div>})}</div>
}
