import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createWorld} from '../src/model/templates'
import {appendViewField,bindingFields,bindingText,createInterfaceView,currentBinding,freshViewField,normalizeViews,patchFieldTree,removeInterfaceView,updateInterfaceView} from '../src/model/interfaceViews'
import {exportFiles} from '../src/model/markdown'
import {ClassDocument,Entity,World} from '../src/model/types'
const custom=():World=>{const world=createWorld('自定义');const doc:ClassDocument={id:'items',name:'物件',fileName:'物件.md',entities:[],schema:[{id:'description',keyType:'Const',key:'说明',valueType:'Content'},{id:'links',keyType:'Const',key:'关联',valueType:'Object',children:[{id:'item',keyType:'Class',classId:'items',key:'目标',valueType:'Object',repeatable:true,children:[{id:'note',keyType:'Const',key:'注释',valueType:'Text'}]}]}]};doc.entities=[{id:'a',name:'甲',fields:[{id:'a-desc',schemaId:'description',key:'说明',value:'第一行\n第二行',children:[]}]},{id:'b',name:'乙',fields:[]}];return {...world,documents:[...world.documents,doc]}}
test('legacy view migration preserves world files, stable identities and independent graph state',()=>{const world=createWorld('旧世界');const legacy={...world,views:undefined};const next=normalizeViews(legacy),graph=next.nodes.find(n=>n.viewType==='graph')!,map=next.nodes.find(n=>n.viewType==='map')!;assert.equal(next.views?.[graph.id].parentClassId,'people');assert.equal(next.views?.[map.id].parentClassId,'places');assert.deepEqual(next.documents,world.documents);assert.notEqual(next.views?.[graph.id].graph,world.graph);assert.deepEqual(normalizeViews(next),next)})
test('current schema-ID bindings and fixed concrete-ID bindings preserve different scopes and Markdown semantics',()=>{const world=custom(),view=createInterfaceView(world,'items','graph','自定义图'),entity=world.documents.find(d=>d.id==='items')!.entities[0];assert.equal(bindingText(world,view,currentBinding('member',['description']),entity),'第一行\n第二行');assert.match(bindingText(world,view,currentBinding('member',['description'],'markdown'),entity),/### 说明/);const renamed={...entity,fields:entity.fields.map(f=>({...f,key:'改名'}))};assert.equal(bindingText(world,view,currentBinding('member',['description']),renamed),'第一行\n第二行');assert.equal(bindingText(world,view,{scope:'fixed',source:'member',path:['a-desc'],classId:'items',entityId:'a',mode:'content'},world.documents.find(d=>d.id==='items')!.entities[1]),'第一行\n第二行');assert.equal(bindingText(world,view,currentBinding('member'),entity),'');assert.equal(bindingText(world,view,currentBinding('member',['deleted']),entity),'')})
test('custom nested repeated relationship objects can be inserted, projected, updated and deleted without aliasing data',()=>{const world=custom(),view=createInterfaceView(world,'items','graph','图'),doc=world.documents.find(d=>d.id==='items')!,schema=doc.schema[1].children![0],item={...freshViewField(schema),key:'[乙](物件.md#%E4%B9%99)'};const fields=appendViewField(doc.entities[0].fields,doc.schema,['links','item'],item),entity={...doc.entities[0],fields};const binding=currentBinding('member',['links','item']);assert.equal(bindingFields(world,view,binding,entity)[0].id,item.id);assert.equal(fields[0].value,'第一行\n第二行');const next=patchFieldTree(fields,item.id,{...item,value:'changed'});assert.equal(bindingFields(world,view,binding,{...entity,fields:next})[0].value,'changed');assert.equal(bindingFields(world,view,binding,{...entity,fields:patchFieldTree(next,item.id,null)}).length,0)})
test('multiple views share a parent document while configurations and layout remain independent and flat',()=>{let world=custom();const a=createInterfaceView(world,'items','map','甲图'),b=createInterfaceView(world,'items','map','乙图');world=updateInterfaceView(updateInterfaceView(world,a),b);const edited={...a,graph:{...a.graph,positions:{a:{x:-80,y:900}}}};world=updateInterfaceView(world,edited);assert.deepEqual(world.views?.[b.id].map.positions,{});const files=exportFiles(world);assert.ok(files['物件.md']);assert.ok(files[a.fileName]);assert.ok(files[b.fileName]);assert.ok(Object.keys(files).every(key=>!/[\\/]/.test(key)));assert.equal(JSON.parse(files[a.fileName]).parentClassId,'items');const removed=removeInterfaceView(world,a.id);assert.ok(!removed.views?.[a.id]);assert.deepEqual(removed.documents,world.documents);assert.throws(()=>createInterfaceView(world,'missing','map','坏图'),/父文件类型/)})

test('reference index follows immutable document edits without stale names or deleted targets',async()=>{const {referencedEntity}=await import('../src/model/interfaceViews');const world=custom();assert.equal(referencedEntity(world,'[乙](物件.md#%E4%B9%99)')?.entity.id,'b');assert.equal(referencedEntity(world,'普通文本'),undefined);const next={...world,documents:world.documents.map(d=>d.id==='items'?{...d,entities:d.entities.map(e=>e.id==='b'?{...e,name:'新名'}:e)}:d)};assert.equal(referencedEntity(next,'[乙](物件.md#%E4%B9%99)'),undefined);assert.equal(referencedEntity(next,'[新名](物件.md#%E6%96%B0%E5%90%8D)')?.entity.id,'b');assert.equal(referencedEntity(world,'[乙](物件.md#%E4%B9%99)')?.entity.name,'乙');const deleted={...next,documents:next.documents.map(d=>d.id==='items'?{...d,entities:d.entities.filter(e=>e.id!=='b')}:d)};assert.equal(referencedEntity(deleted,'[新名](物件.md#%E6%96%B0%E5%90%8D)'),undefined)})


test('person graph reads all repeated relation values and filters generated descendants without changing source data',async()=>{
 const {graphEdges,personGraphView}=await import('../src/model/interfaceViews')
 const world=createWorld('人物图'),view=createInterfaceView(world,'places','graph','关系图'),doc=world.documents.find(d=>d.id==='people')!,relationDoc=world.documents.find(d=>d.id==='relations')!
 assert.equal(view.parentClassId,'people')
 relationDoc.entities=[{id:'friend',name:'朋友',fields:[]},{id:'coworker',name:'同事',fields:[]}]
 const links=doc.schema.find(s=>s.key==='人物关系')!,item=links.children![0],label=item.children!.find(s=>s.key==='关系')!
 label.valueType='Class';label.classId='relations';label.children=undefined;label.repeatable=true
 assert.equal(label.repeatable,true)
 const origin={functionId:'fn',name:'扩展',bindingFieldId:'links-value'}
 const manual={id:'edge',schemaId:item.id,key:'[乙](人物列表.md#%E4%B9%99)',value:'',children:[{id:'label1',schemaId:label.id,key:'关系',value:'[朋友](关系类型.md#%E6%9C%8B%E5%8F%8B)',children:[]},{id:'label2',schemaId:label.id,key:'关系',value:'[同事](关系类型.md#%E5%90%8C%E4%BA%8B)',children:[],functionOrigin:origin}]}
 const generated={...manual,id:'generated-edge',functionOrigin:origin}
 const generatedLabelOnly={...manual,id:'label-only-edge',children:[manual.children[1]]}
 doc.entities=[{id:'a',name:'甲',fields:[{id:'links-value',schemaId:links.id,key:'人物关系',value:'',children:[manual,generated,generatedLabelOnly]}]},{id:'b',name:'乙',fields:[]}]
 const before=structuredClone(world),edges=graphEdges(world,view)
 assert.deepEqual(edges.map(e=>e.relationName),['朋友','同事','朋友','同事','同事'])
 assert.equal(edges[0].relationRaw,manual.children[0].value)
 const hidden={...view,graph:{...view.graph,showFunctionRelations:false}}
 assert.deepEqual(graphEdges(world,hidden).map(e=>[e.field.id,e.relationName]),[['edge','朋友']])
 assert.equal(graphEdges(world,hidden)[0].field,manual)
 assert.deepEqual(world,before)
 const ancestor={...world,documents:world.documents.map(d=>d.id!=='people'?d:{...d,entities:d.entities.map(e=>e.id!=='a'?e:{...e,fields:e.fields.map(f=>({...f,functionOrigin:origin}))})})}
 assert.equal(graphEdges(ancestor,hidden).length,0)
 const old={...view,graph:{...view.graph}};delete old.graph.showFunctionRelations
 assert.equal(graphEdges(world,old).length,5)
 const customBindings={...view,parentClassId:'places',bindings:{title:currentBinding('name',[],'markdown')}}
 assert.deepEqual(graphEdges(world,customBindings),edges)
 const restored=personGraphView(world,{...customBindings,graph:{...view.graph,positions:{a:{x:10,y:20}}}})
 assert.equal(restored.parentClassId,'people');assert.deepEqual(restored.graph.positions,{a:{x:10,y:20}})
 const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:InterfaceConfigPage}=await import('../src/ui/InterfaceConfigPage')
 const html=renderToStaticMarkup(createElement(InterfaceConfigPage,{world,view:customBindings,onChange:()=>{},onDelete:()=>{}}))
 assert.doesNotMatch(html,/父文件类型|显示元素绑定|连线目标|连线文字/)
 assert.match(html,/关系连线格式/);assert.match(html,/背景块格式/)
 assert.equal((html.match(/config-instance-card/g)||[]).length,2)
 assert.doesNotMatch(html,/graph-section-toggle/)
 const configured=renderToStaticMarkup(createElement(InterfaceConfigPage,{world,view:{...customBindings,graph:{...view.graph,lineStyles:{friend:{fill:"#FFEF7777",stroke:"#FFEF7777",glow:8}}}},onChange:()=>{},onDelete:()=>{}}))
 assert.match(configured,/graph-mapping-field/)
 assert.match(configured,/线条粗细（px）/)
 assert.doesNotMatch(html,/class="graph-style-card"/)
 const map=createInterfaceView(world,'places','map','地图')
 const mapHtml=renderToStaticMarkup(createElement(InterfaceConfigPage,{world,view:map,onChange:()=>{},onDelete:()=>{}}))
 assert.match(mapHtml,/父文件类型/);assert.match(mapHtml,/显示元素绑定/)
})

test('SVG relationship labels render repeated values on separate lines',async()=>{
 const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:GraphEdge}=await import('../src/ui/GraphEdge')
 const html=renderToStaticMarkup(createElement(GraphEdge,{a:{x:0,y:0},b:{x:300,y:0},label:'朋友\n同事',showLabel:true,edgeId:'edge',onSelect:()=>{}}))
 assert.equal((html.match(/<tspan/g)||[]).length,2)
 assert.match(html,/朋友<\/tspan>/);assert.match(html,/同事<\/tspan>/)
 const hidden=renderToStaticMarkup(createElement(GraphEdge,{a:{x:0,y:0},b:{x:300,y:0},label:'朋友\n同事',showLabel:false,edgeId:'edge',onSelect:()=>{}}))
 assert.doesNotMatch(hidden,/<tspan/)
})


test('people relation Object with repeated Class keys and Null values resolves labels and first style identity',async()=>{
 const {graphEdges,personGraphView,graphRelationClass}=await import('../src/model/interfaceViews')
 const {classLink}=await import('../src/model/markdown')
 const world=createWorld('真实结构'),doc=world.documents.find(d=>d.id==='people')!,relations=world.documents.find(d=>d.id==='relations')!
 relations.entities=[{id:'dad',name:'爸爸',fields:[]},{id:'friend',name:'朋友',fields:[]}]
 const root=doc.schema.find(s=>s.key==='人物关系')!,person=root.children![0],container=person.children!.find(s=>s.key==='关系')!,leaf=container.children![0]
 assert.equal(container.valueType,'Object');assert.equal(leaf.keyType,'Class');assert.equal(leaf.valueType,'Null');assert.equal(leaf.repeatable,true)
 const origin={functionId:'fn',name:'推理',bindingFieldId:'root'}
 doc.entities=[{id:'a',name:'甲',fields:[]},{id:'b',name:'乙',fields:[]}]
 const first=classLink(world,'relations','dad'),second=classLink(world,'relations','friend')
 doc.entities[0].fields=[{id:'root',schemaId:root.id,key:'人物关系',value:'',children:[{id:'row',schemaId:person.id,key:classLink(world,'people','b'),value:'',children:[{id:'relations',schemaId:container.id,key:'关系',value:'',children:[{id:'first',schemaId:leaf.id,key:first,value:'',children:[],functionOrigin:origin},{id:'second',schemaId:leaf.id,key:second,value:'',children:[]}]}]}]}]
 const view=createInterfaceView(world,'people','graph','关系网')
 view.graph.lineStyles.dad={fill:'#FFFF0000',stroke:'#FF000000',glow:8}
 view.graph.lineStyles.friend={fill:'#FF00FF00',stroke:'#FF000000',glow:8}
 assert.deepEqual(personGraphView(world,view).bindings.edgeLabel.path,[container.id,leaf.id])
 assert.equal(personGraphView(world,view).bindings.edgeLabel.part,'key')
 assert.equal(graphRelationClass(world,view)?.id,'relations')
 const edges=graphEdges(world,view)
 assert.equal(edges.length,2);assert.deepEqual(edges.map(e=>e.relationName),['爸爸','朋友']);assert.deepEqual(edges.map(e=>e.relationRaw),[first,second]);assert.notEqual(edges[0].id,edges[1].id)
 const firstId=relations.entities.find(e=>classLink(world,'relations',e.id)===edges[0].relationRaw)!.id
 assert.equal(view.graph.lineStyles[firstId].fill,'#FFFF0000')
 const visible=graphEdges(world,{...view,graph:{...view.graph,showFunctionRelations:false}})
 assert.equal(visible[0].relationName,'朋友');assert.equal(visible[0].relationRaw,second)
 view.graph.lineStyles.dad.visible=false
 const filtered=graphEdges(world,view)
 assert.equal(filtered[0].relationName,'朋友');assert.equal(filtered[0].relationRaw,second)
 view.graph.lineStyles.friend.visible=false
 assert.equal(graphEdges(world,view).length,0)
 assert.equal(doc.entities[0].fields[0].children[0].children[0].children.length,2)
})
