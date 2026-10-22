import {ClassDocument,Entity,FieldSchema,FieldValue,InterfaceKind,InterfaceView,ViewBinding,World,uid} from './types'
import {classLink,entityMarkdown,fieldMarkdown} from './markdown'
import {referenceBase,resolveFunctionReference} from './functions'
import {originalFields} from './functionAppend'
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
export type ProjectedGraphEdge={id:string;sourceClassId:string;source:Entity;target:Entity;field:FieldValue;relationField?:FieldValue;readOnly:boolean;relationName:string;relationRaw:string}
function inheritedOrigin(fields:FieldValue[],id:string,generated=false):boolean|undefined{for(const field of fields){const origin=generated||!!field.functionOrigin;if(field.id===id)return origin;const found=inheritedOrigin(field.children,id,origin);if(found!==undefined)return found}return undefined}
/** Each repeatable relationship value is an independent projected edge. */
export function graphEdges(world:World,view:InterfaceView):ProjectedGraphEdge[]{
 view=graphView(world,view)
 const doc=world.documents.find(d=>d.id===view.parentClassId)
 if(!doc)return []
 const show=view.graph.showFunctionRelations!==false
 const visibleWorld=show?world:{...world,documents:world.documents.map(d=>({...d,entities:d.entities.map(e=>({...e,fields:originalFields(e.fields)}))}))}
 const visibleDoc=visibleWorld.documents.find(d=>d.id===doc.id)!
 return doc.entities.flatMap(source=>{
  const visibleSource=visibleDoc.entities.find(e=>e.id===source.id)!
  const visibleFields=new Map(bindingFields(visibleWorld,view,view.bindings.edges,visibleSource).map(f=>[f.id,f]))
  return bindingFields(world,view,view.bindings.edges,source).flatMap(field=>{
   const visibleField=visibleFields.get(field.id)
   if(!visibleField)return []
   if(view.kind==='relationGraph'){
    const target=referencedEntity(visibleWorld,visibleField.value),relation=referencedEntity(visibleWorld,visibleField.key)
    if(target?.doc.id!==doc.id||relation?.doc.id!==doc.id||view.graph.lineStyles[relation.entity.id]?.visible===false)return []
    return [{id:field.id,sourceClassId:doc.id,source,target:target.entity,field,readOnly:!!inheritedOrigin(source.fields,field.id),relationName:relation.entity.name,relationRaw:visibleField.key}]
   }
   const context={...source,fields:visibleField.children},originalContext={...source,fields:field.children}
   // A user-owned relationship may have only function-added label values.
   if(!show&&bindingFields(world,view,view.bindings.edgeLabel,originalContext).length&&!bindingFields(visibleWorld,view,view.bindings.edgeLabel,context).length)return []
   const targetBinding=view.bindings.target
   const raw=targetBinding?.path.length?bindingRaw(visibleWorld,view,targetBinding,context):targetBinding?.part==='value'?visibleField.value:visibleField.key
   const target=referencedEntity(visibleWorld,raw)
   if(target?.doc.id!==doc.id)return []
   const labelBinding=view.bindings.edgeLabel
   const labels=bindingFields(visibleWorld,view,labelBinding,context)
   const rawLabel=(label:FieldValue)=>labelBinding?.part==='key'?label.key:label.value
   const enabled=labels.filter(label=>{const relation=referencedEntity(visibleWorld,rawLabel(label));return !relation||view.graph.lineStyles[relation.entity.id]?.visible!==false})
   if(labels.length&&!enabled.length)return []
   const originals=new Map(bindingFields(world,view,labelBinding,originalContext).map(label=>[label.id,label]))
   return enabled.map(label=>({id:JSON.stringify([field.id,label.id]),sourceClassId:doc.id,source,target:target.entity,field,relationField:originals.get(label.id)!,readOnly:!!inheritedOrigin(source.fields,field.id)||!!inheritedOrigin(field.children,label.id),relationName:referencedEntity(visibleWorld,rawLabel(label))?.entity.name||rawLabel(label),relationRaw:rawLabel(label)}))
  })
 })
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
export function emptyGraph(){return {positions:{},lineStyles:{},domainStyles:{},showDomains:true,showLabels:true,showFunctionRelations:true}}
/** The relationship canvas is specific to the built-in people structure. Paths follow current schema IDs. */
export function personGraphView(world:World,view:InterfaceView):InterfaceView {
 const doc=world.documents.find(d=>d.id==='people'),relationships=doc?.schema.find(s=>s.key==='人物关系'&&s.valueType==='Object'),item=relationships?.children?.find(s=>s.keyType==='Class'&&s.classId==='people'),label=item?.children?.find(s=>s.key==='关系'),membership=doc?.schema.find(s=>s.key==='人物势力'),domain=membership?.children?.find(s=>s.key==='势力名称'),rank=membership?.children?.find(s=>s.key==='势力地位')
 const relationPath=(schema:FieldSchema,path:string[]):{path:string[];part:'key'|'value'}|undefined=>{
  if(schema.keyType==='Class'&&schema.classId==='relations')return {path,part:'key'}
  if(schema.valueType==='Class'&&schema.classId==='relations')return {path,part:'value'}
  for(const child of schema.children||[]){const found=relationPath(child,[...path,child.id]);if(found)return found}
 }
 const relation=label&&relationPath(label,[label.id])
 return {...view,name:view.name==='关系网'?'人物关系网':view.name,parentClassId:'people',bindings:{title:currentBinding(),avatar:currentBinding(),subtitle:currentBinding('member',membership&&rank?[membership.id,rank.id]:[]),domain:currentBinding('member',membership&&domain?[membership.id,domain.id]:[]),domainLabel:currentBinding(),edges:currentBinding('member',relationships&&item?[relationships.id,item.id]:[]),target:currentBinding('member',[],'content','key'),edgeLabel:currentBinding('member',relation?.path||[],'content',relation?.part||'value')}}
}
/** Removing the last relation value also removes its now-empty person entry. */
export function patchGraphEdge(world:World,edge:ProjectedGraphEdge,next:FieldValue|null):World{
 if(edge.readOnly)return world
 const id=edge.relationField?.id||edge.field.id
 return {...world,documents:world.documents.map(doc=>doc.id===edge.sourceClassId?{...doc,entities:doc.entities.map(entity=>{
  if(entity.id!==edge.source.id||inheritedOrigin(entity.fields,id)!==false)return entity
  let fields=patchFieldTree(entity.fields,id,next)
  if(!next&&edge.relationField){
   const find=(items:FieldValue[],target:string):FieldValue|undefined=>{for(const item of items){if(item.id===target)return item;const found=find(item.children,target);if(found)return found}}
   const row=find(entity.fields,edge.field.id)
   const pathTo=(items:FieldValue[]):string[]|undefined=>{for(const item of items){if(item.id===id)return [item.schemaId];const path=pathTo(item.children);if(path)return [item.schemaId,...path]}}
   const path=row&&pathTo(row.children),updated=find(fields,edge.field.id)
   // Inspect the current data, including labels hidden by filters or Functions.
   if(path&&updated&&!fieldsAtPath(updated.children,path).length)fields=patchFieldTree(fields,row!.id,null)
  }
  return {...entity,fields}
 })}:doc)}
}
/** New people connections start with one empty, editable relation value. */
export function freshGraphEdgeField(schema:FieldSchema,view:InterfaceView):FieldValue{
 let item=freshViewField(schema)
 if(view.kind==='graph'){
  const path=view.bindings.edgeLabel.path,labelSchema=schemaAtPath(schema.children||[],path)
  if(labelSchema&&!fieldsAtPath(item.children,path).length)item={...item,children:appendViewField(item.children,schema.children||[],path,freshViewField(labelSchema))}
 }
 return item
}
/** Create the relation value and its connection in one undoable world update. */
export function createGraphConnection(world:World,storedView:InterfaceView,sourceId:string,targetId:string):World{
 const view=graphView(world,storedView),doc=world.documents.find(d=>d.id===view.parentClassId)
 const schema=doc&&schemaAtPath(doc.schema,view.bindings.edges?.path||[])
 if(!doc||!schema||!doc.entities.some(e=>e.id===sourceId)||!doc.entities.some(e=>e.id===targetId))return world
 let next=world,item=freshGraphEdgeField(schema,view)
 if(view.kind==='graph'){
  const path=view.bindings.edgeLabel.path,labelSchema=schemaAtPath(schema.children||[],path),relations=graphRelationClass(world,view)
  if(labelSchema&&relations){
   let mother=relations.entities.find(entity=>entity.name==='妈妈')
   if(!mother){mother={id:uid(),name:'妈妈',fields:relations.schema.filter(s=>!s.repeatable).map(freshViewField)};next={...world,documents:world.documents.map(d=>d.id===relations.id?{...d,entities:[...d.entities,mother!]}:d)}}
   item={...item,children:setRelativeValue(item.children,path,classLink(next,relations.id,mother.id),view.bindings.edgeLabel.part||'value',schema.children||[])}
  }
 }else item={...item,key:classLink(next,doc.id,sourceId)}
 const target=view.bindings.target,link=classLink(next,doc.id,targetId)
 if(target.path.length)item={...item,children:setRelativeValue(item.children,target.path,link,target.part||'value',schema.children||[])}
 else item={...item,[target.part||'key']:link}
 return {...next,documents:next.documents.map(d=>d.id!==doc.id?d:{...d,entities:d.entities.map(entity=>entity.id!==sourceId?entity:{...entity,fields:appendViewField(entity.fields,doc.schema,view.bindings.edges.path,item)})})}
}
export const isGraphKind=(kind:string|undefined)=>kind==='graph'||kind==='relationGraph'
/** Relation inference rows use their Class key as label and Class value as target. */
export function relationGraphView(world:World,view:InterfaceView):InterfaceView {
 const doc=world.documents.find(d=>d.id==='relations'),description=doc?.schema.find(s=>s.key==='关系描述'),inference=doc?.schema.find(s=>s.key==='关系推理'&&s.valueType==='Object'),item=inference?.children?.find(s=>s.repeatable&&s.keyType==='Class'&&s.valueType==='Class'&&s.classId==='relations')
 return {...view,parentClassId:'relations',bindings:{title:currentBinding(),avatar:currentBinding(),subtitle:currentBinding('member',description?[description.id]:[]),edges:currentBinding('member',inference&&item?[inference.id,item.id]:[]),target:currentBinding('member',[],'content','value'),edgeLabel:currentBinding('member',[],'content','key')}}
}
export function graphView(world:World,view:InterfaceView):InterfaceView{return view.kind==='relationGraph'?relationGraphView(world,view):personGraphView(world,view)}
/** Import presentation only. Instance identities and positions belong to the destination. */
export function importPersonGraphConfig(world:World,target:InterfaceView,source:InterfaceView):InterfaceView{
 if(target.kind!=='relationGraph'||source.kind!=='graph'||!world.views?.[source.id]||!world.views?.[target.id])throw new Error('请选择当前世界的人物关系网配置')
 const relations=new Set(world.documents.find(d=>d.id==='relations')?.entities.map(e=>e.id)||[])
 const lineStyles=Object.fromEntries(Object.entries(source.graph.lineStyles).filter(([id])=>relations.has(id)).map(([id,style])=>{const {labelSource:_old,...copy}=style;return [id,structuredClone(copy)]}))
 return relationGraphView(world,{...target,graph:{...target.graph,lineStyles,showLabels:source.graph.showLabels,showFunctionRelations:source.graph.showFunctionRelations}})
}
export function createInterfaceView(world:World,parentClassId:string,kind:InterfaceKind,name:string,id:string=uid()):InterfaceView{
 if(kind==='graph')parentClassId='people'
 if(kind==='relationGraph')parentClassId='relations'
 if(!world.documents.some(d=>d.id===parentClassId))throw new Error('界面必须绑定一个存在的父文件类型')
 const view:InterfaceView={version:1,id,name,kind,parentClassId,fileName:`${id}.view.json`,bindings:kind==='graph'?{title:currentBinding(),avatar:currentBinding(),subtitle:currentBinding('member'),edges:currentBinding('member'),target:currentBinding('member',[],'content','key'),edgeLabel:currentBinding('member'),domain:currentBinding('member'),domainLabel:currentBinding()}: {title:currentBinding(),description:currentBinding('member'),x:currentBinding('member'),y:currentBinding('member'),image:currentBinding('member')},graph:emptyGraph(),map:{image:'',legend:'',positions:{}}}
 return isGraphKind(kind)?graphView(world,view):view
}
export function normalizeViews(world:World):World{
 let nodes=world.nodes
 if(!world.relationGraphInstalled&&!nodes.some(n=>n.viewType==='relationGraph')&&world.documents.some(d=>d.id==='relations')){
  const parentId=nodes.find(n=>n.type==='file'&&n.classId==='relations')?.id||null
  nodes=[...nodes,{id:uid(),name:'关系类型网',type:'view',viewType:'relationGraph',classId:'relations',parentId,protected:true}]
 }
 const views={...world.views}
 for(const [id,view] of Object.entries(views))if(isGraphKind(view.kind))views[id]=graphView(world,view)
 for(const node of nodes){
  if(node.type!=='view'||!['graph','relationGraph','map'].includes(node.viewType||'')||views[node.id])continue
  const parentClassId=node.classId|| (node.viewType==='graph'?'people':node.viewType==='relationGraph'?'relations':'places')
  if(!world.documents.some(d=>d.id===parentClassId))continue
  const view=createInterfaceView(world,parentClassId,node.viewType as InterfaceKind,node.name,node.id)
  if(node.viewType==='graph'){
   view.graph=structuredClone(world.graph||emptyGraph())
  }else if(node.viewType==='map'){view.map={...world.map,positions:{}};const desc=world.documents.find(d=>d.id===parentClassId)?.schema.find(s=>s.key==='地点描述');if(desc)view.bindings.description=currentBinding('member',[desc.id])}
  views[node.id]=isGraphKind(view.kind)?graphView(world,view):view
 }
 return {...world,relationGraphInstalled:world.relationGraphInstalled||nodes.some(n=>n.viewType==='relationGraph')||undefined,views,nodes:nodes.map(n=>views[n.id]?{...n,name:views[n.id].name,classId:views[n.id].parentClassId,viewType:views[n.id].kind,parentId:nodes.find(source=>source.type==='file'&&source.classId===views[n.id].parentClassId)?.id||n.parentId}:n)}
}
export function updateInterfaceView(world:World,view:InterfaceView):World{if(isGraphKind(view.kind))view=graphView(world,view);return {...world,views:{...world.views,[view.id]:view},nodes:world.nodes.map(n=>n.id===view.id?{...n,name:view.name,classId:view.parentClassId,viewType:view.kind,parentId:world.nodes.find(source=>source.type==='file'&&source.classId===view.parentClassId)?.id||n.parentId}:n)}}
export function removeInterfaceView(world:World,id:string):World{const views={...world.views};delete views[id];return {...world,views,nodes:world.nodes.filter(n=>n.id!==id)}}
export function patchFieldTree(fields:FieldValue[],id:string,next:FieldValue|null):FieldValue[]{return fields.flatMap(f=>f.id===id?(next?[next]:[]):[{...f,children:patchFieldTree(f.children,id,next)}])}
export function freshViewField(schema:FieldSchema):FieldValue{return {id:uid(),schemaId:schema.id,key:schema.keyType==='Const'?schema.key:'',value:'',children:(schema.children||[]).filter(s=>!s.repeatable).map(freshViewField)}}
export function appendViewField(fields:FieldValue[],schemas:FieldSchema[],path:string[],item:FieldValue):FieldValue[]{const schema=schemas.find(s=>s.id===path[0]);if(!schema)throw new Error('关系对象路径已失效');if(path.length===1)return [...fields,item];let found=false;const next=fields.map(f=>{if(f.schemaId!==schema.id||found)return f;found=true;return {...f,children:appendViewField(f.children,schema.children||[],path.slice(1),item)}});if(!found){const parent=freshViewField(schema);next.push({...parent,children:appendViewField(parent.children,schema.children||[],path.slice(1),item)})}return next}
export function setRelativeValue(fields:FieldValue[],path:string[],value:string,part:'key'|'value',schemas:FieldSchema[]):FieldValue[]{const schema=schemas.find(s=>s.id===path[0]);if(!schema)throw new Error('连线目标路径已失效');const index=fields.findIndex(f=>f.schemaId===schema.id),next=[...fields],field=index<0?freshViewField(schema):fields[index],updated=path.length===1?{...field,[part]:value}:{...field,children:setRelativeValue(field.children,path.slice(1),value,part,schema.children||[])};if(index<0)next.push(updated);else next[index]=updated;return next}
export function graphRelationClass(world:World,view:InterfaceView):ClassDocument|undefined{if(view.kind==='relationGraph')return world.documents.find(d=>d.id==='relations');const parent=world.documents.find(d=>d.id===view.parentClassId),edge=parent&&schemaAtPath(parent.schema,view.bindings.edges?.path||[]),label=view.bindings.edgeLabel;if(label?.scope==='fixed'){const source=world.documents.find(d=>d.id===label.classId)?.entities.find(e=>e.id===label.entityId);const field=source&&concreteField(source.fields,label.path);return field?referencedEntity(world,field.value)?.doc:undefined}const schema=edge&&schemaAtPath(edge.children||[],label?.path||[]);return world.documents.find(d=>d.id===schema?.classId)}
export function decodeInterfaceFile(text:string,previous:InterfaceView,world:World):InterfaceView{
 const value=JSON.parse(text) as InterfaceView
 const points=(items:unknown)=>!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.values(items).every(p=>p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y))
 const styles=(items:unknown)=>!!items&&typeof items==='object'&&!Array.isArray(items)&&Object.values(items).every(s=>s&&typeof s.fill==='string'&&typeof s.stroke==='string'&&Number.isFinite(s.glow))
 if(!value||value.version!==1||value.id!==previous.id||value.fileName!==previous.fileName||value.kind!==previous.kind||typeof value.name!=='string'||!world.documents.some(d=>d.id===value.parentClassId)||!value.bindings||Array.isArray(value.bindings)||!Object.values(value.bindings).every(b=>b&&['current','fixed'].includes(b.scope)&&['name','instance','member'].includes(b.source)&&['content','markdown'].includes(b.mode)&&Array.isArray(b.path)&&b.path.every(id=>typeof id==='string')&&(!b.part||['key','value'].includes(b.part)))||!value.graph||!points(value.graph.positions)||!styles(value.graph.lineStyles)||!styles(value.graph.domainStyles)||typeof value.graph.showDomains!=='boolean'||(value.graph.showFunctionRelations!==undefined&&typeof value.graph.showFunctionRelations!=='boolean')||!value.map||typeof value.map.image!=='string'||typeof value.map.legend!=='string'||!points(value.map.positions))throw new Error('界面配置无效，身份、父类型、绑定和布局必须符合规范')
 return isGraphKind(value.kind)?graphView(world,value):value
}

/** Patch only selected leaf identities; generated fields (including inherited origins) stay read-only. */
export function patchSelectedGraphEdges(world:World,edges:ProjectedGraphEdge[],ids:string[],patch:Pick<Partial<FieldValue>,'key'|'value'>):World{
 const selected=new Set(ids)
 const walk=(field:FieldValue):FieldValue=>field.functionOrigin?field:selected.has(field.id)?{...field,...patch}:{...field,children:field.children.map(walk)}
 return edges.reduce((next,edge)=>edge.readOnly?next:patchGraphEdge(next,edge,walk(edge.relationField||edge.field)),world)
}
