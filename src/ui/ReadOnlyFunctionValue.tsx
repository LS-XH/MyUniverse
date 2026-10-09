import { ChevronDown } from 'lucide-react'
import { classLink } from '../model/markdown'
import { FieldSchema, TypedValue, World } from '../model/types'

function ReferenceValue({world,classId,entityId,reference}:{world:World;classId?:string;entityId?:string;reference?:string}) {
  const matches=world.documents.flatMap(doc=>doc.entities.map(entity=>({doc,entity})))
  const selected=matches.find(item=>reference?classLink(world,item.doc.id,item.entity.id)===reference:item.doc.id===classId&&item.entity.id===entityId)
  return <div className="reference-picker"><button className="reference-trigger" disabled aria-label={selected?`${selected.doc.name}：${selected.entity.name}`:'返回的对象引用'}>{selected?<><span className="reference-class">{selected.doc.name}</span>{selected.entity.name}</>:<span className="muted">{reference||'引用对象已不存在'}</span>}<ChevronDown size={14}/></button></div>
}

/** Use member editor styling without any write handlers or picker menus. */
export default function ReadOnlyFunctionValue({world,value,schemas,depth=0,label='函数返回值'}:{world:World;value:TypedValue;schemas?:FieldSchema[];depth?:number;label?:string}) {
  if(value.type==='Object'){
    const children=schemas||world.documents.find(doc=>doc.id===value.classId)?.schema
    return <div className="object-body function-object-value">{value.members?.length?value.members.map((member,index)=>{
      const schema=children?.find(s=>member.schemaId?s.id===member.schemaId:s.key===member.key)
      const reference=world.documents.some(doc=>doc.entities.some(entity=>classLink(world,doc.id,entity.id)===member.key))
      return <div className={`field field-depth-${Math.min(depth,3)}`} key={member.id||`${index}:${member.key}`}><div className="field-head"><div className="field-key-wrap">{schema?.keyType==='Class'||reference?<ReferenceValue world={world} reference={member.key}/>:schema?.keyType==='Text'?<input className="field-key" aria-label="返回属性名称" readOnly value={member.key}/>:<span className="field-label">{member.key}</span>}</div></div><ReadOnlyFunctionValue world={world} value={member.value} schemas={schema?.children} depth={depth+1} label={member.key}/></div>
    }):<div className="null-value">无子成员</div>}</div>
  }
  if(value.type==='Class')return <ReferenceValue world={world} classId={value.classId} entityId={value.entityId}/>
  if(value.type==='Null')return <div className="null-value">无内容</div>
  const text=String(value.value??'')
  if(value.type==='Content')return <div className="text-reference text-reference-content"><textarea readOnly aria-label={`${label}（只读）`} value={text}/></div>
  return <div className="text-reference text-reference-short" data-value={text}><input readOnly aria-label={`${label}（只读）`} value={text} inputMode={value.type==='Integer'||value.type==='Decimal'?'decimal':'text'} placeholder={value.type==='Data'?'YYYYMMDD':undefined}/></div>
}
