import { ChevronDown, ChevronRight } from 'lucide-react'

export default function TreeDisclosure({open,name,onToggle}:{open:boolean;name:string;onToggle:()=>void}) {
  return <button className="tree-disclosure" aria-label={`${open?'收起':'展开'}${name}`} aria-expanded={open} title={`${open?'收起':'展开'}${name}`} onClick={event=>{event.stopPropagation();onToggle()}} onDoubleClick={event=>event.stopPropagation()}>{open?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button>
}
