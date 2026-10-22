import {Bot,Drama,Sparkles} from 'lucide-react'
import {AgentDefinition} from '../model/types'
import {LibraryAssetIcon} from './LibraryFileIcon'
export default function AgentIcon({agent,size=16}:{agent?:Pick<AgentDefinition,'preset'>;size?:number}){if(!agent?.preset)return <LibraryAssetIcon name="langgraph" size={size}/>;const Icon=agent.preset==='roleplay'?Drama:agent.preset==='advanced'?Sparkles:Bot;return <Icon size={size}/>}
