import {createWorld} from '../src/model/templates'
import type {ClassDocument,FieldValue} from '../src/model/types'
export function attributeFilterFixture(){
 const world=createWorld('属性筛选验收')
 const doc:ClassDocument={id:'things',name:'物件',fileName:'物件.md',schema:[{id:'group',keyType:'Text',key:'组',valueType:'Object',repeatable:true,children:[{id:'color',keyType:'Const',key:'颜色',valueType:'Text',repeatable:true},{id:'note',keyType:'Const',key:'备注',valueType:'Text'}]}],entities:[]}
 const leaf=(id:string,schemaId:string,key:string,value:string):FieldValue=>({id,schemaId,key,value,children:[]})
 const group=(id:string,key:string,children:FieldValue[]):FieldValue=>({id,schemaId:'group',key,value:'',children})
 doc.entities=[{id:'a',name:'甲物件',fields:[group('a-left','左组',[leaf('a-blue','color','颜色','蓝色'),leaf('a-red','color','颜色','红色'),leaf('a-note','note','备注','隐藏备注保留')]),group('a-right','右组',[leaf('a-green','color','颜色','绿色'),leaf('a-right-note','note','备注','另一旁支保留')])]},{id:'b',name:'乙物件',fields:[group('b-group','左组',[leaf('b-red','color','颜色','红色'),leaf('b-empty','color','颜色','')])]},{id:'c',name:'空物件',fields:[]}]
 world.documents=[...world.documents,doc]
 return {world,doc}
}
