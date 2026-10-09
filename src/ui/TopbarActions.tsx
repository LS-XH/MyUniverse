import { useLayoutEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { FolderOpen, MoreHorizontal } from 'lucide-react'

function Icon({button}:{button:HTMLButtonElement}) {
  const slot=useRef<HTMLSpanElement>(null)
  useLayoutEffect(()=>{const svg=button.querySelector('svg');if(svg&&slot.current){const copy=svg.cloneNode(true) as SVGElement;copy.setAttribute('width','20');copy.setAttribute('height','20');slot.current.replaceChildren(copy)}},[button,button.innerHTML])
  return <span ref={slot} aria-hidden="true">{!button.querySelector('svg')&&<MoreHorizontal size={20}/>}</span>
}
// Invoke original page controls so imports, confirmation and disabled state stay shared.
export default function TopbarActions({revision,location,onReveal}:{revision:string;location?:string[]|null;onReveal?:()=>Promise<void>}) {
  const [revealing,setRevealing]=useState(false)
  const [actions,setActions]=useState<HTMLButtonElement[]>([])
  useLayoutEffect(()=>{
    const page=document.querySelector('.page-session');if(!page)return
    const gather=()=>setActions(Array.from(page.querySelectorAll<HTMLButtonElement>('.heading-actions button,.editor-file-actions button')))
    gather();const observer=new MutationObserver(gather);observer.observe(page,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-pressed','title']});return()=>observer.disconnect()
  },[revision])
  return <div className="topbar-page-actions">{location&&<button className="icon-button" disabled={!isTauri()||revealing} title={!isTauri()?'桌面版可打开文件所在位置':`打开文件所在位置：user/${location.join('/')}`} aria-label="打开文件所在位置" onClick={async()=>{if(!onReveal)return;setRevealing(true);try{await onReveal()}finally{setRevealing(false)}}}><FolderOpen size={20}/></button>}{actions.map((button,i)=>{const label=button.getAttribute('aria-label')||button.textContent?.trim()||button.title||'操作';return <button key={i} className={`icon-button ${button.classList.contains('danger')?'danger':''}`} title={label} aria-label={label} disabled={button.disabled} aria-pressed={button.hasAttribute('aria-pressed')?button.getAttribute('aria-pressed')==='true':undefined} onClick={()=>button.click()}><Icon button={button}/></button>})}</div>
}
