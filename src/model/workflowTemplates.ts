import {AgentDefinition,WorkflowNode,WorkflowLink,uid} from './types'
import {workflowNode} from './workflows'
import {ContextMessage,typedVariableNode} from './workflowValues'
import {configureControl} from './workflowControl'

/** One graph for ordinary Agents, the editable tool template and direct model chat. */
export function conversationAgent(modelId?:string,toolIds:string[]=[],history:ContextMessage[]=[],name='新智能体',agentIds:string[]=[]):AgentDefinition {
 const id=uid(),historyId=uid(),toolsId=uid()
 const input=workflowNode('input',40,40),read=typedVariableNode('Messages',undefined,40,260),user=typedVariableNode('Messages','user',380,260)
 const loop=workflowNode('loop',720,260),llm=workflowNode('llmBasic',1060,260),merge=typedVariableNode('Messages','merge',1400,260)
 const pending=typedVariableNode('Messages','hasPendingCalls',1740,40),calls=workflowNode('toolCalls',1740,260),merged=typedVariableNode('Messages','merge',2080,260)
 const choose=configureControl(workflowNode('condition',2420,260),'Messages'),save=typedVariableNode('Messages',undefined,1060,760),text=typedVariableNode('Messages','lastText',1400,760),out=workflowNode('return',1740,760)
 const agentsId=uid(),agents=typedVariableNode('Agents',undefined,720,-180)
 agents.settings={...agents.settings,name:'agents',variableId:agentsId}
 const tools=typedVariableNode('Tools',undefined,720,40)
 for(const n of [read,save])n.settings={...n.settings,name:'history',variableId:historyId}
 tools.settings={...tools.settings,name:'tools',variableId:toolsId}
 llm.settings.modelId=modelId||''
 const edge=(from:WorkflowNode,to:WorkflowNode,input:string,output='value'):WorkflowLink=>({id:uid(),from:from.id,to:to.id,input,output})
 return {id,name,variables:{...(agentIds.length?{agents:{id:agentsId,type:'Agents',value:{type:'Agents',version:1,agentIds}}}:{}),history:{id:historyId,type:'Messages',value:{type:'Messages',version:1,items:history}},tools:{id:toolsId,type:'Tools',value:{type:'Tools',version:1,toolIds}}},graph:{version:1,nodes:[input,read,user,loop,llm,merge,pending,calls,merged,choose,save,text,out,tools,...(agentIds.length?[agents]:[])],links:[
  ...(agentIds.length?[edge(agents,llm,'agents'),edge(agents,calls,'agents')]:[]),
  edge(read,user,'self'),edge(input,user,'arg'),edge(user,loop,'initial'),edge(loop,llm,'messages','current'),edge(tools,llm,'tools'),
  edge(loop,merge,'self','current'),edge(llm,merge,'arg'),edge(merge,pending,'self'),edge(merge,calls,'messages'),edge(tools,calls,'tools'),
  edge(merge,merged,'self'),edge(calls,merged,'arg'),edge(pending,choose,'condition'),edge(merged,choose,'trueValue'),edge(merge,choose,'falseValue'),
  edge(choose,loop,'next'),edge(pending,loop,'continue'),edge(loop,save,'value','result'),edge(save,text,'self'),edge(text,out,'value')
 ]}}
}
export function multiAgentExample(modelId?:string):AgentDefinition[] {
 const child=conversationAgent(modelId,[],[{role:'system',content:'你是创作审校助手，检查输入中的世界设定和人物一致性，返回简短建议。'}],'示例 · 创作审校')
 child.description='检查世界设定与人物一致性，返回审校建议。'
 const parent=conversationAgent(modelId,[],[{role:'system',content:'你是创作助手，先调用审校 Agent 检查用户输入，再结合结果回答。'}],'示例 · Multiagent 创作')
 const agents=typedVariableNode('Agents','get',720,-220);agents.settings.agentId=child.id
 const llm=parent.graph.nodes.find(n=>n.kind==='llmBasic')!,calls=parent.graph.nodes.find(n=>n.kind==='toolCalls')!
 parent.graph.nodes.push(agents)
 for(const target of [llm,calls])parent.graph.links.push({id:uid(),from:agents.id,output:'value',to:target.id,input:'agents'})
 return [child,parent]
}
