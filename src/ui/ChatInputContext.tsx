import {ChatParticipant} from '../model/types'
import ChatMarkdown from './ChatMarkdown'
export default function ChatInputContext({value,participants}:{value:unknown;participants:ChatParticipant[]}){
 if(!Array.isArray(value))return <p className="muted">本次未附加成员历史；输入见任务参数，模型按 Agent 自身配置执行。</p>
 return <div className="chat-input-context">{value.length?value.map((message,index)=><section key={index}><small>{participants.find(p=>p.protocolName===message.name)?.name||({user:'用户 / 公开上下文',assistant:'该智能体的历史答复',system:'系统上下文',tool:'工具结果'}[String(message.role)]||'输入消息')}</small>{typeof message.content==='string'?<ChatMarkdown>{message.content}</ChatMarkdown>:<pre>{JSON.stringify(message.content,null,2)}</pre>}</section>):<small>首次调用，尚无历史消息。</small>}</div>
}
