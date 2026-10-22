import {parseDocument,stringify} from 'yaml'
import {SkillDefinition,ToolDefinition,uid} from './types'

export function skillName(value:string){
 if(!value||[...value].length>64||value!==value.toLowerCase()||!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value))throw new Error('技能名需为 1–64 位小写字母、数字或汉字，以单个短横线分隔，不能使用系统保留名称')
 return value
}
export function parseSkillMarkdown(content:string,directory?:string){
 const normalized=content.replace(/^\uFEFF/,'')
 const match=normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
 if(!match)throw new Error('SKILL.md 必须以 YAML 元数据开始（---、name、description、---）')
 const doc=parseDocument(match[1],{uniqueKeys:true}),meta=doc.toJS({maxAliasCount:20})
 if(doc.errors.length)throw new Error('SKILL.md YAML：'+doc.errors[0].message)
 if(!meta||typeof meta!=='object'||Array.isArray(meta)||typeof meta.name!=='string')throw new Error('SKILL.md 缺少 name')
 skillName(meta.name)
 if(directory&&meta.name!==directory)throw new Error('SKILL.md 的 name 必须与技能目录名一致')
 if(typeof meta.description!=='string'||!meta.description.trim()||meta.description.length>1024)throw new Error('description 必须为 1–1024 字符的用途及使用时机说明')
 if(meta.compatibility!==undefined&&(typeof meta.compatibility!=='string'||!meta.compatibility||meta.compatibility.length>500))throw new Error('compatibility 应为 1–500 字符')
 if(meta['disable-model-invocation']!==undefined&&typeof meta['disable-model-invocation']!=='boolean')throw new Error('disable-model-invocation 应为 Boolean')
 if(meta.license!==undefined&&typeof meta.license!=='string')throw new Error('license 应为字符串')
 if(meta['allowed-tools']!==undefined&&typeof meta['allowed-tools']!=='string')throw new Error('allowed-tools 应为字符串')
 if(meta.metadata!==undefined&&(!meta.metadata||typeof meta.metadata!=='object'||Array.isArray(meta.metadata)||Object.values(meta.metadata).some(v=>typeof v!=='string')))throw new Error('metadata 应为字符串键值映射')
 return {name:meta.name as string,description:meta.description as string,metadata:meta,body:normalized.slice(match[0].length)}
}
export function skillTemplate(name:string,description='说明此技能解决的任务，以及何时应该使用。'){
 skillName(name)
 return `---\n${stringify({name,description})}---\n\n# ${name}\n\n## 何时使用\n\n- 用户明确提出此类任务时。\n- 需要领域指导而非普通问答时。\n\n## 能力边界\n\n- 先读取已有资料，不把猜测当作事实。\n- 修改世界通过修改建议交由用户确认。\n- 仅使用本技能 scripts 中的工具和 Agent 已获准的工具。\n\n## 操作内容\n\n1. 明确输入、目标及缺失信息。\n2. 按需读取 references 中的参考文档。\n3. 调用合适的工具并检查结果。\n4. 给出结果、依据与仍需用户决定的事项。\n\n## 参考与资源\n\n- scripts/：本技能专属 Tool（JS execute(params) 或 HTTP 配置）。\n- references/：按需读取的 Markdown。\n- assets/：用户通过文件资源管理器维护的模板及资源。\n\n## 验收\n\n- 输出与输入目标一致，工具错误得到明确处理。\n`
}
export function newSkill(existing:SkillDefinition[],requested='new-skill'):SkillDefinition{
 let name=skillName(requested),n=2;while(existing.some(s=>s.name===name))name=`${requested.slice(0,58)}-${n++}`
 return {id:uid(),name,directory:name,description:'说明此技能解决的任务，以及何时应该使用。',content:skillTemplate(name),enabled:true,references:{},tools:[],assets:[]}
}
export function normalizeLegacySkill(skill:SkillDefinition,index=0):SkillDefinition{
 if(skill.directory)return skill
 let name=skill.name.trim().toLowerCase().replace(/[^\p{L}\p{N}-]+/gu,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,58)||`skill-${index+1}`
 try{skillName(name)}catch{name=`skill-${index+1}`}
 const description=skill.description.trim().slice(0,1024)||'已有技能的操作指导。'
 let content=skill.content;try{parseSkillMarkdown(content,name)}catch{content=`---\n${stringify({name,description})}---\n\n${content}`}
 return {...skill,name,directory:name,description,content,references:skill.references||{},tools:skill.tools||[],assets:skill.assets||[]}
}
export interface SkillDisk {directory:string;files:Record<string,string>;revision:string;assets:string[]}
export function skillFromDisk(disk:SkillDisk):SkillDefinition{
 const config=disk.files['.myuniverse.json']?JSON.parse(disk.files['.myuniverse.json']):{},content=disk.files['SKILL.md']||'',meta=parseSkillMarkdown(content,disk.directory)
 const manifest=disk.files['scripts/tools.json']?JSON.parse(disk.files['scripts/tools.json']):[]
 if(!Array.isArray(manifest))throw new Error('scripts/tools.json 必须为 Tool 配置数组')
 const tools:ToolDefinition[]=manifest.map((t:ToolDefinition&{sourceFile?:string})=>{const {sourceFile,...tool}=t;if(typeof tool.id!=='string'||!tool.id||typeof tool.name!=='string'||!tool.name||!['js','http'].includes(tool.kind||'')||typeof tool.enabled!=='boolean')throw new Error('Skill Tool 配置无效');if(tool.kind==='js'&&(typeof sourceFile!=='string'||!Object.hasOwn(disk.files,sourceFile)))throw new Error('Skill Tool 脚本文件缺失');return {...tool,folderId:null,...(sourceFile?{code:disk.files[sourceFile]}:{})}})
 const sources=new Set(manifest.map((t:{sourceFile?:string})=>t.sourceFile))
 for(const [path,code] of Object.entries(disk.files).filter(([p])=>p.startsWith('scripts/')&&p.endsWith('.js')&&!sources.has(p))){
  let hash=2166136261;for(const c of disk.directory+'/'+path)hash=Math.imul(hash^c.charCodeAt(0),16777619)
  tools.push({id:`skill-script:${disk.directory}:${path}`,name:path.slice(8),callName:`skill_script_${(hash>>>0).toString(16)}`,description:`${meta.name} 的专属脚本 ${path}；JS 入口为 execute(params)。`,kind:'js',code,inputSchema:{type:'object',properties:{},additionalProperties:true},enabled:true,url:'',method:'POST',apiKey:'',bodyMode:'raw',folderId:null})
 }
 return {id:typeof config.id==='string'&&config.id?config.id:`skill:${disk.directory}`,directory:disk.directory,...meta,content,enabled:config.enabled!==false,folderId:typeof config.folderId==='string'?config.folderId:null,references:Object.fromEntries(Object.entries(disk.files).filter(([p])=>p.startsWith('references/')&&p.endsWith('.md')).map(([p,c])=>[p.slice(11),c])),tools,assets:disk.assets}
}
export function skillToFiles(skill:SkillDefinition):Record<string,string>{
 parseSkillMarkdown(skill.content,skill.name)
 const files:Record<string,string>={'SKILL.md':skill.content,'.myuniverse.json':JSON.stringify({version:1,id:skill.id,enabled:skill.enabled,folderId:skill.folderId||null},null,2)}
 const ids=new Set<string>();const tools=(skill.tools||[]).map((tool,i)=>{
  if(ids.has(tool.id))throw new Error('Skill Tool 身份重复');ids.add(tool.id)
  const {code,folderId,...config}=tool
  if(!['js','http'].includes(tool.kind||''))throw new Error('Skill scripts 仅支持 JS Tool 和 HTTP Tool')
  const sourceFile=`scripts/tool-${i+1}.js`;if(tool.kind==='js')files[sourceFile]=code||''
  return {...config,...(tool.kind==='js'?{sourceFile}:{})}
 })
 files['scripts/tools.json']=JSON.stringify(tools,null,2)
 for(const [path,content] of Object.entries(skill.references||{})){if(!validReferencePath(path))throw new Error('参考文件应为 references 内的 .md 相对路径');files['references/'+path]=content}
 return files
}
export function validReferencePath(path:string){return path.endsWith('.md')&&!path.includes('\\')&&!path.includes(':')&&path.split('/').every(p=>!!p&&p!=='.'&&p!=='..'&&!/[\x00-\x1f<>"|?*]/.test(p))}

export function implicitSkillAllowed(skill:SkillDefinition){return !skill.directory||parseSkillMarkdown(skill.content,skill.name).metadata['disable-model-invocation']!==true}
