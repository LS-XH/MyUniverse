export const GRAPH_NODE_WIDTH = 210
export const GRAPH_NODE_HEIGHT = 88
export type Point = { x: number; y: number }

// A single pointer displacement applies to each initial node position. No
// incremental rounding or dependence on the last React render while dragging.
export function translateSelection(initial: Record<string, Point>, offset: Point): Record<string, Point> {
  return Object.fromEntries(Object.entries(initial).map(([id, point]) => [id, { x: point.x + offset.x, y: point.y + offset.y }]))
}

export function graphBounds(points: Point[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const x = Math.min(0, ...xs) - 100, y = Math.min(0, ...ys) - 100
  return { x, y, width: Math.max(1, ...xs.map(value => value + GRAPH_NODE_WIDTH)) - x + 100, height: Math.max(1, ...ys.map(value => value + GRAPH_NODE_HEIGHT)) - y + 100 }
}
