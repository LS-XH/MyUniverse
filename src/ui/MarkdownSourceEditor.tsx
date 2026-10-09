import { useLayoutEffect, useRef } from 'react'
import { markdownHeadingLevels } from '../model/markdown'

export default function MarkdownSourceEditor({value,onChange,selectedLine,selectedEnd}:{value:string;onChange:(text:string)=>void;selectedLine:number;selectedEnd:number}) {
  const ref=useRef<HTMLDivElement>(null),composing=useRef(false)
  useLayoutEffect(()=>{
    const el=ref.current;if(!el||composing.current)return
    const selection=window.getSelection();let caret:number|null=null
    if(document.activeElement===el&&selection?.anchorNode&&el.contains(selection.anchorNode)){
      const range=document.createRange();range.selectNodeContents(el);range.setEnd(selection.anchorNode,selection.anchorOffset);caret=range.toString().length
    }
    const fragment=document.createDocumentFragment(),lines=value.split('\n'),levels=markdownHeadingLevels(value)
    lines.forEach((line,index)=>{
      const span=document.createElement('span'),level=levels[index]
      span.dataset.line=String(index);span.className=`markdown-source-line ${level?`md-heading md-heading-${Math.min(6,level)}`:''} ${index>=selectedLine&&index<=selectedEnd?'current-line':''}`
      span.textContent=line+(index<lines.length-1?'\n':'');fragment.appendChild(span)
    })
    el.replaceChildren(fragment)
    if(caret!==null&&selection){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Node|null=walker.nextNode(),remaining=caret
      while(node&&remaining>(node.textContent?.length||0)){remaining-=node.textContent?.length||0;node=walker.nextNode()}
      const range=document.createRange();if(node)range.setStart(node,Math.min(remaining,node.textContent?.length||0));else{range.selectNodeContents(el);range.collapse(false)}range.collapse(true);selection.removeAllRanges();selection.addRange(range)
    }
    if(selectedLine>=0){const target=el.querySelector<HTMLElement>(`[data-line="${selectedLine}"]`);if(target){const y=target.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop;if(y<el.scrollTop+20||y>el.scrollTop+el.clientHeight-55)el.scrollTop=Math.max(0,y-el.clientHeight/3)}}
  },[value,selectedLine,selectedEnd])
  const insert=(text:string)=>{
    const selection=window.getSelection(),el=ref.current;if(!el||!selection?.rangeCount)return
    const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return
    range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);onChange(el.textContent||'')
  }
  return <div ref={ref} className="markdown-source-editor" role="textbox" aria-label="Markdown 文件内容" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={false} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false;onChange(ref.current?.textContent||'')}} onInput={()=>{if(!composing.current)onChange(ref.current?.textContent||'')}} onKeyDown={e=>{if(e.key==='Enter'&&!composing.current){e.preventDefault();insert('\n')}if(e.key==='Tab'){e.preventDefault();insert('  ')}}} onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'))}}/>
}
