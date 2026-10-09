import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

function ActionIcon({button}:{button:HTMLButtonElement}) {
  const slot=useRef<HTMLSpanElement>(null),source=button.querySelector('svg')
  useLayoutEffect(()=>{if(source&&slot.current){const icon=source.cloneNode(true) as SVGElement;icon.setAttribute('width','16');icon.setAttribute('height','16');icon.setAttribute('aria-hidden','true');slot.current.replaceChildren(icon)}},[source])
  return <span className="sidebar-action-icon" aria-hidden="true" ref={slot}>{!source&&<MoreHorizontal size={16}/>}</span>
}

// Use the actual current toolbar controls, so menus keep the same disabled,
// toggle, import and confirmation behavior as the corresponding page.
export default function SidebarActions({position,revision,onClose}:{position:{x:number;y:number}|null;revision:string;onClose:()=>void}) {
  const [actions,setActions]=useState<HTMLButtonElement[]>([]),menu=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    if(!position)return
    const gather=()=>setActions(Array.from(document.querySelectorAll<HTMLButtonElement>('.topbar .markdown-toggle,.page-session .page-heading button,.page-session .heading-actions button,.page-session .graph-tools button,.page-session .add-schema,.page-session .function-settings .danger,.page-session .map-zoom button')).filter((button,index,all)=>all.indexOf(button)===index))
    gather()
    const observer=new MutationObserver(gather),main=document.querySelector('.main-area')
    if(main)observer.observe(main,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[position,revision])
  useEffect(()=>{if(!position)return;const dismiss=(event:PointerEvent)=>{if(!(event.target as HTMLElement).closest('.sidebar,.sidebar-object-menu'))onClose()},escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};document.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',escape);menu.current?.focus();return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',escape)}},[position,onClose])
  if(!position)return null
  return <div className="sidebar-object-menu" role="menu" aria-label="对象操作" tabIndex={-1} ref={menu} style={{left:Math.min(position.x,window.innerWidth-240),top:Math.max(8,Math.min(position.y,window.innerHeight- Math.min(420,actions.length*38+44)))}}>
    <strong>页面操作</strong>{actions.length?actions.map((button,index)=><button role="menuitem" className={button.classList.contains('danger')?'danger':''} key={index} disabled={button.disabled} onClick={()=>{onClose();button.click()}}><ActionIcon button={button}/><span className="sidebar-action-label">{button.getAttribute('aria-label')||button.textContent?.trim()||button.title||'操作'}</span>{button.hasAttribute('aria-pressed')&&<small>{button.getAttribute('aria-pressed')==='true'?'已开启':'已关闭'}</small>}</button>):<span className="muted">此页面暂无快捷操作</span>}
  </div>
}
