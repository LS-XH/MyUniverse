import { documentMarkdown, entityMarkdown, fieldMarkdown } from './markdown'
import { FieldSchema, FieldValue, ObjectSelection, TypedValue, World } from './types'
import { fieldTypedValue } from './functionValues'

export interface ApiMember {id:string;name:string;value:string;markdown:string;members:ApiMember[];typed?:TypedValue}
export interface ApiEntity {id:string;name:string;markdown:string;members:ApiMember[]}
export interface ApiClass {id:string;name:string;markdown:string;schema:unknown;instances:ApiEntity[]}
export interface WorldCatalog {id:string;name:string;classes:ApiClass[]}
export function worldCatalog(world?:World,excludeFunctionId?:string):WorldCatalog {
  if(world&&excludeFunctionId){const clean=(fields:FieldValue[]):FieldValue[]=>fields.map(f=>({...f,children:clean(f.children),functionResults:f.functionResults?.filter(r=>r.functionId!==excludeFunctionId)}));world={...world,documents:world.documents.map(d=>({...d,entities:d.entities.map(e=>({...e,fields:clean(e.fields)}))}))}}
  const members=(fields:FieldValue[],depth:number,schemas:FieldSchema[]):ApiMember[]=>fields.map(f=>{const schema=schemas.find(s=>s.id===f.schemaId);let typed:TypedValue|undefined;try{if(schema)typed=fieldTypedValue(f,schema,world)}catch{}return {id:f.id,name:f.key,value:f.value,markdown:fieldMarkdown([f],depth).replace(/\n+$/,'')+'\n',members:members(f.children,depth+1,schema?.children||[]),...(typed?{typed}:{})}})
  return {id:world?.id||'',name:world?.name||'',classes:(world?.documents||[]).map(d=>({id:d.id,name:d.name,markdown:documentMarkdown(d),schema:d.schema,instances:d.entities.map(e=>({id:e.id,name:e.name,markdown:entityMarkdown(e),members:members(e.fields,3,d.schema)}))}))}
}
/** No captured imports: this function is also serialized into the script worker. */
export function createWorldApi(catalog:WorldCatalog) {
  const choose=<T extends {id:string;name:string}>(items:T[],key:string,kind:string):T=>{
    const matches=items.filter(item=>item.id===key||item.name===key)
    if(matches.length!==1)throw new Error(`${kind}“${key}”${matches.length?'存在重名，请使用 ID':'不存在'}`)
    return matches[0]
  }
  const member=(data:ApiMember):any=>({id:data.id,name:data.name,type:data.typed?.type,value:()=>data.value,to_value:()=>{if(!data.typed)throw new Error('属性值与类型配置不符');return JSON.parse(JSON.stringify(data.typed))},markdown:()=>data.markdown,members:()=>data.members.map(member),get_member:(key:string)=>member(choose(data.members,key,'属性'))})
  const entity=(data:ApiEntity)=>({id:data.id,name:data.name,markdown:()=>data.markdown,members:()=>data.members.map(member),get_member:(key:string)=>member(choose(data.members,key,'属性'))})
  const klass=(data:ApiClass)=>({id:data.id,name:data.name,markdown:()=>data.markdown,schema:()=>data.schema,instances:()=>data.instances.map(entity),get_instance:(key:string)=>entity(choose(data.instances,key,'实例'))})
  return {id:catalog.id,name:catalog.name,classes:()=>catalog.classes.map(klass),get_class:(key:string)=>klass(choose(catalog.classes,key,'类'))}
}
export function objectCode(selection:ObjectSelection,language:'js'|'py'='js'):string {
  const q=(text:string)=>JSON.stringify(text)
  return `world.get_class(${q(selection.classId)}).get_instance(${q(selection.entityId)})${selection.path.map(id=>`.get_member(${q(id)})`).join('')}.markdown()`+(language==='js'?';':'')
}
export function rawWorldRevision(world?:World):string {
  if(!world)return ''
  const clean=(fields:FieldValue[]):unknown=>fields.map(f=>({id:f.id,key:f.key,value:f.value,children:clean(f.children)}))
  const text=JSON.stringify(world.documents.map(d=>({id:d.id,name:d.name,fileName:d.fileName,schema:d.schema,entities:d.entities.map(e=>({id:e.id,name:e.name,fields:clean(e.fields)}))})))
  let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return `${world.id}:${(hash>>>0).toString(16)}`
}
