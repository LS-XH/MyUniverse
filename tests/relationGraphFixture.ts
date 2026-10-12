import {createWorld} from '../src/model/templates'
import {classLink} from '../src/model/markdown'
import {FieldValue} from '../src/model/types'

export function relationGraphFixture(){
 const world=createWorld('关系推理演示'),relations=world.documents.find(d=>d.id==='relations')!
 const description=relations.schema.find(s=>s.key==='关系描述')!,inference=relations.schema.find(s=>s.key==='关系推理')!,row=inference.children![0]
 relations.entities=[
  {id:'parent',name:'父母',fields:[]},
  {id:'sibling',name:'兄弟姐妹',fields:[]},
  {id:'uncle',name:'叔伯姑姨',fields:[]},
 ]
 const describe=(id:string,value:string):FieldValue=>({id:`${id}-description`,schemaId:description.id,key:description.key,value,children:[]})
 const entry=(id:string,keyId:string,targetId:string):FieldValue=>({id,schemaId:row.id,key:classLink(world,'relations',keyId),value:classLink(world,'relations',targetId),children:[]})
 relations.entities[0].fields=[describe('parent','上一代直系亲属'),{id:'parent-inference',schemaId:inference.id,key:inference.key,value:'',children:[entry('parent-sibling','sibling','uncle'),entry('parent-parent','parent','uncle')]}]
 relations.entities[1].fields=[describe('sibling','同一代的兄弟姐妹'),{id:'sibling-inference',schemaId:inference.id,key:inference.key,value:'',children:[entry('sibling-parent','parent','uncle')]}]
 relations.entities[2].fields=[describe('uncle','父母的兄弟姐妹'),{id:'uncle-inference',schemaId:inference.id,key:inference.key,value:'',children:[]}]
 const person=Object.values(world.views!).find(v=>v.kind==='graph')!,network=Object.values(world.views!).find(v=>v.kind==='relationGraph')!
 person.graph.lineStyles={sibling:{fill:'#FF59c48d',stroke:'#FF31734e',glow:10,lineWidth:3,fontSize:14},parent:{fill:'#FFef7777',stroke:'#FF844444',glow:8,lineWidth:2.5,fontSize:13}}
 network.graph.positions={parent:{x:100,y:140},sibling:{x:100,y:410},uncle:{x:550,y:230}}
 return {world,relations,person,network,entry,inference,row}
}

export function personRepeatedFixture(){
 const fixture=relationGraphFixture(),{world,person}=fixture,doc=world.documents.find(d=>d.id==='people')!
 const root=doc.schema.find(s=>s.key==='人物关系')!,row=root.children![0],container=row.children!.find(s=>s.key==='关系')!,leaf=container.children![0],story=row.children!.find(s=>s.key==='人物关系小故事')!
 doc.entities=[{id:'a',name:'甲',fields:[]},{id:'b',name:'乙',fields:[]}]
 const value=(id:string,relation:string):FieldValue=>({id,schemaId:leaf.id,key:classLink(world,'relations',relation),value:'',children:[]})
 const item=(id:string,target:string,children:FieldValue[]):FieldValue=>({id,schemaId:row.id,key:classLink(world,'people',target),value:'',children:[{id:`${id}-relations`,schemaId:container.id,key:container.key,value:'',children},{id:`${id}-story`,schemaId:story.id,key:story.key,value:'',children:[]}]})
 doc.entities[0].fields=[{id:'a-root',schemaId:root.id,key:root.key,value:'',children:[item('a-b','b',[value('parent-1','parent'),value('sibling-1','sibling'),value('parent-2','parent')])]}]
 doc.entities[1].fields=[{id:'b-root',schemaId:root.id,key:root.key,value:'',children:[item('b-a','a',[value('sibling-2','sibling')])]}]
 person.graph.positions={a:{x:90,y:170},b:{x:570,y:170}}
 return {...fixture,doc,row,leaf,story}
}
