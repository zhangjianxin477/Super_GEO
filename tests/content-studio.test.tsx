import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CONTENT_STUDIO_BOUNDARIES, CONTENT_STUDIO_CAPABILITIES, CONTENT_STUDIO_CONTENT_TYPES, CONTENT_STUDIO_TABS, COMMON_GEO_PROMPT, ContentStudio, WRITING_PROMPT_DEFAULTS } from '../src/ContentStudio'

describe('项目化 GEO 内容工作台', () => {
  it('requires a project rather than showing a disconnected writer form', () => {
    const markup = renderToStaticMarkup(createElement(ContentStudio, { go: () => undefined, notice: () => undefined }))
    expect(markup).toContain('先选择一个 GEO 项目')
    expect(markup).toContain('内容策略、事实、Query、真实平台测试与发布记录都必须归属于同一项目。')
  })

  it('declares the project-scoped evidence-first workflow', () => {
    expect(CONTENT_STUDIO_CAPABILITIES).toEqual([
      '从 01 Query 研究带入已验证 Query',
      '按内容类型配置独立 Prompt',
      '先生成大纲，再生成可编辑全文',
      '全文可编辑，并支持 AI 局部修改',
      '重复、幻觉、密度、可读性与相关性初筛',
      '质量通过后导出 Markdown / HTML，发布由人工完成',
    ])
  })


  it('ships the six GEO content types with type-specific prompt contracts', () => {
    expect(CONTENT_STUDIO_CONTENT_TYPES.map(({ label }) => label)).toEqual([
      '品牌介绍类', '项目案例类', '产品说明类', '行业干货类', '评测对比类', 'FAQ 问答类',
    ])
    expect(Object.keys(WRITING_PROMPT_DEFAULTS)).toHaveLength(6)
    expect(Object.values(WRITING_PROMPT_DEFAULTS).every((prompt) => prompt.startsWith(COMMON_GEO_PROMPT))).toBe(true)
    expect(WRITING_PROMPT_DEFAULTS.brand).toContain('## 项目/品牌简介')
    expect(WRITING_PROMPT_DEFAULTS['case-study']).toContain('## 最终成果（使用表格展示量化指标）')
    expect(WRITING_PROMPT_DEFAULTS.product).toContain('## 核心功能详情')
    expect(WRITING_PROMPT_DEFAULTS['how-to']).toContain('## 分步操作指南（How-to，有序列表）')
    expect(WRITING_PROMPT_DEFAULTS.comparison).toContain('## 多维度对比表格（放在靠前位置）')
    expect(WRITING_PROMPT_DEFAULTS.faq).toContain('## 基础概念类问题')
  })

  it('keeps review, publication, and retest boundaries explicit', () => {
    expect(CONTENT_STUDIO_TABS.map(([, label]) => label)).toEqual(['01 Prompt 与写作', '02 质量初筛'])
    expect(CONTENT_STUDIO_BOUNDARIES.task).toContain('当前项目')
    expect(CONTENT_STUDIO_BOUNDARIES.task).toContain('需核验')
    expect(CONTENT_STUDIO_BOUNDARIES.plan).toContain('Prompt 可按内容任务编辑')
    expect(CONTENT_STUDIO_BOUNDARIES.draft).toContain('不能把过程状态表述为已验证的 GEO 结果')
    expect(CONTENT_STUDIO_BOUNDARIES.export).toContain('不自动发布')
    expect(CONTENT_STUDIO_BOUNDARIES.retest).toContain('原始不可变 Query 范围')
  })
})



