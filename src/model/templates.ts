import { ClassDocument, FieldSchema, World, uid } from './types'
const f = (key: string, valueType: FieldSchema['valueType'], children?: FieldSchema[], extra: Partial<FieldSchema> = {}): FieldSchema => ({ id: uid(), keyType: 'Const', key, valueType, children, ...extra })
const list = (key: string, valueType: FieldSchema['valueType'], children?: FieldSchema[], extra: Partial<FieldSchema> = {}) => f(key, valueType, children, { repeatable: true, keyType: 'Text', placeholder: key, ...extra })
export function createWorld(name: string): World {
  const people = 'people', relations = 'relations', factions = 'factions', places = 'places', events = 'events'
  const docs: ClassDocument[] = [
    { id: people, name: '人物', fileName: '人物列表.md', protected: true, entities: [], schema: [
      f('人物关系', 'Object', [list('人物', 'Object', [f('关系', 'Class', undefined, {classId:relations}), f('人物关系小故事', 'Object', [list('人物关系小故事名称', 'Content')])], {keyType:'Class',classId:people})]),
      f('人物势力','Object',[f('势力名称','Class',undefined,{classId:factions}),f('势力地位','Text')]), f('人物性格','Text'), f('人物喜好','Text')
    ]},
    { id: relations, name: '关系', fileName: '关系类型.md', protected: true, entities: [], schema: [f('关系描述','Text'),f('关系推理','Object',[list('关系','Class',undefined,{keyType:'Class',classId:relations})])]},
    { id: factions, name: '势力', fileName: '势力列表.md', protected: true, entities: [], schema: [f('势力地点','Text'),f('势力活动','Object',[list('活动名称','Object',[f('活动地点','Class',undefined,{classId:places}),f('活动频率','Text'),f('活动内容','Content')])])]},
    { id: places, name: '地点', fileName: '地点列表.md', protected: true, entities: [], schema: [f('地点描述','Content')]},
    { id: events, name: '事件', fileName: '事件列表.md', protected: true, entities: [], schema: [f('事件人物','Object',[list('人物','Null',undefined,{keyType:'Class',classId:people})]),f('事件内容','Content'),f('事件结果','Content')]}
  ]
  const nodes: World['nodes'] = []
  const add = (name: string,type: World['nodes'][number]['type'],parentId: string|null,props: Partial<World['nodes'][number]> = {}) => { const id=uid();nodes.push({id,name,type,parentId,protected:true,...props});return id }
  const worldView=add('世界观','collection',null), peopleView=add('人物','collection',null), eventView=add('事件','collection',null)
  add('章节','collection',null); add('插图','collection',null)
  const file = (name:string,parentId:string,classId:string) => add(name,'file',parentId,{classId})
  file('势力列表',worldView,factions);file('地点列表',worldView,places)
  file('人物列表',peopleView,people);add('关系网','view',peopleView,{viewType:'graph'});file('关系类型',peopleView,relations)
  file('事件列表',eventView,events)
  add('地图视图','view',worldView,{viewType:'map'});add('聊天框','view',null,{viewType:'chat'})
  return {id:uid(),name,nodes,documents:docs,graph:{positions:{},lineStyles:{},domainStyles:{},showDomains:true},map:{image:'',legend:''},chat:{agent:'',files:[],skills:[],conversations:[],activeConversationId:null}}
}
