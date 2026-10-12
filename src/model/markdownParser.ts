import { ClassDocument, Entity, FieldSchema, FieldValue, World, uid } from './types'
import { functionInput, parseFunctionLink } from './functions'
import { typedValueMarkdown, validateTypedValue } from './functionValues'

// Escape property-like headings inside text. Fenced code remains verbatim.
export function escapeTextHeadings(text: string, escape: boolean): string {
  let fence: { char: string; size: number } | null = null
  return text.split('\n').map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = { char: marker[1][0], size: marker[1].length }
      else if (marker[1][0] === fence.char && marker[1].length >= fence.size && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null
      return line
    }
    if (fence) return line
    if (escape && /^(\\*)#+(?:\s|$)/.test(line)) return `\\${line}`
    if (!escape && /^\\(\\*)#+(?:\s|$)/.test(line)) return line.slice(1)
    return line
  }).join('\n')
}

interface Heading { level: number; key: string; start: number; end: number; children: Heading[];originName?:string }
function headingTree(markdown: string): { root: Heading; lines: string[] } {
  const lines = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const roots: Heading[] = [], stack: Heading[] = []
  let fence: { char: string; size: number } | null = null
  lines.forEach((line, index) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = { char: marker[1][0], size: marker[1].length }
      else if (marker[1][0] === fence.char && marker[1].length >= fence.size && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null
      return
    }
    if (fence) return
    const match = line.match(/^(#+)(?:[ \t]+(.*)|\s*)$/)
    if (!match) return
    const originName=(match[2]||'').match(/[ \t]+<!--\s*(?:<!>\s*)?(.*?)\s*-->[ \t]*$/)?.[1]?.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    const node: Heading = { level: match[1].length, key: (match[2] || '').replace(/[ \t]+<!--\s*(?:<!>\s*)?.*?\s*-->[ \t]*$/,'').trim(), start: index, end: lines.length, children: [],...(originName?{originName}:{}) }
    if (node.level <= 2 && !node.key) throw new Error(`第 ${index + 1} 行的类名或实例名称不能为空`)
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()!.end = index
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  })
  if (fence) throw new Error('Markdown 代码块尚未闭合，请补上对应的 ``` 或 ~~~')
  if (roots.length !== 1 || roots[0].level !== 1) throw new Error('Markdown 必须包含一个一级标题作为类名，二级标题作为实例名称')
  if (roots[0].children.some(node => node.level !== 2)) throw new Error('属性必须放在二级实例标题下面')
  const names = roots[0].children.map(node => node.key)
  const seenNames=new Set<string>(),duplicateNames=new Set<string>()
  for(const name of names){if(seenNames.has(name))duplicateNames.add(name);seenNames.add(name)}
  if (duplicateNames.size) throw new Error(`实例名称重复：${[...duplicateNames].map(name=>`“${name}”`).join('、')}，无法准确引用；请使用不同的二级标题`)
  return { root: roots[0], lines }
}
const trimBlankLines = (text: string) => text.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '')
function emptyField(schema: FieldSchema, previous?: FieldValue): FieldValue {
  return { id: previous?.id || uid(), schemaId: schema.id, key: schema.keyType === 'Const' ? schema.key : '', value: '', children: (schema.children || []).filter(s => !s.repeatable).map(s => emptyField(s, previous?.children.find(field => field.schemaId === s.id))) }
}
function referenceClass(value: string, world?: World): string | undefined {
  const match = value.match(/^\[[^\]]*\]\(([^#]+)#[^)]+\)/)
  return match ? world?.documents.find(doc => doc.fileName === match[1])?.id : undefined
}
function canonicalReference(value: string): string {
  return value.replace(/\[([^\]]*)\]\(([^#\n]+)#([^\n)]+)\)/g, (original, label: string, file: string, anchor: string) => {
    try { return `[${label}](${file}#${encodeURIComponent(decodeURIComponent(anchor))})` } catch { return original }
  })
}

/** Types come from the schema; Markdown supplies entity names and property values. */
export function parseDocumentMarkdown(markdown: string, previous: ClassDocument, world?: World, options: {rejectUnknown?:boolean;enforceGeneratedReadOnly?:boolean;functionNames?:Record<string,string>} = {}): ClassDocument {
  const { root, lines } = headingTree(markdown)
  const schema: FieldSchema[] = structuredClone(previous.schema)
  const functionNames={...options.functionNames}
  const indexNames=(fields:FieldValue[])=>fields.forEach(f=>{if(f.functionOrigin&&!functionNames[f.functionOrigin.functionId])functionNames[f.functionOrigin.functionId]=f.functionOrigin.name;indexNames(f.children)})
  previous.entities.forEach(e=>indexNames(e.fields))
  let sources:Record<string,unknown>={}
  const sourceLine=lines.slice(root.start+1,root.children[0]?.start??root.end).find(line=>/^<!-- function-sources:/.test(line))
  if(sourceLine){try{const parsed=JSON.parse(sourceLine.replace(/^<!-- function-sources:/,'').replace(/ -->$/,''));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();sources=parsed}catch{throw new Error('函数来源索引无效')}}
  const metadata=(node:Heading)=>{
    const raw=lines.slice(node.start+1,node.children[0]?.start??node.end).join('\n'),match=raw.match(/^\s*<!-- function-origin:([^\n]+) -->/)
    if(!match)return undefined
    try{const ref=match[1], entry=sources[ref];const value=/^f[0-9a-z]+$/.test(ref)?(Array.isArray(entry)&&entry.length===5?Object.fromEntries(['id','schemaId','functionId','name','bindingFieldId'].map((key,i)=>[key,entry[i]])):null):JSON.parse(decodeURIComponent(ref));if(!value)throw new Error();if(['id','schemaId','functionId','name','bindingFieldId'].some(k=>typeof value[k]!=='string'||!value[k]))throw new Error();return value as {id:string;schemaId:string;functionId:string;name:string;bindingFieldId:string}}catch{throw new Error('函数追加属性的来源元数据无效')}
  }
  const stripOrigin=(text:string)=>text.replace(/^\s*<!-- function-origin:[^\n]+ -->\s*\n?/, '')
  const rawValue = (node: Heading, descendants = false) => escapeTextHeadings(trimBlankLines(stripOrigin(lines.slice(node.start + 1, descendants ? node.end : node.children[0]?.start ?? node.end).join('\n'))), false)
  if (rawValue(root).replace(/^<!-- function-sources:[^\n]* -->\s*/,'')) throw new Error('一级类标题下的正文没有对应实例，请将正文移到一个二级实例标题下面')
  function addBody(body: string, schemas: FieldSchema[], fields: FieldValue[]) {
    if (!body) return
    let content = schemas.find(s => s.key === '内容' && s.keyType === 'Const')
    if (!content) return
    const existing = fields.find(f => f.schemaId === content.id)
    if (existing) existing.value = body + (existing.value ? `\n\n${existing.value}` : '')
    else fields.unshift({ ...emptyField(content), value: body })
  }
  type Owner={id:string;schema:FieldSchema;origin?:FieldValue['functionOrigin']}
  function bind(nodes: Heading[], schemas: FieldSchema[], old: FieldValue[],ancestors:Owner[]=[]): FieldValue[] {
    const siblings:Owner[]=[]
    const used = new Set<string>(), counts = new Map<string, number>()
    const fields = nodes.flatMap(node => {
      const origin=metadata(node)
      let target = origin?schemas.find(s=>s.id===origin.schemaId):schemas.find(s => s.keyType === 'Const' && s.key === node.key)
      if (!target&&!origin) target = schemas.find(s => s.keyType === 'Class' && /^\[.*\]\(.*#.*\)/.test(node.key) && (!s.classId || referenceClass(node.key, world) === s.classId))
      // An unselected Class-key row is still an instance of its configured schema.
      // Editors and model-supplied Markdown may retain its empty/placeholder title.
      if (!target&&!origin) {
        const placeholders=schemas.filter(s=>s.keyType==='Class'&&(s.repeatable||!counts.has(s.id))&&(
          node.key===''||node.key==='新属性'||node.key===s.placeholder||node.key===s.key
        ))
        if(placeholders.length===1)target=placeholders[0]
      }
      if (!target&&!origin) target = schemas.find(s => s.keyType === 'Text' && (s.repeatable || !counts.has(s.id)))
      if (!target || (!target.repeatable && counts.has(target.id))) {if(options.rejectUnknown)throw new Error('修改建议不能修改类结构，请保留已有属性结构');return []}
      counts.set(target.id, (counts.get(target.id) || 0) + 1)
      const key = target.keyType === 'Class' ? canonicalReference(node.key) : node.key
      const prior = (origin?old.find(field=>!used.has(field.id)&&field.id===origin.id&&field.schemaId===target!.id):undefined) || old.find(field => !used.has(field.id) && field.schemaId === target.id && field.key === key && (!node.originName||field.functionOrigin?.name===node.originName))
        || old.find(field => !used.has(field.id) && field.schemaId === target.id && (!node.originName||field.functionOrigin?.name===node.originName))
      if (prior) used.add(prior.id)
      const fieldId=origin?.id||prior?.id||uid()
      let resolvedOrigin=origin?{functionId:origin.functionId,name:origin.name,bindingFieldId:origin.bindingFieldId}:undefined
      if(node.originName&&!resolvedOrigin){
        if(prior?.functionOrigin&&prior.functionOrigin.name===node.originName)resolvedOrigin={...prior.functionOrigin,name:node.originName}
        else{
          const choices=(owners:Owner[])=>owners.flatMap(owner=>owner.origin?.name===node.originName?[owner.origin]:(owner.schema.functionIds||[]).filter(id=>functionNames[id]===node.originName||!functionNames[id]&&owner.schema.functionIds?.length===1).map(functionId=>({functionId,name:node.originName!,bindingFieldId:owner.id})))
          for(const owner of [...ancestors].reverse()){const matches=choices([owner]);if(matches.length===1){resolvedOrigin=matches[0];break}if(matches.length>1)throw new Error(`函数“${node.originName}”来源不唯一，请检查绑定或 JSON 来源记录`)}
          if(!resolvedOrigin){const matches=choices(siblings);if(matches.length===1)resolvedOrigin=matches[0];else throw new Error(`函数“${node.originName}”来源${matches.length?'不唯一':'未找到'}，请检查绑定或 JSON 来源记录`)}
        }
      }
      const owner:Owner={id:fieldId,schema:target,...(resolvedOrigin?{origin:resolvedOrigin}:{})}
      if(!resolvedOrigin)siblings.push(owner)
      const functionNodes=node.children.filter(child=>{const link=parseFunctionLink(child.key);return link&&target.functionIds?.includes(link.functionId)})
      const propertyNodes=node.children.filter(child=>!parseFunctionLink(child.key))
      const originalValue=()=>escapeTextHeadings(trimBlankLines(stripOrigin(lines.slice(node.start+1,node.children.find(child=>parseFunctionLink(child.key))?.start??node.end).join('\n'))),false)
      let children: FieldValue[] = [], value = ''
      if (target.valueType === 'Object') {
        children = bind(propertyNodes, target.children || [], prior?.children || [],[...ancestors,owner])
        addBody(rawValue(node), target.children || [], children)
      } else if (target.valueType !== 'Null') value = originalValue()
      else if (originalValue()) throw new Error(`“${node.key}”配置为 Null，不能包含内容；请先修改属性类型`)
      if (target.valueType === 'Class') value = canonicalReference(value)
      if (value && target.valueType === 'Integer' && !/^-?\d+$/.test(value)) throw new Error(`“${node.key}”需要整数`)
      if (value && target.valueType === 'Decimal' && !/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`“${node.key}”需要小数`)
      if (value && target.valueType === 'Data' && !/^\d{8}$/.test(value)) throw new Error(`“${node.key}”需要 YYYYMMDD 格式日期`)
      const field:FieldValue={ id: fieldId, schemaId: target.id, key, value, children, ...(resolvedOrigin?{functionOrigin:resolvedOrigin}:{}) }
      if(options.enforceGeneratedReadOnly!==false&&prior?.functionOrigin){
        const protectedValue=(f:FieldValue):unknown=>({id:f.id,schemaId:f.schemaId,key:f.key,value:f.value,origin:f.functionOrigin,children:f.children.map(protectedValue)})
        if(JSON.stringify(protectedValue(field))!==JSON.stringify(protectedValue(prior)))throw new Error('函数生成的成员为只读，不能修改其键、值、子成员或来源')
      }
      if(prior?.functionRuns)field.functionRuns=prior.functionRuns.filter(run=>run.input===functionInput(field,target,world))
      if(functionNodes.length){
        const input=functionInput(field,target,world)
        field.functionResults=functionNodes.map(child=>{
          const link=parseFunctionLink(child.key)!,previousResult=prior?.functionResults?.find(r=>r.functionId===link.functionId)
          const raw=rawValue(child,true),metadata=raw.match(/\n?<!-- function-value:([^\n]+) -->\s*$/)
          let typed:Pick<import('./types').FunctionResult,'typedValue'|'contextKey'>={}
          let resultValue=metadata?raw.slice(0,metadata.index).trimEnd():raw
          if(metadata){try{const decoded=JSON.parse(decodeURIComponent(metadata[1]));typed={typedValue:decoded.typedValue,...(typeof decoded.contextKey==='string'?{contextKey:decoded.contextKey}:{})};if(typed.typedValue){typed.typedValue=validateTypedValue(typed.typedValue,undefined,world);const canonical=typedValueMarkdown(typed.typedValue,world);if(canonical.trimEnd()===resultValue)resultValue=canonical;else typed={}}}catch{throw new Error(`函数“${link.name}”返回值类型元数据无效`)}}
          const contextKey=typed.contextKey||(previousResult?.input===input&&previousResult.value===resultValue?previousResult.contextKey:undefined)
          return {...link,input,value:resultValue,...typed,...(contextKey?{contextKey}:{}),...(previousResult?.input===input&&previousResult.source?{source:previousResult.source}:{})}
        })
      }else if(prior?.functionResults?.some(r=>r.error))field.functionResults=prior.functionResults.filter(r=>r.error)
      return [field]
    })
    if(options.enforceGeneratedReadOnly!==false&&old.some(f=>f.functionOrigin&&schemas.some(s=>s.id===f.schemaId)&&!fields.some(next=>next.id===f.id)))throw new Error('函数生成的成员为只读，不能直接删除；请解绑函数以清理')
    for (const s of schemas) if (!s.repeatable && !fields.some(f => f.schemaId === s.id)) fields.push(emptyField(s, old.find(f => f.schemaId === s.id)))
    return fields
  }
  const unmatchedOld = previous.entities.filter(entity => !root.children.some(node => node.key === entity.name))
  const unmatchedNew = root.children.filter(node => !previous.entities.some(entity => entity.name === node.key))
  const entities: Entity[] = root.children.map(node => {
    const prior = previous.entities.find(entity => entity.name === node.key)
      || (unmatchedOld.length === unmatchedNew.length ? unmatchedOld[unmatchedNew.indexOf(node)] : undefined)
    const fields = bind(node.children, schema, prior?.fields || [])
    addBody(rawValue(node), schema, fields)
    return { id: prior?.id || uid(), name: node.key, fields }
  })
  const complete = (schemas: FieldSchema[], fields: FieldValue[]): FieldValue[] => {
    const next = fields.map(field => { const s = schemas.find(s => s.id === field.schemaId); return s?.valueType === 'Object' ? { ...field, children: complete(s.children || [], field.children) } : field })
    for (const s of schemas) if (!s.repeatable && !next.some(field => field.schemaId === s.id)) next.push(emptyField(s))
    return next
  }
  return { ...previous, name: root.key, schema, entities: entities.map(entity => ({ ...entity, fields: complete(schema, entity.fields) })) }
}
