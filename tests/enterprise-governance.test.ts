import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../src/App'
import { demoWorkspace } from '../src/data/demo'
import { AuthorizationError, assertWorkspaceAccess } from '../src/domain/security'
import { assertExtensionExecutable, ExtensionContractError, validateExtension } from '../src/domain/extensions'
import { calculateMetrics, isComparable } from '../src/domain/metrics'

describe('enterprise isolation and roles', () => {
  it('prevents a viewer from modifying a workspace', () => {
    expect(() => assertWorkspaceAccess({ id: 'viewer-1', name: 'Read only', role: 'viewer', workspaceId: demoWorkspace.id }, demoWorkspace, 'workspace:write')).toThrow(AuthorizationError)
  })

  it('denies cross-workspace access even for an administrator', () => {
    expect(() => assertWorkspaceAccess({ id: 'admin-1', name: 'Other tenant', role: 'administrator', workspaceId: 'ws-other' }, demoWorkspace, 'workspace:read')).toThrow('Cross-workspace access is prohibited')
  })
})

describe('extension governance', () => {
  it('rejects incomplete contracts', () => {
    expect(() => validateExtension({ id: 'bad', type: 'model-provider', label: 'Bad connector', inputs: [], outputs: [], requiredRole: 'analyst', locales: [], configured: true, failureBehavior: '' })).toThrow(ExtensionContractError)
  })

  it('fails closed when an extension is not configured', () => {
    const extension = { id: 'research', type: 'workflow-action' as const, label: 'Research', inputs: ['domain'], outputs: ['finding'], requiredRole: 'analyst' as const, locales: ['zh-CN'], configured: false, failureBehavior: 'fail closed' }
    expect(() => assertExtensionExecutable(extension, 'administrator')).toThrow('not configured')
  })

  it('does not allow a viewer to execute analyst extensions', () => {
    const extension = { id: 'provider', type: 'model-provider' as const, label: 'Provider', inputs: ['query'], outputs: ['answer'], requiredRole: 'analyst' as const, locales: ['zh-CN'], configured: true, failureBehavior: 'record failure' }
    expect(() => assertExtensionExecutable(extension, 'viewer')).toThrow('cannot execute')
  })
})

describe('transparent GEO metrics', () => {
  it('excludes failed observations and retains denominator disclosure', () => {
    const run = demoWorkspace.runs.find((item) => item.id === 'run-baseline-cn')!
    const metrics = calculateMetrics(run, demoWorkspace)
    expect(metrics.eligible).toBe(3)
    expect(metrics.exclusions).toBe(1)
    expect(metrics.completed).toBe(2)
    expect(metrics.mentionRate).toBe(67)
  })

  it('only compares runs that preserve approved dataset and market pack', () => {
    const baseline = demoWorkspace.runs.find((item) => item.id === 'run-baseline-cn')!
    const followUp = demoWorkspace.runs.find((item) => item.id === 'run-followup-cn')!
    expect(isComparable(baseline, followUp)).toBe(true)
    expect(isComparable(baseline, { ...followUp, datasetVersion: 2 })).toBe(false)
    expect(isComparable(baseline, { ...followUp, marketPackId: 'market-global' })).toBe(false)
  })
})



describe('diagnostic-first frontend accessibility semantics', () => {
  it('renders a labelled main region, workflow navigation, diagnostic CTA, and platform-boundary disclosure', () => {
    const markup = renderToStaticMarkup(createElement(App))
    expect(markup).toContain('<main id="main-content" tabindex="-1"')
    expect(markup).toContain('aria-label="GEO 诊断工作台主内容"')
    expect(markup).toContain('aria-label="GEO 工作流导航"')
    expect(markup).toContain('aria-label="执行与治理导航"')
    expect(markup).toContain('创建品牌诊断')
    expect(markup).toContain('不自动登录或抓取第三方模型')
  })
})
