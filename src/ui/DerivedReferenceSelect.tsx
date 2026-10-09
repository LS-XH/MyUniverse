import { classLink } from '../model/markdown'
import { fieldFunctions, functionFile, functionLink, functionReferenceIdentity } from '../model/functions'
import { World } from '../model/types'
import { useFunctions } from './FunctionContext'

export default function DerivedReferenceSelect({world,classId,entityId,value,onChange}:{world:World;classId:string;entityId:string;value:string;onChange:(v:string)=>void}) {
  const functions=useFunctions(),base=classLink(world,classId,entityId)
  const options=fieldFunctions(world,entityId).flatMap(({field,schema,label})=>(schema.functionIds||[]).flatMap(id=>{
    const fn=functions.find(fn=>fn.id===id),result=field.functionResults?.find(r=>r.functionId===id)
    if(!fn&&!result)return []
    const link=result||{name:fn!.name,fileName:`../../functions/${functionFile(fn!)}`}
    return [{label:`${label} / ${link.name}`,value:`${base} ${functionLink(link)}@${field.id}`}]
  }))
  if(!options.length)return null
  const selected=options.find(o=>functionReferenceIdentity(o.value)===functionReferenceIdentity(value))?.value||''
  return <select className="derived-reference-select" aria-label="引用函数返回值" value={selected} onChange={e=>onChange(e.target.value||base)}><option value="">使用原值</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
}
