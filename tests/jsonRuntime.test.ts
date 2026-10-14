import test from 'node:test'
import assert from 'node:assert/strict'
import {runtimeFixture} from './jsonRuntimeFixture'
import {lineDiff} from '../src/model/textDiff'
import {retainReferences} from '../src/model/merge'
import {publishImportedDocument,applyImportProgress} from '../src/services/storage'
import {executeBackgroundTask} from '../src/services/backgroundTasks'
import {functionJobs} from '../src/services/functions'
import {documentMarkdown} from '../src/model/markdown'
import {reconcileChangedFunctionBindings} from '../src/model/functionAppend'

test('large dispersed function changes preserve unchanged Markdown rather than wholesale replacement',()=>{
 const before=Array.from({length:1500},(_,i)=>`## 实例${i}\n### 属性\n原值\n### 保留\n其他内容${i}`).join('\n')
 const after=before.replaceAll('原值','新值'),rows=lineDiff(before,after,true)
 assert.equal(rows.filter(r=>r.after!==undefined).map(r=>r.text).join('\n'),after)
 assert.equal(rows.filter(r=>r.before!==undefined).map(r=>r.text).join('\n'),before)
 assert.equal(rows.filter(r=>r.kind==='add').length,1500)
 assert.equal(rows.filter(r=>r.kind==='remove').length,1500)
 assert.ok(rows.filter(r=>r.kind==='context').length>=6000)
})
test('background function recomputation retains generated slot, stable identity and user siblings',async()=>{
 const {workspace,world,doc,fn}=runtimeFixture(),job=functionJobs(workspace,true,{worldId:world.id,docId:doc.id,entityId:'e0'})[0]
 const computed=await executeBackgroundTask('function',{world,fn,job});assert.ok(computed.entity);const children=computed.entity.fields[0].children
 assert.deepEqual(children.map(f=>f.id),['u0','g0','v0'])
 assert.deepEqual(children.map(f=>f.value),['用户前','新版','用户后'])
 assert.equal(doc.entities[0].fields[0].children[1].value,'旧版')
 const shared=retainReferences(doc.entities[0],computed.entity)
 assert.equal(shared.fields[0].children[0],doc.entities[0].fields[0].children[0])
 assert.equal(shared.fields[0].children[2],doc.entities[0].fields[0].children[2])
})
test('incremental import yields between cards, preserves current schema identity and stops after cancellation',async()=>{
 const {doc,world}=runtimeFixture(3),parsed=structuredClone(doc),controller=new AbortController(),counts:number[]=[]
 parsed.entities.forEach(e=>{e.name+='新'})
 let turn=false;setTimeout(()=>{turn=true},0)
 await assert.rejects(publishImportedDocument(doc,parsed,world.id,{signal:controller.signal,onProgress:p=>{
  counts.push(p.completed);assert.equal(p.document.schema,doc.schema)
  if(p.completed===2){assert.equal(turn,true);controller.abort()}
 }}),/已取消/)
 assert.deepEqual(counts,[1,2]);assert.equal(doc.entities[0].name,'实例0')
})
test('scoped export skips invalid unrelated Markdown and background preview returns consistent rows and locations',async()=>{
 const {workspace,world,doc}=runtimeFixture()
 world.documents[1].entities=[{id:'bad',name:'',fields:[]}]
 const files=await executeBackgroundTask('export',{workspace,scope:{worldId:world.id,kind:'document',id:doc.id}})
 assert.ok(files[world.id][doc.fileName]);assert.equal(files[world.id][world.documents[1].fileName],undefined)
 const preview=await executeBackgroundTask('preview',{doc,baselineDocument:doc})
 assert.equal(preview.source,documentMarkdown(doc));assert.ok(preview.rows.every(r=>r.kind==='context'))
 assert.equal(preview.source.split('\n')[preview.locations.e0.key],'## 实例0')
})
test('incremental binding reconciliation cleans only changed orphaned members and preserves other instances',()=>{
 const {workspace,doc}=runtimeFixture(),entity=doc.entities[0]
 const changed={...workspace,worlds:workspace.worlds.map(w=>({...w,documents:w.documents.map(d=>d.id===doc.id?{...d,entities:d.entities.map(e=>e===entity?{...e,fields:e.fields[0].children}:e)}:d)}))}
 const result=reconcileChangedFunctionBindings(workspace,changed),next=result.worlds[0].documents[0]
 assert.deepEqual(next.entities[0].fields.map(f=>f.id),['u0','v0'])
 assert.equal(next.entities[1],doc.entities[1])
 assert.equal(result.worlds[0].documents[1],workspace.worlds[0].documents[1])
})
test('background JS tools stage validated JSON mutations and reject read-only writes',async()=>{
 const {world}=runtimeFixture()
 const tool={id:'custom',name:'自定义',kind:'js' as const,enabled:true,url:'',method:'POST' as const,apiKey:'',code:'function execute(params,app){app.world.get_class("people").get_instance("e0").get_member("root0").get_member("u0").set_value(params.text);return {ok:true};}',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']}}
 const result=await executeBackgroundTask('tool',{world,tool,parameters:{text:'后台工具'}})
 assert.deepEqual(result.value,{ok:true})
 assert.equal(result.world!.documents[0].entities[0].fields[0].children[0].value,'后台工具')
 assert.equal(world.documents[0].entities[0].fields[0].children[0].value,'用户前')
 await assert.rejects(executeBackgroundTask('tool',{world,tool:{...tool,annotations:{readOnlyHint:true}},parameters:{text:'拒绝'}}),/读取/)
})
test('progressive instance commits preserve completed-card edits, unrelated fields and shared references',async()=>{
 const {doc,world}=runtimeFixture(),parsed=structuredClone(doc)
 parsed.entities.forEach(e=>{e.fields[0].children[1].value='导入生成值'})
 let current=doc
 await publishImportedDocument(doc,parsed,world.id,{onProgress:p=>{
  const unchanged=current.entities[1]
  current=applyImportProgress(current,p)
  if(p.completed===1&&p.entity){assert.equal(current.entities[1],unchanged);current={...current,entities:current.entities.map(e=>e.id==='e0'?{...e,name:'导入后继续编辑'}:e)}}
 }})
 assert.equal(current.entities[0].name,'导入后继续编辑')
 assert.equal(current.entities[0].fields[0].children[0],doc.entities[0].fields[0].children[0])
 assert.equal(current.entities[1].fields[0].children[1].value,'导入生成值')
 const edited=structuredClone(doc);edited.entities[0].fields[0].children[1].value='并发更改'
 assert.throws(()=>applyImportProgress(edited,{worldId:world.id,docId:doc.id,before:doc,document:parsed,entity:parsed.entities[0],beforeEntity:doc.entities[0],completed:1,total:2}),/目标成员被修改/)
})
test('archive JSON decoding and normalization run as a background task without Markdown input',async()=>{
 const {workspace}=runtimeFixture(),result=await executeBackgroundTask('normalize',JSON.stringify({...workspace,archiveVersion:2}))
 assert.equal(result.archiveVersion,2)
 assert.equal(result.worlds[0].documents[0].entities[0].fields[0].children[1].id,'g0')
 await assert.rejects(executeBackgroundTask('normalize','broken'),/JSON|Unexpected/)
 await assert.rejects(executeBackgroundTask('normalize','{}'),/存档结构无效/)
 await assert.rejects(executeBackgroundTask('normalize','[]'),/存档结构无效/)
})
