import {runSkillRuntime} from './runtimeSkills'
import {entityMarkdown} from '../model/markdown'
import {ToolDefinition,World} from '../model/types'
import {readScriptWorld} from './scriptHost'
import {emitInstanceProposal,emitInstanceAddProposal,ToolCallContext} from './instanceProposals'
export function runBuiltinTool(tool:ToolDefinition,params:Record<string,any>,source?:World,context?:ToolCallContext,signal?:AbortSignal){
 if(tool.id.startsWith('builtin:runtime_'))return runSkillRuntime(tool.id,params,signal,context,source?.id)
 if(tool.id==='builtin:ask_user'){if(!context?.askUser)throw new Error('向用户提问需要正在运行的聊天交互上下文');return context.askUser(params.question,params.options)}
 if(['builtin:set_human','builtin:list_members','builtin:create_member','builtin:run_member','builtin:list_skills','builtin:read_skill','builtin:read_skill_reference'].includes(tool.id))throw new Error('Manager 工具需要 Agent 当前调用上下文')
 const world=readScriptWorld(source);if(!world)throw new Error('请先选择调用世界')
 const key=tool.id.slice(8)
 if(key==='list_classes')return world.documents.map(d=>d.name)
 const docs=world.documents.filter(d=>d.name===params.className);if(docs.length!==1)throw new Error('类不存在或名称重复: '+params.className)
 const doc=docs[0]
 if(key==='list_instances')return doc.entities.map(e=>e.name)
 if(key==='propose_instance_add')return emitInstanceAddProposal(world,doc,params.instanceName,params.markdown,context)
 const entities=doc.entities.filter(e=>e.name===params.instanceName);if(entities.length!==1)throw new Error('实例不存在或名称重复: '+params.instanceName)
 const entity=entities[0]
 if(key==='get_instance_markdown')return {id:entity.id,classId:doc.id,name:entity.name,className:doc.name,markdown:entityMarkdown(entity)}
 if(key==='propose_instance_change')return emitInstanceProposal(world,doc,entity,params.markdown,'请比较修改前后的实例内容，决定是否保存。',context)
 throw new Error('未知或已移除的官方 Tool')
}
