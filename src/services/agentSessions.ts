import {builtinAgent,ADVANCED_AGENT_ID} from '../model/builtinAgents'
import {characterSchema,legacyCharacterSchema,ROLE_SKILL} from '../model/builtinSkills'
import {parseSkillMarkdown} from '../model/skillPackages'
import Ajv2020 from 'ajv/dist/2020'
import {AgentConfig,AgentDefinition,AgentSessionState,ChatParticipant,ToolDefinition,Workspace,World,uid} from '../model/types'
import {ContextMessage} from '../model/workflowValues'
import {agentManagerIds} from '../model/agentManagement'
import {registeredTools} from '../model/builtinTools'
import {toolParameters} from './tools'
// The legacy built-in base ID denotes the advanced type core when its example instance was deleted.
function memberBases(workspace:Workspace,config:AgentConfig){const agents=workspace.agents||[];return config.agentIds.includes(ADVANCED_AGENT_ID)&&!agents.some(a=>a.id===ADVANCED_AGENT_ID)?[...agents,{...builtinAgent('advanced'),name:'高级智能体类型核心'}]:agents}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,k==='required'&&Array.isArray(v[k])?[...v[k]].sort():v[k]])):v)
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false})
export function validateMemberOutput(value:unknown,schema?:Record<string,unknown>):unknown {
 if(!schema)return value
 let parsed:unknown=value
 if(typeof value==='string'){try{parsed=JSON.parse(value)}catch{throw new Error('子智能体输出必须是符合约定的 JSON，不含代码围栏或额外正文')}}
 const validate=ajv.compile(schema)
 if(!validate(parsed))throw new Error('子智能体输出格式不符合约定：'+ajv.errorsText(validate.errors))
 return parsed
}
export type MemberRunner=(agent:AgentDefinition,task:string,history:ContextMessage[])=>Promise<{value:unknown;history:ContextMessage[]}>
/** A conversation's public bus contains final outputs only; member protocols never cross it. */
export class AgentSession {
 private interrupts=new Set<()=>void>()
 private inputs:ContextMessage[]=[]
 readonly forcedSkillIds=new Set<string>()
 requestSkills(ids:string[]){for(const id of ids)this.forcedSkillIds.add(id)}
 revision=0
 onInterject(listener:()=>void){this.interrupts.add(listener);return()=>{this.interrupts.delete(listener)}}
 get hasInput(){return this.inputs.length>0}
 takeInput(){return this.inputs.splice(0)}
 setHuman(human:NonNullable<AgentSessionState['human']>){if(human.mode==='character'&&!human.name?.trim())throw new Error('请输入用户扮演的角色名称');this.state.human={...human,name:human.name?.trim()};this.changed()}
 interject(content:string){this.addUser(content);this.inputs.push({role:'user',name:this.state.human?.mode==='character'?'human':'observer',content});this.revision++;for(const listener of this.interrupts)listener()}
 state:AgentSessionState
 constructor(state:AgentSessionState={participants:[],publicMessages:[]},readonly publish?:(state:AgentSessionState)=>void){this.state=structuredClone(state)}
 private changed(){this.publish?.(structuredClone(this.state))}
 addUser(content:string){this.state.publicMessages.push({id:uid(),name:this.state.human?.mode==='character'?'human':'observer',content,createdAt:Date.now()});this.changed()}
 capabilities(workspace:Workspace){return registeredTools(workspace).filter(t=>agentManagerIds.includes(t.id))}
 handles(tool:ToolDefinition){return agentManagerIds.includes(tool.id)}
 async execute(tool:ToolDefinition,parameters:unknown,config:AgentConfig,workspace:Workspace,world:World|undefined,runner:MemberRunner){
  toolParameters(tool,parameters)
  const p=parameters as {name:string;baseAgentId:string;systemPrompt:string;toolIds:string[];skillIds:string[];outputSchema?:Record<string,unknown>;entity?:{classId:string;entityId:string};memberId:string;task:string}
  if(tool.id==='builtin:set_human'){const human=parameters as {mode:'observer'|'character';name?:string};this.setHuman(human);return {human:this.state.human}}
  if(tool.id==='builtin:list_members')return {human:this.state.human||{mode:'observer'},publicMessages:this.state.publicMessages.map(({name,content,participantId})=>({name,content,participantId})),members:this.state.participants.map(({id,name,protocolName,baseAgentId,entity})=>({id,name,protocolName,baseAgentId,entity})),bases:memberBases(workspace,config).filter(a=>config.agentIds.includes(a.id)&&a.enabled!==false&&a.preset==='advanced').map(({id,name})=>({id,name})),toolIds:config.toolIds,skillIds:config.skillIds}
  if(tool.id==='builtin:create_member'){
   if(this.state.participants.length>=16)throw new Error('当前会话最多允许 16 个独立成员')
   if(this.state.human?.mode==='character'&&p.name.trim()===this.state.human.name)throw new Error('该角色由用户扮演，不创建 AI 替身')
   if(!p.name.trim()||this.state.participants.some(m=>m.name===p.name.trim()))throw new Error('会话成员名称为空或已存在，请使用已有成员')
   const base=memberBases(workspace,config).find(a=>a.id===p.baseAgentId&&a.enabled!==false)
   if(!base||base.preset!=='advanced'||!config.agentIds.includes(base.id))throw new Error('成员基底必须是获准的高级智能体')
   if(p.toolIds.some(id=>!config.toolIds.includes(id)||agentManagerIds.includes(id))||p.skillIds.some(id=>!config.skillIds.includes(id)))throw new Error('成员能力超出管理者获准范围')
   if(p.toolIds.some(id=>!registeredTools(workspace).some(t=>t.id===id&&t.enabled))||p.skillIds.some(id=>!workspace.skills?.some(s=>s.id===id&&s.enabled&&!s.diskError)))throw new Error('成员能力已失效或停用')
   const required=(config.startupSkillIds||[]).flatMap(id=>{const skill=workspace.skills?.find(s=>s.id===id&&s.enabled&&!s.diskError);const declared=skill?.directory?parseSkillMarkdown(skill.content,skill.name).metadata.metadata?.['member-required-skills']:undefined;if(declared===undefined)return [];const ids=JSON.parse(declared);if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw new Error('启动技能的成员技能约束无效');return ids as string[]})
   if(required.some(id=>!p.skillIds.includes(id)))throw new Error('创建成员缺少启动 Skill 要求的技能，请按其规范选择 skillIds')
   const contracts=p.skillIds.map(id=>workspace.skills!.find(s=>s.id===id)!).map(s=>s.directory?parseSkillMarkdown(s.content,s.name).metadata.metadata?.['output-schema']:undefined).filter((v):v is string=>typeof v==='string')
   if(new Set(contracts.map(c=>canonical(JSON.parse(c)))).size>1)throw new Error('成员技能的输出格式约定冲突')
   const outputSchema=contracts[0]?JSON.parse(contracts[0]) as Record<string,unknown>:p.outputSchema
   if(p.outputSchema&&outputSchema&&canonical(p.outputSchema)!==canonical(outputSchema))throw new Error('成员输出格式与技能约定冲突')
   if(outputSchema)ajv.compile(outputSchema)
   if(p.entity&&!world?.documents.find(d=>d.id===p.entity!.classId)?.entities.some(e=>e.id===p.entity!.entityId&&e.name===p.name.trim()))throw new Error('角色名称与绑定的世界实例不匹配')
   const id=uid(),member:ChatParticipant={id,name:p.name.trim(),protocolName:'member_'+id.replace(/-/g,''),baseAgentId:base.id,systemPrompt:p.systemPrompt,toolIds:[...p.toolIds],skillIds:[...p.skillIds],outputSchema:structuredClone(outputSchema),entity:structuredClone(p.entity),history:[],cursor:0}
   this.state.participants.push(member);this.changed();return {id,name:member.name,protocolName:member.protocolName}
  }
  if(tool.id!=='builtin:run_member')throw new Error('未知 Agent Manager 操作')
  const member=this.state.participants.find(m=>m.id===p.memberId)
  if(member&&this.state.human?.mode==='character'&&member.name===this.state.human.name)throw new Error('该角色由用户控制，请等待用户发言，不得代演')
  if(!member)throw new Error('会话成员不存在')
  if(!config.agentIds.includes(member.baseAgentId)||member.toolIds.some(id=>!config.toolIds.includes(id))||member.skillIds.some(id=>!config.skillIds.includes(id)))throw new Error('成员所需能力已从管理者配置移除')
  const base=memberBases(workspace,config).find(a=>a.id===member.baseAgentId&&a.preset==='advanced'&&a.enabled!==false)
  if(!base)throw new Error('成员基底已不存在或停用')
  const roleSkill=workspace.skills?.find(s=>s.id===ROLE_SKILL),currentContract=roleSkill?.directory?parseSkillMarkdown(roleSkill.content,roleSkill.name).metadata.metadata?.['output-schema']:undefined
  if(member.skillIds.includes(ROLE_SKILL)&&canonical(member.outputSchema)===canonical(legacyCharacterSchema)&&typeof currentContract==='string'&&canonical(JSON.parse(currentContract))===canonical(characterSchema))member.outputSchema=structuredClone(characterSchema)
  const publicEnd=this.state.publicMessages.length
  const roster=[{name:this.state.human?.mode==='character'?this.state.human.name||'用户角色':'旁观用户',protocolName:this.state.human?.mode==='character'?'human':'observer'},...this.state.participants.map(({name,protocolName})=>({name,protocolName}))]
  // Other assistants are public speakers, not this member's own assistant turns.
  const updates:ContextMessage[]=this.state.publicMessages.slice(member.cursor,publicEnd).filter(m=>m.participantId!==member.id).map(m=>({role:'user',...(m.name?{name:m.name}:{}),content:m.content}))
  const history:ContextMessage[]=[...structuredClone(member.history),{role:'user',content:'公开群聊成员名称映射：'+JSON.stringify(roster)},...updates]
  const definition:AgentDefinition={...base,id:`session-member:${member.id}`,name:member.name,config:{...base.config!,capabilityDefaultsVersion:1,toolFolderIds:[],skillFolderIds:[],manageAgents:false,startupSkillIds:member.skillIds,systemPrompt:member.systemPrompt,toolIds:member.toolIds,skillIds:member.skillIds,agentIds:[]}}
  const output=await runner(definition,p.task,history)
  const value=validateMemberOutput(output.value,member.outputSchema),content=typeof value==='string'?value:JSON.stringify(value)
  // No private state or unvalidated output is published on failure/cancellation.
  member.history=structuredClone(output.history);this.state.publicMessages.push({id:uid(),participantId:member.id,name:member.protocolName,content,createdAt:Date.now()});member.cursor=publicEnd;this.changed()
  return {memberId:member.id,name:member.name,output:value}
 }
}
