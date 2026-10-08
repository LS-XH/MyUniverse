import { useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'

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
    const handle=e.currentTarget,row=handle.closest<HTMLElement>('[data-sort-id]')!,parent=row.parentElement!,start=e.clientY,pointer=e.pointerId
    const siblings=Array.from(parent.children).filter(el=>el.hasAttribute('data-sort-id')) as HTMLElement[]
    let active=false,target:HTMLElement|null=null,after=false,frame=0,y=start
    const scroller=row.closest<HTMLElement>('.page-scroll')
    const mark=()=>{
      siblings.forEach(el=>el.classList.remove('sort-before','sort-after'))
      const candidates=siblings.filter(el=>el!==row)
      target=candidates.find(el=>y<el.getBoundingClientRect().bottom)||candidates.at(-1)||null
      if(target){const rect=target.getBoundingClientRect();after=y>rect.top+rect.height/2;target.classList.add(after?'sort-after':'sort-before')}
    }
    const tick=()=>{
      if(active&&scroller){const rect=scroller.getBoundingClientRect();const speed=y<rect.top+45?-12:y>rect.bottom-45?12:0;if(speed){scroller.scrollTop+=speed;mark()}}
      frame=requestAnimationFrame(tick)
    }
    const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;y=event.clientY;if(!active&&Math.abs(y-start)>5){active=true;setDragging(true);row.classList.add('sort-dragging');document.body.classList.add('sorting-active')}if(active){event.preventDefault();mark()}}
    const finish=(commit:boolean)=>{
      cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel)
      siblings.forEach(el=>el.classList.remove('sort-before','sort-after','sort-dragging'));document.body.classList.remove('sorting-active');setDragging(false);cleanup.current=null
      if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer)
      if(commit&&active&&target)callback.current(id,target.dataset.sortId!,after)
    }
    const up=(event:PointerEvent)=>{if(event.pointerId===pointer)finish(true)},cancel=()=>finish(false),key=(event:KeyboardEvent)=>{if(event.key==='Escape')finish(false)}
    cleanup.current=cancel;handle.setPointerCapture(pointer)
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);frame=requestAnimationFrame(tick)
  }}><GripVertical size={17}/></button>
}
