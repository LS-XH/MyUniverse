import test from 'node:test'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {createWorld} from '../src/model/templates'
import {referenceIndex} from '../src/model/referenceIndex'
import {mergeThreeWay,sameData} from '../src/model/merge'
import {documentMarkdown,parseDocumentMarkdown} from '../src/model/markdown'

test('large document references invalidate on rename/delete and merges preserve independent edits',()=>{
 const world=createWorld('长文档性能'),template=world.documents[0]
 const entities=Array.from({length:2000},(_,i)=>({id:`entity-${i}`,name:`对象${i}`,fields:[]}))
 const doc={...template,entities},large={...world,documents:[doc]}
 const start=performance.now(),index=referenceIndex(large)
 for(let i=0;i<10000;i++)assert.equal(referenceIndex(large).byId.get('entity-1999')?.entity.name,'对象1999')
 const lookup=performance.now()-start
 const renamed={...large,documents:[{...doc,entities:entities.map(e=>e.id==='entity-1999'?{...e,name:'改名'}:e)}]}
 assert.equal(referenceIndex(renamed).byId.get('entity-1999')?.entity.name,'改名')
 assert.equal(index.byId.get('entity-1999')?.entity.name,'对象1999')
 assert.equal(referenceIndex({...large,documents:[{...doc,entities:entities.slice(0,-1)}]}).byId.has('entity-1999'),false)
 const payload='长文档内容'.repeat(40000),base={entities:entities.map(e=>({...e,text:payload,name:e.name}))}
 const local={entities:base.entities.map((e,i)=>i===0?{...e,name:'本地修改'}:e)}
 const remote={entities:base.entities.map((e,i)=>i===1999?{...e,name:'外部修改'}:e)}
 const mergeStart=performance.now(),merged=mergeThreeWay(base,local,remote)
 assert.deepEqual(merged.conflicts,[]);assert.equal(merged.value.entities[0].name,'本地修改');assert.equal(merged.value.entities[1999].name,'外部修改')
 assert.equal(sameData({a:undefined,b:1},{b:1}),true)
 assert.equal(sameData({a:1,b:2},{b:2,a:1}),true)
 const merge=performance.now()-mergeStart
 const text=`# ${template.name}\n\n## 长文本实例\n\n### 内容\n\n${payload}\n`
 const parseStart=performance.now(),parsed=parseDocumentMarkdown(text,{...template,schema:[{id:'content',key:'内容',keyType:'Const' as const,valueType:'Content' as const}],entities:[]},world)
 assert.ok(documentMarkdown(parsed).includes(payload))
 console.log(`性能样本：${payload.length} 字；2000 实例；10000 次索引查询 ${lookup.toFixed(2)}ms；独立修改合并 ${merge.toFixed(2)}ms；长文解析/导出 ${(performance.now()-parseStart).toFixed(2)}ms`)
})
