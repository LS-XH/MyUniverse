import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorld} from '../src/model/templates'
import {saveProjection,dirtyTreeItems,dirtyEntityItems} from '../src/model/manualSave'
import {applySyncResult} from '../src/services/storage'
import {bindScriptHost,beginScript} from '../src/services/scriptHost'
import {functionJobs,applyFunctionResult} from '../src/services/functions'
import {createFunction} from '../src/model/functions'
import {Workspace} from '../src/model/types'
const fixture=()=>{const w=createWorld('手动保存');return {worlds:[w],activeWorldId:w.id} as Workspace}
test('current-file save excludes other drafts and preferences save excludes every creation draft',()=>{
 const base=fixture(),current=structuredClone(base),world=current.worlds[0]
 world.documents.find(d=>d.id==='people')!.name='修改人物'
 world.documents.find(d=>d.id==='relations')!.name='修改关系'
 const submitted=saveProjection(current,base,{worldId:world.id,kind:'document',id:'people'})
 assert.equal(submitted.worlds[0].documents.find(d=>d.id==='people')!.name,'修改人物')
 assert.equal(submitted.worlds[0].documents.find(d=>d.id==='relations')!.name,'关系')
 assert.deepEqual(saveProjection(current,base).worlds,base.worlds)
 assert.equal(current.worlds[0].documents.find(d=>d.id==='relations')!.name,'修改关系')
 const merged=applySyncResult(submitted,current,submitted)
 assert.equal(merged.worlds[0].documents.find(d=>d.id==='relations')!.name,'修改关系')
 const dirty=dirtyTreeItems(current.worlds[0],submitted.worlds[0]),people=world.nodes.find(n=>n.type==='file'&&n.classId==='people')!,relations=world.nodes.find(n=>n.type==='file'&&n.classId==='relations')!
 assert.ok(!dirty.has(people.id));assert.ok(dirty.has(relations.id));assert.ok(dirty.has(world.id))
 assert.equal(dirtyTreeItems(base.worlds[0],base.worlds[0]).size,0)
})
test('manual script host applies generated mutations without invoking persistence',async()=>{
 let state=fixture(),saves=0
 const detach=bindScriptHost({autoSave:false,get:()=>state,update:change=>{state=change(state)},save:async()=>{saves++}})
 try{
  const session=beginScript(state.worlds[0]);session.world.get_class('people').set_markdown('# 人物\n\n## 手动草稿\n');await session.app.storage.save();await session.commit()
  assert.equal(state.worlds[0].documents.find(d=>d.id==='people')!.entities[0].name,'手动草稿');assert.equal(saves,0)
 }finally{detach()}
})
test('explicit refresh requests every bound function even when prior runs are current',()=>{
 const workspace=fixture(),doc=workspace.worlds[0].documents.find(d=>d.id==='people')!,schema=doc.schema.find(s=>s.valueType==='Text')!
 const fn=createFunction([]);schema.functionIds=[fn.id];workspace.functions=[fn]
 doc.entities=[{id:'a',name:'甲',fields:[{id:'f',schemaId:schema.id,key:schema.key,value:'原值',children:[]}]}]
 const job=functionJobs(workspace)[0];assert.ok(job)
 const completed=applyFunctionResult(workspace,job,{functionId:fn.id,name:fn.name,fileName:'test',input:job.input,value:'',source:job.source,contextKey:job.contextKey})
 assert.equal(functionJobs(completed).length,0);assert.equal(functionJobs(completed,true).length,1)
})

test('saving a current file preserves project order and directory save preserves other value drafts',()=>{
 const base=fixture(),second=createWorld('第二项目');base.worlds.push(second)
 const current=structuredClone(base),w=current.worlds[0]
 w.documents.find(d=>d.id==='people')!.entities=[{id:'a',name:'未保存人物',fields:[]}]
 const scope={worldId:w.id,kind:'document' as const,id:'people'}
 assert.deepEqual(saveProjection(current,base,scope).worlds.map(w=>w.id),base.worlds.map(w=>w.id))
 const directory=saveProjection(current,base,{worldId:w.id,kind:'world',id:w.id})
 assert.equal(directory.worlds[0].documents.find(d=>d.id==='people')!.entities.length,0)
})

test('instance markers follow saved content, order and labels without marking unrelated instances',()=>{
 const doc=fixture().worlds[0].documents.find(d=>d.id==='people')!
 doc.entities=[{id:'a',name:'甲',fields:[]},{id:'b',name:'乙',fields:[]}]
 const current=structuredClone(doc)
 current.entities[0].name='修改甲'
 assert.deepEqual([...dirtyEntityItems(current,doc)],['a'])
 assert.equal(dirtyEntityItems(doc,doc).size,0)
 current.entities[0].name='甲';current.name='类名修改'
 assert.equal(dirtyEntityItems(current,doc).size,0)
 current.entities.push({id:'c',name:'新增',fields:[]})
 assert.deepEqual([...dirtyEntityItems(current,doc)],['c'])
 current.entityLabels={a:'label'}
 assert.deepEqual([...dirtyEntityItems(current,doc)],['a','c'])
 assert.equal(dirtyEntityItems(current,current).size,0)
 current.entities.reverse()
 assert.deepEqual([...dirtyEntityItems(current,doc)],['c','a'])
})

test('creation save excludes configuration drafts and internal identity-only changes do not mark content',()=>{
 const base=fixture(),current=structuredClone(base),world=current.worlds[0]
 current.models=[{id:'draft',name:'草稿',model:'test',baseUrl:'http://localhost',apiKey:'',enabled:true}]
 const doc=world.documents.find(d=>d.id==='people')!,old=base.worlds[0].documents.find(d=>d.id==='people')!
 doc.entities=[{id:'a',name:'甲',fields:[{id:'field',schemaId:doc.schema[0].id,key:doc.schema[0].key,value:'',children:[]}]}]
 old.entities=structuredClone(doc.entities)
 doc.entities[0].fields[0].id='new-internal-identity'
 assert.equal(dirtyEntityItems(doc,old).size,0)
 const row=world.nodes.find(n=>n.classId===doc.id&&n.type==='file')!
 assert.ok(!dirtyTreeItems(world,base.worlds[0]).has(row.id))
 const projection=saveProjection(current,base,{worldId:world.id,kind:'document',id:doc.id})
 assert.deepEqual(projection.models,base.models)
 doc.entities[0].name='修改甲'
 assert.ok(dirtyEntityItems(doc,old).has('a'))
 doc.entities[0].name='甲'
 assert.equal(dirtyEntityItems(doc,old).size,0)
})
