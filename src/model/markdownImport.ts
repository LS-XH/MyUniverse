import {type ClassDocument,type Entity,type FieldSchema,type FieldValue,type World,uid} from './types'
import {headingTree,trimBlankLines,escapeTextHeadings,type Heading} from './markdownSyntax'
import {referenceText} from './referenceText'
import {sameData} from './merge'

/** Markdown supplies visible values; identities and omitted branches stay in JSON; imported rows become user-owned. */
export function fillDocumentMarkdown(markdown:string,previous:ClassDocument,world?:World,options:{rejectUnknown?:boolean;replaceContents?:boolean;appendOnly?:boolean;preserveFunctionOrigin?:boolean}={}):ClassDocument {
 const {root,lines}=headingTree(markdown)
 const byName=new Map(previous.entities.map(e=>[e.name,e]))
 const incoming=root.children.map(node=>({node,entity:byName.get(node.key)||{id:uid(),name:node.key,fields:[]}}))
 const localEntities=options.replaceContents?incoming.map(item=>item.entity):[...previous.entities,...incoming.filter(item=>!byName.has(item.node.key)).map(item=>item.entity)]
 const documents=new Map((world?.documents||[]).map(doc=>[doc.id,doc]))
 documents.set(previous.id,{...previous,entities:localEntities})
 const indexes=new Map([...documents].map(([id,doc])=>[id,new Map(doc.entities.map(e=>[e.name,e]))]))
 const ambiguous=new Map([...documents].map(([id,doc])=>{const names=new Set<string>(),duplicates=new Set<string>();for(const entity of doc.entities){if(names.has(entity.name))duplicates.add(entity.name);names.add(entity.name)}return [id,duplicates]}))
 const legacyName=(text:string)=>{const match=text.match(/^\[[^\]]*\]\(([^#\n]+)#([^\n)]+)\)/);if(!match)return text;try{return decodeURIComponent(match[2])}catch{throw new Error('实例引用格式无效')}}
 const resolve=(text:string,s:FieldSchema):string=>{
  if(!text)return ''
  const doc=documents.get(s.classId||''),name=legacyName(text),entity=indexes.get(s.classId||'')?.get(name)
  if(ambiguous.get(s.classId||'')?.has(name))throw new Error(`“${name}”在目标类中存在同名实例，引用有歧义`)
  if(!doc||!entity)throw new Error(`“${s.key}”需要 ${doc?.name||'配置的类'} 的实例，未找到“${name}”`)
  return `[${entity.name}](${doc.fileName}#${encodeURIComponent(entity.name)})`
 }
 // Old machine annotations remain import-compatible, but never establish provenance.
 const stripMetadata=(text:string)=>text.replace(/^\s*<!-- (?:function-origin|function-sources|function-value):[^\n]* -->\s*\n?/gm,'')
 const body=(node:Heading,descendants=false)=>escapeTextHeadings(trimBlankLines(stripMetadata(lines.slice(node.start+1,descendants?node.end:node.children[0]?.start??node.end).join('\n'))),false)
 if(body(root))throw new Error('一级类标题下的正文没有对应实例，请将正文移到二级实例标题下面')
 const userField=(field:FieldValue):FieldValue=>{if(options.preserveFunctionOrigin)return field;if(!field.functionOrigin&&!field.functionRuns&&!field.functionResults)return field;const {functionOrigin:_origin,functionRuns:_runs,functionResults:_results,...value}=field;return value}
 const empty=(s:FieldSchema):FieldValue=>({id:uid(),schemaId:s.id,key:s.keyType==='Const'?s.key:'',value:'',children:(s.children||[]).filter(s=>!s.repeatable).map(empty)})
 const comparable=(text:string)=>stripMetadata(text).split('\n').filter(line=>line.trim()).map(line=>{const clean=line.replace(/\s+<!--.*?-->\s*$/,''),heading=clean.match(/^(#+)\s+(.*)$/);return heading?heading[1]+' '+referenceText(heading[2]):referenceText(clean)}).join('\n')
 const fieldBlock=(field:FieldValue,depth:number):string=>`${'#'.repeat(depth)} ${referenceText(field.key)}\n${escapeTextHeadings(referenceText(field.value),true)}\n${field.children.map(f=>fieldBlock(f,depth+1)).join('\n')}`
 let matched=0
 const cursors=new Map<FieldValue[],number>()
 const take=(buckets:Map<string,FieldValue[]>,key:string,used:Set<string>)=>{const bucket=buckets.get(key);if(!bucket)return;let index=cursors.get(bucket)||0;while(index<bucket.length&&used.has(bucket[index].id))index++;cursors.set(bucket,index+1);return bucket[index]}
 function bind(nodes:Heading[],schemas:FieldSchema[],old:FieldValue[]):FieldValue[]{
  const counts=new Map<string,number>()
  const rows=nodes.flatMap(node=>{
   let target=schemas.find(s=>s.keyType==='Const'&&s.key===node.key)
   if(!target){
    const candidates=schemas.filter(s=>s.keyType==='Class'&&indexes.get(s.classId||'')?.has(legacyName(node.key)))
    if(candidates.length>1)throw new Error(`实例键“${node.key}”匹配多个类，请消除属性配置中的歧义`)
    target=candidates[0]
   }
   if(!target){const candidates=schemas.filter(s=>s.keyType==='Class'&&(s.repeatable||!counts.has(s.id))&&(!node.key||node.key==='新属性'||node.key===s.placeholder||node.key===s.key));if(candidates.length===1)target=candidates[0]}
   target ||= schemas.find(s=>s.keyType==='Text'&&(s.repeatable||!counts.has(s.id)))
   if(!target&&schemas.length&&schemas.every(s=>s.keyType==='Class'))throw new Error(`实例键“${node.key}”未找到匹配的类实例`)
   if(!target||!target.repeatable&&counts.has(target.id)){if(options.rejectUnknown)throw new Error(`“${node.key}”不符合当前属性配置`);return []}
   counts.set(target.id,(counts.get(target.id)||0)+1)
   const s=target,key=s.keyType==='Class'&&node.key&&indexes.get(s.classId||'')?.has(legacyName(node.key))?resolve(node.key,s):node.key
   return [{node,s,key,signature:comparable(lines.slice(node.start,node.end).join('\n'))}]
  })
  // Reserve unchanged occurrences first: a changed earlier row must not steal a later generated row's ID.
  const exact=new Map<string,FieldValue[]>(),byKey=new Map<string,FieldValue[]>(),bySchema=new Map<string,FieldValue[]>()
  const add=(map:Map<string,FieldValue[]>,key:string,f:FieldValue)=>{const list=map.get(key)||[];list.push(f);map.set(key,list)}
  for(const f of old){add(exact,f.schemaId+'\0'+comparable(fieldBlock(f,nodes[0]?.level||3)),f);add(byKey,f.schemaId+'\0'+f.key,f);add(bySchema,f.schemaId,f)}
  const used=new Set<string>(),reserved=new Map<Heading,FieldValue>()
  for(const row of rows){const prior=take(exact,row.s.id+'\0'+row.signature,used);if(prior){used.add(prior.id);reserved.set(row.node,prior)}}
  matched+=rows.length
  const replacements=new Map<string,FieldValue>(),added:FieldValue[]=[],ordered:FieldValue[]=[]
  for(const {node,s,key} of rows){
   const prior=reserved.get(node)||(!options.appendOnly||!s.repeatable||s.valueType==='Object'?take(byKey,s.id+'\0'+key,used):undefined)||(!options.appendOnly?take(bySchema,s.id,used):undefined)
   if(prior)used.add(prior.id)
   let value='',children:FieldValue[]=[]
   if(s.valueType==='Object'){
    children=bind(node.children,s.children||[],prior?.children||[])
    const text=body(node),content=s.children?.find(s=>s.keyType==='Const'&&s.key==='内容')
    if(text&&content){const field=children.find(f=>f.schemaId===content.id);if(field){children=children.map(f=>f===field?options.appendOnly?field:userField({...field,value:text}):f)}else children.unshift({...empty(content),value:text})}
   }else{
    value=body(node,true)
    if(s.valueType==='Null'&&value)throw new Error(`“${node.key}”配置为 Null，不能包含内容`)
    if(s.valueType==='Class')value=resolve(value,s)
    if(value&&s.valueType==='Integer'&&!/^-?\d+$/.test(value))throw new Error(`“${node.key}”需要整数`)
    if(value&&s.valueType==='Decimal'&&!/^-?\d+(\.\d+)?$/.test(value))throw new Error(`“${node.key}”需要小数`)
    if(value&&s.valueType==='Data'&&!/^\d{8}$/.test(value))throw new Error(`“${node.key}”需要 YYYYMMDD 格式日期`)
   }
   const unchanged=prior&&(s.keyType==='Class'?referenceText(prior.key)===referenceText(key):prior.key===key)&&(s.valueType==='Class'?referenceText(prior.value)===referenceText(value):prior.value===value)&&sameData(prior.children,children)
   const candidate:FieldValue=unchanged?prior:{...(prior||empty(s)),key,value,children}
   let field=userField(candidate)
   if(options.preserveFunctionOrigin&&prior?.functionOrigin)field={...field,functionOrigin:prior.functionOrigin,...(unchanged?{functionRuns:prior.functionRuns,functionResults:prior.functionResults}:{})}
   if(options.appendOnly&&prior){
    // Existing scalar values are never overwritten. Object containers only gain children.
    field=s.valueType==='Object'?{...prior,children}:prior
   }
   ordered.push(field)
   if(prior)replacements.set(prior.id,field);else added.push(field)
  }
  const result=options.replaceContents?ordered:[...old.map(f=>replacements.get(f.id)||f),...added]
  for(const s of schemas)if(!s.repeatable&&!result.some(f=>f.schemaId===s.id))result.push(empty(s))
  return result
 }
 const replacements=new Map<string,Entity>(),added:Entity[]=[],ordered:Entity[]=[]
 for(const {node,entity} of incoming){
  const fields=bind(node.children,previous.schema,entity.fields)
  const text=body(node),content=previous.schema.find(s=>s.keyType==='Const'&&s.key==='内容')
  if(text&&content){const index=fields.findIndex(f=>f.schemaId===content.id);const field=options.appendOnly&&index>=0?fields[index]:userField({... (index>=0?fields[index]:empty(content)),value:text});if(index>=0)fields[index]=field;else fields.unshift(field)}
  const next=sameData(fields,entity.fields)?entity:{...entity,fields}
  ordered.push(next)
  if(byName.has(node.key))replacements.set(entity.id,next);else added.push(next)
 }
 if(options.replaceContents&&root.children.some(node=>node.children.length)&&previous.schema.length&&!matched)throw new Error('Markdown 中的属性均未匹配当前配置，未覆盖 JSON；请检查成员标题及属性配置')
 const entities=options.replaceContents?ordered:[...previous.entities.map(e=>replacements.get(e.id)||e),...added]
 return {...previous,entities,...(options.replaceContents&&previous.entityLabels?{entityLabels:Object.fromEntries(Object.entries(previous.entityLabels).filter(([id])=>entities.some(entity=>entity.id===id)))}:{})}
}
