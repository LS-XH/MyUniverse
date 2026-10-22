import {useEffect,useId,useRef,useState} from 'react'
import {ChevronDown,Plus} from 'lucide-react'
import PickerMenu from './PickerMenu'
import {jsFunctionTemplates,type JsFunctionTemplateId} from '../model/bundledRelationshipScripts'

export default function JsFunctionCreateMenu({onCreate}:{onCreate:(template:JsFunctionTemplateId)=>void}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId()
 const close=()=>{setOpen(false);trigger.current?.focus()}
 useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus());return()=>cancelAnimationFrame(frame)},[open])
 return <div className="js-function-create">
  <button ref={trigger} type="button" className="primary ui-button--primary ui-surface ui-button ui-button--standard ui-button--elevated" aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true)}}}><Plus size={16}/> JS 函数<ChevronDown size={14}/></button>
  {open&&<PickerMenu align="end" preferredWidth={300} onClose={close}><div ref={menu} id={id} role="menu" aria-label="创建 JS 脚本" onKeyDown={event=>{
   const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')],index=buttons.indexOf(document.activeElement as HTMLButtonElement)
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
   else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
  }}>{jsFunctionTemplates.map(template=><button key={template.id} type="button" role="menuitem" className="ui-reference-option ui-surface ui-button ui-menu-item" onClick={()=>{setOpen(false);onCreate(template.id)}}>{template.label}</button>)}</div></PickerMenu>}
 </div>
}
