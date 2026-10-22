import { memo, useState } from 'react'
import { toCssColor } from './ColorPicker'
import { GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, relationGeometry, curvedRelationGeometry, type Point } from '../model/graphGeometry'
import type { GraphStyle } from '../model/types'

function GraphEdge({a,b,style,label,showLabel,edgeId,onSelect,selected=false,bend=0}:{a:Point;b:Point;style?:GraphStyle;label:string;showLabel:boolean;edgeId:string;onSelect:(id:string,additive:boolean)=>void;selected?:boolean;bend?:number}) {
  const [hover,setHover]=useState(false)
  const width=style?.lineWidth??2.5,border=style?.borderWidth??1,fill=toCssColor(style?.fill||'#8e85c9'),stroke=toCssColor(style?.stroke||'#574a88')
  const straight=relationGeometry(a,b,width,border),curve=bend?curvedRelationGeometry(a,b,bend,width,border):undefined
  const {start,end}=straight,{tip,left,right}=curve||straight
  const points=`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
  const dash=({'长划线':'14 8','短划线':'6 5','长划线点线':'14 6 2 6'} as Record<string,string>)[style?.lineType||'']
  const line={x1:start.x,y1:start.y,x2:end.x,y2:end.y,strokeDasharray:dash}
  const labels=label.split(/\r?\n/).filter(Boolean),labelX=curve?.label.x??(a.x+b.x)/2+GRAPH_NODE_WIDTH/2,labelY=curve?.label.y??(a.y+b.y)/2+GRAPH_NODE_HEIGHT/2-12,fontSize=style?.fontSize||13
  const glow=hover||selected?Math.max(5,style?.glow||0):(style?.glow||0)/2
  return <g className={`graph-edge ${hover?'is-hovered':''} ${selected?'is-selected':''}`} role="button" aria-label={label} aria-pressed={selected} style={{filter:hover||selected?'brightness(1.22) saturate(1.2)':undefined}} onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();onSelect(edgeId,e.ctrlKey||e.metaKey||e.shiftKey)}}>
    {selected&&(curve?<path d={curve.path} fill="none" stroke="#7c6de8" strokeOpacity={.32} strokeWidth={width+10} pointerEvents="none"/>:<line {...line} stroke="#7c6de8" strokeOpacity={.32} strokeWidth={width+10} pointerEvents="none"/>)}
    {curve?<path d={curve.path} fill="none" stroke="transparent" strokeWidth={Math.max(16,width+border*2+8)} className="edge-hit"/>:<line {...line} stroke="transparent" strokeWidth={Math.max(16,width+border*2+8)} className="edge-hit"/>}
    {border>0&&(curve?<path d={curve.path} fill="none" strokeDasharray={dash} stroke={stroke} strokeWidth={width+border*2} pointerEvents="none"/>:<line {...line} stroke={stroke} strokeWidth={width+border*2} pointerEvents="none"/>)}
    {border>0&&<polygon points={points} fill="none" stroke={stroke} strokeWidth={border*2} strokeLinejoin="round" pointerEvents="none"/>}
    <g className="edge-fill" style={{filter:glow?`drop-shadow(0 0 ${glow}px ${fill})`:undefined}} pointerEvents="none">
      {curve?<path d={curve.path} fill="none" strokeDasharray={dash} stroke={fill} strokeWidth={width}/>:<line {...line} stroke={fill} strokeWidth={width}/>}
      <polygon points={points} fill={fill} className="edge-arrow"/>
    </g>
    {showLabel&&<text x={labelX} y={labelY} fill={fill} fontSize={fontSize} textAnchor="middle">{labels.map((text,index)=><tspan key={index} x={labelX} dy={index===0?-(labels.length-1)*fontSize*1.2:fontSize*1.2}>{text}</tspan>)}</text>}
  </g>
}

export default memo(GraphEdge,(a,b)=>a.a.x===b.a.x&&a.a.y===b.a.y&&a.b.x===b.b.x&&a.b.y===b.b.y&&a.style===b.style&&a.label===b.label&&a.showLabel===b.showLabel&&a.edgeId===b.edgeId&&a.onSelect===b.onSelect&&a.bend===b.bend&&a.selected===b.selected)
