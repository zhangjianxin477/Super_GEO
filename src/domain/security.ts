import type { Role, User, Workspace } from './models'

const permissionMatrix: Record<Role, string[]> = {
  administrator: ['workspace:read', 'workspace:write', 'evidence:approve', 'run:execute', 'content:approve', 'report:generate', 'extension:manage'],
  analyst: ['workspace:read', 'workspace:write', 'run:execute', 'report:generate'],
  reviewer: ['workspace:read', 'evidence:approve', 'content:approve', 'report:generate'],
  viewer: ['workspace:read'],
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export function assertWorkspaceAccess(user: User, workspace: Workspace, permission: string): void {
  if (user.workspaceId !== workspace.id) {
    throw new AuthorizationError('Cross-workspace access is prohibited.')
  }
  if (!permissionMatrix[user.role].includes(permission)) {
    throw new AuthorizationError(`Role ${user.role} cannot perform ${permission}.`)
  }
}

export function can(user: User, permission: string): boolean {
  return permissionMatrix[user.role].includes(permission)
}
