import {useFunctions} from './FunctionContext'
import {useFileActions} from './FileActionsContext'
import { usePageState } from './PageSession'
import MarkdownSourceEditor from './MarkdownSourceEditor'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { PanelRight, FileUp, X, Layers3 } from 'lucide-react'
import { ClassDocument, World } from '../model/types'
import { documentMarkdown, markdownLocations, markdownHeadingLevels, parseDocumentMarkdown } from '../model/markdown'
import { DocumentEditor } from './App'
import { replaceDocumentFromImport } from '../services/storage'

export default function DocumentWorkspace({ world, doc, onChange, onDelete, focusEntity, focusToken, onNewView }: {
  onNewView?:()=>void;focusEntity?:string;focusToken?:number;world: World; doc: ClassDocument; onChange: (doc: ClassDocument) => void; onDelete: () => void
}) {
  const fileActions=useFileActions(),functions=useFunctions()
  const parseOptions={functionNames:Object.fromEntries(functions.map(fn=>[fn.id,fn.name]))}
  const [preview, setPreview] = usePageState('document:preview',false)
  const root=useRef<HTMLDivElement>(null),[topbar,setTopbar]=useState<HTMLElement|null>(null)
  useLayoutEffect(()=>{setTopbar(root.current?.closest('.main-area')?.querySelector<HTMLElement>('.topbar')||null)},[])
  const [pending, setPending] = useState<{ text: string; name: string; parsed: ClassDocument } | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const source = useMemo(()=>documentMarkdown(doc),[doc])
  const [draft,setDraft]=useState(source),[editError,setEditError]=useState('')
  const [selection,setSelection]=useState<{id:string;part:'key'|'value'}|null>(null)
  const lastSource=useRef(source),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const validDraft=useRef(true)
  const current=useRef({doc,world,onChange});current.current={doc,world,onChange}
  const locations=useMemo(()=>preview?markdownLocations(doc):{},[doc,preview]),location=selection?locations[selection.id]:undefined
  const headingLevels=useMemo(()=>preview?markdownHeadingLevels(source):[],[preview,source])
  const selectedLine=location?.key??-1
  const following=selectedLine>=0?headingLevels.findIndex((level,index)=>index>selectedLine&&level>0&&level<=headingLevels[selectedLine]):-1
  const selectedEnd=selectedLine<0?-1:following>=0?following-1:headingLevels.length-1
  useEffect(()=>{
    if(source!==lastSource.current){lastSource.current=source;setDraft(source);validDraft.current=true;setEditError('');if(timer.current){clearTimeout(timer.current);timer.current=null}}
  },[source])
  useEffect(()=>()=>{if(timer.current)flush.current()},[])
  const focusField=(e:SyntheticEvent)=>{
    const target=e.target as HTMLElement,entity=target.closest<HTMLElement>('[data-entity-id]'),field=target.closest<HTMLElement>('[data-field-id]')
    if((entity||field)&&validDraft.current)setDraft(lastSource.current)
    if(entity)setSelection({id:entity.dataset.entityId!,part:'key'})
    else if(field)setSelection({id:field.dataset.fieldId!,part:target.closest('.field-key-wrap')?'key':'value'})
  }
  const applySource=(text:string)=>{
    if(timer.current){clearTimeout(timer.current);timer.current=null}
    try{
      const {doc:latest,world:latestWorld,onChange:change}=current.current
      const parsed=parseDocumentMarkdown(text,latest,latestWorld,parseOptions)
      lastSource.current=documentMarkdown(parsed);validDraft.current=true;setEditError('');change(parsed)
    }catch(failure){validDraft.current=false;setEditError(failure instanceof Error?failure.message:'Markdown 格式有误')}
  }
  const flush=useRef<()=>boolean>(()=>true)
  flush.current=()=>{if(timer.current)applySource(draft);return validDraft.current}
  const reset=useRef(()=>{});reset.current=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null}const next=documentMarkdown(current.current.doc);lastSource.current=next;setDraft(next);validDraft.current=true;setEditError('')}
  useEffect(()=>{const save=(event:Event)=>{if(!flush.current())event.preventDefault()},reload=()=>reset.current(),cancel=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null}};window.addEventListener('flush-document-draft',save);window.addEventListener('reset-document-draft',reload);window.addEventListener('cancel-document-draft',cancel);return()=>{window.removeEventListener('flush-document-draft',save);window.removeEventListener('reset-document-draft',reload);window.removeEventListener('cancel-document-draft',cancel)}},[])
  const editSource=(text:string)=>{
    setDraft(text);validDraft.current=false;setSelection(null)
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>applySource(text),350)
  }
  const tools = <>
    {onNewView&&<button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={onNewView}><Layers3 size={16}/> 新建界面</button>}
    <input ref={fileInput} className="hidden-file-input ui-surface ui-field" type="file" accept=".md,.markdown,text/markdown" aria-label="选择 Markdown 文件" onChange={async e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const text = await file.text(), parsed = parseDocumentMarkdown(text, doc, world,parseOptions)
        setPending({ text, name: file.name, parsed }); setError('')
      } catch (failure) { setError(failure instanceof Error ? failure.message : '无法读取 Markdown 文件') }
    }} />
    <button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={() => fileInput.current?.click()}><FileUp size={16} /> 导入 MD</button>
  </>
  return <div ref={root} className={`document-workspace ${preview ? 'with-markdown' : ''}`}>
    {topbar&&createPortal(<header className={`markdown-top-header ${preview?'is-open':''}`}><div className="markdown-top-title" aria-hidden={!preview}><strong>{doc.fileName}</strong><span>{editError?'格式有误 · 修改尚未保存':'可直接编辑 · 手动保存'}</span></div><button className={`icon-button ui-button--icon markdown-toggle topbar-markdown-toggle ui-button--markdown-toggle ${preview?'is-open':''} ui-surface ui-button`} title={preview?'收起 Markdown 预览':'展开 Markdown 预览'} aria-label={preview?'收起 Markdown 预览':'展开 Markdown 预览'} aria-expanded={preview} aria-pressed={preview} onClick={()=>setPreview(!preview)}><PanelRight size={20}/></button></header>,topbar)}
    <div className="document-operation" inert={!!fileActions?.busy} onFocusCapture={focusField} onClickCapture={focusField}>{error && <div className="document-error ui-alert--document ui-surface ui-alert" role="alert">{error}<button className="icon-button ui-button--icon ui-surface ui-button" title="关闭提示" onClick={() => setError('')}><X size={15} /></button></div>}<DocumentEditor world={world} doc={doc} onChange={onChange} onDelete={onDelete} tools={tools} focusEntity={focusEntity} focusToken={focusToken} /></div>
    <aside className={`markdown-preview ui-drawer--markdown ${preview ? 'is-open' : ''} ui-surface ui-drawer ui-drawer--themed ui-drawer--text`} aria-hidden={!preview} inert={!preview||!!fileActions?.busy} onKeyDown={e=>{if(e.key==='Escape')setPreview(false)}}>{editError&&<div className="markdown-edit-error ui-alert--markdown ui-surface ui-alert" role="alert">{editError}</div>}<div className="markdown-code-editor" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)&&timer.current)applySource(draft)}}>{preview&&<MarkdownSourceEditor value={draft} baseline={fileActions?(fileActions.savedDocument?documentMarkdown(fileActions.savedDocument):''):undefined} onChange={editSource} selectedLine={selectedLine} selectedEnd={selectedEnd}/>}</div></aside>
    {pending && <div className="modal-backdrop"><div className="modal ui-dialog--standard markdown-import-modal ui-surface ui-dialog ui-dialog--themed ui-dialog--text" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="eyebrow">IMPORT MARKDOWN</div><h2 id="import-title">导入 {pending.name}</h2><p>识别到类“{pending.parsed.name}”，包含 {pending.parsed.entities.length} 个实例。导入后会替换当前文件的实例内容，并保留属性类型配置；未声明的属性不会加入配置。</p><pre>{documentMarkdown(pending.parsed)}</pre><div className="modal-actions"><button className="ghost ui-button--ghost ui-surface ui-button ui-button--standard" onClick={() => setPending(null)}>取消</button><button className="primary ui-button--primary ui-surface ui-button ui-button--standard" onClick={() => {
      try { const imported=parseDocumentMarkdown(pending.text, doc, world,parseOptions);replaceDocumentFromImport(world.id,doc.id);onChange(imported); setPending(null); setPreview(true) }
      catch (failure) { setError(failure instanceof Error ? failure.message : '导入失败'); setPending(null) }
    }}>导入并替换</button></div></div></div>}
  </div>
}
