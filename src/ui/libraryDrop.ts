/** Only the visible canvas under the pointer can accept a library card. */
export function canDropLibraryNode(canvas:HTMLElement|null,x:number,y:number){
 if(!canvas)return false
 const rect=canvas.getBoundingClientRect()
 if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return false
 const target=document.elementFromPoint(x,y)
 return !!target&&canvas.contains(target)&&!target.closest('.flow-library')
}
