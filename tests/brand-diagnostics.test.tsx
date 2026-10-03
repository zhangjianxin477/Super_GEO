// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ launchActionableBrandDiagnostic: vi.fn() }))

vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api')
  return { ...actual, ...api }
})

import { ActionableDiagnosticLauncher } from '../src/ActionableDiagnosticLauncher'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = { workspaceId: 'workspace-1', userId: 'admin-1', userName: '管理员' }
const launchResponse = {
  project: { project: { id: 'project-1' } },
  launchPlan: { state: 'manual-ready' },
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('evidence-first product-project creation', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    api.launchActionableBrandDiagnostic.mockResolvedValue(launchResponse)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('saves real starter questions and never labels estimates as generated evidence', async () => {
    await act(async () => {
      root.render(<ActionableDiagnosticLauncher session={session} onCancel={() => undefined} onCreated={() => undefined} onHarness={() => undefined} />)
    })

    expect(container.textContent).toContain('创建不会运行模型')
    const inputs = container.querySelectorAll('input')
    await act(async () => {
      setInputValue(inputs[0], 'Northstar Knowledge')
      setInputValue(inputs[1], 'https://northstar.example')
    })

    const continueOne = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '继续') as HTMLButtonElement
    await act(async () => { continueOne.click() })
    expect(container.textContent).toContain('从真实用户问题开始')
    expect(container.textContent).toContain('希望 AI 回答的真实问题')
    expect(container.textContent).not.toContain('希望覆盖的提问者')

    const questionField = container.querySelector('textarea[aria-label="希望 AI 回答的真实问题"]') as HTMLTextAreaElement
    await act(async () => {
      setInputValue(questionField, '适合 50 人团队的 AI 知识库有哪些？\nNorthstar Knowledge 和 Notion 有什么区别？')
    })

    const continueTwo = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '继续') as HTMLButtonElement
    await act(async () => { continueTwo.click() })
    expect(container.textContent).toContain('以下均为你刚刚填写的项目范围，不是系统预测，也不是测试结果。')
    expect(container.textContent).toContain('适合 50 人团队的 AI 知识库有哪些？')
    expect(container.textContent).not.toContain('待生成')
    expect(container.textContent).not.toContain('后续可测试')

    const create = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('创建项目并进入 Query 研究')) as HTMLButtonElement
    await act(async () => { create.click(); await Promise.resolve() })
    await settle()

    expect(api.launchActionableBrandDiagnostic).toHaveBeenCalledWith(session, expect.objectContaining({
      brandName: 'Northstar Knowledge',
      audiences: ['待 Query 研究确认'],
      intents: ['适合 50 人团队的 AI 知识库有哪些？', 'Northstar Knowledge 和 Notion 有什么区别？'],
      executionPreference: 'controlled-manual',
    }))
    expect(container.textContent).toContain('项目范围已保存，可以开始 Query 研究')
    expect(container.textContent).not.toContain('80 条候选 Query')
  })
})
