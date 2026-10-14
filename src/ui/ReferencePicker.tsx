import {useState,type CSSProperties} from 'react'
import {ChevronDown} from 'lucide-react'
import type {World} from '../model/types'
import {toCssColor} from './ColorPicker'
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
 const colorStyle=(color?:string)=>color?{'--reference-color':toCssColor(color)} as CSSProperties:undefined
 const badge=(name:string)=><span className="reference-class ui-badge--reference ui-surface ui-badge ui-badge--themed ui-badge--text">{name}</span>
 return <div className="reference-picker"><button type="button" aria-label={ariaLabel} aria-expanded={open} className="reference-trigger ui-field--reference ui-surface ui-button ui-field--themed ui-field--text ui-field" disabled={readOnly} data-reference-color={selected?.color||undefined} style={colorStyle(selected?.color)} onClick={()=>setOpen(!open)}>{selected?<>{badge(selected.doc.name)}{selected.entity.name}</>:<span className="muted">{placeholder}</span>}<ChevronDown size={14}/></button>{!readOnly&&open&&<PickerMenu onClose={()=>setOpen(false)}><input autoFocus aria-label="搜索引用实例" value={query} onChange={e=>{setQuery(e.target.value);setLimit(100)}} placeholder="搜索类或实例…" className="ui-surface ui-field"/>{options.length?options.slice(0,limit).map(x=><button type="button" key={`${x.doc.id}:${x.entity.id}`} data-reference-color={x.color||undefined} style={colorStyle(x.color)} className="ui-reference-option ui-surface ui-button ui-menu-item" onClick={()=>{onChange(x.doc.id,x.entity.id);setOpen(false);setQuery('')}}>{badge(x.doc.name)}{x.entity.name}</button>):<div className="picker-empty">没有可选择的实例</div>}{options.length>limit&&<button type="button" onClick={()=>setLimit(previous=>previous+100)} className="ui-surface ui-button ui-menu-item">显示更多（可搜索定位）</button>}</PickerMenu>}</div>
}
