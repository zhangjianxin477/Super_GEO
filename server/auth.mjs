const permissions = {
  administrator: ['workspace:read','workspace:write','evidence:approve','dataset:approve','run:execute','content:approve','report:generate','extension:manage'],
  analyst: ['workspace:read','workspace:write','run:execute','report:generate'],
  reviewer: ['workspace:read','evidence:approve','dataset:approve','content:approve','report:generate'],
  viewer: ['workspace:read'],
}
const roleRank = { viewer: 0, analyst: 1, reviewer: 1, administrator: 2 }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function requireWorkspaceMember(repository, request, workspaceId, permission) {
  const declaredWorkspaceId = request.headers['x-workspace-id']
  const userId = request.headers['x-user-id']
  if (!userId || !declaredWorkspaceId) throw new ApiError(401, 'x-user-id and x-workspace-id are required.')
  if (declaredWorkspaceId !== workspaceId) throw new ApiError(403, 'Cross-workspace access is prohibited.')
  const member = repository.getMember(workspaceId, userId)
  if (!member) throw new ApiError(403, 'User is not a member of this workspace.')
  if (!permissions[member.role].includes(permission)) {
    repository.audit({ workspaceId, actorId: userId, action: 'authorization.denied', target: workspaceId, outcome: 'denied', detail: `Role ${member.role} cannot perform ${permission}.` })
    throw new ApiError(403, `Role ${member.role} cannot perform ${permission}.`)
  }
  return member
}

export function requireRole(member, role) {
  if (member.role !== role && member.role !== 'administrator') throw new ApiError(403, `Role ${member.role} cannot perform this administrator-only action.`)
}

export function requireExtensionRole(repository, member, workspaceId, extensionId, requiredRole) {
  if (roleRank[member.role] < roleRank[requiredRole]) {
    repository.audit({ workspaceId, actorId: member.id, action: 'extension.execution.rejected', target: extensionId, outcome: 'denied', detail: `Role ${member.role} is below extension requirement ${requiredRole}.` })
    throw new ApiError(403, `Role ${member.role} cannot execute extension ${extensionId}.`)
  }
}