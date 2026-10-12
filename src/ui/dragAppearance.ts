/** Freeze the resolved appearance before a drag clone leaves its CSS ancestors. */
export function preserveDragAppearance(source:HTMLElement,clone:HTMLElement){
 const originals=[source,...source.querySelectorAll<HTMLElement>('*')]
 const copies=[clone,...clone.querySelectorAll<HTMLElement>('*')]
 const dragOwned=new Set(['position','left','top','right','bottom','transform','translate','rotate','scale','z-index','opacity','visibility','pointer-events','box-shadow','width','height'])
 originals.forEach((element,index)=>{
  const style=getComputedStyle(element),copy=copies[index]
  for(let i=0;i<style.length;i++){
   const property=style[i]
   if(property.startsWith('animation')||property.startsWith('transition')||(index===0&&dragOwned.has(property)))continue
   copy.style.setProperty(property,style.getPropertyValue(property))
  }
 })
}
