import test from 'node:test'
import assert from 'node:assert/strict'
import {workflowNode,createAgent,connectWorkflow,validateWorkflow} from '../src/model/workflows'
import {typedVariableNode,strictValue} from '../src/model/workflowValues'
import {bindVariable,unbindVariable} from '../src/model/workflowBindings'
import {deletePoolVariable,clearPoolValues,editPoolVariable,reconcilePoolMemory,movePoolVariable,orderPoolEntries} from '../src/model/variablePool'
import {runAgent} from '../src/services/workflows'
import {createWorld} from '../src/model/templates'
import {migrateWorkflowTypes} from '../src/model/workflowMigration'
import {Workspace,WorkflowGraph,uid} from '../src/model/types'
const ws:Workspace={worlds:[],activeWorldId:null,models:[{id:'m',name:'test',enabled:true,baseUrl:'',model:'mock',apiKey:''}]}
const link=(from:string,to:string,input:string,output='value')=>({id:uid(),from,to,input,output})
test('reference bindings read, write and pair values without mutating initial memory',async()=>{
 const upper=typedVariableNode('String','upper'),length=typedVariableNode('String','length'),out=workflowNode('return')
 const variables={text:{id:'text-id',type:'String',value:'hello'},count:{id:'count-id',type:'Number',value:0}}
 let graph:WorkflowGraph={version:1,nodes:[upper,length,out],links:[link(upper.id,length.id,'self'),link(length.id,out.id,'value')]}
 graph=bindVariable(graph,variables,upper.id,'self','in','text-id');assert.equal(graph.nodes[0].bindings?.['in:self'].output,'value')
 graph=bindVariable(graph,variables,length.id,'value','out','count-id');assert.throws(()=>bindVariable(graph,variables,length.id,'self','in','count-id'),/变量为 Number/)
 const agent={...createAgent(),graph,variables},before=JSON.stringify(agent),result=await runAgent(agent,'',ws)
 assert.equal(result.value,5);assert.equal((result.variables.text as any).value,'HELLO');assert.equal((result.variables.count as any).value,5);assert.equal(JSON.stringify(agent),before)
 const renamed=editPoolVariable(graph,variables,'text',{name:'renamed'});assert.equal(renamed.graph.nodes[0].bindings?.['in:self'].name,'renamed')
 const wired=connectWorkflow(graph,{from:upper.id,output:'value',to:length.id,input:'self'});assert.equal(wired.nodes[1].bindings?.['in:self'],undefined)
 assert.equal(unbindVariable(graph,upper.id,'in:self').nodes[0].bindings?.['in:self'],undefined)
 const fail=workflowNode('divide');fail.settings['port:b']='0'
 const failed={...agent,graph:{...graph,nodes:[...graph.nodes,fail],links:[...graph.links.filter(l=>l.to!==out.id),link(upper.id,fail.id,'after'),link(fail.id,out.id,'value')]}}
 // A completed reference write remains local when a later node fails.
 fail.inputs.push({name:'after',type:'ANY'});await assert.rejects(runAgent(failed,'',ws),/除数/);assert.equal(JSON.stringify(agent),before)
})
test('pool clear, delete and order reconcile persisted references and scoped memory',()=>{
 const variable=typedVariableNode('String');variable.settings.name='a';variable.settings.variableId='a-id'
 const method=typedVariableNode('String','upper'),out=workflowNode('return'),variables={a:{id:'a-id',type:'String',value:'original'},b:{id:'b-id',type:'Number',value:3}}
 let graph:WorkflowGraph={version:1,nodes:[variable,method,out],links:[link(variable.id,out.id,'value')]};graph=bindVariable(graph,variables,method.id,'self','in','a-id')
 assert.deepEqual(orderPoolEntries(movePoolVariable(graph,variables,'b-id','a-id'),variables).map(e=>e.name),['b','a'])
 const cleared=clearPoolValues(variables,'a');assert.equal((cleared.a as any).value,'');assert.equal((cleared.b as any).value,3)
 const memory={w:{a:{id:'a-id',type:'String',value:'runtime'},b:{id:'b-id',type:'Number',value:8}}}
 assert.equal((reconcilePoolMemory(variables,cleared,memory)!.w.a as any).value,'')
 const initiallyEmpty={a:{id:'a-id',type:'String',value:''}}
 assert.equal((reconcilePoolMemory(initiallyEmpty,initiallyEmpty,memory,['a'])!.w.a as any).value,'')
 const deleted=deletePoolVariable(graph,variables,'a');assert.equal(deleted.graph.nodes.some(n=>n.id===variable.id),false);assert.equal(deleted.graph.nodes.find(n=>n.id===method.id)?.bindings?.['in:self'],undefined);assert.equal(deleted.graph.links.length,0)
 assert.equal(reconcilePoolMemory(variables,deleted.variables,memory)!.w.a,undefined)
})
test('basic LLM and ToolCalls execute separately and merge paired tool results',async()=>{
 const first=workflowNode('llmBasic'),calls=workflowNode('toolCalls'),merge=typedVariableNode('Messages','merge'),second=workflowNode('llmBasic'),out=workflowNode('return'),world=createWorld('工具世界')
 const tools={type:'Tools',version:1,toolIds:['builtin:list_classes']};first.settings={modelId:'m','port:messages':JSON.stringify({type:'Messages',version:1,items:[{role:'system',content:'only explicit system'},{role:'user',content:'查询类名'}]}),'port:tools':JSON.stringify(tools)};second.settings.modelId='m';calls.settings['port:tools']=JSON.stringify(tools)
 const agent={...createAgent(),graph:{version:1 as const,nodes:[first,calls,merge,second,out],links:[link(first.id,calls.id,'messages'),link(first.id,merge.id,'self'),link(calls.id,merge.id,'arg'),link(merge.id,second.id,'messages'),link(second.id,out.id,'value')]}}
 let requests=0
 const result=await runAgent(agent,'',ws,world,undefined,undefined,{llmMessage:async(_m,messages,_s,available)=>{
  if(requests++===0){assert.equal(messages[0].content,'only explicit system');assert.deepEqual(available?.map(t=>t.id),tools.toolIds);return {role:'assistant',content:null,tool_calls:[{id:'c1',type:'function',function:{name:'universe_list_classes',arguments:'{}'}}]}}
  assert.equal(available?.length,0);assert.deepEqual(messages.map(m=>m.role),['assistant','tool']);assert.equal(messages[1].tool_call_id,'c1');assert.ok(messages[1].content?.includes(world.documents[0].name));return {role:'assistant',content:'工具完成'}
 }})
 assert.equal(requests,2);assert.equal((result.value as any).items[0].content,'工具完成')
 const fragment=result.trace.find(t=>t.id===calls.id)!.value as any;assert.equal(fragment.fragment,'toolResults');assert.deepEqual(fragment.items.map((m:any)=>m.role),['tool']);strictValue('Messages',fragment)
 first.settings.modelId='m';assert.equal(first.outputs[0].type,'MESSAGES');assert.equal(first.inputs.some(p=>p.name==='prompt'),false)
})
test('legacy Tool values and ports migrate without altering user world text',()=>{
 const node=typedVariableNode('Tools');node.settings.variableType='Tool';node.inputs[0].type='TOOL';node.outputs[0].type='TOOL'
 const agent={...createAgent(),graph:{version:1 as const,nodes:[node],links:[]},variables:{tools:{type:'Tool',value:{type:'Tool',version:1,toolIds:[]}}}}
 const next=migrateWorkflowTypes(agent);validateWorkflow(next.graph);assert.equal(next.graph.nodes[0].inputs[0].type,'TOOLS');assert.equal(next.graph.nodes[0].settings.variableType,'Tools');assert.equal(next.variables.tools.type,'Tools');assert.equal(agent.variables.tools.type,'Tool')
})
