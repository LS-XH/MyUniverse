import {Fragment} from 'react'
import {BookOpen} from 'lucide-react'
import {ChatDirective,activeDirectives} from '../model/chatDirectives'
import {World,SkillDefinition} from '../model/types'
import {referenceIndex} from '../model/referenceIndex'
import {ReferenceBadge,referenceColorStyle} from './ReferenceOption'
export default function ChatReferences({text,refs=[],world,skills=[],mirror=false}:{text:string;refs?:ChatDirective[];world:World;skills?:SkillDefinition[];mirror?:boolean}){
 const active=activeDirectives(text,refs).sort((a,b)=>b.token.length-a.token.length),parts=[];let offset=0
 while(offset<text.length){const ref=active.find(r=>text.startsWith(r.token,offset));if(!ref){const positions=active.map(r=>text.indexOf(r.token,offset)).filter(n=>n>=0),end=positions.length?Math.min(...positions):text.length;parts.push(text.slice(offset,end));offset=end;continue}
 const choice=ref.kind==='instance'?referenceIndex(world).byId.get(ref.entityId):undefined,name=ref.kind==='skill'?skills.find(s=>s.id===ref.id)?.name:choice?.entity.name
 const badge=<span className="chat-reference-tag ui-reference-option ui-surface ui-badge" style={referenceColorStyle(choice?.color)} data-reference-color={choice?.color} title={ref.kind==='skill'?'本次强制加载技能':'本次引用世界实例'}>{ref.kind==='skill'?<BookOpen size={12}/>:<ReferenceBadge name={choice?.doc.name||'实例'}/>}<span>{name||ref.token.slice(2,-1)}</span></span>
 parts.push(<Fragment key={offset}>{mirror?<span className="chat-reference-slot"><span className="chat-reference-source">{ref.token}</span><span className="chat-reference-cover">{badge}</span></span>:badge}</Fragment>);offset+=ref.token.length
 }return <>{parts}</>
}
