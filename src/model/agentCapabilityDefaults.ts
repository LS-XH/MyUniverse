import {AgentConfig,AgentDefinition,Workspace} from './types'
import {removedToolIds} from './toolRoles'
import {registeredTools} from './builtinTools'
export const defaultToolFolders=['builtin-folder:objects','builtin-folder:skills','builtin-folder:agent-manager','builtin-folder:runtime','builtin-folder:interaction']
export function defaultAgentCapabilities(config:AgentConfig):AgentConfig {return config.capabilityDefaultsVersion?{...config,toolIds:config.toolIds.filter(id=>!removedToolIds.includes(id))}:{...config,capabilityDefaultsVersion:1,toolIds:config.toolIds.filter(id=>!removedToolIds.includes(id)),toolFolderIds:[...defaultToolFolders],skillFolderIds:['builtin-folder:runtime-skills']}}
export function resolveAgentCapabilities(agent:AgentDefinition,workspace:Workspace):AgentDefinition {
 if(!agent.config)return agent
 const config=agent.config,tools=registeredTools(workspace),toolIds=[...new Set([...config.toolIds,...tools.filter(t=>config.toolFolderIds?.includes(t.folderId||'')).map(t=>t.id)])],skillIds=[...new Set([...config.skillIds,...(workspace.skills||[]).filter(s=>s.enabled&&!s.diskError&&config.skillFolderIds?.includes(s.folderId||'')).map(s=>s.id)])]
 return {...agent,config:{...config,toolIds,skillIds,manageAgents:config.toolFolderIds?.includes('builtin-folder:agent-manager')||config.manageAgents}}
}
