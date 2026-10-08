import { ClassDocument, FieldValue, World } from './types'
import { escapeTextHeadings, parseDocumentMarkdown } from './markdownParser'
export { parseDocumentMarkdown } from './markdownParser'
export function classLink(world: World, classId: string, entityId: string): string {
  const doc=world.documents.find(d=>d.id===classId), entity=doc?.entities.find(e=>e.id===entityId)
  return doc && entity ? `[${entity.name}](${doc.fileName}#${encodeURIComponent(entity.name)})` : ''
}
function fieldMarkdown(fields: FieldValue[], depth: number): string {
  return fields.map(field => {
    const heading = `${'#'.repeat(depth)} ${field.key}\n`
    const value = field.value ? `\n${escapeTextHeadings(field.value, true)}\n` : ''
    return heading + value + (field.children.length ? `\n${fieldMarkdown(field.children, depth+1)}` : '')
  }).join('\n')
}
export function documentMarkdown(doc: ClassDocument): string {
  return `# ${doc.name}\n\n${doc.entities.map(e=>`## ${e.name}\n\n${fieldMarkdown(e.fields,3)}`).join('\n')}`.trimEnd()+'\n'
}
export function markdownLocations(doc:ClassDocument):Record<string,{key:number;value:number;end:number}> {
  const source=documentMarkdown(doc),locations:Record<string,{key:number;value:number;end:number}>={}
  let cursor=0
  const line=(offset:number)=>source.slice(0,offset).split('\n').length-1
  const fields=(items:FieldValue[],depth:number)=>items.forEach(field=>{
    const heading=`${'#'.repeat(depth)} ${field.key}\n`,start=source.indexOf(heading,cursor)
    cursor=start+heading.length
    const valueStart=cursor+(field.value?1:0)
    if(field.value)cursor=valueStart+escapeTextHeadings(field.value,true).length
    locations[field.id]={key:line(start),value:field.value?line(valueStart):line(start),end:line(cursor)}
    fields(field.children,depth+1)
  })
  doc.entities.forEach(entity=>{
    const start=source.indexOf(`## ${entity.name}\n`,cursor)
    locations[entity.id]={key:line(start),value:line(start),end:line(start)}
    cursor=start+`## ${entity.name}\n`.length
    fields(entity.fields,3)
  })
  return locations
}
export function exportFiles(world: World): Record<string,string> {
  const files: Record<string,string>={}
  for(const doc of world.documents){
    const text=documentMarkdown(doc)
    // Validate before hitting the filesystem, including temporarily incomplete
    // code fences or duplicate names while editing. The source preview stays live.
    try { parseDocumentMarkdown(text,doc,world) }
    catch(error){throw new Error(`${world.name} / ${doc.fileName}：${error instanceof Error?error.message:String(error)}。尚未写入文件。`)}
    files[doc.fileName]=text;files[doc.fileName.replace(/\.md$/i,'.schema.json')]=JSON.stringify(doc.schema,null,2)
  }
  files['关系网.json']=JSON.stringify(world.graph,null,2)
  files['地图配置.json']=JSON.stringify(world.map,null,2)
  files['聊天框配置.json']=JSON.stringify(world.chat,null,2)
  return files
}
