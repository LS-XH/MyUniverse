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

export interface Heading { level: number; key: string; start: number; end: number; children: Heading[];originName?:string }
export function headingTree(markdown: string): { root: Heading; lines: string[] } {
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
export const trimBlankLines = (text: string) => text.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '')
