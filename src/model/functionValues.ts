import { classLink } from './markdown'
import { functionReferenceIdentity, referenceBase } from './functions'
import { ClassDocument, Entity, FieldSchema, FieldValue, FunctionContext, FunctionType, TypedMember, TypedValue, World } from './types'

export function fieldTypedValue(field:FieldValue,schema:FieldSchema,world?:World):TypedValue {
  if(schema.valueType==='Object')return {type:'Object',members:field.children.map(f=>{const s=schema.children?.find(s=>s.id===f.schemaId);if(!s)throw new Error(`属性“${f.key}”缺少类型配置`);return {id:f.id,schemaId:f.schemaId,key:f.key,value:fieldTypedValue(f,s,world)}})}
  if(schema.valueType==='Class'){
    const base=referenceBase(field.value),file=base.match(/\]\(([^#]+)#/)?.[1],anchor=base.match(/#([^)]*)\)/)?.[1]
    const doc=world?.documents.find(d=>d.fileName===file);let name='';try{name=decodeURIComponent(anchor||'')}catch{throw new Error('对象引用格式错误')}
    const entity=doc?.entities.find(e=>e.name===name)
    if(!field.value)return {type:'Null',value:null}
    if(!doc||!entity)throw new Error(`对象引用“${field.value}”已失效`)
    const [functionId,fieldId]=functionReferenceIdentity(field.value).split('/')
    if(functionId&&fieldId){const visit=(fields:FieldValue[]):TypedValue|undefined=>{for(const f of fields){if(f.id===fieldId){const result=f.functionResults?.find(r=>r.functionId===functionId&&!r.error);if(result)return result.typedValue||{type:'Text',value:result.value}}const child=visit(f.children);if(child)return child}};const typed=visit(entity.fields);if(typed)return typed;throw new Error('引用的函数返回值尚未生成或运行失败')}
    return {type:'Class',classId:doc.id,entityId:entity.id}
  }
  if(schema.valueType==='Null')return {type:'Null',value:null}
  if(schema.valueType==='Integer'||schema.valueType==='Decimal'){
    if(!field.value.trim())return {type:'Null',value:null}
    const value=Number(field.value)
    if(!Number.isFinite(value)||(schema.valueType==='Integer'&&!Number.isSafeInteger(value)))throw new Error(`属性“${field.key}”不是有效${schema.valueType==='Integer'?'安全整数':'小数'}`)
    return {type:schema.valueType,value}
  }
  if(schema.valueType==='Data'&&!field.value)return {type:'Null',value:null}
  return {type:schema.valueType,value:field.value}
}
export function functionContext(world:World,doc:ClassDocument,entity:Entity,field:FieldValue,schema:FieldSchema):FunctionContext {
  return {self:{classId:doc.id,entityId:entity.id},input:fieldTypedValue(field,schema,world)}
}

/** Validate the tagged representation, never guess a native object's meaning. */
export function validateTypedValue(raw:unknown,contract?:FunctionType,world?:World,path='返回值',depth=0):TypedValue {
  if(depth>32)throw new Error(`${path}嵌套超过 32 层`)
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`${path}需要带 type 的对象，请使用 values.text / values.object 等构造器`)
  const v=raw as TypedValue,types=['Object','Class','Data','Text','Content','Integer','Decimal','Null']
  if(!types.includes(v.type))throw new Error(`${path}.type 无效`)
  if(contract&&v.type!==contract.type)throw new Error(`${path}应为 ${contract.type}，实际为 ${v.type}`)
  const allowed=v.type==='Object'?['type','members','classId']:v.type==='Class'?['type','classId','entityId']:['type','value']
  for(const key of Object.keys(v))if(!allowed.includes(key))throw new Error(`${path}.${key}不是 ${v.type} 的成员`)
  if(v.type==='Object'){
    if(!Array.isArray(v.members))throw new Error(`${path}.members 需要属性列表`)
    const classId=contract?.classId||v.classId
    if(contract?.classId&&v.classId&&v.classId!==contract.classId)throw new Error(`${path}.classId 与声明不符`)
    const doc=classId?world?.documents.find(d=>d.id===classId):undefined
    if(classId&&!doc)throw new Error(`${path}指定的类不存在`)
    const members=v.members.map((m,i)=>{
      if(!m||typeof m.key!=='string')throw new Error(`${path}.members[${i}].key 需要文字`)
      if(m.id!==undefined&&typeof m.id!=='string'||m.schemaId!==undefined&&typeof m.schemaId!=='string')throw new Error(`${path}.${m.key} 的 id / schemaId 必须为文字`)
      for(const key of Object.keys(m))if(!['key','value','id','schemaId'].includes(key))throw new Error(`${path}.${m.key}.${key}不是属性成员`)
      return {key:m.key,...(m.id?{id:m.id}:{}),...(m.schemaId?{schemaId:m.schemaId}:{}),value:validateTypedValue(m.value,undefined,world,`${path}.${m.key}`,depth+1)}
    })
    if(doc)validateMembers(members,doc.schema,world,path,depth)
    return {type:'Object',...(classId?{classId}:{}),members}
  }
  if(v.type==='Class'){
    if(typeof v.classId!=='string'||typeof v.entityId!=='string')throw new Error(`${path}需要 classId 和 entityId`)
    if(contract?.classId&&v.classId!==contract.classId)throw new Error(`${path}引用的类与声明不符`)
    if(!world?.documents.find(d=>d.id===v.classId)?.entities.some(e=>e.id===v.entityId))throw new Error(`${path}引用的实例不存在`)
    return {type:'Class',classId:v.classId,entityId:v.entityId}
  }
  if(v.type==='Null'){if(v.value!==null)throw new Error(`${path}.value 必须为 null`);return {type:'Null',value:null}}
  if(v.type==='Integer'||v.type==='Decimal'){
    if(typeof v.value!=='number'||!Number.isFinite(v.value)||(v.type==='Integer'&&!Number.isSafeInteger(v.value)))throw new Error(`${path}.value 必须为${v.type==='Integer'?'安全整数':'有限数值'}`)
  }else if(typeof v.value!=='string')throw new Error(`${path}.value 必须为文字`)
  if(v.type==='Data'){
    const s=v.value as string,y=Number(s.slice(0,4)),m=Number(s.slice(4,6)),d=Number(s.slice(6,8)),date=new Date(0);date.setUTCFullYear(y,m-1,d)
    if(!/^\d{8}$/.test(s)||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw new Error(`${path}需要有效的 YYYYMMDD 日期`)
  }
  return {type:v.type,value:v.value}
}
function validateMembers(members:TypedMember[],schemas:FieldSchema[],world:World|undefined,path:string,depth:number){
  for(const schema of schemas){const matches=members.filter(m=>m.schemaId===schema.id||(!m.schemaId&&m.key===schema.key));if(!schema.repeatable&&matches.length!==1)throw new Error(`${path}.${schema.key}需要一个属性`)
    for(const member of matches){
      if(schema.keyType==='Const'&&member.key!==schema.key)throw new Error(`${path}.${member.key}的常量键应为 ${schema.key}`)
      if(schema.keyType==='Class'){
        const doc=world?.documents.find(d=>d.id===schema.classId)
        if(!doc?.entities.some(e=>classLink(world!,doc.id,e.id)===member.key))throw new Error(`${path}.${member.key}的键需要有效的类实例引用`)
      }
      validateTypedValue(member.value,{type:schema.valueType,classId:schema.valueType==='Class'?schema.classId:undefined},world,`${path}.${member.key}`,depth+1);if(schema.valueType==='Object')validateMembers(member.value.members!,schema.children||[],world,`${path}.${member.key}`,depth+1)
    }
  }
  for(const m of members)if(!schemas.some(s=>m.schemaId?s.id===m.schemaId:s.key===m.key))throw new Error(`${path}.${m.key}不在类的属性配置中`)
}
export function typedValueMarkdown(value:TypedValue,world?:World,depth=1):string {
  if(value.type==='Null')return ''
  if(value.type==='Class')return world?classLink(world,value.classId!,value.entityId!):''
  if(value.type==='Object')return value.members!.map(m=>`${'#'.repeat(depth)} ${m.key}\n\n${typedValueMarkdown(m.value,world,depth+1)}`).join('\n\n')
  return String(value.value)
}

/** Self contained because this factory is serialized for both JS runtimes. */
export function createFunctionApi(world:any,context:FunctionContext,contract:FunctionType) {
  const values={
    text:(value:string)=>({type:'Text',value}),content:(value:string)=>({type:'Content',value}),integer:(value:number)=>({type:'Integer',value}),decimal:(value:number)=>({type:'Decimal',value}),date:(value:string)=>({type:'Data',value}),null:()=>({type:'Null',value:null}),
    class:(classId:string,entityId:string)=>({type:'Class',classId,entityId}),
    object:(members:any,classId?:string)=>({type:'Object',members:Array.isArray(members)?members:Object.entries(members).map(([key,value])=>({key,value})),...(classId?{classId}:{})}),
    from:(value:any)=>value&&typeof value==='object'&&value.type?value:contract.type==='Object'?{type:'Object',members:value,classId:contract.classId}:contract.type==='Class'?{type:'Class',...value,classId:contract.classId||value.classId}:{type:contract.type,value:contract.type==='Null'?null:value}
  }
  const wrap=(data:TypedValue):any=>({type:data.type,classId:data.classId,entityId:data.entityId,
    value:()=>data.type==='Object'?data.members:data.type==='Class'?{classId:data.classId,entityId:data.entityId}:data.value,
    to_value:()=>JSON.parse(JSON.stringify(data)),
    instance:()=>{if(data.type!=='Class')throw new Error('只有 Class 值可读取实例');return world.get_class(data.classId).get_instance(data.entityId)},
    members:()=>{if(data.type!=='Object')throw new Error('只有 Object 值具有子成员');return data.members!.map(m=>({id:m.id,schemaId:m.schemaId,key:m.key,...wrap(m.value)}))},
    get_member:(key:string)=>{const matches=data.members?.filter(m=>m.id===key||m.schemaId===key||m.key===key)||[];if(matches.length!==1)throw new Error('属性不存在或重名，请使用 ID: '+key);return wrap(matches[0].value)},
    markdown:():string=>data.type==='Object'?data.members!.map(m=>'### '+m.key+'\n\n'+wrap(m.value).markdown()).join('\n\n'):data.type==='Null'?'':data.type==='Class'?world.get_class(data.classId).get_instance(data.entityId).markdown():String(data.value)
  })
  const self=world.get_class(context.self.classId).get_instance(context.self.entityId)
  return {self:{...self,type:'Class',classId:context.self.classId,schema:()=>world.get_class(context.self.classId).schema(),to_value:()=>values.class(context.self.classId,context.self.entityId)},input:wrap(context.input),values}
}
