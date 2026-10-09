import { useEffect, useRef, useState } from 'react'
import { Bot, Eye, EyeOff, Plus, RefreshCw, Play, Trash2 } from 'lucide-react'
import { ModelConnection, Workspace } from '../model/types'
import { createModel, deleteModel, modelReady } from '../model/models'
import { callLLM, discoverModels } from '../services/llm'

function ModelCard({model,onChange,onDelete}:{model:ModelConnection;onChange:(patch:Partial<ModelConnection>)=>void;onDelete:()=>void}) {
  const [showKey,setShowKey]=useState(false),[available,setAvailable]=useState<string[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[test,setTest]=useState(''),[testing,setTesting]=useState(false)
  const discovery=useRef<AbortController|null>(null),testController=useRef<AbortController|null>(null),version=useRef(0)
  const refresh=async()=>{
    discovery.current?.abort();const controller=new AbortController();discovery.current=controller;const current=++version.current
    setLoading(true);setError('')
    try{const values=await discoverModels(model,controller.signal);if(version.current===current&&!controller.signal.aborted)setAvailable(values)}catch(e){if(version.current===current&&!controller.signal.aborted)setError(String(e))}finally{if(version.current===current)setLoading(false)}
  }
  useEffect(()=>{setAvailable([]);setError('');setLoading(false);if(!model.baseUrl.trim())return;const timer=setTimeout(refresh,800);return()=>{clearTimeout(timer);discovery.current?.abort();version.current++}},[model.baseUrl,model.modelsUrl,model.apiKey])
  useEffect(()=>()=>{discovery.current?.abort();testController.current?.abort()},[])
  const numeric=(key:'temperature'|'topP'|'maxTokens'|'timeoutSeconds',label:string,min:number,max:number,step:number)=><label>{label}<input type="number" min={min} max={max} step={step} value={model[key]??''} placeholder="使用服务默认值" onChange={e=>onChange({[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>
  return <section className="model-card"><header><div className="model-card-heading"><Bot size={19}/><strong>{model.name}</strong><span className="model-status">{!model.enabled?'已停用':modelReady(model)?'已配置':'待完善'}</span></div><button className="icon-button danger" title={`删除模型 ${model.name}`} onClick={onDelete}><Trash2 size={16}/></button></header><div className="model-form">
    <label>显示名称<input value={model.name} onChange={e=>onChange({name:e.target.value})}/></label>
    <label>模型标识<input list={`models-${model.id}`} value={model.model} onChange={e=>onChange({model:e.target.value})} placeholder="选择已获取模型或手动输入"/><datalist id={`models-${model.id}`}>{available.map(id=><option key={id} value={id}/>)}</datalist></label>
    <label className="model-field-wide">基础 URL<input value={model.baseUrl} onChange={e=>onChange({baseUrl:e.target.value})} placeholder="http://localhost:11434/v1 或 https://…/v1" spellCheck={false}/></label>
    <label>模型列表 URL（可选）<input value={model.modelsUrl||''} onChange={e=>onChange({modelsUrl:e.target.value})} placeholder="默认：基础 URL /models"/></label>
    <label>生成 URL（可选）<input value={model.chatUrl||''} onChange={e=>onChange({chatUrl:e.target.value})} placeholder="默认：基础 URL /chat/completions"/></label>
    <label className="model-field-wide">API Key<div className="model-key-input"><input type={showKey?'text':'password'} autoComplete="new-password" value={model.apiKey} onChange={e=>onChange({apiKey:e.target.value})} placeholder="本地无鉴权接口可留空"/><button className="icon-button" title={showKey?'隐藏密钥':'显示密钥'} onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
    <label>推理强度<select value={model.reasoningEffort||''} onChange={e=>onChange({reasoningEffort:e.target.value})}><option value="">不发送此参数</option>{['none','minimal','low','medium','high','xhigh'].map(e=><option key={e}>{e}</option>)}</select></label>
    {numeric('temperature','Temperature',0,2,.1)}{numeric('topP','Top P',0,1,.05)}{numeric('maxTokens','最大输出 Tokens',1,1000000,1)}{numeric('timeoutSeconds','超时（秒）',1,600,1)}
    <label className="model-field-wide">附加请求参数 JSON<textarea value={model.extraBody||''} onChange={e=>onChange({extraBody:e.target.value})} placeholder={'{"max_tokens": 4096}'} rows={3}/></label>
  </div><div className="model-service-actions"><label className="model-enabled"><input type="checkbox" checked={model.enabled} onChange={e=>onChange({enabled:e.target.checked})}/> 启用模型</label><button className="ghost" disabled={loading||!model.baseUrl} onClick={refresh}><RefreshCw size={14}/>{loading?'正在获取…':`获取模型列表${available.length?` (${available.length})`:''}`}</button><button className="ghost" disabled={testing||!modelReady(model)||!model.enabled} onClick={async()=>{setTesting(true);setTest('');const controller=new AbortController();testController.current=controller;try{setTest(await callLLM(model,[{role:'user',content:'请简短回复：连接成功。'}],controller.signal))}catch(e){setTest(String(e))}finally{setTesting(false)}}}><Play size={14}/>{testing?'测试中…':'测试生成'}</button></div>{error&&<div className="document-error" role="alert">获取模型列表失败：{error}。可以继续手动填写 model。</div>}{test&&<pre className="workflow-result">{test}</pre>}
  </section>
}
export default function ModelsPage({workspace,onChange,selectedId,onSelect}:{workspace:Workspace;onChange:(workspace:Workspace)=>void;selectedId:string|null;onSelect:(id:string|null)=>void}) {
  const models=workspace.models||[],shown=selectedId?models.filter(m=>m.id===selectedId):models
  const add=()=>{const model=createModel(models);onChange({...workspace,models:[...models,model]});onSelect(model.id)}
  return <div className="model-management-page"><div className="page-heading"><div><div className="eyebrow">LLM · OPENAI COMPATIBLE API</div><h1>{selectedId?shown[0]?.name||'模型不存在':'LLM 模型'}</h1><p>基础 URL 与密钥变更后自动获取模型列表。未填写的可选参数不发送，由服务决定默认值。</p></div><div className="heading-actions"><button className="primary" onClick={add}><Plus size={17}/> 新建模型</button>{selectedId&&<button className="ghost danger" onClick={()=>{if(confirm('删除此模型连接？')){onChange(deleteModel(workspace,selectedId));onSelect(null)}}}><Trash2 size={16}/> 删除模型</button>}</div></div><div className="model-management-scroll">{shown.length?<div className="model-cards">{shown.map(model=><ModelCard key={model.id} model={model} onChange={patch=>onChange({...workspace,models:models.map(item=>item.id===model.id?{...item,...patch}:item)})} onDelete={()=>{if(confirm(`删除模型 ${model.name}？`)){onChange(deleteModel(workspace,model.id));if(selectedId===model.id)onSelect(null)}}}/>)}</div>:<div className="empty-card"><Bot size={30}/><h2>添加 LLM 模型</h2><button className="primary" onClick={add}><Plus size={17}/> 新建模型</button></div>}</div></div>
}
