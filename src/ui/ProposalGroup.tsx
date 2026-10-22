import {useState} from 'react'
import {ChevronRight} from 'lucide-react'
import type {InstanceChangeProposal,ProposalAction,ProposalHandler} from '../model/types'
import {lineDiff} from '../model/textDiff'
import InstanceProposal from './InstanceProposal'

export default function ProposalGroup({proposals,onDecision}:{proposals:InstanceChangeProposal[];onDecision?:ProposalHandler}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false)
 const pending=proposals.filter(p=>p.status==='pending'),saved=proposals.filter(p=>p.status==='saved'&&(p.savedAfter||p.fileChange?.saved))
 const lines=proposals.flatMap(p=>lineDiff(p.before,p.after)),adds=lines.filter(l=>l.kind==='add').length,removes=lines.filter(l=>l.kind==='remove').length
 const decide=async(action:ProposalAction)=>{const ids=(action==='revert'?saved:pending).map(p=>p.id);if(busy)return;setBusy(true);try{if(ids.length)await onDecision?.(ids[0],action,ids);setError('')}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <details className="instance-proposal ui-panel--proposal ui-surface ui-panel ui-panel--themed ui-panel--text ui-surface--bordered proposal-group">
  <summary><ChevronRight size={16} className="proposal-chevron"/><strong>{proposals[0].className} · {proposals.length} 项提议</strong><span className="proposal-counts"><span className="proposal-added">+{adds}</span><span className="proposal-removed">−{removes}</span></span><span className="proposal-status">{pending.length?`${pending.length} 项待确认`:saved.length?'已采纳':'已拒绝'}</span></summary>
  <div className="proposal-body">{proposals.map(p=><InstanceProposal key={p.id} proposal={p} onDecision={onDecision}/>)}
   <div className="proposal-actions">{pending.length>0&&<><button className="ui-surface ui-button ui-button--ghost ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide(false)}>全部拒绝</button><button className="ui-surface ui-button ui-button--primary ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide(true)}>全部保存</button></>}{saved.length>0&&<button className="ui-surface ui-button ui-button--ghost ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide('revert')}>回退已保存</button>}</div>
   {error&&<p className="danger" role="alert">{error}</p>}
  </div>
 </details>
}
