import type {ProposalHandler} from '../model/types'
import type {ReactNode} from 'react'
import {Brain,ChevronRight,ListTree,Network,Wrench} from 'lucide-react'
import {ChatMessage,InstanceChangeProposal,AgentDefinition} from '../model/types'
import {workflowNodeTitle} from '../model/workflows'
import {builtinTools} from '../model/builtinTools'
import {WorkflowEvent} from '../services/workflowExecution'
import InstanceProposal from './InstanceProposal'
import ProposalGroup from './ProposalGroup'
import ChatMarkdown from './ChatMarkdown'
import ChatQuestion from './ChatQuestion'

const text=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value,null,2)
const stateLabel=(state:string)=>({running:'运行中',complete:'完成',cancelled:'已取消',error:'失败',waiting:'等待中'}[state]||state)
function Process({title,icon,state,children,open,className=''}:{title:string;icon:ReactNode;state?:string;children:ReactNode;open?:boolean;className?:string}) {
 return <details className={`ui-surface ui-panel ui-panel--chat-process ui-panel--themed ui-panel--text ui-surface--bordered chat-process ${className}`} open={open}>
  <summary><span className="ui-surface ui-icon-surface ui-icon-surface--process">{icon}</span><span className="chat-process-title">{title}</span>{state&&<span className="ui-surface ui-badge ui-badge--status chat-process-status" data-state={state}>{stateLabel(state)}</span>}<ChevronRight size={14} className="chat-process-chevron"/></summary>
  <div className="chat-process-body">{children}</div>
 </details>
}
export default function ChatExecution({run,proposals,onDecision,finalText,agents=[]}:{agents?:AgentDefinition[];finalText?:string;run:NonNullable<ChatMessage['run']>;proposals:Map<string,InstanceChangeProposal>;onDecision?:ProposalHandler}) {
 const events=run.events,nodeEvents=events.filter(e=>['node','loop','branch','notice'].includes(e.kind))
 const terminalState=(state:string)=>state==='running'&&run.status!=='running'?(run.status==='complete'?'complete':run.status==='cancelled'?'cancelled':'error'):state
 const progressTitle=(e:WorkflowEvent,index:number)=>e.title||('id'in e?agents.find(a=>a.id===e.agentId)?.graph.nodes.filter(n=>n.id===e.id).map(n=>workflowNodeTitle(n))[0]:undefined)||`执行步骤 ${index+1}`
 const progressScope=(e:WorkflowEvent)=>e.scopeLabel||e.frame?.split('/').filter(Boolean).map(part=>`循环 · 第 ${part.slice(part.lastIndexOf(':')+1)} 轮`).join(' / ')
 const render=(raw:WorkflowEvent,index:number)=>{
  const event=('state'in raw&&raw.state==='running'&&run.status!=='running'?{...raw,state:run.status==='complete'?'complete':run.status==='error'?'error':'cancelled'}:raw) as WorkflowEvent
  const key=event.sequence??index
  if(event.kind==='question')return <ChatQuestion key={key} value={event} running={run.status==='running'}/>
  if(event.kind==='proposal'){const proposal=proposals.get(event.id);return proposal?<InstanceProposal key={key} proposal={proposal} onDecision={onDecision}/>:null}
  if(event.kind==='model')return <div className="chat-model-step" key={key}>
   {event.reasoning&&<Process title="思考过程" icon={<Brain size={15}/>} state={event.state==='running'?'running':undefined}><ChatMarkdown>{event.reasoning}</ChatMarkdown></Process>}
   {event.text&&!(run.status==='complete'&&!event.parentInvocationId&&event.text===finalText)&&<ChatMarkdown className="chat-stream-text">{event.text}</ChatMarkdown>}
   {!event.text&&!event.reasoning&&event.state==='running'&&<span className="chat-process-state" role="status">正在请求模型…</span>}
  </div>
  if(event.kind==='tool')return <Process key={key} title={builtinTools.find(t=>t.callName===event.name)?.name||event.name} icon={<Wrench size={15}/>} state={event.state}>
   <small className="chat-call-name">{event.name}</small><label>参数</label><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.parameters)}</pre>
   {event.result!==undefined&&<><label>结果</label><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.result)}</pre></>}{event.error&&<p className="danger">{event.error}</p>}
  </Process>
  if(event.kind==='agent'&&event.parentInvocationId)return <Process key={key} title={event.name} icon={<Network size={15}/>} state={event.state} className="chat-agent-step" open={event.state==='running'}>
   <details className="chat-process-data"><summary>调用参数</summary><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.parameters)}</pre></details>
   {timeline(event.invocationId)}{event.result!==undefined&&<details className="chat-process-data"><summary>返回结果</summary><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.result)}</pre></details>}{event.error&&<p className="danger">{event.error}</p>}
  </Process>
  return null
 }
 const timeline=(invocationId?:string)=>{
  const blocks:ReactNode[]=[],tools:{event:WorkflowEvent;index:number}[]=[],suggestions:InstanceChangeProposal[]=[]
  const flushProposals=()=>{if(!suggestions.length)return;const group=suggestions.splice(0);blocks.push(group.length===1?<InstanceProposal key={`proposal-${group[0].id}`} proposal={group[0]} onDecision={onDecision}/>:<ProposalGroup key={`proposals-${group[0].id}`} proposals={group} onDecision={onDecision}/>)}
  const flush=()=>{if(!tools.length)return;const group=tools.splice(0);if(group.length===1){blocks.push(render(group[0].event,group[0].index));return}const states=group.map(({event})=>'state'in event?terminalState(event.state):'complete');blocks.push(<Process key={`tools-${group[0].event.sequence??group[0].index}`} title={`工具调用 · ${group.length} 次`} icon={<Wrench size={15}/>} state={states.includes('error')?'error':states.includes('cancelled')?'cancelled':states.includes('running')?'running':'complete'} className="chat-tool-group">{group.map(({event,index})=>render(event,index))}</Process>)}
  events.forEach((event,index)=>{
   const belongs=event.kind==='agent'?event.parentInvocationId===invocationId:event.invocationId===invocationId
   if(!belongs)return
   if(event.kind==='tool'){
    if(['universe_propose_instance_change','universe_propose_instance_add','universe_propose_member_change'].includes(event.name)&&event.result&&typeof event.result==='object'&&'proposalId'in event.result&&proposals.has(String(event.result.proposalId)))return
    if(event.name==='universe_ask_user'&&events.some(e=>e.kind==='question'&&e.invocationId===event.invocationId)&&!event.error)return
    flushProposals();tools.push({event,index});return
   }
   if(['node','edge','variables','loop','branch'].includes(event.kind))return
   // Empty model protocol events do not interrupt a visually continuous tool run.
   if(event.kind==='model'&&!event.text&&!event.reasoning&&event.state!=='running')return
   if(event.kind==='proposal'){
    const proposal=proposals.get(event.id);if(!proposal)return
    flush();if(suggestions.length&&(suggestions[0].className!==proposal.className||suggestions[0].classId!==proposal.classId||suggestions[0].worldId!==proposal.worldId))flushProposals()
    suggestions.push(proposal);return
   }
   flush();flushProposals();blocks.push(render(event,index))
  });flush();flushProposals();return blocks
 }
 const root=events.find(e=>e.kind==='agent'&&!e.parentInvocationId)?.invocationId
 return <div className="chat-execution">{timeline(root)}{nodeEvents.length>0&&<Process title={`工作流进度 · ${nodeEvents.filter(e=>e.kind==='node').length} 个步骤`} icon={<ListTree size={15}/>} className="chat-node-progress">
  {nodeEvents.map((e,i)=><div key={e.sequence??i}>{e.kind==='node'?`${progressTitle(e,i)} · ${stateLabel(terminalState(e.state))}`:e.kind==='loop'?`${e.title||'循环'} · 第 ${e.iteration} 轮 · ${stateLabel(terminalState(e.state))}`:e.kind==='branch'?`${e.title||'条件'} · ${e.selected?'真':'假'}分支`:e.kind==='notice'?e.message:''}{progressScope(e)&&<small> · {progressScope(e)}</small>}</div>)}
 </Process>}{run.status!=='running'&&run.status!=='complete'&&<p className="danger" role="alert">{run.error||run.status}</p>}</div>
}
