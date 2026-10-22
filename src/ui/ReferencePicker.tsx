import {useState} from 'react'
import {ChevronDown} from 'lucide-react'
import type {World} from '../model/types'
import ReferenceOption,{ReferenceBadge,referenceColorStyle} from './ReferenceOption'
import PickerMenu from './PickerMenu'
import {referenceIndex} from '../model/referenceIndex'

/** Shared instance selector for references and graph mappings. */
export default function ReferencePicker({world,classId,entityId,onChange,placeholder='选择对象',readOnly=false,allowedIds,ariaLabel}:{world:World;classId?:string;entityId?:string;onChange:(classId:string,entityId:string)=>void;placeholder?:string;readOnly?:boolean;allowedIds?:string[];ariaLabel?:string}){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[limit,setLimit]=useState(100)
 const index=referenceIndex(world),candidate=entityId?index.byId.get(entityId):undefined
 const selected=candidate&&(!classId||candidate.doc.id===classId)?candidate:undefined
 const allowed=allowedIds?new Set(allowedIds):undefined,term=query.toLowerCase()
 const options=[]
 if(open)for(const choice of index.choices){if((!classId||choice.doc.id===classId)&&(!allowed||allowed.has(choice.entity.id))&&choice.search.includes(term)){options.push(choice);if(options.length>limit)break}}
 return <div className="reference-picker"><button type="button" aria-label={ariaLabel} aria-expanded={open} className="reference-trigger ui-reference-trigger ui-field--reference ui-surface ui-button ui-field--themed ui-field--text ui-field" disabled={readOnly} data-reference-color={selected?.color||undefined} style={referenceColorStyle(selected?.color)} onClick={()=>setOpen(!open)}>{selected?<><ReferenceBadge name={selected.doc.name}/>{selected.entity.name}</>:<span className="muted">{placeholder}</span>}<ChevronDown size={14}/></button>{!readOnly&&open&&<PickerMenu onClose={()=>setOpen(false)}><input autoFocus aria-label="搜索引用实例" value={query} onChange={e=>{setQuery(e.target.value);setLimit(100)}} placeholder="搜索类或实例…" className="ui-surface ui-field"/>{options.length?options.slice(0,limit).map(x=><ReferenceOption key={`${x.doc.id}:${x.entity.id}`} choice={x} onSelect={()=>{onChange(x.doc.id,x.entity.id);setOpen(false);setQuery('')}}/>):<div className="picker-empty">没有可选择的实例</div>}{options.length>limit&&<button type="button" onClick={()=>setLimit(previous=>previous+100)} className="ui-surface ui-button ui-menu-item">显示更多（可搜索定位）</button>}</PickerMenu>}</div>
}
