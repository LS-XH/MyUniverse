import type {ClassDocument,Entity,World} from './types'
export interface ReferenceChoice {doc:ClassDocument;entity:Entity;color?:string;search:string;link:string}
const documents=new WeakMap<ClassDocument,ReferenceChoice[]>()
const worlds=new WeakMap<World['documents'],{choices:ReferenceChoice[];byId:Map<string,ReferenceChoice>;byLink:Map<string,ReferenceChoice>}>()
/** Immutable document identities invalidate indexes without copying content values. */
export function referenceIndex(world:World){
 let index=worlds.get(world.documents)
 if(!index){
  const choices=world.documents.flatMap(doc=>{
   let entries=documents.get(doc)
   if(!entries){const labels=new Map(doc.labels?.map(label=>[label.id,label.color]));entries=doc.entities.map(entity=>({doc,entity,color:labels.get(doc.entityLabels?.[entity.id]||''),search:`${doc.name} ${entity.name}`.toLowerCase(),link:`[${entity.name}](${doc.fileName}#${encodeURIComponent(entity.name)})`}));documents.set(doc,entries)}
   return entries
  })
  index={choices,byId:new Map(choices.map(choice=>[choice.entity.id,choice])),byLink:new Map(choices.map(choice=>[choice.link,choice]))};worlds.set(world.documents,index)
 }
 return index
}
