import { useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { sortGroupOffsets } from '../model/sortGeometry'
import { portalTheme } from './portalTheme'
import { preserveDragAppearance } from './dragAppearance'

export function reorder<T extends {id:string}>(items:T[],from:string,to:string,after:boolean):T[] {
  if(from===to||!items.some(item=>item.id===from)||!items.some(item=>item.id===to))return items
  const item=items.find(item=>item.id===from)!,next=items.filter(item=>item.id!==from)
  next.splice(next.findIndex(item=>item.id===to)+(after?1:0),0,item)
  return next.every((item,i)=>item===items[i])?items:next
}

export function reorderGroup<T extends {id:string}>(items:T[],ids:string[],to:string,after:boolean):T[]{
 const selected=new Set(ids),group=items.filter(item=>selected.has(item.id))
 if(!group.length||selected.has(to)||!items.some(item=>item.id===to))return items
 const next=items.filter(item=>!selected.has(item.id))
 next.splice(next.findIndex(item=>item.id===to)+(after?1:0),0,...group)
 return next.every((item,i)=>item===items[i])?items:next
}

/** Pointer sorting supports a selected group without changing native file-drop behavior. */
export default function SortHandle({id,onMove,getDragIds}:{id:string;onMove:(from:string,to:string,after:boolean,ids?:string[])=>void;getDragIds?:()=>string[]}){
 const cleanup=useRef<(()=>void)|null>(null),callback=useRef(onMove);callback.current=onMove
 const [dragging,setDragging]=useState(false)
 useEffect(()=>()=>cleanup.current?.(),[])
 return <button type="button" className={`schema-grip ui-drag-handle--schema sort-handle ui-drag-handle--sort ${dragging?'is-dragging':''} ui-surface ui-drag-handle`} title="拖动调整顺序；方向键上下移动" aria-label="调整顺序" onClick={event=>event.stopPropagation()} onKeyDown={e=>{
  if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return
  e.preventDefault();e.stopPropagation()
  const row=e.currentTarget.closest<HTMLElement>('[data-sort-id]'),siblings=Array.from(row?.parentElement?.children||[]).filter(el=>el.hasAttribute('data-sort-id')) as HTMLElement[]
  const chosen=new Set(getDragIds?.()||[id]);chosen.add(id)
  const moving=siblings.filter(el=>chosen.has(el.dataset.sortId!)),indices=moving.map(el=>siblings.indexOf(el)),down=e.key==='ArrowDown'
  const target=siblings[(down?Math.max(...indices):Math.min(...indices))+(down?1:-1)]
  if(target)onMove(id,target.dataset.sortId!,down,moving.map(el=>el.dataset.sortId!))
 }} onPointerDown={e=>{
  if(e.button!==0)return
  e.preventDefault();e.stopPropagation();cleanup.current?.()
  const handle=e.currentTarget,row=handle.closest<HTMLElement>('[data-sort-id]')!,parent=row.parentElement!,start={x:e.clientX,y:e.clientY},pointer=e.pointerId
  const siblings=Array.from(parent.children).filter(el=>el.hasAttribute('data-sort-id')) as HTMLElement[],rects=siblings.map(el=>el.getBoundingClientRect()),from=siblings.indexOf(row),rect=rects[from]
  const chosen=new Set(getDragIds?.()||[id]);chosen.add(id)
  const moving=siblings.map((el,i)=>chosen.has(el.dataset.sortId!)?i:-1).filter(i=>i>=0),movingSet=new Set(moving),ids=moving.map(i=>siblings[i].dataset.sortId!)
  const gap=rects.length>1?Math.max(0,rects[1].top-rects[0].bottom):0,height=moving.reduce((sum,i)=>sum+rects[i].height,0)+gap*(moving.length-1)
  const packedBefore=moving.filter(i=>i<from).reduce((sum,i)=>sum+rects[i].height+gap,0)
  const saved=siblings.map(el=>({transform:el.style.transform,transition:el.style.transition})),parentPosition=parent.style.position
  const scroller=row.closest<HTMLElement>('.entity-list,.page-scroll'),initialScroll=scroller?.scrollTop||0,grab={x:start.x-rect.left,y:start.y-rect.top+packedBefore}
  let active=false,target:HTMLElement|null=null,after=false,frame=0,previewFrame=0,x=start.x,y=start.y,ghost:HTMLElement|null=null,placeholder:HTMLElement|null=null
  const createPreview=()=>{
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
   ghost=document.createElement('div');ghost.className='sort-ghost sort-group-ghost ui-drag-preview--sort';ghost.dataset.dragCount=String(moving.length);ghost.setAttribute('aria-hidden','true');ghost.inert=true
   Object.assign(ghost.style,{width:`${rect.width}px`,height:`${height}px`,left:'0px',top:'0px',display:'flex',flexDirection:'column',gap:`${gap}px`})
   for(const [key,value] of Object.entries(portalTheme(row)))ghost.style.setProperty(key,String(value))
   let packed=0
   const previews:HTMLElement[]=[]
   for(const index of moving){
    const original=siblings[index],clone=original.cloneNode(true) as HTMLElement;preserveDragAppearance(original,clone)
    clone.removeAttribute('data-sort-id');clone.removeAttribute('id');clone.classList.add('sort-group-card')
    const inputs=original.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select')
    clone.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select').forEach((el,i)=>{el.value=inputs[i].value;if(el instanceof HTMLInputElement&&inputs[i] instanceof HTMLInputElement)el.checked=(inputs[i] as HTMLInputElement).checked})
    clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.querySelectorAll('[data-sort-id]').forEach(el=>el.removeAttribute('data-sort-id'))
    Object.assign(clone.style,{width:`${rects[index].width}px`,height:`${rects[index].height}px`,margin:'0px',flex:'none',transform:`translateY(${rects[index].top-rect.top+packedBefore-packed}px)`,transition:reduced?'none':'transform .18s cubic-bezier(.2,.8,.2,1)'})
    packed+=rects[index].height+gap;ghost.appendChild(clone);previews.push(clone)
   }
   placeholder=document.createElement('div');placeholder.className='sort-placeholder ui-drag-preview--sort-placeholder ui-surface ui-drag-preview';placeholder.dataset.dragCount=String(moving.length);placeholder.setAttribute('aria-hidden','true')
   Object.assign(placeholder.style,{position:'absolute',height:`${height}px`,width:`${rect.width}px`,pointerEvents:'none',display:'flex',flexDirection:'column',gap:`${gap}px`})
   if(moving.length>1){placeholder.classList.add('sort-group-placeholder');for(const index of moving){const slot=document.createElement('div');slot.className='sort-placeholder-slot';slot.style.height=`${rects[index].height}px`;placeholder.appendChild(slot)}}
   parent.style.position||='relative';parent.appendChild(placeholder);document.body.appendChild(ghost)
   moving.forEach(index=>siblings[index].classList.add('sort-lifted'));document.body.classList.add('sorting-active')
   siblings.forEach(el=>{el.style.transition=reduced?'none':'transform .18s cubic-bezier(.2,.8,.2,1)'})
   previewFrame=requestAnimationFrame(()=>previews.forEach(el=>{el.style.transform='translateY(0)'}))
  }
  const mark=()=>{
   const scroll=(scroller?.scrollTop||0)-initialScroll,candidates=siblings.filter((_,i)=>!movingSet.has(i))
   let slot=candidates.findIndex(el=>{const index=siblings.indexOf(el);return y<rects[index].top-scroll+rects[index].height/2})
   if(slot<0)slot=candidates.length
   target=candidates[slot]||candidates.at(-1)||null;after=slot===candidates.length
   const next=sortGroupOffsets(rects.map(r=>r.height),gap,moving,slot)
   siblings.forEach((el,i)=>{if(!movingSet.has(i))el.style.transform=`translateY(${next[i]}px)`})
   if(placeholder){const p=parent.getBoundingClientRect(),first=moving[0];placeholder.style.left=`${rect.left-p.left-parent.clientLeft}px`;placeholder.style.top=`${rects[first].top-scroll+next[first]-p.top-parent.clientTop+parent.scrollTop}px`}
   if(ghost)ghost.style.transform=`translate3d(${x-grab.x}px,${y-grab.y}px,0)`
  }
  const tick=()=>{if(active&&scroller){const bounds=scroller.getBoundingClientRect(),speed=y<bounds.top+45?-12:y>bounds.bottom-45?12:0;if(speed){scroller.scrollTop+=speed;mark()}}frame=requestAnimationFrame(tick)}
  const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;x=event.clientX;y=event.clientY;if(!active&&Math.hypot(x-start.x,y-start.y)>5){active=true;setDragging(true);createPreview()}if(active){event.preventDefault();mark()}}
  const finish=(commit:boolean)=>{
   cancelAnimationFrame(frame);cancelAnimationFrame(previewFrame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel)
   ghost?.remove();placeholder?.remove();parent.style.position=parentPosition;siblings.forEach((el,i)=>{el.classList.remove('sort-lifted');el.style.transform=saved[i].transform;el.style.transition=saved[i].transition});document.body.classList.remove('sorting-active');setDragging(false);cleanup.current=null
   if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer)
   if(commit&&active&&target){const original=siblings.map(el=>({id:el.dataset.sortId!}));if(reorderGroup(original,ids,target.dataset.sortId!,after)!==original)callback.current(id,target.dataset.sortId!,after,ids)}
  }
  const up=(event:PointerEvent)=>{if(event.pointerId===pointer)finish(true)},cancel=()=>finish(false),key=(event:KeyboardEvent)=>{if(event.key==='Escape')finish(false)}
  cleanup.current=cancel;handle.setPointerCapture(pointer);window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);frame=requestAnimationFrame(tick)
 }}><GripVertical size={17}/></button>
}
