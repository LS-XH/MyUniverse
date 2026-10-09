import { FieldSchema, FieldValue, FunctionLanguage, FunctionResult, FunctionScript, Workspace, World, uid } from './types'
import { createFlow } from './flow'
import { rawWorldRevision } from './worldApi'

export const functionFile = (fn: FunctionScript) => `${fn.id}.${fn.language}`
export const functionLink = (result: Pick<FunctionResult,'name'|'fileName'>) => `[${result.name.replace(/[\[\]\n]/g,'')}](${result.fileName})`
export function parseFunctionLink(key:string): {name:string;fileName:string;functionId:string}|null {
  const match=key.match(/^\[([^\]]+)\]\(([^)]+\.(?:py|js|flow))\)$/)
  if(!match)return null
  const fileName=match[2],file=fileName.split('/').pop()!
  return {name:match[1],fileName,functionId:file.replace(/\.(py|js|flow)$/,'')}
}
export function createFunction(items:FunctionScript[],language:FunctionLanguage='js'):FunctionScript {
  let name='新函数',n=2;while(items.some(fn=>fn.name===name))name=`新函数${n++}`
  return {id:uid(),name,language,apiVersion:2,returnType:{type:'Text'},code:language==='js'?'function transform(self, input) {\n  return values.text(String(input.value() ?? ""));\n}\n':language==='py'?'def transform(self, input):\n    return values.text(str(input.value() or ""))\n':'',...(language==='flow'?{flow:createFlow()}: {})}
}
export function functionRevision(fn:FunctionScript,world?:World):string {
  const code=fn.language==='flow'?JSON.stringify({...fn.flow,nodes:fn.flow?.nodes.map(({x:_x,y:_y,...node})=>node)}):fn.code
  const usesWorld=fn.language==='flow'?fn.flow?.nodes.some(n=>n.type==='entityMarkdown'||n.type==='memberMarkdown'||n.type==='code'&&/\bworld\b/.test(n.code||'')):/\bworld\b/.test(fn.code)
  return code+(fn.apiVersion===2?`\ncontract:${JSON.stringify(fn.returnType)}\napi:2`:'')+(usesWorld||fn.apiVersion===2?`\nworld:${rawWorldRevision(world)}`:'')
}
export function referenceBase(value:string):string {return value.match(/^\[[^\]]*\]\([^\n)]+#[^\n)]+\)/)?.[0]||value}
export function functionReferenceIdentity(value:string):string {
  const base=referenceBase(value),match=value.slice(base.length).trim().match(/^(\[[^\]]+\]\([^)]+\.(?:js|py|flow)\))@([\w-]+)$/)
  return match?`${parseFunctionLink(match[1])?.functionId}/${match[2]}`:''
}
export function resolveFunctionReference(world:World,value:string):string {
  const base=referenceBase(value),suffix=value.slice(base.length).trim(),match=suffix.match(/^(\[[^\]]+\]\([^)]+\.(?:js|py|flow)\))@([\w-]+)$/)
  if(!match)return value
  const fn=parseFunctionLink(match[1])
  const file=base.match(/\]\(([^#]+)#/)?.[1],anchor=base.match(/#([^)]*)\)/)?.[1]
  let name='';try{name=decodeURIComponent(anchor||'')}catch{return value}
  const doc=world.documents.find(d=>d.fileName===file),entity=doc?.entities.find(e=>e.name===name)
  if(!entity)return value
  const visit=(fields:FieldValue[]):string|undefined=>{for(const f of fields){if(f.id===match[2]){const result=f.functionResults?.find(r=>r.functionId===fn?.functionId&&!r.error);if(result)return result.value}const nested=visit(f.children);if(nested!==undefined)return nested}return undefined}
  return visit(entity.fields)??value
}
export function functionInput(field:FieldValue,schema:FieldSchema,world?:World):string {
  if(schema.valueType!=='Object')return world&&schema.valueType==='Class'?resolveFunctionReference(world,field.value):field.value
  const serialize=(fields:FieldValue[]):unknown=>fields.map(f=>({key:f.key,value:f.value,children:serialize(f.children)}))
  return JSON.stringify(serialize(field.children))
}
export function fieldFunctions(world:World,entityId:string):{field:FieldValue;schema:FieldSchema;label:string}[] {
  const found:{field:FieldValue;schema:FieldSchema;label:string}[]=[]
  const walk=(fields:FieldValue[],schemas:FieldSchema[],path:string)=>fields.forEach(field=>{
    const schema=schemas.find(s=>s.id===field.schemaId);if(!schema)return
    const label=path?`${path} / ${field.key}`:field.key
    if(schema.functionIds?.length)found.push({field,schema,label})
    walk(field.children,schema.children||[],label)
  })
  for(const doc of world.documents){const entity=doc.entities.find(e=>e.id===entityId);if(entity)walk(entity.fields,doc.schema,'')}
  return found
}
export function deleteFunction(workspace:Workspace,id:string):Workspace {
  const clearReference=(value:string)=>functionReferenceIdentity(value).startsWith(`${id}/`)?referenceBase(value):value
  const schemas=(items:FieldSchema[]):FieldSchema[]=>items.map(s=>({...s,...(s.functionIds?{functionIds:s.functionIds.filter(x=>x!==id)}:{}),...(s.children?{children:schemas(s.children)}:{})}))
  const fields=(items:FieldValue[]):FieldValue[]=>items.map(f=>({...f,key:clearReference(f.key),value:clearReference(f.value),children:fields(f.children),...(f.functionResults?{functionResults:f.functionResults.filter(r=>r.functionId!==id)}:{})}))
  const styles=(items:World['graph']['lineStyles'])=>Object.fromEntries(Object.entries(items).map(([key,style])=>[key,style.labelSource&&functionReferenceIdentity(style.labelSource).startsWith(`${id}/`)?{...style,labelSource:undefined}:style]))
  return {...workspace,functions:workspace.functions?.filter(fn=>fn.id!==id),worlds:workspace.worlds.map(w=>({...w,graph:{...w.graph,lineStyles:styles(w.graph.lineStyles),domainStyles:styles(w.graph.domainStyles)},documents:w.documents.map(d=>({...d,schema:schemas(d.schema),entities:d.entities.map(e=>({...e,fields:fields(e.fields)}))}))}))}
}
