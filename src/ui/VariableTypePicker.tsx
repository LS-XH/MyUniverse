import {useEffect,useRef,useState} from 'react'
import{createPortal}from'react-dom'
import{ChevronDown,Check}from'lucide-react'
import{VariableType,variableTypes}from'../model/workflowValues'
import WorkflowIcon from './WorkflowIcon'
export default function VariableTypePicker({value,onChange,disabled=false}:{value:VariableType|null;onChange:(type:VariableType)=>void;disabled?:boolean}){
 const button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0})
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false)},key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)},scroll=()=>setOpen(false);window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);window.addEventListener('resize',scroll);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key);window.removeEventListener('resize',scroll)}},[open])
 return <><button ref={button} type="button" disabled={disabled} className="variable-type-picker" aria-label="变量类型" aria-expanded={open} onClick={()=>{const rect=button.current!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(window.innerWidth-188,rect.right-180)),top:Math.max(8,Math.min(window.innerHeight-190,rect.bottom+5))});setOpen(!open)}}>{value&&<WorkflowIcon kind="variable" type={value}/>}<span>{value||'未声明'}</span><ChevronDown size={13}/></button>{open&&createPortal(<div ref={menu} className="variable-type-menu" role="listbox" aria-label="选择变量类型" style={position}>{variableTypes.map(type=><button key={type} role="option" aria-selected={type===value} onClick={()=>{onChange(type);setOpen(false)}}><WorkflowIcon kind="variable" type={type}/><span>{type}</span>{type===value&&<Check size={13}/>}</button>)}</div>,document.body)}</>
}
