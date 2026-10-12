import { ClassDocument, FieldValue, World } from './types'
import { escapeTextHeadings, parseDocumentMarkdown } from './markdownParser'
export { parseDocumentMarkdown } from './markdownParser'
export function markdownHeadingLevels(text:string):number[] {
  let fence:{char:string;length:number}|null=null
  return text.split('\n').map(line=>{
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/)
    if(marker){if(!fence)fence={char:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.char&&marker[1].length>=fence.length&&/^ {0,3}(`+|~+)\s*$/.test(line))fence=null;return 0}
    return fence?0:(line.match(/^ {0,3}(#+)\s/)?.[1].length||0)
  })
}
export function classLink(world: World, classId: string, entityId: string): string {
  const doc=world.documents.find(d=>d.id===classId), entity=doc?.entities.find(e=>e.id===entityId)
  return doc && entity ? `[${entity.name}](${doc.fileName}#${encodeURIComponent(entity.name)})` : ''
}
export function fieldHeading(field:FieldValue,depth:number):string {
 const name=field.functionOrigin?.name.replace(/[&<>-]/g,c=>`&#${c.charCodeAt(0)};`).replace(/[\r\n]/g,' ')
 return `${'#'.repeat(depth)} ${field.key}${name?` <!-- ${name} -->`:''}\n`
}
export function fieldMarkdown(fields: FieldValue[], depth: number): string {
  return fields.map(field => {
    const heading = fieldHeading(field,depth)
    const value = field.value ? `\n${escapeTextHeadings(field.value, true)}\n` : ''
    return heading + value + (field.children.length ? `\n${fieldMarkdown(field.children, depth+1)}` : '')
  }).join('\n')
}
export function entityMarkdown(entity:ClassDocument['entities'][number]):string {return `## ${entity.name}\n\n${fieldMarkdown(entity.fields,3)}`.replace(/\n+$/,'')+'\n'}
export function documentMarkdown(doc: ClassDocument): string {
  return `# ${doc.name}\n\n${doc.entities.map(e=>`## ${e.name}\n\n${fieldMarkdown(e.fields,3)}`).join('\n')}`.replace(/\n+$/,'')+'\n'
}
export function markdownLocations(doc:ClassDocument):Record<string,{key:number;value:number;end:number}> {
  const source=documentMarkdown(doc),locations:Record<string,{key:number;value:number;end:number}>={}
  let cursor=0
  const breaks:number[]=[]
  for(let i=0;i<source.length;i++)if(source[i]==='\n')breaks.push(i)
  const line=(offset:number)=>{let low=0,high=breaks.length;while(low<high){const mid=(low+high)>>>1;if(breaks[mid]<offset)low=mid+1;else high=mid}return low}
  const fields=(items:FieldValue[],depth:number)=>items.forEach(field=>{
    const heading=fieldHeading(field,depth),start=source.indexOf(heading,cursor)
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
  for(const view of Object.values(world.views||{})){if(!/^[^\\/:]+\.view\.json$/.test(view.fileName)||files[view.fileName])throw new Error('界面配置文件名必须唯一且位于当前 world 目录');files[view.fileName]=JSON.stringify(view,null,2)}
  files['world-index.json']=JSON.stringify({version:1,id:world.id,name:world.name,nodes:world.nodes,documents:world.documents.map(({id,name,fileName,protected:protectedFile})=>({id,name,fileName,protected:protectedFile})),views:Object.values(world.views||{}).map(({id,fileName,kind,parentClassId})=>({id,fileName,kind,parentClassId}))},null,2)
  files['关系网.json']=JSON.stringify(world.graph,null,2)
  files['地图配置.json']=JSON.stringify(world.map,null,2)
  files['聊天框配置.json']=JSON.stringify(world.chat,null,2)
  return files
}
