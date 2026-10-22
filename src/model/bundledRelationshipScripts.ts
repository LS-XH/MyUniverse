import scripts from './bundledRelationshipScripts.json'
import {createFunction} from './functions'
import type {FunctionScript} from './types'

export const jsFunctionTemplates=[
 {id:'default',label:'创建默认 JS 脚本',name:'',code:''},
 {id:'inference',label:'RelationEval · 关系推理',name:'RelationEval',code:scripts.inference},
 {id:'reverse',label:'RelationReverseEval · 关系反推',name:'RelationReverseEval',code:scripts.reverse},
 {id:'sister',label:'EvalSister · 姐妹关系',name:'EvalSister',code:scripts.sister},
] as const
export type JsFunctionTemplateId=typeof jsFunctionTemplates[number]['id']

/** A template creates an independent editable script, never installs or binds it. */
export function createJsFunction(items:FunctionScript[],templateId:JsFunctionTemplateId='default',folderId:string|null=null):FunctionScript {
 const template=jsFunctionTemplates.find(item=>item.id===templateId)
 if(!template)throw new Error('未知的 JS 脚本模板')
 const fn=createFunction(items,'js')
 if(template.id!=='default'){
  let name:string=template.name,n=2
  while(items.some(item=>item.name===name))name=`${template.name}${n++}`
  fn.name=name;fn.code=template.code
 }
 return {...fn,folderId}
}
