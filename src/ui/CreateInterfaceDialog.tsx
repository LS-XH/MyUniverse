import Select from './Select'
import {useState} from 'react'
import {Plus,X} from 'lucide-react'
import {InterfaceKind,World,uid} from '../model/types'
import {createInterfaceView,updateInterfaceView} from '../model/interfaceViews'

const names:Record<InterfaceKind,string>={graph:'人物关系网',relationGraph:'关系类型网',map:'地图'}
export default function CreateInterfaceDialog({world,parentId,initialClassId,onChange,onSelect,onClose}:{world:World;parentId:string|null;initialClassId?:string;onChange:(world:World)=>void;onSelect:(selection:{nodeId:string;config?:boolean})=>void;onClose:()=>void}){
 const [kind,setKind]=useState<InterfaceKind>(initialClassId==='relations'?'relationGraph':initialClassId&&initialClassId!=='people'?'map':'graph')
 const [name,setName]=useState(names[kind]),[classId,setClassId]=useState(initialClassId||world.documents[0]?.id||''),[error,setError]=useState('')
 const parentClassId=kind==='graph'?'people':kind==='relationGraph'?'relations':classId
 return <div className="modal-backdrop" onPointerDown={onClose}><form className="modal ui-dialog--standard create-interface-dialog ui-surface ui-dialog ui-dialog--themed ui-dialog--text" onPointerDown={e=>e.stopPropagation()} onSubmit={e=>{
  e.preventDefault()
  try{
   const view=createInterfaceView(world,parentClassId,kind,name.trim()||names[kind],uid())
   const next=updateInterfaceView({...world,nodes:[...world.nodes,{id:view.id,name:view.name,type:'view',viewType:kind,classId:view.parentClassId,parentId}]},view)
   onChange(next);onSelect({nodeId:view.id,config:true});onClose()
  }catch(failure){setError(String(failure))}
 }}><div className="panel-title">新建界面操作类型<button type="button" className="icon-button ui-button--icon ui-surface ui-button" aria-label="关闭新建界面" onClick={onClose}><X size={17}/></button></div>
  <label>界面类型<Select aria-label="界面类型" value={kind} onChange={e=>{const value=e.target.value as InterfaceKind;setKind(value);setName(names[value]);setError('')}} className="ui-surface ui-field"><option value="graph">人物关系网</option><option value="relationGraph">关系类型网</option><option value="map">地图</option></Select></label>
  {kind==='map'&&<label>父文件类型<Select aria-label="父文件类型" value={classId} onChange={e=>setClassId(e.target.value)} required className="ui-surface ui-field"><option value="">选择文件操作类型</option>{world.documents.map(d=><option key={d.id} value={d.id}>{d.name} · {d.fileName}</option>)}</Select></label>}
  <label>名称<input aria-label="名称" value={name} onChange={e=>setName(e.target.value)} required className="ui-surface ui-field"/></label>
  {error&&<p className="danger" role="alert">{error}</p>}
  <div className="modal-actions"><button className="primary ui-button--primary ui-surface ui-button ui-button--standard" type="submit" disabled={!world.documents.some(d=>d.id===parentClassId)}><Plus size={16}/> 创建并配置</button></div>
 </form></div>
}
