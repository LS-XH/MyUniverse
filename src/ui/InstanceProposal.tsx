import type {ProposalHandler,ProposalAction} from '../model/types'
import {useMemo,useState} from 'react'
import {InstanceChangeProposal} from '../model/types'
import {lineDiff} from '../model/textDiff'
import {ChevronRight,FilePen} from 'lucide-react'

export default function InstanceProposal({proposal,onDecision}:{proposal:InstanceChangeProposal;onDecision?:ProposalHandler}){
 const lines=useMemo(()=>lineDiff(proposal.before,proposal.after),[proposal.before,proposal.after]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const decide=async(save:ProposalAction)=>{if(busy)return;setBusy(true);try{await onDecision?.(proposal.id,save);setError('')}catch(error){setError(String(error))}finally{setBusy(false)}}
 return <details className="instance-proposal ui-panel--proposal ui-surface ui-panel ui-panel--themed ui-panel--text ui-surface--bordered">
  <summary><ChevronRight size={16} className="proposal-chevron"/><FilePen size={16}/><strong>{proposal.kind==='add'?'新增 · ':''}{proposal.className} / {proposal.instanceName}</strong><span className="proposal-counts" aria-label={`新增 ${lines.filter(l=>l.kind==='add').length} 行，删除 ${lines.filter(l=>l.kind==='remove').length} 行`}><span className="proposal-added">+{lines.filter(l=>l.kind==='add').length}</span><span className="proposal-removed">−{lines.filter(l=>l.kind==='remove').length}</span></span><span className="proposal-status">{proposal.status==='pending'?'等待确认':proposal.status==='saved'?'已采纳':'已拒绝'}</span></summary>
  <div className="proposal-body">
  <div className="proposal-diff" role="region" aria-label={proposal.fileChange?'文件修改差异':'实例修改差异'}>{lines.map((line,index)=><div className={`diff-line diff-${line.kind}`} key={index}><span className="diff-number">{line.kind==='remove'?line.before:line.after??''}</span><span className="diff-sign">{line.kind==='add'?'+':line.kind==='remove'?'-':''}</span><code>{line.text||' '}</code></div>)}</div>
  {proposal.status==='pending'&&<div className="proposal-actions"><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide(false)}>{proposal.fileChange?'放弃':'拒绝'}</button><button className="primary ui-button--primary ui-surface ui-button ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide(true)}>保存修改</button></div>}
  {proposal.status==='saved'&&(proposal.savedAfter||proposal.fileChange?.saved)&&<div className="proposal-actions"><button className="ui-surface ui-button ui-button--ghost ui-button--standard" disabled={!onDecision||busy} onClick={()=>decide('revert')}>回退保存</button></div>}
  {error&&<p className="danger" role="alert">{error}</p>}
  </div>
 </details>
}
