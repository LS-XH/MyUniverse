import type {ClassDocument,Entity,FieldValue,World} from './types'
import {originalFields} from './functionAppend'
import {referencedEntity} from './interfaceViews'
import {resolveFunctionReference} from './functions'

export type AttributeFilter={key:string;value?:string}
export const INSTANCE_FILTER_KEY='instance'
export const attributeKey=(key:string)=>JSON.stringify(['key',key])
const walk=(fields:FieldValue[]):FieldValue[]=>fields.flatMap(field=>[field,...walk(field.children)])
export function filterDisplay(world:World,raw:string):string{
 const resolved=resolveFunctionReference(world,raw),ref=referencedEntity(world,resolved)
 return ref?`${ref.entity.name} · ${ref.doc.name}`:resolved||'（空值）'
}
export function attributeKeys(world:World,doc:ClassDocument){
 const keys=new Map<string,{id:string;label:string;search:string}>()
 keys.set(INSTANCE_FILTER_KEY,{id:INSTANCE_FILTER_KEY,label:'当前类实例',search:'当前类实例'})
 for(const entity of doc.entities)for(const field of walk(entity.fields)){
  const id=attributeKey(field.key),label=filterDisplay(world,field.key)
  keys.set(id,{id,label,search:`${label} ${field.key}`})
 }
 return [...keys.values()]
}
export function attributeValues(world:World,doc:ClassDocument,key:string){
 const values=key===INSTANCE_FILTER_KEY?doc.entities.map(entity=>entity.name):doc.entities.flatMap(entity=>walk(entity.fields).filter(field=>attributeKey(field.key)===key).map(field=>field.value))
 return [...new Set(values)].map(value=>{const display=filterDisplay(world,value);return {value,label:display.length>160?display.slice(0,160)+'…':display,search:`${display} ${value}`}})
}
/** Compute display identities without cloning editable fields or discarding hidden siblings. */
export function matchingAttributeBranch(entity:Entity,filter:AttributeFilter,showGenerated=true):Set<string>|undefined{
 if(!filter.key)return undefined
 const fields=showGenerated?entity.fields:originalFields(entity.fields),ids=new Set<string>()
 if(filter.key===INSTANCE_FILTER_KEY){
  if(filter.value!==undefined&&entity.name!==filter.value)return ids
  walk(fields).forEach(field=>ids.add(field.id));return ids
 }
 const visit=(field:FieldValue):boolean=>{
  if(attributeKey(field.key)===filter.key&&(filter.value===undefined||field.value===filter.value)){
   walk([field]).forEach(child=>ids.add(child.id));return true
  }
  const matched=field.children.map(visit).some(Boolean)
  if(matched)ids.add(field.id)
  return matched
 }
 fields.forEach(visit);return ids
}
export function matchesAttribute(entity:Entity,filter:AttributeFilter,ids?:Set<string>):boolean{
 return !filter.key||(filter.key===INSTANCE_FILTER_KEY?(filter.value===undefined||entity.name===filter.value):!!ids?.size)
}
