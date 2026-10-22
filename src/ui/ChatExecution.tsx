import ToolIcon from './ToolIcon'
import ChatInputContext from './ChatInputContext'

import ChatInterjection from './ChatInterjection'
import RoleplayOutput from './RoleplayOutput'
import {World,ChatParticipant} from '../model/types'
import type {ProposalHandler} from '../model/types'
import type {ReactNode} from 'react'
import {Brain,ChevronRight,ListTree,Network} from 'lucide-react'
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
function Process({title,icon,state,children,open,className='',preview}:{preview?:string;title:string;icon:ReactNode;state?:string;children:ReactNode;open?:boolean;className?:string}) {
 return <details className={`ui-surface ui-panel ui-panel--chat-process ui-panel--themed ui-panel--text ui-surface--bordered chat-process ${className}`} open={open}>
  <summary><span className="ui-surface ui-icon-surface ui-icon-surface--process">{icon}</span><span className="chat-process-title">{title}</span>{preview&&<small className="chat-process-preview">{preview}</small>}{state&&<span className="ui-surface ui-badge ui-badge--status chat-process-status" data-state={state}>{stateLabel(state)}</span>}<ChevronRight size={14} className="chat-process-chevron"/></summary>
  <div className="chat-process-body">{children}</div>
 </details>
}
export default function ChatExecution({run,proposals,onDecision,finalText,agents=[],detailed=false,member,world,roleplay=false,participants=[],onEditInput,editable=false}:{onEditInput?:(id:string)=>void;editable?:boolean;detailed?:boolean;member?:string;world?:World;roleplay?:boolean;participants?:ChatParticipant[];agents?:AgentDefinition[];finalText?:string;run:NonNullable<ChatMessage['run']>;proposals:Map<string,InstanceChangeProposal>;onDecision?:ProposalHandler}) {
 const roots=run.events.filter(e=>e.kind==='agent'&&(member==='root'?!e.parentInvocationId:e.agentId===member)).map(e=>e.invocationId)
 const allowed=new Set(roots);for(const e of run.events)if(e.kind==='agent'&&e.parentInvocationId&&allowed.has(e.parentInvocationId))allowed.add(e.invocationId)
 const events=member?run.events.filter(e=>allowed.has(e.invocationId)):run.events,nodeEvents=events.filter(e=>['node','loop','branch','notice'].includes(e.kind))
 const terminalState=(state:string)=>state==='running'&&run.status!=='running'?(run.status==='complete'?'complete':run.status==='cancelled'?'cancelled':'error'):state
 const progressTitle=(e:WorkflowEvent,index:number)=>e.title||('id'in e?agents.find(a=>a.id===e.agentId)?.graph.nodes.filter(n=>n.id===e.id).map(n=>workflowNodeTitle(n))[0]:undefined)||`执行步骤 ${index+1}`
 const progressScope=(e:WorkflowEvent)=>e.scopeLabel||e.frame?.split('/').filter(Boolean).map(part=>`循环 · 第 ${part.slice(part.lastIndexOf(':')+1)} 轮`).join(' / ')
 const render=(raw:WorkflowEvent,index:number)=>{
  const event=('state'in raw&&raw.state==='running'&&run.status!=='running'?{...raw,state:run.status==='complete'?'complete':run.status==='error'?'error':'cancelled'}:raw) as WorkflowEvent
  const key=event.sequence??index
  if(event.kind==='question'||event.kind==='proposal')return null
  if(event.kind==='model'&&event.discarded)return null
  if(event.kind==='model')return <div className="chat-model-step" key={key}>
   {event.reasoning&&<Process title="思考过程" icon={<Brain size={15}/>} state={event.state==='running'?'running':undefined}><ChatMarkdown>{event.reasoning}</ChatMarkdown></Process>}
   {event.text&&!(run.status==='complete'&&!event.parentInvocationId&&event.text===finalText)&&<ChatMarkdown className="chat-stream-text">{event.text}</ChatMarkdown>}
   {!event.text&&!event.reasoning&&event.state==='running'&&<span className="chat-process-state" role="status">正在请求模型…</span>}

  </div>
  if(event.kind==='tool')return <Process key={key} title={event.title||builtinTools.find(t=>t.callName===event.name)?.name||event.name} icon={<ToolIcon role={event.toolRole} tool={builtinTools.find(t=>t.callName===event.name)} size={15}/>} state={event.state}>
   <small className="chat-call-name">{event.name}</small><label>参数</label><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.parameters)}</pre>
   {event.result!==undefined&&<><label>结果</label><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.result)}</pre></>}{event.error&&<p className="danger">{event.error}</p>}
  </Process>
  if(event.kind==='agent'&&event.parentInvocationId)return <Process key={key} title={event.name} icon={<Network size={15}/>} state={event.state} className="chat-agent-step" open={event.state==='running'}>
   <details className="chat-process-data"><summary>主 Agent 交付的任务 / 参数</summary><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.parameters)}</pre></details>
   <details className="chat-process-data"><summary>输入上下文</summary><ChatInputContext value={event.inputContext} participants={participants}/></details><div className="chat-process-timeline">{timeline(event.invocationId)}</div>{event.result!==undefined&&<details className="chat-process-data"><summary>返回结果</summary><pre className="ui-surface ui-value ui-value--chat-code ui-surface--bordered">{text(event.result)}</pre></details>}{event.error&&<p className="danger">{event.error}</p>}
  </Process>
  return null
 }
 const timeline=(invocationId?:string)=>{
  const blocks:ReactNode[]=[],tools:{event:WorkflowEvent;index:number}[]=[],suggestions:InstanceChangeProposal[]=[]
  const flushProposals=()=>{if(!suggestions.length)return;const group=suggestions.splice(0);blocks.push(group.length===1?<InstanceProposal key={`proposal-${group[0].id}`} proposal={group[0]} onDecision={onDecision}/>:<ProposalGroup key={`proposals-${group[0].id}`} proposals={group} onDecision={onDecision}/>)}
  const flush=()=>{if(!tools.length)return;const group=tools.splice(0);if(group.length===1){blocks.push(render(group[0].event,group[0].index));return}const states=group.map(({event})=>'state'in event?terminalState(event.state):'complete');blocks.push(<Process key={`tools-${group[0].event.sequence??group[0].index}`} title={`工具调用 · ${group.length} 次`} icon={<ToolIcon role={group.every(({event})=>event.kind==='tool'&&event.toolRole===('toolRole'in group[0].event?group[0].event.toolRole:undefined))&&'toolRole'in group[0].event?group[0].event.toolRole:undefined} size={15}/>} state={states.includes('error')?'error':states.includes('cancelled')?'cancelled':states.includes('running')?'running':'complete'} className="chat-tool-group">{group.map(({event,index})=>render(event,index))}</Process>)}
  events.forEach((event,index)=>{
   const belongs=event.kind==='agent'?event.parentInvocationId===invocationId:event.invocationId===invocationId
   if(!belongs)return
   if(event.kind==='tool'){
    if(event.result&&typeof event.result==='object'&&'proposalId'in event.result&&proposals.has(String(event.result.proposalId)))return
    if(event.name==='universe_ask_user'&&events.some(e=>e.kind==='question'&&e.invocationId===event.invocationId)&&!event.error)return
    flushProposals();tools.push({event,index});return
   }
   if(['node','edge','variables','loop','branch'].includes(event.kind))return
   // Empty model protocol events do not interrupt a visually continuous tool run.
   if(event.kind==='model'&&!event.text&&!event.reasoning&&event.state!=='running')return
   if(event.kind==='proposal')return
   flush();flushProposals();blocks.push(render(event,index))
  });flush();flushProposals();return blocks
 }
 const root=events.find(e=>e.kind==='agent'&&(member&&member!=='root'?e.agentId===member:!e.parentInvocationId))?.invocationId
 const process=<div className="chat-process-timeline">{detailed&&member&&roots.length?[...new Set(roots)].map(id=><div className="chat-process-timeline" key={id}>{timeline(id)}</div>):timeline(root)}{nodeEvents.length>0&&<Process title={`工作流进度 · ${nodeEvents.filter(e=>e.kind==='node').length} 个步骤`} icon={<ListTree size={15}/>} className="chat-node-progress">
  {nodeEvents.map((e,i)=><div key={e.sequence??i}>{e.kind==='node'?`${progressTitle(e,i)} · ${stateLabel(terminalState(e.state))}`:e.kind==='loop'?`${e.title||'循环'} · 第 ${e.iteration} 轮 · ${stateLabel(terminalState(e.state))}`:e.kind==='branch'?`${e.title||'条件'} · ${e.selected?'真':'假'}分支`:e.kind==='notice'?e.message:''}{progressScope(e)&&<small> · {progressScope(e)}</small>}</div>)}
 </Process>}</div>
 const latest=run.status==='running'?(events.find(e=>e.kind==='question'&&!e.answer)||events.slice().reverse().find(e=>'state'in e&&e.state==='running'&&['tool','agent','model','node','loop'].includes(e.kind))):undefined,last=latest||events.slice().reverse().find(e=>['tool','agent','node'].includes(e.kind))
 const preview=last?(last.kind==='question'?'等待你的回答':last.kind==='model'?`正在请求 ${last.modelName||'模型'}`:last.title||('name'in last?last.name:last.kind==='loop'?`循环 · 第 ${last.iteration} 轮`:progressTitle(last,0))):'准备执行'
 const publicBlocks:ReactNode[]=[];let suggestions:InstanceChangeProposal[]=[]
 const flushSuggestions=()=>{if(!suggestions.length)return;const group=suggestions;suggestions=[];publicBlocks.push(group.length===1?<InstanceProposal key={group[0].id} proposal={group[0]} onDecision={onDecision}/>:<ProposalGroup key={group[0].id} proposals={group} onDecision={onDecision}/>)}
 const publicEvents=events.map((event,index)=>({event,index})).sort((a,b)=>(a.event.displaySequence??a.event.sequence??a.index)-(b.event.displaySequence??b.event.sequence??b.index))
 publicEvents.forEach(({event,index})=>{
  if(detailed&&!['proposal','question'].includes(event.kind))return
  if(event.kind==='model'&&event.discarded)return
  if(event.kind==='userInput'){flushSuggestions();publicBlocks.push(<ChatInterjection world={world} key={event.id} id={event.id} name={event.name} content={event.content} onEdit={onEditInput} editable={editable}/>);return}
  if(event.kind==='proposal'){const proposal=proposals.get(event.id);if(!proposal)return;if(suggestions.length&&suggestions[0].classId!==proposal.classId)flushSuggestions();suggestions.push(proposal);return}
  if(event.kind==='node'||event.kind==='loop'||event.kind==='branch'||event.kind==='tool'||event.kind==='model'&&!event.text)return
  flushSuggestions()
  if(event.kind==='question')publicBlocks.push(<ChatQuestion key={index} value={event} running={run.status==='running'}/>)
  if(event.kind==='agent'&&event.parentInvocationId&&event.state==='complete'&&event.result!==undefined){const participant=participants.find(p=>'session-member:'+p.id===event.agentId);publicBlocks.push(roleplay&&world?<RoleplayOutput key={index} name={event.name} value={event.result} world={world} entity={participant?.entity}/>:<section key={index} className="chat-member-output ui-surface ui-card ui-card--collection ui-card--themed ui-card--text"><strong>{event.name}</strong><ChatMarkdown>{text(event.result)}</ChatMarkdown></section>)}
  if(event.kind==='model'&&!event.parentInvocationId&&event.text&&!(run.status==='complete'&&event.text===finalText))publicBlocks.push(<ChatMarkdown key={index}>{event.text}</ChatMarkdown>)
 });flushSuggestions()
 if(detailed&&member&&member!=='root')for(const event of events)if(event.kind==='agent'&&event.agentId===member&&event.state==='complete'&&event.result!==undefined){const participant=participants.find(p=>'session-member:'+p.id===event.agentId);publicBlocks.push(roleplay&&world?<RoleplayOutput key={event.id} name={event.name} value={event.result} world={world} entity={participant?.entity}/>:<ChatMarkdown key={event.id}>{text(event.result)}</ChatMarkdown>)}
 return <div className="chat-execution">{<><Process preview={preview} title="执行过程" icon={<ListTree size={15}/>} state={run.status==='interrupted'?'error':run.status} className="chat-all-process">{process}</Process>{publicBlocks}</>}{run.status!=='running'&&run.status!=='complete'&&<p className="danger" role="alert">{run.error||run.status}</p>}</div>
}
