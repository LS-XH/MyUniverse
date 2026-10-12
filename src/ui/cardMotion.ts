/** Resolve a fixed 4px size delta from layout dimensions, never a percentage delta. */
export function prepareCardMotion(element:HTMLElement){
 const width=element.offsetWidth,height=element.offsetHeight
 if(!width||!height)return
 element.style.setProperty('--ui-card-grow-x',String((width+4)/width))
 element.style.setProperty('--ui-card-grow-y',String((height+4)/height))
 element.style.setProperty('--ui-card-press-x',String(Math.max(1,width-4)/width))
 element.style.setProperty('--ui-card-press-y',String(Math.max(1,height-4)/height))
}
