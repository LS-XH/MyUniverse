import {useLayoutEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react'
import {GripVertical,X} from 'lucide-react'

/** Layout at world size first; scale every pixel of the same morphing shell together. */
export default function DragCardPreview({x,y,width,scale=1,compact,title,card,source,target,inline,originalVisible=false,placeholderHeight}:{x:number;y:number;width:number;scale?:number;compact:boolean;title:ReactNode;card?:ReactNode;source?:HTMLElement;target?:string;inline?:ReactNode;originalVisible?:boolean;placeholderHeight?:number}){
 const clone=useRef<HTMLDivElement>(null),visual=useRef<HTMLElement>(null)
 const [contentHeight,setContentHeight]=useState(31),[dock,setDock]=useState<{x:number;y:number;width:number;height:number;scale:number}|null>(null)
 useLayoutEffect(()=>{
  if(!clone.current)return
  // Normal canvas movement displays the real node, never a second card.
  if(!source||originalVisible){clone.current.replaceChildren();return}
  const copy=source.cloneNode(true) as HTMLElement
  copy.removeAttribute('data-node-id');copy.classList.remove('selected','variable-drag-origin')
  copy.style.cssText='position:relative;left:0;top:0;width:100%;margin:0;transform:none;visibility:visible'
  // Native form state is not represented by cloneNode's HTML attributes.
  const controls=source.querySelectorAll('input,textarea,select')
  copy.querySelectorAll('input,textarea,select').forEach((element,index)=>{
   const original=controls[index] as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement
   const control=element as typeof original;control.value=original.value
   if(control instanceof HTMLInputElement&&original instanceof HTMLInputElement)control.checked=original.checked
  })
  copy.querySelectorAll('[data-variable-target],[data-workflow-port]').forEach(el=>{el.removeAttribute('data-variable-target');el.removeAttribute('data-workflow-port')})
  clone.current.replaceChildren(copy)
 },[source,originalVisible])
 useLayoutEffect(()=>{
  if(!target){setDock(null);return}
  const row=Array.from(document.querySelectorAll<HTMLElement>('[data-variable-target]')).find(el=>el.dataset.variableTarget===target),slot=row?.querySelector<HTMLElement>('.flow-inline-variable')
  if(!row||!slot)return
  const rect=slot.getBoundingClientRect()
  setDock({x:rect.left,y:rect.top,width:rect.width,height:rect.height,scale:row.getBoundingClientRect().width/row.offsetWidth})
 },[target,x,y])
 useLayoutEffect(()=>{
  const el=visual.current;if(!el)return
  const measure=()=>setContentHeight(el.offsetHeight)
  measure();const observer=new ResizeObserver(measure);observer.observe(el)
  return()=>observer.disconnect()
 },[])
 const attached=!!target&&!!dock,ratio=attached?dock.scale:scale,logicalWidth=attached?dock.width/ratio:width
 const previousShape=useRef({compact,attached}),[morphing,setMorphing]=useState(false)
 useLayoutEffect(()=>{
  const previous=previousShape.current;previousShape.current={compact,attached}
  if(previous.compact===compact&&previous.attached===attached)return
  setMorphing(true);const timer=setTimeout(()=>setMorphing(false),220)
  return()=>clearTimeout(timer)
 },[compact,attached])
 const placeholder=placeholderHeight!==undefined&&!compact&&!attached,height=attached?dock.height:placeholder?placeholderHeight*ratio:originalVisible&&source?source.offsetHeight*ratio:contentHeight*ratio
 return <div className={`workflow-drag-preview ui-drag-preview--workflow ${attached?'is-attached':''} ${morphing?'is-morphing':''} ${originalVisible?'is-original-visible':''} ui-surface ui-drag-preview`} style={{left:attached?dock.x:x,top:attached?dock.y:y,width:logicalWidth*ratio,height}} aria-hidden="true">
  <section ref={visual} className={`flow-node ui-node--flow workflow-drag-visual ui-drag-preview--visual ${compact||attached?'is-compact':'is-card'} ${attached?'is-attached':''} ${placeholder?'is-placeholder':''} ui-surface ui-node ui-drag-preview ui-node--themed ui-node--text ui-surface--bordered`} style={{width:logicalWidth,transform:`scale(${ratio})`,...(placeholder?{height:placeholderHeight}:attached?{height:dock.height/ratio}:originalVisible&&source?{height:source.offsetHeight}:{})} as CSSProperties}>
   {!placeholder&&<><header className={`${attached?'flow-palette-item ui-tree-row--palette flow-inline-variable ui-card--inline-variable':'flow-palette-item ui-tree-row--palette'} workflow-drag-title ui-surface ui-tree-row ui-card`}>{attached?<><GripVertical size={12}/>{inline}<X size={12}/></>:compact?title:<><strong>{title}</strong><span>⋮⋮</span></>}</header><div className="workflow-drag-body"><div><div ref={clone}/>{!source&&card}</div></div></>}
  </section>
 </div>
}
