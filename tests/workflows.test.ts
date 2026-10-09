import test from 'node:test'
import assert from 'node:assert/strict'
import { agentGraph, comfyNode, connectWorkflow, createAgent, createSDWorkflow, importComfyPrompt, validateWorkflow, workflowNode, type ComfyCatalog } from '../src/model/workflows'
import { WorkflowGraph, Workspace, uid } from '../src/model/types'
import { compileComfyPrompt, runAgent, runSDWorkflow } from '../src/services/workflows'
import { apiEndpoint } from '../src/services/modelHttp'
import { callLLM, discoverModels, llmBody } from '../src/services/llm'
import { createWorld } from '../src/model/templates'
import { normalizeWorkspace } from '../src/model/themes'

const workspace:Workspace={worlds:[],activeWorldId:null,models:[{id:'llm',name:'Test',model:'test',baseUrl:'https://test.invalid/v1',apiKey:'',enabled:true}]}
const catalog:ComfyCatalog={Text:{input:{required:{text:['STRING',{default:''}]}},output:['STRING']},Save:{input:{required:{images:['IMAGE']}},output:[]}}
const link=(from:string,to:string,input:string,output='value')=>({id:uid(),from,to,input,output})

test('workflow rejects cycles and invalid ports before execution',()=>{
  const a=workflowNode('concat'),b=workflowNode('concat'),graph:WorkflowGraph={version:1,nodes:[a,b],links:[link(a.id,b.id,'a')]}
  assert.throws(()=>connectWorkflow(graph,{from:b.id,output:'value',to:a.id,input:'a'}),/循环/)
  assert.throws(()=>connectWorkflow(graph,{from:a.id,output:'missing',to:b.id,input:'a'}),/端口/)
})
test('agent executes shared LLM source once and commits only its local variables',async()=>{
  const agent=createAgent(),graph=agentGraph(),input=graph.nodes[0],llm=graph.nodes[1],out=graph.nodes[2],set=workflowNode('setVariable');llm.settings.modelId='llm';set.settings.name='last'
  agent.graph={...graph,nodes:[input,llm,set,out],links:[...graph.links,link(llm.id,set.id,'value'),link(set.id,out.id,'after')]}
  let calls=0
  const output=await runAgent(agent,'hello',workspace,undefined,undefined,undefined,{llm:async(_,messages)=>{calls++;assert.deepEqual(messages,[{role:'user',content:'hello'}]);return 'answer'}})
  assert.equal(calls,1);assert.equal(output.value,'answer');assert.equal(output.variables.last,'answer');assert.deepEqual(agent.variables,{})
})
test('explicit context uses scoped history and no hidden LLM state',async()=>{
  const agent=createAgent(),input=workflowNode('input'),get=workflowNode('getVariable'),context=workflowNode('context'),llm=workflowNode('llm'),out=workflowNode('return');llm.settings={modelId:'llm',systemPrompt:'write'};context.settings.limit='2'
  agent.variables={context:[{role:'user',content:'old'},{role:'assistant',content:'old answer'},{role:'user',content:'latest'}]}
  agent.graph={version:1,nodes:[input,get,context,llm,out],links:[link(get.id,context.id,'history'),link(input.id,context.id,'prompt'),link(context.id,llm.id,'context'),link(llm.id,out.id,'value')]}
  await runAgent(agent,'new',workspace,undefined,undefined,undefined,{llm:async(_,messages)=>{assert.deepEqual(messages.map(m=>m.content),['write','old answer','latest','new']);return 'ok'}})
})
test('after edge orders variable writes before reads and failures do not mutate saved variables',async()=>{
  const agent=createAgent(),constant=workflowNode('constant'),set=workflowNode('setVariable'),get=workflowNode('getVariable'),out=workflowNode('return');constant.settings.value='updated';set.settings.name=get.settings.name='x';agent.variables={x:'old'}
  agent.graph={version:1,nodes:[constant,set,get,out],links:[link(constant.id,set.id,'value'),link(set.id,get.id,'after'),link(get.id,out.id,'value')]}
  assert.equal((await runAgent(agent,'',workspace)).value,'updated');assert.equal(agent.variables.x,'old')
  const divide=workflowNode('divide');divide.settings['port:b']='0';agent.graph={...agent.graph,nodes:[...agent.graph.nodes,divide],links:[...agent.graph.links,link(divide.id,out.id,'after')]}
  await assert.rejects(()=>runAgent(agent,'',workspace),/除数/);assert.equal(agent.variables.x,'old')
})
test('Comfy prompt preprocesses host input and keeps native node output references',async()=>{
  const workflow=createSDWorkflow(),input=workflowNode('input'),text=comfyNode('Text',catalog.Text),save=comfyNode('Save',catalog.Save)
  workflow.graph={version:1,nodes:[input,text,save],links:[link(input.id,text.id,'text'),link(text.id,save.id,'images','out0')]}
  const prompt=await compileComfyPrompt(workflow,'draw a tree',workspace) as any
  assert.deepEqual(Object.keys(prompt),[text.id,save.id]);assert.equal(prompt[text.id].inputs.text,'draw a tree');assert.deepEqual(prompt[save.id].inputs.images,[text.id,0])
})
test('world node reads existing stable instance identity before Comfy submission',async()=>{
  const world=createWorld('fixture'),doc=world.documents.find(d=>d.id==='people')!;doc.entities=[{id:'person',name:'测试人物',fields:[]}]
  const workflow=createSDWorkflow(),host=workflowNode('world'),text=comfyNode('Text',catalog.Text);host.object={classId:'people',entityId:'person',path:[]}
  workflow.graph={version:1,nodes:[host,text],links:[link(host.id,text.id,'text')]}
  const prompt=await compileComfyPrompt(workflow,'',workspace,world) as any
  assert.match(prompt[text.id].inputs.text,/测试人物/)
})
test('Comfy API import preserves default literals and connections; missing installations are explicit',()=>{
  const graph=importComfyPrompt({'1':{class_type:'Text',inputs:{text:'hello'}},'2':{class_type:'Save',inputs:{images:['1',0]}}},catalog)
  validateWorkflow(graph);assert.equal(graph.nodes[0].settings['port:text'],'"hello"');assert.equal(graph.links[0].output,'out0')
  assert.throws(()=>importComfyPrompt({'1':{class_type:'Missing',inputs:{}}},catalog),/未安装/)
  assert.throws(()=>importComfyPrompt({nodes:[]},catalog),/API 格式/)
})
test('Comfy submit/history returns image descriptors and surfaces server errors',async()=>{
  const workflow=createSDWorkflow(),text=comfyNode('Text',catalog.Text);workflow.graph={version:1,nodes:[text],links:[]}
  const calls:string[]=[]
  const http:any=async(request:any)=>{calls.push(request.url);return request.method==='POST'?{prompt_id:'job'}:{job:{status:{completed:true},outputs:{'1':{images:[{filename:'x.png',subfolder:'folder',type:'output'}]}}}}}
  const result=await runSDWorkflow(workflow,'',workspace,undefined,undefined,undefined,{http})
  assert.equal(calls.length,2);assert.match(result[0].url,/view\?filename=x.png/)
  await assert.rejects(()=>runSDWorkflow(workflow,'',workspace,undefined,undefined,undefined,{http:async()=>({error:'bad node'}) as any}),/bad node/)
})
test('LLM URLs normalize complete endpoints and optional parameters remain optional',()=>{
  assert.equal(apiEndpoint('http://localhost:11434/v1/chat/completions','models'),'http://localhost:11434/v1/models')
  const model=workspace.models![0],body=llmBody(model,[{role:'user',content:'x'}]);assert.equal(body.reasoning_effort,undefined);assert.equal(body.temperature,undefined)
  assert.equal(llmBody({...model,reasoningEffort:'high',temperature:.5},[]).reasoning_effort,'high')
  assert.throws(()=>llmBody({...model,extraBody:'[]'},[]),/JSON 对象/)
})
test('LLM discovery and generation use compatible HTTP responses without live providers',async()=>{
  const original=globalThis.fetch,tauri=(globalThis as any).isTauri,requests:any[]=[]
  ;(globalThis as any).isTauri=false
  globalThis.fetch=async(url:any,init:any)=>{requests.push({url,...init});return new Response(JSON.stringify(init.method==='GET'?{data:[{id:'b'},{id:'a'},{id:'a'}]}:{choices:[{message:{content:'reply'}}]}),{status:200})}
  try{
    assert.deepEqual(await discoverModels(workspace.models![0]),['a','b'])
    assert.equal(await callLLM({...workspace.models![0],apiKey:'dummy'},[{role:'user',content:'x'}]),'reply')
    assert.equal(requests[1].headers.Authorization,'Bearer dummy');assert.equal(JSON.parse(requests[1].body).model,'test')
  }finally{globalThis.fetch=original;(globalThis as any).isTauri=tauri}
})
test('legacy workspace normalization adds workflow collections without replacing existing model IDs',()=>{
  const migrated=normalizeWorkspace(workspace);assert.deepEqual(migrated.sdWorkflows,[]);assert.deepEqual(migrated.agents,[]);assert.equal(migrated.models![0].id,'llm')
})
test('Agent Tool selects registered configuration and rejects disabled tools',async()=>{
  const agent=createAgent(),input=workflowNode('input'),tool=workflowNode('tool'),out=workflowNode('return');tool.settings.toolId='tool'
  agent.graph={version:1,nodes:[input,tool,out],links:[link(input.id,tool.id,'input'),link(tool.id,out.id,'value')]}
  const config:Workspace={...workspace,tools:[{id:'tool',name:'tool',url:'https://tool.invalid/run',method:'POST',apiKey:'dummy',enabled:true,bodyMode:'input'}]}
  const output=await runAgent(agent,'hello',config,undefined,undefined,undefined,{http:async(request)=>{assert.equal(request.url,'https://tool.invalid/run');assert.deepEqual(request.body,{input:'hello'});return {answer:'ok'} as any}})
  assert.deepEqual(output.value,{answer:'ok'})
  config.tools![0].enabled=false;await assert.rejects(()=>runAgent(agent,'hello',config),/停用/)
})
test('Agent Function receives explicit self identity and typed input',async()=>{
  const agent=createAgent(),input=workflowNode('input'),fn=workflowNode('function'),out=workflowNode('return');fn.settings.functionId='fn';fn.object={classId:'people',entityId:'person',path:[]}
  agent.graph={version:1,nodes:[input,fn,out],links:[link(input.id,fn.id,'input'),link(fn.id,out.id,'value')]}
  const config:Workspace={...workspace,functions:[{id:'fn',name:'typed',language:'js',code:'',apiVersion:2,returnType:{type:'Text'}}]}
  const result=await runAgent(agent,'hello',config,undefined,undefined,undefined,{function:async(_,__,___,context)=>{assert.deepEqual(context,{self:{classId:'people',entityId:'person'},input:{type:'Text',value:'hello'}});return {value:'ok',typedValue:{type:'Text',value:'ok'}}}})
  assert.deepEqual(result.value,{type:'Text',value:'ok'})
})
test('Agent memory is isolated by world and initial variables remain untouched',async()=>{
  const agent=createAgent(),get=workflowNode('getVariable'),out=workflowNode('return');get.settings.name='x';agent.variables={x:'initial'};agent.memory={one:{x:'scoped'}};agent.graph={version:1,nodes:[get,out],links:[link(get.id,out.id,'value')]}
  const world=createWorld('world');world.id='one';assert.equal((await runAgent(agent,'',workspace,world)).value,'scoped');world.id='two';assert.equal((await runAgent(agent,'',workspace,world)).value,'initial');assert.equal(agent.variables.x,'initial')
})
