import { useLayoutEffect, useMemo, useRef } from 'react'
import { markdownHeadingLevels } from '../model/markdown'
import {lineDiff,type DiffLine} from '../model/textDiff'

/** Deleted comparison rows are presentation only, never part of the editable source. */
export function editableMarkdownText(node:Node):string {
 const copy=node.cloneNode(true) as HTMLElement
 copy.querySelectorAll?.('[data-deleted]').forEach(row=>row.remove())
 return copy.textContent||''
}

export default function MarkdownSourceEditor({value,baseline,onChange=()=>{},selectedLine,selectedEnd,readOnly=false,preparedRows,preparedLevels}:{value:string;baseline?:string;onChange?:(text:string)=>void;selectedLine:number;selectedEnd:number;readOnly?:boolean;preparedRows?:DiffLine[];preparedLevels?:number[]}) {
  const ref=useRef<HTMLDivElement>(null),composing=useRef(false)
  const prepared=useMemo(()=>{
    const lines=value.split('\n'),levels=preparedLevels||markdownHeadingLevels(value)
    const rows=preparedRows|| (baseline===undefined?lines.map((text,index)=>({kind:'context' as const,text,after:index+1})):lineDiff(baseline,value,true))
    if(!rows.some(row=>row.after))rows.push({kind:'context',text:'',after:1})
    return {lines,levels,rows}
  },[value,baseline,preparedRows,preparedLevels])
  useLayoutEffect(()=>{
    const el=ref.current;if(!el||composing.current)return
    const selection=window.getSelection();let caret:number|null=null
    if(document.activeElement===el&&selection?.anchorNode&&el.contains(selection.anchorNode)){
      const range=document.createRange();range.selectNodeContents(el);range.setEnd(selection.anchorNode,selection.anchorOffset);caret=editableMarkdownText(range.cloneContents()).length
    }
    const {lines,levels,rows}=prepared
    const existing=new Map(Array.from(el.children).map(child=>[(child as HTMLElement).dataset.rowKey,child as HTMLElement])),counts=new Map<string,number>(),keep=new Set<HTMLElement>()
    const renderRow=(row:DiffLine,index:number)=>{
      const key=JSON.stringify([row.kind==='remove'?'remove':'after',row.text]),count=counts.get(key)||0;counts.set(key,count+1)
      const rowKey=key+':'+count,span=existing.get(rowKey)||document.createElement('span'),line=(row.after||0)-1,level=row.kind==='remove'?0:levels[line]
      span.dataset.rowKey=rowKey;keep.add(span)
      const className=`markdown-source-line diff-${row.kind} ${level?`md-heading md-heading-${Math.min(6,level)}`:''} ${selectedLine>=0&&line>=selectedLine&&line<=selectedEnd?'current-line':''}`,text=row.text+(row.kind==='remove'||line<lines.length-1?'\n':'')
      if(row.kind==='remove'){span.dataset.deleted='true';span.contentEditable='false';delete span.dataset.line}
      else{delete span.dataset.deleted;span.removeAttribute('contenteditable');span.dataset.line=String(line)}
      span.dataset.marker=row.kind==='add'?'+':row.kind==='remove'?'-':' '
      if(span.className!==className)span.className=className
      if(span.textContent!==text)span.textContent=text
      if(el.children[index]!==span)el.insertBefore(span,el.children[index]||null)
    }
    const finish=()=>{
    if(caret!==null&&selection){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[data-deleted]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let node:Node|null=walker.nextNode(),remaining=caret
      while(node&&remaining>=(node.textContent?.length||0)){remaining-=node.textContent?.length||0;node=walker.nextNode()}
      const range=document.createRange();if(node)range.setStart(node,Math.min(remaining,node.textContent?.length||0));else{const last=el.querySelector<HTMLElement>(`[data-line="${lines.length-1}"]`);range.selectNodeContents(last||el);range.collapse(false)}range.collapse(true);selection.removeAllRanges();selection.addRange(range)
    }
    if(selectedLine>=0){const target=el.querySelector<HTMLElement>(`[data-line="${selectedLine}"]`);if(target){const y=target.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop;if(y<el.scrollTop+20||y>el.scrollTop+el.clientHeight-55)el.scrollTop=Math.max(0,y-el.clientHeight/3)}}
    el.setAttribute('aria-busy','false')
    }
    if(!readOnly){rows.forEach(renderRow);for(const child of Array.from(el.children))if(!keep.has(child as HTMLElement))child.remove();finish();return}
    // Large previews reconcile in short frame slices, rather than blocking a layout effect.
    el.setAttribute('aria-busy','true')
    let index=0,removing=0,obsolete:Element[]|undefined,frame=0,stopped=false
    const batch=()=>{
      if(stopped)return
      const start=performance.now();let count=0
      while(index<rows.length&&count++<200&&performance.now()-start<8){renderRow(rows[index],index);index++}
      if(index<rows.length){frame=requestAnimationFrame(batch);return}
      obsolete??=Array.from(el.children).filter(child=>!keep.has(child as HTMLElement))
      count=0;while(removing<obsolete.length&&count++<200&&performance.now()-start<8)obsolete[removing++].remove()
      if(removing<obsolete.length){frame=requestAnimationFrame(batch);return}
      finish()
    }
    frame=requestAnimationFrame(batch)
    return()=>{stopped=true;cancelAnimationFrame(frame)}
  },[prepared,selectedLine,selectedEnd,readOnly])
  const insert=(text:string)=>{
    const selection=window.getSelection(),el=ref.current;if(!el||!selection?.rangeCount)return
    const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return
    range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);onChange(editableMarkdownText(el))
  }
  return <div ref={ref} className="markdown-source-editor" role="textbox" aria-label="Markdown 文件内容" aria-readonly={readOnly} aria-multiline="true" contentEditable={!readOnly} suppressContentEditableWarning spellCheck={false} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false;if(!readOnly)onChange(ref.current?editableMarkdownText(ref.current):'')}} onInput={()=>{if(!readOnly&&!composing.current)onChange(ref.current?editableMarkdownText(ref.current):'')}} onKeyDown={e=>{if(readOnly)return;if(e.key==='Enter'&&!composing.current){e.preventDefault();insert('\n')}if(e.key==='Tab'){e.preventDefault();insert('  ')}}} onPaste={e=>{if(readOnly)return;e.preventDefault();insert(e.clipboardData.getData('text/plain'))}}/>
}
