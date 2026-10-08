import { useEffect, useRef, useState } from 'react'
import { Bot, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Workspace } from '../model/types'
import { createModel, deleteModel, modelReady } from '../model/models'

export default function ModelsPage({workspace,onChange,selectedId,onSelect}:{workspace:Workspace;onChange:(workspace:Workspace)=>void;selectedId:string|null;onSelect:(id:string|null)=>void}) {
  const models=workspace.models||[]
  const [visibleKeys,setVisibleKeys]=useState<Record<string,boolean>>({})
  const cards=useRef<Record<string,HTMLElement|null>>({})
  const add=()=>{const model=createModel(models);onChange({...workspace,models:[...models,model]});onSelect(model.id)}
  useEffect(()=>{if(selectedId)cards.current[selectedId]?.scrollIntoView({behavior:'smooth',block:'nearest'})},[selectedId])
  return <div className="page-scroll models-page"><div className="page-heading"><div><div className="eyebrow">MODEL CONNECTIONS</div><h1>模型</h1><p>管理模型的接口地址、模型标识与访问密钥，在聊天框中选择使用。</p></div><div className="heading-actions"><button className="primary" onClick={add}><Plus size={17}/> 添加接入模型</button></div></div>
    {!models.length?<div className="empty-card"><Bot size={30}/><h2>添加第一个模型</h2><p>填写支持 OpenAI 兼容格式的模型连接配置。</p><button className="primary" onClick={add}><Plus size={17}/> 添加接入模型</button></div>:<div className="model-cards">{models.map(model=>{
      const update=(patch:Partial<typeof model>)=>onChange({...workspace,models:models.map(item=>item.id===model.id?{...item,...patch}:item)})
      return <section key={model.id} ref={element=>{cards.current[model.id]=element}} className={`model-card ${selectedId===model.id?'selected':''}`}><header><div className="model-card-heading"><Bot size={19}/><strong>{model.name||'未命名模型'}</strong><span className="model-status">{!model.enabled?'已停用':modelReady(model)?'已配置':'待完善'}</span></div><button className="icon-button model-delete" title={`删除模型 ${model.name}`} onClick={()=>{onChange(deleteModel(workspace,model.id));if(selectedId===model.id)onSelect(null)}}><Trash2 size={16}/></button></header><div className="model-form">
        <label>显示名称<input aria-label="显示名称" value={model.name} onChange={e=>update({name:e.target.value})} placeholder="例如：本地写作模型"/></label>
        <label>模型标识<input aria-label="模型标识" value={model.model} onChange={e=>update({model:e.target.value})} placeholder="接口提供的 model 名称" spellCheck={false}/></label>
        <label className="model-field-wide">接口地址<input aria-label="接口地址" value={model.baseUrl} onChange={e=>update({baseUrl:e.target.value})} placeholder="https://your-provider.example/v1" spellCheck={false}/></label>
        <label className="model-field-wide">API Key<div className="model-key-input"><input aria-label="API Key" type={visibleKeys[model.id]?'text':'password'} autoComplete="new-password" value={model.apiKey} onChange={e=>update({apiKey:e.target.value})} placeholder="本地无鉴权接口可留空" spellCheck={false}/><button className="icon-button" title={visibleKeys[model.id]?'隐藏密钥':'显示密钥'} onClick={()=>setVisibleKeys({...visibleKeys,[model.id]:!visibleKeys[model.id]})}>{visibleKeys[model.id]?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
      </div><label className="model-enabled"><input type="checkbox" checked={model.enabled} onChange={e=>update({enabled:e.target.checked})}/> 在聊天模型菜单中显示</label></section>
    })}</div>}
  </div>
}
