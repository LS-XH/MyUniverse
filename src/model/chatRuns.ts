import {REACT_AGENT_ID} from './builtinAgents'
import {ChatMessage,ChatTarget,Conversation,Workspace} from './types'
import {WorkflowEvent} from '../services/workflowExecution'
export function editChatHistory(conversation:Conversation,messageId:string):Conversation {
 const index=conversation.messages.findIndex(m=>m.id===messageId&&m.role==='user')
 if(index<0)throw new Error('要编辑的用户消息已不存在')
 const message=conversation.messages[index];let messages=conversation.messages.slice(0,index)
 if(message.interjectionRunId)messages=messages.map(owner=>{
  if(!owner.run||owner.run.id!==message.interjectionRunId)return owner
  const marker=owner.run.events.find(e=>e.kind==='userInput'&&e.id===message.id),cutoff=marker?.displaySequence??marker?.sequence
  if(cutoff===undefined)return owner
  const events=owner.run.events.filter(e=>e!==marker&&(e.displaySequence??e.sequence??Infinity)<cutoff),root=owner.run.events.find(e=>e.kind==='agent'&&!e.parentInvocationId)
  if(root?.kind==='agent'&&!events.some(e=>e.kind==='agent'&&e.invocationId===root.invocationId))events.unshift({...root,state:'cancelled',result:undefined})
  return {...owner,content:'',run:{...owner.run,status:'cancelled',error:'从插话处重新生成',events}}
 })
 return {...conversation,messages,...(message.sessionBefore?{session:structuredClone(message.sessionBefore)}:{}),modelMessages:message.protocolBefore||messages.filter(m=>!m.proposal&&m.content&&(!m.run||m.run.status==='complete')).map(m=>({role:m.role,content:m.content}))}
}

export function chatTarget(workspace:Workspace,chat:Workspace['worlds'][number]['chat']):ChatTarget|null {
 const fixed=chat.conversations.find(c=>c.id===chat.activeConversationId)?.target
 if(fixed)return fixed
 if(chat.target?.kind==='agent')return chat.target
 const agent=workspace.agents?.find(a=>a.id===chat.agent)
 return {kind:'agent',id:agent?.id||REACT_AGENT_ID}
}
export function mergeChatEvents(before:WorkflowEvent[],incoming:WorkflowEvent[]):WorkflowEvent[] {
 const events=[...before]
 for(const event of incoming){
  if(event.kind==='edge'||event.kind==='variables')continue
  const index=event.kind==='notice'||event.kind==='proposal'||event.kind==='branch'?-1:events.findIndex(old=>old.kind===event.kind&&'id'in old&&'id'in event&&old.id===event.id&&old.invocationId===event.invocationId&&old.frame===event.frame)
  if(index<0)events.push(event)
  else{const old=events[index];events[index]={...old,...event,sequence:old.sequence,...('state'in event&&event.state==='complete'?{displaySequence:event.displaySequence??event.sequence}:{}),...(event.kind==='model'&&old.kind==='model'?{text:(old.text||'')+(event.text||''),reasoning:(old.reasoning||'')+(event.reasoning||'')}:{})} as WorkflowEvent}
 }
 return events
}
export function updateChatMessage(workspace:Workspace,worldId:string,conversationId:string,messageId:string,update:(message:ChatMessage)=>ChatMessage):Workspace {
 const world=workspace.worlds.find(w=>w.id===worldId),conversation=world?.chat.conversations.find(c=>c.id===conversationId)
 if(!conversation?.messages.some(m=>m.id===messageId))throw new Error('发起聊天的世界或会话已删除')
 return {...workspace,worlds:workspace.worlds.map(w=>w.id===worldId?{...w,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversationId?{...c,messages:c.messages.map(m=>m.id===messageId?update(m):m)}:c)}}:w)}
}
export function normalizeChatRuns(workspace:Workspace):Workspace {
 return {...workspace,worlds:workspace.worlds.map(world=>({...world,chat:{...world.chat,target:chatTarget(workspace,{...world.chat,activeConversationId:null}),conversations:world.chat.conversations.map(c=>({...c,target:c.target||c.messages.find(m=>m.run)?.run?.target||chatTarget(workspace,{...world.chat,activeConversationId:null})||undefined,chatKind:c.chatKind||(workspace.agents?.find(a=>a.id===(c.target?.id||c.messages.find(m=>m.run)?.run?.target.id||world.chat.target?.id))?.preset==='roleplay'?'roleplay':'standard'),messages:c.messages.map(m=>m.run?.status==='running'?{...m,run:{...m.run,status:'interrupted',error:'应用关闭时执行尚未完成，未自动重放请求'}}:m)}))}}))}
}
