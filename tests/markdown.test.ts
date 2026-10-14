import {bindScriptHost} from '../src/services/scriptHost'
import test from 'node:test'
import assert from 'node:assert/strict'
import { ClassDocument, Workspace, World } from '../src/model/types'
import { createWorld } from '../src/model/templates'
import { documentMarkdown, markdownLocations, markdownHeadingLevels, parseDocumentMarkdown } from '../src/model/markdown'
import {referenceText} from '../src/model/referenceText'
import { mergeThreeWay } from '../src/model/merge'
import { loadWorkspace, saveWorkspace, refreshWorkspace,  applySyncResult, checkpointWorkspace, archivedWorkspace } from '../src/services/storage'

function fixture() {
  const world = createWorld('测试世界')
  world.documents.find(d=>d.id==='relations')!.entities=[{id:'friend',name:'朋友',fields:[]}]
  world.documents.find(d=>d.id==='factions')!.entities=[{id:'qingshan',name:'青山',fields:[]}]
  const template = world.documents.find(d => d.id === 'people')!
  // Retain explicit coverage of the historical Class-value relationship schema.
  const legacyRelation=template.schema.find(s=>s.key==='人物关系')!.children![0].children!.find(s=>s.key==='关系')!
  legacyRelation.valueType='Class';legacyRelation.classId='relations';legacyRelation.children=undefined;legacyRelation.repeatable=true
  const text = '# 人物\n\n## 林青\n\n### 人物关系\n\n#### [沈白](人物列表.md#沈白)\n\n##### 关系\n\n[朋友](关系类型.md#朋友)\n\n##### 人物关系小故事\n\n###### 初遇\n\n```md\n## code, not an entity\n```\n\n### 人物势力\n\n#### 势力名称\n\n[青山](势力列表.md#青山)\n\n#### 势力地位\n\n队长\n\n### 人物性格\n\n谨慎\n\n### 人物喜好\n\n读书\n\n## 沈白\n\n### 人物性格\n\n开朗\n'
  const doc = parseDocumentMarkdown(text, template, world)
  world.documents = world.documents.map(d => d.id === doc.id ? doc : d)
  const workspace: Workspace = { worlds: [world], activeWorldId: world.id }
  return { world, doc, workspace, text }
}
const value = (doc: ClassDocument, key: string, entity = 0) => doc.entities[entity].fields.find(f => f.key === key)!.value
function edit(workspace: Workspace, key: string, text: string): Workspace {
  const next = structuredClone(workspace)
  next.worlds[0].documents.find(d => d.id === 'people')!.entities[0].fields.find(f => f.key === key)!.value = text
  return next
}
test('nested objects, Class keys/values, code fences and IDs survive a round trip', () => {
  const { doc, world } = fixture()
  const roundtrip = parseDocumentMarkdown(documentMarkdown(doc), doc, world)
  assert.deepEqual(roundtrip, doc)
  assert.equal(doc.entities.length, 2)
  const relation = doc.entities[0].fields.find(f => f.key === '人物关系')!.children[0]
  assert.equal(relation.children.find(f => f.key === '关系')!.value, '[朋友](关系类型.md#%E6%9C%8B%E5%8F%8B)')
})
test('Markdown locations distinguish nested keys, multiline values and entity names',()=>{
  const {doc}=fixture(),lines=documentMarkdown(doc).split('\n'),locations=markdownLocations(doc)
  for(const entity of doc.entities){
    assert.equal(lines[locations[entity.id].key],`## ${entity.name}`)
    const visit=(fields:typeof entity.fields,depth:number)=>fields.forEach(field=>{
      const location=locations[field.id]
      assert.equal(lines[location.key],`${'#'.repeat(depth)} ${referenceText(field.key)}`)
      if(field.value)assert.equal(lines.slice(location.value,location.end+1).join('\n'),referenceText(field.value))
      visit(field.children,depth+1)
    })
    visit(entity.fields,3)
  }
})
test('heading display respects code fences, escaped headings and deep object levels',()=>{
  assert.deepEqual(markdownHeadingLevels('# 类\n## 实例\n```md\n# 正文\n```\n\\### 转义\n#### 属性\n####### 深层'),[1,2,0,0,0,0,4,7])
})
test('text headings, escapes, Markdown body and nesting deeper than six are preserved', () => {
  const template: ClassDocument = { id: 'story', name: '故事', fileName: '故事.md', schema: [{ id: 'body', keyType: 'Const', key: '正文', valueType: 'Content' }], entities: [] }
  let doc = parseDocumentMarkdown('# 故事\n## 第一章\n开场正文\n### 正文\n故事\n#### 章节小标题\n后续文字\n', template)
  assert.equal(value(doc, '正文'), '故事\n#### 章节小标题\n后续文字')
  doc.entities[0].fields.find(f => f.key === '正文')!.value += '\n## 正文内的二级标题\n\\# 原有转义\n~~~md\n# fenced heading\n~~~'
  assert.deepEqual(parseDocumentMarkdown(documentMarkdown(doc), doc), doc)
  const deep = parseDocumentMarkdown('# 故事\n## 章节\n### 一\n#### 二\n##### 三\n###### 四\n####### 五\n######## 六\n叶子内容\n', { ...template, schema: ['一','二','三','四','五','六'].reduceRight<import('../src/model/types').FieldSchema[]>((children,key,i)=>[{id:String(i),keyType:'Const',key,valueType:children.length?'Object':'Content',...(children.length?{children}:{})}],[]) })
  assert.deepEqual(parseDocumentMarkdown(documentMarkdown(deep), deep), deep)
  assert.ok(!doc.schema.some(s=>s.key==='内容'))
})
test('unknown properties and duplicate nonrepeatable headings never change configured schema', () => {
  const { doc, world } = fixture()
  const imported = parseDocumentMarkdown(documentMarkdown(doc) + '\n### 外号\n白衣\n#### 未知子项\n内容\n### 外号\n剑客\n### 人物性格\n重复项\n', doc, world)
  assert.deepEqual(imported.schema,doc.schema)
  assert.ok(!imported.entities.some(e=>e.fields.some(f=>f.key==='外号')))
  assert.equal(imported.entities[1].fields.filter(f=>f.key==='人物性格').length,1)
  assert.equal(imported.entities[1].fields.find(f=>f.key==='人物性格')!.value,'开朗')
  assert.deepEqual(parseDocumentMarkdown(documentMarkdown(imported), imported, world), imported)
})

test('removal clears fixed values without changing their IDs; entity rename retains identity', () => {
  const { doc, world } = fixture()
  const parsed = parseDocumentMarkdown('# 人物\n## 林青改名\n## 沈白\n', doc, world)
  assert.equal(parsed.entities[0].id, doc.entities[0].id)
  assert.equal(value(parsed, '人物性格'), '')
  const getFaction = (d: ClassDocument) => d.entities[0].fields.find(f => f.key === '人物势力')!
  assert.equal(getFaction(parsed).children[0].id, getFaction(doc).children[0].id)
})
test('invalid structure, ambiguous duplicate entities and invalid typed data are rejected', () => {
  const { doc } = fixture()
  for (const text of ['', 'ordinary text', '# 人物\n## A\n## A\n', '# 人物\nclass body\n## A\n', '# A\n# B\n']) assert.throws(() => parseDocumentMarkdown(text, doc))
  const typed = { ...doc, schema: [{ id: 'number', keyType: 'Const' as const, key: '数量', valueType: 'Integer' as const }] }
  assert.throws(() => parseDocumentMarkdown('# 人物\n## A\n### 数量\nabc\n', typed), /整数/)
})
test('three-way merge preserves independent edits, additions and deletions and detects competing edits', () => {
  const { workspace } = fixture()
  const local = edit(workspace, '人物性格', '沉稳'), remote = edit(workspace, '人物喜好', '棋')
  const merged = mergeThreeWay(workspace, local, remote)
  assert.equal(merged.conflicts.length, 0)
  const doc = merged.value.worlds[0].documents.find(d => d.id === 'people')!
  assert.equal(value(doc, '人物性格'), '沉稳'); assert.equal(value(doc, '人物喜好'), '棋')
  const competing = mergeThreeWay(workspace, local, edit(workspace, '人物性格', '冷静'))
  assert.equal(competing.conflicts.length, 1)
  const removed = structuredClone(workspace)
  removed.worlds[0].documents.find(d => d.id === 'people')!.entities.shift()
  assert.equal(mergeThreeWay(workspace, local, removed).conflicts.length, 1)
  const untouched = mergeThreeWay(workspace, workspace, removed)
  assert.equal(untouched.value.worlds[0].documents.find(d => d.id === 'people')!.entities.length, 1)
})

type Disk = Record<string, Record<string, string | null>>
function mockDisk(workspace: Workspace, override?: string) {
  const files: Disk = Object.fromEntries(workspace.worlds.map(w => [w.id, Object.fromEntries(w.documents.map(d => [d.fileName, d.id === 'people' && override !== undefined ? override : documentMarkdown(d)]))]))
  let savedJSON=structuredClone(workspace),archives=0; let reads=0; let saves = 0, race: (() => void) | undefined
  Object.assign(globalThis, { isTauri: true, window: { __TAURI_INTERNALS__: { invoke: async (command: string, args: any) => {
    if (command === 'load_workspace') return structuredClone(savedJSON)
    if (command === 'checkpoint_workspace') {savedJSON=JSON.parse(args.text);archives++;return}
    if (command === 'read_document_files') {reads++;return Object.fromEntries(Object.entries(args.requests as Record<string, string[]>).map(([id, names]) => [id, Object.fromEntries(names.map(name => [name, files[id]?.[name] ?? null]))]))}
    if (command === 'export_workspace') {
      if (race) { const action = race; race = undefined; action() }
      for (const [id, output] of Object.entries(args.files as Record<string, Record<string, string>>)) files[id] = { ...files[id], ...output }
      saves++
      return
    }
    throw new Error(`Unexpected command ${command}`)
  } } } })
  return { files,get archives(){return archives},get archive(){return savedJSON},get reads(){return reads}, get saves() { return saves }, race(action: () => void) { race = action } }
}
const person = (workspace: Workspace) => workspace.worlds[0].documents.find(d => d.id === 'people')!
test('startup reads only authoritative JSON and explicit import reads Markdown', async () => {
  const { workspace, world } = fixture()
  const disk = mockDisk(workspace, documentMarkdown(person(edit(workspace, '人物性格', '来自磁盘'))))
  const loaded = await loadWorkspace()
  assert.equal(value(person(loaded), '人物性格'), value(person(workspace),'人物性格'))
  assert.equal(disk.reads,0)
  await saveWorkspace(loaded)
  disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(loaded, '人物喜好', '外部编辑')))
  const refreshed = await refreshWorkspace(loaded)
  assert.equal(value(person(refreshed), '人物喜好'), '外部编辑')
})
test('explicit saves never read or merge Markdown, even broken files; refresh alone imports it',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace()
 const local=edit(loaded,'人物性格','界面编辑'),reads=disk.reads
 disk.files[world.id]['人物列表.md']='broken external content'
 const saved=await saveWorkspace(local)
 assert.equal(disk.reads,reads)
 assert.match(disk.files[world.id]['人物列表.md']!,/界面编辑/)
 assert.equal(value(person(applySyncResult(local,edit(local,'人物性格','继续输入'),saved)),'人物性格'),'继续输入')
 disk.files[world.id]['人物列表.md']=documentMarkdown(person(edit(loaded,'人物性格','磁盘新版')))
 const refreshed=await refreshWorkspace(local)
 assert.equal(value(person(refreshed),'人物性格'),'磁盘新版')
 assert.ok(disk.reads>reads)
 disk.files[world.id]['人物列表.md']='broken'
 await assert.rejects(refreshWorkspace(refreshed),/未导入无效内容|界面配置/)
})
test('queued saves write their submitted snapshots in order without disk merges',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace(),reads=disk.reads
 disk.race(()=>{disk.files[world.id]['人物列表.md']='external change'})
 await Promise.all([saveWorkspace(edit(loaded,'人物性格','一')),saveWorkspace(edit(loaded,'人物性格','二'))])
 assert.equal(disk.reads,reads)
 assert.match(disk.files[world.id]['人物列表.md']!,/二/)
})
test('model settings and chat selection survive simultaneous external Markdown updates',async()=>{
  const {workspace,world}=fixture(),disk=mockDisk(workspace)
  const loaded=await loadWorkspace();await saveWorkspace(loaded)
  const local=structuredClone(loaded)
  local.models=[{id:'connection',name:'本地模型',model:'local',baseUrl:'http://localhost:1234/v1',apiKey:'',enabled:true}]
  local.worlds[0].chat.modelId='connection'
  local.functions=[{id:'trim-function',name:'去除空格',language:'js',code:'function transform(input){return input.trim();}'}]
  local.pluginFolders=[{id:'plugin-folder',name:'文本处理',section:'functions',parentId:null}]
  local.functions[0].folderId='plugin-folder'
  disk.files[world.id]['人物列表.md']=documentMarkdown(person(edit(loaded,'人物性格','外部修改')))
  const saved=await saveWorkspace(local)
  assert.deepEqual(saved.models,local.models)
  assert.deepEqual(saved.functions,local.functions)
  assert.deepEqual(saved.pluginFolders,local.pluginFolders)
  assert.equal(saved.worlds[0].chat.modelId,'connection')
  assert.equal(value(person(saved),'人物性格'),value(person(local),'人物性格'))
})


test('view configuration is imported only on refresh, with malformed refresh rejected',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace()
 await saveWorkspace(loaded)
 const id=world.nodes.find(n=>n.viewType==='graph')!.id,file=loaded.worlds[0].views![id].fileName
 const local=structuredClone(loaded);local.worlds[0].views![id].graph.showDomains=false
 const remote=structuredClone(loaded.worlds[0].views![id]);remote.name='外部图'
 disk.files[world.id][file]=JSON.stringify(remote)
 const saved=await saveWorkspace(local)
 assert.equal(saved.worlds[0].views![id].name,local.worlds[0].views![id].name)
 disk.files[world.id][file]=JSON.stringify(remote)
 const fresh=await refreshWorkspace(saved)
 assert.equal(fresh.worlds[0].views![id].name,'外部图')
 disk.files[world.id][file]='broken';const count=disk.saves
 await assert.rejects(refreshWorkspace(fresh),/未导入无效内容|界面配置/);assert.equal(disk.saves,count)
})
test('unknown nested subtrees and unbound functions are ignored without altering schema',()=>{
  const {doc,world}=fixture(),source=documentMarkdown(doc).replace('### 人物势力','### 人物势力\n\n#### 未配置属性\n\n忽略内容\n\n##### 嵌套未知项\n\n42\n').replace('### 人物性格\n\n谨慎','### 人物性格\n\n谨慎\n\n#### [未绑定函数](../../functions/unknown.js)\n\n忽略结果')
  const parsed=parseDocumentMarkdown(source,doc,world)
  assert.deepEqual(parsed.schema,doc.schema)
  assert.deepEqual(parsed.entities,doc.entities)
  assert.deepEqual(doc.schema,world.documents.find(d=>d.id===doc.id)!.schema)
})


test('manual refresh replaces the selected draft from disk, preserves other drafts and never saves',async()=>{
 const {reloadCreationFile}=await import('../src/services/storage')
 const {saveProjection}=await import('../src/model/manualSave')
 const {workspace,world}=fixture(),disk=mockDisk(workspace)
 const loaded=await loadWorkspace();await saveWorkspace(loaded)
 let local=edit(loaded,'人物性格','未保存草稿')
 local={...local,worlds:local.worlds.map(w=>({...w,documents:w.documents.map(d=>d.id==='relations'?{...d,name:'未保存关系类型名'}:d)}))}
 disk.files[world.id][person(loaded).fileName]=documentMarkdown(person(edit(loaded,'人物性格','磁盘新版')))
 const count=disk.saves,refreshed=await reloadCreationFile(local,{worldId:world.id,kind:'document',id:'people'})
 assert.equal(value(person(refreshed),'人物性格'),'磁盘新版')
 assert.equal(refreshed.worlds[0].documents.find(d=>d.id==='relations')!.name,'未保存关系类型名')
 assert.equal(disk.saves,count)
 const submitted=saveProjection(refreshed,loaded,{worldId:world.id,kind:'document',id:'people'})
 await saveWorkspace(submitted)
 assert.equal(disk.saves,count+1)
})

test('preferences persistence cannot consume an unsaved import or overwrite its broken disk file',async()=>{
 const {saveProjection}=await import('../src/model/manualSave')
 const {workspace,world}=fixture(),disk=mockDisk(workspace)
 const loaded=await loadWorkspace();await saveWorkspace(loaded)
 const file=person(loaded).fileName;disk.files[world.id][file]='broken file'
 const imported=edit(loaded,'人物性格','有效导入'),count=disk.saves
 const reads=disk.reads
 await saveWorkspace(saveProjection(imported,loaded),[],'preferences')
 assert.equal(disk.reads,reads)
 assert.equal(disk.saves,count+1);assert.equal(disk.files[world.id][file],'broken file')
 await saveWorkspace(imported,[`${world.id}/people`])
 assert.match(disk.files[world.id][file],/有效导入/)
})

test('manual view refresh validates against the complete world class catalog and keeps document drafts',async()=>{
 const {reloadCreationFile}=await import('../src/services/storage')
 const {workspace,world}=fixture(),disk=mockDisk(workspace)
 const loaded=await loadWorkspace();await saveWorkspace(loaded)
 const view=Object.values(loaded.worlds[0].views!).find(v=>v.kind==='graph')!
 const changed={...view,graph:{...view.graph,showLabels:false}}
 disk.files[world.id][view.fileName]=JSON.stringify(changed)
 const draft=edit(loaded,'人物性格','保留草稿'),count=disk.saves
 const result=await reloadCreationFile(draft,{worldId:world.id,kind:'view',id:view.id})
 assert.equal(result.worlds[0].views![view.id].graph.showLabels,false)
 assert.equal(value(person(result),'人物性格'),'保留草稿');assert.equal(disk.saves,count)
})

test('native current-file save does not rewrite unrelated Markdown, schemas or view files',async()=>{
 const {saveProjection}=await import('../src/model/manualSave')
 const {workspace,world}=fixture(),disk=mockDisk(workspace)
 const loaded=await loadWorkspace();await saveWorkspace(loaded)
 const unrelated=loaded.worlds[0].documents.find(d=>d.id==='relations')!,schemaFile=unrelated.fileName.replace(/\.md$/i,'.schema.json')
 disk.files[world.id][schemaFile]='external schema bytes left untouched'
 const original=disk.files[world.id][unrelated.fileName]
 const current=edit(loaded,'人物性格','只保存人物'),scope={worldId:world.id,kind:'document' as const,id:'people'}
 await saveWorkspace(saveProjection(current,loaded,scope),[],scope)
 assert.equal(disk.files[world.id][schemaFile],'external schema bytes left untouched')
 assert.equal(disk.files[world.id][unrelated.fileName],original)
 assert.match(disk.files[world.id][person(loaded).fileName],/只保存人物/)
})

test('repeated Class keys import explicitly while startup preserves JSON identities',async()=>{
 const world=createWorld('重复关系'),doc=world.documents.find(d=>d.id==='people')!
 doc.entities=[{id:'b',name:'乙',fields:[]}]
 world.documents.find(d=>d.id==='relations')!.entities=['妹妹','朋友'].map((name,i)=>({id:'r'+i,name,fields:[]}))
 const workspace:Workspace={worlds:[world],activeWorldId:world.id}
 const prefix='# 人物\n\n## 甲\n\n### 人物关系\n\n#### [乙](人物列表.md#%E4%B9%99)\n\n##### 关系\n\n'
 const sister='###### [妹妹](关系类型.md#%E5%A6%B9%E5%A6%B9)'
 const disk=mockDisk(workspace,prefix+sister+'\n')
 const loaded=await loadWorkspace()
 assert.deepEqual(person(loaded).schema,doc.schema)
 assert.equal(person(loaded).entities.length,1)
 disk.files[world.id]['人物列表.md']=prefix+sister+'\n\n###### [朋友](关系类型.md#%E6%9C%8B%E5%8F%8B)\n'
 const {reloadCreationFile}=await import('../src/services/storage')
 const refreshed=await reloadCreationFile(loaded,{worldId:world.id,kind:'document',id:'people'})
 assert.match(documentMarkdown(person(refreshed)),/###### 妹妹/)
 assert.match(documentMarkdown(person(refreshed)),/###### 朋友/)
 await saveWorkspace(refreshed)
 assert.match(disk.files[world.id]['人物列表.md']!,/###### 妹妹/)
 assert.match(disk.files[world.id]['人物列表.md']!,/###### 朋友/)
 disk.files[world.id]['人物列表.md']='invalid markdown'
 const restarted=await loadWorkspace();assert.equal(person(restarted).entities.length,1)
})

test('disk source values are not rejected because a reused cached field belonged to a function',()=>{
 const world=createWorld('来源'),template=world.documents.find(d=>d.id==='people')!
 const prefix='# 人物\n## 甲\n### 人物关系\n#### [乙](人物列表.md#%E4%B9%99)\n##### 关系\n'
 const previous=parseDocumentMarkdown(prefix+'###### [哥哥](关系类型.md#%E5%93%A5%E5%93%A5)\n',template,world)
 const nested=previous.entities[0].fields.find(f=>f.key==='人物关系')!.children[0].children.find(f=>f.key==='关系')!.children[0]
 nested.functionOrigin={functionId:'fn',name:'生成',bindingFieldId:'binding'}
 const changed=prefix+'###### [妹妹](关系类型.md#%E5%A6%B9%E5%A6%B9)\n'
 assert.throws(()=>parseDocumentMarkdown(changed,previous,world),/只读/)
 const fresh=parseDocumentMarkdown(changed,previous,world,{enforceGeneratedReadOnly:false})
 assert.match(documentMarkdown(fresh),/###### 妹妹/)
 assert.ok(!documentMarkdown(fresh).includes('function-origin'))
})

test('full Markdown comparison retains every current line and deleted baseline rows without truncation',async()=>{
 const {lineDiff}=await import('../src/model/textDiff')
 const before=Array.from({length:30},(_,i)=>`line ${i}`).join('\n')+'\n'
 const after=before.replace('line 15','new 15')
 const rows=lineDiff(before,after,true)
 assert.equal(rows.filter(r=>r.after!==undefined).map(r=>r.text).join('\n'),after)
 assert.ok(rows.some(r=>r.kind==='remove'&&r.text==='line 15'))
 assert.ok(rows.some(r=>r.kind==='add'&&r.text==='new 15'))
 assert.equal(lineDiff(before,before,true).length,31)
 assert.ok(!rows.some(r=>r.kind==='gap'))
 assert.ok(lineDiff(before,after).length<rows.length)
})

test('generated JSON values survive startup and only explicit import/export touches Markdown',async()=>{
 const world=createWorld('来源 JSON'),fn={id:'generate',name:'生成',language:'js' as const,apiVersion:2 as const,executionMode:'void' as const,code:'function transform(self,input){input.add("notes",values.text("重新计算"));}'}
 const doc=world.documents.find(d=>d.id==='people')!
 doc.schema=[{id:'root',key:'内容',keyType:'Const',valueType:'Object',functionIds:[fn.id],children:[{id:'notes',key:'注释',keyType:'Const',valueType:'Text',repeatable:true}]}]
 doc.entities=[{id:'a',name:'甲',fields:[{id:'root-value',schemaId:'root',key:'内容',value:'',children:[{id:'user',schemaId:'notes',key:'注释',value:'用户',children:[]},{id:'generated',schemaId:'notes',key:'注释',value:'旧 JSON',children:[],functionOrigin:{functionId:fn.id,name:fn.name,bindingFieldId:'root-value'}}]}]}]
 const workspace:Workspace={worlds:[world],activeWorldId:world.id,functions:[fn]},disk=mockDisk(workspace,documentMarkdown(doc).replace('旧 JSON','磁盘正文'))
 let state=await loadWorkspace()
 assert.equal(person(state).entities[0].fields[0].children[1].value,'旧 JSON')
 const source=disk.files[world.id][doc.fileName]!,count=disk.saves
 disk.files[world.id][doc.fileName]=source.replace('磁盘正文','外部新版')
 const {reloadCreationFile}=await import('../src/services/storage')
 state=await reloadCreationFile(state,{worldId:world.id,kind:'document',id:doc.id})
 assert.equal(person(state).entities[0].fields[0].children[1].value,'外部新版')
 const detach=bindScriptHost({autoSave:false,get:()=>state,update:change=>{state=change(state)}})
 try{
  const {functionJobs,runFunctionValue}=await import('../src/services/functions')
  for(let i=0;i<2;i++){const job=functionJobs(state,true)[0];await runFunctionValue(fn,job.input,state.worlds[0],job.context,undefined,job)}
  const fields=person(state).entities[0].fields[0].children
  assert.deepEqual(fields.map(f=>f.value),['用户','外部新版','重新计算'])
  assert.equal(fields[1].id,'generated');assert.equal(fields[1].functionOrigin,undefined);assert.ok(fields[2].functionOrigin)
  assert.equal(disk.saves,count)
  assert.match(disk.files[world.id][doc.fileName]!,/外部新版/)
  state=await saveWorkspace(state)
  assert.match(disk.files[world.id][doc.fileName]!,/重新计算/)
  assert.doesNotMatch(disk.files[world.id][doc.fileName]!,/function-sources|function-origin/)
  const {reconcileFunctionBindings}=await import('../src/model/functionAppend')
  const unbound=structuredClone(state);person(unbound).schema[0].functionIds=[]
  assert.deepEqual(person(reconcileFunctionBindings(unbound)).entities[0].fields[0].children.map(f=>f.value),['用户','外部新版'])
 }finally{detach()}
})

test('configuration refresh reads JSON only and preserves world drafts',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace()
 const local=edit(loaded,'人物性格','未保存'),reads=disk.reads,saves=disk.saves
 local.models=[{id:'new',name:'未保存模型',model:'x',baseUrl:'http://localhost',apiKey:'',enabled:true}]
 disk.files[world.id]['人物列表.md']='broken external markdown'
 const {reloadPreferences}=await import('../src/services/storage')
 const refreshed=await reloadPreferences(local)
 assert.deepEqual(refreshed.models,loaded.models)
 assert.equal(value(person(refreshed),'人物性格'),'未保存')
 assert.equal(disk.reads,reads);assert.equal(disk.saves,saves)
})

test('attribute configuration autosave never reads or writes Markdown, and refresh imports newly declared members',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace()
 const {reloadCreationFile}=await import('../src/services/storage')
 const file=person(loaded).fileName,source=documentMarkdown(person(loaded)).replace('### 人物性格','### 新增说明\n\n用户直接写入的内容\n\n### 人物性格')
 disk.files[world.id][file]=source
 const draft=edit(loaded,'人物性格','未保存正文')
 person(draft).schema.push({id:'new-note',key:'新增说明',keyType:'Const',valueType:'Text'})
 const reads=disk.reads
 await checkpointWorkspace(draft)
 assert.equal(disk.reads,reads);assert.equal(disk.files[world.id][file],source)
 assert.equal(value(person(archivedWorkspace()!),'人物性格'),'未保存正文')
 assert.ok(person(archivedWorkspace()!).schema.some(f=>f.id==='new-note'))
 await saveWorkspace({...loaded,models:[]},[],'preferences')
 assert.ok(person(archivedWorkspace()!).schema.some(f=>f.id==='new-note'))
 assert.equal(disk.files[world.id][file],source)
 const refreshed=await reloadCreationFile(draft,{worldId:world.id,kind:'document',id:'people'})
 assert.equal(value(person(refreshed),'新增说明'),'用户直接写入的内容')
 assert.ok(person(refreshed).schema.some(f=>f.id==='new-note'))
 assert.equal(disk.files[world.id][file],source)
})

test('duplicate instance errors identify every conflicting name once',()=>{
 const {doc,world}=fixture()
 assert.throws(()=>parseDocumentMarkdown('# 人物\n## 甲\n## 乙\n## 甲\n## 丙\n## 乙\n## 甲\n',doc,world),error=>{
  assert.ok(error instanceof Error)
  assert.match(error.message,/实例名称重复：“甲”、“乙”/)
  assert.equal((error.message.match(/“甲”/g)||[]).length,1)
  assert.ok(!error.message.includes('“丙”'));return true
 })
})

test('JSON checkpoints persist complete identities and function metadata without touching Markdown exports',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace),loaded=await loadWorkspace()
 const current=edit(loaded,'人物性格','JSON 自动存档'),field=person(current).entities[0].fields.find(f=>f.key==='人物性格')!
 person(current).schema.find(s=>s.id===field.schemaId)!.functionIds=['run']
 current.functions=[{id:'run',name:'计算',language:'js',apiVersion:2,executionMode:'void',code:'function transform(self,input){}'}]
 field.functionRuns=[{functionId:'run',name:'计算',input:'snapshot',source:'revision'}]
 current.worlds[0].chat.conversations=[{id:'chat',title:'会话',messages:[],createdAt:1}]
 const source=disk.files[world.id]['人物列表.md'],reads=disk.reads
 await checkpointWorkspace(current)
 assert.equal(disk.archives,1);assert.equal(disk.saves,0);assert.equal(disk.reads,reads)
 assert.equal(disk.files[world.id]['人物列表.md'],source)
 disk.files[world.id]['人物列表.md']='损坏的外部 Markdown'
 const restart=await loadWorkspace()
 assert.equal(value(person(restart),'人物性格'),'JSON 自动存档')
 assert.equal(person(restart).entities[0].id,person(current).entities[0].id)
 assert.deepEqual(person(restart).entities[0].fields.find(f=>f.id===field.id)!.functionRuns,field.functionRuns)
 assert.equal(restart.worlds[0].chat.conversations[0].id,'chat')
 const beforeArchive=structuredClone(disk.archive)
 await saveWorkspace(loaded,undefined,{worldId:world.id,kind:'document',id:'people'})
 assert.deepEqual(disk.archive,beforeArchive)
})
