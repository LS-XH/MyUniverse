import {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/ui/styles/index.css'
import {createWorld} from '../src/model/templates'
import {ChatMessage,Workspace,uid} from '../src/model/types'
import {activeTheme,themeStyle} from '../src/model/themes'
import {conversationAgent,multiAgentExample} from '../src/model/workflowTemplates'
import {editChatHistory,mergeChatEvents,updateChatMessage} from '../src/model/chatRuns'
import {bindVariable} from '../src/model/workflowBindings'
import {appendInstanceProposal,decideInstanceProposal,decideInstanceProposals,onInstanceProposal} from '../src/services/instanceProposals'
import {bindScriptHost} from '../src/services/scriptHost'
import {commitAgentMemory,runAgent,workflowText} from '../src/services/workflows'
import ModelsPage from '../src/ui/ModelsPage'
import ChatPage from '../src/ui/ChatPage'
import WorkflowEditor from '../src/ui/WorkflowEditor'

function fixture():Workspace {
 const world=createWorld('内存验收世界');world.id='preview-world';world.documents=[{id:'items',name:'物件',fileName:'物件.md',schema:[{id:'desc',keyType:'Const',key:'描述',valueType:'Text'}],entities:[{id:'a',name:'甲',fields:[{id:'f',schemaId:'desc',key:'描述',value:'原值',children:[]}]}]}]
 world.chat.target={kind:'model',id:'m'}
 const agents=multiAgentExample('m'),extra=conversationAgent('m');extra.name='需要额外参数';extra.inputSchema={type:'object',properties:{n:{type:'number'}},required:['n'],additionalProperties:false}
 const parent=agents[1],entry=parent.variables.history as {id:string}
 const body=parent.graph.nodes.find(n=>n.kind==='loop')!.body!;parent.graph.nodes.find(n=>n.kind==='loop')!.body=bindVariable(body,parent.variables,body.nodes.find(n=>n.kind==='llmBasic')!.id,'messages','in',entry.id)
 return {worlds:[world],activeWorldId:world.id,themeId:'violet',agents:[...agents,extra],models:[{id:'m',name:'本地 SSE 验收模型',model:'fixture',baseUrl:'http://127.0.0.1:1431',apiKey:'',enabled:true,chatSystemPrompt:'仅聊天直连的系统词',toolIds:['builtin:list_classes','builtin:propose_instance_change','builtin:propose_instance_add']}]}
}
function Preview(){
 const [workspace,setWorkspace]=useState(fixture),[tab,setTab]=useState('chat'),[sending,setSending]=useState(false),[error,setError]=useState(''),latest=useRef(workspace),controller=useRef<AbortController|null>(null)
 latest.current=workspace
 const publish=(value:Workspace)=>{latest.current=value;setWorkspace(value)}
 useEffect(()=>{const host=bindScriptHost({get:()=>latest.current,update:fn=>publish(fn(latest.current)),save:async()=>{}}),off=onInstanceProposal(event=>publish(appendInstanceProposal(latest.current,event)));return()=>{host();off();controller.current?.abort()}},[])
 const send=async(input:string,editId?:string)=>{
  const snapshot=latest.current,world=snapshot.worlds[0],target=world.chat.target!,conversation=editId?editChatHistory(world.chat.conversations[0],editId):world.chat.conversations[0]||{id:'preview-chat',title:'SSE 与 Agent 验收',createdAt:Date.now(),messages:[]},id=uid()
  const message:ChatMessage={id,role:'assistant',content:'',createdAt:Date.now(),run:{id:uid(),target,status:'running',events:[]}}
  publish({...snapshot,worlds:[{...world,chat:{...world.chat,activeConversationId:conversation.id,conversations:[{...conversation,messages:[...conversation.messages,{id:uid(),role:'user',content:input,createdAt:Date.now(),protocolBefore:conversation.modelMessages||[]},message]}]}}]})
  const c=new AbortController();controller.current=c;setSending(true);setError('')
  try{
   const definition=target.kind==='agent'?snapshot.agents!.find(a=>a.id===target.id)!:conversationAgent('m',snapshot.models![0].toolIds,conversation.modelMessages||[{role:'system',content:snapshot.models![0].chatSystemPrompt!}],'直接模型')
   const output=await runAgent(definition,input,snapshot,world,c.signal,undefined,{stream:true,toolContext:{conversationId:conversation.id},onEvent:event=>{if(event.kind!=='edge'&&event.kind!=='variables')publish(updateChatMessage(latest.current,world.id,conversation.id,id,m=>({...m,run:{...m.run!,events:mergeChatEvents(m.run!.events,[event])}})))}})
   let next=updateChatMessage(commitAgentMemory(latest.current,output.memoryChanges||[]),world.id,conversation.id,id,m=>({...m,content:workflowText(output.value),run:{...m.run!,status:'complete'}}))
   if(target.kind==='model')next={...next,worlds:next.worlds.map(w=>({...w,chat:{...w.chat,conversations:w.chat.conversations.map(conv=>({...conv,modelMessages:(output.variables.history as any).value.items}))}}))}
   publish(next)
  }catch(error){const text=c.signal.aborted?'已取消':String(error);setError(text);publish(updateChatMessage(latest.current,world.id,conversation.id,id,m=>({...m,run:{...m.run!,status:c.signal.aborted?'cancelled':'error',error:text}})))}finally{setSending(false)}
 }
 const world=workspace.worlds[0],parent=workspace.agents![1]
 return <div className="app-shell" style={themeStyle(activeTheme(workspace).colors)}><main className="main-area"><div className="topbar"><strong>仅内存 · 不写用户数据</strong>{['chat','graph','models'].map(value=><button key={value} className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>setTab(value)}>{value==='chat'?'聊天验收':value==='models'?'模型配置验收':'图工作流验收'}</button>)}{['violet','dark','light'].map(value=><button key={value} className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={()=>publish({...workspace,themeId:value})}>{value}</button>)}<span>实例当前值：{world.documents[0].entities[0].fields[0].value}</span></div>{tab==='models'?<ModelsPage workspace={workspace} onChange={publish} selectedId="m" onSelect={()=>{}}/>:tab==='chat'?<ChatPage world={world} models={workspace.models!} agents={workspace.agents!} onChange={world=>publish({...latest.current,worlds:[world]})} onModelSettings={()=>setTab('graph')} onSend={(input,editId)=>{void send(input,editId)}} onStop={()=>controller.current?.abort()} sending={sending} error={error} onProposalDecision={(id,save,ids)=>publish(ids?decideInstanceProposals(latest.current,world.id,world.chat.activeConversationId!,ids,save):decideInstanceProposal(latest.current,world.id,world.chat.activeConversationId!,id,save))}/>:<WorkflowEditor title={parent.name} variables={parent.variables} workspace={workspace} value={parent.graph} mode="agent" onEdit={(graph,variables)=>publish({...latest.current,agents:latest.current.agents!.map(a=>a.id===parent.id?{...a,graph,variables}:a)})} onChange={graph=>publish({...latest.current,agents:latest.current.agents!.map(a=>a.id===parent.id?{...a,graph}:a)})}/>}</main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
