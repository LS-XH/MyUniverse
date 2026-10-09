import test from 'node:test'
import assert from 'node:assert/strict'
import { createFunction, deleteFunction, functionInput, referenceBase, resolveFunctionReference } from '../src/model/functions'
import { applyFunctionResult, functionJobs } from '../src/services/functions'
import { documentMarkdown, parseDocumentMarkdown } from '../src/model/markdown'
import { ClassDocument, FunctionResult, Workspace } from '../src/model/types'
import { createWorld } from '../src/model/templates'
import { createPluginFolder, pluginFolderPath, removePluginFolder } from '../src/model/pluginFolders'
import { createFunctionApi, fieldTypedValue, functionContext, typedValueMarkdown, validateTypedValue } from '../src/model/functionValues'
import { createWorldApi, worldCatalog } from '../src/model/worldApi'
import { removeCollection } from '../src/model/collections'

function fixture(){
  const fn={...createFunction([]),apiVersion:undefined,returnType:undefined,id:'test-fn',name:'清理文本'},world=createWorld('函数世界')
  const schema={id:'text',keyType:'Const' as const,key:'原文',valueType:'Content' as const,functionIds:[fn.id]}
  const result:FunctionResult={functionId:fn.id,name:fn.name,fileName:'../../functions/test-fn.js',input:' 原始值 ',value:'函数结果\n# 正文标题',source:fn.code}
  const doc:ClassDocument={id:'test-doc',name:'测试',fileName:'测试.md',schema:[schema],entities:[{id:'entity',name:'实例',fields:[{id:'field',schemaId:'text',key:'原文',value:' 原始值 ',children:[],functionResults:[result]}]}]}
  world.documents.push(doc)
  return {fn,world,doc,result,workspace:{worlds:[world],activeWorldId:world.id,functions:[fn]} as Workspace}
}
test('Function Markdown keeps original values and derived children separate and restores bindings',()=>{
  const {doc,world}=fixture(),text=documentMarkdown(doc),round=parseDocumentMarkdown(text,doc,world)
  assert.deepEqual(round,doc)
  assert.match(text,/#### \[清理文本\]\(\.\.\/\.\.\/functions\/test-fn.js\)/)
  assert.match(text,/\\# 正文标题/)
  const fresh={...doc,schema:[],entities:[]},imported=parseDocumentMarkdown(text,fresh,world)
  assert.equal(imported.schema[0].valueType,'Text')
  assert.deepEqual(imported.schema[0].functionIds,['test-fn'])
  assert.equal(imported.entities[0].fields[0].children.length,0)
  assert.equal(imported.entities[0].fields[0].functionResults![0].value,'函数结果\n# 正文标题')
})
test('Object, Null and numeric function outputs round trip without changing source types',()=>{
  const {doc,world,result}=fixture()
  for(const type of ['Object','Null','Integer','Decimal','Class','Data'] as const){
    const value=type==='Integer'?'12':type==='Decimal'?'1.5':type==='Data'?'20261009':type==='Class'?'[实例](测试.md#%E5%AE%9E%E4%BE%8B)':''
    const schema={...doc.schema[0],valueType:type,children:type==='Object'?[{id:'child',keyType:'Const' as const,key:'内部',valueType:'Text' as const}]:undefined}
    const field={...doc.entities[0].fields[0],value,children:type==='Object'?[{id:'child-value',schemaId:'child',key:'内部',value:'子值',children:[]}]:[]}
    field.functionResults=[{...result,input:functionInput(field,schema),value:'123\n# 函数正文'}]
    const next={...doc,schema:[schema],entities:[{...doc.entities[0],fields:[field]}]}
    assert.deepEqual(parseDocumentMarkdown(documentMarkdown(next),next,world),next,type)
  }
})
test('automatic jobs only run changed inputs or scripts and discard stale completion',()=>{
  const {workspace,fn,result}=fixture()
  assert.equal(functionJobs(workspace).length,0)
  workspace.worlds[0].documents.at(-1)!.entities[0].fields[0].value='新输入'
  const job=functionJobs(workspace)[0]
  assert.equal(job.input,'新输入')
  const next=applyFunctionResult(workspace,job,{...result,input:job.input,value:'新结果'})
  assert.equal(functionJobs(next).length,0)
  const stale=structuredClone(workspace);stale.worlds[0].documents.at(-1)!.entities[0].fields[0].value='再次输入'
  assert.equal(applyFunctionResult(stale,job,{...result,input:job.input}),stale)
  const revised={...workspace,functions:[{...fn,code:'function transform(input){return input.toUpperCase()}'}]}
  assert.equal(applyFunctionResult(revised,job,result),revised)
  assert.equal(functionJobs(revised).length,1)
})
test('Class references resolve selected function output while retaining the referenced instance',()=>{
  const {world,doc}=fixture(),reference='[实例](测试.md#%E5%AE%9E%E4%BE%8B) [清理文本](../../functions/test-fn.js)@field'
  assert.equal(referenceBase(reference),'[实例](测试.md#%E5%AE%9E%E4%BE%8B)')
  assert.equal(resolveFunctionReference(world,reference),'函数结果\n# 正文标题')
  const schema={...doc.schema[0],valueType:'Class' as const},field={...doc.entities[0].fields[0],value:reference}
  assert.equal(functionInput(field,schema,world),'函数结果\n# 正文标题')
})
test('deleting a function clears nested schema bindings and results across worlds',()=>{
  const {workspace,fn}=fixture(),next=deleteFunction(workspace,fn.id)
  assert.equal(next.functions!.length,0)
  assert.deepEqual(next.worlds[0].documents.at(-1)!.schema[0].functionIds,[])
  assert.deepEqual(next.worlds[0].documents.at(-1)!.entities[0].fields[0].functionResults,[])
  assert.equal(workspace.functions!.length,1)
})
test('function errors do not serialize as successful return values or overwrite originals',()=>{
  const {doc,world}=fixture();doc.entities[0].fields[0].functionResults![0].error='运行失败'
  const text=documentMarkdown(doc),parsed=parseDocumentMarkdown(text,doc,world)
  assert.equal(text.includes('#### [清理文本]'),false)
  assert.equal(parsed.entities[0].fields[0].value,' 原始值 ')
  assert.equal(parsed.entities[0].fields[0].functionResults![0].error,'运行失败')
})
test('cyclic function output references are reported once without executing indefinitely',()=>{
  const {workspace,result}=fixture(),doc=workspace.worlds[0].documents.at(-1)!
  doc.schema[0].valueType='Class'
  doc.entities[0].fields[0].value='[实例](测试.md#%E5%AE%9E%E4%BE%8B) [清理文本](../../functions/test-fn.js)@field'
  const job=functionJobs(workspace)[0]
  assert.match(job.error!,/循环/)
  const next=applyFunctionResult(workspace,job,{...result,input:job.input,value:'',error:job.error})
  assert.equal(functionJobs(next).length,0)
})
test('plugin folders isolate categories and deletion lifts contents without changing function identity or bindings',()=>{
  const {workspace,fn}=fixture()
  const parent=createPluginFolder(workspace,'functions',null,'整理')
  workspace.pluginFolders=[parent]
  const child=createPluginFolder(workspace,'functions',parent.id,'子文件夹')
  workspace.pluginFolders.push(child)
  workspace.functions![0].folderId=parent.id
  assert.deepEqual(pluginFolderPath(workspace,child.id).map(f=>f.name),['整理','子文件夹'])
  assert.throws(()=>createPluginFolder(workspace,'skills',parent.id,'错误父级'))
  const next=removePluginFolder(workspace,parent.id)
  assert.equal(next.pluginFolders![0].parentId,null)
  assert.equal(next.functions![0].folderId,null)
  assert.equal(next.functions![0].id,fn.id)
  assert.deepEqual(next.worlds[0].documents.at(-1)!.schema[0].functionIds,[fn.id])
  assert.equal(next.functions![0].code,fn.code)
})

test('typed inputs preserve nested schema types and self resolves the calling instance',()=>{
  const {world,doc}=fixture(),field=doc.entities[0].fields[0],schema=doc.schema[0]
  const context=functionContext(world,doc,doc.entities[0],field,schema)
  const api=createWorldApi(worldCatalog(world))
  const runtime=new Function('world','context','contract',`return (${createFunctionApi.toString()})(world,context,contract)`)(api,context,{type:'Object'})
  assert.equal(runtime.self.name,'实例')
  assert.equal(runtime.self.type,'Class')
  assert.equal(runtime.input.type,'Content')
  assert.equal(runtime.input.value(),' 原始值 ')
  assert.deepEqual(runtime.self.get_member('field').to_value(),{type:'Content',value:' 原始值 '})
  const object=runtime.values.object({姓名:runtime.values.text(runtime.self.name),原文:runtime.input.to_value()})
  assert.equal(validateTypedValue(object).members![0].value.type,'Text')
  assert.match(typedValueMarkdown(object),/# 姓名\n\n实例/)
  const nested=fieldTypedValue({...field,children:[{id:'num',schemaId:'number',key:'数值',value:'12',children:[]}]},{...schema,valueType:'Object',children:[{id:'number',keyType:'Const',key:'数值',valueType:'Integer'}]},world)
  const input=createFunctionApi(api,{...context,input:nested},{type:'Integer'}).input
  assert.equal(input.get_member('number').type,'Integer')
  assert.equal(input.get_member('数值').value(),12)
  assert.throws(()=>input.get_member('missing'),/不存在/)
})

test('typed return contracts reject native guesses, invalid dates and integers, broken references and class schema violations',()=>{
  const {world,doc}=fixture()
  assert.throws(()=>validateTypedValue('text'),/带 type/)
  assert.throws(()=>validateTypedValue({type:'Integer',value:1.5}),/安全整数/)
  assert.throws(()=>validateTypedValue({type:'Integer',value:Number.MAX_SAFE_INTEGER+1}),/安全整数/)
  assert.throws(()=>validateTypedValue({type:'Decimal',value:Infinity}),/有限/)
  assert.throws(()=>validateTypedValue({type:'Text',value:1}),/文字/)
  assert.throws(()=>validateTypedValue({type:'Data',value:'20260230'}),/日期/)
  assert.equal(validateTypedValue({type:'Data',value:'20240229'}).value,'20240229')
  assert.throws(()=>validateTypedValue({type:'Text',value:'x'},{type:'Integer'}),/应为 Integer/)
  assert.throws(()=>validateTypedValue({type:'Class',classId:doc.id,entityId:'missing'},undefined,world),/不存在/)
  const ref=validateTypedValue({type:'Class',classId:doc.id,entityId:'entity'},{type:'Class',classId:doc.id},world)
  assert.equal(typedValueMarkdown(ref,world),'[实例](测试.md#%E5%AE%9E%E4%BE%8B)')
  assert.throws(()=>validateTypedValue({type:'Object',members:[]},{type:'Object',classId:doc.id},world),/需要一个属性/)
  const structured={type:'Object',members:[{key:'原文',value:{type:'Content',value:'返回内容'}}]}
  assert.equal(validateTypedValue(structured,{type:'Object',classId:doc.id},world).classId,doc.id)
  assert.throws(()=>validateTypedValue({...structured,members:[{key:'原文',value:{type:'Text',value:'错误类型'}}]},{type:'Object',classId:doc.id},world),/应为 Content/)
  assert.throws(()=>validateTypedValue({...structured,members:[...structured.members,{key:'多余',value:{type:'Text',value:'x'}}]},{type:'Object',classId:doc.id},world),/不在类/)
})

test('typed automatic jobs retain structured results through Markdown and rerun on self or contract changes',()=>{
  const {workspace,fn,doc,world}=fixture()
  fn.apiVersion=2;fn.returnType={type:'Object'}
  fn.code='function transform(self,input){return values.object({name:values.text(self.name),text:input.to_value()});}'
  const job=functionJobs(workspace)[0],runtime=createFunctionApi(createWorldApi(worldCatalog(world)),job.context!,fn.returnType)
  const typedValue=validateTypedValue(new Function('values',fn.code+';return transform;')(runtime.values)(runtime.self,runtime.input),fn.returnType,world)
  const result={functionId:fn.id,name:fn.name,fileName:`../../functions/${fn.id}.js`,input:job.input,value:typedValueMarkdown(typedValue,world),typedValue,contextKey:job.contextKey,source:job.source}
  const next=applyFunctionResult(workspace,job,result),nextDoc=next.worlds[0].documents.find(d=>d.id===doc.id)!
  assert.equal(functionJobs(next).length,0)
  const round=parseDocumentMarkdown(documentMarkdown(nextDoc),nextDoc,next.worlds[0])
  assert.deepEqual(round.entities[0].fields[0].functionResults![0],result)
  const imported=parseDocumentMarkdown(documentMarkdown(nextDoc),{...nextDoc,entities:[]},next.worlds[0])
  assert.deepEqual(imported.entities[0].fields[0].functionResults![0].typedValue,typedValue)
  const changed=structuredClone(next);changed.worlds[0].documents.find(d=>d.id===doc.id)!.entities[0].name='新名字'
  assert.equal(functionJobs(changed).length,1)
  assert.equal(applyFunctionResult(changed,job,result),changed)
  changed.functions![0].returnType={type:'Text'}
  assert.notEqual(functionJobs(changed)[0].source,job.source)
})

test('selected derived references supply their typed result instead of a flattened string',()=>{
  const {world,doc}=fixture(),field=doc.entities[0].fields[0]
  field.functionResults![0].typedValue={type:'Integer',value:25}
  const reference='[实例](测试.md#%E5%AE%9E%E4%BE%8B) [清理文本](../../functions/test-fn.js)@field'
  assert.deepEqual(fieldTypedValue({...field,value:reference},{...doc.schema[0],valueType:'Class'},world),{type:'Integer',value:25})
  delete field.functionResults![0].typedValue
  assert.equal(fieldTypedValue({...field,value:reference},{...doc.schema[0],valueType:'Class'},world).type,'Text')
  field.functionResults![0].error='失败'
  assert.throws(()=>fieldTypedValue({...field,value:reference},{...doc.schema[0],valueType:'Class'},world),/尚未生成|失败/)
})

test('removing custom collections preserves content and protects default collections',()=>{
  const {world}=fixture(),parent=world.nodes.find(n=>n.type==='collection')!
  assert.equal(removeCollection(world,parent.id),world)
  world.nodes.push({id:'custom',name:'自建',type:'collection',parentId:parent.id},{id:'nested',name:'嵌套',type:'collection',parentId:'custom'},{id:'file',name:'测试类',type:'file',classId:'test-doc',parentId:'custom'})
  const next=removeCollection(world,'custom')
  assert.equal(next.nodes.some(n=>n.id==='custom'),false)
  assert.equal(next.nodes.find(n=>n.id==='nested')!.parentId,parent.id)
  assert.equal(next.nodes.find(n=>n.id==='file')!.parentId,parent.id)
  assert.equal(next.documents,world.documents)
  assert.equal(world.nodes.find(n=>n.id==='nested')!.parentId,'custom')
})
