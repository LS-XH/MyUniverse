import {createHostWorldApi} from '../model/hostWorldApi'
import {entityMarkdown,fieldMarkdown,markdownLocations,markdownHeadingLevels} from '../model/markdown'
import {FieldSchema,FieldValue,ToolDefinition,World} from '../model/types'
import {readScriptWorld} from './scriptHost'
import {emitInstanceProposal,emitInstanceAddProposal,ToolCallContext} from './instanceProposals'

export function runBuiltinTool(tool:ToolDefinition,params:Record<string,any>,source?:World,context?:ToolCallContext){
  if(tool.id==='builtin:ask_user'){if(!context?.askUser)throw new Error('向用户提问需要正在运行的聊天交互上下文');return context.askUser(params.question,params.options)}
  const world=readScriptWorld(source);if(!world)throw new Error('请先选择调用世界')
  const key=tool.id.slice('builtin:'.length),api=createHostWorldApi(()=>world,()=>{throw new Error('官方查询接口只读')})
  if(key==='list_classes')return api.classes().map(c=>c.name)
  const docs=world.documents.filter(d=>d.name===params.className);if(docs.length!==1)throw new Error('类不存在或名称重复: '+params.className)
  const doc=docs[0]
  const shape=(schemas:FieldSchema[]):unknown[]=>schemas.map(s=>({key:s.key,keyType:s.keyType,type:s.valueType,repeatable:!!s.repeatable,...(s.classId?{className:world.documents.find(d=>d.id===s.classId)?.name||s.classId}:{}),...(s.children?{children:shape(s.children)}:{})}))
  if(key==='class_structure')return {className:doc.name,members:shape(doc.schema)}
  if(key==='class_structure_markdown'){
    const empty=(schemas:FieldSchema[]):FieldValue[]=>schemas.map(s=>({id:s.id,schemaId:s.id,key:s.key,value:'',children:empty(s.children||[])}))
    return `# ${doc.name}\n\n## 实例名称\n\n${fieldMarkdown(empty(doc.schema),3)}`
  }
  if(key==='list_instances')return doc.entities.map(e=>e.name)
  if(key==='propose_instance_add')return emitInstanceAddProposal(world,doc,params.instanceName,params.markdown,context)
  const entities=doc.entities.filter(e=>e.name===params.instanceName);if(entities.length!==1)throw new Error('实例不存在或名称重复: '+params.instanceName)
  const entity=entities[0],instance=api.get_class(doc.id).get_instance(entity.id)
  if(key==='propose_member_change'){
    let fields=entity.fields,target:FieldValue|undefined
    for(const segment of params.path as {key:string;id?:string}[]){const matches=fields.filter(f=>f.key===segment.key&&(!segment.id||f.id===segment.id));if(matches.length!==1)throw new Error(matches.length?'子成员路径不唯一，请提供成员 ID':'子成员路径不存在');target=matches[0];fields=target.children}
    const isolated={...doc,entities:[entity]},lines=(`# ${doc.name}\n\n${entityMarkdown(entity)}`).split('\n'),location=markdownLocations(isolated)[target!.id]
    // Replace only the selected subtree's body, retaining its exact heading and all siblings.
    const depth=params.path.length+2,start=location.key+1
    if(markdownHeadingLevels(params.markdown).some(level=>level>0&&level<=depth))throw new Error('子成员正文不能包含目标或祖先层级标题；正文标题请加反斜杠转义')
    let end=start
    const levels=markdownHeadingLevels(lines.slice(start).join('\n'))
    while(end<lines.length&&!(levels[end-start]>0&&levels[end-start]<=depth))end++
    lines.splice(start,end-start,'',...params.markdown.replace(/\r\n?/g,'\n').split('\n'),'')
    const markdown=lines.slice(2).join('\n')
    return emitInstanceProposal(world,doc,entity,markdown,`仅修改子成员：${params.path.map((s:{key:string})=>s.key).join(' / ')}`,context)
  }
  const members=(items:any[]):unknown[]=>items.map(m=>({id:m.id,key:m.name,type:m.type,value:m.to_value(),children:members(m.members())}))
  if(key==='get_instance')return {id:entity.id,name:entity.name,className:doc.name,members:members(instance.members())}
  if(key==='get_instance_markdown')return entityMarkdown(entity)
  if(key==='find_instance_key'){
    const matches:unknown[]=[]
    const visit=(items:any[],path:{id:string;key:string}[])=>{for(const m of items){const next=[...path,{id:m.id,key:m.name}];if(m.name===params.key)matches.push({path:next,value:m.to_value()});visit(m.members(),next)}}
    visit(instance.members(),[]);return {found:matches.length>0,matches}
  }
  if(key==='propose_instance_change')return emitInstanceProposal(world,doc,entity,params.markdown,'请比较修改前后的实例内容，决定是否保存。',context)
  throw new Error('未知官方 Tool')
}
