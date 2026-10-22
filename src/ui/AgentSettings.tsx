import AgentToolSelection from './AgentToolSelection'
import {CapabilitySelection} from './ModelsPage'
import {defaultConfig} from '../model/builtinAgents'
import {defaultAgentCapabilities,resolveAgentCapabilities} from '../model/agentCapabilityDefaults'
import {useEffect,useState} from 'react'
import {AgentDefinition,Workspace} from '../model/types'
import {agentSpec,defaultAgentSchema} from '../model/agents'

export default function AgentSettings({agent,onChange,disabled=false,workspace}:{workspace?:Workspace;agent:AgentDefinition;onChange:(patch:Partial<AgentDefinition>)=>void;disabled?:boolean}) {
 const config=defaultAgentCapabilities({...defaultConfig(true),...agent.config}),patch=(value:Partial<typeof config>)=>onChange({config:{...config,...value}})
 const [schema,setSchema]=useState(''),[error,setError]=useState('')
 useEffect(()=>{setSchema(JSON.stringify(agent.inputSchema||defaultAgentSchema,null,2));setError('')},[agent.id,agent.inputSchema])
 return <fieldset disabled={disabled} className="agent-settings model-form"><legend>Agent 调用契约</legend>
  <label><input type="checkbox" checked={agent.enabled!==false} onChange={e=>onChange({enabled:e.target.checked})} className="ui-surface ui-field"/> 启用 Agent</label>
  <label>调用名称<input className="ui-surface ui-field" value={agent.callName||''} placeholder={`agent_${agent.id.replace(/[^a-zA-Z0-9_]/g,'_')}`} onChange={e=>onChange({callName:e.target.value})}/></label>
  <label>用途说明<textarea className="ui-surface ui-field" value={agent.description||''} onChange={e=>onChange({description:e.target.value})}/></label>
  <label>参数 JSON Schema<textarea className="ui-surface ui-field" rows={8} value={schema} onChange={e=>setSchema(e.target.value)} onBlur={()=>{try{const inputSchema=JSON.parse(schema);agentSpec({...agent,inputSchema});onChange({inputSchema});setError('')}catch(error){setError(String(error))}}}/></label>
  {(['depth','nodes','calls'] as const).map((key,index)=><label key={key}>{['调用深度上限','节点执行预算','模型 / Tool / Agent 调用预算'][index]}<input className="ui-surface ui-field" type="number" min={1} max={key==='depth'?64:key==='nodes'?1000000:10000} value={agent.limits?.[key]??[8,10000,128][index]} onChange={e=>onChange({limits:{...agent.limits,[key]:Number(e.target.value)}})}/></label>)}
  {workspace&&<><AgentToolSelection config={config} workspace={workspace} readOnly={disabled} onChange={patch}/><CapabilitySelection title="允许使用的 Skill" hint="Runtime Skills 默认可用；取消选择只停止自动接入，不改变图内显式能力连线。" readOnly={disabled} items={(workspace.skills||[]).map(s=>({...s,enabled:s.enabled&&!s.diskError}))} selected={resolveAgentCapabilities({...agent,config},workspace).config!.skillIds} onChange={skillIds=>patch({skillIds,skillFolderIds:[],startupSkillIds:(config.startupSkillIds||[]).filter(id=>skillIds.includes(id))})} empty="尚无可用技能。"/></>}
  {error&&<p className="danger" role="alert">{error}</p>}
 </fieldset>
}
