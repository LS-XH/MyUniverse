import {ClassDocument,Entity,FieldSchema,FieldValue,InterfaceKind,InterfaceView,ViewBinding,World,uid} from './types'
import {entityMarkdown,fieldMarkdown} from './markdown'
import {referenceBase,resolveFunctionReference} from './functions'
export const currentBinding=(source:ViewBinding['source']='name',path:string[]=[],mode:ViewBinding['mode']='content',part:ViewBinding['part']='value'):ViewBinding=>({scope:'current',source,path,mode,part})
export function schemaAtPath(schemas:FieldSchema[],path:string[]):FieldSchema|undefined{let result:FieldSchema|undefined;for(const id of path){result=schemas.find(s=>s.id===id);if(!result)return;schemas=result.children||[]}return result}
export function fieldsAtPath(fields:FieldValue[],path:string[]):FieldValue[]{if(!path.length)return fields;return fields.filter(f=>f.schemaId===path[0]).flatMap(f=>path.length===1?[f]:fieldsAtPath(f.children,path.slice(1)))}
export function concreteField(fields:FieldValue[],path:string[]):FieldValue|undefined{let field:FieldValue|undefined;for(const id of path){field=fields.find(f=>f.id===id);if(!field)return;fields=field.children}return field}
export function bindingFields(world:World,_view:InterfaceView,binding:ViewBinding|undefined,entity?:Entity):FieldValue[]{if(!binding||binding.source!=='member'||!binding.path.length)return [];if(binding.scope==='fixed'){const source=world.documents.find(d=>d.id===binding.classId)?.entities.find(e=>e.id===binding.entityId);const field=source&&concreteField(source.fields,binding.path);return field?[field]:[]}return entity?fieldsAtPath(entity.fields,binding.path):[]}
export function bindingText(world:World,view:InterfaceView,binding:ViewBinding|undefined,entity?:Entity):string{
 if(!binding)return ''
 const source=binding.scope==='fixed'?world.documents.find(d=>d.id===binding.classId)?.entities.find(e=>e.id===binding.entityId):entity
 if(!source)return ''
 if(binding.source==='name')return binding.mode==='markdown'?`## ${source.name}`:source.name
 if(binding.source==='instance')return binding.mode==='markdown'?entityMarkdown(source):source.fields.map(f=>content(f)).filter(Boolean).join('\n')
 const fields=bindingFields(world,view,binding,entity)
 return fields.map(f=>binding.mode==='markdown'?fieldMarkdown([f],3+Math.max(0,binding.path.length-1)):binding.part==='key'?display(f.key):content(f)).join('\n')
 function display(raw:string):string{const resolved=resolveFunctionReference(world,raw);return referencedEntity(world,resolved)?.entity.name||resolved}
 function content(field:FieldValue):string{return [display(field.value),...field.children.map(content)].filter(Boolean).join('\n')}
}
export function bindingRaw(world:World,view:InterfaceView,binding:ViewBinding|undefined,entity?:Entity):string{const field=bindingFields(world,view,binding,entity)[0];return field?(binding?.part==='key'?field.key:field.value):''}
// Documents are immutable snapshots. Index each snapshot once, including misses;
// canvas motion changes layout, not document identities.
const referenceIndexes=new WeakMap<World['documents'],Map<string,{doc:ClassDocument;entity:Entity}>>()
export function referencedEntity(world:World,raw:string):{doc:ClassDocument;entity:Entity}|undefined{
 if(!raw.startsWith('['))return undefined
 let index=referenceIndexes.get(world.documents)
 if(!index){index=new Map();for(const doc of world.documents)for(const entity of doc.entities)index.set(`[${entity.name}](${doc.fileName}#${encodeURIComponent(entity.name)})`,{doc,entity});referenceIndexes.set(world.documents,index)}
 return index.get(referenceBase(raw))
}
export function bindingClass(world:World,view:InterfaceView,binding:ViewBinding|undefined):ClassDocument|undefined{
 if(!binding)return
 if(binding.scope==='fixed'){const source=world.documents.find(d=>d.id===binding.classId)?.entities.find(e=>e.id===binding.entityId),field=source&&concreteField(source.fields,binding.path);return field?referencedEntity(world,binding.part==='key'?field.key:field.value)?.doc:undefined}
 const doc=world.documents.find(d=>d.id===(binding.scope==='fixed'?binding.classId:view.parentClassId))
 const schema=binding.scope==='current'?doc&&schemaAtPath(doc.schema,binding.path):undefined
 return world.documents.find(d=>d.id===schema?.classId)
}
export function emptyGraph(){return {positions:{},lineStyles:{},domainStyles:{},showDomains:true,showLabels:true}}
export function createInterfaceView(world:World,parentClassId:string,kind:InterfaceKind,name:string,id:string=uid()):InterfaceView{
 if(!world.documents.some(d=>d.id===parentClassId))throw new Error('界面必须绑定一个存在的父文件类型')
 return {version:1,id,name,kind,parentClassId,fileName:`${id}.view.json`,bindings:kind==='graph'?{title:currentBinding(),avatar:currentBinding(),subtitle:currentBinding('member'),edges:currentBinding('member'),target:currentBinding('member',[],'content','key'),edgeLabel:currentBinding('member'),domain:currentBinding('member'),domainLabel:currentBinding()}: {title:currentBinding(),description:currentBinding('member'),x:currentBinding('member'),y:currentBinding('member'),image:currentBinding('member')},graph:emptyGraph(),map:{image:'',legend:'',positions:{}}}
}
export function normalizeViews(world:World):World{
 const views={...world.views}
 for(const node of world.nodes){
  if(node.type!=='view'||!['graph','map'].includes(node.viewType||'')||views[node.id])continue
  const parentClassId=node.classId|| (node.viewType==='graph'?'people':'places')
  if(!world.documents.some(d=>d.id===parentClassId))continue
  const view=createInterfaceView(world,parentClassId,node.viewType as InterfaceKind,node.name,node.id)
  if(node.viewType==='graph'){
   const doc=world.documents.find(d=>d.id===parentClassId)!,relationships=doc.schema.find(s=>s.key==='人物关系'),item=relationships?.children?.find(s=>s.keyType==='Class'),label=item?.children?.find(s=>s.key==='关系'),membership=doc.schema.find(s=>s.key==='人物势力'),domain=membership?.children?.find(s=>s.key==='势力名称'),rank=membership?.children?.find(s=>s.key==='势力地位')
   if(relationships&&item)view.bindings.edges=currentBinding('member',[relationships.id,item.id])
   if(label)view.bindings.edgeLabel=currentBinding('member',[label.id])
   if(membership&&domain)view.bindings.domain=currentBinding('member',[membership.id,domain.id])
   if(membership&&rank)view.bindings.subtitle=currentBinding('member',[membership.id,rank.id])
   view.graph=structuredClone(world.graph||emptyGraph())
  }else{view.map={...world.map,positions:{}};const desc=world.documents.find(d=>d.id===parentClassId)?.schema.find(s=>s.key==='地点描述');if(desc)view.bindings.description=currentBinding('member',[desc.id])}
  views[node.id]=view
 }
 return {...world,views,nodes:world.nodes.map(n=>views[n.id]?{...n,classId:views[n.id].parentClassId}:n)}
}
export function updateInterfaceView(world:World,view:InterfaceView):World{return {...world,views:{...world.views,[view.id]:view},nodes:world.nodes.map(n=>n.id===view.id?{...n,name:view.name,classId:view.parentClassId,viewType:view.kind}:n)}}
export function removeInterfaceView(world:World,id:string):World{const views={...world.views};delete views[id];return {...world,views,nodes:world.nodes.filter(n=>n.id!==id)}}
export function patchFieldTree(fields:FieldValue[],id:string,next:FieldValue|null):FieldValue[]{return fields.flatMap(f=>f.id===id?(next?[next]:[]):[{...f,children:patchFieldTree(f.children,id,next)}])}
export function freshViewField(schema:FieldSchema):FieldValue{return {id:uid(),schemaId:schema.id,key:schema.keyType==='Const'?schema.key:'',value:'',children:(schema.children||[]).filter(s=>!s.repeatable).map(freshViewField)}}
export function appendViewField(fields:FieldValue[],schemas:FieldSchema[],path:string[],item:FieldValue):FieldValue[]{const schema=schemas.find(s=>s.id===path[0]);if(!schema)throw new Error('关系对象路径已失效');if(path.length===1)return [...fields,item];let found=false;const next=fields.map(f=>{if(f.schemaId!==schema.id||found)return f;found=true;return {...f,children:appendViewField(f.children,schema.children||[],path.slice(1),item)}});if(!found){const parent=freshViewField(schema);next.push({...parent,children:appendViewField(parent.children,schema.children||[],path.slice(1),item)})}return next}
export function setRelativeValue(fields:FieldValue[],path:string[],value:string,part:'key'|'value',schemas:FieldSchema[]):FieldValue[]{const schema=schemas.find(s=>s.id===path[0]);if(!schema)throw new Error('连线目标路径已失效');const index=fields.findIndex(f=>f.schemaId===schema.id),next=[...fields],field=index<0?freshViewField(schema):fields[index],updated=path.length===1?{...field,[part]:value}:{...field,children:setRelativeValue(field.children,path.slice(1),value,part,schema.children||[])};if(index<0)next.push(updated);else next[index]=updated;return next}
export function graphRelationClass(world:World,view:InterfaceView):ClassDocument|undefined{const parent=world.documents.find(d=>d.id===view.parentClassId),edge=parent&&schemaAtPath(parent.schema,view.bindings.edges?.path||[]),label=view.bindings.edgeLabel;if(label?.scope==='fixed'){const source=world.documents.find(d=>d.id===label.classId)?.entities.find(e=>e.id===label.entityId);const field=source&&concreteField(source.fields,label.path);return field?referencedEntity(world,field.value)?.doc:undefined}const schema=edge&&schemaAtPath(edge.children||[],label?.path||[]);return world.documents.find(d=>d.id===schema?.classId)}
export function decodeInterfaceFile(text:string,previous:InterfaceView,world:World):InterfaceView{
 const value=JSON.parse(text) as InterfaceView
 const points=(items:unknown)=>!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.values(items).every(p=>p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y))
 const styles=(items:unknown)=>!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.values(items).every(s=>s&&typeof s.fill==='string'&&typeof s.stroke==='string'&&Number.isFinite(s.glow))
 if(!value||value.version!==1||value.id!==previous.id||value.fileName!==previous.fileName||value.kind!==previous.kind||typeof value.name!=='string'||!world.documents.some(d=>d.id===value.parentClassId)||!value.bindings||Array.isArray(value.bindings)||!Object.values(value.bindings).every(b=>b&&['current','fixed'].includes(b.scope)&&['name','instance','member'].includes(b.source)&&['content','markdown'].includes(b.mode)&&Array.isArray(b.path)&&b.path.every(id=>typeof id==='string')&&(!b.part||['key','value'].includes(b.part)))||!value.graph||!points(value.graph.positions)||!styles(value.graph.lineStyles)||!styles(value.graph.domainStyles)||typeof value.graph.showDomains!=='boolean'||!value.map||typeof value.map.image!=='string'||typeof value.map.legend!=='string'||!points(value.map.positions))throw new Error('界面配置无效，身份、父类型、绑定和布局必须符合规范')
 return value
}
