import {useEffect,useRef,useState,type PointerEvent,type RefObject} from 'react'
import {WorkflowGraph} from '../model/types'
import {bindVariable,unbindVariable} from '../model/workflowBindings'
import {movePoolVariable} from '../model/variablePool'
import {typedVariableNode,variablePort} from '../model/workflowValues'
import {canDropLibraryNode} from './libraryDrop'
import type {PoolEntry} from './VariablePool'
import type {BindingSource} from './WorkflowPorts'
export default function useVariableDrag({graph,variables,commit,canvas,point,onError,running}:{graph:WorkflowGraph;variables:Record<string,unknown>;commit:(graph:WorkflowGraph)=>void;canvas:RefObject<HTMLDivElement|null>;point:(p:{x:number;y:number})=>{x:number;y:number};onError:(text:string)=>void;running:boolean}){
 const live=useRef({graph,variables,commit,point,onError,running});live.current={graph,variables,commit,point,onError,running}
 const drag=useRef<{entry:PoolEntry;start:{x:number;y:number};source?:BindingSource;nodeId?:string;moved:boolean;width:number;sourceElement?:HTMLElement;offset:{x:number;y:number};rows:{id:string;center:number}[]}|null>(null),skip=useRef(false)
 const[preview,setPreview]=useState<{entry:PoolEntry;x:number;y:number;width:number;compact:boolean;library:boolean;source?:HTMLElement;origin?:BindingSource;pending?:boolean;target?:string;before?:string}|null>(null)
 const start=(entry:PoolEntry,e:PointerEvent,source?:BindingSource,nodeId?:string)=>{
  if(e.button!==0||live.current.running||!entry.type)return
  e.stopPropagation();e.preventDefault()
  const element=e.currentTarget as HTMLElement,sourceElement=nodeId?element.closest<HTMLElement>('.flow-node')||undefined:undefined
  const row=element.closest<HTMLElement>('[data-variable-target]'),rect=(source?element:sourceElement||element.closest('.variable-pool-row'))?.getBoundingClientRect()
  const rows=Array.from(canvas.current?.parentElement?.querySelectorAll<HTMLElement>('[data-pool-variable]')||[]).map(el=>({id:el.dataset.poolVariable!,center:el.getBoundingClientRect().top+el.getBoundingClientRect().height/2}))
  const width=rect?.width||280,offset=rect&&(source||nodeId)?{x:e.clientX-rect.left,y:e.clientY-rect.top}:{x:-10,y:-10}
  drag.current={entry,start:{x:e.clientX,y:e.clientY},source,nodeId,moved:false,width,rows,sourceElement,offset};skip.current=false
  // Start at the existing slot so detaching reverses the same shell's docking animation.
  if(source&&rect&&row)setPreview({entry,x:rect.left,y:rect.top,width:element.offsetWidth,compact:true,library:false,origin:source,pending:true,target:row.dataset.variableTarget})
 }

 const highlighted=useRef<HTMLElement|null>(null)
 const clearHighlight=()=>{highlighted.current?.classList.remove('variable-drop-target');highlighted.current=null}
 const clean=()=>{const source=drag.current?.sourceElement;source?.classList.remove('variable-drag-origin');if(source)source.style.visibility='';drag.current=null;setPreview(null);clearHighlight()}
 const move=(e:globalThis.PointerEvent)=>{
  const d=drag.current;if(!d)return false
  if(!d.moved&&Math.hypot(e.clientX-d.start.x,e.clientY-d.start.y)<3)return false
  d.moved=true
  // Ignore the moving source for hit testing, while the shared canvas editor moves it.
  d.sourceElement?.classList.add('variable-drag-origin')
  const target=document.elementFromPoint(e.clientX,e.clientY),parent=target?.closest<HTMLElement>('.flow-node'),candidate=target?.closest<HTMLElement>('[data-variable-target]')
  const valid=candidate&&parent?.dataset.nodeId!==d.nodeId&&candidate.dataset.variableType===variablePort(d.entry.type!)?candidate:null
  if(highlighted.current!==valid){clearHighlight();highlighted.current=valid;valid?.classList.add('variable-drop-target')}
  const library=!!target?.closest('.flow-library,.variable-pool'),compact=library
  // Only a compatible value slot docks a card; hovering its parent changes nothing.
  if(d.sourceElement)d.sourceElement.style.visibility=compact||valid?'hidden':''
  const before=target?.closest('.variable-pool-scroll')?d.rows.find(row=>row.id!==d.entry.id&&e.clientY<row.center)?.id:undefined
  setPreview({entry:d.entry,x:e.clientX-d.offset.x,y:e.clientY-d.offset.y,width:compact?Math.min(d.width,240):d.sourceElement?d.sourceElement.offsetWidth:300,compact,library,source:d.sourceElement,origin:d.source,target:valid?.dataset.variableTarget,before})
  return compact||!!valid
 }
 const end=(e:globalThis.PointerEvent)=>{
  const d=drag.current,v=live.current;if(!d)return
  // Hit test before restoring source visibility, to avoid covering the destination.
  const target=document.elementFromPoint(e.clientX,e.clientY),candidate=target?.closest<HTMLElement>('[data-variable-target]'),port=candidate&&candidate.closest<HTMLElement>('.flow-node')?.dataset.nodeId!==d.nodeId&&candidate.dataset.variableType===variablePort(d.entry.type!)?candidate:null,pool=target?.closest('.variable-pool-scroll')
  clean();if(!d.moved||v.running)return
  skip.current=true;window.setTimeout(()=>{skip.current=false},0)
  try{
   if(candidate&&!port)return
   let next=v.graph
   if(d.source)next=unbindVariable(next,d.source.nodeId,d.source.key)
   if(port){
    const [id,direction,name]=port.dataset.variableTarget!.split('|')
    next=bindVariable(next,v.variables,id,name,direction as 'in'|'out',d.entry.id)
    if(d.nodeId&&d.nodeId!==id)next={...next,nodes:next.nodes.filter(n=>n.id!==d.nodeId),links:next.links.filter(l=>l.from!==d.nodeId&&l.to!==d.nodeId)}
    v.commit(next)
   }else if(pool){
    const before=d.rows.find(row=>row.id!==d.entry.id&&e.clientY<row.center)?.id
    if(d.nodeId)next={...next,nodes:next.nodes.filter(n=>n.id!==d.nodeId),links:next.links.filter(l=>l.from!==d.nodeId&&l.to!==d.nodeId)}
    v.commit(movePoolVariable(next,v.variables,d.entry.id,before))
   }else if(!d.nodeId&&canDropLibraryNode(canvas.current,e.clientX,e.clientY)){
    const p=v.point({x:e.clientX-d.offset.x,y:e.clientY-d.offset.y}),node=typedVariableNode(d.entry.type!,undefined,p.x,p.y)
    node.settings={...node.settings,name:d.entry.name,variableId:d.entry.id}
    v.commit({...next,nodes:[...next.nodes,node]})
   }
   v.onError('')
  }catch(error){v.onError(error instanceof Error?error.message:String(error))}
 }
 const handlers=useRef({move,end,clean});handlers.current={move,end,clean}
 useEffect(()=>{
  const move=(e:globalThis.PointerEvent)=>{if(!drag.current?.nodeId)handlers.current.move(e)}
  const end=(e:globalThis.PointerEvent)=>{if(!drag.current?.nodeId)handlers.current.end(e)}
  const cancel=()=>handlers.current.clean(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel()}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key)
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);handlers.current.clean()}
 },[])

 return {start,preview,boundary:{move,end,cancel:clean},consumeClick:()=>{const value=skip.current;skip.current=false;return value}}
}
