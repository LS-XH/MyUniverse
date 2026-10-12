import {useEffect,useState} from 'react'
import {AgentDefinition} from '../model/types'
import {agentSpec,defaultAgentSchema} from '../model/agents'

export default function AgentSettings({agent,onChange,disabled=false}:{agent:AgentDefinition;onChange:(patch:Partial<AgentDefinition>)=>void;disabled?:boolean}) {
 const [schema,setSchema]=useState(''),[error,setError]=useState('')
 useEffect(()=>{setSchema(JSON.stringify(agent.inputSchema||defaultAgentSchema,null,2));setError('')},[agent.id,agent.inputSchema])
 return <fieldset disabled={disabled} className="agent-settings model-form"><legend>Agent 调用契约</legend>
  <label><input type="checkbox" checked={agent.enabled!==false} onChange={e=>onChange({enabled:e.target.checked})} className="ui-surface ui-field"/> 启用 Agent</label>
  <label>调用名称<input className="ui-surface ui-field" value={agent.callName||''} placeholder={`agent_${agent.id.replace(/[^a-zA-Z0-9_]/g,'_')}`} onChange={e=>onChange({callName:e.target.value})}/></label>
  <label>用途说明<textarea className="ui-surface ui-field" value={agent.description||''} onChange={e=>onChange({description:e.target.value})}/></label>
  <label>参数 JSON Schema<textarea className="ui-surface ui-field" rows={8} value={schema} onChange={e=>setSchema(e.target.value)} onBlur={()=>{try{const inputSchema=JSON.parse(schema);agentSpec({...agent,inputSchema});onChange({inputSchema});setError('')}catch(error){setError(String(error))}}}/></label>
  {(['depth','nodes','calls'] as const).map((key,index)=><label key={key}>{['调用深度上限','节点执行预算','模型 / Tool / Agent 调用预算'][index]}<input className="ui-surface ui-field" type="number" min={1} max={key==='depth'?64:key==='nodes'?1000000:10000} value={agent.limits?.[key]??[8,10000,128][index]} onChange={e=>onChange({limits:{...agent.limits,[key]:Number(e.target.value)}})}/></label>)}
  {error&&<p className="danger" role="alert">{error}</p>}
 </fieldset>
}
