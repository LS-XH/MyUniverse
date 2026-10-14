import {useFileActions} from './FileActionsContext'
import {useFunctions} from './FunctionContext'
import {usePageState} from './PageSession'
import MarkdownSourceEditor from './MarkdownSourceEditor'
import {useEffect,useLayoutEffect,useRef,useState,type SyntheticEvent} from 'react'
import {createPortal} from 'react-dom'
import {PanelRight,FileUp,Layers3,SquareFunction} from 'lucide-react'
import type {ClassDocument,World} from '../model/types'
import type {BackgroundTasks} from '../services/backgroundTasks'
import {background} from '../services/background'
import {publishImportedDocument,applyImportProgress} from '../services/storage'
import {DocumentEditor} from './App'

/** The object editor owns JSON state. Markdown is an off-thread, read-only export preview. */
export default function DocumentWorkspace({world,doc,onChange,onDelete,focusEntity,focusToken,onNewView}:{world:World;doc:ClassDocument;onChange:(doc:ClassDocument)=>void;onDelete:()=>void;focusEntity?:string;focusToken?:number;onNewView?:()=>void}){
 const actions=useFileActions(),functions=useFunctions(),current=useRef(doc);current.current=doc
 const [preview,setPreview]=usePageState('document:preview',false)
 const [prepared,setPrepared]=useState<BackgroundTasks['preview']['output']|null>(null),[previewBusy,setPreviewBusy]=useState(false)
 const [selection,setSelection]=useState<{id:string;part:'key'|'value'}|null>(null)
 const [error,setError]=useState(''),[pending,setPending]=useState<{name:string;parsed:ClassDocument}|null>(null),[importing,setImporting]=useState(false)
 const fileInput=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null),operation=useRef<AbortController|null>(null)
 const [topbar,setTopbar]=useState<HTMLElement|null>(null)
 useLayoutEffect(()=>setTopbar(root.current?.closest('.main-area')?.querySelector<HTMLElement>('.topbar')||null),[])
 useEffect(()=>{
  if(!preview)return
  const controller=new AbortController();setPreviewBusy(true)
  const timer=setTimeout(()=>{void background('preview',{doc,baselineDocument:actions?.savedDocument},controller.signal).then(value=>{if(!controller.signal.aborted){setPrepared(value);setPreviewBusy(false)}}).catch(failure=>{if(!controller.signal.aborted){setError(String(failure));setPreviewBusy(false)}})},80)
  return()=>{clearTimeout(timer);controller.abort()}
 },[preview,doc,actions?.savedDocument])
 useEffect(()=>()=>operation.current?.abort(),[])
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPreview(false)};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[])
 const focusField=(event:SyntheticEvent)=>{
  if(!preview)return
  const target=event.target as HTMLElement,field=target.closest<HTMLElement>('[data-field-id]'),entity=target.closest<HTMLElement>('[data-entity-id]')
  const next=field?{id:field.dataset.fieldId!,part:target.closest('.field-key-wrap')?'key' as const:'value' as const}:entity?{id:entity.dataset.entityId!,part:'key' as const}:null
  if(next)setSelection(previous=>previous?.id===next.id&&previous.part===next.part?previous:next)
 }
 const location=selection?prepared?.locations[selection.id]:undefined,selectedLine=location?.key??-1
 const following=selectedLine<0?-1:prepared?.levels.findIndex((level,index)=>index>selectedLine&&level>0&&level<=prepared.levels[selectedLine])??-1
 const selectedEnd=selectedLine<0?-1:following>=0?following-1:(prepared?.levels.length||0)-1
 const importPending=async()=>{
  if(!pending||importing)return
  const before=current.current,controller=new AbortController();operation.current=controller;setImporting(true)
  try{await publishImportedDocument(before,pending.parsed,world.id,{signal:controller.signal,onProgress:progress=>{
   const next=applyImportProgress(current.current,progress)
   current.current=next;onChange(next)
  }});setPending(null);setError('')}catch(failure){if(!controller.signal.aborted)setError(String(failure))}finally{setImporting(false);operation.current=null}
 }
 const tools=<>
  {onNewView&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={onNewView}><Layers3 size={16}/> 新建界面</button>}
  {actions?.recompute&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={actions.busy||importing} onClick={actions.recompute}><SquareFunction size={16}/> 重新计算函数</button>}
  <input ref={fileInput} className="hidden-file-input ui-surface ui-field" type="file" accept=".md,.markdown,text/markdown" aria-label="选择 Markdown 文件" onChange={async event=>{
   const file=event.target.files?.[0];event.target.value='';if(!file)return
   const controller=new AbortController();operation.current?.abort();operation.current=controller;setImporting(true)
   try{const text=await file.text(),parsed=await background('parse',{text,doc:current.current,world,options:{enforceGeneratedReadOnly:false,functionNames:Object.fromEntries(functions.map(f=>[f.id,f.name]))}},controller.signal);setPending({name:file.name,parsed});setError('')}catch(failure){if(!controller.signal.aborted)setError(String(failure))}finally{setImporting(false);operation.current=null}
  }}/>
  <button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" disabled={importing||actions?.busy} onClick={()=>fileInput.current?.click()}><FileUp size={16}/> 导入 MD</button>
 </>
 const previewHeader=<header className={`markdown-top-header ${preview?'is-open':''}`}>
  <div className="markdown-top-title" aria-hidden={!preview}><strong>{doc.fileName}</strong><span>{previewBusy?'后台更新中…':'只读 Markdown 导出预览'}</span></div>
  <button className={`icon-button ui-button--icon markdown-toggle topbar-markdown-toggle ui-button--markdown-toggle ${preview?'is-open':''} ui-surface ui-button`} aria-label={preview?'收起 Markdown 预览':'展开 Markdown 预览'} title={preview?'收起 Markdown 预览':'展开 Markdown 预览'} aria-expanded={preview} aria-pressed={preview} onClick={()=>setPreview(!preview)}><PanelRight size={20}/></button>
 </header>
 return <div ref={root} className={`document-workspace ${preview?'with-markdown':''}`} onFocusCapture={focusField} onClickCapture={focusField}>
  {topbar?createPortal(previewHeader,topbar):previewHeader}
  <div className="document-operation"><DocumentEditor world={world} doc={doc} onChange={onChange} onDelete={onDelete} focusEntity={focusEntity} focusToken={focusToken} tools={tools}/></div>
  <aside className={`markdown-preview ui-drawer--markdown ui-surface ui-drawer ui-drawer--themed ui-drawer--text ${preview?'is-open':''}`} inert={!preview} aria-hidden={!preview}>
   <div className="markdown-code-editor">{preview&&prepared&&<MarkdownSourceEditor value={prepared.source} preparedRows={prepared.rows} preparedLevels={prepared.levels} readOnly selectedLine={selectedLine} selectedEnd={selectedEnd}/>}</div>
  </aside>
  {error&&<div className="function-error" role="alert">{error}</div>}
  {importing&&<button className="ghost ui-button--ghost ui-surface ui-button" onClick={()=>operation.current?.abort()}>停止导入（保留已完成实例）</button>}
  {pending&&<div className="modal-backdrop"><div className="modal ui-dialog--standard markdown-import-modal ui-surface ui-dialog" role="dialog" aria-modal="true"><h2>导入 {pending.name}</h2><p>按当前属性配置将 Markdown 填入 JSON，逐个更新实例。未包含的实例和分支保留；相同值保留函数来源，新增或修改的值作为用户内容。</p><div className="modal-actions"><button className="ghost ui-button--ghost ui-surface ui-button" disabled={importing} onClick={()=>setPending(null)}>取消</button><button className="primary ui-button--primary ui-surface ui-button" disabled={importing} onClick={()=>{void importPending()}}>导入并填入</button></div></div></div>}
 </div>
}
