import test from 'node:test'
import assert from 'node:assert/strict'
import { createModel, deleteModel, modelReady } from '../src/model/models'
import { createWorld } from '../src/model/templates'
import { normalizeWorkspace } from '../src/model/themes'

test('model deletion clears its selection across worlds and preserves other models',()=>{
  const first=createModel([]),second=createModel([first]),a=createWorld('A'),b=createWorld('B')
  a.chat.modelId=first.id;b.chat.modelId=second.id
  const next=deleteModel({worlds:[a,b],activeWorldId:a.id,models:[first,second]},first.id)
  assert.equal(next.worlds[0].chat.modelId,null)
  assert.equal(next.worlds[1].chat.modelId,second.id)
  assert.deepEqual(next.models,[second])
  assert.notEqual(first.name,second.name)
})
test('legacy workspaces acquire an empty model list; configured and disabled model states persist',()=>{
  const world=createWorld('Old'),old=normalizeWorkspace({worlds:[world],activeWorldId:world.id})
  assert.deepEqual(old.models,[])
  const model={...createModel([]),baseUrl:'http://localhost:1234/v1',model:'local-model',enabled:false}
  const restored=normalizeWorkspace(JSON.parse(JSON.stringify({...old,models:[model]})))
  assert.equal(restored.models![0].enabled,false)
  assert.ok(modelReady(model))
  assert.equal(modelReady({...model,baseUrl:'not an address'}),false)
  assert.equal(modelReady({...model,model:''}),false)
})
