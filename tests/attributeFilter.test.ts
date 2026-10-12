import test from 'node:test'
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {attributeFilterFixture} from './attributeFilterFixture'
import {attributeKey,attributeKeys,attributeValues,INSTANCE_FILTER_KEY,matchingAttributeBranch,matchesAttribute} from '../src/model/attributeFilter'
import {patchFieldTree} from '../src/model/interfaceViews'
import {documentMarkdown} from '../src/model/markdown'
import {FieldEditor} from '../src/ui/App'

test('recursive Key and Value choices include instance names, deduplicate keys, and distinguish empty values',()=>{
 const {world,doc}=attributeFilterFixture()
 assert.deepEqual(attributeKeys(world,doc).map(key=>key.label),['当前类实例','左组','颜色','备注','右组'])
 assert.deepEqual(attributeValues(world,doc,attributeKey('颜色')).map(value=>value.value),['蓝色','红色','绿色',''])
 assert.equal(attributeValues(world,doc,attributeKey('颜色')).at(-1)!.label,'（空值）')
 assert.deepEqual(attributeValues(world,doc,INSTANCE_FILTER_KEY).map(value=>value.value),['甲物件','乙物件','空物件'])
})
test('filter keeps matching descendants and ancestors, drops unrelated siblings, and does not mutate source data',()=>{
 const {doc}=attributeFilterFixture(),before=documentMarkdown(doc),filter={key:attributeKey('颜色'),value:'蓝色'}
 const ids=matchingAttributeBranch(doc.entities[0],filter)!
 assert.deepEqual([...ids],['a-blue','a-left'])
 assert.equal(matchesAttribute(doc.entities[0],filter,ids),true)
 assert.equal(matchesAttribute(doc.entities[1],filter,matchingAttributeBranch(doc.entities[1],filter)),false)
 const all=matchingAttributeBranch(doc.entities[0],{key:filter.key})!
 assert.deepEqual([...all],['a-blue','a-red','a-left','a-green','a-right'])
 assert.deepEqual([...matchingAttributeBranch(doc.entities[0],{key:attributeKey('左组')})!],['a-left','a-blue','a-red','a-note'])
 assert.deepEqual([...matchingAttributeBranch(doc.entities[1],{key:filter.key,value:''})!],['b-empty','b-group'])
 assert.equal(documentMarkdown(doc),before)
})
test('instance filter handles empty instances and generated-only branches respect the display toggle',()=>{
 const {doc}=attributeFilterFixture(),empty=doc.entities[2],filter={key:INSTANCE_FILTER_KEY,value:empty.name}
 assert.equal(matchesAttribute(empty,filter,matchingAttributeBranch(empty,filter)),true)
 assert.equal(matchesAttribute(doc.entities[0],filter,matchingAttributeBranch(doc.entities[0],filter)),false)
 const leaf=doc.entities[0].fields[0].children[0]
 leaf.functionOrigin={functionId:'f',name:'生成颜色',bindingFieldId:'a-left'}
 assert.equal(matchingAttributeBranch(doc.entities[0],{key:attributeKey('颜色'),value:'蓝色'},false)!.size,0)
 assert.equal(matchingAttributeBranch(doc.entities[0],{key:attributeKey('颜色'),value:'蓝色'},true)!.size,2)
})
test('filtered FieldEditor hides siblings while editing keeps their original values and IDs',()=>{
 const {world,doc}=attributeFilterFixture(),entity=doc.entities[0],field=entity.fields[0],ids=matchingAttributeBranch(entity,{key:attributeKey('颜色'),value:'蓝色'})!
 const html=renderToStaticMarkup(createElement(FieldEditor,{world,doc,field,schema:doc.schema[0],visibleIds:ids,onChange:()=>{}}))
 assert.match(html,/蓝色/);assert.doesNotMatch(html,/红色|隐藏备注保留/)
 const next=patchFieldTree(entity.fields,'a-blue',{...field.children[0],value:'修改蓝色'})
 assert.deepEqual(next[0].children[1],field.children[1]);assert.deepEqual(next[0].children[2],field.children[2])
 assert.deepEqual(next[1],entity.fields[1])
 assert.equal(entity.fields[0].children[0].value,'蓝色')
})
