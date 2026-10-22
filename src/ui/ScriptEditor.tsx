import {useMemo,useRef,useState,type RefObject,type TextareaHTMLAttributes} from 'react'
import {activeIdentifier,tokenizeScript,type ScriptLanguage} from '../model/scriptEditor'

type Props=TextareaHTMLAttributes<HTMLTextAreaElement>&{value:string;language:ScriptLanguage;editorRef:RefObject<HTMLTextAreaElement|null>}
export default function ScriptEditor({value,language,editorRef,onSelect,onScroll,...props}:Props){
 const paint=useRef<HTMLPreElement>(null),gutter=useRef<HTMLDivElement>(null)
 const [selection,setSelection]=useState({start:0,end:0}),[focused,setFocused]=useState(false)
 const tokens=useMemo(()=>tokenizeScript(value,language),[value,language]),active=focused?activeIdentifier(tokens,selection.start,selection.end):''
 const lines=useMemo(()=>value.split('\n').map((_,i)=>i+1),[value])
 return <div className="script-editor"><div className="script-line-numbers" aria-hidden="true"><div ref={gutter}>{lines.map(line=><div key={line}>{line}</div>)}</div></div><div className="script-editor-body"><pre ref={paint} className="script-highlight" aria-hidden="true">{tokens.map(token=><span key={token.start} className={`script-token-${token.kind}${active===token.text&&['variable','function'].includes(token.kind)?' script-occurrence':''}`}>{token.text}</span>)}{'\n'}</pre><textarea {...props} ref={editorRef} value={value} wrap="off" autoCapitalize="off" autoCorrect="off" onFocus={event=>{setFocused(true);props.onFocus?.(event)}} onBlur={event=>{setFocused(false);props.onBlur?.(event)}} onSelect={event=>{setSelection({start:event.currentTarget.selectionStart,end:event.currentTarget.selectionEnd});onSelect?.(event)}} onScroll={event=>{const el=event.currentTarget;if(paint.current)paint.current.style.transform=`translate(${-el.scrollLeft}px,${-el.scrollTop}px)`;if(gutter.current)gutter.current.style.transform=`translateY(${-el.scrollTop}px)`;onScroll?.(event)}}/></div></div>
}
