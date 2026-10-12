import type {Entity,FieldValue} from './types'

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const conflict=(path:string):never=>{throw new Error(`修改目标“${path}”已变化或无法唯一匹配，请重新生成修改建议`)}
/** Apply only a proposal's changed content; unrelated accepted edits remain intact. */
function mergeText(before:string,after:string,current:string,path:string):string {
 if(before===after)return current
 if(current===before)return after
 if(current===after)return current
 let start=0,end=0
 while(start<before.length&&start<after.length&&before[start]===after[start])start++
 while(end<before.length-start&&end<after.length-start&&before[before.length-1-end]===after[after.length-1-end])end++
 const old=before.slice(start,before.length-end),replacement=after.slice(start,after.length-end)
 if(!old){
  // Insertions need their original surrounding content, never an arbitrary offset.
  const left=before.slice(0,start),right=before.slice(start),anchor=left+right
  if(!anchor||current.indexOf(anchor)<0||current.indexOf(anchor)!==current.lastIndexOf(anchor))return conflict(path)
  const offset=current.indexOf(anchor)+left.length
  return current.slice(0,offset)+replacement+current.slice(offset)
 }
 const offset=current.indexOf(old)
 if(offset<0||offset!==current.lastIndexOf(old))return conflict(path)
 return current.slice(0,offset)+replacement+current.slice(offset+old.length)
}
function mergeFields(before:FieldValue[],after:FieldValue[],current:FieldValue[],path:string):FieldValue[] {
 if(same(before,after))return current
 if(same(current,before))return after
 const result=[...current]
 for(const old of before){
  const next=after.find(f=>f.id===old.id),index=result.findIndex(f=>f.id===old.id),live=result[index],label=`${path} / ${old.key}`
  if(!next){if(!live)continue;if(!same(live,old))conflict(label);result.splice(index,1);continue}
  if(same(old,next))continue
  if(!live)conflict(label)
  result[index]={...live,key:mergeText(old.key,next.key,live.key,label),value:mergeText(old.value,next.value,live.value,label),children:mergeFields(old.children,next.children,live.children,label)}
  if(!same(old.functionResults,next.functionResults)){if(!same(live.functionResults,old.functionResults)&&!same(live.functionResults,next.functionResults))conflict(label);result[index].functionResults=next.functionResults}
 }
 for(let i=0;i<after.length;i++)if(!before.some(f=>f.id===after[i].id)){
  const item=after[i];if(result.some(f=>f.schemaId===item.schemaId&&f.key===item.key))conflict(`${path} / ${item.key}`)
  const previous=after[i-1],position=previous?result.findIndex(f=>f.id===previous.id)+1:0
  result.splice(position,0,item)
 }
 return result
}
export function mergeProposalEntity(before:Entity,after:Entity,current:Entity):Entity {
 return {...current,fields:mergeFields(before.fields,after.fields,current.fields,current.name)}
}
