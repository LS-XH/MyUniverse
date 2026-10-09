import test from 'node:test'
import assert from 'node:assert/strict'
import { ClassDocument, Workspace, World } from '../src/model/types'
import { createWorld } from '../src/model/templates'
import { documentMarkdown, markdownLocations, markdownHeadingLevels, parseDocumentMarkdown } from '../src/model/markdown'
import { mergeThreeWay } from '../src/model/merge'
import { loadWorkspace, saveWorkspace, refreshWorkspace, MarkdownConflictError, applySyncResult, clearMarkdownConflict, replaceDocumentFromImport } from '../src/services/storage'

function fixture() {
  const world = createWorld('测试世界')
  const template = world.documents.find(d => d.id === 'people')!
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
      assert.equal(lines[location.key],`${'#'.repeat(depth)} ${field.key}`)
      if(field.value)assert.equal(lines.slice(location.value,location.end+1).join('\n'),field.value)
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
  const deep = parseDocumentMarkdown('# 故事\n## 章节\n### 一\n#### 二\n##### 三\n###### 四\n####### 五\n######## 六\n叶子内容\n', { ...template, schema: [] })
  assert.deepEqual(parseDocumentMarkdown(documentMarkdown(deep), deep), deep)
  assert.equal(value(doc, '内容'), '开场正文')
})
test('unknown properties extend the schema across instances and duplicate fields remain repeatable', () => {
  const { doc, world } = fixture()
  const imported = parseDocumentMarkdown(documentMarkdown(doc) + '\n### 外号\n白衣\n### 外号\n剑客\n', doc, world)
  assert.equal(imported.schema.find(s => s.key === '外号')!.repeatable, true)
  assert.deepEqual(imported.entities[1].fields.filter(f => f.key === '外号').map(f => f.value), ['白衣', '剑客'])
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
  let saves = 0, race: (() => void) | undefined
  Object.assign(globalThis, { isTauri: true, window: { __TAURI_INTERNALS__: { invoke: async (command: string, args: any) => {
    if (command === 'load_workspace') return structuredClone(workspace)
    if (command === 'read_document_files') return Object.fromEntries(Object.entries(args.requests as Record<string, string[]>).map(([id, names]) => [id, Object.fromEntries(names.map(name => [name, files[id]?.[name] ?? null]))]))
    if (command === 'save_workspace') {
      if (race) { const action = race; race = undefined; action() }
      for (const [id, output] of Object.entries(args.files as Record<string, Record<string, string>>)) for (const name of Object.keys(output).filter(name => name.endsWith('.md')||name.endsWith('.view.json'))) assert.equal(args.expected[id][name], files[id]?.[name] ?? null, 'MARKDOWN_CHANGED')
      for (const [id, output] of Object.entries(args.files as Record<string, Record<string, string>>)) files[id] = { ...files[id], ...output }
      saves++
      return
    }
    throw new Error(`Unexpected command ${command}`)
  } } } })
  return { files, get saves() { return saves }, race(action: () => void) { race = action } }
}
const person = (workspace: Workspace) => workspace.worlds[0].documents.find(d => d.id === 'people')!
test('startup reads Markdown over cached JSON and refresh imports external changes', async () => {
  const { workspace, world } = fixture()
  const disk = mockDisk(workspace, documentMarkdown(person(edit(workspace, '人物性格', '来自磁盘'))))
  const loaded = await loadWorkspace()
  assert.equal(value(person(loaded), '人物性格'), '来自磁盘')
  await saveWorkspace(loaded)
  disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(loaded, '人物喜好', '外部编辑')))
  const refreshed = await refreshWorkspace(loaded)
  assert.equal(value(person(refreshed), '人物喜好'), '外部编辑')
})
test('save re-reads and merges external edits; changes made while awaiting save remain in UI', async () => {
  const { workspace, world } = fixture(), disk = mockDisk(workspace)
  const loaded = await loadWorkspace(); await saveWorkspace(loaded)
  const local = edit(loaded, '人物性格', '界面编辑')
  disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(loaded, '人物喜好', '外部编辑')))
  const saved = await saveWorkspace(local)
  assert.equal(value(person(saved), '人物性格'), '界面编辑')
  assert.equal(value(person(saved), '人物喜好'), '外部编辑')
  assert.equal(value(person(applySyncResult(local, edit(local, '人物性格', '继续输入'), saved)), '人物性格'), '继续输入')
})
test('same-property conflict and malformed external file never overwrite the disk', async () => {
  const { workspace, world } = fixture(), disk = mockDisk(workspace)
  const loaded = await loadWorkspace(); await saveWorkspace(loaded)
  const local = edit(loaded, '人物性格', '界面'), external = documentMarkdown(person(edit(loaded, '人物性格', '磁盘')))
  disk.files[world.id]['人物列表.md'] = external
  const before = disk.saves
  await assert.rejects(saveWorkspace(local), MarkdownConflictError)
  assert.equal(disk.saves, before); assert.equal(disk.files[world.id]['人物列表.md'], external)
  clearMarkdownConflict()
  disk.files[world.id]['人物列表.md'] = 'malformed markdown'
  await assert.rejects(saveWorkspace(local), /未覆盖磁盘文件/)
  assert.equal(disk.saves, before)
})
test('a disk change between read and write retries with new contents', async () => {
  const { workspace, world } = fixture(), disk = mockDisk(workspace)
  const loaded = await loadWorkspace(); await saveWorkspace(loaded)
  disk.race(() => { disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(loaded, '人物喜好', '写入前最后一刻')) ) })
  const saved = await saveWorkspace(edit(loaded, '人物性格', '本地'))
  assert.equal(value(person(saved), '人物喜好'), '写入前最后一刻')
  assert.equal(value(person(saved), '人物性格'), '本地')
})
test('queued saves cannot bypass a conflict; a queued save also detects changes discovered by refresh', async () => {
  const { workspace, world } = fixture(), disk = mockDisk(workspace)
  const loaded = await loadWorkspace(); await saveWorkspace(loaded)
  disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(loaded, '人物性格', '外部')))
  const attempts = await Promise.allSettled([saveWorkspace(edit(loaded, '人物性格', '本地一')), saveWorkspace(edit(loaded, '人物性格', '本地二'))])
  assert.ok(attempts.every(result => result.status === 'rejected' && result.reason instanceof MarkdownConflictError))
  clearMarkdownConflict()
  const current = await loadWorkspace(); await saveWorkspace(current)
  disk.files[world.id]['人物列表.md'] = documentMarkdown(person(edit(current, '人物性格', '外部再次编辑')))
  const results = await Promise.allSettled([refreshWorkspace(current), saveWorkspace(edit(current, '人物性格', '正在输入'))])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.equal(value(parseDocumentMarkdown(disk.files[world.id]['人物列表.md']!, person(current), world), '人物性格'), '外部再次编辑')
})
test('an explicitly confirmed import can repair invalid disk content', async () => {
  const { workspace, world } = fixture(), disk=mockDisk(workspace,'broken file')
  const loaded=await loadWorkspace()
  await assert.rejects(saveWorkspace(loaded), /未覆盖磁盘文件/)
  const imported=edit(loaded,'人物性格','重新导入')
  replaceDocumentFromImport(world.id,'people')
  const saved=await saveWorkspace(imported)
  assert.equal(value(person(saved),'人物性格'),'重新导入')
  assert.match(disk.files[world.id]['人物列表.md']!,/重新导入/)
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
  assert.equal(value(person(saved),'人物性格'),'外部修改')
})


test('view JSON reloads, merges independent edits and rejects conflicting or malformed configuration',async()=>{
 const {workspace,world}=fixture(),disk=mockDisk(workspace)
 const loaded=await loadWorkspace();await saveWorkspace(loaded)
 const id=world.nodes.find(n=>n.viewType==='graph')!.id,file=loaded.worlds[0].views![id].fileName
 const remote=structuredClone(loaded.worlds[0].views![id]);remote.name='外部图';disk.files[world.id][file]=JSON.stringify(remote)
 const local=structuredClone(loaded);local.worlds[0].views![id].graph.showDomains=false
 const saved=await saveWorkspace(local)
 assert.equal(saved.worlds[0].views![id].name,'外部图');assert.equal(saved.worlds[0].nodes.find(n=>n.id===id)?.name,'外部图');assert.equal(saved.worlds[0].views![id].graph.showDomains,false)
 const changed=structuredClone(saved.worlds[0].views![id]);changed.name='远端';disk.files[world.id][file]=JSON.stringify(changed)
 const competing=structuredClone(saved);competing.worlds[0].views![id].name='本地'
 await assert.rejects(saveWorkspace(competing),MarkdownConflictError)
 clearMarkdownConflict();disk.files[world.id][file]='broken';const count=disk.saves
 await assert.rejects(saveWorkspace(saved),/未覆盖磁盘文件/);assert.equal(disk.saves,count)
})
