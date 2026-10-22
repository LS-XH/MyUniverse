/** Measure the native textarea caret without assuming character widths or tab stops. */
export function textareaCaret(element:HTMLTextAreaElement){
 const style=getComputedStyle(element),mirror=document.createElement('div'),marker=document.createElement('span')
 const properties=['font-family','font-size','font-weight','font-style','line-height','letter-spacing','tab-size','padding-top','padding-left','padding-right','padding-bottom','border-top-width','border-left-width','border-right-width','border-bottom-width','box-sizing','text-indent','direction']
 for(const property of properties)mirror.style.setProperty(property,style.getPropertyValue(property))
 Object.assign(mirror.style,{position:'fixed',left:'-100000px',top:'0',visibility:'hidden',whiteSpace:'pre',width:'max-content',borderStyle:'solid'})
 mirror.textContent=element.value.slice(0,element.selectionStart);marker.textContent='\u200b';mirror.append(marker);document.body.append(mirror)
 const rect=element.getBoundingClientRect(),base=mirror.getBoundingClientRect(),caret=marker.getBoundingClientRect(),lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5
 const result={left:rect.left+caret.left-base.left-element.scrollLeft,top:rect.top+caret.top-base.top-element.scrollTop,lineHeight}
 mirror.remove();return result
}
