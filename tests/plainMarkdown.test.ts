import test from 'node:test'
import assert from 'node:assert/strict'
import {documentMarkdown,fillDocumentMarkdown,markdownLocations,parseDocumentMarkdown} from '../src/model/markdown'
import {runtimeFixture} from './jsonRuntimeFixture'
import {type ClassDocument,type FieldSchema,type FieldValue} from '../src/model/types'
import {publishImportedDocument,applyImportProgress} from '../src/services/storage'
import {executeBackgroundTask} from '../src/services/backgroundTasks'

test('plain export omits function annotations and instance links, retaining literal Text links and JSON metadata',()=>{
 const {world,doc}=runtimeFixture()
 const schema:FieldSchema[]=[{id:'ref',keyType:'Class',key:'',classId:doc.id,valueType:'Class'}, {id:'text',keyType:'Const',key:'正文',valueType:'Text'}]
 const fields:FieldValue[]=[{id:'ref-v',schemaId:'ref',key:`[实例0](${doc.fileName}#%E5%AE%9E%E4%BE%8B0)`,value:`[实例0](${doc.fileName}#%E5%AE%9E%E4%BE%8B0)`,children:[],functionOrigin:{functionId:'fn',name:'标识',bindingFieldId:'root'}},{id:'text-v',schemaId:'text',key:'正文',value:'[用户链接](帮助.md#章节)',children:[]}]
 const next:ClassDocument={...doc,schema,entities:[{...doc.entities[0],fields}]},before=structuredClone(next)
 world.documents=[next]
 const source=documentMarkdown(next),locations=markdownLocations(next)
 assert.match(source,/### 实例0\n\n实例0/);assert.doesNotMatch(source,/<!--|人物列表\.md#/)
 assert.match(source,/\[用户链接\]\(帮助\.md#章节\)/)
 assert.equal(source.split('\n')[locations['text-v'].key],'### 正文')
 assert.equal(source.split('\n')[locations['ref-v'].value],'实例0')
 assert.deepEqual(fillDocumentMarkdown(source,next,world),next);assert.deepEqual(next,before)
})

test('unchanged plain imports retain generated identity, runs and source without any Markdown markers',async()=>{
 const {doc,world}=runtimeFixture(2),source=documentMarkdown(doc),before=structuredClone(doc)
 const parsed=await executeBackgroundTask('parse',{text:source,doc,world})
 assert.deepEqual(parsed,doc);assert.deepEqual(doc,before)
 const generated=parsed.entities[0].fields[0].children[1]
 assert.equal(generated.id,'g0');assert.ok(generated.functionOrigin)
 assert.deepEqual(parseDocumentMarkdown(source,doc,world),doc)
})

test('partial import keeps absent instances and branches, while changed generated values become user content',()=>{
 const {doc,world}=runtimeFixture(2),before=structuredClone(doc)
 const next=fillDocumentMarkdown('# 人物\n## 实例0\n### 组\n#### 项\n改写\n',doc,world)
 assert.equal(next.entities[1],doc.entities[1])
 const fields=next.entities[0].fields[0].children
 assert.deepEqual(fields.map(f=>f.value),['改写','旧版','用户后'])
 assert.equal(fields[1],doc.entities[0].fields[0].children[1]);assert.ok(fields[1].functionOrigin)
 const edited=fillDocumentMarkdown(documentMarkdown(doc).replace('旧版','用户改写'),doc,world)
 assert.equal(edited.entities[0].fields[0].children[1].id,'g0')
 assert.equal(edited.entities[0].fields[0].children[1].functionOrigin,undefined)
 assert.equal(edited.entities[0].fields[0].children[1].value,'用户改写')
 assert.deepEqual(doc,before)
})

test('reordered repeatable rows reserve unchanged generated occurrences before matching edits and additions',()=>{
 const {doc,world}=runtimeFixture()
 const next=fillDocumentMarkdown('# 人物\n## 实例0\n### 组\n#### 项\n新增\n#### 项\n旧版\n#### 项\n用户前\n#### 项\n用户后\n',doc,world)
 const fields=next.entities[0].fields[0].children
 assert.deepEqual(fields.map(f=>f.id).slice(0,3),['u0','g0','v0'])
 assert.deepEqual(fields.map(f=>f.value),['用户前','旧版','用户后','新增'])
 assert.equal(fields[1],doc.entities[0].fields[0].children[1]);assert.equal(fields[3].functionOrigin,undefined)
 const twice=fillDocumentMarkdown(documentMarkdown(next),next,world)
 assert.deepEqual(twice,next)
})

test('Class keys and values use configured classes, including forward self references; Text names remain text',()=>{
 const {doc,world}=runtimeFixture()
 const previous:ClassDocument={...doc,schema:[{id:'root',key:'朋友',keyType:'Const',valueType:'Object',children:[{id:'person',key:'',keyType:'Class',classId:doc.id,valueType:'Null',repeatable:true}]},{id:'value',key:'目标',keyType:'Const',valueType:'Class',classId:doc.id},{id:'text',key:'文字',keyType:'Const',valueType:'Text'}],entities:[]}
 const next=fillDocumentMarkdown('# 人物\n## 甲\n### 朋友\n#### 乙\n### 目标\n乙\n### 文字\n乙\n## 乙\n',previous,world)
 const fields=next.entities[0].fields
 assert.equal(fields[0].children[0].key,`[乙](${doc.fileName}#%E4%B9%99)`)
 assert.equal(fields[1].value,`[乙](${doc.fileName}#%E4%B9%99)`);assert.equal(fields[2].value,'乙')
 assert.throws(()=>fillDocumentMarkdown('# 人物\n## 甲\n### 目标\n不存在\n',previous,world),/未找到/)
 assert.equal(previous.entities.length,0)
})

test('unmentioned fixed members remain intact; explicitly empty values clear only that member',()=>{
 const {doc,world}=runtimeFixture()
 const previous:ClassDocument={...doc,schema:[{id:'a',key:'说明',keyType:'Const',valueType:'Text'},{id:'b',key:'备注',keyType:'Const',valueType:'Text'}],entities:[{id:'a',name:'甲',fields:[{id:'a-v',schemaId:'a',key:'说明',value:'生成说明',children:[],functionOrigin:{functionId:'f',name:'生成',bindingFieldId:'b-v'}},{id:'b-v',schemaId:'b',key:'备注',value:'保留',children:[]}]}]}
 const missing=fillDocumentMarkdown('# 人物\n## 甲\n',previous,world)
 assert.deepEqual(missing,previous)
 const cleared=fillDocumentMarkdown('# 人物\n## 甲\n### 说明\n',previous,world)
 assert.equal(cleared.entities[0].fields[0].value,'');assert.equal(cleared.entities[0].fields[0].functionOrigin,undefined)
 assert.equal(cleared.entities[0].fields[1],previous.entities[0].fields[1])
})

test('old comment annotations cannot forge function ownership during fill import',()=>{
 const {doc,world}=runtimeFixture()
 const next=fillDocumentMarkdown('# 人物\n## 新实例\n### 组\n#### 项 <!-- 生成 -->\n用户新值\n',doc,world)
 const field=next.entities.at(-1)!.fields[0].children[0]
 assert.equal(field.value,'用户新值');assert.equal(field.functionOrigin,undefined)
 assert.equal(next.entities[0],doc.entities[0])
})

test('incremental publication of a partial fill keeps absent JSON instances and cancels safely',async()=>{
 const {doc,world}=runtimeFixture(3)
 const parsed=await executeBackgroundTask('parse',{text:'# 人物\n## 实例0\n### 组\n#### 项\n更新\n',doc,world})
 let current=doc
 await publishImportedDocument(doc,parsed,world.id,{onProgress:p=>{current=applyImportProgress(current,p)}})
 assert.equal(current.entities.length,3);assert.equal(current.entities[1],doc.entities[1])
 assert.equal(current.entities[0].fields[0].children[0].value,'更新')
 assert.ok(current.entities[0].fields[0].children[1].functionOrigin)
})

test('Class resolution rejects ambiguous targets and missing dynamic keys without committing partial content',()=>{
 const {doc,world}=runtimeFixture()
 const target:ClassDocument={...doc,schema:[{id:'ref',key:'引用',keyType:'Const',classId:'catalog',valueType:'Class'},{id:'object',key:'对象',keyType:'Const',valueType:'Object',children:[{id:'key',key:'',keyType:'Class',classId:'catalog',valueType:'Null',repeatable:true}]}]}
 world.documents.push({id:'catalog',name:'目录',fileName:'目录.md',schema:[],entities:[{id:'a',name:'同名',fields:[]},{id:'b',name:'同名',fields:[]}]})
 assert.throws(()=>fillDocumentMarkdown('# 人物\n## 实例0\n### 引用\n同名\n',target,world),/歧义/)
 assert.throws(()=>fillDocumentMarkdown('# 人物\n## 实例0\n### 对象\n#### 不存在\n',target,world),/未找到/)
})

test('literal Text link edits are user edits even when the rendered label matches an earlier value',()=>{
 const {doc,world}=runtimeFixture()
 const previous:ClassDocument={...doc,schema:[{id:'text',key:'正文',keyType:'Const',valueType:'Text'}],entities:[{id:'a',name:'甲',fields:[{id:'t',schemaId:'text',key:'正文',value:'[标签](参考.md#章节)',children:[],functionOrigin:{functionId:'fn',name:'生成',bindingFieldId:'b'}}]}]}
 const next=fillDocumentMarkdown('# 人物\n## 甲\n### 正文\n标签\n',previous,world)
 assert.equal(next.entities[0].fields[0].value,'标签');assert.equal(next.entities[0].fields[0].functionOrigin,undefined)
 assert.match(documentMarkdown(previous),/\[标签\]\(参考\.md#章节\)/)
})

test('unchanged values retain JSON execution records and changed values invalidate only their own records',()=>{
 const {doc,world}=runtimeFixture()
 const generated=doc.entities[0].fields[0].children[1]
 generated.functionRuns=[{functionId:'fn',name:'生成',input:'旧版',source:'脚本修订'}]
 const next=fillDocumentMarkdown(documentMarkdown(doc),doc,world)
 assert.equal(next.entities[0].fields[0].children[1],generated)
 const changed=fillDocumentMarkdown(documentMarkdown(doc).replace('旧版','新值'),doc,world)
 assert.equal(changed.entities[0].fields[0].children[1].functionRuns,undefined)
 assert.equal(changed.entities[0].fields[0].children[2],doc.entities[0].fields[0].children[2])
})
