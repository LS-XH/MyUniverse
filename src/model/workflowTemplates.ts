import {AgentDefinition,WorkflowNode,WorkflowLink,uid} from './types'
import {workflowNode} from './workflows'
import {ContextMessage,typedVariableNode} from './workflowValues'
import {configureControl} from './workflowControl'

/** One graph for ordinary Agents, the editable tool template and direct model chat. */
export function conversationAgent(modelId?:string,toolIds:string[]=[],history:ContextMessage[]=[],name='新智能体',agentIds:string[]=[]):AgentDefinition {
 const id=uid(),historyId=uid(),toolsId=uid(),agentsId=uid()
 const input=workflowNode('input',40,40),read=typedVariableNode('Messages',undefined,40,260),user=typedVariableNode('Messages','user',380,100),initial=typedVariableNode('Messages',undefined,720,100)
 const loop=workflowNode('loop',1060,100);loop.settings.repeat='16'
 const final=typedVariableNode('Messages',undefined,1400,100),text=typedVariableNode('Messages','lastText',1740,100),out=workflowNode('return',2080,100)
 const bodyRead=typedVariableNode('Messages',undefined,40,60),llm=workflowNode('llmBasic',380,60),merge=typedVariableNode('Messages','merge',720,60),pending=typedVariableNode('Messages','hasPendingCalls',1060,60),calls=workflowNode('toolCalls',1060,300),merged=typedVariableNode('Messages','merge',1400,300),choose=configureControl(workflowNode('condition',1740,60),'Messages'),save=typedVariableNode('Messages',undefined,2080,60),not=typedVariableNode('Boolean','not',1400,600)
 const tools=typedVariableNode('Tools',undefined,40,360),agents=typedVariableNode('Agents',undefined,40,600)
 tools.settings={...tools.settings,name:'tools',variableId:toolsId};agents.settings={...agents.settings,name:'agents',variableId:agentsId}
 for(const n of [read,initial,final,bodyRead,save])n.settings={...n.settings,name:'history',variableId:historyId}
 llm.settings.modelId=modelId||''
 const edge=(from:WorkflowNode,to:WorkflowNode,input:string,output='value'):WorkflowLink=>({id:uid(),from:from.id,to:to.id,input,output})
 const stop=loop.body!.nodes.find(n=>n.kind==='break')!,again=loop.body!.nodes.find(n=>n.kind==='continue')!
 stop.x=1740;stop.y=600;again.x=2080;again.y=600
 loop.body={...loop.body!,nodes:[bodyRead,llm,merge,pending,calls,merged,choose,save,not,tools,...(agentIds.length?[agents]:[]),stop,again],links:[
  edge(bodyRead,llm,'messages'),edge(tools,llm,'tools'),edge(bodyRead,merge,'self'),edge(llm,merge,'arg'),edge(merge,pending,'self'),edge(merge,calls,'messages'),edge(tools,calls,'tools'),edge(merge,merged,'self'),edge(calls,merged,'arg'),edge(pending,choose,'condition'),edge(merged,choose,'trueValue'),edge(merge,choose,'falseValue'),edge(choose,save,'value'),edge(pending,not,'self'),edge(not,stop,'condition'),...(agentIds.length?[edge(agents,llm,'agents'),edge(agents,calls,'agents')]:[])
 ]}
 return {id,name,variables:{...(agentIds.length?{agents:{id:agentsId,type:'Agents',value:{type:'Agents',version:1,agentIds}}}:{}),history:{id:historyId,type:'Messages',value:{type:'Messages',version:1,items:history}},tools:{id:toolsId,type:'Tools',value:{type:'Tools',version:1,toolIds}}},graph:{version:1,nodes:[input,read,user,initial,loop,final,text,out],links:[edge(read,user,'self'),edge(input,user,'arg'),edge(user,initial,'value'),edge(initial,loop,'value'),edge(loop,final,'after'),edge(final,text,'self'),edge(text,out,'value')]}}
}

export function multiAgentExample(modelId?:string):AgentDefinition[] {
 const child=conversationAgent(modelId,[],[{role:'system',content:'你是创作审校助手，检查输入中的世界设定和人物一致性，返回简短建议。'}],'示例 · 创作审校')
 child.description='检查世界设定与人物一致性，返回审校建议。'
 const parent=conversationAgent(modelId,[],[{role:'system',content:'你是创作助手，先调用审校 Agent 检查用户输入，再结合结果回答。'}],'示例 · Multiagent 创作')
 const agents=typedVariableNode('Agents','get',720,-220);agents.settings.agentId=child.id
 const llm=parent.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.find(n=>n.kind==='llmBasic')!,calls=parent.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.find(n=>n.kind==='toolCalls')!
 const body=parent.graph.nodes.find(n=>n.kind==='loop')!.body!;body.nodes.push(agents)
 for(const target of [llm,calls])body.links.push({id:uid(),from:agents.id,output:'value',to:target.id,input:'agents'})
 return [child,parent]
}
