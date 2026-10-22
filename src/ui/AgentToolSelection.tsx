import {FolderCog} from 'lucide-react'
import {AgentConfig,Workspace} from '../model/types'
import {defaultToolFolders} from '../model/agentCapabilityDefaults'
import {registeredTools} from '../model/builtinTools'
import {CapabilitySelection} from './ModelsPage'
import ToolIcon from './ToolIcon'
export default function AgentToolSelection({config,workspace,readOnly,onChange}:{config:AgentConfig;workspace:Workspace;readOnly:boolean;onChange:(patch:Partial<AgentConfig>)=>void}){
 const tools=registeredTools(workspace),folders=defaultToolFolders.map(id=>({id,name:workspace.pluginFolders?.find(f=>f.id===id)?.name||({'builtin-folder:objects':'Object Manager','builtin-folder:skills':'Skill Manager','builtin-folder:agent-manager':'Agent Manager','builtin-folder:runtime':'Runtime Tool','builtin-folder:interaction':'Interaction Manager'}[id]||id)}))
 const groups=folders.map(f=>({...f,enabled:true,icon:<FolderCog size={17}/>,description:`整组接入 · ${tools.filter(t=>t.folderId===f.id).length} 项工具`}))
 const individual=tools.filter(t=>!defaultToolFolders.includes(t.folderId||'')).map(t=>({...t,icon:<ToolIcon tool={t}/>}))
 const selected=[...(config.toolFolderIds||[]),...config.toolIds.filter(id=>individual.some(t=>t.id===id))]
 return <CapabilitySelection title="允许使用的 Tool" hint="系统工具按文件夹整组选取，包含目录中的工具；运行时写入仍需用户确认。Agent Manager 管理会话成员，Skill Manager 管理技能激活。" readOnly={readOnly} items={[...groups,...individual]} selected={selected} onChange={ids=>onChange({toolFolderIds:ids.filter(id=>defaultToolFolders.includes(id)),toolIds:ids.filter(id=>!defaultToolFolders.includes(id)),manageAgents:ids.includes('builtin-folder:agent-manager')})} empty="尚无可用工具。"/>
}
