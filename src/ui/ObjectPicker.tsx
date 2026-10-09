import { FieldValue, ObjectSelection, World } from '../model/types'

export default function ObjectPicker({world,value,onChange,mode='any'}:{world?:World;value:ObjectSelection;onChange:(value:ObjectSelection)=>void;mode?:'any'|'entity'|'member'}) {
  const doc=world?.documents.find(d=>d.id===value.classId),entity=doc?.entities.find(e=>e.id===value.entityId)
  const levels:FieldValue[][]=[]
  if(entity&&mode!=='entity'){
    let fields=entity.fields;levels.push(fields)
    for(const id of value.path){const member=fields.find(f=>f.id===id);if(!member?.children.length)break;fields=member.children;levels.push(fields)}
  }
  const label=(key:string)=>key.replace(/^\[([^\]]+)\]\(.+\)$/,'$1')
  return <div className="object-picker"><label>Class<select aria-label="对象类型 Class" value={value.classId} onChange={e=>onChange({classId:e.target.value,entityId:'',path:[]})}><option value="">选择类</option>{world?.documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>实例<select aria-label="对象实例" value={value.entityId} disabled={!doc} onChange={e=>onChange({...value,entityId:e.target.value,path:[]})}><option value="">选择实例</option>{doc?.entities.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{levels.map((fields,level)=><label key={level}>属性成员 {level+1}<select aria-label={`属性成员 ${level+1}`} value={value.path[level]||''} onChange={e=>onChange({...value,path:[...value.path.slice(0,level),...(e.target.value?[e.target.value]:[])]})}><option value="">{level===0&&mode==='member'?'选择属性':'读取当前对象全部内容'}</option>{fields.map(f=><option key={f.id} value={f.id}>{label(f.key)||'未命名属性'}</option>)}</select></label>)}{value.classId&&!doc&&<span role="alert">所选类已不存在</span>}{value.entityId&&!entity&&<span role="alert">所选实例已不存在</span>}{!world&&<span className="muted">请先创建或选择一个世界项目。</span>}</div>
}
