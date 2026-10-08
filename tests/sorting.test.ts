import test from 'node:test'
import assert from 'node:assert/strict'
import { reorder } from '../src/ui/SortHandle'
import { documentMarkdown, parseDocumentMarkdown } from '../src/model/markdown'
import { createWorld } from '../src/model/templates'

test('sorting moves before and after siblings without mutating data or crossing parents',()=>{
  const items=[{id:'a'},{id:'b'},{id:'c'}]
  assert.deepEqual(reorder(items,'a','c',true).map(x=>x.id),['b','c','a'])
  assert.deepEqual(reorder(items,'c','a',false).map(x=>x.id),['c','a','b'])
  assert.equal(reorder(items,'a','outside',true),items)
  assert.equal(reorder(items,'a','b',false),items)
  assert.deepEqual(items.map(x=>x.id),['a','b','c'])
})
test('entity sorting survives Markdown serialization and reload with identity and fields intact',()=>{
  const world=createWorld('排序测试'),template=world.documents.find(doc=>doc.id==='people')!
  const doc=parseDocumentMarkdown('# 人物\n## 甲\n### 人物性格\n谨慎\n## 乙\n### 人物性格\n开朗\n## 丙\n',template,world)
  const sorted={...doc,entities:reorder(doc.entities,doc.entities[0].id,doc.entities[2].id,true)}
  assert.deepEqual(parseDocumentMarkdown(documentMarkdown(sorted),sorted,world),sorted)
  assert.deepEqual(sorted.entities.map(e=>e.name),['乙','丙','甲'])
})
