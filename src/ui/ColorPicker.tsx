import { useState } from 'react'
import { Check, Pipette, X } from 'lucide-react'

export function parseArgb(value:string):[number,number,number,number] {
  const hex=value.replace('#','').toUpperCase()
  const full=hex.length===8?hex:hex.length===6?`FF${hex}`:'FF8D74E7'
  return [0,2,4,6].map(i=>parseInt(full.slice(i,i+2),16)) as [number,number,number,number]
}
export function toCssColor(value:string):string {
  const [a,r,g,b]=parseArgb(value)
  return `rgba(${r}, ${g}, ${b}, ${(a/255).toFixed(3)})`
}
const hex2=(n:number)=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0').toUpperCase()
export function toArgb(parts:number[]):string {return `#${parts.map(hex2).join('')}`}

export default function ColorPicker({value,onChange,label}:{value:string;onChange:(color:string)=>void;label:string}) {
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState({left:0,top:0})
  const channels=parseArgb(value)
  const update=(index:number,next:number)=>onChange(toArgb(channels.map((v,i)=>i===index?next:v)))
  const openPicker=(button:HTMLButtonElement)=>{
    const rect=button.getBoundingClientRect()
    setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-286)),top:rect.bottom+270>window.innerHeight?rect.top-275:rect.bottom+8})
    setOpen(!open)
  }
  return <div className="color-control"><span>{label}</span><button className="color-trigger" title={`${label} ${value}`} onClick={e=>openPicker(e.currentTarget)}><span className="color-swatch" style={{background:toCssColor(value)}}/><span>{value.toUpperCase()}</span><Pipette size={14}/></button>{open&&<><div className="color-dismiss" onClick={()=>setOpen(false)}/><div className="color-popover" style={position}><div className="color-popover-head"><strong>{label}</strong><button onClick={()=>setOpen(false)}><X size={15}/></button></div><div className="color-preview" style={{background:toCssColor(value)}}/><div className="color-channels">{['A','R','G','B'].map((name,i)=><label key={name}><span>{name}</span><input type="range" min="0" max="255" value={channels[i]} onChange={e=>update(i,Number(e.target.value))}/><input className="channel-number" type="number" min="0" max="255" value={channels[i]} onChange={e=>update(i,Number(e.target.value))}/></label>)}</div><label className="color-hex">ARGB<input value={value.toUpperCase()} maxLength={9} onChange={e=>{const v=e.target.value.toUpperCase();if(/^#[0-9A-F]{0,8}$/.test(v))onChange(v)}} onBlur={()=>{if(!/^#[0-9A-F]{8}$/.test(value))onChange(toArgb(channels))}}/></label><button className="color-done" onClick={()=>setOpen(false)}><Check size={14}/> 完成</button></div></>}</div>
}
