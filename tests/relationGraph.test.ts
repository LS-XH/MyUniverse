import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {relationGraphFixture,personRepeatedFixture} from './relationGraphFixture'
import {bindingText,createInterfaceView,decodeInterfaceFile,graphEdges,graphView,importPersonGraphConfig,normalizeViews,removeInterfaceView,updateInterfaceView,patchGraphEdge,freshGraphEdgeField,fieldsAtPath} from '../src/model/interfaceViews'
import {exportFiles,parseDocumentMarkdown} from '../src/model/markdown'
import {curvedRelationGeometry} from '../src/model/graphGeometry'
import {GraphPage} from '../src/ui/App'
import InterfaceConfigPage from '../src/ui/InterfaceConfigPage'
import GraphEdge from '../src/ui/GraphEdge'
import {classLink} from '../src/model/markdown'
import {saveProjection} from '../src/model/manualSave'
import {moveTreeItem} from '../src/model/treeMoves'

test('each repeated person relation owns a distinct curved line, style and editable member',()=>{
 const {world,person,doc}=personRepeatedFixture(),before=structuredClone(world),edges=graphEdges(world,person)
 assert.equal(edges.length,4);assert.equal(new Set(edges.map(e=>e.id)).size,4)
 assert.deepEqual(edges.map(e=>e.relationName),['父母','兄弟姐妹','父母','兄弟姐妹'])
 assert.equal(edges[0].field,edges[1].field)
 assert.notEqual(edges[0].relationField,edges[1].relationField)
 const html=renderToStaticMarkup(createElement(GraphPage,{world,view:person,onChange:()=>{},onOpenPerson:()=>{}}))
 const svg=html.match(/<svg class="edge-layer"[\s\S]*?<\/svg>/)![0]
 assert.equal((html.match(/class="graph-edge /g)||[]).length,4)
 assert.equal((svg.match(/<text /g)||[]).length,4)
 const paths=[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1])
 assert.equal(new Set(paths).size,4)
 assert.match(svg,/rgba\(239,\s*119,\s*119,/);assert.match(svg,/rgba\(89,\s*196,\s*141,/ )
 assert.deepEqual(world,before)
 const edited=patchGraphEdge(world,edges[0],{...edges[0].relationField!,key:classLink(world,'relations','sibling')})
 assert.deepEqual(graphEdges(edited,person).map(e=>e.relationName),['兄弟姐妹','兄弟姐妹','父母','兄弟姐妹'])
 const removed=patchGraphEdge(world,edges[0],null)
 assert.deepEqual(graphEdges(removed,person).map(e=>e.relationField!.id),['sibling-1','parent-2','sibling-2'])
 const story=doc.entities[0].fields[0].children[0].children[1]
 assert.deepEqual(removed.documents.find(d=>d.id==='people')!.entities[0].fields[0].children[0].children[1],story)
 let empty=removed
 for(const edge of graphEdges(empty,person).filter(e=>e.source.id==='a'))empty=patchGraphEdge(empty,edge,null)
 assert.deepEqual(graphEdges(empty,person).map(e=>e.source.id),['b'])
 assert.ok(empty.documents.find(d=>d.id==='people')!.entities[0].fields[0].children.length)
})

test('independent person lines filter their own type/origin and protect inherited generated members',()=>{
 const {world,person,doc,row}=personRepeatedFixture(),origin={functionId:'fn',name:'推理',bindingFieldId:'a-root'}
 const label=doc.entities[0].fields[0].children[0].children[0].children[1];label.functionOrigin=origin
 const generated=graphEdges(world,person).find(e=>e.relationField?.id===label.id)!
 assert.equal(generated.readOnly,true);assert.equal(patchGraphEdge(world,generated,null),world)
 person.graph.showFunctionRelations=false
 assert.deepEqual(graphEdges(world,person).map(e=>e.relationField!.id),['parent-1','parent-2','sibling-2'])
 person.graph.lineStyles.parent.visible=false
 assert.deepEqual(graphEdges(world,person).map(e=>e.relationField!.id),['sibling-2'])
 person.graph.showFunctionRelations=true
 doc.entities[0].fields[0].functionOrigin=origin
 assert.ok(graphEdges(world,person).filter(e=>e.source.id==='a').every(e=>e.readOnly))
 const fresh=freshGraphEdgeField(row,graphView(world,person))
 assert.equal(fieldsAtPath(fresh.children,person.bindings.edgeLabel.path).length,1)
})

test('views migrate and create under source files, preserve Markdown and save only JSON structure',()=>{
 const {world}=relationGraphFixture(),before=exportFiles(world)
 const legacy={...world,nodes:world.nodes.map(n=>world.views?.[n.id]?{...n,parentId:null}:n)}
 const migrated=normalizeViews(legacy)
 for(const view of Object.values(migrated.views!))assert.equal(migrated.nodes.find(n=>n.id===view.id)!.parentId,migrated.nodes.find(n=>n.type==='file'&&n.classId===view.parentClassId)!.id)
 for(const doc of world.documents)assert.equal(exportFiles(migrated)[doc.fileName],before[doc.fileName])
 const view=createInterfaceView(migrated,'people','graph','第二人物网','second-person-view')
 const next=updateInterfaceView({...migrated,nodes:[...migrated.nodes,{id:view.id,name:view.name,type:'view',parentId:null}]},view)
 const source=next.nodes.find(n=>n.type==='file'&&n.classId==='people')!
 assert.equal(next.nodes.find(n=>n.id===view.id)!.parentId,source.id)
 const base={worlds:[migrated],activeWorldId:world.id},draft={...base,worlds:[{...next,documents:next.documents.map(d=>d.id==='people'?{...d,name:'未保存名称'}:d)}]}
 const submitted=saveProjection(draft,base,{worldId:world.id,kind:'view',id:view.id})
 assert.deepEqual(submitted.worlds[0].documents,migrated.documents)
 assert.equal(submitted.worlds[0].nodes.find(n=>n.id===view.id)!.parentId,source.id)
 assert.ok(JSON.stringify(submitted.worlds[0]).includes('second-person-view'))
 for(const doc of world.documents)assert.equal(exportFiles(submitted.worlds[0])[doc.fileName],before[doc.fileName])
 const workspace={worlds:[next],activeWorldId:world.id},key=(id:string)=>`world:${world.id}:${id}`
 const collection=next.nodes.find(n=>n.type==='collection')!
 assert.deepEqual(moveTreeItem(workspace,key(view.id),key(collection.id),true,false),workspace)
 const other=Object.values(next.views!).find(v=>v.kind==='graph'&&v.id!==view.id)!
 const reordered=moveTreeItem(workspace,key(view.id),key(other.id),false,false)
 assert.equal(reordered.worlds[0].nodes.find(n=>n.id===view.id)!.parentId,source.id)
})

test('person graph separates reciprocal and parallel members while leaving a lone edge straight',()=>{
 const {world,person}=relationGraphFixture(),doc=world.documents.find(d=>d.id==='people')!
 const root=doc.schema.find(s=>s.key==='人物关系')!,row=root.children![0],container=row.children!.find(s=>s.key==='关系')!,leaf=container.children![0]
 const member=(id:string,target:string)=>({id,schemaId:row.id,key:classLink(world,'people',target),value:'',children:[{id:`${id}-relations`,schemaId:container.id,key:container.key,value:'',children:[{id:`${id}-label`,schemaId:leaf.id,key:classLink(world,'relations','parent'),value:'',children:[]}]}]})
 doc.entities=['a','b','c','d'].map(id=>({id,name:id,fields:[]}))
 doc.entities=doc.entities.map(({id,name})=>({id,name,fields:[{id:`${id}-root`,schemaId:root.id,key:root.key,value:'',children:id==='a'?[member('ab-1','b'),member('ab-2','b')]:id==='b'?[member('ba','a')]:id==='c'?[member('cd','d')]:[]}]}))
 person.graph.positions={a:{x:0,y:0},b:{x:400,y:0},c:{x:0,y:300},d:{x:400,y:300}}
 const before=structuredClone(world),html=renderToStaticMarkup(createElement(GraphPage,{world,view:person,onChange:()=>{},onOpenPerson:()=>{}}))
 const groups=html.match(/<g class="graph-edge [\s\S]*?(?=<g class="graph-edge |<\/svg>)/g)!
 assert.equal(groups.length,4)
 const paths=groups.slice(0,3).map(group=>group.match(/<path d="([^"]+)"/)![1])
 assert.equal(new Set(paths).size,3)
 groups.slice(0,3).forEach(group=>assert.match(group,/ Q /))
 assert.match(groups[3],/<line /);assert.doesNotMatch(groups[3],/<path /)
 assert.deepEqual(world,before)
})

test('relation network projects instance names, descriptions and each inference key to its value target',()=>{
 const {world,relations,network}=relationGraphFixture(),before=structuredClone(world)
 const view=graphView(world,network),edges=graphEdges(world,network)
 assert.equal(view.parentClassId,'relations')
 assert.equal(bindingText(world,view,view.bindings.title,relations.entities[0]),'父母')
 assert.equal(bindingText(world,view,view.bindings.subtitle,relations.entities[0]),'上一代直系亲属')
 assert.deepEqual(edges.map(e=>[e.source.id,e.relationName,e.target.id,e.field.id]),[
  ['parent','兄弟姐妹','uncle','parent-sibling'],['parent','父母','uncle','parent-parent'],['sibling','父母','uncle','sibling-parent']
 ])
 assert.equal(edges[0].field,relations.entities[0].fields[1].children[0])
 assert.deepEqual(world,before)
 const html=renderToStaticMarkup(createElement(GraphPage,{world,view:network,onChange:()=>{},onOpenPerson:()=>{}}))
 assert.match(html,/<h1>关系类型网<\/h1>/)
 assert.match(html,/上一代直系亲属/)
 assert.equal((html.match(/class="person-node /g)||[]).length,3)
 assert.equal((html.match(/class="graph-edge /g)||[]).length,3)
 assert.match(html,/<path d="M [^"]+ Q /)
})

test('relation inference filters generated rows and hidden key types, ignores invalid/cross-class targets, and allows self references',()=>{
 const {world,relations,network,entry}=relationGraphFixture()
 const rows=relations.entities[0].fields[1].children
 rows[0].functionOrigin={functionId:'f',name:'推理函数',bindingFieldId:'parent-inference'}
 rows.push({...entry('invalid','parent','uncle'),value:'[不存在](关系类型.md#不存在)'})
 rows.push({...entry('cross-class','parent','uncle'),value:'[某人](人物列表.md#某人)'})
 rows.push(entry('self','parent','parent'))
 assert.equal(graphEdges(world,network).length,4)
 network.graph.showFunctionRelations=false
 assert.deepEqual(graphEdges(world,network).map(e=>e.field.id),['parent-parent','self','sibling-parent'])
 network.graph.lineStyles.parent={fill:'#FFFFFFFF',stroke:'#FFFFFFFF',glow:0,visible:false}
 assert.equal(graphEdges(world,network).length,0)
})

test('person configuration imports a detached style copy while preserving destination layout, identity and source data',()=>{
 let {world,person,network}=relationGraphFixture()
 network.graph.positions.uncle={x:77,y:88}
 person.graph.showLabels=false;person.graph.showFunctionRelations=false
 person.graph.positions={personOnly:{x:900,y:500}}
 person.graph.domainStyles={faction:{fill:'#FFFFFFFF',stroke:'#FFFFFFFF',glow:0}}
 person.graph.lineStyles.stale={fill:'#FFFFFFFF',stroke:'#FFFFFFFF',glow:0}
 person.graph.lineStyles.parent.labelSource='旧文字来源'
 const before=structuredClone(world),next=importPersonGraphConfig(world,network,person)
 assert.equal(next.id,network.id);assert.equal(next.fileName,network.fileName)
 assert.deepEqual(next.graph.positions,network.graph.positions)
 assert.deepEqual(next.graph.domainStyles,network.graph.domainStyles)
 assert.equal(next.graph.showLabels,false);assert.equal(next.graph.showFunctionRelations,false)
 assert.equal(next.graph.lineStyles.parent.labelSource,undefined)
 assert.equal(next.graph.lineStyles.stale,undefined)
 assert.equal(next.graph.lineStyles.sibling.fill,person.graph.lineStyles.sibling.fill)
 assert.deepEqual(world,before)
 next.graph.lineStyles.sibling.fill='#FF000000'
 assert.equal(person.graph.lineStyles.sibling.fill,'#FF59c48d')
 world=updateInterfaceView(world,next)
 const files=exportFiles(world)
 assert.equal(JSON.parse(files[next.fileName]).kind,'relationGraph')
 assert.deepEqual(decodeInterfaceFile(files[next.fileName],next,world),next)
 const doc=world.documents.find(d=>d.id==='relations')!
 assert.deepEqual(parseDocumentMarkdown(files[doc.fileName],doc,world).entities,doc.entities)
 assert.throws(()=>importPersonGraphConfig(world,next,{...person,id:'another-world'}),/当前世界/)
 assert.throws(()=>importPersonGraphConfig(world,person,next),/当前世界/)
})

test('legacy person labels migrate without changing IDs or filenames; relation network installs once and stays deleted',()=>{
 const {world}=relationGraphFixture(),graph=Object.values(world.views!).find(v=>v.kind==='graph')!
 graph.name='关系网';world.nodes.find(n=>n.id===graph.id)!.name='关系网'
 const legacy={...world,relationGraphInstalled:undefined,nodes:world.nodes.filter(n=>n.viewType!=='relationGraph'),views:Object.fromEntries(Object.entries(world.views!).filter(([,v])=>v.kind!=='relationGraph'))}
 const next=normalizeViews(legacy),network=next.nodes.find(n=>n.viewType==='relationGraph')!
 assert.equal(next.nodes.find(n=>n.id===graph.id)!.name,'人物关系网')
 assert.equal(next.views![graph.id].name,'人物关系网')
 assert.equal(next.views![graph.id].fileName,graph.fileName)
 assert.equal(network.parentId,next.nodes.find(n=>n.classId==='relations'&&n.type==='file')!.id)
 assert.deepEqual(normalizeViews(next),next)
 assert.ok(!normalizeViews(removeInterfaceView(next,network.id)).nodes.some(n=>n.viewType==='relationGraph'))
 const custom=createInterfaceView(world,'people','graph','自定义人物图')
 assert.equal(normalizeViews(updateInterfaceView(next,custom)).views![custom.id].name,'自定义人物图')
})

test('relation configuration exposes person import and line formats without faction controls; person config has the renamed title',()=>{
 const {world,network,person}=relationGraphFixture()
 const html=renderToStaticMarkup(createElement(InterfaceConfigPage,{world,view:network,onChange:()=>{},onDelete:()=>{}}))
 assert.match(html,/<h1>关系类型网配置<\/h1>/)
 assert.match(html,/从人物关系网配置导入/);assert.match(html,/来源人物关系网/)
 assert.match(html,/关系连线格式/);assert.doesNotMatch(html,/背景块格式|显示分组背景域|父文件类型/)
 const personHtml=renderToStaticMarkup(createElement(InterfaceConfigPage,{world,view:person,onChange:()=>{},onDelete:()=>{}}))
 assert.match(personHtml,/<h1>人物关系网配置<\/h1>/)
 const noSource={...world,views:Object.fromEntries(Object.entries(world.views!).filter(([,v])=>v.kind!=='graph'))}
 assert.match(renderToStaticMarkup(createElement(InterfaceConfigPage,{world:noSource,view:network,onChange:()=>{},onDelete:()=>{}})),/请先创建人物关系网/)
})

test('parallel inference and self-reference paths have finite geometry and distinct labels',()=>{
 const a={x:10,y:20},b={x:300,y:40}
 const left=curvedRelationGeometry(a,b,-45,3,1),right=curvedRelationGeometry(a,b,45,3,1),self=curvedRelationGeometry(a,a,100,3,1)
 assert.notEqual(left.path,right.path);assert.notEqual(left.label.y,right.label.y)
 assert.match(self.path,/ C /);assert.doesNotMatch(self.path,/NaN|Infinity/)
 assert.notDeepEqual(self.tip,self.left)
 const html=renderToStaticMarkup(createElement(GraphEdge,{a,b:a,bend:100,label:'自身',showLabel:true,edgeId:'self',onSelect:()=>{}}))
 assert.match(html,/<path /);assert.match(html,/自身/)
})
