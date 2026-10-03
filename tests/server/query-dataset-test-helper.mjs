export function makePublishableDatasetItems(items) {
  const source = Array.isArray(items) ? items : []
  const missing = Math.max(0, 5 - source.length)
  const padding = Array.from({ length: missing }, (_, index) => ({
    question: `用于测试发布基线的补充 Query ${index + 1} 如何验证 AI 平台可见度？`,
    intent: '能力评估',
    rationale: '补足可发布 Dataset 的最小 Query 数量；不改变测试关注的原始 Query。',
    priority: 'medium',
  }))
  return [...source, ...padding]
}
