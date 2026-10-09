import test from 'node:test'
import assert from 'node:assert/strict'
import { commonFields, patchCommonFields } from '../src/model/bulkEdit'
import { Entity, FieldSchema, FieldValue } from '../src/model/types'

const rank:FieldSchema={id:'rank',key:'地位',keyType:'Const',valueType:'Text'}
const schemas:FieldSchema[]=[{id:'faction',key:'势力',keyType:'Const',valueType:'Object',children:[rank]}]
const person=(id:string,value:string):Entity=>({id,name:id,fields:[{id:`${id}-faction`,schemaId:'faction',key:'势力',value:'',children:[{id:`${id}-rank`,schemaId:'rank',key:'地位',value,children:[]}]}]})
test('multi-selection distinguishes shared and mixed nested values without borrowing one person’s value',()=>{
  const people=[person('a','弟子'),person('b','长老')],mixed=commonFields(people,schemas)
  assert.equal(mixed[0].mixed,true);assert.equal(mixed[0].field.value,'');assert.equal(mixed[0].path,'势力 / 地位')
  assert.deepEqual(mixed[0].ids,['a-rank','b-rank'])
  const equal=commonFields([person('a','弟子'),person('b','弟子')],schemas)
  assert.equal(equal[0].mixed,false);assert.equal(equal[0].field.value,'弟子')
})
test('batch edits preserve per-person IDs, unrelated fields and unselected people and serialize to Markdown',async()=>{
  const people=[person('a','弟子'),person('b','长老'),person('c','门主')]
  people[0].fields.push({id:'extra',schemaId:'extra',key:'私有信息',value:'retain',children:[]})
  const next=patchCommonFields(people,['a','b'],['a-rank','b-rank'],{value:'客卿'})
  assert.equal(next[0].fields[0].children[0].value,'客卿');assert.equal(next[1].fields[0].children[0].value,'客卿')
  assert.equal(next[0].fields[0].children[0].id,'a-rank');assert.equal(next[0].fields[1].value,'retain')
  assert.equal(next[2],people[2]);assert.equal(people[0].fields[0].children[0].value,'弟子')
  const {entityMarkdown}=await import('../src/model/markdown')
  assert.ok(entityMarkdown(next[0]).includes('客卿'));assert.ok(entityMarkdown(next[1]).includes('客卿'))
  assert.equal(patchCommonFields(next,['a','b'],['a-rank','b-rank'],{value:''})[1].fields[0].children[0].value,'')
})
test('ambiguous repeatable or missing members are excluded from bulk editors',()=>{
  const people=[person('a','弟子'),person('b','长老')]
  people[1].fields[0].children.push({...people[1].fields[0].children[0],id:'duplicate'})
  assert.deepEqual(commonFields(people,schemas),[])
  people[1].fields[0].children=[]
  assert.deepEqual(commonFields(people,schemas),[])
})
