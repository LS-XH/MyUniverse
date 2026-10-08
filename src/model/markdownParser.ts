import { ClassDocument, Entity, FieldSchema, FieldValue, World, uid } from './types'

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

interface Heading { level: number; key: string; start: number; end: number; children: Heading[] }
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
    const node: Heading = { level: match[1].length, key: (match[2] || '').trim(), start: index, end: lines.length, children: [] }
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
  if (new Set(names).size !== names.length) throw new Error('实例名称重复，无法准确引用；请使用不同的二级标题')
  return { root: roots[0], lines }
}
const trimBlankLines = (text: string) => text.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '')
function emptyField(schema: FieldSchema, previous?: FieldValue): FieldValue {
  return { id: previous?.id || uid(), schemaId: schema.id, key: schema.keyType === 'Const' ? schema.key : '', value: '', children: (schema.children || []).filter(s => !s.repeatable).map(s => emptyField(s, previous?.children.find(field => field.schemaId === s.id))) }
}
function referenceClass(value: string, world?: World): string | undefined {
  const match = value.match(/^\[[^\]]*\]\(([^#]+)#.+\)$/)
  return match ? world?.documents.find(doc => doc.fileName === match[1])?.id : undefined
}
function canonicalReference(value: string): string {
  return value.replace(/\[([^\]]*)\]\(([^#\n]+)#([^\n)]+)\)/g, (original, label: string, file: string, anchor: string) => {
    try { return `[${label}](${file}#${encodeURIComponent(decodeURIComponent(anchor))})` } catch { return original }
  })
}

/** Types come from the schema; Markdown supplies entity names and property values. */
export function parseDocumentMarkdown(markdown: string, previous: ClassDocument, world?: World): ClassDocument {
  const { root, lines } = headingTree(markdown)
  const schema: FieldSchema[] = structuredClone(previous.schema)
  const rawValue = (node: Heading, descendants = false) => escapeTextHeadings(trimBlankLines(lines.slice(node.start + 1, descendants ? node.end : node.children[0]?.start ?? node.end).join('\n')), false)
  if (rawValue(root)) throw new Error('一级类标题下的正文没有对应实例，请将正文移到一个二级实例标题下面')
  const infer = (node: Heading): FieldSchema => {
    const value = rawValue(node), classId = referenceClass(value, world)
    return { id: uid(), keyType: 'Const', key: node.key, valueType: node.children.length ? 'Object' : classId ? 'Class' : value.includes('\n') ? 'Content' : 'Text', ...(classId ? { classId } : {}), ...(node.children.length ? { children: [] } : {}) }
  }
  function addBody(body: string, schemas: FieldSchema[], fields: FieldValue[]) {
    if (!body) return
    let content = schemas.find(s => s.key === '内容' && s.keyType === 'Const')
    if (!content) { content = { id: uid(), keyType: 'Const', key: '内容', valueType: 'Content' }; schemas.push(content) }
    const existing = fields.find(f => f.schemaId === content.id)
    if (existing) existing.value = body + (existing.value ? `\n\n${existing.value}` : '')
    else fields.unshift({ ...emptyField(content), value: body })
  }
  function bind(nodes: Heading[], schemas: FieldSchema[], old: FieldValue[]): FieldValue[] {
    const used = new Set<string>(), counts = new Map<string, number>()
    const fields = nodes.map(node => {
      let target = schemas.find(s => s.keyType === 'Const' && s.key === node.key)
      if (!target) target = schemas.find(s => s.keyType === 'Class' && /^\[.*\]\(.*#.*\)$/.test(node.key) && (!s.classId || referenceClass(node.key, world) === s.classId))
      if (!target) target = schemas.find(s => s.keyType === 'Text' && (s.repeatable || !counts.has(s.id)))
      if (!target) { target = infer(node); schemas.push(target) }
      counts.set(target.id, (counts.get(target.id) || 0) + 1)
      if (counts.get(target.id)! > 1) target.repeatable = true
      const key = target.keyType === 'Class' ? canonicalReference(node.key) : node.key
      const prior = old.find(field => !used.has(field.id) && field.schemaId === target.id && field.key === key)
        || old.find(field => !used.has(field.id) && field.schemaId === target.id)
      if (prior) used.add(prior.id)
      let children: FieldValue[] = [], value = ''
      if (target.valueType === 'Object') {
        target.children ||= []
        children = bind(node.children, target.children, prior?.children || [])
        addBody(rawValue(node), target.children, children)
      } else if (target.valueType !== 'Null') value = rawValue(node, true)
      else if (rawValue(node, true)) throw new Error(`“${node.key}”配置为 Null，不能包含内容；请先修改属性类型`)
      if (target.valueType === 'Class') value = canonicalReference(value)
      if (value && target.valueType === 'Integer' && !/^-?\d+$/.test(value)) throw new Error(`“${node.key}”需要整数`)
      if (value && target.valueType === 'Decimal' && !/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`“${node.key}”需要小数`)
      if (value && target.valueType === 'Data' && !/^\d{8}$/.test(value)) throw new Error(`“${node.key}”需要 YYYYMMDD 格式日期`)
      return { id: prior?.id || uid(), schemaId: target.id, key, value, children }
    })
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
