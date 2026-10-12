import test from 'node:test'
import assert from 'node:assert/strict'
import {AgentDefinition,WorkflowGraph,WorkflowNode,Workspace,uid} from '../src/model/types'
import {configureControl} from '../src/model/workflowControl'
import {validateWorkflow,workflowNode,connectWorkflow} from '../src/model/workflows'
import {strictValue,typedVariableNode} from '../src/model/workflowValues'
import {bindVariable,unbindVariable} from '../src/model/workflowBindings'
import {runAgent,commitAgentMemory} from '../src/services/workflows'
import {agentCapability,agentChatReason,agentParameters} from '../src/model/agents'
import {WorkflowEvent} from '../src/services/workflowExecution'
import {conversationAgent} from '../src/model/workflowTemplates'
import {chatTarget,mergeChatEvents,normalizeChatRuns,updateChatMessage} from '../src/model/chatRuns'
import {createWorld} from '../src/model/templates'
import {lineDiff} from '../src/model/textDiff'
import {answerChatQuestion} from '../src/services/chatQuestions'
test('streaming Agent waits for question and resumes with the original ToolUse ID',async()=>{
 const definition=conversationAgent('m',['builtin:ask_user']),events:WorkflowEvent[]=[]
 const result=await runAgent(definition,'有歧义',ws,undefined,undefined,undefined,{stream:true,onEvent:e=>{events.push(e);if(e.kind==='question'&&!e.answer)answerChatQuestion(e.id,'人物甲')},llmStream:async(_m,messages)=>{
  if(messages.at(-1)?.role==='tool'){assert.equal(messages.at(-1)?.tool_call_id,'question-call');assert.equal(messages.at(-1)?.content,'人物甲');return {role:'assistant',content:'已明确人物'}}
  return {role:'assistant',content:null,tool_calls:[{id:'question-call',type:'function',function:{name:'universe_ask_user',arguments:JSON.stringify({question:'你指的是谁？',options:['人物甲','人物乙']})}}]}
 }})
 assert.equal(result.value,'已明确人物');assert.equal(events.filter(e=>e.kind==='question').length,2)
 const merged=mergeChatEvents([],events).filter(e=>e.kind==='question');assert.equal(merged.length,1);assert.equal(merged[0].kind==='question'&&merged[0].answer,'人物甲')
})

const ws:Workspace={worlds:[],activeWorldId:null,models:[{id:'m',name:'mock',model:'mock',baseUrl:'http://test.invalid',apiKey:'',enabled:true}]}
const edge=(from:WorkflowNode,to:WorkflowNode,input:string,output='value')=>({id:uid(),from:from.id,to:to.id,input,output})
const agent=(nodes:WorkflowNode[],links:WorkflowGraph['links'],variables:Record<string,unknown>={}):AgentDefinition=>({id:uid(),name:'test',variables,graph:{version:1,nodes,links}})
function countingLoop(){
 const loop=configureControl(workflowNode('loop'),'Number'),add=typedVariableNode('Number','add'),less=typedVariableNode('Number','less'),out=workflowNode('return')
 loop.settings['port:initial']='0';add.settings['port:arg']='1';less.settings['port:arg']='3'
 return {loop,add,less,out,definition:agent([loop,add,less,out],[edge(loop,add,'self','current'),edge(add,loop,'next'),edge(add,less,'self'),edge(less,loop,'continue'),edge(loop,out,'value','result')])}
}
test('loop carries state, runs shared dependencies once per round, and defaults to one round',async()=>{
 const {definition,loop}=countingLoop(),events:WorkflowEvent[]=[]
 const result=await runAgent(definition,'',ws,undefined,undefined,undefined,{runId:'persisted-run',onEvent:e=>{events.push(e)}})
 assert.ok(events.every(e=>e.runId==='persisted-run'))
 assert.equal(result.value,3);assert.equal(result.trace.filter(t=>t.title==='Number · 增加').length,3)
 assert.deepEqual(events.filter(e=>e.kind==='loop'&&e.state==='running').map(e=>e.kind==='loop'?e.iteration:0),[1,2,3])
 assert.equal(new Set(result.trace.filter(t=>t.title==='Number · 增加').map(t=>t.frame)).size,3)
 definition.graph.links=definition.graph.links.filter(e=>(e.to!==loop.id||e.input!=='continue')&&e.to!==definition.graph.nodes.find(n=>n.kind==='valueMethod'&&n.settings.member==='less')!.id)
 assert.equal((await runAgent(definition,'',ws)).value,1)
})
test('nested loops get independent frames and iteration-local results',async()=>{
 const outer=configureControl(workflowNode('loop'),'Number'),inner=configureControl(workflowNode('loop'),'Number'),add=typedVariableNode('Number','add'),less=typedVariableNode('Number','less'),again=typedVariableNode('Number','less'),out=workflowNode('return')
 outer.settings['port:initial']='0';add.settings['port:arg']='1';less.settings['port:arg']='2';again.settings['port:arg']='2'
 const definition=agent([outer,inner,add,less,again,out],[edge(outer,inner,'initial','current'),edge(inner,add,'self','current'),edge(add,inner,'next'),edge(add,less,'self'),edge(less,inner,'continue'),edge(inner,outer,'next','result'),edge(outer,again,'self','iteration'),edge(again,outer,'continue'),edge(outer,out,'value','result')])
 const result=await runAgent(definition,'',ws);assert.equal(result.value,3)
 assert.equal(result.trace.filter(t=>t.title==='Number · 增加').length,3)
})
test('loop limits, intermediate leakage, missing feedback and uncontrolled cycles fail',async()=>{
 const {definition,loop,add,out}=countingLoop();loop.settings.maxIterations='2'
 await assert.rejects(runAgent(definition,'',ws),/最大轮次/)
 loop.settings.maxIterations='16';definition.graph.links.push(edge(add,out,'after'));assert.throws(()=>validateWorkflow(definition.graph),/result/)
 const bare=configureControl(workflowNode('loop'),'Number');await assert.rejects(runAgent(agent([bare,out],[edge(bare,out,'value','result')]),'',ws),/next/)
 const a=workflowNode('concat'),b=workflowNode('concat');assert.throws(()=>validateWorkflow({version:1,nodes:[a,b],links:[edge(a,b,'a'),edge(b,a,'a')]}),/循环/)
})
test('conditional evaluation leaves the unselected tool, malformed literal and writes untouched',async()=>{
 const choose=workflowNode('condition'),good=workflowNode('constant'),bad=workflowNode('tool'),out=workflowNode('return')
 choose.settings['port:condition']='true';good.settings.value='chosen';bad.settings.toolId='missing'
 const definition=agent([choose,good,bad,out],[edge(good,choose,'trueValue'),edge(bad,choose,'falseValue'),edge(choose,out,'value')])
 assert.equal((await runAgent(definition,'',ws)).value,'chosen')
 choose.settings['port:condition']='false';await assert.rejects(runAgent(definition,'',ws),/不存在/)
})
test('inline input is mirrored before execution, paired output updates it, and wiring survives bind/unbind',async()=>{
 const source=workflowNode('input'),upper=typedVariableNode('String','upper'),out=workflowNode('return'),variables={text:{id:'v',type:'String',value:'old'}}
 let graph:WorkflowGraph={version:1,nodes:[source,upper,out],links:[edge(source,upper,'self'),edge(upper,out,'value')]}
 graph=bindVariable(graph,variables,upper.id,'self','in','v');assert.equal(graph.links.length,2)
 graph=connectWorkflow(graph,{from:source.id,to:upper.id,input:'self',output:'value'});assert.equal(graph.nodes[1].bindings?.['in:self'].variableId,'v')
 const events:WorkflowEvent[]=[];const result=await runAgent({...agent([],[],variables),graph},'hello',ws,undefined,undefined,undefined,{onEvent:e=>{events.push(e)}})
 assert.equal(result.value,'HELLO');assert.equal((result.variables.text as any).value,'HELLO')
 assert.ok(events.some(e=>e.kind==='variables'&&(e.values.text as any).value==='hello'))
 assert.equal(unbindVariable(graph,upper.id,'in:self').links.length,2);assert.equal(variables.text.value,'old')
})
test('Agents is strict, gets metadata, merges IDs, and never pairs constructors',async()=>{
 assert.deepEqual(strictValue('Agents',{type:'Agents',version:1,agentIds:['a']}),{type:'Agents',version:1,agentIds:['a']})
 for(const value of [{type:'Tools',version:1,toolIds:['a']},{type:'Agents',version:1,agentIds:['a','a']},{type:'Agents',version:1,agentIds:[1]},'a'])assert.throws(()=>strictValue('Agents',value),/Agents/)
 const child=conversationAgent('m'),get=typedVariableNode('Agents','get'),metadata=typedVariableNode('Agents','metadata'),out=workflowNode('return');get.settings.agentId=child.id
 const variables={agents:{id:'agents',type:'Agents',value:{type:'Agents',version:1,agentIds:[]}}},graph=bindVariable({version:1,nodes:[get,metadata,out],links:[edge(get,metadata,'self'),edge(metadata,out,'value')]},variables,get.id,'self','in','agents')
 assert.equal(graph.nodes[0].bindings?.['in:self'].output,undefined)
 const result=await runAgent({...agent([],[],variables),graph},'',{...ws,agents:[child]});assert.ok(String(result.value).includes(agentCapability(child).callName!));assert.deepEqual((result.variables.agents as any).value.agentIds,[])
})
test('Agent schemas apply defaults, expose parameter fields and restrict chat compatibility',async()=>{
 const input=workflowNode('input'),out=workflowNode('return');input.settings.parameter='n';input.outputs=[{name:'value',type:'NUMBER'}]
 const definition=agent([input,out],[edge(input,out,'value')]);definition.inputSchema={type:'object',properties:{input:{type:'string'},n:{type:'number',default:4}},required:['input','n'],additionalProperties:false}
 assert.equal(agentParameters(definition,{input:'x'}).n,4);assert.equal(agentChatReason(definition),undefined)
 assert.equal((await runAgent(definition,{input:'x',n:7},ws)).value,7)
 definition.inputSchema={type:'object',properties:{n:{type:'number'}},required:['n'],additionalProperties:false};assert.ok(agentChatReason(definition));await assert.rejects(runAgent(definition,'text',ws),/inputSchema/)
})
test('explicit child Agent calls stage both memories and commit only against matching baselines',async()=>{
 const input=workflowNode('input'),save=typedVariableNode('String'),out=workflowNode('return');save.settings.name='seen'
 const child=agent([input,save,out],[edge(input,save,'value'),edge(save,out,'value')]),call=workflowNode('agent'),parentOut=workflowNode('return');call.settings.agentId=child.id;call.settings['port:input']=JSON.stringify('{"input":"child"}')
 const parent=agent([call,parentOut],[edge(call,parentOut,'value')]),workspace={...ws,agents:[parent,child]}
 const result=await runAgent(parent,'',workspace);assert.equal(result.value,'child');assert.equal(result.memoryChanges?.length,2);assert.equal(child.memory,undefined)
 const committed=commitAgentMemory(workspace,result.memoryChanges!);assert.equal((committed.agents![1].memory!.global.seen as any).value,'child')
 const changed={...workspace,agents:[parent,{...child,memory:{global:{other:1}}}]};assert.throws(()=>commitAgentMemory(changed,result.memoryChanges!),/并发/)
 const fail=workflowNode('divide');fail.settings['port:b']='0';fail.inputs.push({name:'after',type:'ANY'});parent.graph.nodes.push(fail);parent.graph.links.push(edge(call,fail,'after'),edge(fail,parentOut,'after'))
 await assert.rejects(runAgent(parent,'',workspace),/除数/);assert.equal(child.memory,undefined)
})
test('model-selected Agents dispatch separately from Tools and propagate nested events',async()=>{
 const parent=conversationAgent('m'),child=conversationAgent('m'),get=typedVariableNode('Agents','get');get.settings.agentId=child.id
 for(const target of parent.graph.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))parent.graph.links.push(edge(get,target,'agents'));parent.graph.nodes.push(get)
 const events:WorkflowEvent[]=[];let requests=0
 const result=await runAgent(parent,'root',{...ws,agents:[parent,child]},undefined,undefined,undefined,{onEvent:e=>{events.push(e)},llmMessage:async(_m,messages,_s,tools)=>{
  requests++;if(messages.at(-1)?.content==='root'){assert.ok(tools?.some(t=>'agentId'in t));return {role:'assistant',content:null,tool_calls:[{id:'child-call',type:'function',function:{name:agentCapability(child).callName!,arguments:'{"input":"child"}'}}]}}
  if(messages.at(-1)?.content==='child')return {role:'assistant',content:'child result'}
  assert.equal(messages.at(-1)?.role,'tool');return {role:'assistant',content:'parent result'}
 }})
 assert.equal(result.value,'parent result');assert.equal(requests,3);assert.equal(result.memoryChanges?.length,2)
 assert.ok(events.some(e=>e.kind==='agent'&&e.agentId===child.id&&!!e.parentInvocationId));assert.ok(events.every(e=>e.runId===events[0].runId))
})
test('recursive Agent calls obey shared depth and call budgets without committing partial memory',async()=>{
 const self=conversationAgent('m'),get=typedVariableNode('Agents','get');get.settings.agentId=self.id;self.graph.nodes.push(get)
 for(const target of self.graph.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))self.graph.links.push(edge(get,target,'agents'))
 self.limits={depth:2,calls:4};let request=0
 await assert.rejects(runAgent(self,'recurse',{...ws,agents:[self]},undefined,undefined,undefined,{llmMessage:async()=>({role:'assistant',content:null,tool_calls:[{id:'r'+(++request),type:'function',function:{name:agentCapability(self).callName!,arguments:'{"input":"recurse"}'}}]})}),/预算|深度|最大轮次/)
 assert.equal(self.memory,undefined)
})
test('chat target migration, interrupted runs, batched events and original-session updates are stable',()=>{
 const world=createWorld('chat'),definition=conversationAgent('m');world.chat.agent=definition.id;world.chat.modelId='m'
 const workspace={...ws,worlds:[world],agents:[definition]};assert.deepEqual(chatTarget(workspace,world.chat),{kind:'agent',id:definition.id})
 world.chat.conversations=[{id:'c',title:'chat',createdAt:0,messages:[{id:'a',role:'assistant',content:'',createdAt:0,run:{id:'r',target:{kind:'agent',id:definition.id},status:'running',events:[]}}]}]
 assert.equal(normalizeChatRuns(workspace).worlds[0].chat.conversations[0].messages[0].run?.status,'interrupted')
 const events=mergeChatEvents([],[{kind:'model',id:'m',state:'running',text:'你',sequence:1},{kind:'model',id:'m',state:'running',text:'好',reasoning:'思考',sequence:2},{kind:'model',id:'m',state:'complete',sequence:3}]);assert.equal(events.length,1);assert.equal(events[0].kind==='model'&&events[0].text,'你好')
 assert.equal(updateChatMessage(workspace,world.id,'c','a',m=>({...m,content:'answer'})).worlds[0].chat.conversations[0].messages[0].content,'answer')
 assert.throws(()=>updateChatMessage(workspace,world.id,'deleted','a',m=>m),/已删除/)
})
test('proposal diff keeps old/new line numbers and collapses unrelated context',()=>{
 const before=Array.from({length:20},(_,i)=>'line '+i).join('\n'),after=before.replace('line 10','changed')
 const diff=lineDiff(before,after);assert.ok(diff.some(l=>l.kind==='remove'&&l.before===11));assert.ok(diff.some(l=>l.kind==='add'&&l.after===11));assert.ok(diff.some(l=>l.kind==='gap'));assert.ok(diff.length<20)
})

test('loop output references mirror per-round current and iteration without suppressing result',async()=>{
 const {definition,loop}=countingLoop();definition.variables={current:{id:'c',type:'Number',value:0},iteration:{id:'i',type:'Number',value:0},result:{id:'r',type:'Number',value:0}}
 for(const [port,id] of [['current','c'],['iteration','i'],['result','r']])definition.graph=bindVariable(definition.graph,definition.variables,loop.id,port,'out',id)
 const output=await runAgent(definition,'',ws);assert.equal(output.value,3)
 assert.deepEqual(Object.fromEntries(Object.entries(output.variables).map(([name,v])=>[name,(v as any).value])),{current:2,iteration:3,result:3})
})

test('mutual A to B to A recursion completes with isolated invocation variables and last-completed memory',async()=>{
 const a=conversationAgent('m'),b=conversationAgent('m')
 for(const [owner,child] of [[a,b],[b,a]]){const get=typedVariableNode('Agents','get');get.settings.agentId=child.id;owner.graph.nodes.push(get);for(const node of owner.graph.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))owner.graph.links.push(edge(get,node,'agents'))}
 const events:WorkflowEvent[]=[];let calls=0
 const workspace={...ws,agents:[a,b]},result=await runAgent(a,'2',workspace,undefined,undefined,undefined,{onEvent:e=>{events.push(e)},llmMessage:async(_m,messages,_s,tools)=>{
  const last=messages.at(-1)!;if(last.role==='tool')return {role:'assistant',content:last.content}
  const count=Number(last.content);return count===0?{role:'assistant',content:'terminal'}:{role:'assistant',content:null,tool_calls:[{id:'mutual-'+(++calls),type:'function',function:{name:tools![0].callName!,arguments:JSON.stringify({input:String(count-1)})}}]}
 }})
 assert.equal(result.value,'terminal');assert.equal(result.memoryChanges?.length,2);assert.equal(new Set(events.filter(e=>e.kind==='agent').map(e=>e.invocationId)).size,3)
 const committed=commitAgentMemory(workspace,result.memoryChanges!),history=(committed.agents![0].memory!.global.history as any).value.items
 assert.equal(history.find((m:any)=>m.role==='user').content,'2');assert.equal(a.memory,undefined)
})

test('shared node budgets are fatal and duplicate Tool and Agent call names fail before requests',async()=>{
 const root=conversationAgent('m',['builtin:list_classes']),child=conversationAgent('m'),get=typedVariableNode('Agents','get');child.callName='universe_list_classes';get.settings.agentId=child.id;root.graph.nodes.push(get);root.graph.links.push(edge(get,root.graph.nodes.find(n=>n.kind==='llmBasic')!,'agents'))
 let requested=false;await assert.rejects(runAgent(root,'test',{...ws,agents:[root,child]},undefined,undefined,undefined,{llmMessage:async()=>{requested=true;return {role:'assistant',content:'bad'}}}),/名称重复/);assert.equal(requested,false)
 const {definition}=countingLoop();definition.limits={nodes:3};await assert.rejects(runAgent(definition,'',ws),/节点预算/)
})

test('cancellation after a child succeeds discards the entire root memory transaction',async()=>{
 const input=workflowNode('input'),out=workflowNode('return'),child=agent([input,out],[edge(input,out,'value')]),root=conversationAgent('m'),get=typedVariableNode('Agents','get');get.settings.agentId=child.id;root.graph.nodes.push(get)
 for(const node of root.graph.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))root.graph.links.push(edge(get,node,'agents'))
 const controller=new AbortController();let n=0
 await assert.rejects(runAgent(root,'test',{...ws,agents:[root,child]},undefined,controller.signal,undefined,{llmMessage:async()=>{if(++n===1)return {role:'assistant',content:null,tool_calls:[{id:'c',type:'function',function:{name:agentCapability(child).callName!,arguments:'{"input":"done"}'}}]};controller.abort();throw new DOMException('cancel','AbortError')}}),/cancel|取消/)
 assert.equal(root.memory,undefined);assert.equal(child.memory,undefined)
})

test('direct model templates expose configured child Agents and keep basic LLM defaults isolated',async()=>{
 const childInput=workflowNode('input'),childOut=workflowNode('return'),child=agent([childInput,childOut],[edge(childInput,childOut,'value')])
 const parent=conversationAgent('m',[],[],'模型直连',[child.id]),workspace={...ws,agents:[child]}
 const result=await runAgent(parent,'root',workspace,undefined,undefined,undefined,{llmMessage:async(_model,messages,_signal,tools)=>{
  assert.equal(tools?.filter(t=>'agentId'in t).length,1)
  if(messages.at(-1)?.role==='tool'){assert.equal(messages.at(-1)?.content,'child answer');return {role:'assistant',content:'最终回复'}}
  return {role:'assistant',content:null,tool_calls:[{id:'child',type:'function',function:{name:agentCapability(child).callName!,arguments:'{"input":"child answer"}'}}]}
 }})
 assert.equal(result.value,'最终回复')
 const isolated=conversationAgent('m')
 await runAgent(isolated,'plain',{...workspace,models:[{...ws.models![0],agentIds:[child.id]}]},undefined,undefined,undefined,{llmMessage:async(_m,_messages,_s,tools)=>{assert.equal(tools?.length,0);return {role:'assistant',content:'独立'}}})
})
