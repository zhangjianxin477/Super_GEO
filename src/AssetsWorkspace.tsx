import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, BookOpenText, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck,
  ClipboardCopy, ExternalLink, FileCheck2, FileText, Globe2, HelpCircle, Link2, LockKeyhole,
  Mail, PenLine, Plus, Send, ShieldCheck, Sparkles, Target, Trash2, Upload, Users, X,
} from 'lucide-react'
import type { BrandDiagnosticProjectSummary } from './api'

type AssetsWorkspaceProps = {
  go: (screen: string) => void
  notice: (value: string) => void
  project: BrandDiagnosticProjectSummary | null
}

type Asset = {
  id: string
  title: string
  type: string
  description: string
  queries: number
  status: '已审核' | '待补充'
  version: string
  evidence: string
  channels: string[]
  markdown: string
}

type Channel = {
  id: string
  name: string
  group: string
  description: string
  format: string
  icon: typeof Globe2
  accent: string
  href?: string
  internal?: boolean
  recommended?: boolean
  destinationLabel?: string
}

function normalizeExternalUrl(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function loadHiddenChannelIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function loadCustomChannels(storageKey: string): Channel[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) as Array<Partial<Channel>> : []
    return parsed.filter((item) => item.id && item.name && item.group).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      group: String(item.group),
      description: String(item.description || '由你补充的自定义发布入口。'),
      format: String(item.format || '自定义'),
      icon: Link2,
      accent: 'custom',
      href: item.href ? String(item.href) : undefined,
      destinationLabel: item.destinationLabel ? String(item.destinationLabel) : undefined,
    }))
  } catch {
    return []
  }
}

const assets: Asset[] = [
  {
    id: 'selection-guide',
    title: '企业 AI 知识库选型指南',
    type: '选型指南',
    description: '围绕知识图谱、来源可追溯回答与团队协作，整理可被不同渠道复用的核心事实。',
    queries: 3,
    status: '已审核',
    version: 'v1.2',
    evidence: '6 条已审核事实',
    channels: ['官网 Blog', '知乎回答', '掘金'],
    markdown: '# 企业 AI 知识库选型指南\n\n从知识图谱、来源可追溯回答与团队协作三个维度，帮助团队建立可验证的选型标准。\n\n## 选型时重点关注什么？\n\n- 知识是否能够持续更新\n- 回答是否保留来源\n- 团队是否能共同维护内容\n',
  },
  {
    id: 'rag-accuracy',
    title: 'RAG 知识库如何减少幻觉',
    type: '问题解答',
    description: '针对“如何减少幻觉并保留来源”的真实 Query，沉淀解释型内容与引用策略。',
    queries: 2,
    status: '已审核',
    version: 'v1.0',
    evidence: '4 条已审核事实',
    channels: ['帮助中心', '知乎文章', '微信公众号'],
    markdown: '# RAG 知识库如何减少幻觉\n\n减少幻觉不能只依赖模型本身，还需要可检索的来源、清晰的回答边界与持续审核机制。\n',
  },
  {
    id: 'comparison-page',
    title: '知识库工具对比页',
    type: '对比页',
    description: '用于承接竞品 Query 的对比型内容。只保留已验证的事实，不自动生成未经审核的竞品结论。',
    queries: 1,
    status: '待补充',
    version: '草稿',
    evidence: '2 条待审核事实',
    channels: ['官网对比页', 'G2 / Capterra', '行业垂直网站'],
    markdown: '# 知识库工具对比\n\n> 发布前请补充竞品证据，并完成人工事实审核。\n\n| 维度 | 本产品 | 竞品 |\n| --- | --- | --- |\n| 来源可追溯 | 待补充 | 待补充 |\n',
  },
]

const channels: Channel[] = [
  { id: 'website-blog', name: '官网 Blog', group: '自有阵地', description: '长期沉淀指南、事实说明与产品解释。', format: '长文 / 指南', icon: Globe2, accent: 'blue', internal: true, destinationLabel: '打开发布入口', recommended: true },
  { id: 'help-center', name: '帮助中心', group: '自有阵地', description: '发布 FAQ、操作说明与产品使用文档。', format: 'FAQ / 文档', icon: HelpCircle, accent: 'teal', internal: true, destinationLabel: '打开发布入口', recommended: true },
  { id: 'zhihu-answer', name: '知乎回答', group: '问答 / 社区', description: '回答选型、比较和问题解决类真实 Query。', format: '问答', icon: CircleHelp, accent: 'indigo', href: 'https://www.zhihu.com/creator', destinationLabel: '打开发布入口', recommended: true },
  { id: 'zhihu-article', name: '知乎文章', group: '问答 / 社区', description: '把一组共性问题整理成可读的观点文章。', format: '专栏文章', icon: FileText, accent: 'indigo', href: 'https://zhuanlan.zhihu.com/write', destinationLabel: '打开发布入口' },
  { id: 'quora', name: 'Quora', group: '问答 / 社区', description: '适合英文选型问题、行业解释和经验回答。', format: '英文问答', icon: CircleHelp, accent: 'purple', href: 'https://www.quora.com/answer', destinationLabel: '打开发布入口' },
  { id: 'reddit', name: 'Reddit', group: '问答 / 社区', description: '适合在相关 Subreddit 参与讨论并回答真实问题。', format: '社区讨论', icon: Users, accent: 'orange', href: 'https://www.reddit.com/submit', destinationLabel: '打开发布入口' },
  { id: 'wechat', name: '微信公众号', group: '品牌分发', description: '面向已有用户和行业受众发布中文长文。', format: '图文消息', icon: Mail, accent: 'green', href: 'https://mp.weixin.qq.com/', destinationLabel: '打开发布入口', recommended: true },
  { id: 'toutiao', name: '今日头条', group: '品牌分发', description: '适合行业观察、方法论和品牌观点分发。', format: '图文 / 专栏', icon: Send, accent: 'red', href: 'https://mp.toutiao.com/', destinationLabel: '打开发布入口' },
  { id: 'baijiahao', name: '百家号', group: '品牌分发', description: '适合新闻型、知识型和品牌内容分发。', format: '图文 / 视频', icon: FileText, accent: 'orange', href: 'https://baijiahao.baidu.com/builder/rc/home', destinationLabel: '打开发布入口' },
  { id: 'sohu', name: '搜狐号', group: '品牌分发', description: '适合品牌观点、行业观察和媒体分发。', format: '新闻稿 / 观点', icon: Send, accent: 'orange', href: 'https://mp.sohu.com/', destinationLabel: '打开发布入口' },
  { id: 'xiaohongshu', name: '小红书', group: '内容社区', description: '适合清单、经验、场景化内容与产品使用心得。', format: '图文 / 笔记', icon: Sparkles, accent: 'red', href: 'https://creator.xiaohongshu.com/', destinationLabel: '打开发布入口' },
  { id: 'bilibili', name: '哔哩哔哩', group: '内容社区', description: '适合教程、演示、行业解释和视频内容。', format: '视频 / 专栏', icon: FileText, accent: 'cyan', href: 'https://member.bilibili.com/platform/home', destinationLabel: '打开发布入口' },
  { id: 'juejin', name: '掘金', group: '开发者社区', description: '适合技术原理、工程实践和开发者场景内容。', format: '技术文章', icon: PenLine, accent: 'cyan', href: 'https://juejin.cn/editor/drafts', destinationLabel: '打开发布入口', recommended: true },
  { id: 'csdn', name: 'CSDN', group: '开发者社区', description: '适合技术文章、实践教程和开发者问答。', format: '技术文章', icon: BookOpenText, accent: 'blue', href: 'https://mp.csdn.net/mp_blog/manage/article', destinationLabel: '打开发布入口' },
  { id: 'segmentfault', name: 'SegmentFault', group: '开发者社区', description: '适合技术问答、实践文章和开发者交流。', format: '问答 / 文章', icon: CircleHelp, accent: 'teal', href: 'https://segmentfault.com/write', destinationLabel: '打开发布入口' },
  { id: 'github', name: 'GitHub / Pages', group: '开发者 / 产品目录', description: '适合 README、文档、案例和可复用 Markdown。', format: 'README / 文档', icon: BookOpenText, accent: 'slate', href: 'https://github.com/new', destinationLabel: '打开发布入口' },
  { id: 'producthunt', name: 'Product Hunt', group: '开发者 / 产品目录', description: '适合产品发布、更新说明和英文产品介绍。', format: '产品发布', icon: Target, accent: 'orange', href: 'https://www.producthunt.com/posts/new', destinationLabel: '打开发布入口' },
  { id: 'g2', name: 'G2', group: '开发者 / 产品目录', description: '适合企业软件产品资料、客户评价和产品目录。', format: '产品资料', icon: ShieldCheck, accent: 'green', href: 'https://sell.g2.com/', destinationLabel: '打开发布入口' },
  { id: 'medium', name: 'Medium', group: '海外内容', description: '适合英文洞察、方法论和行业长文。', format: '英文长文', icon: FileText, accent: 'slate', href: 'https://medium.com/new-story', destinationLabel: '打开发布入口' },
  { id: 'linkedin', name: 'LinkedIn', group: '海外内容', description: '适合 B2B 观点、产品动态和行业内容。', format: '文章 / 动态', icon: Users, accent: 'blue', href: 'https://www.linkedin.com/article/new/', destinationLabel: '打开发布入口' },
  { id: 'vertical', name: '行业垂直网站', group: '垂直 / 自定义', description: '适合行业媒体、协会、合作伙伴或细分社区。', format: '投稿 / 专栏', icon: Users, accent: 'purple', href: undefined },
]

const channelGroups = ['自有阵地', '问答 / 社区', '品牌分发', '内容社区', '开发者社区', '开发者 / 产品目录', '海外内容', '垂直 / 自定义'] as const

const checklist = [
  '已确认标题与内容形式',
  '已检查事实、引用和官网链接',
  '已删除未经证实的竞品表述',
  '已检查平台格式与 CTA',
  '已人工发布并复制实际 URL',
]

export function AssetsWorkspace({ go, notice, project }: AssetsWorkspaceProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0].id)
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0].id)
  const [activeGroup, setActiveGroup] = useState<(typeof channelGroups)[number]>('自有阵地')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [published, setPublished] = useState(false)
  const customChannelsKey = `geo.assets.custom-channels.v1.${project?.id ?? 'default'}`
  const hiddenChannelsKey = `geo.assets.hidden-channels.v1.${project?.id ?? 'default'}`
  const [customChannels, setCustomChannels] = useState<Channel[]>(() => loadCustomChannels(customChannelsKey))
  const [hiddenChannelIds, setHiddenChannelIds] = useState<string[]>(() => loadHiddenChannelIds(hiddenChannelsKey))
  const persistedCustomChannelsKey = useRef(customChannelsKey)
  const persistedHiddenChannelsKey = useRef(hiddenChannelsKey)
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customGroup, setCustomGroup] = useState<(typeof channelGroups)[number]>('垂直 / 自定义')
  const [publicationUrl, setPublicationUrl] = useState('')
  const [publicationNote, setPublicationNote] = useState('')

  const allChannels = useMemo(() => [
    ...channels.filter((channel) => !hiddenChannelIds.includes(channel.id)),
    ...customChannels,
  ], [customChannels, hiddenChannelIds])

  useEffect(() => {
    // Load the next project's channels before persisting anything into its key.
    // This prevents a project switch from briefly copying the previous project's list.
    if (persistedCustomChannelsKey.current !== customChannelsKey) {
      persistedCustomChannelsKey.current = customChannelsKey
      setCustomChannels(loadCustomChannels(customChannelsKey))
      return
    }
    try {
      window.localStorage.setItem(customChannelsKey, JSON.stringify(customChannels.map(({ id, name, group, description, format, accent, href, destinationLabel }) => ({ id, name, group, description, format, accent, href, destinationLabel }))))
    } catch {
      // Local storage is optional for the prototype.
    }
  }, [customChannels, customChannelsKey])

  useEffect(() => {
    // Keep removed built-in channels scoped to the current project.
    if (persistedHiddenChannelsKey.current !== hiddenChannelsKey) {
      persistedHiddenChannelsKey.current = hiddenChannelsKey
      setHiddenChannelIds(loadHiddenChannelIds(hiddenChannelsKey))
      return
    }
    try {
      window.localStorage.setItem(hiddenChannelsKey, JSON.stringify(hiddenChannelIds))
    } catch {
      // Local storage is optional for the prototype.
    }
  }, [hiddenChannelIds, hiddenChannelsKey])
  const selectedAsset = assets.find((item) => item.id === selectedAssetId) ?? assets[0]
  const selectedChannel = allChannels.find((item) => item.id === selectedChannelId) ?? allChannels[0] ?? channels[0]

  const openChannel = (channel: Channel) => {
    if (channel.internal) {
      notice(`请在当前项目绑定的${channel.name}后台完成发布。原型阶段不自动登录或代发。`)
      return
    }
    if (!channel.href) {
      notice('请先添加该垂直网站的实际发布地址。')
      return
    }
    const safeUrl = normalizeExternalUrl(channel.href)
    if (!safeUrl) {
      notice('该渠道的发布入口无效，请重新编辑渠道地址。')
      return
    }
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }

  const createTask = (channelId = selectedChannelId) => {
    setSelectedChannelId(channelId)
    setPublished(false)
    setDrawerOpen(true)
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard?.writeText(selectedAsset.markdown)
      notice('已复制 Markdown，可粘贴到人工发布平台。')
    } catch {
      notice('复制失败，请手动选择内容资产。')
    }
  }

  const markPublished = () => {
    if (!publicationUrl.trim()) {
      notice('请先填写人工确认后的发布 URL。')
      return
    }
    setPublished(true)
    notice('已登记人工发布，后续可在同一 Query 范围下安排复测。')
  }

  const addCustomChannel = () => {
    const name = customName.trim()
    if (!name) {
      notice('请填写渠道名称。')
      return
    }
    const url = normalizeExternalUrl(customUrl)
    if (customUrl.trim() && !url) {
      notice('请输入以 http:// 或 https:// 开头的有效发布入口。')
      return
    }
    const id = `custom-${Date.now()}`
    setCustomChannels((current) => [...current, { id, name, group: customGroup, description: '由你补充的行业媒体、合作伙伴或私域发布入口。', format: '自定义', icon: Link2, accent: 'custom', href: url, destinationLabel: '打开发布入口' }])
    setSelectedChannelId(id)
    setCustomOpen(false)
    setCustomName('')
    setCustomUrl('')
    setCustomGroup('垂直 / 自定义')
    notice(`已添加“${name}”，现在可以创建人工发布任务。`)
  }

  const removeChannel = (channel: Channel) => {
    if (channel.id.startsWith('custom-')) {
      setCustomChannels((current) => current.filter((item) => item.id !== channel.id))
    } else {
      setHiddenChannelIds((current) => current.includes(channel.id) ? current : [...current, channel.id])
    }
    if (selectedChannelId === channel.id) {
      const nextChannel = allChannels.find((item) => item.id !== channel.id)
      setSelectedChannelId(nextChannel?.id ?? '')
    }
    if (drawerOpen) setDrawerOpen(false)
    notice(`已移除渠道“${channel.name}”。`)
  }

  const restoreBuiltInChannels = () => {
    setHiddenChannelIds([])
    notice('已恢复全部内置渠道。')
  }

  return <div className="assets-page assets-page--channels-first">
    <section className="channels-panel channels-panel--first">
      <div className="channels-panel-head"><div><span className="eyebrow">DISTRIBUTION CHANNELS</span><h3>按类别选择发布入口</h3><p>选择一个渠道后，通过发布入口由你人工投放。渠道可以按项目自定义增减。</p></div><div className="channels-panel-head-actions">{hiddenChannelIds.length > 0 && <button className="secondary" onClick={restoreBuiltInChannels}>恢复内置渠道</button>}<button className="secondary" onClick={() => setCustomOpen(true)}><Plus size={15}/>添加自定义渠道</button></div></div>
      <div className="channel-menu">
        <aside className="channel-menu-nav" aria-label="发布渠道分类"><div className="channel-menu-nav-title">渠道类别</div>{channelGroups.map((group) => { const count = allChannels.filter((channel) => channel.group === group).length; return <button key={group} className={activeGroup === group ? 'active' : ''} onClick={() => setActiveGroup(group)}><span>{group}</span><i>{count}</i><ChevronRight size={14}/></button> })}</aside>
        <div className="channel-menu-content"><div className="channel-menu-heading"><div><span className="eyebrow">{activeGroup.toUpperCase()}</span><h4>{activeGroup}</h4></div><span>{allChannels.filter((channel) => channel.group === activeGroup).length} 个渠道</span></div><div className="channel-menu-list">{allChannels.filter((channel) => channel.group === activeGroup).length > 0 ? allChannels.filter((channel) => channel.group === activeGroup).map((channel) => <ChannelMenuItem key={channel.id} channel={channel} selected={selectedChannelId === channel.id} onSelect={() => setSelectedChannelId(channel.id)} onOpen={() => openChannel(channel)} onCreate={() => createTask(channel.id)} onRemove={() => removeChannel(channel)} />) : <div className="channel-menu-empty"><Trash2 size={18}/><strong>该类别暂时没有渠道</strong><span>可以添加自定义渠道，或恢复已移除的内置渠道。</span></div>}</div></div>
      </div>
    </section>


    {drawerOpen && <PublicationDrawer asset={selectedAsset} channel={selectedChannel} published={published} publicationUrl={publicationUrl} publicationNote={publicationNote} onUrlChange={setPublicationUrl} onNoteChange={setPublicationNote} onClose={() => setDrawerOpen(false)} onCopy={copyMarkdown} onOpen={() => openChannel(selectedChannel)} onPublish={markPublished} />}
    {customOpen && <CustomChannelModal name={customName} url={customUrl} group={customGroup} onNameChange={setCustomName} onUrlChange={setCustomUrl} onGroupChange={setCustomGroup} onClose={() => setCustomOpen(false)} onSave={addCustomChannel} />}
  </div>
}

function AssetDetail({ asset, onCreate, onCopy, onViewQueries }: { asset: Asset; onCreate: () => void; onCopy: () => void; onViewQueries: () => void }) {
  return <article className="asset-detail"><div className="asset-detail-head"><div><span className="eyebrow">SELECTED ASSET</span><h3>{asset.title}</h3><p>{asset.description}</p></div><span className={`status-pill ${asset.status === '已审核' ? 'success' : 'warning'}`}>{asset.status}</span></div><div className="asset-detail-grid"><div className="detail-stat"><b>{asset.queries}</b><span>关联 Query</span></div><div className="detail-stat"><b>{asset.evidence}</b><span>证据状态</span></div><div className="detail-stat"><b>{asset.version}</b><span>内容版本</span></div></div><div className="asset-detail-section"><div className="detail-section-title"><strong>适合的发布场景</strong><span>人工选择渠道</span></div><div className="tag-row">{asset.channels.map((channel) => <span key={channel}>{channel}</span>)}</div></div><div className="asset-detail-section"><div className="detail-section-title"><strong>发布前检查</strong><span>不通过则不建议发布</span></div><ul className="detail-checks"><li><Check size={14}/>事实与来源已绑定到当前项目</li><li><Check size={14}/>内容没有把推断写成产品承诺</li><li><Check size={14}/>发布后可登记实际 URL 并复测</li></ul></div><div className="asset-detail-actions"><button className="primary" onClick={onCreate}><Send size={15}/>创建发布任务</button><button className="secondary" onClick={onCopy}><ClipboardCopy size={15}/>复制 Markdown</button><button className="text-button" onClick={onViewQueries}>查看关联 Query <ArrowUpRight size={14}/></button></div></article>
}

function ChannelMenuItem({ channel, selected, onSelect, onOpen, onCreate, onRemove }: { channel: Channel; selected: boolean; onSelect: () => void; onOpen: () => void; onCreate: () => void; onRemove?: () => void }) {
  const Icon = channel.icon
  return <article className={`channel-menu-item ${selected ? 'selected' : ''}`} onClick={onSelect}><div className={`channel-icon ${channel.accent}`}><Icon size={17}/></div><div className="channel-menu-item-info"><div className="channel-title"><strong>{channel.name}</strong>{channel.recommended && <span>推荐</span>}{channel.id.startsWith('custom-') && <span className="custom-badge">自定义</span>}</div><small>{channel.format}</small><p>{channel.description}</p></div><div className="channel-menu-item-actions"><button className="secondary compact" onClick={(event) => { event.stopPropagation(); onOpen() }}><ExternalLink size={13}/>打开发布入口</button><button className="primary compact" onClick={(event) => { event.stopPropagation(); onCreate() }}><Plus size={13}/>创建任务</button>{onRemove && <button className="icon-button channel-remove" onClick={(event) => { event.stopPropagation(); onRemove() }} aria-label={`删除${channel.name}`} title="删除渠道"><Trash2 size={14}/></button>}</div></article>
}
function PublicationDrawer({ asset, channel, published, publicationUrl, publicationNote, onUrlChange, onNoteChange, onClose, onCopy, onOpen, onPublish }: { asset: Asset; channel: Channel; published: boolean; publicationUrl: string; publicationNote: string; onUrlChange: (value: string) => void; onNoteChange: (value: string) => void; onClose: () => void; onCopy: () => void; onOpen: () => void; onPublish: () => void }) {
  return <div className="modal-layer" role="presentation"><button className="modal-scrim" onClick={onClose} aria-label="关闭发布任务"/><aside className="publication-drawer" aria-label="发布任务面板"><header><div><span className="eyebrow">MANUAL PUBLISHING</span><h3>创建发布任务</h3><p>准备好内容后，由你在平台完成发布。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18}/></button></header><div className="drawer-summary"><div className="drawer-summary-icon"><FileText size={17}/></div><div><strong>{asset.title}</strong><span>{channel.name} · {channel.format}</span></div></div><div className="drawer-section"><div className="drawer-section-title"><strong>人工发布清单</strong><span>发布前逐项确认</span></div><div className="checklist">{checklist.map((item) => <label key={item}><input type="checkbox" defaultChecked={item !== '已人工发布并复制实际 URL'}/><span>{item}</span></label>)}</div></div><div className="drawer-actions"><button className="secondary" onClick={onCopy}><ClipboardCopy size={14}/>复制 Markdown</button><button className="primary" onClick={onOpen}><ExternalLink size={14}/>打开发布入口</button></div><div className="drawer-section"><div className="drawer-section-title"><strong>发布后登记</strong><span>仅记录你确认的真实信息</span></div><label className="form-label">实际发布 URL<input value={publicationUrl} onChange={(event) => onUrlChange(event.target.value)} placeholder="https://..." /></label><label className="form-label">发布备注 <textarea value={publicationNote} onChange={(event) => onNoteChange(event.target.value)} rows={3} placeholder="可记录平台格式、首发时间或需要复测的 Query…" /></label><button className="primary drawer-submit" onClick={onPublish} disabled={published}><CheckCircle2 size={15}/>{published ? '已登记人工发布' : '标记为已发布'}</button></div><div className="drawer-boundary"><ShieldCheck size={15}/><span>系统不会自动提交表单、登录平台或托管第三方账号。</span></div></aside></div>
}

function CustomChannelModal({ name, url, group, onNameChange, onUrlChange, onGroupChange, onClose, onSave }: { name: string; url: string; group: (typeof channelGroups)[number]; onNameChange: (value: string) => void; onUrlChange: (value: string) => void; onGroupChange: (value: (typeof channelGroups)[number]) => void; onClose: () => void; onSave: () => void }) {
  return <div className="modal-layer" role="presentation"><button className="modal-scrim" onClick={onClose} aria-label="关闭自定义渠道"/><div className="custom-channel-modal" role="dialog" aria-modal="true" aria-label="添加自定义渠道"><header><div><span className="eyebrow">CUSTOM CHANNEL</span><h3>添加自定义渠道</h3><p>渠道可以按项目自行增加或移除，不影响内置渠道。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18}/></button></header><label className="form-label">渠道名称<input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="例如：XX 行业媒体" autoFocus /></label><label className="form-label">归属类别<select value={group} onChange={(event) => onGroupChange(event.target.value as (typeof channelGroups)[number])}>{channelGroups.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="form-label">创作 / 发布入口 URL（可选）<input value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder="https://..." /></label><div className="custom-channel-hint"><Link2 size={14}/><span>添加后会出现在对应类别中。系统只保存入口，不会自动投放。</span></div><footer><button className="secondary" onClick={onClose}>取消</button><button className="primary" onClick={onSave}><Plus size={14}/>添加渠道</button></footer></div></div>
}
