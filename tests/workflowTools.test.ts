import {walkWorkflowNodes} from '../src/model/workflowScopes'
import test from 'node:test'
import assert from 'node:assert/strict'
import {strictValue,typedVariableNode,ToolsValue,invokeValueMember} from '../src/model/workflowValues'
import {workflowNode,workflowNodeTitle,connectWorkflow,createAgent} from '../src/model/workflows'
import {newPoolVariable,poolEntries} from '../src/model/variablePool'
import {runAgent} from '../src/services/workflows'
import {Workspace,uid} from '../src/model/types'
import {createToolUseExample,toolUseExampleInput,installToolUseTemplate} from '../src/model/agentExamples'
import {createWorld} from '../src/model/templates'
import {pairedOutput,bindVariable} from '../src/model/workflowBindings'
import {migrateWorkflowTypes} from '../src/model/workflowMigration'
import {workflowNodeDescription,flowDescriptions} from '../src/model/workflowDescriptions'
const ws:Workspace={worlds:[],activeWorldId:null,models:[{id:'m',name:'m',model:'m',baseUrl:'',apiKey:'',enabled:true}]}
const tool:ToolsValue={type:'Tools',version:1,toolIds:['builtin:list_classes']}
const edge=(from:string,to:string,input:string)=>({id:uid(),from,to,input,output:'value'})

test('tool-use template installs a real Agent once and respects deletion',()=>{
 const installed=installToolUseTemplate(ws)
 assert.equal(installed.agents?.length,1)
 assert.equal(installed.agents?.[0].graph.nodes.filter(n=>n.kind==='llmBasic').every(n=>n.settings.modelId==='m'),true)
 assert.equal(installToolUseTemplate(installed),installed)
 const removed={...installed,agents:[]};assert.equal(installToolUseTemplate(removed),removed)
 assert.equal(ws.agents,undefined)
})

test('response fragments and constructors never pair or overwrite their input bindings',()=>{
 for(const node of [workflowNode('llmBasic'),workflowNode('toolCalls'),typedVariableNode('Tools','get'),typedVariableNode('Image','fromUrl'),typedVariableNode('Image','fromSD')]){
  const input=node.inputs[0];assert.equal(pairedOutput(node,input),undefined)
  const type=node.settings.variableType||'Messages',value=type==='Tools'?tool:type==='Image'?{type:'Image',version:1,url:''}:{type:'Messages',version:1,items:[]}
  const variables={source:{id:'source-id',type,value}}
  const bound=bindVariable({version:1,nodes:[node],links:[]},variables,node.id,input.name,'in','source-id')
  assert.equal(bound.nodes[0].bindings?.[`in:${input.name}`].output,undefined)
  const old={...node,bindings:{[`in:${input.name}`]:{variableId:'source-id',name:'source',output:'value'},'out:value':{variableId:'result-id',name:'result'}}}
  const migrated=migrateWorkflowTypes(old)
  assert.equal(migrated.bindings[`in:${input.name}`].output,undefined)
  assert.deepEqual(migrated.bindings['out:value'],old.bindings['out:value'])
 }
 const append=typedVariableNode('Messages','user');assert.equal(pairedOutput(append,append.inputs[0]),'value')
 for(const node of createToolUseExample().graph.nodes)assert.ok(workflowNodeDescription(node))
 assert.ok(Object.values(flowDescriptions).every(Boolean))
})
test('node names are fixed by type even for previously customized example titles',()=>{
 const example=createToolUseExample()
 const variables=walkWorkflowNodes(example.graph).filter(n=>n.kind==='variable')
 assert.equal(variables.filter(n=>n.title==='Messages 变量').length,5);assert.equal(variables.filter(n=>n.title==='Tools 变量').length,1)
 variables[0].title='读取历史'
 assert.equal(workflowNodeTitle(variables[0]),'Messages 变量')
 const llm=workflowNode('llm');llm.title='自定义名称';assert.equal(workflowNodeTitle(llm),'LLM 模型（自动 ToolCalls）')
 const member=typedVariableNode('Tools','get');member.title='查询世界';assert.equal(workflowNodeTitle(member),'Tools · 获取 Tool')
})
test('built-in Agent example completes ToolUse and preserves paired messages across runs',async()=>{
 const world=createWorld('示例世界'),example=createToolUseExample('m'),before=JSON.stringify(example)
 assert.equal(walkWorkflowNodes(example.graph).filter(n=>n.kind==='llmBasic').length,1)
 assert.equal(walkWorkflowNodes(example.graph).filter(n=>n.kind==='toolCalls').length,1)
 assert.equal(walkWorkflowNodes(example.graph).some(n=>n.kind==='llm'),false)
 let round=0
 const first=await runAgent(example,toolUseExampleInput,ws,world,undefined,undefined,{llmMessage:async(_model,messages,_signal,tools)=>{
  if(round++===0){assert.deepEqual(tools?.map(t=>t.id),['builtin:list_classes']);assert.equal(messages.at(-1)?.content,toolUseExampleInput);return {role:'assistant',content:null,tool_calls:[{id:'example-call',type:'function',function:{name:'universe_list_classes',arguments:'{}'}}]}}
  assert.equal(messages.at(-1)?.role,'tool');assert.equal(messages.at(-1)?.tool_call_id,'example-call');assert.ok(messages.at(-1)?.content?.includes(world.documents[0].name))
  assert.deepEqual(tools?.map(t=>t.id),['builtin:list_classes'])
  return {role:'assistant',content:'已查询类名'}
 }})
 assert.equal(first.value,'已查询类名');assert.equal(JSON.stringify(example),before)
 const saved=first.variables.toolUseHistory as any
 assert.equal(saved.type,'Messages');assert.deepEqual(saved.value.items.map((m:any)=>m.role),['system','user','assistant','tool','assistant'])
 let nextRound=0;const second=await runAgent({...example,memory:{[world.id]:first.variables}},'继续',ws,world,undefined,undefined,{llmMessage:async(_m,messages)=>{assert.equal(messages.filter(m=>m.role==='tool').length,1);if(nextRound++===0)assert.equal(messages.at(-1)?.content,'继续');return {role:'assistant',content:'保留历史'}}})
 assert.equal((second.variables.toolUseHistory as any).value.items.length,7)
 await assert.rejects(runAgent({...example,memory:{[world.id]:first.variables}},'失败',ws,world,undefined,undefined,{llmMessage:async()=>{throw new Error('模拟失败')}}),/模拟失败/)
 assert.equal(saved.value.items.length,5)
 assert.notEqual(createToolUseExample().id,example.id)
})
test('Tool is a strict serializable type and cannot be replaced with ANY or raw definitions',()=>{
 assert.deepEqual(strictValue('Tools',tool),tool);assert.notEqual(strictValue('Tools',tool),tool)
 for(const bad of ['builtin:list_classes',{},[],{id:'tool'},{type:'Tools',version:1,toolIds:['a','a']},{type:'Tools',version:1,toolIds:[1]}])assert.throws(()=>strictValue('Tools',bad),/Tool/)
 assert.throws(()=>newPoolVariable({},'ANY' as any),/ANY/);assert.throws(()=>typedVariableNode('ANY' as any),/ANY/)
 const variable=typedVariableNode('Tools'),llm=workflowNode('llm'),string=typedVariableNode('String'),any=workflowNode('constant')
 assert.equal(variable.inputs[0].type,'TOOLS');assert.equal(workflowNode('tool').inputs.find(p=>p.name==='tool')?.type,'TOOLS')
 assert.throws(()=>connectWorkflow({version:1,nodes:[string,llm],links:[]},{from:string.id,to:llm.id,input:'tools',output:'value'}),/类型/)
 assert.throws(()=>connectWorkflow({version:1,nodes:[any,llm],links:[]},{from:any.id,to:llm.id,input:'tools',output:'value'}),/类型/)
 assert.equal(connectWorkflow({version:1,nodes:[variable,llm],links:[]},{from:variable.id,to:llm.id,input:'tools',output:'value'}).links.length,1)
 const pool=newPoolVariable({},'Tools');assert.equal(poolEntries(JSON.parse(JSON.stringify(pool.variables)))[0].type,'Tools')
})
test('Tool methods return new values and persist only through an explicit variable value input',async()=>{
 const get=typedVariableNode('Tools','get'),out=workflowNode('return');get.settings.toolId=tool.toolIds[0]
 const agent={...createAgent(),variables:{chosen:{type:'Tools',value:{type:'Tools',version:1,toolIds:[]}}},graph:{version:1 as const,nodes:[get,out],links:[edge(get.id,out.id,'value')]}}
 const read=await runAgent(agent,'',ws);assert.deepEqual(read.value,tool);assert.deepEqual((read.variables.chosen as any).value.toolIds,[])
 const write=typedVariableNode('Tools');write.settings.name='chosen';agent.graph={version:1,nodes:[get,write,out],links:[edge(get.id,write.id,'value'),edge(write.id,out.id,'value')]}
 const saved=await runAgent(agent,'',ws);assert.deepEqual((saved.variables.chosen as any).value,tool);assert.deepEqual((agent.variables.chosen as any).value.toolIds,[])
 const merged:any=await invokeValueMember('Tools','merge',tool,{type:'Tools',version:1,toolIds:['builtin:list_instances',...tool.toolIds]},{});assert.equal(merged.toolIds.length,2);assert.equal(tool.toolIds.length,1)
})
test('typed Tool call accepts JSON text and returns text; stale refs and failures do not commit memory',async()=>{
 const get=typedVariableNode('Tools','get'),call=workflowNode('tool'),out=workflowNode('return');get.settings.toolId='custom';call.settings['port:input']=JSON.stringify('{"q":"ok"}')
 const config={...ws,tools:[{id:'custom',name:'test',url:'https://test.invalid',method:'POST' as const,bodyMode:'raw' as const,apiKey:'',enabled:true}]}
 const agent={...createAgent(),graph:{version:1 as const,nodes:[get,call,out],links:[edge(get.id,call.id,'tool'),edge(call.id,out.id,'value')]}}
 const result=await runAgent(agent,'',config,undefined,undefined,undefined,{http:async r=>{assert.deepEqual(r.body,{q:'ok'});return {answer:1}}});assert.equal(typeof result.value,'string');assert.deepEqual(JSON.parse(result.value as string),{answer:1})
 config.tools[0].enabled=false;await assert.rejects(runAgent(agent,'',config),/停用/)
 config.tools[0].enabled=true;call.settings['port:input']=JSON.stringify('invalid');const initial=JSON.stringify(agent);await assert.rejects(runAgent(agent,'',config),/JSON/);assert.equal(JSON.stringify(agent),initial)
 const duplicate=typedVariableNode('String');duplicate.settings.name='same';const t=typedVariableNode('Tools');t.settings.name='same';await assert.rejects(runAgent({...agent,graph:{version:1,nodes:[duplicate,t,out],links:[]}},'',ws),/不同类型/)
})
test('LLM receives only Tools carried by the TOOL input and validates the model exchange',async()=>{
 const get=typedVariableNode('Tools','get'),llm=workflowNode('llm'),out=workflowNode('return');get.settings.toolId='builtin:list_classes';llm.settings.modelId='m';llm.settings['port:prompt']=JSON.stringify('列出类')
 const agent={...createAgent(),graph:{version:1 as const,nodes:[get,llm,out],links:[edge(get.id,llm.id,'tools'),edge(llm.id,out.id,'value')]}}
 const result=await runAgent(agent,'',ws,undefined,undefined,undefined,{llmMessage:async(_model,_messages,_signal,tools)=>{assert.equal(tools?.[0].id,'builtin:list_classes');return {role:'assistant',content:'完成'}}});assert.equal(result.value,'完成')
})
