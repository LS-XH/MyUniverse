import test from 'node:test'
import assert from 'node:assert/strict'
import {builtinTools,registeredTools} from '../src/model/builtinTools'
import {World,Workspace} from '../src/model/types'
import {createWorld} from '../src/model/templates'
import {runTool} from '../src/services/tools'
import {bindScriptHost} from '../src/services/scriptHost'
import {appendInstanceProposal,decideInstanceProposal,decideInstanceProposals,onInstanceProposal} from '../src/services/instanceProposals'
import {entityMarkdown,parseDocumentMarkdown} from '../src/model/markdown'
import {askChatQuestion,answerChatQuestion,hasChatQuestion} from '../src/services/chatQuestions'
import {callLLMWithTools} from '../src/services/llm'
const get=(key:string)=>builtinTools.find(t=>t.id===`builtin:${key}`)!
test('strict Markdown accepts repeated unselected Class rows without inventing schema',()=>{
 const world=createWorld('重复值'),doc={id:'d',name:'人物',fileName:'人物.md',entities:[],schema:[{id:'relations',key:'关系',keyType:'Const' as const,valueType:'Object' as const,children:[{id:'r',key:'',keyType:'Class' as const,valueType:'Null' as const,repeatable:true}]}]}
 const parsed=parseDocumentMarkdown('# 人物\n## 甲\n### 关系\n#### 新属性\n#### 新属性',doc,world,{rejectUnknown:true})
 assert.equal(parsed.entities[0].fields[0].children.length,2);assert.deepEqual(parsed.schema,doc.schema)
 assert.throws(()=>parseDocumentMarkdown('# 人物\n## 甲\n### 未知',doc,world,{rejectUnknown:true}),/类结构/)
})
test('member proposal isolates nested content and preserves siblings; rejects malformed paths and types',async()=>{
 const f=fixture(),off=onInstanceProposal(e=>f.set(appendInstanceProposal(f.read(),e)));try{
 const result:any=await runTool(get('propose_member_change'),{className:'物件',instanceName:'甲',path:[{key:'详情'},{key:'描述'}],markdown:'定向内容'},f.world)
 const chat=f.read().worlds[0].chat,c=chat.conversations[0];assert.equal(f.read().worlds[0].documents[0].entities[0].fields[1].children[0].value,'内部')
 const saved=decideInstanceProposal(f.read(),f.world.id,c.id,result.proposalId,true).worlds[0].documents[0].entities[0]
 assert.equal(saved.fields[0].value,'原值');assert.equal(saved.fields[1].children[0].value,'定向内容');assert.equal(saved.fields[1].children[0].id,'child')
 await assert.rejects(runTool(get('propose_member_change'),{className:'物件',instanceName:'甲',path:[{key:'缺失'}],markdown:'内容'},f.world),/不存在/)
 await assert.rejects(runTool(get('propose_member_change'),{className:'物件',instanceName:'甲',path:[{key:'详情'}],markdown:'### 描述\n污染'},f.world),/祖先/)
 const numeric=structuredClone(f.world);numeric.documents[0].schema[0].valueType='Integer';f.set({...f.read(),worlds:[numeric]})
 await assert.rejects(runTool(get('propose_member_change'),{className:'物件',instanceName:'甲',path:[{key:'描述'}],markdown:'不是数字'},numeric),/整数/)
 }finally{off();f.detach()}
})
test('question waits for the user, returns selected text, and cancels without replay',async()=>{
 const events:any[]=[],controller=new AbortController()
 const result=askChatQuestion('请选择',['甲','乙'],controller.signal,e=>{events.push(e)})
 await Promise.resolve();assert.ok(hasChatQuestion(events[0].id));answerChatQuestion(events[0].id,'乙');assert.equal(await result,'乙');assert.equal(events[1].answer,'乙');assert.equal(hasChatQuestion(events[0].id),false)
 const cancelled=askChatQuestion('继续？',[],controller.signal,e=>{events.push(e)});await Promise.resolve();controller.abort();await assert.rejects(cancelled,/取消/)
 await assert.rejects(runTool(get('ask_user'),{question:'确认？',options:[]}),/交互上下文/)
 assert.equal(await runTool(get('ask_user'),{question:'确认？',options:['是']},undefined,undefined,undefined,{askUser:async()=> '是'}),'是')
})
function fixture(){
 const world:World={...createWorld('模板测试'),id:'official-world',documents:[{id:'items',name:'物件',fileName:'物件.md',schema:[{id:'desc',keyType:'Const',key:'描述',valueType:'Text'},{id:'details',keyType:'Const',key:'详情',valueType:'Object',children:[{id:'inner',keyType:'Const',key:'描述',valueType:'Text'}]}],entities:[{id:'a',name:'甲',fields:[{id:'f',schemaId:'desc',key:'描述',value:'原值',children:[]},{id:'nested',schemaId:'details',key:'详情',value:'',children:[{id:'child',schemaId:'inner',key:'描述',value:'内部',children:[]}]}]},{id:'b',name:'乙',fields:[]}]}]}
 let state:Workspace={worlds:[world],activeWorldId:world.id},saves=0
 const detach=bindScriptHost({get:()=>state,update:change=>{state=change(state)},save:async()=>{saves++}})
 return {world,read:()=>state,set:(next:Workspace)=>{state=next},saves:()=>saves,detach}
}
test('eleven canonical official Tools cannot be replaced by workspace copies',async()=>{
 const f=fixture();try{
 assert.equal(builtinTools.length,11);assert.ok(Object.isFrozen(builtinTools));assert.ok(Object.isFrozen(get('list_classes').inputSchema))
 const forged={...get('list_classes'),kind:'js' as const,code:'throw new Error("forged")',name:'伪造',enabled:false}
 assert.equal(registeredTools({...f.read(),tools:[forged]}).length,11)
 assert.equal(registeredTools({...f.read(),tools:[forged]}).find(t=>t.id==='builtin:list_classes')!.name,'获取所有类名列表')
 assert.deepEqual(await runTool(forged,{},f.world),['物件'])
 }finally{f.detach()}
})
test('official readers provide structure without content and recursive typed key matches',async()=>{
 const f=fixture();try{
 const shape:any=await runTool(get('class_structure'),{className:'物件'},f.world);assert.equal(shape.members[1].children[0].key,'描述');assert.ok(!JSON.stringify(shape).includes('原值'))
 const markdown=await runTool(get('class_structure_markdown'),{className:'物件'},f.world);assert.match(String(markdown),/#### 描述/);assert.ok(!String(markdown).includes('原值'));assert.ok(!String(markdown).includes('内部'))
 assert.deepEqual(await runTool(get('list_instances'),{className:'物件'},f.world),['甲','乙'])
 const instance:any=await runTool(get('get_instance'),{className:'物件',instanceName:'甲'},f.world);assert.equal(instance.members[0].value.value,'原值')
 assert.equal(await runTool(get('get_instance_markdown'),{className:'物件',instanceName:'甲'},f.world),entityMarkdown(f.world.documents[0].entities[0]))
 const found:any=await runTool(get('find_instance_key'),{className:'物件',instanceName:'甲',key:'描述'},f.world);assert.equal(found.matches.length,2);assert.equal(found.matches[1].path.length,2)
 assert.deepEqual(await runTool(get('find_instance_key'),{className:'物件',instanceName:'甲',key:'缺失'},f.world),{found:false,matches:[]})
 await assert.rejects(runTool(get('list_instances'),{className:'不存在'},f.world),/不存在/);assert.equal(f.saves(),0)
 }finally{f.detach()}
})
test('proposal Tool emits chat event but only explicit acceptance changes an instance',async()=>{
 const f=fixture(),off=onInstanceProposal(event=>f.set(appendInstanceProposal(f.read(),event)));try{
 const before=entityMarkdown(f.world.documents[0].entities[0]);const result:any=await runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown:before.replace('原值','建议值')},f.world)
 assert.equal(result.status,'pending');assert.equal(f.read().worlds[0].documents[0].entities[0].fields[0].value,'原值');assert.equal(f.saves(),0)
 const chat=f.read().worlds[0].chat,conversation=chat.conversations[0],proposal=conversation.messages[0].proposal!;assert.equal(proposal.status,'pending')
 const restored=JSON.parse(JSON.stringify(f.read()))
 const approved=decideInstanceProposal(restored,f.world.id,conversation.id,proposal.id,true);assert.equal(approved.worlds[0].documents[0].entities[0].fields[0].value,'建议值');assert.equal(approved.worlds[0].documents[0].entities[0].id,'a');assert.equal(approved.worlds[0].documents[0].entities[1].name,'乙')
 assert.throws(()=>decideInstanceProposal(approved,f.world.id,conversation.id,proposal.id,true),/已处理/)
 const rejected=decideInstanceProposal(restored,f.world.id,conversation.id,proposal.id,false);assert.equal(rejected.worlds[0].documents[0].entities[0].fields[0].value,'原值');assert.equal(rejected.worlds[0].chat.conversations[0].messages[0].proposal?.status,'rejected')
 const stale=structuredClone(restored);stale.worlds[0].documents[0].entities[0].fields[0].value='用户的新值';assert.throws(()=>decideInstanceProposal(stale,f.world.id,conversation.id,proposal.id,true),/已变化/)
 await assert.rejects(runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown:'## 其他实例\n'},f.world),/指定实例/)
 await assert.rejects(runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown:before+'\n### 新属性\n内容'},f.world),/类结构/)
 }finally{off();f.detach()}
})
test('model bridge resolves official Tools without storing definitions in workspace',async()=>{
 const f=fixture();try{
 const model={id:'m',name:'m',model:'m',baseUrl:'',apiKey:'',enabled:true,toolIds:[get('list_instances').id]};let calls=0
 const result=await callLLMWithTools(model,[{role:'user',content:'列出物件'}],f.read(),f.world,undefined,async(_model,messages,_signal,tools)=>{
 assert.equal(tools?.[0].id,get('list_instances').id)
 if(!calls++)return {role:'assistant',content:null,tool_calls:[{id:'call-official',type:'function',function:{name:'universe_list_instances',arguments:'{"className":"物件"}'}}]}
 assert.equal(messages.at(-1)?.content,'["甲","乙"]');return {role:'assistant',content:'甲、乙'}
 });assert.equal(result.message.content,'甲、乙')
 }finally{f.detach()}
})
test('proposal event stays in its original conversation and fails without a chat handler',async()=>{
 const f=fixture();let off:(()=>void)|undefined
 try{
  const parameters={className:'物件',instanceName:'甲',markdown:entityMarkdown(f.world.documents[0].entities[0])}
  await assert.rejects(runTool(get('propose_instance_change'),parameters,f.world),/处理器未就绪/)
  const state=f.read();state.worlds[0].chat={...state.worlds[0].chat,activeConversationId:'other',conversations:[{id:'original',title:'原会话',createdAt:0,messages:[]},{id:'other',title:'当前会话',createdAt:0,messages:[]}]}
  off=onInstanceProposal(event=>f.set(appendInstanceProposal(f.read(),event)))
  await runTool(get('propose_instance_change'),parameters,f.world,undefined,undefined,{conversationId:'original'})
  assert.equal(f.read().worlds[0].chat.conversations[0].messages.length,1);assert.equal(f.read().worlds[0].chat.conversations[1].messages.length,0);assert.equal(f.read().worlds[0].chat.activeConversationId,'other')
  await assert.rejects(runTool(get('propose_instance_change'),parameters,f.world,undefined,undefined,{conversationId:'deleted'}),/会话已删除/)
 }finally{off?.();f.detach()}
})

test('independent proposals on the same instance save sequentially without overwriting another member',async()=>{
 const f=fixture(),off=onInstanceProposal(event=>f.set(appendInstanceProposal(f.read(),event)))
 try{
  const before=entityMarkdown(f.world.documents[0].entities[0])
  await runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown:before.replace('原值','外部建议')},f.world)
  await runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown:before.replace('内部','内部建议')},f.world)
  const c=f.read().worlds[0].chat.conversations[0],ids=c.messages.map(m=>m.proposal!.id)
  let state=decideInstanceProposal(f.read(),f.world.id,c.id,ids[0],true)
  state=decideInstanceProposal(state,f.world.id,c.id,ids[1],true)
  const entity=state.worlds[0].documents[0].entities[0]
  assert.equal(entity.fields[0].value,'外部建议');assert.equal(entity.fields[1].children[0].value,'内部建议');assert.equal(entity.fields[0].id,'f');assert.equal(entity.fields[1].children[0].id,'child')
 }finally{off();f.detach()}
})

test('add-instance proposals remain read-only until accepted and support checked rollback',async()=>{
 const f=fixture(),off=onInstanceProposal(event=>f.set(appendInstanceProposal(f.read(),event)))
 try{
  const tool=get('propose_instance_add');assert.equal(tool.annotations?.readOnlyHint,true);assert.equal(tool.annotations?.idempotentHint,false)
  await runTool(tool,{className:'物件',instanceName:'丙',markdown:'## 丙\n\n### 描述\n新增内容\n\n### 详情\n\n#### 描述\n内部内容'},f.world)
  assert.equal(f.read().worlds[0].documents[0].entities.length,2)
  const c=f.read().worlds[0].chat.conversations[0],id=c.messages[0].proposal!.id
  const saved=decideInstanceProposal(f.read(),f.world.id,c.id,id,true)
  const entity=saved.worlds[0].documents[0].entities.find(e=>e.name==='丙')!;assert.ok(entity);assert.equal(entity.fields[0].value,'新增内容')
  const changed=structuredClone(saved);changed.worlds[0].documents[0].entities.find(e=>e.id===entity.id)!.fields[0].value='后续编辑'
  assert.throws(()=>decideInstanceProposal(changed,f.world.id,c.id,id,'revert'),/已变化/)
  const reverted=decideInstanceProposal(saved,f.world.id,c.id,id,'revert')
  assert.equal(reverted.worlds[0].documents[0].entities.length,2);assert.equal(reverted.worlds[0].chat.conversations[0].messages[0].proposal!.status,'pending')
  assert.ok(decideInstanceProposal(reverted,f.world.id,c.id,id,true).worlds[0].documents[0].entities.some(e=>e.id===entity.id))
 }finally{off();f.detach()}
})

test('proposal batch saves and reverse rollback are atomic and preserve independent later content',async()=>{
 const f=fixture(),off=onInstanceProposal(event=>f.set(appendInstanceProposal(f.read(),event)))
 try{
  const before=entityMarkdown(f.world.documents[0].entities[0])
  for(const markdown of [before.replace('原值','建议外'),before.replace('内部','建议内')])await runTool(get('propose_instance_change'),{className:'物件',instanceName:'甲',markdown},f.world)
  const c=f.read().worlds[0].chat.conversations[0],ids=c.messages.map(m=>m.proposal!.id)
  const saved=decideInstanceProposals(f.read(),f.world.id,c.id,ids,true)
  assert.equal(saved.worlds[0].documents[0].entities[0].fields[0].value,'建议外')
  assert.equal(saved.worlds[0].documents[0].entities[0].fields[1].children[0].value,'建议内')
  const single=decideInstanceProposal(saved,f.world.id,c.id,ids[0],'revert');assert.equal(single.worlds[0].documents[0].entities[0].fields[0].value,'原值');assert.equal(single.worlds[0].documents[0].entities[0].fields[1].children[0].value,'建议内')
  const reverted=decideInstanceProposals(saved,f.world.id,c.id,ids,'revert')
  assert.equal(entityMarkdown(reverted.worlds[0].documents[0].entities[0]),before)
  const corrupted=structuredClone(f.read());corrupted.worlds[0].documents[0].entities[0].fields[1].children[0].value='用户新值'
  assert.throws(()=>decideInstanceProposals(corrupted,f.world.id,c.id,ids,true),/已变化/)
  assert.equal(corrupted.worlds[0].documents[0].entities[0].fields[0].value,'原值')
  const rejected=decideInstanceProposals(f.read(),f.world.id,c.id,ids,false);assert.ok(rejected.worlds[0].chat.conversations[0].messages.every(m=>m.proposal!.status==='rejected'))
 }finally{off();f.detach()}
})
