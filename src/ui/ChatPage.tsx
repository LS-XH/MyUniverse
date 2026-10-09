import { usePageState } from './PageSession'
import { Send, Sparkles } from 'lucide-react'
import { Conversation, ModelConnection, World, uid } from '../model/types'
import ModelSelector from './ModelSelector'

export default function ChatPage({world,onChange,models,onModelSettings}:{world:World;onChange:(world:World)=>void;models:ModelConnection[];onModelSettings:()=>void}) {
  const [draft,setDraft]=usePageState('chat:draft','')
  const conversation=(world.chat.conversations||[]).find(item=>item.id===world.chat.activeConversationId)
  const send=()=>{const content=draft.trim();if(!content)return;const current:Conversation=conversation||{id:uid(),title:content.slice(0,24),messages:[],createdAt:Date.now()};const next={...current,messages:[...current.messages,{id:uid(),role:'user' as const,content,createdAt:Date.now()}]};onChange({...world,chat:{...world.chat,conversations:conversation?world.chat.conversations.map(c=>c.id===current.id?next:c):[...(world.chat.conversations||[]),next],activeConversationId:current.id}});setDraft('')}
  const composer=<div className="modern-composer"><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="向创作助手发送消息…" rows={2}/><div className="composer-footer"><ModelSelector models={models} value={world.chat.modelId||null} onChange={modelId=>onChange({...world,chat:{...world.chat,modelId}})} onSettings={onModelSettings}/><button className="send-button" disabled={!draft.trim()} onClick={send} title="发送"><Send size={17}/></button></div></div>
  return <div className={`chat-page ${conversation?'has-conversation':'empty-conversation'}`}>{conversation?<><header className="chat-page-header"><div><strong>{conversation.title}</strong><span>保存在当前世界</span></div></header><div className="message-scroll"><div className="message-column">{conversation.messages.map(message=><div className={`message ${message.role}`} key={message.id}>{message.role==='assistant'&&<div className="assistant-avatar"><Sparkles size={15}/></div>}<div className="message-content">{message.content}</div></div>)}</div></div><div className="chat-bottom">{composer}<p>消息会保存在当前世界。接入 Agent 后即可获得回复。</p></div></>:<div className="chat-welcome"><div className="chat-welcome-icon"><Sparkles size={25}/></div><h1>今天想创作什么？</h1><p>描述人物、世界或情节，从一条对话开始。</p>{composer}</div>}</div>
}
