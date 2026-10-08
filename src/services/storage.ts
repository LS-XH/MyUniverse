import { invoke, isTauri } from '@tauri-apps/api/core'
import { FieldSchema, Workspace } from '../model/types'
import { exportFiles, parseDocumentMarkdown } from '../model/markdown'
import { mergeThreeWay, sameData } from '../model/merge'
import { normalizeWorkspace } from '../model/themes'
const KEY='myuniverse-workspace-v1'
type Snapshot = Record<string, Record<string, string | null>>
let queue: Promise<unknown> = Promise.resolve()
let diskWorkspace: Workspace | null = null
let diskFiles: Snapshot = {}
let pendingConflict: MarkdownConflictError | null = null
let externalChanges: { base: Workspace; remote: Workspace }[] = []
let queuedCount = 0
const replacements = new Set<string>()
export function replaceDocumentFromImport(worldId: string, docId: string) {
  replacements.add(`${worldId}/${docId}`)
}

export class MarkdownConflictError extends Error {
  constructor(public submitted: Workspace, public local: Workspace, public remote: Workspace, public files: string[]) {
    super(`Markdown 与界面同时修改了相同内容：${files.join('、')}`)
  }
}
export function clearMarkdownConflict() {
  pendingConflict = null
  externalChanges = []
}
function serialize<T>(action: () => Promise<T>): Promise<T> {
  queuedCount++
  const task = queue.catch(() => undefined).then(action)
  queue = task
  return task.finally(() => { queuedCount--; if (!queuedCount) externalChanges = [] })
}
async function readFiles(workspace: Workspace, withSchema = false): Promise<Snapshot> {
  if (!isTauri()) return {}
  return invoke<Snapshot>('read_document_files', { requests: Object.fromEntries(workspace.worlds.map(world => [world.id, world.documents.flatMap(doc => withSchema ? [doc.fileName, doc.fileName.replace(/\.md$/i, '.schema.json')] : [doc.fileName])])) })
}
function isSchema(value: unknown): value is FieldSchema[] {
  return Array.isArray(value) && value.every(field => field && typeof field.id === 'string' && typeof field.key === 'string'
    && ['Const', 'Text', 'Class'].includes(field.keyType) && ['Object', 'Class', 'Data', 'Text', 'Content', 'Integer', 'Decimal', 'Null'].includes(field.valueType)
    && (!field.children || isSchema(field.children)))
}
function decodeDocuments(workspace: Workspace, snapshots: Snapshot, withSchema = false, tolerateErrors = false): Workspace {
  return { ...(diskWorkspace || workspace), worlds: workspace.worlds.map(world => {
    const oldWorld = diskWorkspace?.worlds.find(item => item.id === world.id)
    return { ...(oldWorld || world), documents: world.documents.map(doc => {
      let previous = oldWorld?.documents.find(item => item.id === doc.id) || doc
      // The import dialog explicitly authorizes replacing this document. It also
      // lets a valid import repair an unreadable current Markdown file.
      if (replacements.has(`${world.id}/${doc.id}`)) return previous
      const text = snapshots[world.id]?.[doc.fileName]
      try {
        if (withSchema) {
          const schemaText = snapshots[world.id]?.[doc.fileName.replace(/\.md$/i, '.schema.json')]
          if (schemaText != null) {
            const schema: unknown = JSON.parse(schemaText)
            if (!isSchema(schema)) throw new Error('属性配置格式无效')
            previous = { ...previous, schema }
          }
        }
        if (text == null) {
          if (diskFiles[world.id]?.[doc.fileName] != null) throw new Error('文件已被删除，请恢复文件后继续保存')
          return previous
        }
        if (!withSchema && text === diskFiles[world.id]?.[doc.fileName]) return previous
        return parseDocumentMarkdown(text, previous, world)
      } catch (error) {
        if (tolerateErrors) return doc
        throw new Error(`${world.name} / ${doc.fileName}：${error instanceof Error ? error.message : String(error)}。未覆盖磁盘文件。`)
      }
    }) }
  }) }
}
export async function loadWorkspace(): Promise<Workspace> {
  diskWorkspace = null
  diskFiles = {}
  clearMarkdownConflict()
  replacements.clear()
  const raw = isTauri() ? await invoke<Workspace>('load_workspace') : JSON.parse(localStorage.getItem(KEY) || '{"worlds":[],"activeWorldId":null}')
  const workspace = normalizeWorkspace(raw)
  const files = await readFiles(workspace, true)
  // A malformed external file leaves the last known objects visible, but the
  // subsequent sync reports its parse error and refuses to overwrite that file.
  const loaded = decodeDocuments(workspace, files, true, true)
  diskWorkspace = loaded
  // Do not mark files as understood until a strict parse has succeeded.
  diskFiles = {}
  return loaded
}

function changedFileNames(base: Workspace, local: Workspace, remote: Workspace): string[] {
  return local.worlds.flatMap(world => world.documents.filter(doc => {
    const b = base.worlds.find(w => w.id === world.id)?.documents.find(d => d.id === doc.id)
    const r = remote.worlds.find(w => w.id === world.id)?.documents.find(d => d.id === doc.id)
    return b && r && mergeThreeWay(b, doc, r).conflicts.length > 0
  }).map(doc => `${world.name} / ${doc.fileName}`))
}

/** Re-read before saving and use a content comparison in Rust to detect races. */
function synchronize(workspace: Workspace, write: boolean): Promise<Workspace> {
  const requestBase = diskWorkspace || workspace
  const changesAtRequest = externalChanges.length
  return serialize(async () => {
    if (pendingConflict) throw pendingConflict
    let local = mergeThreeWay(requestBase, workspace, diskWorkspace || workspace).value
    // An earlier queued refresh may have discovered external changes while this
    // request was waiting. Those edits still need conflict checks, even after rebasing.
    for (const change of externalChanges.slice(changesAtRequest)) {
      const merged = mergeThreeWay(change.base, local, change.remote)
      if (merged.conflicts.length) {
        pendingConflict = new MarkdownConflictError(workspace, merged.value, mergeThreeWay(change.base, local, change.remote, 'remote').value, changedFileNames(change.base, local, change.remote))
        throw pendingConflict
      }
      local = merged.value
    }
    if (!isTauri()) {
      if (write) {
        localStorage.setItem(KEY, JSON.stringify(local));diskWorkspace = local
        for (const world of local.worlds) for (const doc of world.documents) replacements.delete(`${world.id}/${doc.id}`)
      }
      return local
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const base = diskWorkspace || local
      const files = await readFiles(local)
      const remote = decodeDocuments(local, files)
      const merged = mergeThreeWay(base, local, remote)
      diskWorkspace = remote
      diskFiles = files
      if (!sameData(base, remote)) externalChanges.push({ base, remote })
      if (merged.conflicts.length) {
        pendingConflict = new MarkdownConflictError(workspace, merged.value, mergeThreeWay(base, local, remote, 'remote').value, changedFileNames(base, local, remote))
        throw pendingConflict
      }
      local = merged.value
      if (!write) return local
      const output = Object.fromEntries(local.worlds.map(world => [world.id, exportFiles(world)]))
      try {
        await invoke('save_workspace', { workspace: local, files: output, expected: files })
        diskWorkspace = local
        diskFiles = Object.fromEntries(local.worlds.map(world => [world.id, Object.fromEntries(world.documents.map(doc => [doc.fileName, output[world.id][doc.fileName]]))]))
        for (const world of local.worlds) for (const doc of world.documents) replacements.delete(`${world.id}/${doc.id}`)
        return local
      } catch (error) {
        if (!String(error).includes('MARKDOWN_CHANGED')) throw error
      }
    }
    throw new Error('Markdown 正在被其他程序持续修改，本次未覆盖文件；稍后会重新读取。')
  })
}
export const saveWorkspace = (workspace: Workspace) => synchronize(workspace, true)
export const refreshWorkspace = (workspace: Workspace) => synchronize(workspace, false)
export function applySyncResult(submitted: Workspace, current: Workspace, result: Workspace): Workspace {
  const next = mergeThreeWay(submitted, current, result).value
  return sameData(current, next) ? current : next
}
