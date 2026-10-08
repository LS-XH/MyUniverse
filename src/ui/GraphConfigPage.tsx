import { useState } from 'react'
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { Entity, GraphStyle, World } from '../model/types'
import ColorPicker from './ColorPicker'

const freshStyle=(color:string):GraphStyle=>({fill:color,stroke:color,glow:8,lineType:'实线',pattern:'纯色',fontSize:13,lineWidth:2.5})
export default function GraphConfigPage({world,onChange}:{world:World;onChange:(world:World)=>void}) {
  const relations=world.documents.find(doc=>doc.id==='relations')?.entities||[]
  const factions=world.documents.find(doc=>doc.id==='factions')?.entities||[]
  const [adding,setAdding]=useState<'lineStyles'|'domainStyles'|null>(null)
  const updateStyles=(key:'lineStyles'|'domainStyles',styles:Record<string,GraphStyle>)=>onChange({...world,graph:{...world.graph,[key]:styles}})
  const section=(title:string,key:'lineStyles'|'domainStyles',items:Entity[])=>{
    const styles=world.graph[key],available=items.filter(item=>!styles[item.id])
    return <div className="schema-panel graph-config-section"><div className="panel-title"><Settings2 size={17}/>{title}<button className="mini-add" title="添加映射" onClick={()=>setAdding(adding===key?null:key)}><Plus size={16}/></button></div>
      {adding===key&&<div className="graph-add-mapping"><select autoFocus value="" onChange={e=>{if(e.target.value){updateStyles(key,{...styles,[e.target.value]:freshStyle(key==='lineStyles'?'#FFA78BFA':'#FF60BFA9')});setAdding(null)}}}><option value="">选择{key==='lineStyles'?'关系':'势力'}实例…</option>{available.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{!available.length&&<span>请先创建{key==='lineStyles'?'关系':'势力'}实例</span>}</div>}
      {Object.entries(styles).map(([id,style])=>{const item=items.find(value=>value.id===id);if(!item)return null;const set=(patch:Partial<GraphStyle>)=>updateStyles(key,{...styles,[id]:{...style,...patch}});return <div className="graph-style-card" key={id}><div className="graph-style-head"><select aria-label="映射实例" value={id} onChange={e=>{const next={...styles};delete next[id];next[e.target.value]=style;updateStyles(key,next)}}>{items.filter(value=>value.id===id||!styles[value.id]).map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select><button className="icon-button subtle" title="删除映射" onClick={()=>{const next={...styles};delete next[id];updateStyles(key,next)}}><Trash2 size={15}/></button></div><div className="graph-style-controls"><ColorPicker label="填充颜色" value={style.fill} onChange={fill=>set({fill})}/><ColorPicker label="边框颜色" value={style.stroke} onChange={stroke=>set({stroke})}/><label>发光范围<input type="number" min="0" max="40" value={style.glow} onChange={e=>set({glow:Number(e.target.value)})}/></label><label>{key==='lineStyles'?'线条类型':'填充图案'}<select value={key==='lineStyles'?style.lineType:style.pattern} onChange={e=>set(key==='lineStyles'?{lineType:e.target.value}:{pattern:e.target.value})}>{(key==='lineStyles'?['实线','长划线','短划线','双实线','长划线点线']:['纯色','点阵','斜线','虚线','网格']).map(value=><option key={value}>{value}</option>)}</select></label>{key==='lineStyles'&&<label>线条粗细（px）<input aria-label="线条粗细（px）" type="number" min="0.5" max="20" step="0.5" value={style.lineWidth??2.5} onChange={e=>set({lineWidth:Math.max(.5,Math.min(20,Number(e.target.value)||.5))})}/></label>}{key==='lineStyles'&&<label>文字大小<input type="number" min="9" max="30" value={style.fontSize||13} onChange={e=>set({fontSize:Number(e.target.value)})}/></label>}</div></div>})}
      {!Object.keys(styles).length&&!adding&&<div className="config-empty">点击 +，选择一个{key==='lineStyles'?'关系':'势力'}实例</div>}
    </div>
  }
  return <div className="page-scroll"><div className="page-heading"><div><div className="eyebrow">VIEW CONFIG · 关系网.json</div><h1>关系网配置</h1><p>选择关系和势力实例，为连线及背景域配置显示效果。</p></div></div><label className="setting-toggle"><input type="checkbox" checked={world.graph.showDomains} onChange={e=>onChange({...world,graph:{...world.graph,showDomains:e.target.checked}})}/> 显示势力背景域</label>{section('关系连线格式','lineStyles',relations)}{section('背景块格式','domainStyles',factions)}</div>
}
