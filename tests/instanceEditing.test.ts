import test from 'node:test'
import assert from 'node:assert/strict'
import {deleteInstances,pasteInstances,duplicateInstances} from '../src/model/instanceEditing'
import {ClassDocument} from '../src/model/types'
import {documentMarkdown,parseDocumentMarkdown} from '../src/model/markdown'
import {createWorld} from '../src/model/templates'
test('instance paste creates distinct recursive identities at the last selected item and preserves JSON-only labels',()=>{
 const world=createWorld('test'),doc:ClassDocument={id:'d',name:'地点',fileName:'地点.md',schema:[{id:'s',key:'描述',keyType:'Const',valueType:'Text'}],entities:['a','b','c'].map(id=>({id,name:id,fields:[{id:`f-${id}`,schemaId:'s',key:'描述',value:id,children:[]}]})),labels:[{id:'red',name:'重点',color:'#FFEF7777'}],entityLabels:{a:'red'}}
 const original=JSON.stringify(doc),next=pasteInstances(doc,[doc.entities[0]],['a','b'],doc.entityLabels)
 assert.deepEqual(next.entities.map(e=>e.name),['a','b','a','c'])
 const copy=next.entities[2];assert.notEqual(copy.id,'a');assert.notEqual(copy.fields[0].id,'f-a');assert.equal(copy.fields[0].schemaId,'s');assert.equal(next.entityLabels?.[copy.id],'red')
 const nested={...doc.entities[0],fields:[{...doc.entities[0].fields[0],children:[{...doc.entities[0].fields[0],id:'child'}]}]}
 assert.notEqual(duplicateInstances([nested])[0].fields[0].children[0].id,'child')
 assert.equal(pasteInstances(doc,[doc.entities[0]],[]).entities.at(-1)?.name,'a')
 const removed=deleteInstances(next,[copy.id]);assert.equal(removed.entityLabels?.[copy.id],undefined);assert.equal(removed.entities.length,3)
 assert.equal(JSON.stringify(doc),original)
 const text=documentMarkdown(doc);assert.equal(text.includes('重点'),false);assert.equal(text.includes('EF7777'),false)
 const parsed=parseDocumentMarkdown(text,doc,{...world,documents:[doc]});assert.deepEqual(parsed.labels,doc.labels);assert.deepEqual(parsed.entityLabels,doc.entityLabels)
})
