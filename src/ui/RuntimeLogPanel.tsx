import Select from './Select'
import {memo,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react'
import {SquareTerminal,Trash2,X} from 'lucide-react'
import {runtimeLog,type LogLevel,type LogEntry} from '../services/runtimeLog'

const levels:Record<LogLevel,string>={debug:'调试',info:'信息',warn:'警告',error:'错误'}
const time=(value:number)=>{const date=new Date(value);return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN',{hour12:false})}.${String(date.getMilliseconds()).padStart(3,'0')}`}
const LogRow=memo(function LogRow({entry}:{entry:LogEntry}){return <div className={`runtime-log-row log-${entry.level}`}><time dateTime={new Date(entry.time).toISOString()}>{time(entry.time)}</time><span className="runtime-log-level">{levels[entry.level]}</span><span className="runtime-log-source">{entry.source}</span><pre>{entry.message}{entry.count>1&&<span className="runtime-log-repeat"> ×{entry.count}（最近 {time(entry.lastTime)}）</span>}</pre></div>})
export default function RuntimeLogPanel({open,onClose}:{open:boolean;onClose:()=>void}){
 const entries=useSyncExternalStore(runtimeLog.subscribe,runtimeLog.getSnapshot),[level,setLevel]=useState('all'),[search,setSearch]=useState('')
 const panel=useRef<HTMLElement>(null),output=useRef<HTMLDivElement>(null),follow=useRef(true)
 const visible=open?entries.filter(e=>(level==='all'||e.level===level)&&(!search||`${e.source} ${e.message}`.toLowerCase().includes(search.toLowerCase()))):[]
 useEffect(()=>{
  if(!open)return
  const outside=(event:PointerEvent)=>{const target=event.target as Element;if(!panel.current?.contains(target)&&!target.closest('.runtime-log-toggle'))onClose()}
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open,onClose])
 useLayoutEffect(()=>{if(open&&follow.current&&output.current)output.current.scrollTop=output.current.scrollHeight},[open,entries,level,search])
 return <section ref={panel} id="runtime-log-panel" className={`runtime-log-panel ${open?'is-open':''}`} role="region" aria-label="日志输出" aria-hidden={!open} inert={!open}>
  <header className="runtime-log-header"><div className="runtime-log-title"><SquareTerminal size={18}/><strong>日志输出</strong><span>{entries.length} 条 · 最近 {runtimeLog.limit} 条</span></div><div className="runtime-log-tools"><input className="ui-surface ui-field" aria-label="搜索日志" placeholder="搜索日志…" value={search} onChange={e=>setSearch(e.target.value)}/><Select className="ui-surface ui-field" aria-label="日志级别" value={level} onChange={e=>setLevel(e.target.value)}><option value="all">全部级别</option>{Object.entries(levels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select><button className="icon-button ui-button--icon ui-surface ui-button" title="清空日志" aria-label="清空日志" onClick={runtimeLog.clear}><Trash2 size={16}/></button><button className="icon-button ui-button--icon ui-surface ui-button" title="收起日志" aria-label="收起日志" onClick={onClose}><X size={18}/></button></div></header>
  <div ref={output} className="runtime-log-output" role="log" aria-live="off" aria-label="运行日志记录" onScroll={e=>{const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<48}}>{open&&(visible.length?visible.map(entry=><LogRow key={entry.id} entry={entry}/>):<div className="runtime-log-empty">{entries.length?'没有匹配的日志':'暂无日志'}</div>)}</div>
 </section>
}
