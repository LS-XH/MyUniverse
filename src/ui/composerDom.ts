/** Composer DOM stores protocol tokens only on atomic chips; labels never change payloads. */
export function composerText(root:Node):string{
 if(root.nodeType===Node.TEXT_NODE)return root.textContent||''
 if(root instanceof HTMLElement&&root.dataset.chatToken)return root.dataset.chatToken
 if(root instanceof HTMLBRElement)return '\n'
 let text='';Array.from(root.childNodes).forEach((node,index)=>{if(index&&node instanceof HTMLElement&&/^(DIV|P)$/.test(node.tagName)&&!text.endsWith('\n'))text+='\n';text+=composerText(node)})
 return text
}
export function composerCaret(root:HTMLElement){const selection=window.getSelection();if(!selection?.rangeCount||!root.contains(selection.anchorNode))return composerText(root).length;const range=selection.getRangeAt(0).cloneRange();range.selectNodeContents(root);range.setEnd(selection.anchorNode!,selection.anchorOffset);return composerText(range.cloneContents()).length}
export function setComposerCaret(root:HTMLElement,offset:number){
 let remaining=offset,done=false;const range=document.createRange()
 const walk=(node:Node)=>{if(done)return;if(node instanceof HTMLElement&&node.dataset.chatToken){const length=node.dataset.chatToken.length;if(remaining<=length){remaining===0?range.setStartBefore(node):range.setStartAfter(node);done=true}else remaining-=length;return}if(node.nodeType===Node.TEXT_NODE){const length=node.textContent?.length||0;if(remaining<=length){range.setStart(node,remaining);done=true}else remaining-=length;return}for(const child of node.childNodes)walk(child)}
 walk(root);if(!done){range.selectNodeContents(root);range.collapse(false)}else range.collapse(true);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
}
