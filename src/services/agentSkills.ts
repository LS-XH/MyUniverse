import {SkillDefinition,ToolDefinition,Workspace} from '../model/types'
import {registeredTools,skillManagerIds} from '../model/builtinTools'
import {parseSkillMarkdown,validReferencePath,implicitSkillAllowed} from '../model/skillPackages'
import {toolName,toolParameters,toolSpec} from './tools'
/** Activation and registered tools are isolated to one invocation. */
export class AgentSkillManager {
 private explicit=new Set<string>()
 private loaded=new Map<string,SkillDefinition>()
 readonly managers:ToolDefinition[]
 constructor(readonly skills:SkillDefinition[],workspace:Workspace,readonly exposeManagers=true){
  this.managers=registeredTools(workspace).filter(t=>skillManagerIds.includes(t.id)).map(t=>t.id==='builtin:read_skill'?{...t,inputSchema:{...t.inputSchema,properties:{skillId:{type:'string',...(skills.filter(implicitSkillAllowed).length?{enum:skills.filter(implicitSkillAllowed).map(s=>s.id)}:{description:'当前无获准技能；先使用发现可用技能查看目录。'})}}}}:t)
 }
 outputSchema(){const schemas=[...this.loaded.values()].map(s=>s.directory?parseSkillMarkdown(s.content,s.name).metadata.metadata?.['output-schema']:undefined).filter((v):v is string=>typeof v==='string');if(new Set(schemas).size>1)throw new Error('已加载技能的输出格式约定冲突');return schemas[0]?JSON.parse(schemas[0]) as Record<string,unknown>:undefined}
 force(ids:string[],workspace:Workspace,currentTools:ToolDefinition[]=[]){const bodies:unknown[]=[];for(const id of ids){this.explicit.add(id);if(this.loaded.has(id))continue;const skill=workspace.skills?.find(s=>s.id===id&&s.enabled&&!s.diskError);if(!skill)throw new Error('用户指定的技能已失效：'+id);if(!this.skills.some(s=>s.id===id))this.skills.push(skill);const read=this.managers.find(t=>t.id==='builtin:read_skill')!;read.inputSchema={...read.inputSchema,properties:{skillId:{type:'string',enum:this.skills.filter(s=>implicitSkillAllowed(s)||this.explicit.has(s.id)).map(s=>s.id)}}};bodies.push(this.execute(read,{skillId:id},[...currentTools.filter(t=>!this.managers.some(m=>m.id===t.id)),...this.capabilities().filter(t=>this.managers.some(m=>m.id===t.id)||!currentTools.some(c=>c.id===t.id))]))}return bodies}
 capabilities(){return [...(this.exposeManagers?this.managers:[]),...[...this.loaded.values()].flatMap(s=>(s.tools||[]).filter(t=>t.enabled))]}
 handles(tool:ToolDefinition){return this.managers.some(t=>t.id===tool.id)}
 execute(tool:ToolDefinition,parameters:unknown,currentTools:ToolDefinition[]=[]){
  toolParameters(tool,parameters);const params=parameters as {skillId:string;path:string}
  if(tool.id==='builtin:list_skills')return this.skills.filter(s=>implicitSkillAllowed(s)||this.explicit.has(s.id)).map(({id,name,description})=>({id,name,description,loaded:this.loaded.has(id)}))
  const skill=this.skills.find(s=>s.id===params.skillId)
  if(!skill||skill.diskError)throw new Error('Skill 不在本次获准目录中或格式无效')
  if(tool.id==='builtin:read_skill'){
   if(!implicitSkillAllowed(skill)&&!this.explicit.has(skill.id))throw new Error('该技能仅允许用户显式指定')
   const metadata=skill.directory?parseSkillMarkdown(skill.content,skill.name).metadata:undefined
   const allowed=typeof metadata?.['allowed-tools']==='string'?metadata['allowed-tools'].trim().split(/\s+/):undefined
   const additions=(skill.tools||[]).filter(t=>t.enabled&&(!allowed||allowed.includes(toolName(t))))
   for(const t of additions){if(t.kind==='builtin'||t.id.startsWith('builtin:'))throw new Error('Skill 不能替换系统 Tool');toolSpec(t)}
   const previouslyOwned=this.loaded.get(skill.id)?.tools||[]
   const existing=currentTools.filter(t=>!previouslyOwned.some(p=>p.id===t.id))
   for(const [id,other] of this.loaded)if(id!==skill.id&&(other.tools||[]).some(t=>additions.some(a=>a.id===t.id||toolName(a)===toolName(t))))throw new Error('Skill Tool 身份或调用名称与其他技能冲突')
   if(existing.some(t=>additions.some(a=>a.id===t.id)))throw new Error('Skill Tool 身份与当前能力冲突')
   const prospective=[...existing,...additions],byId=new Map<string,ToolDefinition>()
   for(const t of prospective){const previous=byId.get(t.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(t))throw new Error('Skill Tool 身份冲突');byId.set(t.id,t)}
   if(new Set([...byId.values()].map(toolName)).size!==byId.size)throw new Error('Skill Tool 调用名称与当前能力冲突')
   this.loaded.set(skill.id,{...skill,tools:additions})
   return {skillId:skill.id,name:skill.name,content:skill.content,references:Object.keys(skill.references||{}),tools:additions.map(t=>({name:t.name,callName:toolName(t),description:t.description})),assets:skill.assets||[]}
  }
  if(tool.id==='builtin:read_skill_reference'){
   if(!this.loaded.has(skill.id))throw new Error('请先加载该 Skill')
   if(!validReferencePath(params.path)||!Object.hasOwn(skill.references||{},params.path))throw new Error('参考文档不存在，或路径不在该 Skill 的 references 内')
   return {skillId:skill.id,path:params.path,content:skill.references![params.path]}
  }
  throw new Error('未知 Skill Manager 操作')
 }
}
export function skillCatalog(skills:SkillDefinition[]):string {
 return 'Skill Manager：使用 agent_list_skills 发现获准技能；任务匹配时调用 agent_read_skill 加载 SKILL.md，并注册技能 scripts 中的工具；参考文档通过 agent_read_skill_reference 按需读取。Skill 不授予未勾选的全局 Tool 或子 Agent。\n'+JSON.stringify(skills.filter(implicitSkillAllowed).map(({id,name,description})=>({id,name,description})))
}
