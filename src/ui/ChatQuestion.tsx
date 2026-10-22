import {useState} from 'react'
import {UserCheck} from 'lucide-react'
import {answerChatQuestion,hasChatQuestion} from '../services/chatQuestions'
import {ChatQuestion as Question} from '../services/chatQuestions'
import ChatMarkdown from './ChatMarkdown'
export default function ChatQuestion({value,running}:{value:Question;running:boolean}){
 const [draft,setDraft]=useState(''),[error,setError]=useState(''),[submitted,setSubmitted]=useState(false)
 const enabled=running&&!value.answer&&!submitted&&hasChatQuestion(value.id)
 const submit=(answer:string)=>{try{answerChatQuestion(value.id,answer);setSubmitted(true);setError('')}catch(e){setError(String(e))}}
 return <section className="chat-question ui-surface ui-panel ui-panel--chat-process ui-panel--themed ui-panel--text ui-surface--bordered">
  <div className="chat-question-heading"><UserCheck size={16}/><strong>需要你确认</strong></div><ChatMarkdown>{value.question}</ChatMarkdown>
  {value.answer?<p>你的回答：{value.answer}</p>:<><div className="chat-question-options">{value.options.map(option=><button key={option} className="ui-surface ui-button ui-button--standard ui-button--ghost ui-surface--bordered" disabled={!enabled} onClick={()=>submit(option)}>{option}</button>)}</div><form onSubmit={e=>{e.preventDefault();submit(draft)}}><input aria-label="自填回答" className="ui-surface ui-field ui-field--themed ui-field--text ui-surface--bordered" placeholder="也可以输入自己的回答…" value={draft} disabled={!enabled} onChange={e=>setDraft(e.target.value)}/><button className="ui-surface ui-button ui-button--standard ui-button--ghost ui-surface--bordered" disabled={!enabled||!draft.trim()}>提交回答</button></form>{!running&&<small>此提问已中断</small>}</>}{error&&<p className="danger" role="alert">{error}</p>}
 </section>
}
