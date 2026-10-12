import {entityMarkdown,markdownHeadingLevels,parseDocumentMarkdown} from '../model/markdown'
import {ClassDocument,Entity,InstanceChangeProposal,ProposalAction,Workspace,World,uid} from '../model/types'
import {mergeProposalEntity} from '../model/proposalMerge'
export interface ToolCallContext {conversationId?:string;onProposal?:(id:string)=>void|Promise<void>;askUser?:(question:string,options:string[])=>Promise<string>}
export interface ProposalEvent {proposal:InstanceChangeProposal;conversationId?:string}
const listeners=new Set<(event:ProposalEvent)=>void>()
export function onInstanceProposal(listener:(event:ProposalEvent)=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}}
export function proposalEntity(doc:ClassDocument,entity:Entity,markdown:string,world:World){
  if(!/^##\s/.test(markdown.trimStart())||markdownHeadingLevels(markdown).includes(1))throw new Error('修改建议需要以二级实例标题开始，不能包含类标题')
  const parsed=parseDocumentMarkdown(`# ${doc.name}\n\n${markdown}`,{...doc,entities:[entity]},world,{rejectUnknown:true})
  if(parsed.entities.length!==1||parsed.entities[0].name!==entity.name)throw new Error('修改建议必须只包含指定实例，并保留实例名称')
  if(JSON.stringify(parsed.schema)!==JSON.stringify(doc.schema))throw new Error('修改建议不能修改类结构，请保留已有属性结构')
  return parsed.entities[0]
}
export function emitInstanceProposal(world:World,doc:ClassDocument,entity:Entity,markdown:string,reason:string,context:ToolCallContext={}){
  const next=proposalEntity(doc,entity,markdown,world)
  if(!listeners.size)throw new Error('聊天修改建议处理器未就绪')
  const proposal:InstanceChangeProposal={id:uid(),worldId:world.id,classId:doc.id,entityId:entity.id,className:doc.name,instanceName:entity.name,before:entityMarkdown(entity),after:entityMarkdown(next),baselineEntity:structuredClone(entity),reason,status:'pending',schemaSignature:JSON.stringify(doc.schema)}
  for(const listener of listeners)listener({proposal,conversationId:context.conversationId})
  void context.onProposal?.(proposal.id)
  return {proposalId:proposal.id,status:'pending',message:'修改建议已提交，等待用户在聊天中决定是否保存。世界尚未修改。'}
}
export function emitInstanceAddProposal(world:World,doc:ClassDocument,name:string,markdown:string,context:ToolCallContext={}){
 if(doc.entities.some(e=>e.name===name))throw new Error('同名实例已存在，请使用修改建议')
 const next=proposalEntity(doc,{id:uid(),name,fields:[]},markdown,world)
 if(!listeners.size)throw new Error('聊天修改建议处理器未就绪')
 const proposal:InstanceChangeProposal={id:uid(),kind:'add',worldId:world.id,classId:doc.id,entityId:next.id,className:doc.name,instanceName:name,before:'',after:entityMarkdown(next),baselineEntity:next,reason:'请确认新实例及其内容。',status:'pending',schemaSignature:JSON.stringify(doc.schema)}
 for(const listener of listeners)listener({proposal,conversationId:context.conversationId})
 void context.onProposal?.(proposal.id)
 return {proposalId:proposal.id,status:'pending',message:'新实例添加提议已提交，等待用户确认。世界尚未修改。'}
}
export function appendInstanceProposal(workspace:Workspace,{proposal,conversationId}:ProposalEvent):Workspace{
  const world=workspace.worlds.find(w=>w.id===proposal.worldId);if(!world)throw new Error('建议的世界已删除')
  const id=conversationId||world.chat.activeConversationId||uid(),existing=world.chat.conversations.find(c=>c.id===id)
  if(conversationId&&!existing)throw new Error('建议的会话已删除')
  const message={id:uid(),role:'assistant' as const,content:`修改建议：${proposal.className} / ${proposal.instanceName}\n${proposal.reason}`,createdAt:Date.now(),proposal}
  const conversations=existing?world.chat.conversations.map(c=>c.id===id?{...c,messages:[...c.messages,message]}:c):[...world.chat.conversations,{id,title:'实例修改建议',createdAt:Date.now(),messages:[message]}]
  return {...workspace,worlds:workspace.worlds.map(w=>w.id===world.id?{...w,chat:{...w.chat,conversations,activeConversationId:world.chat.activeConversationId||id}}:w)}
}
export function decideInstanceProposal(workspace:Workspace,worldId:string,conversationId:string,proposalId:string,save:ProposalAction):Workspace{
  const world=workspace.worlds.find(w=>w.id===worldId),conversation=world?.chat.conversations.find(c=>c.id===conversationId),message=conversation?.messages.find(m=>m.proposal?.id===proposalId),proposal=message?.proposal
  if(!world||!proposal)throw new Error('修改建议已不存在')
  if(save==='revert'?proposal.status!=='saved':proposal.status!=='pending')throw new Error('此修改建议已处理')
  let documents=world.documents
  let savedBefore=proposal.savedBefore,savedAfter=proposal.savedAfter,savedAt=proposal.savedAt
  if(save){const doc=documents.find(d=>d.id===proposal.classId),entity=doc?.entities.find(e=>e.id===proposal.entityId)
    if(!doc)throw new Error('目标类已删除')
    if(JSON.stringify(doc.schema)!==proposal.schemaSignature)throw new Error('类结构已变化，请重新生成修改建议')
    if(save==='revert'){
      if(!entity||!savedAfter)throw new Error('无法回退：缺少保存快照或目标实例已删除')
      if(proposal.kind==='add'){
        if(entityMarkdown(entity)!==entityMarkdown(savedAfter))throw new Error('新增实例保存后已变化，无法回退')
        documents=documents.map(d=>d.id===doc.id?{...d,entities:d.entities.filter(e=>e.id!==entity.id)}:d)
      }else{
        if(!savedBefore)throw new Error('旧建议没有保存前快照，无法安全回退')
        const reverted=mergeProposalEntity(savedAfter,savedBefore,entity)
        const next=proposalEntity(doc,reverted,entityMarkdown(reverted),world)
        documents=documents.map(d=>d.id===doc.id?{...d,entities:d.entities.map(e=>e.id===entity.id?next:e)}:d)
      }
    }else if(proposal.kind==='add'){
      if(doc.entities.some(e=>e.id===proposal.entityId||e.name===proposal.instanceName))throw new Error('同名实例已存在，无法保存添加提议')
      const next=proposalEntity(doc,proposal.baselineEntity||{id:proposal.entityId,name:proposal.instanceName,fields:[]},proposal.after,world)
      savedAfter=structuredClone(next)
      documents=documents.map(d=>d.id===doc.id?{...d,entities:[...d.entities,next]}:d)
    }else{
    if(!entity)throw new Error('目标实例已删除')
    const before=proposal.baselineEntity||proposalEntity(doc,entity,proposal.before,world),after=proposalEntity(doc,before,proposal.after,world)
    const merged=mergeProposalEntity(before,after,entity)
    const next=proposalEntity(doc,merged,entityMarkdown(merged),world)
    savedBefore=structuredClone(entity);savedAfter=structuredClone(next)
    documents=documents.map(d=>d.id===doc.id?{...d,entities:d.entities.map(e=>e.id===entity.id?next:e)}:d)
    }
    if(save!=='revert')savedAt=Math.max(Date.now(),...conversation!.messages.map(m=>(m.proposal?.savedAt||0)+1))
  }
  return {...workspace,worlds:workspace.worlds.map(w=>w.id===worldId?{...w,documents,chat:{...w.chat,conversations:w.chat.conversations.map(c=>c.id===conversationId?{...c,messages:c.messages.map(m=>m.id===message.id?{...m,proposal:{...proposal,savedBefore,savedAfter,savedAt,status:save==='revert'?'pending':save?'saved':'rejected'}}:m)}:c)}}:w)}
}
/** Build the entire batch immutably; callers publish only after every decision succeeds. */
export function decideInstanceProposals(workspace:Workspace,worldId:string,conversationId:string,ids:string[],action:ProposalAction):Workspace {
 const proposals=workspace.worlds.find(w=>w.id===worldId)?.chat.conversations.find(c=>c.id===conversationId)?.messages.flatMap(m=>m.proposal?[m.proposal]:[])||[]
 const selected=[...new Set(ids)].map(id=>{const p=proposals.find(p=>p.id===id);if(!p)throw new Error('修改建议已不存在');return p})
 if(action==='revert')selected.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))
 return selected.reduce((next,p)=>decideInstanceProposal(next,worldId,conversationId,p.id,action),workspace)
}
