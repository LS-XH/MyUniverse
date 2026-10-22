import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react'
import {ListFilter} from 'lucide-react'
import PickerMenu from './PickerMenu'
import ReferenceOption from './ReferenceOption'
import {referenceIndex} from '../model/referenceIndex'
import type {ClassDocument,World} from '../model/types'

export default function GraphRelationFilter({world,relations:document,checked,onChange}:{world:World;relations:ClassDocument;checked:string[];onChange:(selection:string[]|null)=>void}){
 const relations=document.entities,index=referenceIndex(world)
 const [open,setOpen]=useState(false),menuId=useId(),trigger=useRef<HTMLButtonElement>(null),selectAll=useRef<HTMLInputElement>(null)
 const ids=new Set(checked),all=relations.length>0&&relations.every(r=>ids.has(r.id)),partial=!all&&checked.length>0
 useLayoutEffect(()=>{if(selectAll.current)selectAll.current.indeterminate=partial},[open,partial])
 useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>selectAll.current?.focus());return()=>cancelAnimationFrame(frame)},[open])
 const toggle=(id:string,selected:boolean)=>{
  const next=relations.filter(r=>r.id===id?selected:ids.has(r.id)).map(r=>r.id)
  onChange(next.length===relations.length?null:next)
 }
 const summary=all?'全部关系类型':!checked.length?'未选择关系类型':checked.length===1?relations.find(r=>ids.has(r.id))?.name:`关系类型 ${checked.length}/${relations.length}`
 return <div className="graph-relation-filter-wrap">
  <button ref={trigger} type="button" aria-label="关系类型筛选" title={`关系类型筛选：${summary||'关系类型'}（已选 ${checked.length}/${relations.length}）`} aria-expanded={open} aria-controls={open?menuId:undefined} disabled={!relations.length} onClick={()=>setOpen(!open)} className={`graph-relation-filter icon-button ui-button--icon ui-button--topbar-icon ${!all||open?'tool-active':''} ui-surface ui-button`}><ListFilter size={20}/></button>
  {open&&<PickerMenu preferredWidth={260} className="graph-relation-menu" onClose={()=>setOpen(false)}><div id={menuId} role="group" aria-label="显示的关系类型" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
   <label className="graph-relation-option graph-relation-option--all ui-menu-item"><input ref={selectAll} type="checkbox" checked={all} onChange={event=>onChange(event.target.checked?null:[])}/><span>全选</span><span aria-hidden="true" className="graph-relation-count">{checked.length}/{relations.length}</span></label>
   {relations.map(relation=>{const choice=index.byId.get(relation.id);return choice&&choice.doc.id===document.id?<ReferenceOption key={relation.id} choice={choice} checkbox={{checked:ids.has(relation.id),onChange:selected=>toggle(relation.id,selected)}}/>:null})}
  </div></PickerMenu>}
 </div>
}
