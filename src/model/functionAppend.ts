import { classLink } from './markdown'
import { validateTypedValue } from './functionValues'
import { ClassDocument, FieldSchema, FieldValue, Workspace, World, uid } from './types'

export interface FunctionAppendScope {classId:string;entityId:string;path:string[];functionId:string;name:string}

/** Build new fields from declared types; never infer or extend a Schema. */
export function appendedField(schema:FieldSchema,raw:unknown,key:string|undefined,world:World,scope?:FunctionAppendScope,depth=0):FieldValue {
  if(depth>32)throw new Error('追加属性嵌套超过 32 层')
  const value=validateTypedValue(raw,{type:schema.valueType,classId:schema.valueType==='Class'?schema.classId:undefined},world,'追加值')
  const name=schema.keyType==='Const'?schema.key:key
  if(typeof name!=='string'||!name.trim()||/[\r\n]/.test(name))throw new Error('追加属性需要有效的键名称')
  if(schema.keyType==='Const'&&key!==undefined&&key!==schema.key)throw new Error('不能更改常量键')
  if(schema.keyType==='Class'&&!world.documents.find(d=>d.id===schema.classId)?.entities.some(e=>classLink(world,schema.classId!,e.id)===name))throw new Error('追加属性的键需要有效的类实例引用')
  let children:FieldValue[]=[]
  if(value.type==='Object'){
    const schemas=schema.children||[],members=value.members!
    const matched=members.map(m=>{const choices=schemas.filter(s=>m.schemaId?s.id===m.schemaId:s.key===m.key);if(choices.length!==1)throw new Error(`追加属性 ${m.key} 不在 Schema 中或名称有歧义，请使用 schemaId`);return {m,s:choices[0]}})
    for(const s of schemas)if(!s.repeatable&&matched.filter(item=>item.s.id===s.id).length!==1)throw new Error(`追加对象的 ${s.key} 必须且只能有一个值`)
    children=matched.map(({m,s})=>appendedField(s,m.value,m.key,world,scope,depth+1))
  }
  const text=value.type==='Object'||value.type==='Null'?'':value.type==='Class'?classLink(world,value.classId!,value.entityId!):String(value.value)
  return {id:uid(),schemaId:schema.id,key:name,value:text,children,...(scope?{functionOrigin:{functionId:scope.functionId,name:scope.name,bindingFieldId:scope.path[scope.path.length-1]}}:{})}
}

export function originalFields(fields:FieldValue[]):FieldValue[]{return fields.filter(f=>!f.functionOrigin).map(f=>({...f,children:originalFields(f.children)}))}

export function fieldPath(fields:FieldValue[],id:string,prefix:string[]=[]):string[]|undefined {
  for(const field of fields){const path=[...prefix,field.id];if(field.id===id)return path;const nested=fieldPath(field.children,id,path);if(nested)return nested}
}

/** Ownership follows the specific binding instance, never the visible field label. */
export function reconcileFunctionDocument(doc:ClassDocument,liveFunctions?:Set<string>):ClassDocument {
  const bindings=new Map<string,Set<string>>()
  const collect=(fields:FieldValue[],schemas:FieldSchema[])=>fields.forEach(f=>{if(f.functionOrigin)return;const s=schemas.find(s=>s.id===f.schemaId);if(!s)return;bindings.set(f.id,new Set((s.functionIds||[]).filter(id=>!liveFunctions||liveFunctions.has(id))));collect(f.children,s.children||[])})
  for(const e of doc.entities)collect(e.fields,doc.schema)
  const clean=(fields:FieldValue[]):FieldValue[]=>{
    let changed=false
    const next=fields.flatMap(f=>{
      if(f.functionOrigin&&!bindings.get(f.functionOrigin.bindingFieldId)?.has(f.functionOrigin.functionId)){changed=true;return []}
      const children=clean(f.children),runs=f.functionRuns?.filter(r=>bindings.get(f.id)?.has(r.functionId))
      if(children===f.children&&!f.functionResults&&(!f.functionRuns||runs!.length===f.functionRuns.length))return [f]
      changed=true;const {functionResults:_old,...rest}=f;return [{...rest,children,...(runs?{functionRuns:runs}:{})}]
    })
    return changed?next:fields
  }
  let changed=false;const entities=doc.entities.map(e=>{const fields=clean(e.fields);if(fields===e.fields)return e;changed=true;return {...e,fields}})
  return changed?{...doc,entities}:doc
}
export function reconcileFunctionBindings(workspace:Workspace):Workspace {
  const live=new Set((workspace.functions||[]).map(f=>f.id));let changed=false
  const worlds=workspace.worlds.map(w=>{let changedWorld=false;const documents=w.documents.map(d=>{const next=reconcileFunctionDocument(d,live);if(next!==d)changedWorld=true;return next});if(!changedWorld)return w;changed=true;return {...w,documents}})
  return changed?{...workspace,worlds}:workspace
}

/** Interactive updates inspect changed instances; declaration changes still perform full validation. */
export function reconcileChangedFunctionBindings(previous:Workspace,next:Workspace):Workspace{
 if(previous.functions!==next.functions)return reconcileFunctionBindings(next)
 const live=new Set((next.functions||[]).map(f=>f.id));let changed=false
 const worlds=next.worlds.map(world=>{
  const before=previous.worlds.find(w=>w.id===world.id);if(world===before)return world
  const oldDocs=new Map(before?.documents.map(d=>[d.id,d]));let worldChanged=false
  const documents=world.documents.map(doc=>{
   const old=oldDocs.get(doc.id);if(doc===old)return doc
   if(!old||old.schema!==doc.schema){const clean=reconcileFunctionDocument(doc,live);worldChanged ||= clean!==doc;return clean}
   const oldEntities=new Map(old.entities.map(e=>[e.id,e]));let docChanged=false
   const entities=doc.entities.map(entity=>{if(entity===oldEntities.get(entity.id))return entity;const clean=reconcileFunctionDocument({...doc,entities:[entity]},live).entities[0];docChanged ||= clean!==entity;return clean})
   if(!docChanged)return doc;worldChanged=true;return {...doc,entities}
  })
  if(!worldChanged)return world;changed=true;return {...world,documents}
 })
 return changed?{...next,worlds}:next
}
