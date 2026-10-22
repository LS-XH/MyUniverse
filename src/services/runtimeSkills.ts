import {publishProposal,ToolCallContext} from './instanceProposals'
import {Workspace,SkillDefinition} from '../model/types'
import {skillToFiles,skillFromDisk,skillName,validReferencePath} from '../model/skillPackages'
import {toolSpec} from './tools'
interface Host {read:()=>Workspace;update:(workspace:Workspace)=>void;save:(workspace:Workspace)=>Promise<unknown>}
let host:Host|undefined
export function bindSkillRuntime(value:Host){host=value;return()=>{if(host===value)host=undefined}}
export function skillVersion(skill:SkillDefinition){const text=JSON.stringify({content:skill.content,references:skill.references||{},tools:skill.tools||[],enabled:skill.enabled,name:skill.name});let hash=14695981039346656037n;for(const c of text)hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)!))*1099511628211n);return text.length+':'+hash.toString(16)}
function checked(skill:SkillDefinition){skillToFiles(skill);for(const t of skill.tools||[]){if(t.id.startsWith('builtin:')||t.kind==='builtin')throw new Error('技能不能替换系统 Tool');toolSpec(t)}return skill}
function runtimePath(path:unknown){
 if(typeof path!=='string')throw new Error('需要相对文件路径')
 const parts=path.split('/');if(parts.shift()!=='skills'||!parts[0])throw new Error('路径必须位于 skills/<技能名> 内')
 const directory=skillName(parts.shift()!),file=parts.join('/')
 if(file!=='SKILL.md'&&file!=='scripts/tools.json'&&!/^scripts\/tool-[1-9]\d*\.js$/.test(file)&&!(file.startsWith('references/')&&validReferencePath(file.slice(11))))throw new Error('仅支持 SKILL.md、references/*.md、scripts/tool-N.js 和 scripts/tools.json')
 return {directory,file}
}
function listed(workspace:Workspace,path='skills'){
 if(typeof path!=='string'||!/^skills(?:\/[\p{L}\p{N}-]+)?$/u.test(path))throw new Error('目录必须为 skills 或 skills/<技能名>')
 return (workspace.skills||[]).filter(s=>path==='skills'||path==='skills/'+s.name).flatMap(s=>Object.keys(skillToFiles(s)).filter(f=>f!=='.myuniverse.json').map(f=>({path:`skills/${s.name}/${f}`,version:skillVersion(s)})))
}
export function applyRuntimeFileWrite(workspace:Workspace,p:any,edit=false){
 const {directory,file}=runtimePath(p.path),previous=workspace.skills?.find(s=>s.name===directory),files=previous?skillToFiles(previous):{},exists=Object.hasOwn(files,file)
 if(exists&&p.expectedVersion!==skillVersion(previous!))throw new Error('文件已变化，请重新读取后修改')
 if(!exists&&p.expectedVersion!==undefined)throw new Error('文件已不存在，请重新读取')
 let content=p.content
 if(edit){if(!exists||typeof p.oldText!=='string'||!p.oldText||typeof p.newText!=='string')throw new Error('精确编辑需要已有文件及非空原文');const matches=files[file].split(p.oldText);if(matches.length!==2)throw new Error('原文必须恰好匹配一次');content=matches.join(p.newText)}
 if(typeof content!=='string')throw new Error('文件内容必须是字符串')
 if(!previous&&file!=='SKILL.md')throw new Error('新技能请先创建 SKILL.md')
 files[file]=content
 if(!previous)files['.myuniverse.json']=JSON.stringify({id:crypto.randomUUID(),enabled:true})
 const skill=checked({...previous,...skillFromDisk({directory,files,revision:'',assets:previous?.assets||[]}),diskError:undefined})
 if(!Object.hasOwn(skillToFiles(skill),file))throw new Error('脚本路径需使用现有目录列出的路径，新增脚本使用下一个 scripts/tool-N.js 序号')
 return {workspace:{...workspace,skills:previous?workspace.skills!.map(s=>s.id===previous.id?skill:s):[...(workspace.skills||[]),skill]},skill}
}
export async function runSkillRuntime(id:string,p:any,signal?:AbortSignal,context?:ToolCallContext,worldId?:string){
 if(signal?.aborted)throw new DOMException('已取消','AbortError')
 if(!host)throw new Error('技能包管理需要应用工作区上下文')
 const source=host.read()
 if(id==='builtin:runtime_list_files')return listed(source,p.path)
 if(id==='builtin:runtime_read_file'){const {directory,file}=runtimePath(p.path),s=source.skills?.find(s=>s.name===directory),files=s?skillToFiles(s):{};if(!s||!Object.hasOwn(files,file))throw new Error('文件不存在');return {path:p.path,content:files[file],version:skillVersion(s)}}
 if(id==='builtin:runtime_write_file'||id==='builtin:runtime_edit_file'){
  if(!context?.conversationId||!worldId)throw new Error('文件修改需要聊天中的用户确认，不能直接写入')
  const next=applyRuntimeFileWrite(source,p,id==='builtin:runtime_edit_file'),{directory,file}=runtimePath(p.path),baseline=source.skills?.find(s=>s.name===directory)
  return publishProposal({id:crypto.randomUUID(),worldId,classId:'runtime-files:'+directory,entityId:next.skill.id,className:directory,instanceName:file,before:baseline?skillToFiles(baseline)[file]||'':'',after:skillToFiles(next.skill)[file],reason:'请确认文件差异，保存后才写入技能目录。',schemaSignature:'runtime-file:1',status:'pending',fileChange:{path:p.path,skillId:next.skill.id,baseline:baseline?structuredClone(baseline):undefined}},context)
 }
 throw new Error('未知或已移除的 Runtime Tool')
}
