import {newScopeGraph,walkWorkflowNodes} from '../src/model/workflowScopes'
import {defaultVariable,MethodValue} from '../src/model/workflowValues'
import {newPoolVariable,editPoolVariable,deletePoolVariable} from '../src/model/variablePool'
import {graphFragment,pasteGraphFragment,removeGraphSelection} from '../src/model/graphEditing'
import test from 'node:test'
import assert from 'node:assert/strict'
import {AgentDefinition,WorkflowGraph,WorkflowNode,Workspace,uid} from '../src/model/types'
import {configureControl,configureSequence} from '../src/model/workflowControl'
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
 const loop=workflowNode('loop'),read=typedVariableNode('Number'),add=typedVariableNode('Number','add'),save=typedVariableNode('Number'),less=typedVariableNode('Number','less'),final=typedVariableNode('Number'),out=workflowNode('return')
 for(const n of [read,save,final])n.settings={...n.settings,name:'count',variableId:'count'}
 add.settings['port:arg']='1';less.settings['port:arg']='3';loop.settings.repeat='3'
 const again=loop.body!.nodes.find(n=>n.kind==='continue')!
 loop.body!.nodes.push(read,add,save,less);loop.body!.links.push(edge(read,add,'self'),edge(add,save,'value'),edge(save,less,'self'),edge(less,again,'condition'))
 return {loop,add,save,less,final,out,definition:agent([loop,final,out],[edge(loop,final,'after'),edge(final,out,'value')],{count:{id:'count',type:'Number',value:0}})}
}
test('contained loop resets round caches, defaults to one pass, and repeat is a hard limit',async()=>{
 const {definition,loop}=countingLoop(),events:WorkflowEvent[]=[]
 const result=await runAgent(definition,'',ws,undefined,undefined,undefined,{runId:'persisted-run',onEvent:e=>{events.push(e)}})
 assert.equal(result.value,3);assert.equal(result.trace.filter(t=>t.title==='Number · 增加').length,3)
 assert.ok(events.every(e=>e.runId==='persisted-run'));assert.equal(new Set(result.trace.filter(t=>t.title==='Number · 增加').map(t=>t.frame)).size,3)
 loop.settings.repeat='2';assert.equal((await runAgent(definition,'',ws)).value,2)
 loop.settings.repeat='1';assert.equal((await runAgent(definition,'',ws)).value,1)
})
test('nested contained loops share the pool but have independent fresh iteration caches',async()=>{
 const {definition,loop}=countingLoop(),outer=workflowNode('loop');outer.settings.repeat='2';loop.settings.repeat='2'
 loop.body!.links=loop.body!.links.filter(e=>e.to!==loop.body!.nodes.find(n=>n.kind==='continue')!.id)
 // Remove the unused comparison: ordinary leaf tasks are now always executed.
 loop.body!.nodes=loop.body!.nodes.filter(n=>n.kind!=='valueMethod'||n.settings.member!=='less');loop.body!.links=loop.body!.links.filter(e=>loop.body!.nodes.some(n=>n.id===e.to))
 outer.body!.nodes.push(loop);definition.graph.nodes=definition.graph.nodes.map(n=>n.id===loop.id?outer:n);definition.graph.links=definition.graph.links.map(e=>e.from===loop.id?{...e,from:outer.id}:e)
 const result=await runAgent(definition,'',ws);assert.equal(result.value,4);assert.equal(new Set(result.trace.filter(t=>t.title==='Number · 增加').map(t=>t.frame)).size,4)
})
test('break bypasses continue dependencies, false continue exits, and backedges are rejected',async()=>{
 const {definition,loop}=countingLoop(),stop=loop.body!.nodes.find(n=>n.kind==='break')!,again=loop.body!.nodes.find(n=>n.kind==='continue')!,bad=workflowNode('divide')
 stop.settings['port:condition']='true';bad.settings['port:b']='0';bad.outputs[0].type='BOOLEAN'
 loop.body!.nodes.push(bad);loop.body!.links=loop.body!.links.filter(e=>e.to!==again.id);loop.body!.links.push(edge(bad,again,'condition'))
 const result=await runAgent(definition,'',ws);assert.equal(result.value,1);assert.equal(result.trace.some(t=>t.id===bad.id||t.id===again.id),false)
 loop.body!.nodes=loop.body!.nodes.filter(n=>n.id!==bad.id);loop.body!.links=loop.body!.links.filter(e=>e.from!==bad.id);stop.settings['port:condition']='false';again.settings['port:condition']='false';assert.equal((await runAgent(definition,'',ws)).value,1)
 loop.settings.repeat='0';await assert.rejects(runAgent(definition,'',ws),/repeat/)
 const a=workflowNode('concat'),b=workflowNode('concat');assert.throws(()=>validateWorkflow({version:1,nodes:[a,b],links:[edge(a,b,'a'),edge(b,a,'a')]}),/无环|回边/)
 const old={...workflowNode('loop'),body:undefined};assert.throws(()=>validateWorkflow({version:1,nodes:[old],links:[]}),/旧循环/)
})
test('all leaves finish before return, shared ancestors run once, and condition inputs go first',async()=>{
 const a=typedVariableNode('Number'),b=typedVariableNode('Number'),out=workflowNode('return'),shared=workflowNode('constant');shared.settings={value:'7',valueType:'json'};a.settings.name='a';b.settings.name='b'
 const result=await runAgent(agent([out,a,b,shared],[edge(shared,a,'value'),edge(shared,b,'value')]),'',ws)
 assert.equal((result.variables.a as any).value,7);assert.equal((result.variables.b as any).value,7);assert.equal(result.trace.at(-1)?.id,out.id);assert.equal(result.trace.filter(t=>t.id===shared.id).length,1)
 const first=workflowNode('constant'),second=workflowNode('constant'),ordinary=workflowNode('concat');first.settings.value='condition';second.settings.value='body';ordinary.inputs=[{name:'a',type:'ANY'},{name:'conditionExtra',type:'ANY'}]
 const run=await runAgent(agent([out,ordinary,first,second],[edge(second,ordinary,'a'),edge(first,ordinary,'conditionExtra')]),'',ws)
 assert.ok(run.trace.findIndex(t=>t.id===first.id)<run.trace.findIndex(t=>t.id===second.id))
})
test('sequence waits for numbered branches even when only the first output is consumed',async()=>{
 const first=typedVariableNode('String'),second=typedVariableNode('String'),third=typedVariableNode('String'),sequence=configureSequence(workflowNode('sequence'),3),out=workflowNode('return')
 for(const [i,n] of [first,second,third].entries()){n.settings.name='item'+i;n.settings['port:value']=JSON.stringify('value'+i)}
 const result=await runAgent(agent([out,third,second,first,sequence],[edge(first,sequence,'branch1'),edge(second,sequence,'branch2'),edge(third,sequence,'branch3'),edge(sequence,out,'value','branch1')]),'',ws)
 assert.equal(result.value,'value0');assert.deepEqual(result.trace.filter(t=>[first.id,second.id,third.id].includes(t.id)).map(t=>t.id),[first.id,second.id,third.id]);assert.equal((result.variables.item2 as any).value,'value2')
})
test('Method variables execute a shared pool body without arguments and preserve the control value',async()=>{
 const call=typedVariableNode('Method'),input=workflowNode('input'),out=workflowNode('return'),write=typedVariableNode('Number'),method=defaultVariable('Method') as MethodValue
 call.settings={variableType:'Method',name:'task',variableId:'task'};write.settings.name='result';write.settings['port:value']='42';method.graph.nodes.push(write)
 const definition=agent([input,call,out],[edge(input,call,'value'),edge(call,out,'value')],{task:{id:'task',type:'Method',value:method}})
 const result=await runAgent(definition,'control',ws);assert.equal(result.value,'control');assert.equal((result.variables.result as any).value,42);assert.equal(result.trace.find(t=>t.id===method.graph.nodes[0].id)?.value,undefined)
 const recursive=typedVariableNode('Method');recursive.settings={...call.settings};method.graph.nodes.push(recursive);await assert.rejects(runAgent(definition,'control',ws),/方法调用深度/)
 assert.equal(definition.memory,undefined)
})
test('loop and Method ANY bridges preserve object identity and cancellation discards scoped writes',async()=>{
 const source=workflowNode('input'),loop=workflowNode('loop'),call=workflowNode('method'),out=workflowNode('return'),method=defaultVariable('Method') as MethodValue
 source.outputs=[{name:'value',type:'ANY'}];call.settings={variableType:'Method',name:'task',variableId:'task'}
 const definition=agent([source,loop,call,out],[edge(source,loop,'value'),edge(loop,call,'value'),edge(call,out,'value')],{task:{id:'task',type:'Method',value:method}})
 definition.inputSchema={type:'object',properties:{input:{type:'object'}},required:['input']}
 const result=await runAgent(definition,{input:{nested:['unchanged']}},ws)
 assert.equal(result.value,result.trace.find(t=>t.id===source.id)!.value);assert.equal(result.trace.find(t=>t.id===loop.id)!.value,result.value);assert.equal(result.trace.find(t=>t.id===call.id)!.value,result.value)
 const write=typedVariableNode('Number');write.settings.name='count';write.settings['port:value']='1';loop.body!.nodes.push(write)
 const controller=new AbortController();await assert.rejects(runAgent(definition,{input:{}},ws,undefined,controller.signal,undefined,{onEvent:e=>{if(e.kind==='node'&&e.id===write.id&&e.state==='complete')controller.abort()}}),/取消/)
 assert.equal(definition.memory,undefined);assert.equal(Object.hasOwn(definition.variables,'count'),false)
})
test('scoped terminals stay protected and loop copies receive distinct internal identities',()=>{
 const scope=newScopeGraph('loop');assert.equal(removeGraphSelection(scope,scope.nodes.map(n=>n.id),[]).nodes.length,2)
 const loop=workflowNode('loop'),root={version:1 as const,nodes:[loop],links:[]},copy=pasteGraphFragment(root,graphFragment(root,[loop.id])).graph
 assert.notEqual(copy.nodes[0].body!.nodes[0].id,copy.nodes[1].body!.nodes[0].id);validateWorkflow(copy)
 const method=defaultVariable('Method') as MethodValue,reader=typedVariableNode('Number');reader.settings={...reader.settings,name:'count',variableId:'count'};method.graph.nodes.push(reader);loop.body!.nodes.push(structuredClone(reader));loop.body!.nodes.at(-1)!.id=uid()
 const vars={task:{id:'task',type:'Method',value:method},count:{id:'count',type:'Number',value:1}},renamed=editPoolVariable(root,vars,'count',{name:'renamed'})
 assert.equal(walkWorkflowNodes(renamed.graph).find(n=>n.kind==='variable')!.settings.name,'renamed');assert.equal((renamed.variables.task as any).value.graph.nodes.find((n:WorkflowNode)=>n.kind==='variable').settings.name,'renamed')
 const deleted=deletePoolVariable(renamed.graph,renamed.variables,'renamed');assert.equal(walkWorkflowNodes(deleted.graph).some(n=>n.kind==='variable'),false)
 assert.equal((deleted.variables.task as any).value.graph.nodes.some((n:WorkflowNode)=>n.kind==='variable'),false)
 assert.equal(newPoolVariable({},'Method').variables.method1!==undefined,true)
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
 const body=parent.graph.nodes.find(n=>n.kind==='loop')!.body!;for(const target of body.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))body.links.push(edge(get,target,'agents'));body.nodes.push(get)
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
 const self=conversationAgent('m'),get=typedVariableNode('Agents','get');get.settings.agentId=self.id;self.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.push(get)
 for(const target of self.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))self.graph.nodes.find(n=>n.kind==='loop')!.body!.links.push(edge(get,target,'agents'))
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

test('mutual A to B to A recursion completes with isolated invocation variables and last-completed memory',async()=>{
 const a=conversationAgent('m'),b=conversationAgent('m')
 for(const [owner,child] of [[a,b],[b,a]]){const get=typedVariableNode('Agents','get');get.settings.agentId=child.id;owner.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.push(get);for(const node of owner.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))owner.graph.nodes.find(n=>n.kind==='loop')!.body!.links.push(edge(get,node,'agents'))}
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
 const root=conversationAgent('m',['builtin:list_classes']),child=conversationAgent('m'),get=typedVariableNode('Agents','get');child.callName='universe_list_classes';get.settings.agentId=child.id;root.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.push(get);root.graph.nodes.find(n=>n.kind==='loop')!.body!.links.push(edge(get,root.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.find(n=>n.kind==='llmBasic')!,'agents'))
 let requested=false;await assert.rejects(runAgent(root,'test',{...ws,agents:[root,child]},undefined,undefined,undefined,{llmMessage:async()=>{requested=true;return {role:'assistant',content:'bad'}}}),/名称重复/);assert.equal(requested,false)
 const {definition}=countingLoop();definition.limits={nodes:3};await assert.rejects(runAgent(definition,'',ws),/节点预算/)
})

test('cancellation after a child succeeds discards the entire root memory transaction',async()=>{
 const input=workflowNode('input'),out=workflowNode('return'),child=agent([input,out],[edge(input,out,'value')]),root=conversationAgent('m'),get=typedVariableNode('Agents','get');get.settings.agentId=child.id;root.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.push(get)
 for(const node of root.graph.nodes.find(n=>n.kind==='loop')!.body!.nodes.filter(n=>n.kind==='llmBasic'||n.kind==='toolCalls'))root.graph.nodes.find(n=>n.kind==='loop')!.body!.links.push(edge(get,node,'agents'))
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
