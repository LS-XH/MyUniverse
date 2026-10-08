import SortHandle, { reorder } from './SortHandle'
import { CircleHelp, Plus, Settings, Trash2 } from 'lucide-react'
import { ClassDocument, FieldSchema, KeyType, ValueType, World, uid } from '../model/types'

const valueTypes:ValueType[]=['Object','Class','Data','Text','Content','Integer','Decimal','Null']
const keyTypes:KeyType[]=['Const','Text','Class']


function SchemaRow({world,field,onChange,onDelete,onMove}:{world:World;field:FieldSchema;onChange:(field:FieldSchema)=>void;onDelete:()=>void;onMove:(from:string,to:string,after:boolean)=>void}) {
  const set=(patch:Partial<FieldSchema>)=>onChange({...field,...patch})
  return <div className="schema-row" data-sort-id={field.id}>
    <div className="schema-line"><SortHandle id={field.id} onMove={onMove}/ >
      <select value={field.keyType} onChange={e=>set({keyType:e.target.value as KeyType,key:e.target.value==='Const'?field.key:''})}>{keyTypes.map(type=><option key={type}>{type}</option>)}</select>
      {field.keyType==='Class'?<select value={field.classId||''} onChange={e=>set({classId:e.target.value})}><option value="">选择类</option>{world.documents.map(doc=><option key={doc.id} value={doc.id}>{doc.name}</option>)}</select>:<input value={field.key} placeholder={field.keyType==='Const'?'固定属性名':'属性名 / #提示文字#'} onChange={e=>set({key:e.target.value,placeholder:e.target.value.match(/#(.+)#/)?.[1]})}/>}
      <span className="schema-arrow">→</span><select value={field.valueType} onChange={e=>set({valueType:e.target.value as ValueType,children:e.target.value==='Object'?(field.children||[]):undefined})}>{valueTypes.map(type=><option key={type}>{type}</option>)}</select>
      {field.valueType==='Class'&&<select value={field.classId||''} onChange={e=>set({classId:e.target.value})}><option value="">选择类</option>{world.documents.map(doc=><option key={doc.id} value={doc.id}>{doc.name}</option>)}</select>}
      <label className="repeat-toggle"><input type="checkbox" checked={!!field.repeatable} onChange={e=>set({repeatable:e.target.checked})}/> 可重复</label><button className="icon-button subtle" title="删除属性" onClick={onDelete}><Trash2 size={15}/></button>
    </div>
    {field.valueType==='Object'&&<div className="schema-children">{(field.children||[]).map(child=><SchemaRow key={child.id} world={world} field={child} onChange={next=>set({children:field.children?.map(item=>item.id===next.id?next:item)})} onDelete={()=>set({children:field.children?.filter(item=>item.id!==child.id)})} onMove={(from,to,after)=>set({children:reorder(field.children||[],from,to,after)})}/>)}<button className="add-inline" onClick={()=>set({children:[...(field.children||[]),{id:uid(),keyType:'Const',key:'新属性',valueType:'Text'}]})}><Plus size={14}/> 添加子属性</button></div>}
  </div>
}

export default function SchemaEditor({world,doc,onChange}:{world:World;doc:ClassDocument;onChange:(doc:ClassDocument)=>void}) {
  return <div className="page-scroll"><div className="page-heading"><div><div className="eyebrow">ATTRIBUTE SCHEMA · {doc.fileName.replace('.md','.schema.json')}</div><h1>{doc.name}属性配置</h1><p>定义每个实例的键和值。拖动左侧手柄调整顺序。</p></div></div><div className="schema-panel"><div className="panel-title"><Settings size={17}/> 属性结构 <span>{doc.schema.length} 项</span></div>{doc.schema.map(field=><SchemaRow key={field.id} world={world} field={field} onChange={next=>onChange({...doc,schema:doc.schema.map(item=>item.id===next.id?next:item)})} onDelete={()=>onChange({...doc,schema:doc.schema.filter(item=>item.id!==field.id)})} onMove={(from,to,after)=>onChange({...doc,schema:reorder(doc.schema,from,to,after)})}/>)}<button className="add-schema" onClick={()=>onChange({...doc,schema:[...doc.schema,{id:uid(),keyType:'Const',key:'新属性',valueType:'Text'}]})}><Plus size={16}/> 添加属性</button></div><div className="hint-card"><CircleHelp size={18}/><div><strong>属性如何保存？</strong><p>结构写入 JSON，实例写入 Markdown。Object 可包含固定或可重复的子属性。</p></div></div></div>
}
