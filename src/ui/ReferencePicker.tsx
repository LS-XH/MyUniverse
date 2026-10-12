import {useState,type CSSProperties} from 'react'
import {ChevronDown} from 'lucide-react'
import type {World} from '../model/types'
import {toCssColor} from './ColorPicker'
import PickerMenu from './PickerMenu'

/** Shared instance selector for references and graph mappings. */
export default function ReferencePicker({world,classId,entityId,onChange,placeholder='选择对象',readOnly=false,allowedIds,ariaLabel}:{world:World;classId?:string;entityId?:string;onChange:(classId:string,entityId:string)=>void;placeholder?:string;readOnly?:boolean;allowedIds?:string[];ariaLabel?:string}){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false)
 const docs=world.documents.filter(d=>!classId||d.id===classId)
 const choices=docs.flatMap(doc=>doc.entities.map(entity=>({doc,entity,color:doc.labels?.find(label=>label.id===doc.entityLabels?.[entity.id])?.color})))
 const selected=choices.find(x=>x.entity.id===entityId)
 const options=choices.filter(x=>(!allowedIds||allowedIds.includes(x.entity.id))&&`${x.doc.name} ${x.entity.name}`.toLowerCase().includes(query.toLowerCase()))
 const colorStyle=(color?:string)=>color?{'--reference-color':toCssColor(color)} as CSSProperties:undefined
 const badge=(name:string)=><span className="reference-class ui-badge--reference ui-surface ui-badge ui-badge--themed ui-badge--text">{name}</span>
 return <div className="reference-picker"><button type="button" aria-label={ariaLabel} aria-expanded={open} className="reference-trigger ui-field--reference ui-surface ui-button ui-field--themed ui-field--text ui-field" disabled={readOnly} data-reference-color={selected?.color||undefined} style={colorStyle(selected?.color)} onClick={()=>setOpen(!open)}>{selected?<>{badge(selected.doc.name)}{selected.entity.name}</>:<span className="muted">{placeholder}</span>}<ChevronDown size={14}/></button>{!readOnly&&open&&<PickerMenu onClose={()=>setOpen(false)}><input autoFocus aria-label="搜索引用实例" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索类或实例…" className="ui-surface ui-field"/>{options.length?options.map(x=><button type="button" key={`${x.doc.id}:${x.entity.id}`} data-reference-color={x.color||undefined} style={colorStyle(x.color)} className="ui-reference-option ui-surface ui-button ui-menu-item" onClick={()=>{onChange(x.doc.id,x.entity.id);setOpen(false);setQuery('')}}>{badge(x.doc.name)}{x.entity.name}</button>):<div className="picker-empty">没有可选择的实例</div>}</PickerMenu>}</div>
}
