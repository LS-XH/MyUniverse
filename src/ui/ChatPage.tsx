import type {ProposalHandler} from '../model/types'
import {useEffect,useRef,useState} from 'react'
import {usePageState} from './PageSession'
import {ArrowDown,Check,Copy,Pencil,Send,Sparkles,Square,X} from 'lucide-react'
import {AgentDefinition,ModelConnection,World} from '../model/types'
import ModelSelector from './ModelSelector'
import ChatExecution from './ChatExecution'
import ChatMarkdown from './ChatMarkdown'
import InstanceProposal from './InstanceProposal'
import ProposalGroup from './ProposalGroup'
import {chatTarget} from '../model/chatRuns'

export default function ChatPage({world,onChange,models,agents,onModelSettings,onSend,onStop,sending,error,onProposalDecision}:{onProposalDecision?:ProposalHandler;world:World;onChange:(world:World)=>void;models:ModelConnection[];agents:AgentDefinition[];onModelSettings:()=>void;onSend:(content:string,editId?:string)=>void;onStop:()=>void;sending:boolean;error?:string}) {
 const [draft,setDraft]=usePageState('chat:draft',''),scroll=useRef<HTMLDivElement>(null),follow=useRef(true)
 const conversation=world.chat.conversations.find(c=>c.id===world.chat.activeConversationId)
 const proposals=new Map(conversation?.messages.flatMap(m=>m.proposal?[[m.proposal.id,m.proposal] as const]:[]))
 const linked=new Set(conversation?.messages.flatMap(m=>m.run?.events.flatMap(e=>e.kind==='proposal'?[e.id]:[])||[]))
 const visible=conversation?.messages.filter(m=>!m.proposal||!linked.has(m.proposal.id))||[]
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
 const send=()=>{const content=draft.trim();if(!content||sending)return;onSend(content,editId);setEditId(undefined);setDraft('')}
 const composer=<div className="modern-composer ui-composer--chat ui-surface ui-composer ui-surface--bordered">
  {editId&&<div className="chat-edit-state"><span>编辑消息 · 重新发送将重新生成后续对话</span><button className="ui-surface ui-button ui-button--icon" title="取消编辑" aria-label="取消编辑" onClick={()=>{setEditId(undefined);setDraft('')}}><X size={14}/></button></div>}
  <textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="向创作助手发送消息…" rows={2} className="ui-surface ui-field"/>
  <div className="composer-footer">
   <ModelSelector models={models} agents={agents} disabled={sending} value={chatTarget({worlds:[world],activeWorldId:world.id,models,agents},world.chat)} onChange={target=>onChange({...world,chat:{...world.chat,target,agent:target?.kind==='agent'?target.id:'',modelId:target?.kind==='model'?target.id:null}})} onSettings={onModelSettings}/>
   <button className="send-button ui-button--send ui-surface ui-button" disabled={!sending&&!draft.trim()} onClick={sending?onStop:send} title={sending?'停止执行':'发送'} aria-label={sending?'停止执行':'发送'}>{sending?<Square size={14}/>:<Send size={17}/>}</button>
  </div>
 </div>
 return <div className={conversation?'chat-page has-conversation':'chat-page empty-conversation'}>{conversation?<>
  <header className="chat-page-header"><div><strong>{conversation.title}</strong><span>保存在当前世界</span></div></header>
  <div className="message-scroll" ref={scroll} onScroll={measure}>
   <div className="message-column">{visible.filter(m=>!grouped.has(m.id)).map(message=><div className={'message '+message.role} key={message.id}>
    {message.role==='assistant'&&<div className="assistant-avatar ui-icon-surface--assistant ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><Sparkles size={15}/></div>}
    <div className="message-content ui-message--content ui-surface ui-message">
     {message.run&&<ChatExecution agents={agents} finalText={message.content} run={message.run} proposals={proposals} onDecision={onProposalDecision}/>}
     {message.content&&!message.proposal&&(message.role==='user'?<div className="chat-user-text">{message.content}</div>:<ChatMarkdown className="chat-final-text">{message.content}</ChatMarkdown>)}
     {message.role==='user'&&<div className="chat-message-actions"><button className="ui-surface ui-button ui-button--icon" aria-label="编辑消息" title="编辑并重新发送" disabled={sending} onClick={()=>{setDraft(message.content);setEditId(message.id);document.querySelector<HTMLTextAreaElement>('.modern-composer textarea')?.focus()}}><Pencil size={14}/></button><button className="ui-surface ui-button ui-button--icon" aria-label="复制消息" title={copied===message.id?'已复制':'复制'} onClick={()=>{void copy(message.id,message.content)}}>{copied===message.id?<Check size={14}/>:<Copy size={14}/>}</button></div>}
     {message.proposal&&(proposalGroups.has(message.id)?<ProposalGroup proposals={proposalGroups.get(message.id)!.map(m=>m.proposal!)} onDecision={onProposalDecision}/>:<InstanceProposal proposal={message.proposal} onDecision={onProposalDecision}/>)}
    </div>
   </div>)}</div>{copyError&&<p className="danger" role="alert">{copyError}</p>}
  </div>
  <div className="chat-bottom">{away&&<button className="chat-scroll-bottom ui-surface ui-button ui-button--ghost ui-surface--bordered" title="回到最新消息" aria-label="滚动到聊天底部" onClick={()=>{follow.current=true;scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}}><ArrowDown size={18}/></button>}{composer}{error&&<p className="danger" role="alert">{error}</p>}<p>{sending?'正在执行…':'对话与执行过程保存在当前世界。'}</p></div>
 </>:<div className="chat-welcome"><div className="chat-welcome-icon ui-icon-surface--chat ui-surface ui-icon-surface ui-icon-surface--themed ui-icon-surface--text"><Sparkles size={25}/></div><h1>今天想创作什么？</h1><p>描述人物、世界或情节，从一条对话开始。</p>{composer}{error&&<p className="danger" role="alert">{error}</p>}</div>}</div>
}
