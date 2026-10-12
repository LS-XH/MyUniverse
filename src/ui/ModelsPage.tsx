import {registeredTools} from '../model/builtinTools'
import { useEffect, useRef, useState } from 'react'
import { Bot, Eye, EyeOff, Plus, RefreshCw, Play, Trash2 } from 'lucide-react'
import { ModelConnection, ToolDefinition, AgentDefinition, Workspace } from '../model/types'
import { createModel, deleteModel, modelReady } from '../model/models'
import { callLLM, discoverModels } from '../services/llm'


function CapabilitySelection({title,hint,items,selected,onChange,empty}:{title:string;hint:string;items:{id:string;name:string;enabled:boolean;description?:string}[];selected:string[];onChange:(ids:string[])=>void;empty:string}) {
 return <fieldset className="model-field-wide model-capabilities ui-surface ui-panel ui-panel--tool-models ui-panel--themed ui-panel--text ui-surface--bordered">
  <legend>{title}<span className="model-capability-count">已接入 {selected.length}</span></legend><p>{hint}</p>
  <div className="model-capability-grid">{items.map(item=><label key={item.id} className="model-capability-option ui-surface ui-card" data-selected={selected.includes(item.id)} data-disabled={!item.enabled}>
   <input type="checkbox" aria-label={title+'：'+item.name} checked={selected.includes(item.id)} disabled={!item.enabled&&!selected.includes(item.id)} onChange={e=>onChange(e.target.checked?[...new Set([...selected,item.id])]:selected.filter(id=>id!==item.id))}/>
   <span><strong>{item.name}</strong>{item.description&&<small>{item.description}</small>}{!item.enabled&&<small>已停用</small>}</span>
  </label>)}</div>
  {!items.length&&<p>{empty}</p>}
  {selected.filter(id=>!items.some(item=>item.id===id)).length>0&&<div className="model-capability-missing"><span>部分已接入项已删除</span><button className="ui-surface ui-button ui-button--ghost ui-button--standard" onClick={()=>onChange(selected.filter(id=>items.some(item=>item.id===id)))}>移除失效接入</button></div>}
 </fieldset>
}
function ModelCard({model,onChange,onDelete,tools,agents}:{model:ModelConnection;onChange:(patch:Partial<ModelConnection>)=>void;onDelete:()=>void;tools:ToolDefinition[];agents:AgentDefinition[]}) {
  const [showKey,setShowKey]=useState(false),[available,setAvailable]=useState<string[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[test,setTest]=useState(''),[testing,setTesting]=useState(false)
  const discovery=useRef<AbortController|null>(null),testController=useRef<AbortController|null>(null),version=useRef(0)
  const refresh=async()=>{
    discovery.current?.abort();const controller=new AbortController();discovery.current=controller;const current=++version.current
    setLoading(true);setError('')
    try{const values=await discoverModels(model,controller.signal);if(version.current===current&&!controller.signal.aborted)setAvailable(values)}catch(e){if(version.current===current&&!controller.signal.aborted)setError(String(e))}finally{if(version.current===current)setLoading(false)}
  }
  useEffect(()=>{setAvailable([]);setError('');setLoading(false);if(!model.baseUrl.trim())return;const timer=setTimeout(refresh,800);return()=>{clearTimeout(timer);discovery.current?.abort();version.current++}},[model.baseUrl,model.modelsUrl,model.apiKey])
  useEffect(()=>()=>{discovery.current?.abort();testController.current?.abort()},[])
  const numeric=(key:'temperature'|'topP'|'maxTokens'|'timeoutSeconds',label:string,min:number,max:number,step:number)=><label>{label}<input type="number" min={min} max={max} step={step} value={model[key]??''} placeholder="使用服务默认值" onChange={e=>onChange({[key]:e.target.value===''?undefined:Number(e.target.value)})} className="ui-surface ui-field"/></label>
  return <section className="model-card ui-card--model ui-surface ui-card ui-card--themed ui-surface--bordered"><header><div className="model-card-heading"><Bot size={19}/><strong>{model.name}</strong><span className="model-status ui-badge--status ui-surface ui-badge ui-surface--bordered">{!model.enabled?'已停用':modelReady(model)?'已配置':'待完善'}</span></div><button className="icon-button ui-button--icon danger ui-surface ui-button" title={`删除模型 ${model.name}`} onClick={onDelete}><Trash2 size={16}/></button></header><div className="model-form">
    <label>显示名称<input value={model.name} onChange={e=>onChange({name:e.target.value})} className="ui-surface ui-field"/></label>
    <label>模型标识<input list={`models-${model.id}`} value={model.model} onChange={e=>onChange({model:e.target.value})} placeholder="选择已获取模型或手动输入" className="ui-surface ui-field"/><datalist id={`models-${model.id}`}>{available.map(id=><option key={id} value={id}/>)}</datalist></label>
    <label className="model-field-wide">基础 URL<input value={model.baseUrl} onChange={e=>onChange({baseUrl:e.target.value})} placeholder="http://localhost:11434/v1 或 https://…/v1" spellCheck={false} className="ui-surface ui-field"/></label>
    <label>模型列表 URL（可选）<input value={model.modelsUrl||''} onChange={e=>onChange({modelsUrl:e.target.value})} placeholder="默认：基础 URL /models" className="ui-surface ui-field"/></label>
    <label>生成 URL（可选）<input value={model.chatUrl||''} onChange={e=>onChange({chatUrl:e.target.value})} placeholder="默认：基础 URL /chat/completions" className="ui-surface ui-field"/></label>
    <label className="model-field-wide">API Key<div className="model-key-input"><input type={showKey?'text':'password'} autoComplete="new-password" value={model.apiKey} onChange={e=>onChange({apiKey:e.target.value})} placeholder="本地无鉴权接口可留空" className="ui-surface ui-field"/><button className="icon-button ui-button--icon ui-surface ui-button" title={showKey?'隐藏密钥':'显示密钥'} onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
    <label>推理强度<select value={model.reasoningEffort||''} onChange={e=>onChange({reasoningEffort:e.target.value})} className="ui-surface ui-field"><option value="">不发送此参数</option>{['none','minimal','low','medium','high','xhigh'].map(e=><option key={e}>{e}</option>)}</select></label>
    {numeric('temperature','Temperature',0,2,.1)}{numeric('topP','Top P',0,1,.05)}{numeric('maxTokens','最大输出 Tokens',1,1000000,1)}{numeric('timeoutSeconds','超时（秒）',1,600,1)}
    <label className="model-field-wide">附加请求参数 JSON<textarea value={model.extraBody||''} onChange={e=>onChange({extraBody:e.target.value})} placeholder={'{"max_tokens": 4096}'} rows={3} className="ui-surface ui-field"/></label>
    <label className="model-field-wide">聊天系统提示词<textarea className="ui-surface ui-field" rows={4} value={model.chatSystemPrompt||''} onChange={e=>onChange({chatSystemPrompt:e.target.value})} placeholder="仅用于聊天直接调用此模型；工作流使用显式 Messages"/></label>
    <CapabilitySelection title="接入工具" hint="聊天直连及兼容自动 ToolCalls 可调用这些工具。" items={tools} selected={model.toolIds||[]} onChange={toolIds=>onChange({toolIds})} empty="在插件 → 工具中新建工具后接入。"/>
    <CapabilitySelection title="接入子 Agent" hint="由模型按任务自主调用；子 Agent 使用自己的工作流、模型和参数契约。" items={agents.map(a=>({...a,enabled:a.enabled!==false}))} selected={model.agentIds||[]} onChange={agentIds=>onChange({agentIds})} empty="在模型页新建 Agent 后接入。"/>
  </div><div className="model-service-actions"><label className="model-enabled"><input type="checkbox" checked={model.enabled} onChange={e=>onChange({enabled:e.target.checked})} className="ui-surface ui-field"/> 启用模型</label><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={loading||!model.baseUrl} onClick={refresh}><RefreshCw size={14}/>{loading?'正在获取…':`获取模型列表${available.length?` (${available.length})`:''}`}</button><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={testing||!modelReady(model)||!model.enabled} onClick={async()=>{setTesting(true);setTest('');const controller=new AbortController();testController.current=controller;try{setTest(await callLLM(model,[{role:'user',content:'请简短回复：连接成功。'}],controller.signal))}catch(e){setTest(String(e))}finally{setTesting(false)}}}><Play size={14}/>{testing?'测试中…':'测试生成'}</button></div>{error&&<div className="document-error ui-alert--document ui-surface ui-alert" role="alert">获取模型列表失败：{error}。可以继续手动填写 model。</div>}{test&&<pre className="workflow-result ui-value--workflow ui-surface ui-value">{test}</pre>}
  </section>
}
export default function ModelsPage({workspace,onChange,selectedId,onSelect}:{workspace:Workspace;onChange:(workspace:Workspace)=>void;selectedId:string|null;onSelect:(id:string|null)=>void}) {
  const models=workspace.models||[],shown=selectedId?models.filter(m=>m.id===selectedId):models
  const add=()=>{const model=createModel(models);onChange({...workspace,models:[...models,model]});onSelect(model.id)}
  return <div className="model-management-page"><div className="page-heading"><div><div className="eyebrow">LLM · OPENAI COMPATIBLE API</div><h1>{selectedId?shown[0]?.name||'模型不存在':'LLM 模型'}</h1><p>基础 URL 与密钥变更后自动获取模型列表。未填写的可选参数不发送，由服务决定默认值。</p></div><div className="heading-actions"><button className="primary ui-button--primary ui-surface ui-button ui-button--elevated ui-button--standard" onClick={add}><Plus size={17}/> 新建模型</button>{selectedId&&<button className="ghost ui-button--ghost danger ui-surface ui-button ui-button--elevated ui-button--standard" onClick={()=>{if(confirm('删除此模型连接？')){onChange(deleteModel(workspace,selectedId));onSelect(null)}}}><Trash2 size={16}/> 删除模型</button>}</div></div><div className="model-management-scroll">{shown.length?<div className="model-cards">{shown.map(model=><ModelCard agents={workspace.agents||[]} tools={registeredTools(workspace)} key={model.id} model={model} onChange={patch=>onChange({...workspace,models:models.map(item=>item.id===model.id?{...item,...patch}:item)})} onDelete={()=>{if(confirm(`删除模型 ${model.name}？`)){onChange(deleteModel(workspace,model.id));if(selectedId===model.id)onSelect(null)}}}/>)}</div>:<div className="empty-card ui-panel--empty ui-surface ui-panel ui-panel--themed ui-panel--text"><Bot size={30}/><h2>添加 LLM 模型</h2><button className="primary ui-button--primary ui-surface ui-button ui-button--standard" onClick={add}><Plus size={17}/> 新建模型</button></div>}</div></div>
}
