import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const safeSegment = (value, label) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, hyphens, or underscores.`)
  }
  return value
}

export class LocalArtifactStore {
  constructor(root) {
    this.root = resolve(root)
    mkdirSync(this.root, { recursive: true })
  }

  putJson(workspaceId, kind, id, payload) {
    const safeWorkspaceId = safeSegment(workspaceId, 'Workspace ID')
    const safeKind = safeSegment(kind, 'Artifact kind')
    const safeId = safeSegment(id, 'Artifact ID')
    const key = join(safeWorkspaceId, safeKind, `${safeId}.json`)
    const path = this.resolveWorkspacePath(safeWorkspaceId, key)
    const serialized = JSON.stringify(payload, null, 2)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, serialized, 'utf8')
    return {
      key: key.replaceAll('\\', '/'),
      checksum: createHash('sha256').update(serialized).digest('hex'),
    }
  }

  getJson(workspaceId, key) {
    const path = this.resolveWorkspacePath(workspaceId, key)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  }

  resolveWorkspacePath(workspaceId, key) {
    const safeWorkspaceId = safeSegment(workspaceId, 'Workspace ID')
    if (typeof key !== 'string' || key.includes('\0')) throw new Error('Artifact key is invalid.')
    const workspaceRoot = resolve(this.root, safeWorkspaceId)
    const target = resolve(this.root, key)
    const boundary = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`
    if (target !== workspaceRoot && !target.startsWith(boundary)) {
      throw new Error('Artifact key is outside the requested workspace.')
    }
    const expectedPrefix = `${safeWorkspaceId}/`
    if (!key.replaceAll('\\', '/').startsWith(expectedPrefix)) throw new Error('Artifact key is outside the requested workspace.')
    const relativeTarget = relative(this.root, target)
    if (relativeTarget.startsWith('..') || resolve(this.root, relativeTarget) !== target) throw new Error('Artifact key is invalid.')
    return target
  }
}