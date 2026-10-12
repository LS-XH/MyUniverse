import { useLayoutEffect, useRef } from 'react'
import { markdownHeadingLevels } from '../model/markdown'
import {lineDiff} from '../model/textDiff'

/** Deleted comparison rows are presentation only, never part of the editable source. */
export function editableMarkdownText(node:Node):string {
 const copy=node.cloneNode(true) as HTMLElement
 copy.querySelectorAll?.('[data-deleted]').forEach(row=>row.remove())
 return copy.textContent||''
}

export default function MarkdownSourceEditor({value,baseline,onChange,selectedLine,selectedEnd}:{value:string;baseline?:string;onChange:(text:string)=>void;selectedLine:number;selectedEnd:number}) {
  const ref=useRef<HTMLDivElement>(null),composing=useRef(false)
  useLayoutEffect(()=>{
    const el=ref.current;if(!el||composing.current)return
    const selection=window.getSelection();let caret:number|null=null
    if(document.activeElement===el&&selection?.anchorNode&&el.contains(selection.anchorNode)){
      const range=document.createRange();range.selectNodeContents(el);range.setEnd(selection.anchorNode,selection.anchorOffset);caret=editableMarkdownText(range.cloneContents()).length
    }
    const lines=value.split('\n'),levels=markdownHeadingLevels(value)
    const rows=baseline===undefined?lines.map((text,index)=>({kind:'context' as const,text,after:index+1})):lineDiff(baseline,value,true)
    if(!rows.some(row=>row.after))rows.push({kind:'context',text:'',after:1})
    const sameCount=el.children.length===rows.length,fragment=sameCount?null:document.createDocumentFragment()
    rows.forEach((row,index)=>{
      const span=sameCount?el.children[index] as HTMLElement:document.createElement('span'),line=(row.after||0)-1,level=row.kind==='remove'?0:levels[line]
      const className=`markdown-source-line diff-${row.kind} ${level?`md-heading md-heading-${Math.min(6,level)}`:''} ${line>=0&&line>=selectedLine&&line<=selectedEnd?'current-line':''}`,text=row.text+(row.kind==='remove'||line<lines.length-1?'\n':'')
      if(row.kind==='remove'){span.dataset.deleted='true';span.contentEditable='false';delete span.dataset.line}
      else{delete span.dataset.deleted;span.removeAttribute('contenteditable');span.dataset.line=String(line)}
      span.dataset.marker=row.kind==='add'?'+':row.kind==='remove'?'-':' '
      if(span.className!==className)span.className=className
      if(span.textContent!==text)span.textContent=text
      fragment?.appendChild(span)
    })
    if(fragment)el.replaceChildren(fragment)
    if(caret!==null&&selection){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[data-deleted]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let node:Node|null=walker.nextNode(),remaining=caret
      while(node&&remaining>=(node.textContent?.length||0)){remaining-=node.textContent?.length||0;node=walker.nextNode()}
      const range=document.createRange();if(node)range.setStart(node,Math.min(remaining,node.textContent?.length||0));else{const last=el.querySelector<HTMLElement>(`[data-line="${lines.length-1}"]`);range.selectNodeContents(last||el);range.collapse(false)}range.collapse(true);selection.removeAllRanges();selection.addRange(range)
    }
    if(selectedLine>=0){const target=el.querySelector<HTMLElement>(`[data-line="${selectedLine}"]`);if(target){const y=target.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop;if(y<el.scrollTop+20||y>el.scrollTop+el.clientHeight-55)el.scrollTop=Math.max(0,y-el.clientHeight/3)}}
  },[value,baseline,selectedLine,selectedEnd])
  const insert=(text:string)=>{
    const selection=window.getSelection(),el=ref.current;if(!el||!selection?.rangeCount)return
    const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return
    range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);onChange(editableMarkdownText(el))
  }
  return <div ref={ref} className="markdown-source-editor" role="textbox" aria-label="Markdown 文件内容" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={false} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false;onChange(ref.current?editableMarkdownText(ref.current):'')}} onInput={()=>{if(!composing.current)onChange(ref.current?editableMarkdownText(ref.current):'')}} onKeyDown={e=>{if(e.key==='Enter'&&!composing.current){e.preventDefault();insert('\n')}if(e.key==='Tab'){e.preventDefault();insert('  ')}}} onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'))}}/>
}
