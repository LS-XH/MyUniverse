import ChatReferences from './ChatReferences'
import {World} from '../model/types'
import {useState} from 'react'
import {Check,Copy,Pencil} from 'lucide-react'
export default function ChatInterjection({id,content,name,onEdit,editable,world}:{world?:World;id:string;content:string;name?:string;onEdit?:(id:string)=>void;editable:boolean}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('')
 return <div className="chat-interjection"><small>{name||'用户'} · 插话</small><div className="ui-surface ui-message ui-message--content chat-user-text">{world?<ChatReferences text={content} world={world} refs={world.chat.conversations.flatMap(c=>c.messages).find(m=>m.id===id)?.directives}/>:content}</div><div className="chat-message-actions">{onEdit&&<button className="ui-surface ui-button ui-button--icon" disabled={!editable} aria-label="编辑消息" onClick={()=>onEdit(id)}><Pencil size={14}/></button>}<button className="ui-surface ui-button ui-button--icon" aria-label="复制消息" title={copied?'已复制':'复制'} onClick={async()=>{try{await navigator.clipboard.writeText(content);setCopied(true);setError('')}catch{setError('复制失败，请选择文字手动复制')}}}>{copied?<Check size={14}/>:<Copy size={14}/>}</button></div>{error&&<small role="alert">{error}</small>}</div>
}
