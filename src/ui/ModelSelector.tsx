import AgentIcon from './AgentIcon'
import {useEffect,useRef,useState} from 'react'
import {Bot,Check,ChevronDown,Settings2} from 'lucide-react'
import {AgentDefinition,ChatTarget,ModelConnection} from '../model/types'
import {agentChatReason} from '../model/agents'
export default function ModelSelector({models,agents=[],value,onChange,onSettings,disabled=false,mode='agent'}:{mode?:'agent'|'model';models:ModelConnection[];agents?:AgentDefinition[];value:ChatTarget|string|null;onChange:(target:ChatTarget|null)=>void;onSettings:()=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
 const target=typeof value==='string'?{kind:'model' as const,id:value}:value
 const selected=target?.kind==='agent'?agents.find(a=>a.id===target.id):models.find(m=>m.id===target?.id)
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open])
 const choose=(kind:'model'|'agent',id:string)=>{onChange({kind,id});setOpen(false);trigger.current?.focus()}
 return <div className="chat-model-selector" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}}>
  <button ref={trigger} disabled={disabled} className="chat-model-trigger ui-button--model-picker ui-surface ui-button" aria-label={mode==='agent'?'选择 Agent':'选择模型'} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{target?.kind==='agent'?<AgentIcon agent={target?.kind==='agent'?agents.find(a=>a.id===target.id):undefined}/>:<Bot size={16}/>}<span>{selected?.name||(target?'所选对象已不存在':mode==='agent'?'选择 Agent':'选择模型')}{selected?.enabled===false?'（已停用）':''}</span><ChevronDown size={13}/></button>
  {open&&<div className="chat-model-menu ui-menu--model ui-surface ui-menu ui-menu--themed ui-surface--bordered" role="menu" aria-label={mode==='agent'?'聊天 Agent':'聊天模型'}>
   {mode==='model'&&<><div className="chat-model-menu-title">模型</div>{models.filter(m=>m.enabled).map(model=><button role="menuitemradio" aria-checked={target?.kind==='model'&&target.id===model.id} key={model.id} className="ui-surface ui-button ui-menu-item" onClick={()=>choose('model',model.id)}><Bot size={16}/><span><strong>{model.name}</strong><small>{model.model||'尚未填写模型标识'}</small></span>{target?.kind==='model'&&target.id===model.id&&<Check size={15}/>}</button>)}
   </>}{mode==='agent'&&<><div className="chat-model-menu-title">Agent</div>{agents.map(agent=>{const reason=agentChatReason(agent);return <button role="menuitemradio" aria-checked={target?.kind==='agent'&&target.id===agent.id} key={agent.id} disabled={!!reason} title={reason} className="ui-surface ui-button ui-menu-item" onClick={()=>choose('agent',agent.id)}><AgentIcon agent={agent}/><span><strong>{agent.name}</strong><small>{reason||agent.description||'使用 Agent 工作流中的模型'}</small></span>{target?.kind==='agent'&&target.id===agent.id&&<Check size={15}/>}</button>})}
   </>}{(mode==='model'?!models.length:!agents.length)&&<p>还没有模型或 Agent</p>}<button className="chat-model-settings ui-surface ui-button ui-menu-item" role="menuitem" onClick={()=>{setOpen(false);onSettings()}}><Settings2 size={16}/><span>管理模型与 Agent</span></button>
  </div>}
 </div>
}
