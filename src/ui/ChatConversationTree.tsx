import {useState} from 'react'
import {Trash2} from 'lucide-react'
import {AgentDefinition,Conversation} from '../model/types'
import {chatMembers} from '../model/chatMembers'
import AgentIcon from './AgentIcon'
import TreeDisclosure from './TreeDisclosure'
export default function ChatConversationTree({conversation,agents,selected,agentView,onSelect,onDelete}:{conversation:Conversation;agents:AgentDefinition[];selected:boolean;agentView?:string;onSelect:(member?:string)=>void;onDelete:()=>void}){
 const [open,setOpen]=useState(false),members=chatMembers(conversation,agents),agent=agents.find(a=>a.id===conversation.target?.id)
 return <div className="tree-node ui-tree-node"><div className={`tree-row ui-tree-row--navigation chat-record-row ${selected&&!agentView?'active':''} ui-surface ui-tree-row`}><button className="tree-main ui-surface ui-button" title={conversation.title} onClick={()=>onSelect()} onDoubleClick={()=>setOpen(!open)}><AgentIcon agent={agent} size={14}/><span>{conversation.title}</span></button><TreeDisclosure open={open} name={conversation.title} onToggle={()=>setOpen(!open)}/><button className="chat-record-delete icon-button ui-button--icon subtle ui-surface ui-button" title="删除对话" onClick={onDelete}><Trash2 size={13}/></button></div>{open&&<div className="tree-branch ui-tree-branch"><div className={`tree-row ui-tree-row--navigation ${selected&&agentView==='root'?'active':''} ui-surface ui-tree-row`}><button className="tree-main ui-surface ui-button" onClick={()=>onSelect('root')}><AgentIcon agent={agent} size={14}/><span>{agent?.name||'主智能体'} · 过程</span></button></div>{members.map(member=><div key={member.id} className={`tree-row ui-tree-row--navigation ${selected&&agentView===member.id?'active':''} ui-surface ui-tree-row`}><button className="tree-main ui-surface ui-button" onClick={()=>onSelect(member.id)}><AgentIcon agent={agents.find(a=>a.id===member.agentId)} size={14}/><span>{member.name}</span></button></div>)}</div>}</div>
}
