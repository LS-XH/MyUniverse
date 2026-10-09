import { memo, useState } from 'react'
import { toCssColor } from './ColorPicker'
import { GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, relationGeometry, type Point } from '../model/graphGeometry'
import type { GraphStyle } from '../model/types'

function GraphEdge({a,b,style,label,showLabel,edgeId,onSelect}:{a:Point;b:Point;style?:GraphStyle;label:string;showLabel:boolean;edgeId:string;onSelect:(id:string)=>void}) {
  const [hover,setHover]=useState(false)
  const width=style?.lineWidth??2.5,border=style?.borderWidth??1,fill=toCssColor(style?.fill||'#8e85c9'),stroke=toCssColor(style?.stroke||'#574a88')
  const {start,end,tip,left,right}=relationGeometry(a,b,width,border)
  const points=`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
  const dash=({'长划线':'14 8','短划线':'6 5','长划线点线':'14 6 2 6'} as Record<string,string>)[style?.lineType||'']
  const line={x1:start.x,y1:start.y,x2:end.x,y2:end.y,strokeDasharray:dash}
  const glow=hover?Math.max(5,style?.glow||0):(style?.glow||0)/2
  return <g className={`graph-edge ${hover?'is-hovered':''}`} style={{filter:hover?'brightness(1.22) saturate(1.2)':undefined}} onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onPointerDown={e=>{e.stopPropagation();onSelect(edgeId)}}>
    <line {...line} stroke="transparent" strokeWidth={Math.max(16,width+border*2+8)} className="edge-hit"/>
    {border>0&&<line {...line} stroke={stroke} strokeWidth={width+border*2} pointerEvents="none"/>}
    {border>0&&<polygon points={points} fill="none" stroke={stroke} strokeWidth={border*2} strokeLinejoin="round" pointerEvents="none"/>}
    <g className="edge-fill" style={{filter:glow?`drop-shadow(0 0 ${glow}px ${fill})`:undefined}} pointerEvents="none">
      <line {...line} stroke={fill} strokeWidth={width}/>
      <polygon points={points} fill={fill} className="edge-arrow"/>
    </g>
    {showLabel&&<text x={(a.x+b.x)/2+GRAPH_NODE_WIDTH/2} y={(a.y+b.y)/2+GRAPH_NODE_HEIGHT/2-12} fill={fill} fontSize={style?.fontSize||13} textAnchor="middle">{label}</text>}
  </g>
}

export default memo(GraphEdge,(a,b)=>a.a.x===b.a.x&&a.a.y===b.a.y&&a.b.x===b.b.x&&a.b.y===b.b.y&&a.style===b.style&&a.label===b.label&&a.showLabel===b.showLabel&&a.edgeId===b.edgeId&&a.onSelect===b.onSelect)
