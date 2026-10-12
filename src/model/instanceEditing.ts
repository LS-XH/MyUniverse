import {ClassDocument,Entity,FieldValue,uid} from './types'

export function duplicateInstances(entities:Entity[]):Entity[]{
 return entities.map(entity=>{
  const ids=new Map<string,string>()
  const collect=(fields:FieldValue[])=>fields.forEach(f=>{ids.set(f.id,uid());collect(f.children)})
  collect(entity.fields)
  const field=(value:FieldValue):FieldValue=>({...structuredClone(value),id:ids.get(value.id)!,children:value.children.map(field),...(value.functionOrigin?{functionOrigin:{...value.functionOrigin,bindingFieldId:ids.get(value.functionOrigin.bindingFieldId)||value.functionOrigin.bindingFieldId}}:{})})
  return {...structuredClone(entity),id:uid(),fields:entity.fields.map(field)}
 })
}
export function pasteInstances(doc:ClassDocument,entities:Entity[],selected:string[],labels:Record<string,string>={}):ClassDocument{
 const copies=duplicateInstances(entities),indices=doc.entities.map((e,i)=>selected.includes(e.id)?i:-1),last=Math.max(-1,...indices),at=last<0?doc.entities.length:last+1
 const entityLabels={...doc.entityLabels}
 copies.forEach((entity,i)=>{const label=labels[entities[i].id];if(doc.labels?.some(item=>item.id===label))entityLabels[entity.id]=label})
 return {...doc,entities:[...doc.entities.slice(0,at),...copies,...doc.entities.slice(at)],entityLabels}
}
export function deleteInstances(doc:ClassDocument,selected:string[]):ClassDocument{
 return {...doc,entities:doc.entities.filter(e=>!selected.includes(e.id)),entityLabels:Object.fromEntries(Object.entries(doc.entityLabels||{}).filter(([id])=>!selected.includes(id)))}
}
