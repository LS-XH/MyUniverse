import {useEffect,useRef,useState} from 'react'
import {FileUp,FilePlus2,SquareFunction} from 'lucide-react'
import type {ClassDocument,World} from '../model/types'
import {useFileActions} from './FileActionsContext'
import {useFunctions} from './FunctionContext'
import {background} from '../services/background'
import {publishImportedDocument,applyImportProgress} from '../services/storage'

export function useDocumentFileActions({world,doc,onChange}:{world:World;doc:ClassDocument;onChange:(doc:ClassDocument)=>void}){
 const actions=useFileActions(),functions=useFunctions(),current=useRef(doc);current.current=doc
 const [error,setError]=useState(''),[pending,setPending]=useState<{name:string;before:ClassDocument;parsed:ClassDocument;replaceContents:boolean}|null>(null),[importing,setImporting]=useState(false)
 const importMode=useRef(true),fileInput=useRef<HTMLInputElement>(null),operation=useRef<AbortController|null>(null)
 useEffect(()=>()=>operation.current?.abort(),[])
 const importPending=async()=>{
  if(!pending||importing)return
  const before=pending.before,controller=new AbortController();operation.current=controller;setImporting(true)
  try{await publishImportedDocument(before,pending.parsed,world.id,{signal:controller.signal,onProgress:progress=>{
   const next=applyImportProgress(current.current,progress)
   current.current=next;onChange(next)
  }});setPending(null);setError('')}catch(failure){if(!controller.signal.aborted)setError(String(failure))}finally{setImporting(false);operation.current=null}
 }
 const tools=<>
  {actions?.recompute&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={actions.busy||importing} onClick={actions.recompute}><SquareFunction size={16}/> 重新计算函数</button>}
  <input ref={fileInput} className="hidden-file-input ui-surface ui-field" type="file" accept=".md,.markdown,text/markdown" aria-label="选择 Markdown 文件" onChange={async event=>{
   const file=event.target.files?.[0];event.target.value='';if(!file)return
   const controller=new AbortController();operation.current?.abort();operation.current=controller;setImporting(true)
   try{const before=current.current,replaceContents=importMode.current,text=await file.text(),parsed=await background('parse',{text,doc:before,world,options:{replaceContents,appendOnly:!replaceContents,enforceGeneratedReadOnly:false,functionNames:Object.fromEntries(functions.map(f=>[f.id,f.name]))}},controller.signal);setPending({name:file.name,before,parsed,replaceContents});setError('')}catch(failure){if(!controller.signal.aborted)setError(String(failure))}finally{setImporting(false);operation.current=null}
  }}/>
  <button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={importing||actions?.busy} onClick={()=>{importMode.current=true;fileInput.current?.click()}}><FileUp size={16}/> 导入 MD</button>
  <button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={importing||actions?.busy} onClick={()=>{importMode.current=false;fileInput.current?.click()}}><FilePlus2 size={16}/> 填入 MD</button>
 </>
 const overlays=<>
  {error&&<div className="function-error" role="alert">{error}</div>}
  {importing&&<button className="ghost ui-button--ghost ui-surface ui-button" onClick={()=>operation.current?.abort()}>停止导入（保留已完成实例）</button>}
  {pending&&<div className="modal-backdrop"><div className="modal ui-dialog--standard markdown-import-modal ui-surface ui-dialog" role="dialog" aria-modal="true"><h2>{pending.replaceContents?'导入':'填入'} {pending.name}</h2><p>{pending.replaceContents?'按当前属性配置，用 Markdown 替换当前类的实例与内容。文件中已删除的实例和可重复成员会从 JSON 中移除，缺失的固定成员恢复为空值。':'按当前属性配置追加 Markdown 内容，不覆盖既有值；保留旧实例和分支，新增实例及允许重复的成员。'}本次命中的值全部作为普通值，不计算函数；点击“重新计算函数”后再生成函数值。</p><div className="modal-actions"><button className="ghost ui-button--ghost ui-surface ui-button" disabled={importing} onClick={()=>setPending(null)}>取消</button><button className="primary ui-button--primary ui-surface ui-button" disabled={importing} onClick={()=>{void importPending()}}>{pending.replaceContents?'导入并替换':'确认填入'}</button></div></div></div>}
 </>
 return {tools,overlays}
}

export default function GraphDocumentActions(props:{world:World;doc:ClassDocument;onChange:(doc:ClassDocument)=>void}){
 const {tools,overlays}=useDocumentFileActions(props)
 return <><div className="editor-file-actions interface-file-actions">{tools}</div>{overlays}</>
}
