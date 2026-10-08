import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Columns2, FileUp, X } from 'lucide-react'
import { ClassDocument, World } from '../model/types'
import { documentMarkdown, markdownLocations, parseDocumentMarkdown } from '../model/markdown'
import { DocumentEditor } from './App'
import { replaceDocumentFromImport } from '../services/storage'

export default function DocumentWorkspace({ world, doc, onChange, onDelete }: {
  world: World; doc: ClassDocument; onChange: (doc: ClassDocument) => void; onDelete: () => void
}) {
  const [preview, setPreview] = useState(false)
  const [pending, setPending] = useState<{ text: string; name: string; parsed: ClassDocument } | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const source = documentMarkdown(doc)
  const [draft,setDraft]=useState(source),[editError,setEditError]=useState('')
  const [selection,setSelection]=useState<{id:string;part:'key'|'value'}|null>(null)
  const editor=useRef<HTMLTextAreaElement>(null),highlight=useRef<HTMLDivElement>(null)
  const lastSource=useRef(source),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const validDraft=useRef(true)
  const current=useRef({doc,world,onChange});current.current={doc,world,onChange}
  const locations=markdownLocations(doc),location=selection?locations[selection.id]:undefined
  const selectedLine=location?(selection?.part==='key'?location.key:location.value):-1
  const selectedEnd=location?(selection?.part==='key'?location.key:location.end):-1
  useEffect(()=>{
    if(source!==lastSource.current){lastSource.current=source;setDraft(source);validDraft.current=true;setEditError('');if(timer.current){clearTimeout(timer.current);timer.current=null}}
  },[source])
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
  useEffect(()=>{
    if(!preview||selectedLine<0||!editor.current)return
    const el=editor.current,y=selectedLine*24
    if(y<el.scrollTop+24||y>el.scrollTop+el.clientHeight-60)el.scrollTop=Math.max(0,y-el.clientHeight/3)
    if(highlight.current){highlight.current.scrollTop=el.scrollTop;highlight.current.scrollLeft=el.scrollLeft}
  },[preview,selectedLine,selectedEnd,draft])
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
      const parsed=parseDocumentMarkdown(text,latest,latestWorld)
      lastSource.current=documentMarkdown(parsed);validDraft.current=true;setEditError('');change(parsed)
    }catch(failure){validDraft.current=false;setEditError(failure instanceof Error?failure.message:'Markdown 格式有误')}
  }
  const editSource=(text:string)=>{
    setDraft(text);validDraft.current=false;setSelection(null)
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>applySource(text),350)
  }
  const tools = <>
    <input ref={fileInput} className="hidden-file-input" type="file" accept=".md,.markdown,text/markdown" aria-label="选择 Markdown 文件" onChange={async e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const text = await file.text(), parsed = parseDocumentMarkdown(text, doc, world)
        setPending({ text, name: file.name, parsed }); setError('')
      } catch (failure) { setError(failure instanceof Error ? failure.message : '无法读取 Markdown 文件') }
    }} />
    <button className="ghost" onClick={() => fileInput.current?.click()}><FileUp size={16} /> 导入 MD</button>
    <button className={`ghost markdown-toggle ${preview ? 'selected' : ''}`} title={preview ? '关闭 Markdown 预览' : '显示 Markdown 预览'} aria-label="Markdown 分栏预览" aria-pressed={preview} onClick={() => setPreview(!preview)}><Columns2 size={18} /></button>
  </>
  return <div className={`document-workspace ${preview ? 'with-markdown' : ''}`}>
    <div className="document-operation" onFocusCapture={focusField} onClickCapture={focusField}>{error && <div className="document-error" role="alert">{error}<button className="icon-button" title="关闭提示" onClick={() => setError('')}><X size={15} /></button></div>}<DocumentEditor world={world} doc={doc} onChange={onChange} onDelete={onDelete} tools={tools} /></div>
    <aside className={`markdown-preview ${preview ? 'is-open' : ''}`} aria-hidden={!preview} inert={!preview} onKeyDown={e=>{if(e.key==='Escape')setPreview(false)}}><header><div><strong>{doc.fileName}</strong><span>{editError?'格式有误 · 修改尚未保存':'可直接编辑 · 自动保存'}</span></div><button className="icon-button" title="关闭 Markdown 预览" onClick={() => setPreview(false)}><X size={17} /></button></header>{editError&&<div className="markdown-edit-error" role="alert">{editError}</div>}<div className="markdown-code-editor"><div ref={highlight} className="markdown-line-overlay" aria-hidden="true">{draft.split('\n').map((line,index)=><div key={index} className={index>=selectedLine&&index<=selectedEnd?'current-line':''}>{line||'\u00a0'}</div>)}</div><textarea ref={editor} aria-label="Markdown 文件内容" spellCheck={false} wrap="off" value={draft} onChange={e=>editSource(e.target.value)} onBlur={()=>{if(timer.current)applySource(draft)}} onScroll={e=>{if(highlight.current){highlight.current.scrollTop=e.currentTarget.scrollTop;highlight.current.scrollLeft=e.currentTarget.scrollLeft}}}/></div></aside>
    {pending && <div className="modal-backdrop"><div className="modal markdown-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="eyebrow">IMPORT MARKDOWN</div><h2 id="import-title">导入 {pending.name}</h2><p>识别到类“{pending.parsed.name}”，包含 {pending.parsed.entities.length} 个实例。导入后会替换当前文件的实例内容，并保留属性类型配置；新属性会加入配置。</p><pre>{documentMarkdown(pending.parsed)}</pre><div className="modal-actions"><button className="ghost" onClick={() => setPending(null)}>取消</button><button className="primary" onClick={() => {
      try { const imported=parseDocumentMarkdown(pending.text, doc, world);replaceDocumentFromImport(world.id,doc.id);onChange(imported); setPending(null); setPreview(true) }
      catch (failure) { setError(failure instanceof Error ? failure.message : '导入失败'); setPending(null) }
    }}>导入并替换</button></div></div></div>}
  </div>
}
