import { useEffect, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, Settings2 } from 'lucide-react'
import { ModelConnection } from '../model/types'

export default function ModelSelector({models,value,onChange,onSettings}:{models:ModelConnection[];value:string|null;onChange:(id:string|null)=>void;onSettings:()=>void}){
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
  const available=models.filter(model=>model.enabled),selected=models.find(model=>model.id===value)
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open])
  return <div className="chat-model-selector" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}}><button ref={trigger} className="chat-model-trigger" aria-label="选择聊天模型" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}><Bot size={16}/><span>{selected?.name||'选择模型'}{selected&&!selected.enabled?'（已停用）':''}</span><ChevronDown size={13}/></button>{open&&<div className="chat-model-menu" role="menu" aria-label="聊天模型"><div className="chat-model-menu-title">选择模型</div>{available.length?available.map(model=><button role="menuitemradio" aria-checked={value===model.id} key={model.id} onClick={()=>{onChange(model.id);setOpen(false);trigger.current?.focus()}}><Bot size={16}/><span><strong>{model.name||'未命名模型'}</strong><small>{model.model||'尚未填写模型标识'}</small></span>{value===model.id&&<Check size={15}/>}</button>):<p>还没有可用模型</p>}<button className="chat-model-settings" role="menuitem" onClick={()=>{setOpen(false);onSettings()}}><Settings2 size={16}/><span>管理模型</span></button></div>}</div>
}
