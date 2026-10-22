import {FilePen,UserCheck,Wrench} from 'lucide-react'
import {toolRole,ToolRole} from '../model/toolRoles'
import type {ToolDefinition} from '../model/types'
// Lucide file-search-corner, ISC license; vendored path for the installed Lucide version.
// https://github.com/lucide-icons/lucide/blob/main/icons/file-search-corner.svg
function FileSearchCorner({size=16,...props}:{size?:number}){return <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.1 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.589 3.588A2.4 2.4 0 0 1 20 8v3.25"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m21 22-2.88-2.88"/><circle cx="16" cy="17" r="3"/></svg>}
export default function ToolIcon({tool,role,size=16}:{tool?:Pick<ToolDefinition,'id'|'role'|'annotations'>;role?:ToolRole;size?:number}){const kind=role||(tool?toolRole(tool):'action'),Icon=kind==='write'?FilePen:kind==='read'?FileSearchCorner:kind==='ask'?UserCheck:Wrench;return <Icon size={size} data-tool-role={kind}/>}
