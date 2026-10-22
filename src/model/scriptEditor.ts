export type ScriptLanguage='js'|'py'
export type CodeToken={text:string;start:number;end:number;kind:string}
const keywords={js:'async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield',py:'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'}
const builtins={js:'Array Boolean Date Error JSON Map Math Number Object Promise RegExp Set String console undefined NaN Infinity true false null',py:'True False None abs all any bool dict enumerate float int isinstance len list max min print range repr reversed round set sorted str sum tuple zip'}
export function tokenizeScript(source:string,language:ScriptLanguage):CodeToken[]{
 const words=new Set(keywords[language].split(' ')),built=new Set(builtins[language].split(' '))
 const pattern=language==='py'?/#[^\n]*|"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\\n])*(?:"|$)|'(?:\\[\s\S]|[^'\\\n])*(?:'|$)|\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\b|[$_\p{L}][$_\p{L}\p{N}]*|[\s\S]/gu:/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|`(?:\\[\s\S]|[^`\\])*(?:`|$)|"(?:\\[\s\S]|[^"\\\n])*(?:"|$)|'(?:\\[\s\S]|[^'\\\n])*(?:'|$)|\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\b|[$_\p{L}][$_\p{L}\p{N}]*|[\s\S]/gu
 const tokens:CodeToken[]=[]
 for(const match of source.matchAll(pattern)){
  const text=match[0],start=match.index!,end=start+text.length
  let kind='plain'
  if(text.startsWith(language==='py'?'#':'//')||language==='js'&&text.startsWith('/*'))kind='comment'
  else if(/^["'`]/.test(text))kind='string'
  else if(words.has(text))kind='keyword'
  else if(built.has(text))kind='builtin'
  else if(/^\d/.test(text))kind='number'
  else if(/^[$_\p{L}]/u.test(text))kind=/^\s*\(/.test(source.slice(end))?'function':'variable'
  const previous=tokens.at(-1)
  if(kind==='plain'&&previous?.kind==='plain'){previous.text+=text;previous.end=end}else tokens.push({text,start,end,kind})
 }
 return tokens
}
export function activeIdentifier(tokens:CodeToken[],start:number,end=start){
 const token=tokens.find(t=>t.start<=start&&t.end>=end&&['variable','function'].includes(t.kind))
 return token&&(start===end||token.start===start&&token.end===end)?token.text:''
}
export function scriptCompletions(source:string,caret:number,language:ScriptLanguage){
 const tokens=tokenizeScript(source,language),context=tokens.find(t=>t.start<caret&&t.end>=caret)
 if(context&&['string','comment'].includes(context.kind))return []
 const term=source.slice(0,caret).match(/[$_\p{L}][$_\p{L}\p{N}]*$/u)?.[0]
 if(!term)return []
 const names=tokens.filter(t=>['variable','function'].includes(t.kind)&&!(t.start===caret-term.length&&t.end===caret)).map(t=>t.text)
 return [...new Set([...names,...keywords[language].split(' '),...builtins[language].split(' ')])].filter(name=>name!==term&&name.startsWith(term)).sort((a,b)=>a.localeCompare(b)).slice(0,40)
}
