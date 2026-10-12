import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {reconcileFunctionBindings} from '../src/model/functionAppend'
import {duplicateInstances} from '../src/model/instanceEditing'
import {createFlow,newFlowNode} from '../src/model/flow'
import {FieldEditor} from '../src/ui/App'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorld} from '../src/model/templates'
import {functionJobs} from '../src/services/functions'
import {createFunction} from '../src/model/functions'
import {Workspace,ToolDefinition} from '../src/model/types'
import {bindScriptHost,beginScript} from '../src/services/scriptHost'
import {runFunctionValue} from '../src/services/functions'
import {runTool,toolSpec,toolName} from '../src/services/tools'
import {callLLMWithTools} from '../src/services/llm'
import {documentMarkdown,parseDocumentMarkdown} from '../src/model/markdown'
function fixture(){
 const world={...createWorld('执行世界'),id:'w',documents:[{id:'items',name:'物件',fileName:'物件.md',schema:[{id:'name',keyType:'Const' as const,key:'描述',valueType:'Text' as const}],entities:[{id:'a',name:'甲',fields:[{id:'field',schemaId:'name',key:'描述',value:'初始',children:[]}]},{id:'b',name:'乙',fields:[{id:'other',schemaId:'name',key:'描述',value:'保留',children:[]}]}]}]}
 let state:Workspace={worlds:[world],activeWorldId:world.id},saves=0
 const detach=bindScriptHost({get:()=>state,update:change=>{state=change(state)},save:async()=>{saves++}})
 const tool:ToolDefinition={id:'reader',name:'查询',kind:'js',description:'查询物件名称',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},code:'async function execute(params){return {name:world.get_class("items").get_instance(params.id).name};}',url:'',method:'POST',apiKey:'',bodyMode:'raw',enabled:true}
 return {world,tool,read:()=>state,saves:()=>saves,detach,set:(next:Workspace)=>{state=next}}
}
test('host JS Function reuses typed contracts and lazy shared world readers without Worker or Node',async()=>{
 const f=fixture();try{
 const fn={...createFunction([]),executionMode:undefined,returnType:{type:'Text' as const},code:'async function transform(self,input){return values.text(self.get_member("field").value()+input.value());}'}
 const value=await runFunctionValue(fn,'',f.world,{self:{classId:'items',entityId:'a'},input:{type:'Text',value:'!'}})
 assert.equal(value.typedValue?.value,'初始!');assert.equal(f.saves(),0)
 }finally{f.detach()}
})
test('Function and Tool mutations use one host transaction and existing Markdown validation',async()=>{
 const f=fixture();try{
 await runFunctionValue({id:'setter',name:'写入',language:'js',code:'function transform(input){world.get_class("items").get_instance("a").get_member("field").set_value(input);return world.get_class("items").markdown();}'},'已更新',f.world)
 assert.match(documentMarkdown(f.read().worlds[0].documents[0]),/已更新/);assert.equal(f.saves(),1)
 await runTool({...f.tool,code:'function execute(params){world.get_class("items").get_instance(params.id).delete();return 42;}'},{id:'b'},f.world)
 assert.equal(f.read().worlds[0].documents[0].entities.length,1);assert.equal(f.saves(),2)
 assert.equal(f.world.documents[0].entities.length,2)
 }finally{f.detach()}
})
test('script errors and Function contract errors discard all staged writes',async()=>{
 const f=fixture();try{
 const code='function execute(params){world.get_class("items").get_instance(params.id).delete();throw new Error("失败");}'
 await assert.rejects(runTool({...f.tool,code},{id:'b'},f.world),/失败/)
 const fn={...createFunction([]),executionMode:undefined,code:'function transform(self,input){self.delete();return 123;}'}
 await assert.rejects(runFunctionValue(fn,'',f.world,{self:{classId:'items',entityId:'a'},input:{type:'Text',value:''}}),/type/)
 assert.equal(f.read().worlds[0],f.world);assert.equal(f.saves(),0)
 }finally{f.detach()}
})
test('MCP schema validates free parameters and readOnly Tool blocks host mutations',async()=>{
 const f=fixture();try{
 assert.deepEqual(toolSpec(f.tool).inputSchema,f.tool.inputSchema)
 await assert.rejects(runTool(f.tool,{id:12},f.world),/inputSchema/)
 await assert.rejects(runTool({...f.tool,annotations:{readOnlyHint:true},code:'function execute(params){world.get_class("items").get_instance(params.id).delete();}'},{id:'b'},f.world),/只允许读取/)
 assert.deepEqual(await runTool(f.tool,{id:'a'},f.world),{name:'甲'})
 assert.equal(f.saves(),0)
 }finally{f.detach()}
})
test('host transactions merge independent edits and reject competing writes',async()=>{
 const f=fixture();try{
 const session=beginScript(f.world);session.world.get_class('items').get_instance('a').get_member('field').set_value('脚本')
 f.set({...f.read(),worlds:[{...f.world,name:'新世界名'}]});await session.commit()
 assert.equal(f.read().worlds[0].name,'新世界名');assert.equal(f.read().worlds[0].documents[0].entities[0].fields[0].value,'脚本')
 const conflict=beginScript(f.world);conflict.world.get_class('items').get_instance('a').get_member('field').set_value('冲突')
 const w=f.read().worlds[0];f.set({...f.read(),worlds:[{...w,documents:w.documents.map(d=>({...d,entities:d.entities.map(e=>({...e,fields:e.fields.map(field=>({...field,value:'界面'}))}))}))}]})
 await assert.rejects(conflict.commit(),/同时修改/);assert.equal(f.read().worlds[0].documents[0].entities[0].fields[0].value,'界面')
 }finally{f.detach()}
})
test('cancelled async Tool cannot commit or keep using world after return',async()=>{
 const f=fixture();try{
 const c=new AbortController();c.abort();await assert.rejects(runTool(f.tool,{id:'a'},f.world,c.signal),/已取消/)
 const session=beginScript(f.world);session.close();assert.throws(()=>session.world.classes(),/已结束/)
 }finally{f.detach()}
})
test('LLM tool bridge sends specs, executes arguments and returns matching tool_call_id',async()=>{
 const f=fixture();try{
 const model={id:'m',name:'模型',model:'test',baseUrl:'http://localhost',apiKey:'',enabled:true,toolIds:[f.tool.id]},workspace={...f.read(),tools:[f.tool]}
 let count=0
 const result=await callLLMWithTools(model,[{role:'user',content:'查询甲'}],workspace,f.world,undefined,async(_model,messages,_signal,tools)=>{
   count++;assert.equal(tools?.[0].id,f.tool.id)
   if(count===1)return {role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:toolName(f.tool),arguments:'{"id":"a"}'}}]}
   assert.equal(messages.at(-1)?.tool_call_id,'call_1');assert.equal(messages.at(-1)?.content,'{"name":"甲"}');return {role:'assistant',content:'甲'}
 })
 assert.equal(result.message.content,'甲');assert.deepEqual(result.messages.map(m=>m.role),['assistant','tool','assistant'])
 }finally{f.detach()}
})

test('automatic Function commits its result with world writes and does not retrigger itself',async()=>{
 const f=fixture();try{
 const fn={...createFunction([]),id:'automatic',code:'function transform(self,input){return values.text(input.value());}'}
 const world={...f.world,documents:f.world.documents.map(d=>({...d,schema:d.schema.map(s=>({...s,functionIds:[fn.id]}))}))}
 f.set({...f.read(),worlds:[world],functions:[fn]})
 const job=functionJobs(f.read()).find(j=>j.fieldId==='field')!
 await runFunctionValue(fn,job.input,world,job.context,undefined,job)
 assert.equal(f.read().worlds[0].documents[0].entities[0].fields[0].functionRuns?.[0].functionId,'automatic')
 assert.ok(!functionJobs(f.read()).some(j=>j.fieldId==='field'))
 }finally{f.detach()}
})

function appendFixture(code:string){
 const f=fixture(),fn={...createFunction([]),id:'append',name:'扩展',code}
 const schema=[{id:'root',keyType:'Const' as const,key:'内容',valueType:'Object' as const,functionIds:[fn.id],children:[
  {id:'notes',keyType:'Const' as const,key:'注释',valueType:'Text' as const,repeatable:true},
  {id:'fixed',keyType:'Const' as const,key:'固定',valueType:'Text' as const},
  {id:'child',keyType:'Const' as const,key:'子对象',valueType:'Object' as const,children:[{id:'numbers',keyType:'Const' as const,key:'数值',valueType:'Integer' as const,repeatable:true}]},
  {id:'rows',keyType:'Const' as const,key:'记录',valueType:'Object' as const,repeatable:true,children:[{id:'label',keyType:'Const' as const,key:'名称',valueType:'Text' as const}]}
 ]}]
 const fields=[{id:'root-value',schemaId:'root',key:'内容',value:'',children:[{id:'original',schemaId:'notes',key:'注释',value:'保留',children:[]},{id:'fixed-value',schemaId:'fixed',key:'固定',value:'不变',children:[]},{id:'child-value',schemaId:'child',key:'子对象',value:'',children:[]}]}]
 const world={...f.world,documents:f.world.documents.map(d=>({...d,schema,entities:d.entities.map(e=>({...e,fields:structuredClone(fields).map(field=>({...field,id:e.id==='a'?field.id:'b-root'}))}))}))}
 f.set({...f.read(),worlds:[world],functions:[fn]})
 const job=functionJobs(f.read()).find(j=>j.fieldId==='root-value')!
 return {...f,world,fn,job,run:()=>runFunctionValue(fn,job.input,world,job.context,undefined,job)}
}
test('bound Function appends at any depth, preserves existing values and provenance through Markdown, without rerunning',async()=>{
 const f=appendFixture('function transform(self,input){input.append_repeatable("notes",values.text("新增"));input.get_member("child-value").append_repeatable("numbers",values.integer(42));input.append_repeatable("rows",values.object({名称:values.text("甲")}));return values.text("完成");}')
 try{
  await f.run()
  const doc=f.read().worlds[0].documents[0],fields=doc.entities[0].fields[0].children
  assert.equal(fields[0].value,'保留');assert.equal(fields[1].value,'不变')
  assert.equal(fields[2].children[0].value,'42');assert.equal(fields[3].value,'新增')
  assert.deepEqual(fields[3].functionOrigin,{functionId:'append',name:'扩展',bindingFieldId:'root-value'})
  assert.equal(fields[4].children[0].value,'甲')
  const text=documentMarkdown(doc),parsed=parseDocumentMarkdown(text,doc,f.read().worlds[0])
  assert.deepEqual(parsed.entities[0].fields[0].children,fields)
  assert.doesNotMatch(text,/function-sources|function-origin/)
  assert.match(text,/<!-- 扩展 -->/)
  assert.deepEqual(parseDocumentMarkdown(text.replace(/<!-- 扩展 -->/g,'<!-- <!> 扩展 -->'),doc,f.read().worlds[0]).entities[0].fields[0].children,fields)
  assert.throws(()=>parseDocumentMarkdown(text.replace("新增","被改写"),doc,f.read().worlds[0]),/只读/)
  assert.throws(()=>parseDocumentMarkdown(text.replace("#### 注释 <!-- 扩展 -->","#### 注释"),doc,f.read().worlds[0]),/只读/)
  const table:Record<string,unknown>={};let index=0
  const legacyFields=(items:typeof fields,depth:number):string=>items.map(field=>{
   const ref=`f${index++}`;if(field.functionOrigin)table[ref]=[field.id,field.schemaId,field.functionOrigin.functionId,field.functionOrigin.name,field.functionOrigin.bindingFieldId]
   return `${'#'.repeat(depth)} ${field.key}\n${field.functionOrigin?`\n<!-- function-origin:${ref} -->\n`:''}${field.value?`\n${field.value}\n`:''}${field.children.length?'\n'+legacyFields(field.children,depth+1):''}`
  }).join('\n')
  const body=doc.entities.map(e=>`## ${e.name}\n\n${legacyFields(e.fields,3)}`).join('\n')
  const legacy=`# ${doc.name}\n\n<!-- function-sources:${JSON.stringify(table)} -->\n\n${body}`
  assert.deepEqual(parseDocumentMarkdown(legacy,doc,f.read().worlds[0]).entities[0].fields[0].children,fields)
  assert.throws(()=>parseDocumentMarkdown(legacy.replace(/function-origin:f[0-9a-z]+/,"function-origin:fzzzzz"),doc,f.read().worlds[0]),/来源元数据无效/)
  const restored=parseDocumentMarkdown(text,{...doc,entities:[]},f.read().worlds[0])
  assert.equal(restored.entities[0].fields[0].children[3].functionOrigin?.functionId,'append')
  assert.equal(restored.entities[0].fields[0].children[3].functionOrigin?.bindingFieldId,restored.entities[0].fields[0].id)
  const html=renderToStaticMarkup(createElement(FieldEditor,{world:f.read().worlds[0],doc,field:fields[3],schema:doc.schema[0].children![0],onChange:()=>{},onDelete:()=>{}}))
  assert.match(html,/扩展 →/);assert.match(html,/readOnly=""/);assert.doesNotMatch(html,/删除属性/)
  const objectHtml=renderToStaticMarkup(createElement(FieldEditor,{world:f.read().worlds[0],doc,field:fields[4],schema:doc.schema[0].children![3],onChange:()=>{}}))
  assert.match(objectHtml,/名称/);assert.match(objectHtml,/甲/);assert.doesNotMatch(objectHtml,/添加属性/)
  assert.ok(!functionJobs(f.read()).some(j=>j.fieldId==='root-value'))
  const unrelated=structuredClone(f.read());unrelated.worlds[0].name='重命名世界';unrelated.worlds[0].documents[0].entities[0].name='改名'
  assert.ok(!functionJobs(unrelated).some(j=>j.fieldId==='root-value'))
  unrelated.functions![0].name='新函数名称'
  assert.ok(!functionJobs(unrelated).some(j=>j.fieldId==='root-value'))
  unrelated.worlds[0].documents[0].entities[0].fields[0].children[0].value='新的原始输入'
  assert.ok(functionJobs(unrelated).some(j=>j.fieldId==='root-value'))
  assert.equal(f.saves(),1)
 }finally{f.detach()}
})
test('bound Function rejects existing edits, out of scope appends, non-repeatable and invalid typed values atomically',async()=>{
 for(const [operation,message] of [
  ['self.get_member("root-value").get_member("fixed-value").set_value("坏")',/不能修改/],
  ['self.delete()',/不能修改/],
  ['world.get_class("items").set_markdown("# 空")',/不能修改/],
  ['world.get_class("items").get_instance("b").get_member("b-root").append_repeatable("notes",values.text("坏"))',/绑定属性/],
  ['input.append_repeatable("fixed",values.text("坏"))',/可重复/],
  ['input.append_repeatable("notes",values.integer(1))',/Text/],
  ['input.append_repeatable("rows",values.object({不存在:values.text("坏")}))',/Schema/],
  ['input.append_repeatable("rows",values.object([]))',/必须/],
 ] as const){
  const f=appendFixture(`function transform(self,input){input.append_repeatable("notes",values.text("应撤销"));${operation};return values.text("完成");}`)
  try{await assert.rejects(f.run(),message);assert.equal(f.read().worlds[0],f.world);assert.equal(f.saves(),0)}finally{f.detach()}
 }
})
test('repeatable scalar bound Function can append siblings but not replace its input',async()=>{
 const f=appendFixture('function transform(self,input){input.append_self(values.text("同级新增"));return values.text("完成");}')
 try{
  const world={...f.world,documents:f.world.documents.map(d=>({...d,schema:d.schema.map(s=>({...s,functionIds:[],children:s.children.map(c=>({...c,functionIds:c.id==='notes'?[f.fn.id]:[]}))}))}))}
  f.set({...f.read(),worlds:[world]})
  const job=functionJobs(f.read()).find(j=>j.fieldId==='original')!
  await runFunctionValue(f.fn,job.input,world,job.context,undefined,job)
  const fields=f.read().worlds[0].documents[0].entities[0].fields[0].children
  assert.equal(fields.at(-1)?.value,'同级新增');assert.equal(fields[0].value,'保留')
  assert.equal(fields.at(-1)?.functionOrigin?.bindingFieldId,'original')
 }finally{f.detach()}
})

test('new repeated bound Objects remain in scope for subsequent child appends',async()=>{
 const f=appendFixture('function transform(self,input){const added=input.append_self(values.object({固定:values.text("新固定"),子对象:values.object([])}));added.get_member("子对象").append_repeatable("numbers",values.integer(9));return values.text("完成");}')
 try{
  const world={...f.world,documents:f.world.documents.map(d=>({...d,schema:d.schema.map(s=>({...s,repeatable:true}))}))}
  f.set({...f.read(),worlds:[world]})
  const job=functionJobs(f.read()).find(j=>j.fieldId==='root-value')!
  await runFunctionValue(f.fn,job.input,world,job.context,undefined,job)
  const fields=f.read().worlds[0].documents[0].entities[0].fields
  assert.equal(fields.length,2);assert.equal(fields[0].children[1].value,'不变')
  assert.equal(fields[1].children[1].children[0].value,'9')
  assert.equal(fields[1].functionOrigin?.bindingFieldId,'root-value')
 }finally{f.detach()}
})

test('void add writes checked fields, ignores returns and stores no result member',async()=>{
 const f=appendFixture('function transform(self,input){input.add("notes",values.text("普通成员"));input.get_member("child-value").add("numbers",values.integer(7));return {not_a_valid_return:true};}')
 try{
  const output=await f.run(),doc=f.read().worlds[0].documents[0],field=doc.entities[0].fields[0]
  assert.deepEqual(output,{value:''});assert.equal(field.functionResults,undefined);assert.equal(field.functionRuns?.length,1)
  assert.equal(field.children.at(-1)?.value,'普通成员')
  assert.doesNotMatch(documentMarkdown(doc),/function-value|functions\/|#### \[扩展\]/)
  assert.equal(functionJobs(f.read()).filter(j=>j.fieldId==='root-value').length,0)
 }finally{f.detach()}
})
test('unbind, rebind and deletion remove only owned generated fields, including deep children and copied instances',async()=>{
 const f=appendFixture('function transform(self,input){input.add("notes",values.text("新增"));input.get_member("child-value").add("numbers",values.integer(42));}')
 try{
  await f.run();const state=f.read(),doc=state.worlds[0].documents[0],original=doc.entities[0]
  const copy=duplicateInstances([original])[0],copyRoot=copy.fields[0]
  assert.equal(copyRoot.children.at(-1)?.functionOrigin?.bindingFieldId,copyRoot.id)
  const withCopy={...state,worlds:state.worlds.map(w=>({...w,documents:w.documents.map(d=>({...d,entities:[...d.entities,copy]}))}))}
  const removed=reconcileFunctionBindings({...withCopy,worlds:withCopy.worlds.map(w=>({...w,documents:w.documents.map(d=>({...d,schema:d.schema.map(s=>({...s,functionIds:[]}))}))}))})
  for(const entity of removed.worlds[0].documents[0].entities){assert.equal(entity.fields[0].children.length,3);assert.equal(entity.fields[0].children[0].value,'保留');assert.equal(entity.fields[0].children[2].children.length,0);assert.equal(entity.fields[0].functionRuns?.length||0,0)}
  const replacement={...f.fn,id:'replacement'}
  const rebound=reconcileFunctionBindings({...state,functions:[replacement],worlds:state.worlds.map(w=>({...w,documents:w.documents.map(d=>({...d,schema:d.schema.map(s=>({...s,functionIds:[replacement.id]}))}))}))})
  assert.equal(rebound.worlds[0].documents[0].entities[0].fields[0].children.length,3)
  assert.equal(reconcileFunctionBindings({...state,functions:[]}).worlds[0].documents[0].entities[0].fields[0].children.length,3)
  assert.equal(reconcileFunctionBindings(state),state)
 }finally{f.detach()}
})
test('void Flow code can call add without returning a value',async()=>{
 const f=appendFixture('')
 try{
  const graph=createFlow(),input=graph.nodes.find(n=>n.type==='input')!,output=graph.nodes.find(n=>n.type==='return')!,code=newFlowNode('code')
  code.code='inputs.a.add("notes",values.text("Flow 新增"));';graph.nodes.push(code);graph.edges=[{id:'in',from:input.id,to:code.id,port:'a'},{id:'end',from:code.id,to:output.id,port:'value'}]
  const fn={...f.fn,language:'flow' as const,flow:graph},state={...f.read(),functions:[fn]};f.set(state)
  const job=functionJobs(state).find(j=>j.fieldId==='root-value')!
  await runFunctionValue(fn,job.input,f.world,job.context,undefined,job)
  assert.equal(f.read().worlds[0].documents[0].entities[0].fields[0].children.at(-1)?.value,'Flow 新增')
 }finally{f.detach()}
})
test('add rejects invalid Schema and rolls back earlier valid additions without a return contract',async()=>{
 const f=appendFixture('function transform(self,input){input.add("notes",values.text("撤销"));input.add("fixed",values.text("非法"));}')
 try{await assert.rejects(f.run(),/可重复/);assert.equal(f.read().worlds[0],f.world)}finally{f.detach()}
})

test('recompute replaces only this binding additions and keeps another instance binding stable',async()=>{
 const f=appendFixture('function transform(self,input){input.add("notes",values.text("计算值"));}')
 try{
  await f.run()
  let job=functionJobs(f.read(),true).find(j=>j.fieldId==='b-root')!
  await runFunctionValue(f.fn,job.input,f.read().worlds[0],job.context,undefined,job)
  const other=structuredClone(f.read().worlds[0].documents[0].entities[1])
  job=functionJobs(f.read(),true).find(j=>j.fieldId==='root-value')!
  await runFunctionValue(f.fn,job.input,f.read().worlds[0],job.context,undefined,job)
  assert.deepEqual(f.read().worlds[0].documents[0].entities[1],other)
  const notes=f.read().worlds[0].documents[0].entities[0].fields[0].children.filter(f=>f.schemaId==='notes')
  assert.deepEqual(notes.map(f=>f.value),['保留','计算值'])
 }finally{f.detach()}
})
