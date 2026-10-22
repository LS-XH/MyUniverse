import {invoke,isTauri} from '@tauri-apps/api/core'
import {SkillDefinition,Workspace} from '../model/types'
import {SkillDisk,skillFromDisk,skillToFiles,normalizeLegacySkill,skillTemplate} from '../model/skillPackages'

const KEY='myuniverse-skill-packages-v1'
let baseline=new Map<string,SkillDisk>(),initialized=false
const fingerprint=(skill:SkillDefinition)=>JSON.stringify({name:skill.name,files:skillToFiles(skill)})
async function readDisks():Promise<SkillDisk[]>{return isTauri()?invoke('skill_packages'):JSON.parse(localStorage.getItem(KEY)||'[]')}
async function writeDisk(previous:SkillDisk|undefined,skill?:SkillDefinition):Promise<SkillDisk|undefined>{
 const change={previousDirectory:previous?.directory||null,expectedRevision:previous?.revision||null,directory:skill?.name||null,files:skill?skillToFiles(skill):{}}
 if(isTauri())return (await invoke<SkillDisk|null>('change_skill_package',{change}))||undefined
 const disks=await readDisks(),current=previous&&disks.find(d=>d.directory===previous.directory)
 if(previous&&current?.revision!==previous.revision)throw new Error('技能文件已变化，请重新读取')
 if(skill&&disks.some(d=>d.directory===skill.name&&d!==current))throw new Error('技能目录已存在')
 const next=disks.filter(d=>d!==current),disk=skill?{directory:skill.name,files:change.files,revision:crypto.randomUUID(),assets:previous?.assets||[]}:undefined
 if(disk)next.push(disk);localStorage.setItem(KEY,JSON.stringify(next));return disk
}
function decode(disks:SkillDisk[]){
 const seen=new Set<string>(),nextBaseline=new Map<string,SkillDisk>()
 const result=disks.map(d=>{let skill:SkillDefinition;try{skill=skillFromDisk(d)}catch(e){
  let id=`skill:${d.directory}`;try{const saved=JSON.parse(d.files['.myuniverse.json']||'{}').id;if(typeof saved==='string'&&saved)id=saved}catch{}
  let tools:SkillDefinition['tools']=[],resourceError=''
  try{tools=skillFromDisk({...d,directory:'recovered-skill',files:{...d.files,'SKILL.md':skillTemplate('recovered-skill'),'.myuniverse.json':JSON.stringify({id})}}).tools}catch{resourceError='；工具清单也无效，请修复 scripts/tools.json 后重新读取'}
  skill={id,name:d.directory,directory:d.directory,description:'格式无效，修复 SKILL.md 后重新读取',content:d.files['SKILL.md']||'',enabled:false,references:Object.fromEntries(Object.entries(d.files).filter(([p])=>p.startsWith('references/')&&p.endsWith('.md')).map(([p,c])=>[p.slice(11),c])),tools,assets:d.assets,diskError:String(e)+resourceError}
 }
  if(seen.has(skill.id))throw new Error('技能包身份重复：'+skill.name);seen.add(skill.id);nextBaseline.set(skill.id,d);return skill})
 baseline=nextBaseline;return result
}
/** Startup discovery reads disk packages; legacy inline definitions are migrated before JSON stripping. */
export async function loadSkillPackages(legacy:SkillDefinition[]=[]):Promise<SkillDefinition[]>{
 let skills=decode(await readDisks());initialized=true
 for(const [index,item] of legacy.entries()){
  if(skills.some(s=>s.id===item.id))continue
  let next=normalizeLegacySkill(item,index),n=2,base=next.name
  while(skills.some(s=>s.name===next.name)){const name=`${base.slice(0,58)}-${n++}`;next={...next,name,directory:name,content:next.content.replace(/^(name:\s*).*$/m,`$1${name}`)}}
  const disk=await writeDisk(undefined,next);if(disk){baseline.set(next.id,disk);skills.push({...next,directory:disk.directory})}
 }
 return skills
}
/** Called by the existing serialized save queue; untouched files are never re-exported. */
export async function persistSkillPackages(skills:SkillDefinition[]=[]){
 if(!initialized){const current=await readDisks();decode(current);initialized=true}
 const ids=new Set<string>(),names=new Set<string>();for(const s of skills){if(ids.has(s.id)||names.has(s.name))throw new Error('技能名称或身份重复');ids.add(s.id);names.add(s.name);if(!s.diskError)skillToFiles(s)}
 for(const skill of skills){const previous=baseline.get(skill.id);if(skill.diskError)continue
  let unchanged=false;if(previous){try{unchanged=fingerprint(skillFromDisk(previous))===fingerprint(skill)}catch{/* A repaired package must replace the invalid file. */}}
  if(unchanged)continue
  const disk=await writeDisk(previous,skill);if(disk)baseline.set(skill.id,disk)
 }
 for(const [id,disk] of baseline)if(!ids.has(id)){await writeDisk(disk);baseline.delete(id)}
}
export function workspaceArchive(workspace:Workspace):Workspace{const {skills,...archive}=workspace;return archive}
export async function refreshSkillPackages(){return decode(await readDisks())}
export async function revealSkillAssets(skill:SkillDefinition){if(!isTauri())throw new Error('资源文件管理器仅桌面版可用');await invoke('reveal_file',{components:['skills',skill.name,'assets']})}
