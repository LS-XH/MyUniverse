import test from 'node:test'
import assert from 'node:assert/strict'
import {moveTreeItem} from '../src/model/treeMoves'
import {createWorld} from '../src/model/templates'
import {Workspace} from '../src/model/types'
const fixture=():Workspace=>({worlds:[{...createWorld('测试'),id:'w',nodes:[{id:'a',name:'A',type:'collection',parentId:null},{id:'b',name:'B',type:'collection',parentId:'a'},{id:'file',name:'文件',type:'file',parentId:'a',classId:'people'}]}],activeWorldId:'w',pluginFolders:[{id:'a',name:'A',section:'functions',parentId:null},{id:'b',name:'B',section:'functions',parentId:'a'}],functions:[{id:'fn',name:'测试',language:'js',code:'return input',folderId:'a'}]})
test('tree moves preserve document and script identities while changing logical parents',()=>{
  const original=fixture(),world=moveTreeItem(original,'world:w:file','world:w:b',true,false)
  assert.equal(world.worlds[0].nodes.find(n=>n.id==='file')?.parentId,'b');assert.equal(world.worlds[0].documents,original.worlds[0].documents)
  const plugins=moveTreeItem(original,'plugin:functions:function:fn','plugin:functions:folder:b',true,false)
  assert.equal(plugins.functions?.[0].folderId,'b');assert.equal(plugins.functions?.[0].code,original.functions?.[0].code)
  assert.equal(original.functions?.[0].folderId,'a')
})
test('tree folders reject cycles, foreign worlds, and plugin categories',()=>{
  const original=fixture()
  assert.deepEqual(moveTreeItem(original,'world:w:a','world:w:b',true,false),original)
  assert.deepEqual(moveTreeItem(original,'world:w:file','world:other:b',true,false),original)
  assert.deepEqual(moveTreeItem(original,'plugin:functions:folder:a','plugin:functions:folder:b',true,false),original)
  assert.deepEqual(moveTreeItem(original,'plugin:functions:function:fn','plugin:tools:folder:root',true,false),original)
})
test('tree edge drops place siblings and can move items back to the root',()=>{
  const original=fixture(),next=moveTreeItem(original,'world:w:file','world:w:a',false,true)
  assert.equal(next.worlds[0].nodes.find(n=>n.id==='file')?.parentId,null)
  assert.deepEqual(next.worlds[0].nodes.filter(n=>n.parentId===null).map(n=>n.id),['a','file'])
  const plugins=moveTreeItem(original,'plugin:functions:function:fn','plugin:functions:folder:a',false,false)
  assert.equal(plugins.functions?.[0].folderId,null)
  assert.ok(plugins.sidebarTreeOrder!.indexOf('plugin:functions:function:fn')<plugins.sidebarTreeOrder!.indexOf('plugin:functions:folder:a'))
  assert.equal(JSON.parse(JSON.stringify(plugins)).sidebarTreeOrder[0],'plugin:functions:function:fn')
})
test('models and worlds retain independent identities when reordered',()=>{
  const original={...fixture(),models:[{id:'1',name:'1',model:'',baseUrl:'',apiKey:'',enabled:true},{id:'2',name:'2',model:'',baseUrl:'',apiKey:'',enabled:true}]}
  assert.deepEqual(moveTreeItem(original,'model:llm:1','model:llm:2',false,true).models?.map(m=>m.id),['2','1'])
  assert.deepEqual(moveTreeItem(original,'model:llm:1','model:agents:2',false,true),original)
  assert.deepEqual(moveTreeItem(original,'model:llm:1','model:llm:missing',false,true),original)
  const worlds={...original,worlds:[...original.worlds,{...createWorld('另一个世界'),id:'w2'}]}
  assert.deepEqual(moveTreeItem(worlds,'world:w:root','world:w2:root',false,true).worlds.map(w=>w.id),['w2','w'])
})
