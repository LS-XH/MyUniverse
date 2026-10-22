import { useLayoutEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { Save, SaveAll, RefreshCw, FolderOpen, MoreHorizontal } from 'lucide-react'

function Icon({button}:{button:HTMLButtonElement}) {
  const slot=useRef<HTMLSpanElement>(null)
  useLayoutEffect(()=>{const svg=button.querySelector('svg');if(svg&&slot.current){const copy=svg.cloneNode(true) as SVGElement;copy.setAttribute('width','20');copy.setAttribute('height','20');slot.current.replaceChildren(copy)}},[button,button.innerHTML])
  return <span ref={slot} aria-hidden="true">{!button.querySelector('svg')&&<MoreHorizontal size={20}/>}</span>
}
// Invoke original page controls so imports, confirmation and disabled state stay shared.
export default function TopbarActions({revision,location,onReveal,fileActions,saveAll}:{revision:string;location?:string[]|null;onReveal?:()=>Promise<void>;fileActions?:{save:()=>void;refresh:()=>void;busy:boolean};saveAll?:{run:()=>void;disabled:boolean}}) {
  const [revealing,setRevealing]=useState(false)
  const [actions,setActions]=useState<HTMLButtonElement[]>([])
  const signature=useRef('')
  useLayoutEffect(()=>{
    const page=document.querySelector('.page-session');if(!page)return
    const gather=()=>{
      const order=['重新计算函数','填入 MD','导入 MD']
      const rank=(button:HTMLButtonElement)=>{const index=order.indexOf(button.textContent?.trim()||'');return index<0?order.length:index}
      const buttons=Array.from(page.querySelectorAll<HTMLButtonElement>('.heading-actions button,.editor-file-actions button')).sort((a,b)=>rank(a)-rank(b))
      const key=JSON.stringify(buttons.map(b=>[b.textContent,b.disabled,b.title,b.getAttribute('aria-pressed')]))
      const changed=signature.current!==key;signature.current=key
      setActions(previous=>!changed&&previous.length===buttons.length&&previous.every((b,i)=>b===buttons[i])?previous:buttons)
    }
    gather();const observer=new MutationObserver(records=>{
      if(records.every(record=>record.target instanceof Element&&record.target.closest('.markdown-source-editor,.entity-fields,.entity-header')))return
      gather()
    });observer.observe(page,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-pressed','title']});return()=>observer.disconnect()
  },[revision])
  const localBusy=actions.some(button=>button.textContent?.trim()==='导入 MD'&&button.disabled)
  return <div className="topbar-page-actions">{location&&<button className="icon-button ui-button--icon ui-surface ui-button ui-button--topbar-icon" disabled={!isTauri()||revealing} title={!isTauri()?'桌面版可打开文件所在位置':`打开文件所在位置：user/${location.join('/')}`} aria-label="打开文件所在位置" onClick={async()=>{if(!onReveal)return;setRevealing(true);try{await onReveal()}finally{setRevealing(false)}}}><FolderOpen size={20}/></button>}{actions.map((button,i)=>{const label=button.getAttribute('aria-label')||button.textContent?.trim()||button.title||'操作';return <button key={i} className={`icon-button ui-button--icon ${button.classList.contains('danger')?'danger':''} ui-surface ui-button ui-button--topbar-icon`} title={label} aria-label={label} disabled={button.disabled} aria-pressed={button.hasAttribute('aria-pressed')?button.getAttribute('aria-pressed')==='true':undefined} onClick={()=>button.click()}><Icon button={button}/></button>})}{fileActions&&<><button className="icon-button ui-button--icon ui-surface ui-button ui-button--topbar-icon" disabled={fileActions.busy||localBusy} aria-label="刷新当前文件" title="刷新（Ctrl+R）：读取当前 MD 更新 JSON，保留匹配成员的函数来源，不计算函数" onClick={fileActions.refresh}><RefreshCw size={20}/></button><button className="icon-button ui-button--icon ui-surface ui-button ui-button--topbar-icon" disabled={fileActions.busy||localBusy} aria-label="保存当前文件" title="导出当前文件（Ctrl+S），对象已自动存档至 JSON" onClick={fileActions.save}><Save size={20}/></button></>}{saveAll&&<button className="global-save-all icon-button ui-button--icon ui-surface ui-button ui-button--topbar-icon" aria-label="保存全部文件" title="保存全部文件" disabled={saveAll.disabled||localBusy} onClick={saveAll.run}><SaveAll size={20}/></button>}</div>
}
