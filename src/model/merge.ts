const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => equal(value, b[i]))
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  // JSON persistence omits undefined object properties.
  const keys = Object.keys(left).filter(key => left[key] !== undefined)
  return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
}
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
      const baseById = new Map(b.map(item => [item.id, item])), localById = new Map(l.map(item => [item.id, item])), remoteById = new Map(r.map(item => [item.id, item]))
      for (const id of ids) {
        const value = merge(baseById.get(id), localById.get(id), remoteById.get(id), `${path}/${id}`)
        if (value !== undefined) values.set(id, value)
      }
      const baseOrder = b.map(item => item.id), localOrder = l.filter(item => baseById.has(item.id)).map(item => item.id), localIds = new Set(localOrder)
      const order = equal(localOrder, baseOrder.filter(id => localIds.has(id))) ? [...r, ...l] : [...l, ...r]
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

/** Restore immutable sharing after a worker/JSON transport cloned unchanged subtrees. */
export function retainReferences<T>(before:T,after:T):T {
 if(before===after||equal(before,after))return before
 if(Array.isArray(before)&&Array.isArray(after)){
  const ids=idList(before)?new Map(before.map(v=>[v.id,v])):undefined
  return after.map((value,i)=>retainReferences(ids&&record(value)&&typeof value.id==='string'?ids.get(value.id):before[i],value)) as T
 }
 if(record(before)&&record(after))return Object.fromEntries(Object.entries(after).map(([key,value])=>[key,retainReferences(before[key],value)])) as T
 return after
}
