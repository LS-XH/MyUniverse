import ChatUsagePanel from './ChatUsagePanel'
import ChatMessageRail from './ChatMessageRail'
import Select from './Select'
import ChatReferences from './ChatReferences'

import ChatComposerInput from './ChatComposerInput'
import {ChatDirective} from '../model/chatDirectives'
import AgentIcon from './AgentIcon'
import {chatMembers} from '../model/chatMembers'
import type {ProposalHandler} from '../model/types'
import {useEffect,useRef,useState} from 'react'
import {usePageState} from './PageSession'
import {ArrowDown,Check,Copy,Pencil,Send,Square,X} from 'lucide-react'
import {AgentDefinition,ModelConnection,World,SkillDefinition} from '../model/types'
import ModelSelector from './ModelSelector'
import ChatExecution from './ChatExecution'
import ChatMarkdown from './ChatMarkdown'
import InstanceProposal from './InstanceProposal'
import ProposalGroup from './ProposalGroup'
import {chatTarget} from '../model/chatRuns'

export default function ChatPage({world,onChange,models,agents,skills=[],agentView,onMain,onModelSettings,onSend,onStop,sending,error,onProposalDecision}:{skills?:SkillDefinition[];agentView?:string;onMain?:()=>void;onProposalDecision?:ProposalHandler;world:World;onChange:(world:World)=>void;models:ModelConnection[];agents:AgentDefinition[];onModelSettings:()=>void;onSend:(content:string,editId?:string,directives?:ChatDirective[])=>void;onStop:()=>void;sending:boolean;error?:string}) {
 const [directives,setDirectives]=usePageState<ChatDirective[]>('chat:directives',[])
 const [draft,setDraft]=usePageState('chat:draft',''),scroll=useRef<HTMLDivElement>(null),follow=useRef(true)
 const conversation=world.chat.conversations.find(c=>c.id===world.chat.activeConversationId)
 const target=chatTarget({worlds:[world],activeWorldId:world.id,models,agents},world.chat),currentAgent=agents.find(a=>a.id===target?.id),member=conversation&&chatMembers(conversation,agents).find(m=>m.id===agentView)
 const roleplay=conversation?.chatKind==='roleplay'||currentAgent?.preset==='roleplay',human=conversation?.session?.human||world.chat.participation||{mode:'observer' as const}
 const setHuman=(value:typeof human)=>onChange({...world,chat:{...world.chat,participation:value,conversations:world.chat.conversations.map(c=>c.id===conversation?.id?{...c,session:{...(c.session||{participants:[],publicMessages:[]}),human:value}}:c)}})
 const proposals=new Map(conversation?.messages.flatMap(m=>m.proposal?[[m.proposal.id,m.proposal] as const]:[]))
 const linked=new Set(conversation?.messages.flatMap(m=>m.run?.events.flatMap(e=>e.kind==='proposal'?[e.id]:[])||[]))
 const visible=conversation?.messages.filter(m=>(!m.proposal||!linked.has(m.proposal.id))&&(!m.interjectionRunId||!conversation.messages.some(owner=>owner.run?.id===m.interjectionRunId&&owner.run?.events.some(e=>e.kind==='userInput'&&e.id===m.id))))||[]
 const proposalGroups=new Map<string,typeof visible>()
 const grouped=new Set<string>()
 for(let i=0;i<visible.length;i++)if(visible[i].proposal){const start=i,list=[visible[i]];while(visible[i+1]?.proposal&&visible[i+1].proposal!.classId===visible[start].proposal!.classId&&visible[i+1].proposal!.className===visible[start].proposal!.className){list.push(visible[++i]);grouped.add(visible[i].id)}if(list.length>1)proposalGroups.set(visible[start].id,list)}
 const [away,setAway]=useState(false)
 const [editId,setEditId]=useState<string>(),[copied,setCopied]=useState<string>(),[copyError,setCopyError]=useState('')
 useEffect(()=>{setEditId(undefined);setCopied(undefined);setCopyError('')},[conversation?.id])
 const copy=async(id:string,content:string)=>{try{await navigator.clipboard.writeText(content);setCopied(id);setCopyError('')}catch{setCopyError('复制失败，请选择文字后手动复制')}}
 const measure=()=>{const e=scroll.current;if(e){const atBottom=e.scrollHeight-e.scrollTop-e.clientHeight<64;follow.current=atBottom;setAway(!atBottom)}}
 useEffect(()=>{follow.current=true;setAway(false);if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight},[conversation?.id])
 useEffect(()=>{if(follow.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;measure()},[conversation])
 useEffect(()=>{const e=scroll.current;if(!e)return;const observer=new ResizeObserver(()=>{if(follow.current)e.scrollTop=e.scrollHeight;measure()});observer.observe(e);if(e.firstElementChild)observer.observe(e.firstElementChild);return()=>observer.disconnect()},[conversation?.id])
 const send=()=>{const content=draft.trim();if(!content||sending&&!roleplay||roleplay&&human.mode==='character'&&!human.name?.trim())return;onSend(content,editId,directives);setDirectives([]);setEditId(undefined);setDirectives([]);setDraft('')}
 const composer=<div className="modern-composer ui-composer--chat ui-surface ui-composer ui-surface--bordered">
  {editId&&<div className="chat-edit-state"><span>编辑消息 · 重新发送将重新生成后续对话</span><button className="ui-surface ui-button ui-button--icon" title="取消编辑" aria-label="取消编辑" onClick={()=>{setEditId(undefined);setDirectives([]);setDraft('')}}><X size={14}/></button></div>}

  <ChatComposerInput value={draft} onChange={setDraft} refs={directives} onRefs={setDirectives} world={world} skills={skills} agent={currentAgent} onSend={send} placeholder={roleplay&&sending?'随时输入，发送以插话…':'发送消息，@ 强制技能或引用世界实例…'}/>

  <div className="composer-footer">
   <ModelSelector models={models} agents={agents} disabled={sending||!!conversation} value={target} onChange={target=>onChange({...world,chat:{...world.chat,target,agent:target?.kind==='agent'?target.id:''}})} onSettings={onModelSettings}/>
   <ModelSelector mode="model" models={models} disabled={sending} value={world.chat.modelId?{kind:'model',id:world.chat.modelId}:null} onChange={target=>onChange({...world,chat:{...world.chat,modelId:target?.id||null}})} onSettings={onModelSettings}/>
  {roleplay&&<div className="chat-human-role"><label>我在场景中<Select aria-label="用户参与方式" disabled={sending} className="ui-surface ui-field ui-field--themed ui-field--text ui-surface--bordered" value={human.mode} onChange={e=>setHuman({mode:e.target.value as 'observer'|'character',name:human.name})}><option value="observer">旁观</option><option value="character">扮演角色</option></Select></label>{human.mode==='character'&&<input aria-label="用户角色名称" disabled={sending} className="ui-surface ui-field ui-field--themed ui-field--text ui-surface--bordered" value={human.name||''} onChange={e=>setHuman({...human,name:e.target.value})} placeholder="我的角色名称"/>}</div>}
   {sending&&roleplay&&<button className="chat-stop-button ui-surface ui-button ui-button--icon" onClick={onStop} title="停止执行" aria-label="停止执行"><Square size={14}/></button>}
   <button className="send-button ui-button--send ui-surface ui-button" disabled={(!sending||roleplay)&&!draft.trim()||roleplay&&human.mode==='character'&&!human.name?.trim()} onClick={sending&&!roleplay?onStop:send} title={sending?(roleplay?'插话':'停止执行'):'发送'} aria-label={sending?(roleplay?'插话':'停止执行'):'发送'}>{sending&&!roleplay?<Square size={14}/>:<Send size={17}/>}</button>
  </div>
 </div>
 return <div className={conversation?'chat-page has-conversation':'chat-page empty-conversation'}>{conversation&&<><ChatUsagePanel events={conversation.messages.flatMap(m=>m.run?.events||[])}/><ChatMessageRail messages={visible.filter(m=>!grouped.has(m.id)&&(!agentView||m.run?.events.some(e=>e.kind==='agent'&&(agentView==='root'?!e.parentInvocationId:e.agentId===agentView))))} scroll={scroll} onNavigate={()=>{follow.current=false;setAway(true)}}/></>}{conversation?<>
  <header className="chat-page-header ui-page-toolbar ui-page-toolbar--chat"><div><strong>{agentView?`${member?.name||currentAgent?.name||'主智能体'} · 执行详情`:conversation.title}</strong><span>{agentView?'私有过程仅供用户查看，未发送到公开群聊':`${currentAgent?.name||'Agent'} · 会话 Agent 已固定`}</span>{agentView&&<button className="ui-surface ui-button ui-button--ghost ui-button--standard" onClick={onMain}>返回主聊天</button>}</div></header>
  <div className="message-scroll" ref={scroll} onScroll={measure}>
   <div className="message-column">{visible.filter(m=>!grouped.has(m.id)&&(!agentView||m.run?.events.some(e=>e.kind==='agent'&&(agentView==='root'?!e.parentInvocationId:e.agentId===agentView)))).map(message=><div className={'message '+message.role+(roleplay&&message.role==='assistant'&&!agentView?' roleplay-host-message':'')} key={message.id} data-message-id={message.id}>
    {message.role==='assistant'&&<div className="assistant-avatar ui-icon-surface--assistant ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><AgentIcon agent={currentAgent} size={15}/></div>}
    <div className="message-content ui-message--content ui-surface ui-message">
     {message.run&&<ChatExecution editable={!sending} onEditInput={id=>{const message=conversation.messages.find(m=>m.id===id);if(message){setDraft(message.content);setDirectives(message.directives||[]);setEditId(id);document.querySelector<HTMLElement>('.modern-composer [data-chat-composer]')?.focus()}}} detailed={!!agentView} member={agentView} world={world} roleplay={conversation.chatKind==='roleplay'} participants={conversation.session?.participants} agents={agents} finalText={message.content} run={message.run} proposals={proposals} onDecision={onProposalDecision}/>}
     {!agentView&&message.content&&!message.proposal&&(message.role==='user'?<div className="chat-user-text"><ChatReferences text={message.content} refs={message.directives} world={world} skills={skills}/></div>:<ChatMarkdown className="chat-final-text">{message.content}</ChatMarkdown>)}


     {message.role==='user'&&<div className="chat-message-actions"><button className="ui-surface ui-button ui-button--icon" aria-label="编辑消息" title="编辑并重新发送" disabled={sending} onClick={()=>{setDraft(message.content);setDirectives(message.directives||[]);setEditId(message.id);document.querySelector<HTMLTextAreaElement>('.modern-composer textarea')?.focus()}}><Pencil size={14}/></button><button className="ui-surface ui-button ui-button--icon" aria-label="复制消息" title={copied===message.id?'已复制':'复制'} onClick={()=>{void copy(message.id,message.content)}}>{copied===message.id?<Check size={14}/>:<Copy size={14}/>}</button></div>}
     {message.proposal&&(proposalGroups.has(message.id)?<ProposalGroup proposals={proposalGroups.get(message.id)!.map(m=>m.proposal!)} onDecision={onProposalDecision}/>:<InstanceProposal proposal={message.proposal} onDecision={onProposalDecision}/>)}
    </div>
   </div>)}</div>{copyError&&<p className="danger" role="alert">{copyError}</p>}
  </div>
  <div className="chat-bottom">{agentView&&<p>当前查看 Agent 过程；发送消息将继续主会话。</p>}{away&&<button className="chat-scroll-bottom ui-surface ui-button ui-button--ghost ui-surface--bordered" title="回到最新消息" aria-label="滚动到聊天底部" onClick={()=>{follow.current=true;scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}}><ArrowDown size={18}/></button>}{composer}{error&&<p className="danger" role="alert">{error}</p>}<p>{sending?'正在执行…':'对话与执行过程保存在当前世界。'}</p></div>
 </>:<div className="chat-welcome"><div className="chat-welcome-icon ui-icon-surface--chat ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><AgentIcon agent={currentAgent} size={25}/></div><h1>今天想创作什么？</h1><p>描述人物、世界或情节，从一条对话开始。</p>{composer}{error&&<p className="danger" role="alert">{error}</p>}</div>}</div>
}
