import test from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, graphBounds, translateSelection } from '../src/model/graphGeometry'

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
