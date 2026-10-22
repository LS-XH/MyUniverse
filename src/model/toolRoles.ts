import type {ToolDefinition} from './types'
export type ToolRole='read'|'write'|'ask'|'action'
export const removedToolIds=['class_structure','class_structure_markdown','get_instance','find_instance_key','propose_member_change','runtime_list_skills','runtime_read_skill','runtime_write_skill','runtime_validate_skill'].map(k=>'builtin:'+k)
export function toolRole(tool:Pick<ToolDefinition,'id'|'role'|'annotations'>):ToolRole {
 if(tool.role)return tool.role
 if(['builtin:create_member','builtin:run_member'].includes(tool.id))return 'action'
 if(tool.annotations?.readOnlyHint===false)return 'write'
 if(tool.id==='builtin:ask_user'||tool.id==='builtin:set_human')return 'ask'
 if(/builtin:(propose_|runtime_(write|edit)_file)/.test(tool.id))return 'write'
 if(/builtin:(list_|read_|get_|runtime_(list|read)_file)/.test(tool.id)||tool.annotations?.readOnlyHint===true)return 'read'
 return 'action'
}
export const isSystemFolder=(id:string)=>id.startsWith('builtin-folder:')
