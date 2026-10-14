import {memo,type MutableRefObject,type MouseEvent} from 'react'
import {ChevronDown,ChevronRight,PencilLine,Plus,Trash2} from 'lucide-react'
import type {ClassDocument,Entity,World} from '../model/types'
import EntityCard from './EntityCard'
import SortHandle from './SortHandle'
import {FieldEditor,freshField,findSchema} from './App'
import {toCssColor} from './ColorPicker'
import {prepareCardMotion} from './cardMotion'

export interface InstanceCommands {
 update:(entity:Entity)=>void;remove:(id:string)=>void;reorder:(from:string,to:string,after:boolean)=>void
 toggle:(id:string)=>void;select:(event:MouseEvent,id:string)=>void
}
interface Props {world:World;doc:ClassDocument;entity:Entity;expanded:boolean;selected:boolean;highlight:boolean;dirty:boolean;label?:string;visibleIds?:ReadonlySet<string>;references:string;commands:MutableRefObject<InstanceCommands>}
/** Background results rerender their card; untouched instances retain DOM and motion observers. */
function InstanceListCard({world,doc,entity,expanded,selected,highlight,dirty,label,visibleIds,commands}:Props){
 const update=(next:Entity)=>commands.current.update(next)
 return <EntityCard className={`entity-card ui-card--entity ${highlight?'entity-focused':''} ${selected?'instance-selected':''} ui-surface ui-card ui-card--themed ui-card--text`} data-sort-id={entity.id} data-instance-card={entity.id} onPointerEnter={event=>prepareCardMotion(event.currentTarget)} aria-selected={selected} onClick={event=>commands.current.select(event,entity.id)} style={label?{background:toCssColor(label)}:undefined}>
  <div className="entity-header"><SortHandle id={entity.id} onMove={(from,to,after)=>commands.current.reorder(from,to,after)}/><button className="entity-toggle ui-surface ui-button" onClick={()=>commands.current.toggle(entity.id)}>{expanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>}</button><label className="entity-name" data-entity-id={entity.id}><PencilLine size={16} aria-hidden="true"/><input value={entity.name} onChange={event=>update({...entity,name:event.target.value})} aria-label="实例名称" className="ui-surface ui-field"/></label>{dirty&&<span className="entity-dirty-dot" title="尚未导出的更改（JSON 自动存档）" aria-label="实例未保存"/>}<span className="entity-tag ui-badge--entity ui-surface ui-badge ui-badge--themed ui-badge--text ui-surface--bordered">实例</span><button className="icon-button ui-button--icon subtle ui-surface ui-button" title="删除实例" onClick={()=>{if(confirm(`删除“${entity.name}”？`))commands.current.remove(entity.id)}}><Trash2 size={16}/></button></div>
  {expanded&&<div className="entity-fields">{entity.fields.filter(field=>!visibleIds||visibleIds.has(field.id)).map(field=>{const schema=findSchema(doc.schema,field.schemaId);return schema?<FieldEditor key={field.id} visibleIds={visibleIds} world={world} doc={doc} field={field} schema={schema} onChange={value=>update({...entity,fields:entity.fields.map(f=>f.id===value.id?value:f)})} onDelete={schema.repeatable?()=>update({...entity,fields:entity.fields.filter(f=>f.id!==field.id)}):undefined}/>:null})}{doc.schema.some(s=>s.repeatable)&&<button className="add-inline ui-button--inline ui-surface ui-button" onClick={()=>{const target=doc.schema.find(s=>s.repeatable);if(target)update({...entity,fields:[...entity.fields,freshField(target)]})}}><Plus size={14}/> 添加属性</button>}</div>}
 </EntityCard>
}
function sameIds(a?:ReadonlySet<string>,b?:ReadonlySet<string>){return a===b||!!a&&!!b&&a.size===b.size&&[...a].every(id=>b.has(id))}
export default memo(InstanceListCard,(a,b)=>a.entity===b.entity&&a.doc.schema===b.doc.schema&&a.doc.name===b.doc.name&&a.expanded===b.expanded&&a.selected===b.selected&&a.highlight===b.highlight&&a.dirty===b.dirty&&a.label===b.label&&a.references===b.references&&sameIds(a.visibleIds,b.visibleIds))
