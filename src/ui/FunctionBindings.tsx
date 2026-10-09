import { useFunctions } from './FunctionContext'
export default function FunctionBindings({ids,onChange}:{ids:string[];onChange:(ids:string[])=>void}) {
  const functions=useFunctions()
  return <div className="function-bindings"><select aria-label="绑定函数" value="" onChange={e=>{if(e.target.value)onChange([...ids,e.target.value])}}><option value="">绑定函数…</option>{functions.filter(fn=>!ids.includes(fn.id)).map(fn=><option key={fn.id} value={fn.id}>{fn.name} · {fn.language}</option>)}</select>{ids.map(id=><button className="function-chip" key={id} title="解除绑定" onClick={()=>onChange(ids.filter(x=>x!==id))}>{functions.find(fn=>fn.id===id)?.name||'函数已缺失'} ×</button>)}</div>
}
