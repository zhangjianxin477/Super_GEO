import type { ExtensionDescriptor, Role } from './models'

export class ExtensionContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtensionContractError'
  }
}

const roles: Role[] = ['administrator', 'analyst', 'reviewer', 'viewer']

export function validateExtension(descriptor: ExtensionDescriptor): ExtensionDescriptor {
  if (!descriptor.id || !descriptor.label) throw new ExtensionContractError('Extension id and label are required.')
  if (!descriptor.inputs.length || !descriptor.outputs.length) throw new ExtensionContractError('Extensions must declare inputs and outputs.')
  if (!roles.includes(descriptor.requiredRole)) throw new ExtensionContractError('Extension must declare a valid required role.')
  if (!descriptor.locales.length) throw new ExtensionContractError('Extension must declare supported locales.')
  if (!descriptor.failureBehavior) throw new ExtensionContractError('Extension must declare failure behavior.')
  return descriptor
}

export function assertExtensionExecutable(descriptor: ExtensionDescriptor, callerRole: Role): void {
  validateExtension(descriptor)
  if (!descriptor.configured) throw new ExtensionContractError(`${descriptor.label} is not configured.`)
  const authority: Role[] = ['viewer', 'analyst', 'reviewer', 'administrator']
  if (authority.indexOf(callerRole) < authority.indexOf(descriptor.requiredRole)) {
    throw new ExtensionContractError(`Role ${callerRole} cannot execute ${descriptor.label}.`)
  }
}
