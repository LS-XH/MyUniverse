import { Entity, FieldSchema, FieldValue } from './types'

export type CommonField = { schema:FieldSchema; field:FieldValue; ids:string[]; path:string; mixed:boolean; mixedKey:boolean }
// Match by schema identity, never by entity order or instance-specific field ID.
// Ambiguous repeatable members are omitted rather than overwriting arbitrary rows.
export function commonFields(entities:Entity[],schemas:FieldSchema[]):CommonField[] {
  if(!entities.length)return []
  const walk=(groups:FieldValue[][],schemaList:FieldSchema[],prefix:string[]):CommonField[]=>schemaList.flatMap(schema=>{
    const matches=groups.map(group=>group.filter(field=>field.schemaId===schema.id))
    if(matches.some(group=>group.length!==1))return []
    const fields=matches.map(group=>group[0]),path=[...prefix,schema.key||fields[0].key]
    if(schema.valueType==='Object')return walk(fields.map(field=>field.children),schema.children||[],path)
    const mixed=fields.some(field=>field.value!==fields[0].value),mixedKey=fields.some(field=>field.key!==fields[0].key)
    return [{schema,field:{...fields[0],value:mixed?'':fields[0].value,key:mixedKey?'':fields[0].key,functionResults:undefined},ids:fields.map(field=>field.id),path:path.join(' / '),mixed,mixedKey}]
  })
  return walk(entities.map(entity=>entity.fields),schemas,[])
}
export function patchCommonFields(entities:Entity[],selected:string[],ids:string[],patch:Pick<Partial<FieldValue>,'key'|'value'>):Entity[] {
  const fields=new Set(ids),selection=new Set(selected)
  const walk=(items:FieldValue[]):FieldValue[]=>items.map(field=>fields.has(field.id)?{...field,...patch}:({...field,children:walk(field.children)}))
  return entities.map(entity=>selection.has(entity.id)?{...entity,fields:walk(entity.fields)}:entity)
}
