import {AgentDefinition,Conversation} from './types'
export interface ChatMemberView {id:string;name:string;agentId:string;participantId?:string}
/** Static calls are represented by agent identity; dynamic members by conversation identity. */
export function chatMembers(conversation:Conversation,agents:AgentDefinition[]):ChatMemberView[]{
 const list:ChatMemberView[]=(conversation.session?.participants||[]).map(p=>({id:'session-member:'+p.id,name:p.name,agentId:p.baseAgentId,participantId:p.id}))
 const seen=new Set(list.map(p=>p.id))
 for(const m of conversation.messages)for(const e of m.run?.events||[])if(e.kind==='agent'&&e.parentInvocationId&&e.agentId&&!seen.has(e.agentId)){
  seen.add(e.agentId);list.push({id:e.agentId,name:e.name||agents.find(a=>a.id===e.agentId)?.name||'子智能体',agentId:e.agentId})
 }
 return list
}
