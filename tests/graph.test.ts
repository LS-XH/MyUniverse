import test from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, GRAPH_MIN_SCALE, graphBounds, translateSelection, edgePanVelocity, zoomAt, relationGeometry } from '../src/model/graphGeometry'

test('group dragging preserves relative distances and supports negative world positions',()=>{
  const initial={first:{x:120,y:90},second:{x:380,y:210},third:{x:660,y:450}}
  const moved=translateSelection(initial,{x:-450,y:175})
  for(const a of Object.keys(initial))for(const b of Object.keys(initial)){
    assert.equal(moved[a].x-moved[b].x,initial[a as keyof typeof initial].x-initial[b as keyof typeof initial].x)
    assert.equal(moved[a].y-moved[b].y,initial[a as keyof typeof initial].y-initial[b as keyof typeof initial].y)
  }
  assert.equal(initial.first.x,120)
  assert.ok(moved.first.x<0)
})
test('connection canvas contains every card beyond the former 2000 by 1400 limits and negative coordinates',()=>{
  const points=[{x:-2400,y:-1600},{x:4300,y:5700},{x:100,y:100}]
  const bounds=graphBounds(points)
  for(const point of points){
    assert.ok(point.x>bounds.x && point.y>bounds.y)
    assert.ok(point.x+GRAPH_NODE_WIDTH<bounds.x+bounds.width)
    assert.ok(point.y+GRAPH_NODE_HEIGHT<bounds.y+bounds.height)
  }
  assert.ok(graphBounds([]).width>0 && graphBounds([]).height>0)
})
test('edge panning stops in the interior and accelerates toward all four edges',()=>{
  const rect={left:100,right:900,top:80,bottom:680}
  assert.deepEqual(edgePanVelocity({x:500,y:350},rect),{x:0,y:0})
  assert.deepEqual(edgePanVelocity({x:100,y:80},rect),{x:1400,y:1400})
  assert.deepEqual(edgePanVelocity({x:900,y:680},rect),{x:-1400,y:-1400})
  assert.ok(edgePanVelocity({x:120,y:350},rect).x>edgePanVelocity({x:160,y:350},rect).x)
  assert.equal(edgePanVelocity({x:2000,y:350},rect).x,-1400)
})
test('zoom retains the world point under the pointer and supports an eight percent overview',()=>{
  const pan={x:-230,y:140},anchor={x:600,y:320},scale=.6
  const next=zoomAt(pan,scale,.0001,anchor)
  assert.equal(next.scale,GRAPH_MIN_SCALE)
  for(const axis of ['x','y'] as const)assert.ok(Math.abs((anchor[axis]-pan[axis])/scale-(anchor[axis]-next.pan[axis])/next.scale)<.00001)
  assert.equal(zoomAt(pan,scale,100,anchor).scale,3)
})

test('edge panning starts farther inside the viewport and uses the card bounds rather than only the pointer',()=>{
  const rect={left:0,right:1000,top:0,bottom:800},pointer={x:750,y:400}
  assert.equal(edgePanVelocity(pointer,rect).x,0)
  const early=edgePanVelocity(pointer,rect,{left:700,right:870,top:350,bottom:438})
  const close=edgePanVelocity(pointer,rect,{left:700,right:985,top:350,bottom:438})
  assert.ok(early.x<0 && close.x<early.x)
  assert.ok(Math.abs(close.x)>1000)
  assert.equal(close.y,0)
})
test('relationship shafts stop before the arrow base and thicker arrows retain target clearance',()=>{
  const a={x:0,y:0}
  for(const b of [{x:500,y:0},{x:-500,y:0},{x:0,y:500},{x:0,y:-500},{x:500,y:500}]){
    const shape=relationGeometry(a,b,20,10),dx=b.x-a.x,dy=b.y-a.y
    assert.ok((shape.tip.x-shape.base.x)*dx+(shape.tip.y-shape.base.y)*dy>0)
    assert.ok((shape.base.x-shape.end.x)*dx+(shape.base.y-shape.end.y)*dy>0)
    assert.ok(shape.tip.x<b.x-8||shape.tip.x>b.x+GRAPH_NODE_WIDTH+8||shape.tip.y<b.y-8||shape.tip.y>b.y+GRAPH_NODE_HEIGHT+8)
  }
  assert.ok(Math.hypot(relationGeometry(a,{x:500,y:0},20,1).left.x-relationGeometry(a,{x:500,y:0},20,1).right.x,relationGeometry(a,{x:500,y:0},20,1).left.y-relationGeometry(a,{x:500,y:0},20,1).right.y)>12)
})
