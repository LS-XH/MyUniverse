import { documentMarkdown, entityMarkdown, fieldMarkdown, parseDocumentMarkdown } from './markdown'
import { appendedField, FunctionAppendScope } from './functionAppend'
import { fieldTypedValue } from './functionValues'
import { ClassDocument, FieldSchema, FieldValue, World } from './types'

/** Live facades resolve stable IDs on demand; Markdown is computed only when requested. */
export function createHostWorldApi(read:()=>World|undefined,write:(world:World)=>void,excludeFunctionId?:string,scope?:FunctionAppendScope){
  const current=()=>{const world=read();if(!world)throw new Error('请先选择世界');return world}
  const choose=<T extends {id:string}>(items:T[],key:string,label:string,name:(item:T)=>string):T=>{
    const byId=items.find(item=>item.id===key);if(byId)return byId
    const matches=items.filter(item=>name(item)===key);if(matches.length!==1)throw new Error(`${label}不存在或重名，请使用 ID: ${key}`);return matches[0]
  }
  const clean=(fields:FieldValue[]):FieldValue[]=>excludeFunctionId?fields.filter(f=>f.functionOrigin?.functionId!==excludeFunctionId).map(f=>({...f,children:clean(f.children),functionResults:f.functionResults?.filter(r=>r.functionId!==excludeFunctionId)})):fields
  const document=(id:string)=>choose(current().documents,id,'类',d=>d.name)
  const changeDoc=(id:string,change:(doc:ClassDocument)=>ClassDocument)=>{const world=current(),doc=document(id),next=change(doc);write({...world,documents:world.documents.map(d=>d.id===id?next:d)})}
  const entityData=(classId:string,id:string)=>choose(document(classId).entities,id,'实例',e=>e.name)
  const memberData=(classId:string,entityId:string,path:string[])=>{
    let fields=entityData(classId,entityId).fields,schemas=document(classId).schema
    let field:FieldValue|undefined,schema:FieldSchema|undefined
    for(const id of path){field=choose(fields,id,'属性',f=>f.key);schema=schemas.find(s=>s.id===field!.schemaId);if(!schema)throw new Error('属性缺少类型配置');fields=field.children;schemas=schema.children||[]}
    if(!field||!schema)throw new Error('属性路径为空');return {field,schema}
  }
  const immutable=()=>{if(scope)throw new Error('绑定函数只能追加可重复值，不能修改或删除已有值')}
  const append=(classId:string,entityId:string,path:string[],selector:string|undefined,raw:unknown,key?:string):any=>{
    const self=selector===undefined
    if(scope){
      let allowed=classId===scope.classId&&entityId===scope.entityId&&scope.path.every((id,i)=>path[i]===id)
      if(!allowed&&classId===scope.classId&&entityId===scope.entityId&&scope.path.slice(0,-1).every((id,i)=>path[i]===id)&&path.length>=scope.path.length){
        const candidate=memberData(classId,entityId,path.slice(0,scope.path.length)),bound=memberData(classId,entityId,scope.path)
        allowed=candidate.schema.id===bound.schema.id&&candidate.field.functionOrigin?.functionId===scope.functionId&&candidate.field.functionOrigin?.bindingFieldId===scope.path[scope.path.length-1]
      }
      if(!allowed)throw new Error('只能在函数绑定属性及其子对象中追加')
    }
    const target=memberData(classId,entityId,path)
    if(!self&&target.schema.valueType!=='Object')throw new Error('只有 Object 属性可以追加子成员')
    const parentPath=self?path.slice(0,-1):path
    const schemas=parentPath.length?memberData(classId,entityId,parentPath).schema.children||[]:document(classId).schema
    const matches=self?[target.schema]:schemas.filter(s=>s.id===selector||s.key===selector)
    if(matches.length!==1)throw new Error('追加属性不存在或重名，请使用 Schema ID')
    const schema=matches[0];if(!schema.repeatable)throw new Error('只能追加标记为可重复的属性')
    const added=appendedField(schema,raw,key,current(),scope)
    const update=(fields:FieldValue[],remaining:string[]):FieldValue[]=>remaining.length?fields.map(f=>f.id===remaining[0]?{...f,children:update(f.children,remaining.slice(1))}:f):[...fields,added]
    changeDoc(classId,doc=>({...doc,entities:doc.entities.map(e=>e.id===entityId?{...e,fields:update(e.fields,parentPath)}:e)}))
    return member(classId,entityId,[...parentPath,added.id])
  }
  const member=(classId:string,entityId:string,path:string[]):any=>({
    get id(){return memberData(classId,entityId,path).field.id},get name(){return memberData(classId,entityId,path).field.key},get type(){return memberData(classId,entityId,path).schema.valueType},
    schema:()=>structuredClone(memberData(classId,entityId,path).schema),
    value:()=>memberData(classId,entityId,path).field.value,
    to_value:()=>fieldTypedValue({...memberData(classId,entityId,path).field,children:clean(memberData(classId,entityId,path).field.children)},memberData(classId,entityId,path).schema,current()),
    markdown:()=>fieldMarkdown(clean([memberData(classId,entityId,path).field]),path.length+2),
    members:()=>memberData(classId,entityId,path).field.children.map(f=>member(classId,entityId,[...path,f.id])),
    get_member:(key:string)=>member(classId,entityId,[...path,choose(memberData(classId,entityId,path).field.children,key,'属性',f=>f.key).id]),
    add:(selectorOrValue:unknown,valueOrKey?:unknown,key?:string)=>typeof selectorOrValue==='string'?append(classId,entityId,path,selectorOrValue,valueOrKey,key):append(classId,entityId,path,undefined,selectorOrValue,valueOrKey as string|undefined),
    append_repeatable:(selector:string,value:unknown,key?:string)=>append(classId,entityId,path,selector,value,key),
    append_self:(value:unknown,key?:string)=>append(classId,entityId,path,undefined,value,key),
    set_value:(value:string|number|null)=>{
      immutable()
      const {field,schema}=memberData(classId,entityId,path);if(schema.valueType==='Object')throw new Error('Object 请通过类的 set_markdown 修改结构')
      if(value!==null&&!['string','number'].includes(typeof value))throw new Error('属性值需要文字、数字或 null')
      const update=(fields:FieldValue[]):FieldValue[]=>fields.map(f=>f.id===field.id?{...f,value:value===null?'':String(value)}:{...f,children:update(f.children)})
      changeDoc(classId,doc=>{const next={...doc,entities:doc.entities.map(e=>e.id===entityId?{...e,fields:update(e.fields)}:e)};return parseDocumentMarkdown(documentMarkdown(next),next,current())})
    }
  })
  const entity=(classId:string,id:string):any=>({
    get id(){return entityData(classId,id).id},get name(){return entityData(classId,id).name},classId,type:'Class',
    schema:()=>structuredClone(document(classId).schema),to_value:()=>({type:'Class',classId,entityId:id}),
    markdown:()=>entityMarkdown({...entityData(classId,id),fields:clean(entityData(classId,id).fields)}),
    members:()=>entityData(classId,id).fields.map(f=>member(classId,id,[f.id])),
    get_member:(key:string)=>member(classId,id,[choose(entityData(classId,id).fields,key,'属性',f=>f.key).id]),
    delete:()=>{immutable();changeDoc(classId,doc=>({...doc,entities:doc.entities.filter(e=>e.id!==id)}))}
  })
  const klass=(id:string):any=>({
    get id(){return document(id).id},get name(){return document(id).name},schema:()=>structuredClone(document(id).schema),
    markdown:()=>documentMarkdown({...document(id),entities:document(id).entities.map(e=>({...e,fields:clean(e.fields)}))}),
    instances:()=>document(id).entities.map(e=>entity(id,e.id)),get_instance:(key:string)=>entity(id,choose(document(id).entities,key,'实例',e=>e.name).id),
    set_markdown:(markdown:string)=>{immutable();if(typeof markdown!=='string')throw new Error('Markdown 需要文字');changeDoc(id,doc=>parseDocumentMarkdown(markdown,doc,current()))},
    delete:()=>{immutable();const world=current();if(document(id).protected)throw new Error('默认类不能删除');const removed=new Set(world.nodes.filter(n=>n.classId===id).map(n=>n.id));write({...world,documents:world.documents.filter(d=>d.id!==id),nodes:world.nodes.filter(n=>!removed.has(n.id)),views:Object.fromEntries(Object.entries(world.views||{}).filter(([,v])=>v.parentClassId!==id))})}
  })
  return {get id(){return read()?.id||''},get name(){return read()?.name||''},classes:()=>read()?.documents.map(d=>klass(d.id))||[],get_class:(key:string)=>klass(choose(current().documents,key,'类',d=>d.name).id)}
}
