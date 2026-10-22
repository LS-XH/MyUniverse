import {defaultAgentCapabilities} from './agentCapabilityDefaults'
import {runtimeTools,SKILL_CREATOR_ID} from './runtimeSkills'
import {createAgent} from './workflows'
import {GROUP_SKILL,ROLE_SKILL,NARRATOR_SKILL} from './builtinSkills'
import {AgentConfig,AgentDefinition,Workspace} from './types'
import {conversationAgent} from './workflowTemplates'
import {SYSTEM_DEFAULT_MODEL} from './models'
import {walkWorkflowNodes} from './workflowScopes'
import {ContextMessage} from './workflowValues'
export const REACT_AGENT_ID='builtin-agent:react',ADVANCED_AGENT_ID='builtin-agent:advanced',ROLEPLAY_AGENT_ID='builtin-agent:roleplay'
export const defaultConfig=(advanced=false):AgentConfig=>({systemPrompt:'你是创作助手，依据用户提供的世界信息完成任务，需要时调用获准工具。',toolIds:[],agentIds:[],skillIds:[],maxRounds:advanced?32:16})
/** Deterministic identities keep protected graphs and their observations stable across restarts. */
export function presetDefinition(agent:AgentDefinition,history:ContextMessage[]=[]):AgentDefinition {
 if(!agent.preset&&agent.agentType&&agent.agentType!=='workflow')agent={...agent,preset:agent.agentType}
 if(!agent.preset)return {...agent,agentType:'workflow'}
 const config={...defaultConfig(agent.preset!=='react'),...agent.config}
 if(!Number.isSafeInteger(config.maxRounds)||config.maxRounds<1||config.maxRounds>128)throw new Error('Agent 最大交流轮次应为 1–128')
 if(config.startupSkillIds?.some(id=>!config.skillIds.includes(id)))throw new Error('启动 Skill 必须位于配置许可目录中')
 for(const ids of [config.toolIds,config.agentIds,config.skillIds])if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new Error('Agent 能力选择需要唯一的稳定 ID')
 const built=conversationAgent(SYSTEM_DEFAULT_MODEL,config.toolIds,[...(config.systemPrompt?[{role:'system' as const,content:config.systemPrompt}]:[]),...history.filter(m=>m.role!=='system')],agent.name,config.manageAgents?[]:config.agentIds)
 built.graph.nodes.find(n=>n.kind==='loop')!.settings.repeat=String(config.maxRounds)
 const ids=new Map(walkWorkflowNodes(built.graph).map((n,i)=>[n.id,`${agent.id}:node:${i}`]))
 const variables=built.variables as Record<string,{id:string;type:string;value:unknown}>,variableIds=new Map(Object.entries(variables).map(([name,v])=>[v.id,`${agent.id}:variable:${name}`]))
 const fix=(graph:typeof built.graph):typeof built.graph=>({...graph,nodes:graph.nodes.map(n=>({...n,id:ids.get(n.id)!,settings:{...n.settings,...(n.settings.variableId?{variableId:variableIds.get(n.settings.variableId)!}:{})},...(n.body?{body:fix(n.body)}:{})})),links:graph.links.map((e,i)=>({...e,id:`${agent.id}:edge:${ids.get(e.to)}:${i}`,from:ids.get(e.from)!,to:ids.get(e.to)!}))})
 return {...agent,agentType:agent.preset==='react'?'react':'advanced',config,graph:fix(built.graph),variables:Object.fromEntries(Object.entries(variables).map(([name,v])=>[name,{...v,id:variableIds.get(v.id)!}]))}
}
export function builtinAgent(kind:'react'|'advanced'|'roleplay',config?:AgentConfig):AgentDefinition {
 return presetDefinition({id:kind==='react'?REACT_AGENT_ID:kind==='advanced'?ADVANCED_AGENT_ID:ROLEPLAY_AGENT_ID,name:kind==='react'?'ReAct 智能体':kind==='advanced'?'高级智能体':'多角色扮演',preset:kind,enabled:true,description:kind==='react'?'推理、调用工具、观察结果并继续回答。':kind==='advanced'?'按需发现并加载 Skill，结合获准工具完成任务。':'依据 Skill 查询角色资料、创建独立成员并协调公开群聊。',config:config||(kind==='roleplay'?{...defaultConfig(true),systemPrompt:'你是通用多智能体协调者。依据启动 Skill 制定任务策略，使用 Agent Manager 管理独立成员，以公开消息协调。',manageAgents:true,agentIds:[ADVANCED_AGENT_ID],skillIds:[GROUP_SKILL,ROLE_SKILL,NARRATOR_SKILL],startupSkillIds:[GROUP_SKILL],toolIds:['list_classes','list_instances','get_instance_markdown','ask_user'].map(k=>'builtin:'+k)}:kind==='advanced'?{...defaultConfig(true),toolIds:runtimeTools.map(t=>t.id),skillIds:[]}:defaultConfig()),graph:{version:1,nodes:[],links:[]},variables:{}})
}
export function normalizeAgentModels(workspace:Workspace):Workspace {
 const models=workspace.models||[],existing=workspace.agents||[],agents:AgentDefinition[]=existing.map(a=>({...a,config:defaultAgentCapabilities({...defaultConfig(a.preset!=='react'),...a.config})}))
 const react=agents.find(a=>a.id===REACT_AGENT_ID),advanced=agents.find(a=>a.id===ADVANCED_AGENT_ID)
 if(!workspace.agentInstancesInitialized){if(!react)agents.push(builtinAgent('react'));if(!advanced)agents.push(builtinAgent('advanced'));}if(!agents.some(a=>a.id===ROLEPLAY_AGENT_ID))agents.push(builtinAgent('roleplay'))
 for(let i=0;i<agents.length;i++)agents[i]={...agents[i],config:defaultAgentCapabilities({...defaultConfig(agents[i].preset!=='react'),...agents[i].config})}
 const migrated=new Map<string,string>();let first=true
 for(const model of models){
  if(!model.chatSystemPrompt&&!model.toolIds?.length&&!model.agentIds?.length)continue
  const id=!react&&first?REACT_AGENT_ID:`model-react:${model.id}`;first=false;migrated.set(model.id,id)
  if(id===REACT_AGENT_ID||!agents.some(a=>a.id===id)){
   const config=defaultAgentCapabilities({...defaultConfig(),systemPrompt:model.chatSystemPrompt||'',toolIds:model.toolIds||[],agentIds:model.agentIds||[]})
   const item=presetDefinition({...builtinAgent('react',config),id,name:id===REACT_AGENT_ID?'ReAct 智能体':`${model.name} · ReAct`,config})
   const index=agents.findIndex(a=>a.id===id);if(index>=0)agents[index]=item;else agents.push(item)
  }
 }
 // Preserve legacy automatic-node capabilities explicitly before removing model-level behavior.
 const migrateGraph=(graph:AgentDefinition['graph']):AgentDefinition['graph']=>({...graph,nodes:graph.nodes.map(n=>{
  const model=models.find(m=>m.id===n.settings.modelId),settings={...n.settings}
  if(n.kind==='llm'&&model){if(!settings.toolIds&&model.toolIds)settings.toolIds=JSON.stringify(model.toolIds);if(!settings.agentIds&&model.agentIds)settings.agentIds=JSON.stringify(model.agentIds)}
  return {...n,settings,...(n.body?{body:migrateGraph(n.body)}:{})}
 })})
 return {...workspace,agentInstancesInitialized:true,models:models.map(({chatSystemPrompt,toolIds,agentIds,...connection})=>connection),skills:workspace.skills||[],modelFolders:workspace.modelFolders||[],agents:agents.map(a=>a.preset||a.agentType&&a.agentType!=='workflow'?presetDefinition(a.id===ROLEPLAY_AGENT_ID&&(workspace.systemSkillVersion||0)<3&&a.config?.skillIds.includes(GROUP_SKILL)&&a.config.skillIds.includes(ROLE_SKILL)?{...a,config:{...a.config,skillIds:[...new Set([...a.config.skillIds,NARRATOR_SKILL])]}}:a):{...a,agentType:'workflow' as const,graph:migrateGraph(a.graph)}),worlds:workspace.worlds.map(world=>{
  const selected=world.chat.target,modelId=selected?.kind==='model'?selected.id:world.chat.modelId
  const target=selected?.kind==='agent'?selected:world.chat.agent&&agents.some(a=>a.id===world.chat.agent)?{kind:'agent' as const,id:world.chat.agent}:{kind:'agent' as const,id:(modelId&&migrated.get(modelId))||REACT_AGENT_ID}
  return {...world,chat:{...world.chat,target,agent:target.id,modelId:modelId??null,conversations:world.chat.conversations.map(c=>({...c,...(c.target?.kind==='model'?{target:{kind:'agent' as const,id:migrated.get(c.target.id)||REACT_AGENT_ID}}:{}),chatKind:c.chatKind||(agents.find(a=>a.id===c.target?.id)?.preset==='roleplay'?'roleplay':'standard')}))}}
 })}
}

export const agentTemplateNames={workflow:'Workflow 智能体',react:'ReAct 智能体',advanced:'高级智能体'} as const
export const isSystemAgent=(agent:Pick<AgentDefinition,'id'>)=>agent.id===ROLEPLAY_AGENT_ID
export function createAgentTemplate(kind:import('./types').AgentType):AgentDefinition {
 const id=crypto.randomUUID();return kind==='workflow'?{...createAgent(),id,agentType:kind,config:defaultAgentCapabilities(defaultConfig(true)),name:'新建 Workflow 智能体'}:presetDefinition({...builtinAgent(kind),...(kind==='advanced'?{config:{...builtinAgent(kind).config!,skillIds:[SKILL_CREATOR_ID]}}:{}),id,config:defaultAgentCapabilities({...builtinAgent(kind).config!}),name:'新建'+agentTemplateNames[kind],folderId:null})
}
