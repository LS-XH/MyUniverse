import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createWorld } from '../src/model/templates'
import { createWorldApi, worldCatalog } from '../src/model/worldApi'
import { createFunctionApi, functionContext, validateTypedValue } from '../src/model/functionValues'
import { Entity, FieldValue } from '../src/model/types'

test('relation Function finds direct and inferred types and terminates on a person cycle', () => {
  const world = createWorld('关系测试')
  const people = world.documents.find(doc => doc.id === 'people')!
  const relations = world.documents.find(doc => doc.id === 'relations')!
  const relationSchema = relations.schema.find(schema => schema.key === '关系推理')!
  const ruleSchema = relationSchema.children![0]
  const relationField = people.schema.find(schema => schema.key === '人物关系')!
  const rowSchema = relationField.children![0]
  const link = (file: string, name: string) => `[${name}](${file}#${encodeURIComponent(name)})`
  let serial = 0
  const field = (schemaId: string, key: string, value = '', children: FieldValue[] = []): FieldValue => ({id: `f${++serial}`,schemaId,key,value,children})
  const relation = (name: string, rules: [string, string][] = []): Entity => ({
    id: name,name,fields:[field(relationSchema.id,'关系推理','',rules.map(([second,result]) => field(ruleSchema.id,link('关系类型.md',second),link('关系类型.md',result))))]
  })
  relations.entities = [relation('妈妈',[['妈妈','奶奶']]),relation('奶奶'),relation('姐姐'),relation('儿子')]
  const one = (target: string, type: string) => field(rowSchema.id,link('人物列表.md',target),'',[
    field(rowSchema.children![0].id,'关系',link('关系类型.md',type)),
    field(rowSchema.children![1].id,'人物关系小故事')
  ])
  const indirect = one('乙','妈妈'), direct = one('丙','姐姐')
  const person = (name: string, rows: FieldValue[]): Entity => ({id:name,name,fields:[field(relationField.id,'人物关系','',rows)]})
  people.entities = [person('甲',[indirect,direct]),person('乙',[one('丙','妈妈'),one('甲','儿子')]),person('丙',[])]
  const api = createWorldApi(worldCatalog(world))
  const context = functionContext(world,people,people.entities[0],direct,rowSchema)
  const runtime = createFunctionApi(api,context,{type:'Object'})
  const code = readFileSync('scripts/人物关系路径推理.js','utf8')
  const transform = new Function('world','values',code+'\nreturn transform;')(api,runtime.values)
  const result = validateTypedValue(transform(runtime.self,runtime.input),{type:'Object'},world)
  assert.deepEqual(result.members?.map(member => member.key).sort(),[
    link('关系类型.md','姐姐'),link('关系类型.md','奶奶')
  ].sort())
  assert.ok(result.members?.every(member => member.value.type === 'Null'))
})
