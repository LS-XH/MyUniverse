import {createWorld} from '../src/model/templates'
import type {Workspace,FunctionScript} from '../src/model/types'
export function runtimeFixture(count=2){
 const world=createWorld('JSON 后台'),doc=world.documents[0]
 const fn:FunctionScript={id:'fn',name:'生成',language:'js',apiVersion:2,executionMode:'void',code:'function transform(self,input){input.add("item", values.text("新版"));}'}
 doc.schema=[{id:'group',key:'组',keyType:'Const',valueType:'Object',functionIds:['fn'],children:[{id:'item',key:'项',keyType:'Const',valueType:'Text',repeatable:true}]}]
 doc.entities=Array.from({length:count},(_,i)=>({id:`e${i}`,name:`实例${i}`,fields:[{id:`root${i}`,schemaId:'group',key:'组',value:'',children:[
  {id:`u${i}`,schemaId:'item',key:'项',value:'用户前',children:[]},
  {id:`g${i}`,schemaId:'item',key:'项',value:'旧版',children:[],functionOrigin:{functionId:fn.id,name:fn.name,bindingFieldId:`root${i}`}},
  {id:`v${i}`,schemaId:'item',key:'项',value:'用户后',children:[]}
 ]}]}))
 const workspace:Workspace={worlds:[world],activeWorldId:world.id,functions:[fn]};return {workspace,world,doc,fn}
}
