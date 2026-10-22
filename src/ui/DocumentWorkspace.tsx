import {usePageState} from './PageSession'
import MarkdownSourceEditor from './MarkdownSourceEditor'
import {useEffect,useLayoutEffect,useRef,useState,type SyntheticEvent} from 'react'
import {createPortal} from 'react-dom'
import {PanelRight} from 'lucide-react'
import type {ClassDocument,World} from '../model/types'
import type {BackgroundTasks} from '../services/backgroundTasks'
import {background} from '../services/background'
import {useDocumentFileActions} from './DocumentFileActions'
import {DocumentEditor} from './App'
import useDiskMarkdown from './useDiskMarkdown'

/** JSON owns edits; the live disk Markdown is the comparison baseline. */
export default function DocumentWorkspace({world,doc,onChange,onDelete,focusEntity,focusToken}:{world:World;doc:ClassDocument;onChange:(doc:ClassDocument)=>void;onDelete:()=>void;focusEntity?:string;focusToken?:number}){
 const {tools,overlays}=useDocumentFileActions({world,doc,onChange})
 const [preview,setPreview]=usePageState('document:preview',false)
 const [prepared,setPrepared]=useState<BackgroundTasks['preview']['output']|null>(null),[previewBusy,setPreviewBusy]=useState(false)
 const disk=useDiskMarkdown(world.id,doc.fileName,preview)
 const [selection,setSelection]=useState<{id:string;part:'key'|'value'}|null>(null)
 const [error,setError]=useState('')
 const root=useRef<HTMLDivElement>(null)
 const [topbar,setTopbar]=useState<HTMLElement|null>(null)
 useLayoutEffect(()=>setTopbar(root.current?.closest('.main-area')?.querySelector<HTMLElement>('.topbar')||null),[])
 useEffect(()=>{
  if(!preview||!disk)return
  const controller=new AbortController();setPreviewBusy(true)
  const timer=setTimeout(()=>{void background('preview',{doc,baseline:disk.text??''},controller.signal).then(value=>{if(!controller.signal.aborted){setPrepared(value);setPreviewBusy(false)}}).catch(failure=>{if(!controller.signal.aborted){setError(String(failure));setPreviewBusy(false)}})},80)
  return()=>{clearTimeout(timer);controller.abort()}
 },[preview,doc,disk])
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
 const previewHeader=<header className={`markdown-top-header ${preview?'is-open':''}`}>
  <div className="markdown-top-title" aria-hidden={!preview}><strong>{doc.fileName}</strong><span>{disk?.error?'读取 MD 失败':!disk||previewBusy?'后台更新中…':disk.text===null?'MD 文件不存在 · 绿色为待导出内容':'磁盘 MD 原文 · 红色删除 / 绿色新增'}</span></div>
  <button className={`icon-button ui-button--icon markdown-toggle topbar-markdown-toggle ui-button--markdown-toggle ${preview?'is-open':''} ui-surface ui-button`} aria-label={preview?'收起 Markdown 预览':'展开 Markdown 预览'} title={preview?'收起 Markdown 预览':'展开 Markdown 预览'} aria-expanded={preview} aria-pressed={preview} onClick={()=>setPreview(!preview)}><PanelRight size={20}/></button>
 </header>
 return <div ref={root} className={`document-workspace ${preview?'with-markdown':''}`} onFocusCapture={focusField} onClickCapture={focusField}>
  {topbar?createPortal(previewHeader,topbar):previewHeader}
  <div className="document-operation"><DocumentEditor world={world} doc={doc} onChange={onChange} onDelete={onDelete} focusEntity={focusEntity} focusToken={focusToken} tools={tools}/></div>
  <aside className={`markdown-preview ui-drawer--markdown ui-surface ui-drawer ui-drawer--themed ui-drawer--text ${preview?'is-open':''}`} inert={!preview} aria-hidden={!preview}>
   <div className="markdown-code-editor">{preview&&prepared&&<MarkdownSourceEditor value={prepared.source} preparedRows={prepared.rows} preparedLevels={prepared.levels} readOnly selectedLine={selectedLine} selectedEnd={selectedEnd}/>}</div>
  </aside>
  {(error||disk?.error)&&<div className="function-error" role="alert">{error||disk?.error}</div>}
  {overlays}
 </div>
}
