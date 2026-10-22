import type {SkillDefinition,Workspace} from './types'
/** Ownership follows stable identity, independently of the current tree folder. */
export const isBuiltinSkill=(skill:Pick<SkillDefinition,'id'>)=>skill.id.startsWith('builtin-skill:')
export function removeSkill(workspace:Workspace,id:string):Workspace {const skill=workspace.skills?.find(s=>s.id===id);if(!skill)return workspace;if(isBuiltinSkill(skill))throw new Error('系统自带技能不可删除');return {...workspace,skills:workspace.skills?.filter(s=>s.id!==id)}}
