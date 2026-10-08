const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const idList = (value: unknown): value is { id: string }[] => Array.isArray(value) && value.every(item => record(item) && typeof item.id === 'string')

/** Merge independent property edits and additions. Report competing edits and delete/edit conflicts. */
export function mergeThreeWay<T>(base: T, local: T, remote: T, prefer: 'local' | 'remote' = 'local'): { value: T; conflicts: string[] } {
  const conflicts: string[] = []
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (equal(l, b)) return r
    if (equal(r, b) || equal(l, r)) return l
    if (idList(b) && idList(l) && idList(r)) {
      const ids = new Set([...b, ...l, ...r].map(item => item.id))
      const values = new Map<string, unknown>()
      for (const id of ids) {
        const value = merge(b.find(x => x.id === id), l.find(x => x.id === id), r.find(x => x.id === id), `${path}/${id}`)
        if (value !== undefined) values.set(id, value)
      }
      const baseOrder = b.map(item => item.id), localOrder = l.filter(item => baseOrder.includes(item.id)).map(item => item.id)
      const order = equal(localOrder, baseOrder.filter(id => localOrder.includes(id))) ? [...r, ...l] : [...l, ...r]
      return [...new Set(order.map(item => item.id))].filter(id => values.has(id)).map(id => values.get(id))
    }
    if (record(b) && record(l) && record(r)) {
      const result: Record<string, unknown> = {}
      for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(b[key], l[key], r[key], `${path}/${key}`)
        if (value !== undefined) result[key] = value
      }
      return result
    }
    conflicts.push(path)
    return prefer === 'local' ? l : r
  }
  return { value: merge(base, local, remote, '') as T, conflicts }
}

export const sameData = equal
