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
const presets=[
  ['#052e16','#172554','#2e1065','#450a0a','#431407','#422006','#042f2e','#18181b'],
  ['#14532d','#1e3a8a','#581c87','#7f1d1d','#7c2d12','#713f12','#134e4a','#27272a'],
  ['#166534','#1e40af','#6b21a8','#991b1b','#9a3412','#854d0e','#115e59','#3f3f46'],
  ['#15803d','#2563eb','#9333ea','#dc2626','#ea580c','#ca8a04','#0d9488','#52525b'],
  ['#22c55e','#3b82f6','#a855f7','#ef4444','#f97316','#eab308','#14b8a6','#71717a'],
  ['#4ade80','#60a5fa','#c084fc','#f87171','#fb923c','#facc15','#2dd4bf','#a1a1aa'],
  ['#86efac','#93c5fd','#d8b4fe','#fca5a5','#fdba74','#fde047','#5eead4','#d4d4d8'],
  ['#dcfce7','#dbeafe','#f3e8ff','#fee2e2','#ffedd5','#fef9c3','#ccfbf1','#fafafa'],
]
const hex2=(n:number)=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0').toUpperCase()
export function toArgb(parts:number[]):string {return `#${parts.map(hex2).join('')}`}

export default function ColorPicker({value,onChange,label}:{value:string;onChange:(color:string)=>void;label:string}) {
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState({left:0,top:0})
  const channels=parseArgb(value)
  const update=(index:number,next:number)=>onChange(toArgb(channels.map((v,i)=>i===index?next:v)))
  const openPicker=(button:HTMLButtonElement)=>{
    const rect=button.getBoundingClientRect()
    setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-286)),top:Math.max(8,Math.min(rect.bottom+8,window.innerHeight-570))})
    setOpen(!open)
  }
  return <div className="color-control"><span>{label}</span><button className="color-trigger" title={`${label} ${value}`} onClick={e=>openPicker(e.currentTarget)}><span className="color-swatch" style={{background:toCssColor(value)}}/><span>{value.toUpperCase()}</span><Pipette size={14}/></button>{open&&<><div className="color-dismiss" onClick={()=>setOpen(false)}/><div className="color-popover" style={position}><div className="color-popover-head"><strong>{label}</strong><button onClick={()=>setOpen(false)}><X size={15}/></button></div><div className="color-preview" style={{background:toCssColor(value)}}/><div className="color-presets" aria-label="颜色预设">{presets.flatMap((row,r)=>row.map((color,c)=><button key={color} title={`预设颜色 ${color}`} aria-label={`预设颜色 ${color}`} style={{background:color}} onClick={()=>onChange(`#${hex2(channels[0])}${color.slice(1).toUpperCase()}`)} data-shade={r} data-hue={c}/>))}</div><div className="color-channels">{['A','R','G','B'].map((name,i)=><label key={name}><span>{name}</span><input type="range" min="0" max="255" value={channels[i]} onChange={e=>update(i,Number(e.target.value))}/><input className="channel-number" type="number" min="0" max="255" value={channels[i]} onChange={e=>update(i,Number(e.target.value))}/></label>)}</div><label className="color-hex">ARGB<input value={value.toUpperCase()} maxLength={9} onChange={e=>{const v=e.target.value.toUpperCase();if(/^#[0-9A-F]{0,8}$/.test(v))onChange(v)}} onBlur={()=>{if(!/^#[0-9A-F]{8}$/.test(value))onChange(toArgb(channels))}}/></label><button className="color-done" onClick={()=>setOpen(false)}><Check size={14}/> 完成</button></div></>}</div>
}
