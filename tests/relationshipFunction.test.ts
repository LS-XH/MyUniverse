import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createWorld} from '../src/model/templates'
import {createFunction} from '../src/model/functions'
import {functionContext} from '../src/model/functionValues'
import {runFunctionValue} from '../src/services/functions'
import {bindScriptHost} from '../src/services/scriptHost'
import {FieldSchema, FieldValue, Workspace} from '../src/model/types'

test('relation Function appends inferred types to existing people and creates missing people rows using reverse rules',async()=>{
  const world=createWorld('关系测试'),people=world.documents.find(d=>d.id==='people')!,relations=world.documents.find(d=>d.id==='relations')!
  const link=(file:string,name:string)=>`[${name}](${file}#${encodeURIComponent(name)})`
  let serial=0
  const field=(schemaId:string,key:string,value='',children:FieldValue[]=[]):FieldValue=>({id:`f${++serial}`,schemaId,key,value,children})
  const fn={...createFunction([]),id:'relation-function',name:'关系路径推理',code:readFileSync('scripts/RelationEval-void.js','utf8')}
  const relItem:FieldSchema={id:'relation-item',keyType:'Class',key:'',valueType:'Null',classId:'relations',repeatable:true}
  const relField:FieldSchema={id:'relation-field',keyType:'Const',key:'关系',valueType:'Object',children:[relItem]}
  const story:FieldSchema={id:'story',keyType:'Const',key:'人物关系小故事',valueType:'Object',children:[{id:'story-item',keyType:'Text',key:'故事',valueType:'Content',repeatable:true}]}
  const rowSchema:FieldSchema={id:'person-row',keyType:'Class',key:'人物',valueType:'Object',classId:'people',repeatable:true,children:[relField,story]}
  const rootSchema:FieldSchema={id:'person-relations',keyType:'Const',key:'人物关系',valueType:'Object',children:[rowSchema],functionIds:[fn.id]}
  people.schema=[rootSchema]
  const ruleSchema:FieldSchema={id:'rule',keyType:'Class',key:'关系',valueType:'Class',classId:'relations',repeatable:true}
  relations.schema=[{id:'reasoning',keyType:'Const',key:'关系推理',valueType:'Object',children:[ruleSchema]},
    {id:'reverse',keyType:'Const',key:'关系反推',valueType:'Class',classId:'relations'}]
  const relation=(name:string,rules:[string,string][]=[],reverse='')=>({id:name,name,fields:[
    field('reasoning','关系推理','',rules.map(([second,result])=>field('rule',link('关系类型.md',second),link('关系类型.md',result)))),
    field('reverse','关系反推',reverse?link('关系类型.md',reverse):'')
  ]})
  relations.entities=[relation('妈妈',[['妈妈','奶奶']],'女儿'),relation('奶奶'),relation('姐姐'),relation('女儿'),relation('儿子',[],'妈妈')]
  const row=(target:string,types:string[])=>field('person-row',link('人物列表.md',target),'',[
    field('relation-field','关系','',types.map(name=>field('relation-item',link('关系类型.md',name)))),
    field('story','人物关系小故事')
  ])
  const person=(name:string,rows:FieldValue[])=>({id:name,name,fields:[field('person-relations','人物关系','',rows)]})
  people.entities=[person('甲',[row('乙',['妈妈']),row('丙',['姐姐'])]),person('乙',[row('丙',['妈妈']),row('甲',['女儿'])]),person('丙',[]),person('丁',[row('甲',['儿子'])])]
  let state:Workspace={worlds:[world],activeWorldId:world.id,functions:[fn]}
  const detach=bindScriptHost({get:()=>state,update:change=>{state=change(state)},save:async()=>{}})
  try{
    const context=functionContext(world,people,people.entities[0],people.entities[0].fields[0],rootSchema)
    await runFunctionValue(fn,'',world,context)
    const result=state.worlds[0].documents.find(d=>d.id==='people')!.entities[0].fields[0].children
    assert.equal(result.length,3)
    assert.deepEqual(result[1].children[0].children.map(x=>x.key),[link('关系类型.md','姐姐'),link('关系类型.md','奶奶')])
    assert.equal(result[1].children[0].children[1].functionOrigin?.bindingFieldId,people.entities[0].fields[0].id)
    assert.equal(result[2].key,link('人物列表.md','丁'))
    assert.equal(result[2].children[0].children[0].key,link('关系类型.md','妈妈'))
    assert.equal(result[2].children[1].key,'人物关系小故事')
    assert.equal(result[2].functionOrigin?.bindingFieldId,people.entities[0].fields[0].id)
    const count=JSON.stringify(result)
    const live=state.worlds[0],liveDoc=live.documents.find(d=>d.id==='people')!,liveField=liveDoc.entities[0].fields[0]
    await runFunctionValue(fn,'',live,functionContext(live,liveDoc,liveDoc.entities[0],liveField,rootSchema))
    assert.equal(JSON.stringify(state.worlds[0].documents.find(d=>d.id==='people')!.entities[0].fields[0].children),count)
  }finally{detach()}
})
