import { useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { sortOffsets } from '../model/sortGeometry'

export function reorder<T extends {id:string}>(items:T[],from:string,to:string,after:boolean):T[] {
  if(from===to||!items.some(item=>item.id===from)||!items.some(item=>item.id===to))return items
  const item=items.find(item=>item.id===from)!,next=items.filter(item=>item.id!==from)
  next.splice(next.findIndex(item=>item.id===to)+(after?1:0),0,item)
  return next.every((item,i)=>item===items[i])?items:next
}

/** Pointer sorting avoids the desktop WebView's native file-drop interception. */
export default function SortHandle({id,onMove}:{id:string;onMove:(from:string,to:string,after:boolean)=>void}) {
  const cleanup=useRef<(()=>void)|null>(null),callback=useRef(onMove)
  callback.current=onMove
  const [dragging,setDragging]=useState(false)
  useEffect(()=>()=>cleanup.current?.(),[])
  return <button type="button" className={`schema-grip sort-handle ${dragging?'is-dragging':''}`} title="拖动调整顺序；方向键上下移动" aria-label="调整顺序" onKeyDown={e=>{
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return
    e.preventDefault()
    const row=e.currentTarget.closest<HTMLElement>('[data-sort-id]'),siblings=Array.from(row?.parentElement?.children||[]).filter(el=>el.hasAttribute('data-sort-id'))
    const target=siblings[siblings.indexOf(row!)+(e.key==='ArrowUp'?-1:1)] as HTMLElement|undefined
    if(target)onMove(id,target.dataset.sortId!,e.key==='ArrowDown')
  }} onPointerDown={e=>{
    if(e.button!==0)return
    e.preventDefault();e.stopPropagation();cleanup.current?.()
    const handle=e.currentTarget,row=handle.closest<HTMLElement>('[data-sort-id]')!,parent=row.parentElement!,start={x:e.clientX,y:e.clientY},pointer=e.pointerId
    const siblings=Array.from(parent.children).filter(el=>el.hasAttribute('data-sort-id')) as HTMLElement[]
    const from=siblings.indexOf(row),rects=siblings.map(el=>el.getBoundingClientRect()),rect=rects[from]
    const gap=rects.length>1?Math.max(0,rects[1].top-rects[0].bottom):0
    const saved=siblings.map(el=>({transform:el.style.transform,transition:el.style.transition})),parentPosition=parent.style.position
    const scroller=row.closest<HTMLElement>('.entity-list,.page-scroll'),initialScroll=scroller?.scrollTop||0
    const grab={x:start.x-rect.left,y:start.y-rect.top}
    let active=false,target:HTMLElement|null=null,after=false,frame=0,x=start.x,y=start.y,slot=from,ghost:HTMLElement|null=null,placeholder:HTMLElement|null=null
    const createPreview=()=>{
      ghost=row.cloneNode(true) as HTMLElement
      ghost.classList.add('sort-ghost');ghost.removeAttribute('data-sort-id');ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.inert=true
      // cloneNode does not reliably copy live textarea/select values.
      const originals=row.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select')
      ghost.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select').forEach((el,i)=>{el.value=originals[i].value;if(el instanceof HTMLInputElement&&originals[i] instanceof HTMLInputElement)el.checked=(originals[i] as HTMLInputElement).checked})
      ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'))
      ghost.querySelectorAll('[data-sort-id]').forEach(el=>el.removeAttribute('data-sort-id'))
      const theme=getComputedStyle(row.closest('.app-shell')||row)
      for(let i=0;i<theme.length;i++){const key=theme[i];if(key.startsWith('--'))ghost.style.setProperty(key,theme.getPropertyValue(key))}
      Object.assign(ghost.style,{width:`${rect.width}px`,height:`${rect.height}px`,left:'0px',top:'0px'})
      placeholder=document.createElement('div');placeholder.className='sort-placeholder';placeholder.setAttribute('aria-hidden','true')
      Object.assign(placeholder.style,{position:'absolute',height:`${rect.height}px`,width:`${rect.width}px`,pointerEvents:'none'})
      // Attach the slot to its list so it shares its theme and scroll position.
      parent.style.position ||= 'relative';parent.appendChild(placeholder)
      document.body.appendChild(ghost);row.classList.add('sort-lifted');document.body.classList.add('sorting-active')
      siblings.forEach(el=>{el.style.transition=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'none':'transform .18s cubic-bezier(.2,.8,.2,1)'})
    }
    const mark=()=>{
      const scroll=(scroller?.scrollTop||0)-initialScroll,candidates=siblings.filter(el=>el!==row)
      let insertion=candidates.findIndex(el=>{const index=siblings.indexOf(el);return y<rects[index].top-scroll+rects[index].height/2})
      if(insertion<0)insertion=candidates.length
      slot=insertion
      target=candidates[insertion]||candidates.at(-1)||null;after=insertion===candidates.length
      const next=sortOffsets(rects.map(r=>r.height),gap,from,slot)
      siblings.forEach((el,i)=>{if(el!==row)el.style.transform=`translateY(${next[i]}px)`})
      if(placeholder){const parentRect=parent.getBoundingClientRect();placeholder.style.left=`${rect.left-parentRect.left-parent.clientLeft}px`;placeholder.style.top=`${rect.top-scroll+next[from]-parentRect.top-parent.clientTop+parent.scrollTop}px`}
      if(ghost)ghost.style.transform=`translate3d(${x-grab.x}px,${y-grab.y}px,0)`
    }
    const tick=()=>{
      if(active&&scroller){const bounds=scroller.getBoundingClientRect();const speed=y<bounds.top+45?-12:y>bounds.bottom-45?12:0;if(speed){scroller.scrollTop+=speed;mark()}}
      frame=requestAnimationFrame(tick)
    }
    const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;x=event.clientX;y=event.clientY;if(!active&&Math.hypot(x-start.x,y-start.y)>5){active=true;setDragging(true);createPreview()}if(active){event.preventDefault();mark()}}

    const finish=(commit:boolean)=>{
      cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel)
      ghost?.remove();placeholder?.remove();parent.style.position=parentPosition;siblings.forEach((el,i)=>{el.classList.remove('sort-lifted');el.style.transform=saved[i].transform;el.style.transition=saved[i].transition});document.body.classList.remove('sorting-active');setDragging(false);cleanup.current=null
      if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer)
      if(commit&&active&&target&&slot!==from)callback.current(id,target.dataset.sortId!,after)
    }
    const up=(event:PointerEvent)=>{if(event.pointerId===pointer)finish(true)},cancel=()=>finish(false),key=(event:KeyboardEvent)=>{if(event.key==='Escape')finish(false)}
    cleanup.current=cancel;handle.setPointerCapture(pointer)
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);frame=requestAnimationFrame(tick)
  }}><GripVertical size={17}/></button>
}
