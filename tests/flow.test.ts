import test from 'node:test'
import assert from 'node:assert/strict'
import { compileFlow, connectFlow, createFlow, newFlowNode, validateFlow } from '../src/model/flow'
import { createWorldApi, objectCode, worldCatalog } from '../src/model/worldApi'
import { createFunction, functionRevision } from '../src/model/functions'
import { createFunctionApi, validateTypedValue } from '../src/model/functionValues'
import { functionJobs, applyFunctionResult } from '../src/services/functions'
import { createWorld } from '../src/model/templates'
import { parseDocumentMarkdown, documentMarkdown } from '../src/model/markdown'
import { FlowGraph, World, Workspace } from '../src/model/types'

const run=(flow:FlowGraph,input:string,world?:World)=>{const api=createWorldApi(worldCatalog(world));return new Function('world',compileFlow(flow)+'\nreturn transform;')(api)(input,api) as Promise<string>}
function fixture(){
  const world=createWorld('Flow 世界'),doc=world.documents.find(d=>d.id==='people')!
  const parsed=parseDocumentMarkdown('# 人物\n\n## 林青\n\n### 人物势力\n\n#### 势力地位\n\n10\n\n### 人物性格\n\n谨慎\n',doc,world)
  world.documents=world.documents.map(d=>d.id===doc.id?parsed:d)
  return {world,doc:parsed,entity:parsed.entities[0],field:parsed.entities[0].fields.find(f=>f.key==='人物势力')!.children.find(f=>f.key==='势力地位')!}
}
test('Flow compiles a branching arithmetic graph to an ordinary string-returning function',async()=>{
  let graph=createFlow();const input=graph.nodes[0],output=graph.nodes[1],add=newFlowNode('add'),multiply=newFlowNode('multiply')
  add.values.b='2';multiply.values.b='3';graph={...graph,nodes:[...graph.nodes,add,multiply]}
  graph=connectFlow(graph,input.id,add.id,'a');graph=connectFlow(graph,add.id,multiply.id,'a');graph=connectFlow(graph,multiply.id,output.id,'value')
  assert.equal(await run(graph,'4'),'18')
  assert.equal(await run(JSON.parse(JSON.stringify(graph)),'5'),'21')
})
test('Flow rejects cycles and broken ports, reports missing return and divide-by-zero without silently computing',async()=>{
  let graph=createFlow();const div=newFlowNode('divide'),other=newFlowNode('add');div.values={a:'10',b:'0'}
  graph={...graph,nodes:[...graph.nodes,div,other]};graph=connectFlow(graph,div.id,graph.nodes[1].id,'value')
  await assert.rejects(run(graph,''),/除数/)
  graph=connectFlow(graph,div.id,other.id,'a')
  assert.throws(()=>connectFlow(graph,other.id,div.id,'a'),/循环/)
  assert.throws(()=>connectFlow(graph,div.id,other.id,'missing'),/端口/)
  assert.throws(()=>validateFlow({...graph,edges:[]}),/return/)
  div.values.a='not a number';div.values.b='3'
  await assert.rejects(run(graph,''),/有效数字/)
})
test('shared object API reads an instance and nested member Markdown, raw values and enumerates objects',async()=>{
  const {world,doc,entity,field}=fixture(),api=createWorldApi(worldCatalog(world)),instance=api.get_class('人物').get_instance('林青'),member=instance.get_member('人物势力').get_member(field.id)
  assert.equal(member.value(),'10');assert.match(member.markdown(),/^#### 势力地位\n\n10/)
  assert.match(instance.markdown(),/^## 林青/);assert.match(instance.markdown(),/人物性格/)
  assert.equal(api.get_class(doc.id).instances()[0].id,entity.id)
  const root=entity.fields.find(f=>f.key==='人物势力')!,selection={classId:doc.id,entityId:entity.id,path:[root.id,field.id]}
  assert.equal(new Function('world','return '+objectCode(selection).replace(/;$/,''))(api),member.markdown())
  let graph=createFlow(),node=newFlowNode('memberMarkdown');node.object=selection;graph={...graph,nodes:[...graph.nodes,node]};graph=connectFlow(graph,node.id,graph.nodes[1].id,'value')
  assert.equal(await run(graph,'',world),member.markdown())
  node.values.format='value';assert.equal(await run(graph,'',world),'10')
})
test('code blocks support dynamic inputs, loops and world API and preserve branch evaluation caching',async()=>{
  const {world}=fixture();let graph=createFlow();const code=newFlowNode('code');code.ports=['text'];code.code='let result=""; for(const item of world.get_class("人物").instances()){ result += item.markdown(); } return inputs.text + result;'
  graph={...graph,nodes:[...graph.nodes,code]};graph=connectFlow(graph,graph.nodes[0].id,code.id,'text');graph=connectFlow(graph,code.id,graph.nodes[1].id,'value')
  assert.match(await run(graph,'前缀\n',world),/^前缀\n## 林青/)
  assert.ok(!compileFlow(graph).includes('undefined:'))
})
test('Flow results use .flow Markdown keys and world-dependent jobs reject stale object snapshots without rerunning on layout changes',()=>{
  const {world,doc,entity}=fixture(),fn=createFunction([],'flow'),node=newFlowNode('entityMarkdown')
  node.object={classId:doc.id,entityId:entity.id,path:[]};fn.flow={...fn.flow!,nodes:[...fn.flow!.nodes,node]};fn.flow=connectFlow(fn.flow,node.id,fn.flow.nodes[1].id,'value')
  const schema=doc.schema.find(s=>s.key==='人物性格')!;schema.functionIds=[fn.id]
  const workspace:Workspace={worlds:[world],activeWorldId:world.id,functions:[fn]},job=functionJobs(workspace)[0]
  const result={functionId:fn.id,name:fn.name,fileName:`../../functions/${fn.id}.flow`,input:job.input,value:'返回结果',source:job.source,contextKey:job.contextKey}
  const next=applyFunctionResult(workspace,job,result),nextDoc=next.worlds[0].documents.find(d=>d.id===doc.id)!
  assert.equal(worldCatalog(next.worlds[0],fn.id).classes.find(d=>d.id===doc.id)!.markdown.includes(`.flow)`),false)
  assert.equal(functionJobs(next).length,0)
  const md=documentMarkdown(nextDoc);assert.match(md,/\.flow\)/)
  assert.deepEqual(parseDocumentMarkdown(md,nextDoc,next.worlds[0]),nextDoc)
  const moved=structuredClone(next);moved.functions![0].flow!.nodes[0].x+=100
  assert.equal(functionRevision(moved.functions![0],moved.worlds[0]),job.source)
  assert.equal(functionJobs(moved).length,0)
  const changed=structuredClone(next);changed.worlds[0].documents.find(d=>d.id===doc.id)!.entities[0].name='改名'
  assert.equal(functionJobs(changed).length,1)
  assert.equal(applyFunctionResult(changed,job,result),changed)
})

test('typed Flow preserves input types and arithmetic produces a declared typed return',async()=>{
  const graph=createFlow(),context={self:{classId:'c',entityId:'e'},input:{type:'Integer' as const,value:7}},world={get_class:()=>({get_instance:()=>({id:'e',name:'名称'})})}
  const runtime=createFunctionApi(world,context,{type:'Integer'})
  const transform=new Function('world','values',compileFlow(graph,true)+';return transform;')(world,runtime.values)
  assert.deepEqual(validateTypedValue(await transform(runtime.self,runtime.input),{type:'Integer'}),{type:'Integer',value:7})
  const input=graph.nodes.find(n=>n.type==='input')!,output=graph.nodes.find(n=>n.type==='return')!,add=newFlowNode('add');add.values.b='5';graph.nodes.push(add)
  graph.edges=[{id:'a',from:input.id,to:add.id,port:'a'},{id:'out',from:add.id,to:output.id,port:'value'}]
  const arithmetic=new Function('world','values',compileFlow(graph,true)+';return transform;')(world,runtime.values)
  assert.deepEqual(validateTypedValue(await arithmetic(runtime.self,runtime.input),{type:'Integer'}),{type:'Integer',value:12})
})
