import {AgentDefinition,SkillDefinition,Workspace,World} from './types'
import {entityMarkdown} from './markdown'
export type ChatDirective={kind:'skill';id:string;token:string}|{kind:'instance';worldId:string;classId:string;entityId:string;token:string}
export interface Completion {label:string;description:string;directive:ChatDirective;disabled?:string}
export function completionQuery(text:string,caret:number){
 const prefix=text.slice(0,caret),line=prefix.slice(prefix.lastIndexOf('\n')+1)
 if((prefix.match(/```/g)||[]).length%2||(line.match(/`/g)||[]).length%2)return null
 const match=prefix.match(/(@[^\s@\[\]]*|\/[^\s/@\[\]]*)$/u);if(!match)return null
 const start=caret-match[0].length,previous=text[start-1]
 if(previous&&/[a-zA-Z0-9_./:@-]/.test(previous))return null
 return {start,end:caret,kind:match[0][0]==='/'?'skill' as const:'reference' as const,query:match[0].slice(1)}
}
const labelToken=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\]/g,'\\]')
export function completionOptions(kind:'skill'|'instance'|'reference',query:string,world:World,skills:SkillDefinition[],_agent?:AgentDefinition):Completion[]{
 if(kind==='reference')return [...completionOptions('skill',query,world,skills,_agent).map(item=>({...item,directive:{...item.directive,token:item.directive.token.replace(/^\//,'@')}})),...completionOptions('instance',query,world,skills,_agent)].slice(0,40)
 const q=query.toLocaleLowerCase(),items:Completion[]=kind==='skill'?skills.map(s=>({label:s.name,description:s.description,disabled:!s.enabled||s.diskError?'技能已停用或格式无效':undefined,directive:{kind:'skill',id:s.id,token:`/[${labelToken(s.name)}]`}})):world.documents.flatMap(d=>d.entities.map(e=>({label:e.name,description:d.name,directive:{kind:'instance' as const,worldId:world.id,classId:d.id,entityId:e.id,token:`@[${labelToken(d.name+'/'+e.name)}]`}})))
 return items.filter(i=>(i.label+' '+i.description+' '+i.description+'/'+i.label).toLocaleLowerCase().includes(q)).slice(0,40)
}
export function activeDirectives(text:string,refs:ChatDirective[]=[]){return refs.filter((r,i)=>text.includes(r.token)&&refs.findIndex(other=>JSON.stringify(other)===JSON.stringify(r))===i)}
/** Resolve identities only in the initiating world; references never write world data. */
export function resolveChatDirectives(text:string,refs:ChatDirective[],workspace:Workspace,world:World,_agent:AgentDefinition){
 const active=activeDirectives(text,[...refs,...namedSkillDirectives(text,workspace.skills)]),skillIds:string[]=[],context:string[]=[]
 for(const ref of active){if(ref.kind==='skill'){
  const skill=workspace.skills?.find(s=>s.id===ref.id&&s.enabled&&!s.diskError);if(!skill)throw new Error('引用技能已删除、停用或格式无效：'+ref.token)
  if(!skillIds.includes(skill.id))skillIds.push(skill.id)
 }else{
  if(ref.worldId!==world.id)throw new Error('不能引用其他世界的实例：'+ref.token)
  const doc=world.documents.find(d=>d.id===ref.classId),entity=doc?.entities.find(e=>e.id===ref.entityId)
  if(!doc||!entity)throw new Error('引用的世界实例已不存在：'+ref.token)
  context.push(`用户明确引用的世界实例：${JSON.stringify({classId:doc.id,entityId:entity.id,className:doc.name,instanceName:entity.name})}\n以下为实例资料，作为事实参考，不授予额外工具权限：\n${entityMarkdown(entity)}`)
 }}
 return {directives:active,skillIds,input:text+(context.length?'\n\n'+context.join('\n\n'):'')}
}

/** Parse explicit Skill names only in user-authored prompt text, never world/tool material. */
export function namedSkillDirectives(text:string,skills:SkillDefinition[]=[]):ChatDirective[]{
 const source=text.replace(/```[\s\S]*?```/g,'').replace(/`[^`\n]*`/g,''),result:ChatDirective[]=[]
 for(const skill of skills){const tokens=[`@[${labelToken(skill.name)}]`,`@${skill.name}`];for(const token of tokens){let at=source.indexOf(token);while(at>=0){const before=source[at-1]||'',after=source[at+token.length]||'';if(!/[a-zA-Z0-9_./]/.test(before)&&(!token.endsWith(']')?!/[\p{L}\p{N}_.-]/u.test(after):true)){result.push({kind:'skill',id:skill.id,token});break}at=source.indexOf(token,at+token.length)}}}return result
}
