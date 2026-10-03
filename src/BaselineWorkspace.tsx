import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Eye,
  FileCheck2,
  History,
  Link2,
  LoaderCircle,
  MonitorCog,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { getWorkspaceSession } from "./BrandDiagnostics";
import { REAL_PLATFORM_CATALOG } from "./platformCatalog";
import {
  activateBaselineQuerySet,
  appendRealSurfaceTestRunPlatforms,
  archiveBaselineQuerySet,
  cancelBrowserAgentBatchStart,
  claimRealSurfaceTask,
  createBaselineQuerySetRevision,
  createBrowserAgentEnrollment,
  createManualBaselineQuerySet,
  createManualBaselineSeedQuery,
  createRealSurfaceTestRun,
  deleteUnusedBaselineQuerySet,
  enableRealSurfacePlatformBrowserAgent,
  generateBaselineQuerySet,
  getBrandDiagnostic,
  publishBaselineQuerySet,
  revokeBrowserAgent,
  startBrowserAgentBatch,
  getLatestRealSurfaceTestRun,
  getQueryGenerationSettings,
  getRealSurfaceTestRun,
  listBaselineQuerySets,
  listBrandDiagnostics,
  listBrowserAgents,
  listQueryGenerationPromptHistory,
  optimizeQueryGenerationPrompt,
  restoreBaselineQuerySet,
  restoreQueryGenerationPrompt,
  retryRealSurfaceTaskWithBrowserAgent,
  resumeBrowserAgentPlatform,
  reviewRealSurfaceObservation,
  submitRealSurfaceObservation,
  updateBaselineQueryCoverageTargets,
  updateBaselineSeedQuery,
  updateQueryGenerationPrompt,
  type BaselineQuerySet,
  type BaselineSeedQuery,
  type BrandDiagnosticDetail,
  type BrandDiagnosticProjectSummary,
  type BrowserAgent,
  type BrowserAgentEnrollment,
  type BrowserAgentStartRequest,
  type ModelProviderConfiguration,
  type QueryCoverageCell,
  type QueryGenerationPrompt,
  type RealSurfaceTask,
  type RealSurfaceTestRun,
  type WorkspaceSession,
} from "./api";

const intentOptions = [
  "品类发现",
  "能力评估",
  "方案比较",
  "问题解决",
  "采购决策",
  "竞品替代",
];
const pageSize = 10;
const platformTaskPageSize = 5;
const requiredPromptVariables = [
  "{{product_profile}}",
  "{{keywords}}",
  "{{intents}}",
  "{{market}}",
  "{{locale}}",
  "{{count}}",
];
type GenerationReceipt = {
  state: "running" | "success" | "failed";
  model: string;
  promptVersion: number | null;
  market: string;
  locale: string;
  count: number;
  intents: string[];
  detail?: string;
};
type QueryResearchView = "list" | "coverage" | "fill";
type QuerySortKey = "default" | "priority" | "status" | "provenance" | "intent";
type QuerySortDirection = "asc" | "desc";

function renderPromptPreview(
  template: string,
  replacements: Record<string, string>,
) {
  return Object.entries(replacements).reduce(
    (value, [token, replacement]) => value.split(token).join(replacement),
    template,
  );
}

function coverageLabels(
  value: string[] | Record<string, number> | null | undefined,
) {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === "string" && item.trim());
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(
      ([label, count]) =>
        label.trim() && Number.isFinite(Number(count)) && Number(count) > 0,
    )
    .map(([label, count]) =>
      Number(count) > 1 ? `${label}（${count}）` : label,
    );
}

function queryTypeLabel(value: string) {
  return (
    (
      {
        "category-discovery": "品类发现",
        "capability-evaluation": "能力评估",
        "solution-comparison": "方案比较",
        "competitor-alternative": "竞品替代",
        "purchase-decision": "采购决策",
        "problem-solving": "问题解决",
        general: "通用问题",
      } as Record<string, string>
    )[value] ?? value
  );
}

function journeyLabel(value: string) {
  return (
    (
      {
        awareness: "认知",
        consideration: "评估",
        decision: "决策",
        support: "使用 / 支持",
      } as Record<string, string>
    )[value] ?? value
  );
}

function intentForQueryType(value: string) {
  return queryTypeLabel(value) === "通用问题"
    ? "品类发现"
    : queryTypeLabel(value);
}

function metadataForIntent(intent: string) {
  return (
    (
      {
        品类发现: {
          queryType: "category-discovery",
          journeyStage: "awareness",
          targetEntityType: "category",
        },
        能力评估: {
          queryType: "capability-evaluation",
          journeyStage: "consideration",
          targetEntityType: "category",
        },
        方案比较: {
          queryType: "solution-comparison",
          journeyStage: "consideration",
          targetEntityType: "competitor",
        },
        竞品替代: {
          queryType: "competitor-alternative",
          journeyStage: "consideration",
          targetEntityType: "competitor",
        },
        采购决策: {
          queryType: "purchase-decision",
          journeyStage: "decision",
          targetEntityType: "category",
        },
        问题解决: {
          queryType: "problem-solving",
          journeyStage: "support",
          targetEntityType: "demand",
        },
      } as Record<
        string,
        { queryType: string; journeyStage: string; targetEntityType: string }
      >
    )[intent] ?? {
      queryType: "category-discovery",
      journeyStage: "awareness",
      targetEntityType: "category",
    }
  );
}

function messageForRun(run: RealSurfaceTestRun | null) {
  if (!run)
    return {
      label: "尚未建立首轮基线",
      detail:
        "先根据产品档案、关键词和意图生成或录入核心问题；审核后创建真实平台测试批次。",
    };
  if (run.state === "baseline_ready")
    return {
      label: "首轮基线已就绪",
      detail:
        "所有采集结果已复核，已自动同步到 03「GEO 诊断与基线」并纳入 T0 指标。",
    };
  if (run.state === "ready_for_review")
    return {
      label: "等待证据复核",
      detail:
        "每个非跳过任务均已提交原始回答；批准后会自动同步到 03 并进入 T0 指标。",
    };
  return {
    label: "正在进行真实平台测试",
    detail: `${run.progress.byState.reviewed || 0}/${run.progress.total} 条任务已复核；Browser Agent 只会在客户本地、已登录并显式启动的受控浏览器中运行。`,
  };
}

function provenanceLabel(provenance: string) {
  if (provenance.startsWith("llm")) return { label: "LLM", className: "llm" };
  if (provenance.startsWith("manual"))
    return { label: "手动", className: "manual" };
  return { label: "模板", className: "template" };
}

function browserAgentStatusLabel(status: BrowserAgent["status"]) {
  return (
    {
      online: "在线可用",
      pending: "等待配对",
      needs_login: "需要重新登录",
      attention: "需要处理",
      offline: "离线",
      revoked: "已撤销",
    } as const
  )[status];
}

// Newer local adapters must remain launchable. The server validates an adapter ID for
// each platform; the UI only enforces the oldest release that supports the current
// browser-agent protocol, instead of pinning every device to one exact patch version.
const BROWSER_AGENT_MINIMUM_RELEASE = "0.3.11";
const MANUAL_ONLY_BROWSER_PLATFORMS = new Set(["文心一言"]);

function isManualOnlyBrowserPlatform(platform: string) {
  return MANUAL_ONLY_BROWSER_PLATFORMS.has(platform);
}

function manualOnlyCollectionReason(platform: string) {
  return platform === "文心一言"
    ? "文心一言当前仅支持人工导入：请在真实平台完成检索后，录入原始回答、引用链接与截图/页面证据。"
    : "该平台当前仅支持人工导入。";
}

function readableTaskReason(reason?: string | null) {
  const technical = String(reason ?? "").trim();
  if (!technical) return null;

  const pageChanged = technical.includes("页面可能已更新") || technical.includes("无法识别可用的发送按钮");
  const looksLikeDebug = technical.startsWith("{") || technical.length > 220 || /"[^"\n]+"\s*:/.test(technical);

  if (pageChanged) {
    return {
      title: "平台页面结构发生变化",
      detail: "系统未能确认当前页面的发送控件。请刷新平台页面后重试；如仍失败，可切换人工录入。",
      technical,
    };
  }

  if (looksLikeDebug) {
    return {
      title: "自动采集未完成",
      detail: "Browser Agent 未能确认本条 Query 已成功提交，当前结果不会计入正式指标。",
      technical,
    };
  }

  return { title: "采集需要处理", detail: technical, technical: null };
}

function parseReleaseVersion(value?: string | null) {
  const match = String(value ?? "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isCompatibleBrowserAgentRelease(value?: string | null) {
  const installed = parseReleaseVersion(value);
  const minimum = parseReleaseVersion(BROWSER_AGENT_MINIMUM_RELEASE);
  if (!installed || !minimum) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (installed[index] > minimum[index]) return true;
    if (installed[index] < minimum[index]) return false;
  }
  return true;
}

function agentReportedVersions(agent: BrowserAgent) {
  const versions = [
    ...new Set(
      agent.adapters.map((adapter) => adapter.version).filter(Boolean),
    ),
  ];
  return versions.length ? versions.join("、") : "未上报版本";
}

function staleAgentGuidance(
  agent: BrowserAgent,
  platform: string,
  reason: string,
) {
  return `${reason} 当前设备上报版本：${agentReportedVersions(agent)}；请关闭所有受控 GEO 浏览器窗口后双击 browser-agent/Start-GEO-Agent.cmd，确认已启动 v${BROWSER_AGENT_MINIMUM_RELEASE} 或更高版本，再刷新本批次。`;
}

function agentPlatformReadiness(agent: BrowserAgent | null, platform: string) {
  if (isManualOnlyBrowserPlatform(platform))
    return {
      agent: null,
      ready: false,
      reason: manualOnlyCollectionReason(platform),
    };
  if (!agent)
    return {
      agent: null,
      ready: false,
      reason: "未检测到在线本地 Agent；请启动并完成设备配对。",
    };
  if (agent.status !== "online")
    return {
      agent,
      ready: false,
      reason: `设备当前为「${browserAgentStatusLabel(agent.status)}」，请先处理登录或本地 Agent 状态。`,
    };
  const adapter = agent.adapters.find((item) => item.platform === platform);
  if (!agent.platforms.includes(platform))
    return {
      agent,
      ready: false,
      reason: staleAgentGuidance(
        agent,
        platform,
        `此设备尚未上报「${platform}」平台能力。`,
      ),
    };
  if (!adapter)
    return {
      agent,
      ready: false,
      reason: staleAgentGuidance(
        agent,
        platform,
        `此设备未登记「${platform}」页面适配器。`,
      ),
    };
  if (!isCompatibleBrowserAgentRelease(adapter.version))
    return {
      agent,
      ready: false,
      reason: staleAgentGuidance(
        agent,
        platform,
        `此设备的「${platform}」适配器为 v${adapter.version || "未知"}，低于最低兼容版本 v${BROWSER_AGENT_MINIMUM_RELEASE}。`,
      ),
    };
  return {
    agent,
    ready: true,
    reason: `可由 ${agent.label} 自动采集（适配器 v${adapter.version}）`,
  };
}

function shortDateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "暂无";
}

function isTestableQuerySet(querySet: BaselineQuerySet) {
  return Boolean(
    !querySet.archivedAt &&
      ["ready_for_test", "locked_for_baseline"].includes(
        querySet.lifecycleStatus,
      ) &&
      querySet.health.approved > 0,
  );
}

function queryDatasetLifecycleLabel(querySet: BaselineQuerySet) {
  if (querySet.archivedAt) return "已归档";
  return (
    {
      draft: "草稿",
      in_review: "审核中",
      ready_for_test: "可测试",
      locked_for_baseline: "基线已冻结",
      superseded: "已替代",
    } as Record<string, string>
  )[querySet.lifecycleStatus] ?? querySet.lifecycleStatus;
}

function queryDatasetMarketLabel(querySet: BaselineQuerySet) {
  return querySet.marketPack === "CN"
    ? "中国 · zh-CN"
    : "美国 · en-US";
}

function browserStartRequestLabel(status: BrowserAgentStartRequest["status"]) {
  return (
    {
      requested: "已发出启动授权",
      acknowledged: "本地 Agent 已确认",
      "launching-browser": "正在打开受控浏览器",
      "waiting-login": "等待浏览器登录或页面就绪",
      running: "正在自动采集",
      completed: "本批次自动采集完成",
      failed: "自动采集启动失败",
      cancelled: "已取消本次自动采集",
      expired: "启动授权已过期",
    } as const
  )[status];
}

function browserStartRequestDetail(request: BrowserAgentStartRequest) {
  if (request.failureReason) return request.failureReason;
  if (request.status === "requested")
    return "系统已通知该设备。本地 Agent 最迟会在数秒内确认并打开专用浏览器。";
  if (request.status === "acknowledged")
    return "本地 Agent 已收到授权，正在准备本次真实网页采集。";
  if (request.status === "launching-browser")
    return `将使用独立的本地 GEO 浏览器 Profile 打开「${request.platform}」，不会读取日常浏览器的 Cookie 或密码。`;
  if (request.status === "waiting-login")
    return "请只在系统自动打开的受控浏览器窗口完成登录、验证码或页面确认；完成后系统会继续本批次。";
  if (request.status === "running")
    return "系统会持续读取进度；浏览器中可见的回答、来源链接和最小化元数据会自动回传。";
  if (request.status === "completed")
    return "本批次的 Browser Agent 任务已全部回传，仍需在系统中复核证据。";
  if (request.status === "expired")
    return "启动授权已过期。请重新点击“启动本地自动采集”。";
  return "本地自动采集已停止；可以查看原因后重新发起。";
}
type CapturedEvidenceLink = {
  url: string;
  title: string;
  visibleText: string;
  sourceType: "answer-citation" | "platform-search-result";
  position: number;
  urlAvailable: boolean;
};

function capturedEvidenceLinks(
  observation: RealSurfaceTask["observation"],
): CapturedEvidenceLink[] {
  const rawLinks = observation?.captureMetadata?.visibleLinks;
  if (!Array.isArray(rawLinks)) return [];
  const seen = new Set<string>();
  return rawLinks.reduce<CapturedEvidenceLink[]>((links, value) => {
    if (!value || typeof value !== "object") return links;
    const item = value as Record<string, unknown>;
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const urlAvailable = /^https?:\/\//i.test(url);
    const sourceType =
      item.sourceType === "platform-search-result"
        ? "platform-search-result"
        : "answer-citation";
    const title = (
      typeof item.title === "string"
        ? item.title
        : typeof item.visibleText === "string"
          ? item.visibleText
          : url
    )
      .trim()
      .slice(0, 320);
    const visibleText = (
      typeof item.visibleText === "string" ? item.visibleText : ""
    )
      .trim()
      .slice(0, 320);
    // Answer citations only have evidentiary value when the platform exposes a direct URL.
    // Search-result entries remain useful even when the page exposes only a visible title.
    if (
      (sourceType === "answer-citation" && !urlAvailable) ||
      (sourceType === "platform-search-result" && !urlAvailable && !title)
    )
      return links;
    const key = `${sourceType}:${urlAvailable ? url : `${title}|${visibleText}`}`;
    if (seen.has(key)) return links;
    seen.add(key);
    links.push({
      url,
      title: title || url,
      visibleText,
      sourceType,
      urlAvailable,
      position:
        typeof item.position === "number" && Number.isFinite(item.position)
          ? item.position
          : links.length + 1,
    });
    return links;
  }, []);
}

function capturedLinkGroups(observation: RealSurfaceTask["observation"]) {
  const links = capturedEvidenceLinks(observation);
  const answerCitations = links.filter(
    (item) => item.sourceType === "answer-citation",
  );
  const platformSearchSources = links.filter(
    (item) => item.sourceType === "platform-search-result",
  );
  // Older captures only persisted an untyped citation array. Keep those readable.
  if (!answerCitations.length && observation?.citations.length) {
    return {
      answerCitations: observation.citations.map((url, index) => ({
        url,
        title: url,
        visibleText: "",
        sourceType: "answer-citation" as const,
        position: index + 1,
        urlAvailable: true,
      })),
      platformSearchSources,
    };
  }
  return { answerCitations, platformSearchSources };
}

function platformSourceStats(observation: RealSurfaceTask["observation"]) {
  const sources = capturedLinkGroups(observation).platformSearchSources;
  const metadata = observation?.captureMetadata;
  const declared =
    metadata &&
    typeof metadata.platformSearchDeclaredCount === "number" &&
    Number.isFinite(metadata.platformSearchDeclaredCount)
      ? Math.max(0, Math.floor(metadata.platformSearchDeclaredCount))
      : 0;
  const visibleCount = sources.length;
  return {
    sources,
    visibleCount,
    declaredCount: declared,
    displayCount: Math.max(visibleCount, declared),
    openableUrlCount: sources.filter((item) => item.urlAvailable).length,
  };
}

function platformSearchKeywords(observation: RealSurfaceTask["observation"]) {
  const raw = observation?.captureMetadata?.platformSearchKeywords;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.reduce<string[]>((keywords, value) => {
    if (typeof value !== "string") return keywords;
    const keyword = value.replace(/\s+/g, " ").trim().slice(0, 220);
    if (!keyword || seen.has(keyword)) return keywords;
    seen.add(keyword);
    keywords.push(keyword);
    return keywords;
  }, []);
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "外部来源";
  }
}

function sourceCaptureNotice(observation: RealSurfaceTask["observation"]) {
  const metadata = observation?.captureMetadata ?? {};
  const version = String(
    observation?.adapterVersion || metadata.adapterVersion || "",
  );
  const legacy = /^0\.1\.(?:[0-5])(?:$|[^0-9])/.test(version);
  const stats = platformSourceStats(observation);
  const attempted = metadata.platformSearchExpansionAttempted === true;
  const expanded = metadata.platformSearchExpansionSucceeded === true;
  const reason =
    typeof metadata.platformSearchExpansionReason === "string"
      ? metadata.platformSearchExpansionReason
      : "";
  if (legacy) {
    return {
      tone: "warning",
      legacy: true,
      text: `这份证据由 Browser Agent v${version || "旧版"} 采集；旧版可能把页面导航误记为搜索来源，且不会展开“参考资料”。请用 v0.1.6 重新采集后再做引用率判断。`,
    };
  }
  if (stats.declaredCount && !stats.openableUrlCount) {
    if (attempted && !expanded)
      return {
        tone: "warning",
        legacy: false,
        text:
          reason ||
          "已尝试展开页面来源，但当前页面没有暴露可读取的来源面板或原始 URL。",
      };
    if (reason) return { tone: "muted", legacy: false, text: reason };
    return {
      tone: "muted",
      legacy: false,
      text: `页面声明参考 ${stats.declaredCount} 篇资料，但当前 DOM 未暴露逐项来源 URL；系统不会推测或补写链接。`,
    };
  }
  return null;
}

export function BaselineWorkspace({
  go,
  mode = "testing",
  activeProjectId = null,
  onProjectChange,
}: {
  go: (target: string) => void;
  mode?: "research" | "testing";
  activeProjectId?: string | null;
  onProjectChange?: (projectId: string | null) => void;
}) {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [projects, setProjects] = useState<BrandDiagnosticProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sets, setSets] = useState<BaselineQuerySet[]>([]);
  const [activeSet, setActiveSet] = useState<BaselineQuerySet | null>(null);
  const [run, setRun] = useState<RealSurfaceTestRun | null>(null);
  const [market, setMarket] = useState<"CN" | "US">("CN");
  const [sourceMode, setSourceMode] = useState<"ai" | "manual">("ai");
  const [count, setCount] = useState(10);
  const [keywords, setKeywords] = useState("");
  const [intents, setIntents] = useState<string[]>(["品类发现", "能力评估"]);
  const [prompt, setPrompt] = useState<QueryGenerationPrompt | null>(null);
  const [promptHistory, setPromptHistory] = useState<QueryGenerationPrompt[]>(
    [],
  );
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [datasetManagerOpen, setDatasetManagerOpen] = useState(false);
  const [datasetManagerFilter, setDatasetManagerFilter] = useState<
    "all" | "active" | "draft" | "archived"
  >("all");
  const [deleteDatasetTarget, setDeleteDatasetTarget] =
    useState<BaselineQuerySet | null>(null);
  const [deleteDatasetConfirmation, setDeleteDatasetConfirmation] = useState("");
  const datasetManagerTriggerRef = useRef<HTMLButtonElement>(null);
  const datasetManagerCloseRef = useRef<HTMLButtonElement>(null);
  const [promptDraftName, setPromptDraftName] = useState("");
  const [promptDraftTemplate, setPromptDraftTemplate] = useState("");
  const [optimizationGoal, setOptimizationGoal] = useState(
    "提升 Query 的自然检索表达、意图覆盖和品牌中立性",
  );
  const [generationReceipt, setGenerationReceipt] =
    useState<GenerationReceipt | null>(null);
  const [researchView, setResearchView] = useState<QueryResearchView>("list");
  const [selectedCoverageCellKey, setSelectedCoverageCellKey] = useState<
    string | null
  >(null);
  const [coverageFillCellKey, setCoverageFillCellKey] = useState<string | null>(
    null,
  );
  const [coverageTargetDraft, setCoverageTargetDraft] = useState("");
  const reviewRef = useRef<HTMLElement>(null);
  const [providers, setProviders] = useState<ModelProviderConfiguration[]>([]);
  const [providerId, setProviderId] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    ...REAL_PLATFORM_CATALOG.CN,
  ]);
  const [appendPlatforms, setAppendPlatforms] = useState<string[]>([]);
  const [browserAgents, setBrowserAgents] = useState<BrowserAgent[]>([]);
  const [selectedBrowserAgentId, setSelectedBrowserAgentId] = useState("");
  const [agentLabel, setAgentLabel] = useState("我的 Windows 浏览器采集代理");
  const [enrollment, setEnrollment] = useState<BrowserAgentEnrollment | null>(
    null,
  );
  const [agentGuideOpen, setAgentGuideOpen] = useState(false);
  const [agentDevicesOpen, setAgentDevicesOpen] = useState(false);
  const [agentEnrollmentOpen, setAgentEnrollmentOpen] = useState(false);
  const [manualDatasetName, setManualDatasetName] =
    useState("核心 Query Dataset");
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualIntent, setManualIntent] = useState("品类发现");
  const [manualPriority, setManualPriority] = useState<
    "high" | "medium" | "low"
  >("high");
  const [manualRationale, setManualRationale] = useState("");
  const [projectDetail, setProjectDetail] =
    useState<BrandDiagnosticDetail | null>(null);
  const [page, setPage] = useState(1);
  const [querySort, setQuerySort] = useState<{
    key: QuerySortKey;
    direction: QuerySortDirection;
  }>({ key: "default", direction: "asc" });
  const [editingQuery, setEditingQuery] = useState<BaselineSeedQuery | null>(
    null,
  );
  const [queryEdit, setQueryEdit] = useState({
    question: "",
    intent: intentOptions[0],
    priority: "medium" as "high" | "medium" | "low",
    rationale: "",
    queryType: "",
    journeyStage: "",
    targetEntityType: "",
    targetEntities: "",
    audienceSegment: "",
    queryGroup: "",
    scenario: "",
    sourceType: "",
    sourceReference: "",
    isBaseline: true,
  });
  const [queryEditAdvancedOpen, setQueryEditAdvancedOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RealSurfaceTask | null>(
    null,
  );
  // Keep the operational view focused: one platform expands at a time while queues remain independent.
  const [activeRunPlatform, setActiveRunPlatform] = useState("");
  const [platformTaskPage, setPlatformTaskPage] = useState(1);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState("");
  const [freshSession, setFreshSession] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  // Platform launches are independent lanes: a request in Kimi must not block DeepSeek.
  const [laneBusyKeys, setLaneBusyKeys] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceViewMode, setEvidenceViewMode] = useState<
    "manual" | "captured"
  >("manual");
  const isResearch = mode === "research";
  const isTesting = mode === "testing";
  const browserTaskStateRef = useRef<
    Record<string, { state: string; agentState?: string }>
  >({});
  const runPollingRef = useRef(false);
  const runRefreshSequenceRef = useRef(0);

  useEffect(() => {
    if (!datasetManagerOpen) return;
    const focusTimer = window.setTimeout(() => datasetManagerCloseRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [datasetManagerOpen]);

  const closeDatasetManager = () => {
    setDatasetManagerOpen(false);
    setDeleteDatasetTarget(null);
    setDeleteDatasetConfirmation("");
    window.setTimeout(() => datasetManagerTriggerRef.current?.focus(), 0);
  };

  const loadProjectQuerySets = async (
    active: WorkspaceSession,
    nextProjectId: string,
  ) => {
    if (!nextProjectId) {
      setSets([]);
      setActiveSet(null);
      setProjectDetail(null);
      return;
    }
    const [result, detailResult] = await Promise.all([
      listBaselineQuerySets(active, nextProjectId),
      getBrandDiagnostic(active, nextProjectId),
    ]);
    setSets(result.querySets);
    const testable = result.querySets.filter(isTestableQuerySet);
    setActiveSet(
      (isTesting
        ? testable.find((item) => item.isActive) ?? testable[0]
        : result.querySets.find((item) => item.isActive && !item.archivedAt) ??
          result.querySets.find((item) => !item.archivedAt) ??
          result.querySets[0]) ??
        null,
    );
    setProjectDetail(detailResult.project);
    setPage(1);
  };

  const loadLatestProjectRun = async (
    active: WorkspaceSession,
    nextProjectId: string,
  ) => {
    if (!nextProjectId) {
      setRun(null);
      return;
    }
    const result = await getLatestRealSurfaceTestRun(active, nextProjectId);
    setRun(result.testRun);
  };

  const loadBrowserAgents = async (active: WorkspaceSession) => {
    try {
      const result = await listBrowserAgents(active);
      const agents = result.agents ?? [];
      setBrowserAgents(agents);
      setSelectedBrowserAgentId((current) =>
        agents.some((agent) => agent.id === current)
          ? current
          : (agents.find((agent) => agent.status === "online")?.id ?? ""),
      );
    } catch {
      // Browser Agent is optional for the initial Query workflow. A temporary
      // device-service failure must not block query generation or the manual fallback.
      setBrowserAgents([]);
      setSelectedBrowserAgentId("");
    }
  };
  const loadGeneratorSettings = async (active: WorkspaceSession) => {
    const result = await getQueryGenerationSettings(active);
    setPrompt(result.prompt);
    setPromptHistory(result.promptHistory ?? [result.prompt]);
    setProviders(result.providers);
    const executable = result.providers.filter(
      (provider) => provider.executable,
    );
    setProviderId((current) =>
      executable.some((provider) => provider.id === current)
        ? current
        : (executable[0]?.id ?? ""),
    );
  };

  const selectProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    onProjectChange?.(nextProjectId || null);
    if (!session) return;
    void loadProjectQuerySets(session, nextProjectId);
    if (isTesting) void loadLatestProjectRun(session, nextProjectId);
  };

  const bootstrap = async () => {
    const active = await getWorkspaceSession();
    setSession(active);
    const setupTasks: Promise<unknown>[] = [listBrandDiagnostics(active)];
    if (isResearch) setupTasks.push(loadGeneratorSettings(active));
    if (isTesting) setupTasks.push(loadBrowserAgents(active));
    const [projectResult] = (await Promise.all(setupTasks)) as [
      Awaited<ReturnType<typeof listBrandDiagnostics>>,
      ...unknown[],
    ];
    setProjects(projectResult.projects);
    const firstProject = projectResult.projects[0]?.id ?? "";
    const initialProjectId = projectResult.projects.some(
      (project) => project.id === activeProjectId,
    )
      ? activeProjectId!
      : firstProject;
    setProjectId(initialProjectId);
    if (!activeProjectId && initialProjectId)
      onProjectChange?.(initialProjectId);
    const projectTasks: Promise<unknown>[] = [
      loadProjectQuerySets(active, initialProjectId),
    ];
    if (isTesting)
      projectTasks.push(loadLatestProjectRun(active, initialProjectId));
    await Promise.all(projectTasks);
    setError("");
  };

  useEffect(() => {
    void (async () => {
      try {
        await bootstrap();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "无法加载首轮基线工作区。",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (
      !session ||
      !activeProjectId ||
      activeProjectId === projectId ||
      !projects.some((project) => project.id === activeProjectId)
    )
      return;
    setProjectId(activeProjectId);
    void loadProjectQuerySets(session, activeProjectId);
    if (isTesting) void loadLatestProjectRun(session, activeProjectId);
  }, [activeProjectId, isTesting, projectId, projects, session]);

  useEffect(() => {
    setSelectedPlatforms([...REAL_PLATFORM_CATALOG[market]]);
  }, [market]);
  // A local Agent advertises its platform capabilities asynchronously after it starts. Keep the
  // dashboard aligned with its heartbeat so an operator never has to manually reload to enable a lane.
  useEffect(() => {
    if (!session || !isTesting) return;
    void loadBrowserAgents(session);
    const refresh = window.setInterval(() => {
      void loadBrowserAgents(session);
    }, 15_000);
    return () => window.clearInterval(refresh);
  }, [isTesting, session?.workspaceId]);
  useEffect(() => {
    setPage(1);
  }, [activeSet?.id]);
  useEffect(() => {
    browserTaskStateRef.current = Object.fromEntries(
      (run?.tasks ?? [])
        .filter((task) => task.executionMode === "browser-agent")
        .map((task) => [
          task.id,
          { state: task.state, agentState: task.agentState },
        ]),
    );
  }, [run]);

  const executableProviders = useMemo(
    () => providers.filter((provider) => provider.executable),
    [providers],
  );
  const selectedProvider = useMemo(
    () =>
      executableProviders.find((provider) => provider.id === providerId) ??
      null,
    [executableProviders, providerId],
  );
  const currentProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );
  const missingPromptVariables = useMemo(
    () =>
      requiredPromptVariables.filter(
        (token) => !promptDraftTemplate.includes(token),
      ),
    [promptDraftTemplate],
  );
  const promptPreview = useMemo(
    () =>
      renderPromptPreview(promptDraftTemplate || prompt?.template || "", {
        "{{product_profile}}": currentProject
          ? [
              `产品：${currentProject.name}`,
              `品牌：${currentProject.brandName}`,
              `官网：${currentProject.website}`,
              `目标人群：${currentProject.audiences.join("、")}`,
              `目标：${currentProject.objective}`,
              `竞品：${projectDetail?.brief?.competitors?.join("、") || projectDetail?.queryScope?.competitorSeeds?.filter((item) => item !== "未指定").join("、") || "未设置"}`,
              `竞品种子词：${projectDetail?.queryScope?.competitorSeeds?.filter((item) => item !== "未指定").join("、") || "未设置"}`,
              `已审核品牌事实：${
                projectDetail?.facts
                  .filter(
                    (fact) =>
                      fact.status === "approved" && !fact.isProhibitedClaim,
                  )
                  .map((fact) => fact.statement)
                  .join("；") || "暂无"
              }`,
            ].join("\n")
          : "请先选择产品档案",
        "{{keywords}}": keywords || "请填写核心关键词",
        "{{intents}}": intents.join("、") || "请至少选择一个意图",
        "{{market}}": market === "CN" ? "中国大陆" : "美国",
        "{{locale}}": market === "CN" ? "zh-CN" : "en-US",
        "{{count}}": String(count),
      }),
    [
      promptDraftTemplate,
      prompt?.template,
      currentProject,
      keywords,
      intents,
      market,
      count,
    ],
  );
  const summary = messageForRun(run);
  // The server always returns health, but retain a safe local fallback for a dataset created before the lifecycle migration.
  const activeSetHealth = activeSet?.health ?? {
    total: activeSet?.queries.length ?? 0,
    approved:
      activeSet?.queries.filter((item) => item.status === "approved").length ??
      0,
    draft:
      activeSet?.queries.filter((item) => item.status === "draft").length ?? 0,
    excluded:
      activeSet?.queries.filter((item) => item.status === "excluded").length ??
      0,
    queryTypes: [],
    journeys: [],
    targets: [],
    recommendations: [],
  };
  const testableQuerySets = useMemo(
    () => sets.filter(isTestableQuerySet),
    [sets],
  );
  const filteredDatasetHistory = useMemo(() => {
    if (datasetManagerFilter === "active")
      return sets.filter((item) => item.isActive && !item.archivedAt);
    if (datasetManagerFilter === "draft")
      return sets.filter(
        (item) => !item.archivedAt && item.lifecycleStatus === "draft",
      );
    if (datasetManagerFilter === "archived")
      return sets.filter((item) => Boolean(item.archivedAt));
    return sets;
  }, [datasetManagerFilter, sets]);
  const approvedCount = activeSetHealth.approved;
  const activeSetReadOnly = Boolean(
    activeSet &&
    ["ready_for_test", "locked_for_baseline", "superseded"].includes(
      activeSet.lifecycleStatus,
    ),
  );
  const datasetReadyForTesting = Boolean(
    activeSet &&
    ["ready_for_test", "locked_for_baseline"].includes(
      activeSet.lifecycleStatus,
    ),
  );
  const aiPreflight = [
    !projectId ? "选择产品档案" : "",
    !keywords.trim() ? "填写核心关键词" : "",
    !intents.length ? "选择至少一个意图" : "",
    !selectedProvider ? "配置并验证模型连接" : "",
  ].filter(Boolean);
  const canPublishDataset = Boolean(
    activeSet &&
    !activeSetReadOnly &&
    activeSetHealth.draft === 0 &&
    activeSetHealth.approved >= 5,
  );
  const publishBlocker = !activeSet
    ? "先创建或生成 Query Dataset。"
    : activeSetReadOnly
      ? "当前版本已发布或冻结；如需变更，请复制为新版本。"
      : activeSetHealth.draft > 0
        ? "仍有 " + activeSetHealth.draft + " 条待审核 Query。"
        : activeSetHealth.approved < 5
          ? "至少需批准 5 条 Query，当前为 " +
            activeSetHealth.approved +
            " 条。"
          : "";
  const coverageQueryTypes = coverageLabels(activeSetHealth.queryTypes);
  const coverageJourneys = coverageLabels(activeSetHealth.journeys);
  const coverageTargets = coverageLabels(activeSetHealth.targets);
  const coverageCells = activeSet?.coverage?.cells ?? [];
  const coverageSummary = activeSet?.coverage?.summary ?? {
    applicableCells: 0,
    coveredCells: 0,
    gapCells: 0,
    missingQueries: 0,
  };
  const selectedCoverageCell = useMemo(
    () =>
      coverageCells.find((cell) => cell.key === selectedCoverageCellKey) ??
      null,
    [coverageCells, selectedCoverageCellKey],
  );
  const coverageFillCell = useMemo(
    () =>
      coverageCells.find((cell) => cell.key === coverageFillCellKey) ?? null,
    [coverageCells, coverageFillCellKey],
  );
  const selectedAutomatedPlatformCount = selectedPlatforms.filter(
    (platform) => !isManualOnlyBrowserPlatform(platform),
  ).length;
  const estimatedTaskCount = approvedCount * selectedPlatforms.length;
  const hasQueryEditChanges = Boolean(
    editingQuery &&
    (queryEdit.question.trim() !== editingQuery.question ||
      queryEdit.intent !== editingQuery.intent ||
      queryEdit.priority !== editingQuery.priority ||
      queryEdit.rationale.trim() !== editingQuery.rationale ||
      queryEdit.queryType.trim() !== editingQuery.queryType ||
      queryEdit.journeyStage.trim() !== editingQuery.journeyStage ||
      queryEdit.targetEntityType.trim() !== editingQuery.targetEntityType ||
      queryEdit.targetEntities
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .join("、") !== editingQuery.targetEntities.join("、") ||
      queryEdit.audienceSegment.trim() !==
        (editingQuery.audienceSegment ?? "") ||
      queryEdit.queryGroup.trim() !== (editingQuery.queryGroup ?? "") ||
      queryEdit.scenario.trim() !== (editingQuery.scenario ?? "") ||
      queryEdit.sourceType.trim() !== editingQuery.sourceType ||
      queryEdit.sourceReference.trim() !==
        (editingQuery.sourceReference ?? "") ||
      queryEdit.isBaseline !== editingQuery.isBaseline),
  );
  const queryEditQuestionLength = queryEdit.question.trim().length;
  const queryEditQuestionValid =
    queryEditQuestionLength >= 8 && queryEditQuestionLength <= 500;
  const queryEditRationaleValid = Boolean(queryEdit.rationale.trim());
  const queryEditCanSave = Boolean(
    editingQuery &&
    hasQueryEditChanges &&
    queryEditQuestionValid &&
    queryEditRationaleValid &&
    queryEdit.intent.trim(),
  );
  const queryEditAdvancedCount = [
    queryEdit.queryType,
    queryEdit.targetEntityType,
    queryEdit.queryGroup,
    queryEdit.targetEntities,
    queryEdit.audienceSegment,
    queryEdit.scenario,
    queryEdit.sourceType,
    queryEdit.sourceReference,
  ].filter((value) => value.trim()).length;
  const queryEditWillReopenReview = Boolean(
    editingQuery &&
    hasQueryEditChanges &&
    (editingQuery.status === "approved" || editingQuery.status === "excluded"),
  );
  const queryEditSaveLabel =
    editingQuery &&
    (editingQuery.status === "approved" || editingQuery.status === "excluded")
      ? "保存并回到待审核"
      : "保存待审核修改";
  const sortedQueries = useMemo(() => {
    const queries = activeSet?.queries ?? [];
    if (querySort.key === "default") return queries;

    const priorityRank: Record<BaselineSeedQuery["priority"], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    const statusRank: Record<BaselineSeedQuery["status"], number> = {
      draft: 0,
      approved: 1,
      excluded: 2,
    };
    const provenanceRank = (value: string) =>
      value.startsWith("llm") ? 0 : value.startsWith("manual") ? 1 : 2;

    return [...queries].sort((left, right) => {
      let comparison = 0;
      if (querySort.key === "priority") {
        comparison = priorityRank[left.priority] - priorityRank[right.priority];
      } else if (querySort.key === "status") {
        comparison = statusRank[left.status] - statusRank[right.status];
      } else if (querySort.key === "provenance") {
        comparison =
          provenanceRank(left.provenance) - provenanceRank(right.provenance);
      } else if (querySort.key === "intent") {
        comparison = left.intent.localeCompare(right.intent, "zh-CN");
      }

      if (comparison === 0) comparison = left.sequence - right.sequence;
      return querySort.direction === "asc" ? comparison : -comparison;
    });
  }, [activeSet, querySort]);
  const pageCount = Math.max(1, Math.ceil(sortedQueries.length / pageSize));
  const visibleQueries = useMemo(
    () => sortedQueries.slice((page - 1) * pageSize, page * pageSize),
    [page, sortedQueries],
  );
  const toggleQuerySort = (key: QuerySortKey) => {
    setPage(1);
    setQuerySort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };
  const selectedBrowserAgent = useMemo(
    () =>
      browserAgents.find((agent) => agent.id === selectedBrowserAgentId) ??
      null,
    [browserAgents, selectedBrowserAgentId],
  );
  const selectedAgentSupportedPlatformCount = selectedBrowserAgent
    ? selectedPlatforms.filter(
        (platform) =>
          selectedBrowserAgent.platforms.includes(platform) &&
          !isManualOnlyBrowserPlatform(platform),
      ).length
    : 0;
  const onlineBrowserAgents = useMemo(
    () => browserAgents.filter((agent) => agent.status === "online"),
    [browserAgents],
  );
  const browserTasks = useMemo(
    () =>
      run?.tasks.filter((task) => task.executionMode === "browser-agent") ?? [],
    [run],
  );
  const platformDisplayOrder = [
    "豆包",
    "元宝",
    "DeepSeek",
    "通义千问",
    "文心一言",
    "智谱清言（GLM）",
    "Kimi",
  ];
  const sortPlatforms = (platforms: string[]) =>
    [...platforms].sort((left, right) => {
      const leftIndex = platformDisplayOrder.indexOf(left);
      const rightIndex = platformDisplayOrder.indexOf(right);
      return (
        (leftIndex < 0 ? platformDisplayOrder.length : leftIndex) -
          (rightIndex < 0 ? platformDisplayOrder.length : rightIndex) ||
        left.localeCompare(right, "zh-CN")
      );
    });
  const browserTaskPlatforms = useMemo(
    () =>
      sortPlatforms([...new Set(browserTasks.map((task) => task.platform))]),
    [browserTasks],
  );
  const allTaskPlatforms = useMemo(
    () =>
      sortPlatforms([
        ...new Set((run?.tasks ?? []).map((task) => task.platform)),
      ]),
    [run],
  );
  const platformCoverage = useMemo(() => {
    if (!run) return [];
    const candidates = selectedBrowserAgent
      ? [
          selectedBrowserAgent,
          ...onlineBrowserAgents.filter(
            (item) => item.id !== selectedBrowserAgent.id,
          ),
        ]
      : onlineBrowserAgents;
    return sortPlatforms([...REAL_PLATFORM_CATALOG[run.marketPack]]).map(
      (platform) => {
        const tasks = run.tasks.filter((task) => task.platform === platform);
        const manualOnly = isManualOnlyBrowserPlatform(platform);
        const manualTasks = tasks.filter(
          (task) => task.executionMode === "controlled-manual",
        );
        const browserPlatformTasks = tasks.filter(
          (task) => task.executionMode === "browser-agent",
        );
        const readiness =
          candidates
            .map((item) => agentPlatformReadiness(item, platform))
            .find((item) => item.ready) ??
          agentPlatformReadiness(
            selectedBrowserAgent ?? onlineBrowserAgents[0] ?? null,
            platform,
          );
        const pendingCount = tasks.filter(
          (task) => !["submitted", "reviewed", "skipped"].includes(task.state),
        ).length;
        const hasFinalEvidence = tasks.some((task) =>
          ["submitted", "reviewed", "skipped"].includes(task.state),
        );
        const request =
          run.startRequests?.find((item) => item.platform === platform) ?? null;
        const state = !tasks.length
          ? "not-added"
          : hasFinalEvidence && pendingCount === 0
            ? "finalized"
            : manualOnly
              ? "manual-only"
              : browserPlatformTasks.length
                ? "browser-queued"
                : readiness.ready
                  ? "manual-ready"
                  : "not-ready";
        return {
          platform,
          tasks,
          manualTasks,
          browserTasks: browserPlatformTasks,
          pendingCount,
          hasFinalEvidence,
          request,
          state,
          manualOnly,
          ...readiness,
        };
      },
    );
  }, [onlineBrowserAgents, run, selectedBrowserAgent]);
  const browserPlatformLanes = useMemo(
    () =>
      browserTaskPlatforms.map((platform) => {
        const tasks = browserTasks.filter((task) => task.platform === platform);
        const candidates = selectedBrowserAgent
          ? [
              selectedBrowserAgent,
              ...onlineBrowserAgents.filter(
                (item) => item.id !== selectedBrowserAgent.id,
              ),
            ]
          : onlineBrowserAgents;
        const readiness =
          candidates
            .map((item) => agentPlatformReadiness(item, platform))
            .find((item) => item.ready) ??
          agentPlatformReadiness(
            selectedBrowserAgent ?? onlineBrowserAgents[0] ?? null,
            platform,
          );
        const agent = readiness.ready ? readiness.agent : null;
        const requests = run?.startRequests ?? [];
        const request =
          requests.find(
            (item) => item.agentId === agent?.id && item.platform === platform,
          ) ??
          requests.find((item) => item.platform === platform) ??
          null;
        return {
          platform,
          tasks,
          agent,
          request,
          pendingCount: tasks.filter((task) =>
            ["unassigned", "claimed"].includes(task.state),
          ).length,
          runningCount: tasks.filter((task) => task.agentState === "running")
            .length,
          capturedCount: tasks.filter((task) => task.agentState === "captured")
            .length,
          humanCount: tasks.filter((task) =>
            ["needs-human", "failed"].includes(task.agentState ?? ""),
          ).length,
          readinessReason: readiness.reason,
        };
      }),
    [
      browserTaskPlatforms,
      browserTasks,
      onlineBrowserAgents,
      run?.startRequests,
      selectedBrowserAgent,
    ],
  );
  const activePlatformTasks = useMemo(
    () =>
      run?.tasks.filter((task) => task.platform === activeRunPlatform) ?? [],
    [activeRunPlatform, run],
  );
  const activePlatformResumableCount = useMemo(() => {
    return activePlatformTasks.filter((task) => {
      if (["submitted", "reviewed", "skipped"].includes(task.state)) return false;
      // Show every unfinished Browser Agent task, including an already queued task.
      // The operator should not have to infer whether a queued task needs a second
      // click; the resume action is idempotent and will reuse it safely.
      if (task.executionMode === "browser-agent") return true;
      return ["failed", "needs-human"].includes(task.agentState ?? "");
    }).length;
  }, [activePlatformTasks]);
  const platformTaskPageCount = Math.max(
    1,
    Math.ceil(activePlatformTasks.length / platformTaskPageSize),
  );
  const visibleActivePlatformTasks = useMemo(() => {
    const start = (platformTaskPage - 1) * platformTaskPageSize;
    return activePlatformTasks.slice(start, start + platformTaskPageSize);
  }, [activePlatformTasks, platformTaskPage]);
  const activePlatformLane = useMemo(
    () =>
      browserPlatformLanes.find(
        (lane) => lane.platform === activeRunPlatform,
      ) ?? null,
    [activeRunPlatform, browserPlatformLanes],
  );
  const activePlatformKey = allTaskPlatforms.join("|");
  useEffect(() => {
    setActiveRunPlatform((current) =>
      allTaskPlatforms.includes(current)
        ? current
        : (allTaskPlatforms[0] ?? ""),
    );
  }, [activePlatformKey]);
  useEffect(() => {
    setPlatformTaskPage(1);
  }, [activeRunPlatform, run?.id]);
  useEffect(() => {
    // Keep the whole Test Run authoritative, not only lanes that currently look like
    // browser-agent work. A failed/needs-human task is deliberately switched to the
    // manual fallback mode, so the old browser-only poller stopped exactly when the
    // operator needed to see the checkpoint change most.
    if (!session || !run || !isTesting) return;
    let cancelled = false;
    const refreshTestRun = async () => {
      if (runPollingRef.current) return;
      runPollingRef.current = true;
      const sequence = ++runRefreshSequenceRef.current;
      try {
        const result = await getRealSurfaceTestRun(session, run.id);
        if (cancelled || sequence !== runRefreshSequenceRef.current) return;
        const previousStates = browserTaskStateRef.current;
        const newlyCaptured = result.testRun.tasks.filter(
          (task) =>
            task.executionMode === "browser-agent" &&
            task.agentState === "captured" &&
            previousStates[task.id]?.agentState !== "captured",
        );
        setRun(result.testRun);
        if (newlyCaptured.length) {
          const first = newlyCaptured[0];
          const evidenceGroups = capturedLinkGroups(first.observation ?? null);
          const citationCount = evidenceGroups.answerCitations.length;
          const searchSourceCount = platformSourceStats(
            first.observation ?? null,
          ).displayCount;
          const remaining = newlyCaptured.length - 1;
          setNotice(
            `「${first.platform}」任务已自动回传原始回答、${citationCount} 条回答内引用与 ${searchSourceCount} 条平台搜索来源${remaining > 0 ? `；另有 ${remaining} 条任务已完成` : ""}。请打开“查看已采集证据”复核。`,
          );
        }
      } catch {
        // A transient refresh failure must not interrupt an in-progress local browser capture.
      } finally {
        runPollingRef.current = false;
      }
    };
    void refreshTestRun();
    const timer = window.setInterval(() => {
      void refreshTestRun();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isTesting, session, run?.id]);
  const hasApprovedDataset = datasetReadyForTesting;
  const canCreateRun = Boolean(
    datasetReadyForTesting && selectedPlatforms.length,
  );
  const testRunGate = !activeSet
    ? "请先建立并审核一套 Query Dataset。"
    : !datasetReadyForTesting
      ? activeSet.lifecycleStatus === "in_review" ||
        activeSet.lifecycleStatus === "draft"
        ? `先发布 Query Dataset：当前已批准 ${approvedCount} / ${activeSetHealth.total} 条，且不能保留待审核问题。`
        : "当前 Dataset 不能进入真实平台测试；请复制为新版本后处理。"
      : !selectedPlatforms.length
        ? "请至少选择一个真实 AI 平台。"
        : "";
  const taskGroups = useMemo(
    () =>
      run
        ? {
            todo: run.tasks.filter((item) =>
              ["unassigned", "claimed", "needs_revision"].includes(item.state),
            ),
            review: run.tasks.filter((item) => item.state === "submitted"),
            done: run.tasks.filter((item) => item.state === "reviewed"),
          }
        : null,
    [run],
  );

  const execute = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作未完成，请重试。");
    } finally {
      setBusy("");
    }
  };

  // Browser Agent work is safe to run across platforms, but every platform gets its own
  // busy key so a Kimi launch never disables a DeepSeek/Doubao lane in the UI.
  const executeLane = async (key: string, action: () => Promise<void>) => {
    setLaneBusyKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "平台启动失败，请稍后重试。",
      );
    } finally {
      setLaneBusyKeys((current) => current.filter((item) => item !== key));
    }
  };

  const refreshQuerySets = async (preferredQuerySetId?: string) => {
    if (!session || !projectId) return;
    const result = await listBaselineQuerySets(session, projectId);
    const testable = result.querySets.filter(isTestableQuerySet);
    setSets(result.querySets);
    setActiveSet(
      result.querySets.find((item) => item.id === preferredQuerySetId) ??
        (isTesting
          ? testable.find((item) => item.isActive) ?? testable[0]
          : result.querySets.find((item) => item.isActive && !item.archivedAt) ??
            result.querySets.find((item) => !item.archivedAt) ??
            result.querySets[0]) ??
        null,
    );
    setPage(1);
  };

  const archiveDataset = (dataset: BaselineQuerySet) =>
    execute(`archive-dataset-${dataset.id}`, async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      await archiveBaselineQuerySet(session, dataset.id);
      await refreshQuerySets();
      setNotice(`已归档「${dataset.name}」；历史测试、诊断和报告保持不变。`);
    });

  const restoreDataset = (dataset: BaselineQuerySet) =>
    execute(`restore-dataset-${dataset.id}`, async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      await restoreBaselineQuerySet(session, dataset.id);
      await refreshQuerySets(dataset.id);
      setNotice(`已恢复「${dataset.name}」；如需用于后续测试，请设为当前版本。`);
    });

  const activateDataset = (dataset: BaselineQuerySet) =>
    execute(`activate-dataset-${dataset.id}`, async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      await activateBaselineQuerySet(session, dataset.id);
      await refreshQuerySets(dataset.id);
      setNotice(`「${dataset.name}」已设为当前使用中的 Dataset。`);
    });

  const deleteDataset = () =>
    execute("delete-dataset", async () => {
      if (!session || !deleteDatasetTarget) return;
      await deleteUnusedBaselineQuerySet(
        session,
        deleteDatasetTarget.id,
        deleteDatasetConfirmation,
      );
      const deletedName = deleteDatasetTarget.name;
      setDeleteDatasetTarget(null);
      setDeleteDatasetConfirmation("");
      await refreshQuerySets();
      setNotice(`已永久删除未使用草稿「${deletedName}」。`);
    });

  const applyQuerySet = (querySet: BaselineQuerySet) => {
    setActiveSet(querySet);
    setSets((current) => [
      querySet,
      ...current.filter((item) => item.id !== querySet.id),
    ]);
  };

  const createQueries = (generator: "llm" | "template") => {
    const parsedKeywords = keywords
      .split(/[，,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const marketLabel = market === "CN" ? "中国大陆" : "美国";
    const locale = market === "CN" ? "zh-CN" : "en-US";
    const targetCell = coverageFillCell;
    const modelLabel =
      generator === "llm"
        ? selectedProvider
          ? `${selectedProvider.providerId} · ${selectedProvider.execution?.modelName || "已验证模型"}`
          : "尚未选择已验证模型"
        : "模板草案（不调用模型）";
    const promptVersion =
      generator === "llm" ? (prompt?.version ?? null) : null;
    const showPreflightFailure = (detail: string) => {
      setBusy("");
      setError("");
      setNotice("");
      setGenerationReceipt({
        state: "failed",
        model: modelLabel,
        promptVersion,
        market: marketLabel,
        locale,
        count,
        intents,
        detail,
      });
    };

    if (!session || !projectId) {
      showPreflightFailure(
        "请先在“项目概览与产品档案”中创建并选择一个项目，再生成 Query。",
      );
      return;
    }
    if (targetCell && !activeSet) {
      showPreflightFailure(
        "覆盖地图补齐必须基于当前项目已有的 Query Dataset。",
      );
      return;
    }
    if (targetCell && generator !== "llm") {
      showPreflightFailure(
        "覆盖缺口必须通过已验证模型补齐，不能用模板草案伪装为 AI 生成。",
      );
      return;
    }
    if (generator === "llm" && !providerId) {
      showPreflightFailure("请先配置并验证 Query 生成模型，然后再调用 LLM。");
      return;
    }
    if (!parsedKeywords.length) {
      showPreflightFailure(
        "请填写至少一个核心关键词；它会与产品档案、意图一起进入模型 Prompt。",
      );
      return;
    }
    if (!intents.length) {
      showPreflightFailure("请至少选择一个 Query 意图后再生成。");
      return;
    }

    return execute(`generate-${generator}`, async () => {
      setGenerationReceipt({
        state: "running",
        model: modelLabel,
        promptVersion,
        market: marketLabel,
        locale,
        count,
        intents,
      });
      try {
        let writableSet = activeSet;
        if (targetCell && activeSetReadOnly && activeSet) {
          const revision = await createBaselineQuerySetRevision(
            session,
            activeSet.id,
          );
          writableSet = revision.querySet;
          applyQuerySet(writableSet);
        }
        const result = await generateBaselineQuerySet(session, projectId, {
          marketPack: market,
          count,
          generator,
          keywords: parsedKeywords,
          intents,
          providerConfigurationId: generator === "llm" ? providerId : null,
          promptId: prompt?.id ?? null,
          querySetId: targetCell ? (writableSet?.id ?? null) : null,
          coverageCell: targetCell
            ? {
                queryType: targetCell.queryType,
                journeyStage: targetCell.journeyStage,
              }
            : null,
        });
        applyQuerySet(result.querySet);
        setPage(1);
        const generatedCount = targetCell
          ? Math.max(
              0,
              result.querySet.queries.length -
                (writableSet?.queries.length ?? 0),
            )
          : result.querySet.queries.length;
        const elapsedLabel = result.generation?.elapsedMs
          ? `，耗时 ${Math.max(1, Math.round(result.generation.elapsedMs / 1000))} 秒`
          : "";
        setGenerationReceipt({
          state: "success",
          model: result.generation?.model || modelLabel,
          promptVersion: result.generation?.promptVersion ?? promptVersion,
          market: marketLabel,
          locale,
          count,
          intents,
          detail: targetCell
            ? `已向「${queryTypeLabel(targetCell.queryType)} × ${journeyLabel(targetCell.journeyStage)}」追加 ${generatedCount} 条 Query${elapsedLabel}，现已进入审核队列。`
            : `已生成 ${generatedCount} 条 Query${elapsedLabel}，现已进入审核队列。`,
        });
        setNotice(
          targetCell
            ? `已使用真实 LLM 调用补齐「${queryTypeLabel(targetCell.queryType)} × ${journeyLabel(targetCell.journeyStage)}」，请在 Query 列表中审核新增草案。`
            : (result.generation?.label ??
                (generator === "llm"
                  ? `已调用模型生成 ${generatedCount} 条 Query 草案。`
                  : `已生成 ${generatedCount} 条模板草案（未调用模型）。`)),
        );
        if (targetCell) {
          setCoverageFillCellKey(null);
          setResearchView("list");
        }
        window.setTimeout(
          () =>
            reviewRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          50,
        );
      } catch (cause) {
        const detail =
          cause instanceof Error
            ? cause.message
            : "生成失败，请检查模型连接或 Prompt 后重试。";
        setGenerationReceipt({
          state: "failed",
          model: modelLabel,
          promptVersion,
          market: marketLabel,
          locale,
          count,
          intents,
          detail,
        });
        throw cause;
      }
    });
  };

  const openPromptManager = async () => {
    setPromptDraftName(prompt?.name ?? "核心 Query 生成 Prompt");
    setPromptDraftTemplate(prompt?.template ?? "");
    setPromptManagerOpen(true);
    if (!session) return;
    try {
      const result = await listQueryGenerationPromptHistory(session);
      setPromptHistory(result.prompts);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法加载 Prompt 版本历史。",
      );
    }
  };

  const savePrompt = () =>
    execute("save-prompt", async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      if (!promptDraftName.trim())
        throw new Error("请为 Prompt 填写一个名称。");
      if (missingPromptVariables.length)
        throw new Error(
          `Prompt 缺少必填变量：${missingPromptVariables.join("、")}。`,
        );
      const result = await updateQueryGenerationPrompt(session, {
        name: promptDraftName.trim(),
        template: promptDraftTemplate.trim(),
      });
      setPrompt(result.prompt);
      setPromptDraftName(result.prompt.name);
      setPromptDraftTemplate(result.prompt.template);
      const history = await listQueryGenerationPromptHistory(session);
      setPromptHistory(history.prompts);
      setNotice(
        `Prompt 已保存为 v${result.prompt.version}；下一次 LLM 生成将使用该版本。`,
      );
    });

  const restorePrompt = (historic: QueryGenerationPrompt) =>
    execute(`restore-prompt-${historic.id}`, async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      const result = await restoreQueryGenerationPrompt(session, historic.id);
      setPrompt(result.prompt);
      setPromptDraftName(result.prompt.name);
      setPromptDraftTemplate(result.prompt.template);
      const history = await listQueryGenerationPromptHistory(session);
      setPromptHistory(history.prompts);
      setNotice(
        `已将 v${historic.version} 恢复为新的当前版本 v${result.prompt.version}。`,
      );
    });

  const optimizePrompt = () =>
    execute("optimize-prompt", async () => {
      if (!session || !providerId)
        throw new Error("请先选择并验证 Query 生成模型后再请求优化建议。");
      if (!promptDraftTemplate.trim())
        throw new Error("请先输入待优化的 Prompt。");
      const result = await optimizeQueryGenerationPrompt(session, {
        providerConfigurationId: providerId,
        goal: optimizationGoal,
        name: promptDraftName,
        template: promptDraftTemplate,
      });
      setPromptDraftTemplate(result.suggestion);
      setNotice(`已获得 ${result.model} 的优化建议；请审核后再保存为新版本。`);
    });

  const updateQuery = (
    queryId: string,
    status: "draft" | "approved" | "excluded",
  ) =>
    execute(`query-${queryId}`, async () => {
      if (!session || !activeSet) return;
      const result = await updateBaselineSeedQuery(
        session,
        activeSet.id,
        queryId,
        { status },
      );
      applyQuerySet(result.querySet);
      const remaining = Math.ceil(result.querySet.queries.length / pageSize);
      if (page > remaining) setPage(Math.max(1, remaining));
      setNotice(
        status === "approved"
          ? "Query 已批准，可进入真实平台测试批次。"
          : status === "excluded"
            ? "Query 已排除，不会进入覆盖地图或后续真实平台测试。"
            : "Query 已恢复审核，请复核后再批准。",
      );
    });

  const openQueryEditor = (query: BaselineSeedQuery) => {
    setEditingQuery(query);
    setQueryEditAdvancedOpen(false);
    setQueryEdit({
      question: query.question,
      intent: query.intent,
      priority: query.priority,
      rationale: query.rationale,
      queryType: query.queryType || "",
      journeyStage: query.journeyStage || "",
      targetEntityType: query.targetEntityType || "",
      targetEntities: query.targetEntities.join("、"),
      audienceSegment: query.audienceSegment || "",
      queryGroup: query.queryGroup || "",
      scenario: query.scenario || "",
      sourceType: query.sourceType || "",
      sourceReference: query.sourceReference || "",
      isBaseline: query.isBaseline !== false,
    });
  };

  const saveQueryEdit = () =>
    execute(`edit-query-${editingQuery?.id ?? ""}`, async () => {
      if (!session || !activeSet || !editingQuery) return;
      const question = queryEdit.question.trim();
      const rationale = queryEdit.rationale.trim();
      if (question.length < 8 || question.length > 500)
        throw new Error("Query 长度必须在 8 到 500 字符之间。");
      if (!queryEdit.intent.trim())
        throw new Error("请为 Query 选择一个意图。");
      if (!rationale) throw new Error("请说明该问题为什么值得测试。");
      const result = await updateBaselineSeedQuery(
        session,
        activeSet.id,
        editingQuery.id,
        {
          question,
          intent: queryEdit.intent,
          priority: queryEdit.priority,
          rationale,
          queryType: queryEdit.queryType,
          journeyStage: queryEdit.journeyStage,
          targetEntityType: queryEdit.targetEntityType,
          targetEntities: queryEdit.targetEntities
            .split(/[，,\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
          audienceSegment: queryEdit.audienceSegment,
          queryGroup: queryEdit.queryGroup,
          scenario: queryEdit.scenario,
          sourceType: queryEdit.sourceType,
          sourceReference: queryEdit.sourceReference,
          isBaseline: queryEdit.isBaseline,
        },
      );
      applyQuerySet(result.querySet);
      setEditingQuery(null);
      setNotice(
        "Query 已保存，并已回到待审核状态；请再次批准后再进入真实平台测试。",
      );
    });

  const publishDataset = () =>
    execute("publish-dataset", async () => {
      if (!session || !activeSet) return;
      const result = await publishBaselineQuerySet(session, activeSet.id);
      applyQuerySet(result.querySet);
      setNotice(
        `Dataset v${result.querySet.version} 已发布为测试版本；02 可创建真实平台测试。`,
      );
    });

  const createDatasetRevision = () =>
    execute("create-dataset-revision", async () => {
      if (!session || !activeSet) return;
      const result = await createBaselineQuerySetRevision(
        session,
        activeSet.id,
      );
      applyQuerySet(result.querySet);
      setNotice(
        `已从 v${activeSet.version} 复制出新的草稿版本，可继续编辑和补充 Query。`,
      );
    });

  const openCoverageCell = (cell: QueryCoverageCell) => {
    setSelectedCoverageCellKey(cell.key);
    setCoverageTargetDraft(String(cell.target));
  };

  const beginCoverageFill = (
    cell: QueryCoverageCell,
    nextSourceMode: "ai" | "manual",
  ) => {
    if (cell.state === "not-applicable") return;
    setSelectedCoverageCellKey(cell.key);
    setCoverageFillCellKey(cell.key);
    setCoverageTargetDraft(String(cell.target));
    setMarket(activeSet?.marketPack ?? market);
    setCount(Math.max(1, cell.gap || 1));
    const intent = intentForQueryType(cell.queryType);
    setIntents([intent]);
    setManualIntent(intent);
    setSourceMode(nextSourceMode);
    setResearchView("fill");
  };

  const saveCoverageTarget = () =>
    execute("save-coverage-target", async () => {
      if (!session || !activeSet || !selectedCoverageCell) return;
      if (activeSetReadOnly)
        throw new Error(
          "当前版本已发布、冻结或已替代。请先复制为新版本后再调整覆盖目标。",
        );
      const nextTarget = Number(coverageTargetDraft);
      if (!Number.isInteger(nextTarget) || nextTarget < 0 || nextTarget > 200)
        throw new Error(
          "目标数量必须是 0 到 200 之间的整数；0 表示该格不适用。",
        );
      const result = await updateBaselineQueryCoverageTargets(
        session,
        activeSet.id,
        {
          ...activeSet.coverageTargets,
          [selectedCoverageCell.key]: nextTarget,
        },
      );
      applyQuerySet(result.querySet);
      setCoverageTargetDraft(String(nextTarget));
      setNotice(
        nextTarget === 0
          ? `已将「${queryTypeLabel(selectedCoverageCell.queryType)} × ${journeyLabel(selectedCoverageCell.journeyStage)}」标记为不适用。`
          : "覆盖目标已保存到当前 Dataset 版本。",
      );
    });

  const addManualQuery = () =>
    execute("add-manual", async () => {
      if (!session || !projectId)
        throw new Error("请先在产品档案中创建并选择一个项目。");
      const targetCell = coverageFillCell;
      const metadata = metadataForIntent(manualIntent);
      const payload = {
        question: manualQuestion,
        intent: targetCell
          ? intentForQueryType(targetCell.queryType)
          : manualIntent,
        priority: manualPriority,
        rationale: manualRationale,
        queryType: targetCell ? targetCell.queryType : metadata.queryType,
        journeyStage: targetCell
          ? targetCell.journeyStage
          : metadata.journeyStage,
        targetEntityType: targetCell ? "category" : metadata.targetEntityType,
        targetEntities: [],
        sourceType: "manual",
        sourceReference: targetCell
          ? `覆盖地图：${queryTypeLabel(targetCell.queryType)} × ${journeyLabel(targetCell.journeyStage)}`
          : "人工录入",
        isBaseline: true,
      };
      if (!activeSet) {
        const result = await createManualBaselineQuerySet(session, projectId, {
          name: manualDatasetName.trim() || "核心 Query Dataset",
          marketPack: market,
          ...payload,
        });
        applyQuerySet(result.querySet);
        setManualQuestion("");
        setManualRationale("");
        setPage(1);
        setNotice("已创建首个手动 Query Dataset，并加入第一条待审核 Query。");
        return;
      }
      const writableSet = activeSetReadOnly
        ? (await createBaselineQuerySetRevision(session, activeSet.id)).querySet
        : activeSet;
      const result = await createManualBaselineSeedQuery(
        session,
        writableSet.id,
        payload,
      );
      applyQuerySet(result.querySet);
      setManualQuestion("");
      setManualRationale("");
      setPage(
        Math.max(1, Math.ceil(result.querySet.queries.length / pageSize)),
      );
      if (targetCell) {
        setCoverageFillCellKey(null);
        setResearchView("list");
      }
      setNotice(
        targetCell
          ? `已向「${queryTypeLabel(targetCell.queryType)} × ${journeyLabel(targetCell.journeyStage)}」添加手动 Query，等待审核。`
          : activeSetReadOnly
            ? "已复制为新版本并加入手动 Query，等待审核后可重新发布。"
            : "手动 Query 已加入当前集合，等待审核后即可发布。",
      );
    });

  const createTestRun = () =>
    execute("create-run", async () => {
      if (!session || !activeSet || !projectId) return;
      const result = await createRealSurfaceTestRun(session, projectId, {
        querySetId: activeSet.id,
        marketPack: market,
        platforms: selectedPlatforms,
        browserAgentId: selectedBrowserAgent?.id ?? null,
      });
      setRun(result.testRun);
      const browserCount = result.testRun.tasks.filter(
        (task) => task.executionMode === "browser-agent",
      ).length;
      const manualCount = result.testRun.tasks.length - browserCount;
      await loadBrowserAgents(session);
      setNotice(
        browserCount && selectedBrowserAgent
          ? `已创建 ${result.testRun.tasks.length} 条测试任务：${browserCount} 条已锁定到设备「${selectedBrowserAgent.label}」的当前批次，旧批次的排队任务不会混入；${manualCount} 条人工兜底。现在可在下方点击“启动本地自动采集”；系统会唤醒本地 Agent、打开专用浏览器并自动执行。`
          : `已创建 ${result.testRun.tasks.length} 条测试任务：${browserCount} 条等待 Browser Agent，${manualCount} 条人工兜底。`,
      );
    });

  const appendPlatformsToRun = () =>
    execute("append-run-platforms", async () => {
      if (!session || !run) return;
      if (!appendPlatforms.length)
        throw new Error("请至少选择一个要追加的平台。");
      const automatedPlatforms = appendPlatforms.filter(
        (platform) => !isManualOnlyBrowserPlatform(platform),
      );
      const compatibleAgent = !automatedPlatforms.length
        ? null
        : selectedBrowserAgent?.status === "online" &&
            automatedPlatforms.every(
              (platform) =>
                selectedBrowserAgent.platforms.includes(platform) &&
                selectedBrowserAgent.adapters.some(
                  (adapter) => adapter.platform === platform,
                ),
            )
          ? selectedBrowserAgent
          : onlineBrowserAgents.find((agent) =>
              automatedPlatforms.every(
                (platform) =>
                  agent.platforms.includes(platform) &&
                  agent.adapters.some(
                    (adapter) => adapter.platform === platform,
                  ),
              ),
            );
      if (automatedPlatforms.length && !compatibleAgent)
        throw new Error(
          "没有一台在线 Browser Agent 同时支持所选自动采集平台。请在本地 Agent 中完成平台登录并确认对应适配器已就绪。",
        );
      const result = await appendRealSurfaceTestRunPlatforms(session, run.id, {
        platforms: appendPlatforms,
        browserAgentId: compatibleAgent?.id ?? null,
      });
      setRun(result.testRun);
      if (compatibleAgent) setSelectedBrowserAgentId(compatibleAgent.id);
      setAppendPlatforms([]);
      setNotice(
        "已将 " +
          result.addedPlatforms.join("、") +
          " 追加到本次测试。系统复用了同一份冻结 Query 集，不会重跑或覆盖已完成的平台结果；现在可分别启动新增平台。",
      );
    });

  const refreshRunAfterLaneAction = async (
    activeSession: WorkspaceSession,
    runId: string,
    fallback: RealSurfaceTestRun,
  ) => {
    // Concurrent platform starts can return snapshots from different points in time.
    // Read the authoritative aggregate after each lane action rather than overwriting
    // a just-updated Kimi/DeepSeek lane with an older response snapshot.
    try {
      const latest = await getRealSurfaceTestRun(activeSession, runId);
      setRun(latest.testRun);
    } catch {
      setRun(fallback);
    }
  };

  const startLocalBrowserBatch = (platform: string) =>
    executeLane(`start-local-browser-batch-${platform}`, async () => {
      if (!session || !run) return;
      const compatibleAgent =
        selectedBrowserAgent?.status === "online" &&
        selectedBrowserAgent.platforms.includes(platform)
          ? selectedBrowserAgent
          : onlineBrowserAgents.find((agent) =>
              agent.platforms.includes(platform),
            );
      if (!compatibleAgent)
        throw new Error(
          `没有在线且支持「${platform}」的本地 Browser Agent。请先启动本地 Agent 并完成该平台的受控浏览器登录。`,
        );
      const result = await startBrowserAgentBatch(session, run.id, {
        browserAgentId: compatibleAgent.id,
        platform,
      });
      await refreshRunAfterLaneAction(session, run.id, result.testRun);
      setSelectedBrowserAgentId(compatibleAgent.id);
      setNotice(
        `已向「${compatibleAgent.label}」发送 ${platform} 本地自动采集授权。该平台会使用独立浏览器 Profile 串行执行；已启动的其他平台不会被刷新、清空或取消。`,
      );
    });

  const cancelLocalBrowserBatch = (request: BrowserAgentStartRequest) =>
    executeLane(`cancel-local-browser-batch-${request.platform}`, async () => {
      if (!session || !run) return;
      const result = await cancelBrowserAgentBatchStart(
        session,
        run.id,
        request.id,
      );
      await refreshRunAfterLaneAction(session, run.id, result.testRun);
      setNotice(
        `已取消「${request.platform}」本地自动采集授权；其他平台的窗口、任务和已回传证据不会受影响。`,
      );
    });
  const createAgentEnrollment = () =>
    execute("create-agent-enrollment", async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      const result = await createBrowserAgentEnrollment(session, {
        label: agentLabel.trim(),
        platforms: selectedPlatforms,
      });
      setEnrollment(result);
      await loadBrowserAgents(session);
      setSelectedBrowserAgentId(result.agent.id);
      setNotice(
        "已生成一次性配对码。请在客户本地 Browser Agent 中粘贴；配对码仅显示本次，15 分钟后失效。",
      );
    });

  const revokeAgent = (agent: BrowserAgent) =>
    execute(`revoke-agent-${agent.id}`, async () => {
      if (!session) throw new Error("无法识别当前工作区，请刷新后重试。");
      const result = await revokeBrowserAgent(session, agent.id);
      await loadBrowserAgents(session);
      if (selectedBrowserAgentId === agent.id) setSelectedBrowserAgentId("");
      setNotice(
        `已撤销设备「${result.agent.label}」。该设备不能再领取任务；已创建的 Browser Agent 任务会在下次调度时明确转人工兜底。`,
      );
    });

  const copyEnrollmentCode = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.enrollmentCode);
      setNotice(
        "一次性配对码已复制。请双击 GEO Local Agent 启动器，并在弹出的窗口中粘贴此配对码。",
      );
    } catch {
      setError("浏览器无法写入剪贴板。请手动复制上方一次性配对码。");
    }
  };

  const enablePlatformAutoCollection = (
    platform: string,
    agent: BrowserAgent | null,
  ) =>
    execute(`enable-platform-browser-agent-${platform}`, async () => {
      if (!session || !run || !agent)
        throw new Error(
          "没有在线且支持该平台的 Browser Agent。请先启动本地 Agent，并在受控浏览器完成登录。",
        );
      const result = await enableRealSurfacePlatformBrowserAgent(
        session,
        run.id,
        { platform, browserAgentId: agent.id },
      );
      setRun(result.testRun);
      setSelectedBrowserAgentId(agent.id);
      setNotice(
        "已将「" +
          platform +
          "」当前批次未完成任务接入本地自动采集。不会新增或改写 Query；现在可点击“启动 " +
          platform +
          "”。",
      );
    });

  const claimTask = (task: RealSurfaceTask) =>
    execute(`claim-${task.id}`, async () => {
      if (!session || !run) return;
      const result = await claimRealSurfaceTask(session, run.id, task.id);
      setRun(result.testRun);
    });

  const openEvidence = (task: RealSurfaceTask) => {
    setEvidenceViewMode("manual");
    setSelectedTask(task);
    setAnswer(task.observation?.rawAnswer ?? "");
    setCitations(task.observation?.citations.join("\n") ?? "");
  };

  const openCapturedEvidence = (task: RealSurfaceTask) => {
    setEvidenceViewMode("captured");
    setSelectedTask(task);
    setAnswer(task.observation?.rawAnswer ?? "");
    setCitations(task.observation?.citations.join("\n") ?? "");
  };

  const retryBrowserTask = (task: RealSurfaceTask) =>
    execute(`retry-browser-${task.id}`, async () => {
      if (!session || !run) return;
      const compatibleAgent =
        selectedBrowserAgent?.status === "online" &&
        selectedBrowserAgent.platforms.includes(task.platform)
          ? selectedBrowserAgent
          : onlineBrowserAgents.find((agent) =>
              agent.platforms.includes(task.platform),
            );
      if (!compatibleAgent)
        throw new Error(
          `没有在线且支持「${task.platform}」的 Browser Agent。请先启动本地 Agent 并完成登录。`,
        );
      const result = await retryRealSurfaceTaskWithBrowserAgent(
        session,
        run.id,
        task.id,
        compatibleAgent.id,
      );
      const started = await startBrowserAgentBatch(session, run.id, {
        browserAgentId: compatibleAgent.id,
        platform: task.platform,
      });
      await refreshRunAfterLaneAction(session, run.id, started.testRun);
      setSelectedBrowserAgentId(compatibleAgent.id);
      setNotice(
        `「${task.platform}」这一条 Query 已重新排队，并已自动发出 Browser Agent 启动授权；不会影响同平台其他任务。`,
      );
    });

  const resumeBrowserPlatform = (platform: string) =>
    execute(`resume-browser-platform-${platform}`, async () => {
      if (!session || !run) return;
      const compatibleAgent =
        selectedBrowserAgent?.status === "online" &&
        selectedBrowserAgent.platforms.includes(platform)
          ? selectedBrowserAgent
          : onlineBrowserAgents.find((agent) => agent.platforms.includes(platform));
      if (!compatibleAgent) {
        throw new Error(
          `没有在线且支持「${platform}」的 Browser Agent。请先启动本地 Agent 并完成登录。`,
        );
      }
      const result = await resumeBrowserAgentPlatform(session, run.id, {
        browserAgentId: compatibleAgent.id,
        platform,
      });
      // Show the authoritative checkpoint result immediately. If the follow-up
      // start authorization fails, the operator still sees which tasks were
      // recovered/rebound instead of the stale pre-resume snapshot.
      setRun(result.testRun);
      let startNotice = "";
      if (result.resumedCount > 0 || result.alreadyQueuedCount > 0) {
        const started = await startBrowserAgentBatch(session, run.id, {
          browserAgentId: compatibleAgent.id,
          platform,
          forceRestart: result.activeCount === 0,
        });
        startNotice = started.startRequest.status === "requested"
          ? "已发出新的 Browser Agent 启动授权"
          : `已接续现有 Browser Agent 启动授权（${started.startRequest.status}）`;
        await refreshRunAfterLaneAction(session, run.id, started.testRun);
      } else {
        await refreshRunAfterLaneAction(session, run.id, result.testRun);
      }
      setSelectedBrowserAgentId(compatibleAgent.id);
      setPlatformTaskPage(1);
      const queuedSummary = result.alreadyQueuedCount
        ? `，另有 ${result.alreadyQueuedCount} 条已在队列中`
        : "";
      const reboundSummary = result.reboundQueuedCount
        ? `，重新绑定 ${result.reboundQueuedCount} 条排队任务`
        : "";
      const activeSummary = result.activeCount
        ? `，${result.activeCount} 条正在执行`
        : "";
      setNotice(
        result.remainingCount > 0
          ? `「${platform}」已从断点处理：恢复 ${result.resumedCount} 条${reboundSummary}${queuedSummary}${activeSummary}；当前还剩 ${result.remainingCount} 条未完成。${startNotice || "请检查 Browser Agent 状态。"}`
          : `「${platform}」已完成，已完成任务不会重复执行。`,
      );
    });
  const submitEvidence = () =>
    execute(`submit-${selectedTask?.id ?? ""}`, async () => {
      if (!session || !run || !selectedTask) return;
      const citationsList = citations
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await submitRealSurfaceObservation(
        session,
        run.id,
        selectedTask.id,
        {
          rawAnswer: answer,
          citations: citationsList,
          freshSession,
          searchEnabled,
          observedAt: new Date().toISOString(),
        },
      );
      setRun(result.testRun);
      setSelectedTask(null);
      setNotice("原始回答与引用链接已提交，等待复核。");
    });

  const reviewTask = (
    task: RealSurfaceTask,
    status: "approved" | "needs_revision",
  ) =>
    execute(`review-${task.id}`, async () => {
      if (!session || !run) return;
      const result = await reviewRealSurfaceObservation(
        session,
        run.id,
        task.id,
        status,
      );
      setRun(result.testRun);
      setNotice(
        status === "approved"
          ? "证据已批准，已自动同步到 03「GEO 诊断与基线」。"
          : "已要求补充证据；该任务暂不计入 03 的正式指标。",
      );
    });

  const browserTaskLabel = (task: RealSurfaceTask) =>
    task.agentState === "queued"
      ? "Browser Agent · 排队中"
      : task.agentState === "running"
        ? "Browser Agent · 运行中"
        : task.agentState === "captured"
          ? "Browser Agent · 已捕获"
          : task.agentState === "needs-human"
            ? "需要人工兜底"
            : task.agentState === "failed"
              ? "自动采集失败，人工兜底"
              : "受控人工录入";

  const renderRunTask = (task: RealSurfaceTask) => {
    const browserTask = task.executionMode === "browser-agent";
    const manualOnly = isManualOnlyBrowserPlatform(task.platform);
    const agentAvailable =
      !manualOnly &&
      onlineBrowserAgents.some((agent) =>
        agent.platforms.includes(task.platform),
      );
    const readableReason = readableTaskReason(task.agentStateReason);
    return (
      <article className="real-task" key={task.id}>
        <header>
          <span className={browserTask ? "status ok" : "status muted"}>
            {task.platform}
          </span>
          <small>
            {task.intent} · {browserTaskLabel(task)}
          </small>
        </header>
        <strong>{task.question}</strong>
        {readableReason && (
          <div className="task-reason">
            <div className="task-reason-copy">
              <b>{readableReason.title}</b>
              <span>{readableReason.detail}</span>
            </div>
            {readableReason.technical && (
              <details>
                <summary>查看技术详情</summary>
                <pre>{readableReason.technical}</pre>
              </details>
            )}
          </div>
        )}
        {task.observation && (
          <div className="task-evidence">
            <span>
              <FileCheck2 size={15} />
              已保存{" "}
              {capturedLinkGroups(task.observation).answerCitations.length}{" "}
              条回答内引用 ·{" "}
              {platformSourceStats(task.observation).displayCount}{" "}
              条平台搜索来源
              {platformSourceStats(task.observation).openableUrlCount
                ? `（${platformSourceStats(task.observation).openableUrlCount} 条可打开）`
                : ""}{" "}
              ·{" "}
              {task.observation.collectionMethod === "browser-agent"
                ? "Browser Agent 自动证据"
                : "人工导入证据"}
            </span>
            {task.observation.collectionMethod === "browser-agent" && (
              <>
                <p>
                  原始回答已自动回传：{task.observation.rawAnswer.slice(0, 96)}
                  {task.observation.rawAnswer.length > 96 ? "…" : ""}
                </p>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => openCapturedEvidence(task)}
                >
                  <Eye size={14} />
                  查看已采集证据
                </button>
              </>
            )}
          </div>
        )}
        <footer>
          {!browserTask && task.state === "unassigned" && (
            <button
              className="secondary"
              disabled={Boolean(busy)}
              onClick={() => claimTask(task)}
            >
              认领人工任务
            </button>
          )}
          {!browserTask &&
            ["claimed", "needs_revision"].includes(task.state) && (
              <button
                className="primary"
                disabled={Boolean(busy)}
                onClick={() => openEvidence(task)}
              >
                <Upload size={14} />
                录入证据
              </button>
            )}
          {browserTask && task.state === "unassigned" && (
            <span className="status muted">
              已在「{task.platform}
              」队列中；请在对应的平台执行卡启动本地自动采集。
            </span>
          )}
          {browserTask &&
            task.state === "claimed" &&
            task.agentState === "running" && (
              <span className="status muted">
                正在 {task.platform}{" "}
                页面读取回答与参考资料并回传；只会阻塞同平台的下一条 Query。
              </span>
            )}
          {browserTask &&
            task.state === "claimed" &&
            task.agentState !== "running" && (
              <span className="status muted">
                本地 Agent 已领取，正在等待该平台浏览器扩展执行本条 Query。
              </span>
            )}
          {!browserTask &&
            !manualOnly &&
            ["needs-human", "failed"].includes(task.agentState ?? "manual") && (
              <button
                className="secondary"
                disabled={Boolean(busy) || !agentAvailable}
                onClick={() => retryBrowserTask(task)}
              >
                <RefreshCw size={14} />
                重试本条 Query
              </button>
            )}
          {!browserTask && manualOnly && (
            <span className="status muted">
              当前平台仅支持人工录入证据，不会进入 Browser Agent 队列。
            </span>
          )}
          {!browserTask &&
            !manualOnly &&
            ["needs-human", "failed"].includes(task.agentState ?? "manual") &&
            !agentAvailable && (
              <span className="status muted">
                没有在线且支持该平台的 Browser Agent
              </span>
            )}
          {task.state === "submitted" && (
            <>
              <button
                className="secondary"
                disabled={Boolean(busy)}
                onClick={() => reviewTask(task, "approved")}
              >
                <Check size={14} />
                批准证据
              </button>
              <button
                className="link-button"
                disabled={Boolean(busy)}
                onClick={() => reviewTask(task, "needs_revision")}
              >
                要求补充
              </button>
            </>
          )}
          {task.state === "reviewed" && (
            <span className="status ok">已复核</span>
          )}
        </footer>
      </article>
    );
  };

  if (loading)
    return (
      <div className="baseline-loading">
        <LoaderCircle className="spin" />
        正在加载 Query 研究工作台…
      </div>
    );

  return (
    <div className="baseline-workspace query-research-workspace">
      <section className="baseline-hero">
        <div>
          <span className="eyebrow">01 · Query 研究</span>
          <h2>建立可发布、可复测的 GEO Query Dataset</h2>
          <p>
            本页只负责创建、生成、审核与版本治理。02
            真实平台测试仅使用已发布版本的已批准 Query。
          </p>
        </div>
        <div className="baseline-actions">
          <button
            className="secondary"
            onClick={() => void bootstrap()}
            disabled={Boolean(busy)}
          >
            <RefreshCw size={15} />
            刷新
          </button>
          {projectId && (
            <button
              ref={datasetManagerTriggerRef}
              className="secondary"
              type="button"
              onClick={() => setDatasetManagerOpen(true)}
            >
              <History size={15} />
              管理数据集
            </button>
          )}
          <button className="primary" onClick={() => go("connections")}>
            <Sparkles size={15} />
            模型与 API 连接
          </button>
        </div>
      </section>
      {error && (
        <div className="inline-error">
          <span>{error}</span>
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {notice && (
        <div className="connection-notice">
          <Check size={16} />
          {notice}
        </div>
      )}

      {isResearch && (
        <>
          <nav className="query-research-switcher" aria-label="Query 研究视图">
            <button
              className={researchView === "list" ? "selected" : ""}
              type="button"
              aria-pressed={researchView === "list"}
              onClick={() => {
                setResearchView("list");
                setCoverageFillCellKey(null);
              }}
            >
              Query 列表
            </button>
            <button
              className={researchView === "coverage" ? "selected" : ""}
              type="button"
              aria-pressed={researchView === "coverage"}
              onClick={() => {
                setResearchView("coverage");
                setCoverageFillCellKey(null);
              }}
            >
              覆盖地图
            </button>
            <button
              className={researchView === "fill" ? "selected" : ""}
              type="button"
              aria-pressed={researchView === "fill"}
              onClick={() => {
                setResearchView("fill");
                setCoverageFillCellKey(null);
              }}
            >
              生成与补齐
            </button>
          </nav>
          {researchView === "fill" && (
            <section className="baseline-step generation-section">
              {coverageFillCell && (
                <div className="coverage-fill-banner" role="status">
                  <div>
                    <b>
                      正在定向补齐：{queryTypeLabel(coverageFillCell.queryType)}{" "}
                      × {journeyLabel(coverageFillCell.journeyStage)}
                    </b>
                    <span>
                      当前缺口 {coverageFillCell.gap}{" "}
                      条。系统会把该分类与旅程约束写入真实 LLM
                      Prompt，并只追加到当前 Dataset 版本。
                    </span>
                  </div>
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => {
                      setCoverageFillCellKey(null);
                      setResearchView("coverage");
                    }}
                  >
                    返回覆盖地图
                  </button>
                </div>
              )}
              <div className="section-row">
                <div>
                  <span className="eyebrow">创建与生成</span>
                  <h3>建立 Query Dataset</h3>
                  <p>
                    产品档案、竞品种子词与已审核事实将进入 LLM
                    Prompt；生成结果始终先进入审核。
                  </p>
                </div>
                <span className="status muted">建议首轮 5–20 条</span>
              </div>
              <div
                className="generation-mode"
                role="tablist"
                aria-label="Query 创建方式"
              >
                <button
                  className={sourceMode === "ai" ? "selected" : ""}
                  onClick={() => setSourceMode("ai")}
                  role="tab"
                >
                  <Sparkles size={15} />
                  AI / 模板生成
                </button>
                <button
                  className={sourceMode === "manual" ? "selected" : ""}
                  onClick={() => setSourceMode("manual")}
                  role="tab"
                >
                  <Plus size={15} />
                  手动添加
                </button>
              </div>

              {sourceMode === "ai" ? (
                <div className="generation-panel query-generation-panel">
                  <div className="query-generation-grid">
                    <label className="query-field-profile">
                      产品档案
                      <select
                        value={projectId}
                        onChange={(event) => {
                          const next = event.target.value;
                          setProjectId(next);
                          if (session) void loadProjectQuerySets(session, next);
                        }}
                      >
                        <option value="">选择项目</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.brandName} ·{" "}
                            {project.markets.join(" / ") || "未设置市场"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      目标市场
                      <select
                        value={market}
                        onChange={(event) =>
                          setMarket(event.target.value as "CN" | "US")
                        }
                      >
                        <option value="CN">中国大陆（zh-CN）</option>
                        <option value="US">美国（en-US）</option>
                      </select>
                      <small>决定语言、平台矩阵与问题表达。</small>
                    </label>
                    <label className="query-field-keywords">
                      核心关键词
                      <input
                        value={keywords}
                        onChange={(event) => setKeywords(event.target.value)}
                        placeholder="例如：AI 知识库、知识图谱、来源可追溯（逗号分隔）"
                      />
                      <small>这是模型扩展问题的明确研究边界。</small>
                    </label>
                    <label className="query-field-count">
                      目标数量
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={count}
                        onChange={(event) =>
                          setCount(
                            Math.max(
                              1,
                              Math.min(200, Number(event.target.value) || 1),
                            ),
                          )
                        }
                      />
                      <small>审核区每页显示 10 条。</small>
                    </label>
                  </div>

                  <div className="generation-control-surface">
                    <div className="generation-model-intent-row">
                      <label className="query-field-model">
                        执行模型
                        <select
                          value={providerId}
                          onChange={(event) =>
                            setProviderId(event.target.value)
                          }
                          disabled={!executableProviders.length}
                        >
                          <option value="">
                            {executableProviders.length
                              ? "选择可执行连接"
                              : "尚未配置可执行连接"}
                          </option>
                          {executableProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.providerId} ·{" "}
                              {provider.execution?.modelName}
                            </option>
                          ))}
                        </select>
                        <small>API Key 仅在服务端使用。</small>
                      </label>
                      <div className="intent-row query-intent-row">
                        <div>
                          <b>生成意图</b>
                          <small>选择要覆盖的用户检索阶段。</small>
                        </div>
                        <div className="intent-chips">
                          {intentOptions.map((intent) => (
                            <button
                              key={intent}
                              className={
                                intents.includes(intent) ? "selected" : ""
                              }
                              onClick={() =>
                                setIntents((current) =>
                                  current.includes(intent)
                                    ? current.filter((item) => item !== intent)
                                    : [...current, intent],
                                )
                              }
                            >
                              {intent}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="prompt-provenance query-prompt-row">
                      <div>
                        <span className="prompt-provenance__eyebrow">
                          当前 Prompt
                        </span>
                        <b>
                          {prompt
                            ? `${prompt.name} · v${prompt.version}`
                            : "正在加载 Prompt"}
                        </b>
                        <small>
                          查看或保存不会生成；仅点击主按钮时调用模型。
                        </small>
                      </div>
                      <div className="prompt-provenance-actions">
                        <button
                          className="secondary compact"
                          type="button"
                          aria-expanded={promptPreviewOpen}
                          aria-controls="query-prompt-preview"
                          onClick={() => setPromptPreviewOpen((open) => !open)}
                        >
                          <Eye size={14} />
                          {promptPreviewOpen ? "收起预览" : "预览 Prompt"}
                        </button>
                        <button
                          className="secondary compact"
                          type="button"
                          aria-label="查看并管理生成 Prompt"
                          onClick={() => void openPromptManager()}
                        >
                          <History size={14} />
                          管理
                        </button>
                      </div>
                    </div>
                  </div>
                  {promptPreviewOpen && (
                    <section
                      className="prompt-inline-preview"
                      id="query-prompt-preview"
                      aria-label="当前 Query 生成 Prompt 预览"
                    >
                      <header>
                        <div>
                          <b>当前 Prompt 内容</b>
                          <small>
                            左侧为模板；右侧为依据本次参数渲染后的模型输入。
                          </small>
                        </div>
                        <span>v{prompt?.version ?? "—"}</span>
                      </header>
                      <div>
                        <article>
                          <b>Prompt 模板</b>
                          <pre>
                            {prompt?.template || "正在加载 Prompt 模板…"}
                          </pre>
                        </article>
                        <article>
                          <b>本次渲染预览</b>
                          <pre>
                            {promptPreview ||
                              "请先填写生成参数以预览实际输入。"}
                          </pre>
                        </article>
                      </div>
                      <footer>
                        <span>
                          必填变量：{requiredPromptVariables.join(" · ")}
                        </span>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => void openPromptManager()}
                        >
                          进入 Prompt 管理
                        </button>
                      </footer>
                    </section>
                  )}
                  {!executableProviders.length ? (
                    <div className="connection-empty inline">
                      <ShieldCheck size={18} />
                      <div>
                        <b>尚未配置可执行模型连接</b>
                        <span>
                          配置 Base URL、模型名与 API Key 后才能调用
                          LLM；也可以明确使用模板草案。
                        </span>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => go("connections")}
                      >
                        前往配置
                      </button>
                    </div>
                  ) : null}
                  {generationReceipt && (
                    <div
                      className={`generation-receipt ${generationReceipt.state}`}
                      role={
                        generationReceipt.state === "failed"
                          ? "alert"
                          : "status"
                      }
                      aria-live="polite"
                    >
                      <div>
                        {generationReceipt.state === "running" ? (
                          <LoaderCircle className="spin" size={18} />
                        ) : generationReceipt.state === "success" ? (
                          <Check size={18} />
                        ) : (
                          <X size={18} />
                        )}
                      </div>
                      <div>
                        <b>
                          {generationReceipt.state === "running"
                            ? "正在调用 LLM 生成 Query…"
                            : generationReceipt.state === "success"
                              ? "LLM Query 生成完成"
                              : "LLM Query 生成失败"}
                        </b>
                        <p>
                          模型：{generationReceipt.model} · Prompt：
                          {generationReceipt.promptVersion
                            ? `v${generationReceipt.promptVersion}`
                            : "模板草案"}{" "}
                          · {generationReceipt.market} /{" "}
                          {generationReceipt.locale} · {generationReceipt.count}{" "}
                          条 · {generationReceipt.intents.join("、")}
                        </p>
                        {generationReceipt.detail && (
                          <small>{generationReceipt.detail}</small>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="generation-actions query-generation-actions">
                    <span>
                      <b>本次执行</b>
                      {selectedProvider
                        ? `${selectedProvider.providerId} · ${selectedProvider.execution?.modelName}`
                        : "请先选择已验证模型"}
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => go("connections")}
                      >
                        管理连接
                      </button>
                    </span>
                    <div>
                      <button
                        className="secondary"
                        disabled={
                          Boolean(busy) ||
                          !projectId ||
                          !keywords.trim() ||
                          !intents.length ||
                          Boolean(coverageFillCell)
                        }
                        title={
                          coverageFillCell
                            ? "覆盖缺口必须使用已验证模型补齐"
                            : undefined
                        }
                        onClick={() => createQueries("template")}
                      >
                        {busy === "generate-template" ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <ClipboardCopy size={15} />
                        )}
                        模板草案
                      </button>
                      <button
                        className="primary"
                        disabled={Boolean(busy) || Boolean(aiPreflight.length)}
                        title={
                          aiPreflight.length
                            ? `需先完成：${aiPreflight.join("、")}`
                            : "调用已验证模型生成 Query"
                        }
                        onClick={() => createQueries("llm")}
                      >
                        {busy === "generate-llm" ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <Sparkles size={15} />
                        )}
                        调用 LLM 生成 Query
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="generation-panel manual-panel query-manual-panel">
                  <div className="manual-explain">
                    <ShieldCheck size={18} />
                    <div>
                      <b>手动 Query 与 AI Query 使用同一生命周期</b>
                      <span>
                        它会进入当前 Query
                        集，审核后才会与其他问题一起创建真实平台采集任务；人工创建不会伪装成
                        LLM 产出。
                      </span>
                    </div>
                  </div>
                  <div className="manual-query-layout">
                    {!activeSet && (
                      <label className="manual-query-field manual-query-field--wide">
                        Dataset 名称
                        <input
                          value={manualDatasetName}
                          onChange={(event) =>
                            setManualDatasetName(event.target.value)
                          }
                          placeholder="例如：2026 Q4 核心 Query Dataset"
                        />
                      </label>
                    )}
                    <label className="manual-query-field manual-query-field--wide">
                      问题（Query）
                      <textarea
                        value={manualQuestion}
                        onChange={(event) =>
                          setManualQuestion(event.target.value)
                        }
                        placeholder="输入用户会在 AI 平台提出的完整问题"
                      />
                    </label>
                    <label className="manual-query-field">
                      意图
                      <select
                        value={
                          coverageFillCell
                            ? intentForQueryType(coverageFillCell.queryType)
                            : manualIntent
                        }
                        disabled={Boolean(coverageFillCell)}
                        onChange={(event) =>
                          setManualIntent(event.target.value)
                        }
                      >
                        {intentOptions.map((intent) => (
                          <option key={intent}>{intent}</option>
                        ))}
                      </select>
                      {coverageFillCell && (
                        <small>覆盖地图已锁定该格的类型与用户旅程。</small>
                      )}
                    </label>
                    <label className="manual-query-field">
                      优先级
                      <select
                        value={manualPriority}
                        onChange={(event) =>
                          setManualPriority(
                            event.target.value as "high" | "medium" | "low",
                          )
                        }
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </label>
                    <label className="manual-query-field manual-query-field--wide">
                      纳入理由
                      <textarea
                        value={manualRationale}
                        onChange={(event) =>
                          setManualRationale(event.target.value)
                        }
                        placeholder="说明该问题来自客户访谈、搜索词、销售异议或已有证据"
                      />
                    </label>
                  </div>
                  <div className="generation-actions">
                    <span>
                      {activeSet
                        ? activeSetReadOnly
                          ? `当前版本已${activeSet.lifecycleStatus === "locked_for_baseline" ? "冻结" : "发布"}；添加将自动复制为新版本。`
                          : `将加入当前集合：${activeSet.name}`
                        : "填写第一条 Query 即可建立首个 Dataset，无需先使用 AI 生成。"}
                    </span>
                    <button
                      className="primary"
                      disabled={
                        Boolean(busy) ||
                        !projectId ||
                        !manualQuestion.trim() ||
                        !manualRationale.trim()
                      }
                      onClick={addManualQuery}
                    >
                      {busy === "add-manual" ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <Plus size={15} />
                      )}
                      {activeSet
                        ? activeSetReadOnly
                          ? "复制版本并添加 Query"
                          : "加入当前 Query 集"
                        : "创建 Dataset 并添加 Query"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {researchView === "coverage" && (
            <section className="baseline-step query-coverage-map">
              <header className="query-coverage-heading">
                <div>
                  <span className="eyebrow">覆盖地图</span>
                  <h3>按类型与用户旅程校准 Query 缺口</h3>
                  <p>
                    只统计当前 Dataset 中未排除的
                    Query。点击一个格查看明细、校准目标并直接补齐。
                  </p>
                </div>
                {activeSet && (
                  <span className="status muted">
                    {activeSet.name} · v{activeSet.version}
                  </span>
                )}
              </header>

              {!activeSet ? (
                <div className="baseline-empty">
                  <Sparkles size={20} />
                  <strong>先建立 Query Dataset</strong>
                  <p>
                    生成或手动添加第一批 Query
                    后，系统会按主类型与用户旅程展示覆盖与缺口。
                  </p>
                  <button
                    className="primary"
                    type="button"
                    onClick={() => setResearchView("fill")}
                  >
                    去生成 Query
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="query-coverage-summary"
                    aria-label="覆盖地图汇总"
                  >
                    <span>
                      <b>{coverageSummary.coveredCells}</b> 已覆盖
                    </span>
                    <span>
                      <b>{coverageSummary.gapCells}</b> 存在缺口
                    </span>
                    <span>
                      <b>{coverageSummary.missingQueries}</b> 条待补齐
                    </span>
                    <span>
                      <b>{coverageSummary.applicableCells}</b> 个适用格
                    </span>
                  </div>

                  <div className="query-coverage-scroll">
                    <div
                      className="query-coverage-matrix"
                      role="grid"
                      aria-label="Query 覆盖地图"
                    >
                      <div className="query-coverage-header query-coverage-corner">
                        Query 类型
                      </div>
                      {(activeSet.coverage?.journeys ?? []).map((journey) => (
                        <div
                          className="query-coverage-header"
                          role="columnheader"
                          key={journey}
                        >
                          {journeyLabel(journey)}
                        </div>
                      ))}
                      {(activeSet.coverage?.queryTypes ?? []).flatMap(
                        (queryType) => [
                          <div
                            className="query-coverage-row-label"
                            role="rowheader"
                            key={queryType + "-label"}
                          >
                            {queryTypeLabel(queryType)}
                          </div>,
                          ...(activeSet.coverage?.journeys ?? []).map(
                            (journey) => {
                              const cell = coverageCells.find(
                                (item) =>
                                  item.queryType === queryType &&
                                  item.journeyStage === journey,
                              );
                              if (!cell)
                                return (
                                  <div
                                    className="query-coverage-empty"
                                    key={queryType + "-" + journey}
                                  >
                                    —
                                  </div>
                                );
                              const statusText =
                                cell.state === "covered"
                                  ? "已覆盖"
                                  : cell.state === "not-applicable"
                                    ? "不适用"
                                    : "待补齐";
                              return (
                                <button
                                  className={
                                    "query-coverage-cell query-coverage-cell--" +
                                    cell.state +
                                    (selectedCoverageCell?.key === cell.key
                                      ? " is-selected"
                                      : "")
                                  }
                                  type="button"
                                  role="gridcell"
                                  key={cell.key}
                                  onClick={() => openCoverageCell(cell)}
                                  aria-pressed={
                                    selectedCoverageCell?.key === cell.key
                                  }
                                >
                                  <b>{statusText}</b>
                                  <span>
                                    当前 {cell.current} / 目标 {cell.target}
                                  </span>
                                  <small>
                                    {cell.state === "gap"
                                      ? "缺口 " + cell.gap + " 条"
                                      : cell.state === "not-applicable"
                                        ? "不计入缺口"
                                        : cell.current + " 条可用"}
                                  </small>
                                </button>
                              );
                            },
                          ),
                        ],
                      )}
                    </div>
                  </div>

                  {selectedCoverageCell && (
                    <article className="query-coverage-detail">
                      <header>
                        <div>
                          <span
                            className={
                              "status " +
                              (selectedCoverageCell.state === "covered"
                                ? "ok"
                                : selectedCoverageCell.state === "gap"
                                  ? "submitted"
                                  : "muted")
                            }
                          >
                            {selectedCoverageCell.state === "covered"
                              ? "已覆盖"
                              : selectedCoverageCell.state === "gap"
                                ? "待补齐"
                                : "不适用"}
                          </span>
                          <h4>
                            {queryTypeLabel(selectedCoverageCell.queryType)} ×{" "}
                            {journeyLabel(selectedCoverageCell.journeyStage)}
                          </h4>
                          <p>
                            当前 {selectedCoverageCell.current} / 目标{" "}
                            {selectedCoverageCell.target}
                            {selectedCoverageCell.state === "gap"
                              ? " · 还需 " + selectedCoverageCell.gap + " 条"
                              : ""}
                          </p>
                        </div>
                        {activeSetReadOnly && (
                          <button
                            className="secondary compact"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={createDatasetRevision}
                          >
                            <Plus size={14} />
                            复制为新版本后调整
                          </button>
                        )}
                      </header>

                      <div className="query-coverage-detail-grid">
                        <section>
                          <b>当前 Query</b>
                          {selectedCoverageCell.queryIds.length ? (
                            <ul className="query-coverage-query-list">
                              {activeSet.queries
                                .filter((query) =>
                                  selectedCoverageCell.queryIds.includes(
                                    query.id,
                                  ),
                                )
                                .map((query) => (
                                  <li key={query.id}>
                                    <span>{query.question}</span>
                                    <button
                                      className="link-button"
                                      type="button"
                                      onClick={() => {
                                        setResearchView("list");
                                        setCoverageFillCellKey(null);
                                        openQueryEditor(query);
                                      }}
                                    >
                                      编辑
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="muted-copy">
                              这个格尚未有可计入覆盖的 Query。
                            </p>
                          )}
                        </section>

                        <section className="coverage-target-editor">
                          <b>目标数量</b>
                          <p>
                            设为 0 即表示这个类型 × 旅程对当前 Dataset 不适用。
                          </p>
                          <div>
                            <input
                              aria-label="覆盖目标数量"
                              type="number"
                              min="0"
                              max="200"
                              value={coverageTargetDraft}
                              disabled={activeSetReadOnly || Boolean(busy)}
                              onChange={(event) =>
                                setCoverageTargetDraft(event.target.value)
                              }
                            />
                            <button
                              className="secondary"
                              type="button"
                              disabled={activeSetReadOnly || Boolean(busy)}
                              onClick={saveCoverageTarget}
                            >
                              保存目标
                            </button>
                          </div>
                          {!activeSetReadOnly && (
                            <button
                              className="link-button"
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() => setCoverageTargetDraft("0")}
                            >
                              设为不适用
                            </button>
                          )}
                        </section>
                      </div>

                      {!activeSetReadOnly &&
                        selectedCoverageCell.state !== "not-applicable" && (
                          <footer className="query-coverage-actions">
                            <button
                              className="primary"
                              type="button"
                              disabled={
                                Boolean(busy) || selectedCoverageCell.gap === 0
                              }
                              onClick={() =>
                                beginCoverageFill(selectedCoverageCell, "ai")
                              }
                            >
                              <Sparkles size={15} />
                              使用 AI 补齐 {selectedCoverageCell.gap} 条
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                beginCoverageFill(
                                  selectedCoverageCell,
                                  "manual",
                                )
                              }
                            >
                              <Plus size={15} />
                              手动添加到此格
                            </button>
                          </footer>
                        )}
                    </article>
                  )}
                </>
              )}
            </section>
          )}

          {researchView === "list" && (
            <section
              className="baseline-step query-review"
              ref={reviewRef}
              tabIndex={-1}
            >
              <div className="section-row">
                <div>
                  <span className="eyebrow">2 · 审核核心问题</span>
                  <h3>{activeSet ? activeSet.name : "尚未创建 Query 集"}</h3>
                  <p>
                    {activeSet
                      ? `共 ${activeSet.queries.length} 条 · 已批准 ${approvedCount} 条 · ${activeSet.generationMode === "llm-assisted" ? "本集合由 LLM 生成草案" : "本集合含模板或人工草案"}`
                      : "完成生成或手动创建前，不会创建真实平台测试任务。"}
                  </p>
                </div>
                {sets.length > 1 && (
                  <label className="set-switcher">
                    历史集合
                    <select
                      value={activeSet?.id ?? ""}
                      onChange={(event) => {
                        const next =
                          sets.find((item) => item.id === event.target.value) ??
                          null;
                        setActiveSet(next);
                        setPage(1);
                      }}
                    >
                      {sets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.queries.length} 条
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {!activeSet ? (
                <div className="baseline-empty">
                  <Sparkles size={20} />
                  <strong>从关键词与意图开始建立第一套 Query</strong>
                  <p>
                    AI
                    生成会调用你选择的模型连接；模板草案与手动创建均会明确标记来源。
                  </p>
                </div>
              ) : (
                <>
                  <div className="dataset-lifecycle-card">
                    <div>
                      <span
                        className={`status ${activeSet.lifecycleStatus === "ready_for_test" || activeSet.lifecycleStatus === "locked_for_baseline" ? "ok" : activeSet.lifecycleStatus === "in_review" ? "submitted" : "muted"}`}
                      >
                        {activeSet.lifecycleStatus === "ready_for_test"
                          ? "测试就绪"
                          : activeSet.lifecycleStatus === "locked_for_baseline"
                            ? "基线冻结"
                            : activeSet.lifecycleStatus === "in_review"
                              ? "审核中"
                              : activeSet.lifecycleStatus === "superseded"
                                ? "已替代"
                                : "草稿"}
                      </span>
                      <b>
                        {activeSet.name} · v{activeSet.version}
                      </b>
                      <small>
                        {activeSetReadOnly
                          ? "此版本只读且可追溯；更新请复制新版本。"
                          : "完成审核并发布后，02 只会读取当前版本的已批准 Query。"}
                      </small>
                    </div>
                    <div className="dataset-publish-actions">
                      {!activeSetReadOnly && (
                        <button
                          className="primary"
                          disabled={Boolean(busy) || !canPublishDataset}
                          title={publishBlocker}
                          onClick={publishDataset}
                        >
                          <Check size={15} />
                          发布为测试版本
                        </button>
                      )}
                      {activeSetReadOnly && (
                        <button
                          className="secondary"
                          disabled={Boolean(busy)}
                          onClick={createDatasetRevision}
                        >
                          <Plus size={15} />
                          复制为新版本
                        </button>
                      )}
                    </div>
                  </div>
                  {!activeSetReadOnly && !canPublishDataset && (
                    <p className="dataset-gate-note">{publishBlocker}</p>
                  )}
                  <div className="dataset-health">
                    <div>
                      <b>{activeSetHealth.total}</b>
                      <span>总量</span>
                    </div>
                    <div>
                      <b>{activeSetHealth.approved}</b>
                      <span>已批准</span>
                    </div>
                    <div>
                      <b>{activeSetHealth.draft}</b>
                      <span>待审核</span>
                    </div>
                    <div>
                      <b>{activeSetHealth.excluded}</b>
                      <span>已排除</span>
                    </div>
                    <section>
                      <b>覆盖与缺口</b>
                      <p>
                        <span className="coverage-chip">
                          类型：{coverageQueryTypes.join("、") || "待补齐"}
                        </span>
                        <span className="coverage-chip">
                          旅程：{coverageJourneys.join("、") || "待补齐"}
                        </span>
                        <span className="coverage-chip">
                          对象：{coverageTargets.join("、") || "待补齐"}
                        </span>
                      </p>
                      {activeSetHealth.recommendations.length > 0 && (
                        <ul>
                          {activeSetHealth.recommendations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                  <div className="query-list-toolbar">
                    <div>
                      <b>Query 列表</b>
                      <span>
                        共 {sortedQueries.length} 条 · {querySort.key === "default"
                          ? "按创建顺序"
                          : querySort.key === "priority"
                            ? "按优先级"
                            : querySort.key === "status"
                              ? "按审核状态"
                              : querySort.key === "provenance"
                                ? "按来源"
                                : "按用户意图"}
                      </span>
                    </div>
                    <div className="query-sort-controls">
                      <label>
                        <span>排序</span>
                        <select
                          aria-label="Query 排序字段"
                          value={querySort.key}
                          onChange={(event) =>
                            toggleQuerySort(event.target.value as QuerySortKey)
                          }
                        >
                          <option value="default">默认顺序</option>
                          <option value="priority">优先级</option>
                          <option value="status">审核状态</option>
                          <option value="provenance">来源</option>
                          <option value="intent">用户意图</option>
                        </select>
                      </label>
                      <button
                        className="secondary query-sort-direction"
                        type="button"
                        aria-label={`切换为${querySort.direction === "asc" ? "降序" : "升序"}`}
                        title={`当前${querySort.direction === "asc" ? "升序" : "降序"}，点击切换`}
                        disabled={querySort.key === "default"}
                        onClick={() =>
                          setQuerySort((current) => ({
                            ...current,
                            direction: current.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      >
                        <ArrowDownUp size={14} />
                        {querySort.direction === "asc" ? "升序" : "降序"}
                      </button>
                    </div>
                  </div>
                  <div
                    className="query-table"
                    role="table"
                    aria-label="核心 Query 审核列表"
                  >
                    <div className="query-table-head" role="row">
                      <span>问题</span>
                      <button
                        className={`query-sort-header ${querySort.key === "intent" ? "is-active" : ""}`}
                        type="button"
                        onClick={() => toggleQuerySort("intent")}
                      >
                        意图 {querySort.key === "intent" ? (querySort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                      <button
                        className={`query-sort-header ${querySort.key === "provenance" ? "is-active" : ""}`}
                        type="button"
                        onClick={() => toggleQuerySort("provenance")}
                      >
                        来源 {querySort.key === "provenance" ? (querySort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                      <button
                        className={`query-sort-header ${querySort.key === "priority" ? "is-active" : ""}`}
                        type="button"
                        onClick={() => toggleQuerySort("priority")}
                      >
                        优先级 {querySort.key === "priority" ? (querySort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                      <button
                        className={`query-sort-header ${querySort.key === "status" ? "is-active" : ""}`}
                        type="button"
                        onClick={() => toggleQuerySort("status")}
                      >
                        状态 / 操作 {querySort.key === "status" ? (querySort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                    </div>
                    {visibleQueries.map((query) => {
                      const provenance = provenanceLabel(query.provenance);
                      return (
                        <div
                          className="query-table-row"
                          role="row"
                          key={query.id}
                        >
                          <div>
                            <b>{query.question}</b>
                            <small>{query.rationale}</small>
                          </div>
                          <span>{query.intent}</span>
                          <span
                            className={`provenance-chip ${provenance.className}`}
                          >
                            {provenance.label}
                          </span>
                          <span
                            className={`priority priority-${query.priority}`}
                          >
                            {query.priority === "high"
                              ? "高"
                              : query.priority === "medium"
                                ? "中"
                                : "低"}
                          </span>
                          <div className="query-actions">
                            <span
                              className={`status ${query.status === "approved" ? "ok" : query.status === "excluded" ? "muted" : "submitted"}`}
                            >
                              {query.status === "approved"
                                ? "已批准"
                                : query.status === "excluded"
                                  ? "已排除"
                                  : "待审核"}
                            </span>
                            <button
                              className="secondary mini-edit"
                              disabled={Boolean(busy) || activeSetReadOnly}
                              onClick={() => openQueryEditor(query)}
                            >
                              <Pencil size={13} />
                              编辑
                            </button>
                            {query.status === "draft" && (
                              <>
                                <button
                                  className="mini-primary"
                                  disabled={Boolean(busy) || activeSetReadOnly}
                                  onClick={() =>
                                    updateQuery(query.id, "approved")
                                  }
                                >
                                  批准
                                </button>
                                <button
                                  className="link-button"
                                  disabled={Boolean(busy) || activeSetReadOnly}
                                  onClick={() =>
                                    updateQuery(query.id, "excluded")
                                  }
                                >
                                  排除
                                </button>
                              </>
                            )}
                            {query.status === "approved" && (
                              <button
                                className="link-button"
                                disabled={Boolean(busy) || activeSetReadOnly}
                                onClick={() => updateQuery(query.id, "excluded")}
                              >
                                排除
                              </button>
                            )}
                            {query.status === "excluded" && (
                              <button
                                className="link-button"
                                disabled={Boolean(busy) || activeSetReadOnly}
                                onClick={() => updateQuery(query.id, "draft")}
                              >
                                恢复审核
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="query-pagination">
                    <span>
                      第 {page} / {pageCount} 页 · 每页 10 条
                    </span>
                    <div>
                      <button
                        className="secondary"
                        disabled={page <= 1}
                        onClick={() =>
                          setPage((current) => Math.max(1, current - 1))
                        }
                      >
                        <ChevronLeft size={15} />
                        上一页
                      </button>
                      <button
                        className="secondary"
                        disabled={page >= pageCount}
                        onClick={() =>
                          setPage((current) => Math.min(pageCount, current + 1))
                        }
                      >
                        下一页
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      {isTesting && (
        <>
          <section
            className="baseline-step dataset-handoff"
            aria-label="Query Dataset 交接"
          >
            <header className="dataset-handoff__header">
              <div>
                <span className="eyebrow">1 · Dataset 交接</span>
                <h3>确认本次测试使用的 Query 版本</h3>
                <p>
                  真实平台测试只读取已审核的 Query；如需生成、编辑或审核，请返回
                  Query 研究。
                </p>
              </div>
              {activeSet && (
                <button
                  ref={datasetManagerTriggerRef}
                  className="secondary compact"
                  type="button"
                  onClick={() => setDatasetManagerOpen(true)}
                >
                  <History size={14} />
                  管理数据集
                </button>
              )}
            </header>
            <div className="dataset-handoff__grid">
              <label className="dataset-project-field">
                产品档案
                <select
                  value={projectId}
                  onChange={(event) => selectProject(event.target.value)}
                >
                  <option value="">选择项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.brandName} ·{" "}
                      {project.markets.join(" / ") || "未设置市场"}
                    </option>
                  ))}
                </select>
              </label>
              {activeSet ? (
                <article className="dataset-handoff__summary">
                  <div className="dataset-handoff__title">
                    <span className="status ok">当前 Dataset</span>
                    <div>
                      <b>{activeSet.name}</b>
                      <small>
                        {activeSet.marketPack === "CN"
                          ? "中国大陆 · zh-CN"
                          : "美国 · en-US"}{" "}
                        ·{" "}
                        {activeSet.generationMode === "llm-assisted"
                          ? "LLM 草案已留痕"
                          : "模板 / 人工草案已留痕"}
                      </small>
                    </div>
                  </div>
                  <div className="dataset-handoff__metrics">
                    <span>
                      <b>{activeSet.queries.length}</b> 条 Query
                    </span>
                    <span>
                      <b>{approvedCount}</b> 条已批准
                    </span>
                    <span>
                      <b>
                        {
                          activeSet.queries.filter(
                            (item) =>
                              item.priority === "high" &&
                              item.status === "approved",
                          ).length
                        }
                      </b>{" "}
                      条高优先级
                    </span>
                  </div>
                  <p>
                    <ShieldCheck size={15} />
                    本批次将使用全部已批准
                    Query；测试页只负责平台配置、原始回答采集与证据复核。
                  </p>
                  {testableQuerySets.length > 1 && (
                    <label className="dataset-version-field">
                      切换已存在版本
                      <select
                        value={activeSet.id}
                        onChange={(event) => {
                          const next =
                            testableQuerySets.find(
                              (item) => item.id === event.target.value,
                            ) ?? null;
                          setActiveSet(next);
                          setPage(1);
                        }}
                      >
                        {testableQuerySets.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ·{" "}
                            {
                              item.queries.filter(
                                (query) => query.status === "approved",
                              ).length
                            }{" "}
                            条已批准
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ) : (
                <div className="baseline-empty dataset-handoff__empty">
                  <FileCheck2 size={20} />
                  <strong>还没有可用的 Query Dataset</strong>
                  <p>
                    请先在 Query
                    研究中建立并审核核心问题，再创建真实平台测试批次。
                  </p>
                </div>
              )}
            </div>
          </section>

          {hasApprovedDataset ? (
            <section className="baseline-step run-builder run-builder--compact">
              <div className="run-builder-heading">
                <div>
                  <span className="eyebrow">2 · 配置真实平台测试</span>
                  <h3>配置真实平台测试</h3>
                  <p>
                    系统会基于当前 Dataset 中已批准的
                    Query、所选平台和市场创建测试任务；原始回答将在受控人工或本地
                    Browser Agent 流程中采集。
                  </p>
                </div>
                <span className="status muted">
                  不使用 API / MCP 替代真实平台结果
                </span>
              </div>
              <div className="run-builder-flow">
                <section
                  className="run-flow-step run-flow-platforms"
                  aria-labelledby="platform-choice-title"
                >
                  <header>
                    <span>①</span>
                    <div>
                      <b id="platform-choice-title">选择测试平台</b>
                      <small>选中平台会在创建后建立对应的真实测试任务。</small>
                    </div>
                  </header>
                  <div className="platform-pills">
                    {REAL_PLATFORM_CATALOG[market].map((platform) => (
                      <label key={platform}>
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(platform)}
                          onChange={() =>
                            setSelectedPlatforms((current) =>
                              current.includes(platform)
                                ? current.filter((item) => item !== platform)
                                : [...current, platform],
                            )
                          }
                        />
                        {platform}
                      </label>
                    ))}
                  </div>
                  <div className="run-flow-note">
                    <span>{selectedPlatforms.length} 个已选</span>
                    <span>
                      {selectedAutomatedPlatformCount} 个已匹配本地采集能力
                    </span>
                  </div>
                </section>

                <section
                  className="run-flow-step run-flow-agent"
                  aria-labelledby="agent-choice-title"
                >
                  <header>
                    <span>②</span>
                    <div>
                      <b id="agent-choice-title">选择本地 Browser Agent</b>
                      <small>
                        使用已登录的受控浏览器；登录态与浏览器数据始终留在客户电脑。
                      </small>
                    </div>
                  </header>
                  <div className="agent-selector">
                    <label>
                      本批次设备
                      <select
                        value={selectedBrowserAgentId}
                        onChange={(event) =>
                          setSelectedBrowserAgentId(event.target.value)
                        }
                      >
                        <option value="">不选择设备：全部走人工兜底</option>
                        {browserAgents
                          .filter((agent) => agent.status !== "revoked")
                          .map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.label} ·{" "}
                              {browserAgentStatusLabel(agent.status)} ·{" "}
                              {agent.platforms.join("、")}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedBrowserAgent ? (
                      <div className="agent-device-summary">
                        <span
                          className={
                            selectedBrowserAgent.status === "online"
                              ? "status ok"
                              : "status muted"
                          }
                        >
                          {browserAgentStatusLabel(selectedBrowserAgent.status)}
                        </span>
                        <b>
                          {selectedAgentSupportedPlatformCount} /{" "}
                          {selectedAutomatedPlatformCount} 个已选自动平台可用
                        </b>
                        <small>
                          最近心跳{" "}
                          {shortDateTime(selectedBrowserAgent.lastSeenAt)}
                        </small>
                        {selectedBrowserAgent.lastError && (
                          <em>{selectedBrowserAgent.lastError}</em>
                        )}
                      </div>
                    ) : (
                      <div className="agent-device-summary agent-device-summary--empty">
                        <b>尚未选择在线设备</b>
                        <small>
                          仍可创建人工任务；有可用设备后可将对应平台转入自动队列。
                        </small>
                      </div>
                    )}
                  </div>
                  <div className="agent-disclosure-actions">
                    <button
                      className="secondary compact"
                      type="button"
                      aria-expanded={agentGuideOpen}
                      onClick={() => setAgentGuideOpen((open) => !open)}
                    >
                      {agentGuideOpen ? "收起首次配置说明" : "查看首次配置说明"}
                    </button>
                    {browserAgents.length > 0 && (
                      <button
                        className="secondary compact"
                        type="button"
                        aria-expanded={agentDevicesOpen}
                        onClick={() => setAgentDevicesOpen((open) => !open)}
                      >
                        {agentDevicesOpen
                          ? "收起已登记设备"
                          : `已登记设备（${browserAgents.length}）`}
                      </button>
                    )}
                    <button
                      className="link-button"
                      type="button"
                      aria-expanded={agentEnrollmentOpen || Boolean(enrollment)}
                      onClick={() => setAgentEnrollmentOpen((open) => !open)}
                    >
                      <Link2 size={14} />
                      配对新设备
                    </button>
                  </div>
                  {agentGuideOpen && (
                    <ol
                      className="agent-setup-strip"
                      aria-label="GEO Local Agent 首次配置步骤"
                    >
                      <li>
                        <b>创建配对码</b>
                        <span>
                          双击 <code>Start-GEO-Agent.cmd</code>{" "}
                          并粘贴配对码，无需使用终端。
                        </span>
                      </li>
                      <li>
                        <b>登录需要的平台</b>
                        <span>启动器会打开受控 Edge；请在该窗口正常登录。</span>
                      </li>
                      <li>
                        <b>创建后按平台启动</b>
                        <span>下方按模型显示独立队列；启动后会逐条执行。</span>
                      </li>
                    </ol>
                  )}
                  {agentDevicesOpen && (
                    <div
                      className="agent-device-list agent-device-list--compact"
                      aria-label="已登记的 Browser Agent"
                    >
                      {browserAgents.map((agent) => (
                        <div key={agent.id} className="agent-device-row">
                          <div>
                            <b>{agent.label}</b>
                            <span>
                              {browserAgentStatusLabel(agent.status)} ·{" "}
                              {shortDateTime(agent.lastSeenAt)} ·{" "}
                              {agent.adapters
                                .map((adapter) => adapter.platform)
                                .join("、") || "未登记适配器"}
                            </span>
                          </div>
                          {agent.status !== "revoked" && (
                            <button
                              className="quiet-danger"
                              disabled={Boolean(busy)}
                              onClick={() => revokeAgent(agent)}
                            >
                              撤销
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(agentEnrollmentOpen || enrollment) && (
                    <div className="agent-enrollment agent-enrollment--compact">
                      <label>
                        新设备名称
                        <input
                          value={agentLabel}
                          onChange={(event) =>
                            setAgentLabel(event.target.value)
                          }
                          placeholder="例如：张三的 Win11 Chrome"
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={
                          Boolean(busy) ||
                          !agentLabel.trim() ||
                          !selectedPlatforms.length
                        }
                        onClick={createAgentEnrollment}
                      >
                        {busy === "create-agent-enrollment" ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Link2 size={15} />
                        )}
                        创建一次性配对码
                      </button>
                    </div>
                  )}
                  {enrollment && (
                    <div
                      className="enrollment-code enrollment-code--compact"
                      role="status"
                    >
                      <div>
                        <b>一次性配对码 · {enrollment.agent.label}</b>
                        <code>{enrollment.enrollmentCode}</code>
                        <small>
                          有效至{" "}
                          {new Date(enrollment.expiresAt).toLocaleTimeString(
                            "zh-CN",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                          。配对后服务端只保留令牌 Hash。
                        </small>
                        <div className="enrollment-command">
                          <span>
                            复制后双击{" "}
                            <code>browser-agent/Start-GEO-Agent.cmd</code>
                            ，在弹窗内粘贴；首次启动会自动打开加载扩展的独立
                            Edge。
                          </span>
                        </div>
                      </div>
                      <div className="enrollment-actions">
                        <button
                          className="secondary"
                          onClick={() => void copyEnrollmentCode()}
                        >
                          <ClipboardCopy size={15} />
                          复制配对码
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <div className="run-launch run-launch--summary">
                <div className="batch-create-summary">
                  <span>③</span>
                  <div>
                    <b>创建测试批次</b>
                    <small>
                      将生成 {estimatedTaskCount} 条任务：{approvedCount}{" "}
                      条已批准 Query × {selectedPlatforms.length} 个平台
                    </small>
                  </div>
                  <div>
                    <em>{selectedPlatforms.length} 个测试平台</em>
                    <em>
                      {selectedAutomatedPlatformCount} 个已匹配本地采集能力
                    </em>
                  </div>
                </div>
                <div className="run-launch__action">
                  <button
                    className="primary"
                    disabled={!canCreateRun || Boolean(busy)}
                    title={testRunGate || "创建真实平台测试任务矩阵"}
                    aria-describedby={testRunGate ? "test-run-gate" : undefined}
                    onClick={createTestRun}
                  >
                    {busy === "create-run" ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      <Play size={15} />
                    )}
                    创建真实平台测试批次
                  </button>
                  {testRunGate ? (
                    <p id="test-run-gate" className="run-gate" role="status">
                      <ShieldCheck size={15} />
                      {testRunGate}
                    </p>
                  ) : (
                    <p className="run-ready">
                      <Check size={15} />
                      创建后，支持的已登录平台会进入独立 Browser Agent 队列。
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section
              className="baseline-step testing-gate"
              aria-label="真实平台测试前置条件"
            >
              <div className="testing-gate__content">
                <span className="testing-gate__icon">
                  <FileCheck2 size={19} />
                </span>
                <div>
                  <span className="eyebrow">2 · 配置真实平台测试</span>
                  <h3>
                    {activeSet ? "先完成 Query 审核" : "先建立 Query Dataset"}
                  </h3>
                  <p>
                    {activeSet
                      ? "当前 Dataset 还没有已批准的 Query。请返回 Query 研究完成审核；批准后即可选择平台与本地 Browser Agent。"
                      : "真实平台测试需要一份已审核的 Query Dataset。先生成或手动补充 Query，并完成审核后再配置采集。"}
                  </p>
                </div>
              </div>
              <button
                className="primary"
                type="button"
                onClick={() => go("queryResearch")}
              >
                前往 Query 研究
              </button>
            </section>
          )}

          {run && taskGroups && (
            <section className="baseline-step task-run">
              <div className="section-row">
                <div>
                  <span className="eyebrow">3 · 任务执行与证据复核</span>
                  <h3>{run.name}</h3>
                  <p>
                    这是本项目当前 GEO
                    测试批次。按平台启动采集、导入原始回答并复核引用链接；已审核证据会自动更新
                    03「GEO 诊断与基线」，无需手动同步。
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    execute("refresh-run", async () => {
                      if (!session) return;
                      const result = await getRealSurfaceTestRun(
                        session,
                        run.id,
                      );
                      setRun(result.testRun);
                    })
                  }
                >
                  <RefreshCw size={15} />
                  刷新任务
                </button>
              </div>
              <div className="progress-cards">
                <div>
                  <b>{run.progress.total}</b>
                  <span>任务总数</span>
                </div>
                <div>
                  <b>{taskGroups.todo.length}</b>
                  <span>待采集</span>
                </div>
                <div>
                  <b>{taskGroups.review.length}</b>
                  <span>待复核</span>
                </div>
                <div>
                  <b>{taskGroups.done.length}</b>
                  <span>已复核</span>
                </div>
              </div>
              <section
                className="platform-coverage-panel platform-coverage-panel--compact"
                aria-label="平台覆盖与执行方式"
              >
                <header className="platform-coverage-panel__header">
                  <div>
                    <span className="eyebrow">平台覆盖</span>
                    <h4>按平台管理任务与采集方式</h4>
                    <p>
                      默认只显示可执行状态；选择一个平台后，再查看它的队列和
                      Query 详情。
                    </p>
                  </div>
                  <div className="platform-coverage-panel__summary">
                    <b>
                      {
                        platformCoverage.filter(
                          (item) => item.state === "browser-queued",
                        ).length
                      }
                    </b>
                    <span>自动队列</span>
                  </div>
                </header>
                <div className="platform-coverage-grid platform-coverage-grid--compact">
                  {platformCoverage.map((item) => {
                    const isNotAdded = item.state === "not-added";
                    const selected = appendPlatforms.includes(item.platform);
                    const busyKey = `enable-platform-browser-agent-${item.platform}`;
                    const requestActive = Boolean(
                      item.request &&
                      [
                        "requested",
                        "acknowledged",
                        "launching-browser",
                        "waiting-login",
                        "running",
                      ].includes(item.request.status),
                    );
                    const status = (
                      {
                        "not-added": "尚未加入",
                        "manual-only": "人工导入",
                        "manual-ready": "待接入自动采集",
                        "browser-queued": requestActive
                          ? "采集中"
                          : "自动采集就绪",
                        finalized: "本轮完成",
                        "not-ready": "本地环境未就绪",
                      } as const
                    )[item.state];
                    const mode = item.manualOnly
                      ? "人工导入"
                      : item.ready
                        ? "Browser Agent"
                        : "待处理";
                    return (
                      <article
                        className={`platform-coverage-card ${activeRunPlatform === item.platform ? "is-selected" : ""}`}
                        data-state={item.state}
                        key={item.platform}
                      >
                        <div className="platform-coverage-card__top">
                          <span className="status ok">{item.platform}</span>
                          <span
                            className={`status ${item.state === "finalized" ? "ok" : item.state === "not-ready" ? "muted" : "submitted"}`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="platform-coverage-card__metrics">
                          <span>
                            <b>{item.tasks.length}</b>任务
                          </span>
                          <span>
                            <b>{item.pendingCount}</b>待完成
                          </span>
                          <span>{mode}</span>
                        </div>
                        <footer>
                          {isNotAdded ? (
                            <label className="platform-coverage-check">
                              <input
                                type="checkbox"
                                disabled={!(item.manualOnly || item.ready)}
                                checked={selected}
                                onChange={() =>
                                  setAppendPlatforms((current) =>
                                    current.includes(item.platform)
                                      ? current.filter(
                                          (value) => value !== item.platform,
                                        )
                                      : [...current, item.platform],
                                  )
                                }
                              />
                              <span>{selected ? "已选择" : "加入批次"}</span>
                            </label>
                          ) : item.state === "manual-ready" ? (
                            <button
                              className="secondary compact"
                              type="button"
                              disabled={
                                Boolean(busy) ||
                                !item.ready ||
                                !item.pendingCount
                              }
                              onClick={() =>
                                enablePlatformAutoCollection(
                                  item.platform,
                                  item.agent,
                                )
                              }
                            >
                              {busy === busyKey ? (
                                <LoaderCircle className="spin" size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                              接入
                            </button>
                          ) : (
                            <button
                              className="secondary compact"
                              type="button"
                              onClick={() =>
                                setActiveRunPlatform(item.platform)
                              }
                            >
                              {activeRunPlatform === item.platform
                                ? "已展开"
                                : "查看"}
                            </button>
                          )}
                        </footer>
                      </article>
                    );
                  })}
                </div>
                <footer className="platform-coverage-panel__footer">
                  <span>
                    {appendPlatforms.length
                      ? `已选择 ${appendPlatforms.length} 个新平台，将复用本批次冻结的 Query。`
                      : "需要新增渠道时，在上方选择平台后创建对应任务。"}
                  </span>
                  <button
                    className="secondary compact"
                    type="button"
                    disabled={!appendPlatforms.length || Boolean(busy)}
                    onClick={appendPlatformsToRun}
                  >
                    {busy === "append-run-platforms" ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                    添加并创建任务
                  </button>
                </footer>
              </section>
              {browserTasks.length > 0 && (
                <section
                  className="agent-run-console agent-run-console--compact"
                  aria-label="按平台划分的本地自动采集控制台"
                >
                  <div className="agent-run-console-head">
                    <div>
                      <span className="eyebrow">本地自动采集</span>
                      <h4>平台队列总览</h4>
                      <p>
                        不同平台可并行；同一平台按 Query
                        严格串行。点击平台行可查看当前平台的执行详情。
                      </p>
                    </div>
                    <div className="agent-concurrency-note">
                      <b>{browserPlatformLanes.length}</b>
                      <span>个自动平台</span>
                      <small>跨平台并行</small>
                    </div>
                  </div>
                  <div className="agent-queue-matrix" aria-live="polite">
                    {browserPlatformLanes.map((lane) => {
                      const activeRequest = Boolean(
                        lane.request &&
                        [
                          "requested",
                          "acknowledged",
                          "launching-browser",
                          "waiting-login",
                          "running",
                        ].includes(lane.request.status),
                      );
                      const laneBusy =
                        laneBusyKeys.includes(
                          `start-local-browser-batch-${lane.platform}`,
                        ) ||
                        laneBusyKeys.includes(
                          `cancel-local-browser-batch-${lane.platform}`,
                        );
                      return (
                        <div
                          className={`agent-queue-row ${activeRunPlatform === lane.platform ? "is-selected" : ""} ${activeRequest ? "is-active" : ""}`}
                          data-agent-lane={lane.platform}
                          key={lane.platform}
                        >
                          <button
                            className="agent-queue-platform"
                            type="button"
                            onClick={() => setActiveRunPlatform(lane.platform)}
                            aria-pressed={activeRunPlatform === lane.platform}
                          >
                            <span className="status ok">{lane.platform}</span>
                            <span>
                              {lane.request
                                ? browserStartRequestLabel(lane.request.status)
                                : "尚未启动"}
                            </span>
                          </button>
                          <span className="agent-queue-progress">
                            {lane.capturedCount}/{lane.tasks.length} 已回传
                            {lane.runningCount
                              ? ` · ${lane.runningCount} 运行中`
                              : ""}
                            {lane.humanCount
                              ? ` · ${lane.humanCount} 需人工`
                              : ""}
                          </span>
                          <span
                            className="agent-queue-device"
                            title={
                              lane.agent?.label ?? lane.readinessReason ?? ""
                            }
                          >
                            {lane.agent ? lane.agent.label : "无可用设备"}
                          </span>
                          {activeRequest ? (
                            <button
                              className="secondary compact"
                              type="button"
                              disabled={laneBusy}
                              onClick={() =>
                                cancelLocalBrowserBatch(lane.request!)
                              }
                            >
                              {laneBusy ? (
                                <LoaderCircle className="spin" size={14} />
                              ) : (
                                <X size={14} />
                              )}
                              停止
                            </button>
                          ) : (
                            <button
                              className="primary compact"
                              type="button"
                              disabled={laneBusy || !lane.agent}
                              onClick={() =>
                                startLocalBrowserBatch(lane.platform)
                              }
                            >
                              {laneBusy ? (
                                <LoaderCircle className="spin" size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                              启动
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {activePlatformLane && (
                    <article
                      className="agent-platform-detail"
                      aria-label={`${activePlatformLane.platform} 执行详情`}
                    >
                      <div>
                        <span className="status ok">
                          {activePlatformLane.platform}
                        </span>
                        <b>
                          {activePlatformLane.request
                            ? browserStartRequestLabel(
                                activePlatformLane.request.status,
                              )
                            : "尚未启动本平台队列"}
                        </b>
                        <p>
                          {activePlatformLane.request
                            ? browserStartRequestDetail(
                                activePlatformLane.request,
                              )
                            : `本次仅会启动 ${activePlatformLane.platform} 的 ${activePlatformLane.tasks.length} 条 Query，不影响其他平台。`}
                        </p>
                      </div>
                      <div className="agent-platform-detail__metrics">
                        <span>
                          <b>{activePlatformLane.pendingCount}</b>待执行
                        </span>
                        <span>
                          <b>{activePlatformLane.runningCount}</b>运行中
                        </span>
                        <span>
                          <b>{activePlatformLane.capturedCount}</b>已回传
                        </span>
                        <span>
                          心跳{" "}
                          {shortDateTime(activePlatformLane.agent?.lastSeenAt)}
                        </span>
                      </div>
                    </article>
                  )}
                </section>
              )}
              <section
                className="platform-task-group platform-task-group--compact"
                aria-label="按平台筛选的 Query 任务列表"
              >
                <header>
                  <div>
                    <span className="eyebrow">Query 任务</span>
                    <h4>
                      {activeRunPlatform
                        ? `${activeRunPlatform} Query 列表`
                        : "选择平台查看 Query"}
                    </h4>
                    <p>
                      只展开当前平台，避免多个平台与 Query
                      卡同时占满页面；其他平台队列仍独立运行。
                    </p>
                  </div>
                  {activeRunPlatform && (
                    <div>
                      <b>
                        {
                          activePlatformTasks.filter((task) =>
                            ["submitted", "reviewed"].includes(task.state),
                          ).length
                        }
                        /{activePlatformTasks.length}
                      </b>
                      <span>
                        {activePlatformTasks.some(
                          (task) => task.executionMode === "browser-agent",
                        )
                          ? "已回传 / 总任务"
                          : "已提交 / 总任务"}
                      </span>
                      {activePlatformResumableCount > 0 && (
                        <button
                          className="secondary compact"
                          type="button"
                          disabled={
                            Boolean(busy) ||
                            !onlineBrowserAgents.some((agent) =>
                              agent.platforms.includes(activeRunPlatform),
                            )
                          }
                          onClick={() => resumeBrowserPlatform(activeRunPlatform)}
                          title="只重新排队失败、人工兜底或已过期的任务；已完成任务不会重复执行"
                        >
                          {busy === `resume-browser-platform-${activeRunPlatform}` ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                          继续采集未完成任务（{activePlatformResumableCount}）
                        </button>
                      )}
                    </div>
                  )}
                </header>
                <div
                  className="platform-tabs"
                  role="tablist"
                  aria-label="选择要查看的模型平台"
                >
                  {allTaskPlatforms.map((platform) => {
                    const taskCount = run.tasks.filter(
                      (task) => task.platform === platform,
                    ).length;
                    const doneCount = run.tasks.filter(
                      (task) =>
                        task.platform === platform &&
                        ["submitted", "reviewed", "skipped"].includes(
                          task.state,
                        ),
                    ).length;
                    return (
                      <button
                        key={platform}
                        type="button"
                        role="tab"
                        aria-selected={activeRunPlatform === platform}
                        className={
                          activeRunPlatform === platform ? "selected" : ""
                        }
                        onClick={() => {
                          setActiveRunPlatform(platform);
                          setPlatformTaskPage(1);
                        }}
                      >
                        {platform}
                        <span>
                          {doneCount}/{taskCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {activePlatformTasks.length ? (
                  <>
                    <div className="task-list compact-task-list">
                      {visibleActivePlatformTasks.map(renderRunTask)}
                    </div>
                    {platformTaskPageCount > 1 && (
                      <div className="platform-task-pagination" aria-label="平台任务分页">
                        <span>
                          第 {platformTaskPage} / {platformTaskPageCount} 页 · 每页 {platformTaskPageSize} 条 · 共 {activePlatformTasks.length} 条
                        </span>
                        <div>
                          <button
                            className="secondary"
                            type="button"
                            disabled={platformTaskPage <= 1}
                            onClick={() => setPlatformTaskPage((current) => Math.max(1, current - 1))}
                          >
                            <ChevronLeft size={15} />
                            上一页
                          </button>
                          <button
                            className="secondary"
                            type="button"
                            disabled={platformTaskPage >= platformTaskPageCount}
                            onClick={() => setPlatformTaskPage((current) => Math.min(platformTaskPageCount, current + 1))}
                          >
                            下一页
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="compact-platform-empty">
                    请选择一个已创建任务的平台，查看它的队列与原始证据。
                  </div>
                )}
              </section>
            </section>
          )}
        </>
      )}

      {isResearch && editingQuery && (
        <div className="query-editor-backdrop" role="presentation">
          <section
            className="query-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="query-editor-title"
          >
            <header>
              <div>
                <span className="eyebrow">审核前编辑</span>
                <h3 id="query-editor-title">编辑核心 Query</h3>
                <p>
                  保存任一内容或研究标签后，Query
                  会退回待审核；已发布或冻结版本请先复制为新版本。
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭 Query 编辑"
                disabled={Boolean(busy)}
                onClick={() => setEditingQuery(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="query-edit-layout">
              <section className="query-edit-section query-edit-section--question">
                <div className="query-edit-section-heading">
                  <span>01 · 核心问题</span>
                  <small>填写用户会在真实 AI 平台提问的完整问题。</small>
                </div>
                <label className="query-edit-field query-edit-field--wide">
                  <span>问题（必填）</span>
                  <textarea
                    autoFocus
                    aria-invalid={!queryEditQuestionValid}
                    aria-describedby="query-edit-question-hint"
                    value={queryEdit.question}
                    onChange={(event) =>
                      setQueryEdit((current) => ({
                        ...current,
                        question: event.target.value,
                      }))
                    }
                  />
                  <span
                    id="query-edit-question-hint"
                    className={`query-edit-hint ${queryEditQuestionValid ? "" : "is-error"}`}
                  >
                    {queryEditQuestionLength} / 500 · 至少 8 字
                    {!queryEditQuestionValid ? "，请补充或精简问题。" : ""}
                  </span>
                </label>
              </section>

              <section className="query-edit-section">
                <div className="query-edit-section-heading">
                  <span>02 · 测试定位</span>
                  <small>用于首测排期与后续覆盖诊断。</small>
                </div>
                <div className="query-edit-grid query-edit-grid--three">
                  <label className="query-edit-field">
                    用户意图
                    <select
                      value={queryEdit.intent}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          intent: event.target.value,
                        }))
                      }
                    >
                      {intentOptions.map((intent) => (
                        <option key={intent}>{intent}</option>
                      ))}
                    </select>
                  </label>
                  <label className="query-edit-field">
                    测试优先级
                    <select
                      value={queryEdit.priority}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          priority: event.target.value as
                            "high" | "medium" | "low",
                        }))
                      }
                    >
                      <option value="high">高：首轮必须验证</option>
                      <option value="medium">中：补充验证</option>
                      <option value="low">低：探索性验证</option>
                    </select>
                  </label>
                  <label className="query-edit-field">
                    用户旅程
                    <select
                      value={queryEdit.journeyStage}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          journeyStage: event.target.value,
                        }))
                      }
                    >
                      <option value="认知">认知</option>
                      <option value="了解">了解</option>
                      <option value="比较">比较</option>
                      <option value="转化">转化</option>
                      <option value="使用/复购">使用 / 复购</option>
                    </select>
                  </label>
                </div>
              </section>

              <details
                className="query-edit-advanced"
                open={queryEditAdvancedOpen}
                onToggle={(event) =>
                  setQueryEditAdvancedOpen(
                    (event.currentTarget as HTMLDetailsElement).open,
                  )
                }
              >
                {" "}
                <summary>
                  <span>03 · 研究标签与来源</span>
                  <small>
                    {queryEditAdvancedCount
                      ? `已配置 ${queryEditAdvancedCount} 项，可按需展开修改。`
                      : "可选，用于覆盖诊断、分组与后续归因。"}
                  </small>
                </summary>
                <div className="query-edit-grid query-edit-grid--three">
                  <label className="query-edit-field">
                    Query 类型
                    <select
                      value={queryEdit.queryType}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          queryType: event.target.value,
                        }))
                      }
                    >
                      <option value="品类发现">品类发现</option>
                      <option value="品牌认知">品牌认知</option>
                      <option value="品牌比较">品牌比较</option>
                      <option value="方案评估">方案评估</option>
                      <option value="购买决策">购买决策</option>
                      <option value="口碑与风险">口碑与风险</option>
                    </select>
                  </label>
                  <label className="query-edit-field">
                    目标对象类型
                    <select
                      value={queryEdit.targetEntityType}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          targetEntityType: event.target.value,
                        }))
                      }
                    >
                      <option value="品牌">品牌</option>
                      <option value="竞品">竞品</option>
                      <option value="品类">品类</option>
                      <option value="场景">场景</option>
                    </select>
                  </label>
                  <label className="query-edit-field">
                    Query Group
                    <input
                      value={queryEdit.queryGroup}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          queryGroup: event.target.value,
                        }))
                      }
                      placeholder="如：核心品类 / 竞品对比"
                    />
                  </label>
                  <label className="query-edit-field query-edit-field--wide">
                    目标对象（多个对象用逗号或顿号分隔）
                    <input
                      value={queryEdit.targetEntities}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          targetEntities: event.target.value,
                        }))
                      }
                      placeholder="如：本品牌、竞品 A、竞品 B"
                    />
                  </label>
                  <label className="query-edit-field">
                    目标人群（可选）
                    <input
                      value={queryEdit.audienceSegment}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          audienceSegment: event.target.value,
                        }))
                      }
                      placeholder="如：中小企业负责人"
                    />
                  </label>
                  <label className="query-edit-field">
                    使用场景（可选）
                    <input
                      value={queryEdit.scenario}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          scenario: event.target.value,
                        }))
                      }
                      placeholder="如：采购评估"
                    />
                  </label>
                  <label className="query-edit-field">
                    来源类型
                    <select
                      value={queryEdit.sourceType}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          sourceType: event.target.value,
                        }))
                      }
                    >
                      <option value="manual">人工录入</option>
                      <option value="search-query">搜索词 / 站内词</option>
                      <option value="sales-feedback">销售或客户反馈</option>
                      <option value="competitor-gap">竞品机会缺口</option>
                      <option value="llm-assisted">LLM 辅助生成</option>
                    </select>
                  </label>
                  <label className="query-edit-field query-edit-field--span-two">
                    来源说明（可选）
                    <input
                      value={queryEdit.sourceReference}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          sourceReference: event.target.value,
                        }))
                      }
                      placeholder="如：2026 Q3 客服咨询整理"
                    />
                  </label>
                  <label className="query-edit-toggle">
                    <input
                      type="checkbox"
                      checked={queryEdit.isBaseline}
                      onChange={(event) =>
                        setQueryEdit((current) => ({
                          ...current,
                          isBaseline: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <b>纳入固定基线</b>
                      <small>后续版本对比时持续保留。</small>
                    </span>
                  </label>
                </div>
              </details>

              <section className="query-edit-section">
                <div className="query-edit-section-heading">
                  <span>04 · 纳入依据</span>
                  <small>说明该问题为什么能验证 GEO 曝光或引用。</small>
                </div>
                <label className="query-edit-field query-edit-field--wide">
                  <span>纳入理由（必填）</span>
                  <textarea
                    aria-invalid={!queryEditRationaleValid}
                    value={queryEdit.rationale}
                    onChange={(event) =>
                      setQueryEdit((current) => ({
                        ...current,
                        rationale: event.target.value,
                      }))
                    }
                  />
                  {!queryEditRationaleValid && (
                    <span className="query-edit-hint is-error">
                      请补充纳入理由后保存。
                    </span>
                  )}
                </label>
              </section>
            </div>
            <div
              className={`query-editor-impact ${queryEditWillReopenReview ? "is-warning" : ""}`}
            >
              <ShieldCheck size={16} />
              <span>
                {queryEditWillReopenReview
                  ? "本次修改会将已批准或已排除的 Query 退回待审核；再次批准后才能进入真实平台测试。"
                  : "保存后保持待审核状态；仅已批准的 Query 可进入真实平台测试。"}
              </span>
            </div>
            <footer>
              <button
                className="secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setEditingQuery(null)}
              >
                取消
              </button>
              <button
                className="primary"
                type="button"
                disabled={Boolean(busy) || !queryEditCanSave}
                onClick={saveQueryEdit}
              >
                {busy.startsWith("edit-query-") ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}
                {queryEditSaveLabel}
              </button>
            </footer>
          </section>
        </div>
      )}

      {isTesting && selectedTask && (
        <div
          className="evidence-drawer evidence-review-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={
            evidenceViewMode === "captured"
              ? "查看已采集的平台证据"
              : "录入真实平台证据"
          }
        >
          <div className="drawer-card evidence-review-card">
            <header className="evidence-review-header">
              <div>
                <span className="eyebrow">
                  {evidenceViewMode === "captured"
                    ? "Browser Agent 自动回传"
                    : "受控人工录入"}
                </span>
                <h3>{selectedTask.platform} · 原始回答与来源证据</h3>
                <p>复核本次采集的可见原始回答、回答内引用与平台搜索来源。</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭证据查看"
                onClick={() => setSelectedTask(null)}
              >
                <X size={18} />
              </button>
            </header>
            <p className="question-copy evidence-query-card">
              <span>待验证 Query</span>
              {selectedTask.question}
            </p>
            {evidenceViewMode === "captured" ? (
              <>
                <div className="evidence-context">
                  <div className="capture-trust-note">
                    <ShieldCheck size={16} />
                    <span>
                      已授权本地浏览器回传：仅保留当前页面可见的 <b>原始回答</b>{" "}
                      与 <b>来源证据</b>，系统不会补写。
                    </span>
                  </div>
                  <div className="evidence-summary-row">
                    <span>
                      <History size={15} />
                      采集于{" "}
                      {shortDateTime(selectedTask.observation?.observedAt)}
                    </span>
                    <span>
                      <Link2 size={15} />
                      回答内引用{" "}
                      {
                        capturedLinkGroups(selectedTask.observation ?? null)
                          .answerCitations.length
                      }
                    </span>
                    <span>
                      <Link2 size={15} />
                      平台搜索来源{" "}
                      {
                        platformSourceStats(selectedTask.observation ?? null)
                          .displayCount
                      }
                    </span>
                    <span>
                      <ExternalLink size={15} />
                      可打开原链{" "}
                      {
                        platformSourceStats(selectedTask.observation ?? null)
                          .openableUrlCount
                      }
                    </span>
                  </div>
                </div>
                <div className="evidence-review-grid">
                  <article className="raw-answer-panel">
                    <header>
                      <div>
                        <b>原始页面回答</b>
                        <small>只读 · 保留平台回传的可见文本</small>
                      </div>
                      <div className="raw-answer-tools">
                        <span>{answer.length.toLocaleString("zh-CN")} 字</span>
                        {selectedTask.observation?.answerUrl && (
                          <a
                            className="answer-permalink answer-permalink--panel"
                            href={selectedTask.observation.answerUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            打开平台会话
                          </a>
                        )}
                      </div>
                    </header>
                    <div className="raw-answer-body" tabIndex={0}>
                      {answer || "未回传回答正文。"}
                    </div>
                  </article>
                  <aside
                    className="source-evidence-panel"
                    aria-label="页面来源证据"
                  >
                    <header>
                      <div>
                        <b>页面来源证据</b>
                        <small>
                          只有页面实际暴露的 URL 可打开；没有 URL
                          的来源标题会保留为不可点击证据。
                        </small>
                      </div>
                    </header>
                    <div className="source-evidence-scroll">
                      <section className="source-group">
                        <div className="source-group-title">
                          <span>回答内引用</span>
                          <b>
                            {
                              capturedLinkGroups(
                                selectedTask.observation ?? null,
                              ).answerCitations.length
                            }
                          </b>
                        </div>
                        {capturedLinkGroups(selectedTask.observation ?? null)
                          .answerCitations.length ? (
                          <ol>
                            {capturedLinkGroups(
                              selectedTask.observation ?? null,
                            ).answerCitations.map((link) => (
                              <li key={`answer-${link.url}`}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <span>
                                    <b>{link.title}</b>
                                    <small>{sourceDomain(link.url)}</small>
                                  </span>
                                  <ExternalLink size={15} />
                                </a>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="source-empty">
                            本次未在回答正文中识别到可点击的直接引用链接。
                          </p>
                        )}
                      </section>
                      <section className="source-group platform-source-group">
                        <div className="source-group-title">
                          <span>平台搜索来源</span>
                          <b>
                            {
                              platformSourceStats(
                                selectedTask.observation ?? null,
                              ).displayCount
                            }
                          </b>
                        </div>
                        <p className="source-group-help">
                          例如豆包回答前的“搜索关键词 /
                          参考资料”列表；它们反映平台检索与
                          grounding，不等同于回答正文引用。已识别{" "}
                          {
                            platformSourceStats(
                              selectedTask.observation ?? null,
                            ).visibleCount
                          }{" "}
                          条页面来源，其中{" "}
                          {
                            platformSourceStats(
                              selectedTask.observation ?? null,
                            ).openableUrlCount
                          }{" "}
                          条带可打开 URL。
                        </p>
                        {platformSearchKeywords(
                          selectedTask.observation ?? null,
                        ).length > 0 && (
                          <div
                            className="platform-search-keywords"
                            aria-label="平台实际检索关键词"
                          >
                            <span>平台实际检索关键词</span>
                            <div>
                              {platformSearchKeywords(
                                selectedTask.observation ?? null,
                              ).map((keyword) => (
                                <code key={keyword}>{keyword}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {sourceCaptureNotice(
                          selectedTask.observation ?? null,
                        ) && (
                          <p
                            className={`source-capture-notice ${sourceCaptureNotice(selectedTask.observation ?? null)?.tone ?? "muted"}`}
                            role="status"
                          >
                            {
                              sourceCaptureNotice(
                                selectedTask.observation ?? null,
                              )?.text
                            }
                          </p>
                        )}
                        {platformSourceStats(selectedTask.observation ?? null)
                          .sources.length ? (
                          <ol>
                            {platformSourceStats(
                              selectedTask.observation ?? null,
                            ).sources.map((link) => (
                              <li
                                key={`search-${link.url || `${link.title}-${link.position}`}`}
                              >
                                {link.urlAvailable ? (
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span>
                                      <b>{link.title}</b>
                                      <small>{sourceDomain(link.url)}</small>
                                    </span>
                                    <ExternalLink size={15} />
                                  </a>
                                ) : (
                                  <div className="source-evidence-unavailable">
                                    <span>
                                      <b>{link.title}</b>
                                      <small>
                                        页面未暴露可打开 URL ·
                                        已保留可见来源标题
                                      </small>
                                    </span>
                                    <span className="source-unavailable-badge">
                                      仅标题
                                    </span>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="source-empty">
                            {platformSourceStats(
                              selectedTask.observation ?? null,
                            ).declaredCount
                              ? `页面显示“参考 ${platformSourceStats(selectedTask.observation ?? null).declaredCount} 篇资料”，但未暴露每条来源标题或 URL。系统已保留该数量，不会猜测或补写链接。`
                              : "本次没有从页面中提取到平台搜索来源。若页面实际展示了来源，请重新执行该任务；系统不会猜测或补写 URL。"}
                          </p>
                        )}
                      </section>
                    </div>
                  </aside>
                </div>
              </>
            ) : (
              <>
                <label>
                  原始回答
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="粘贴真实平台中获得的完整回答，不要整理或改写。"
                  />
                </label>
                <label>
                  回答内引用链接（每行一个 URL）
                  <textarea
                    value={citations}
                    onChange={(event) => setCitations(event.target.value)}
                    placeholder="https://example.com/source"
                  />
                </label>
                <div className="evidence-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={freshSession}
                      onChange={(event) =>
                        setFreshSession(event.target.checked)
                      }
                    />
                    已使用新会话 / 无个性化上下文
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={searchEnabled}
                      onChange={(event) =>
                        setSearchEnabled(event.target.checked)
                      }
                    />
                    已记录搜索或联网状态
                  </label>
                </div>
              </>
            )}
            <footer className="drawer-actions">
              {evidenceViewMode === "captured" ? (
                <>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setSelectedTask(null)}
                  >
                    返回任务列表
                  </button>
                  {sourceCaptureNotice(selectedTask.observation ?? null)
                    ?.legacy && (
                    <button
                      className="secondary"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        void retryBrowserTask(selectedTask);
                        setSelectedTask(null);
                      }}
                    >
                      <RefreshCw size={15} />
                      用新版重新采集
                    </button>
                  )}
                  {selectedTask.state === "submitted" && (
                    <>
                      <button
                        className="secondary"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          reviewTask(selectedTask, "needs_revision")
                        }
                      >
                        要求补充
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => reviewTask(selectedTask, "approved")}
                      >
                        <Check size={15} />
                        批准证据
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setSelectedTask(null)}
                  >
                    取消
                  </button>
                  <button
                    className="primary"
                    disabled={Boolean(busy) || !answer.trim()}
                    onClick={submitEvidence}
                  >
                    {busy.startsWith("submit-") ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    提交原始证据
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {datasetManagerOpen && (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-scrim"
            type="button"
            aria-label="关闭 Query 数据集管理"
            onClick={closeDatasetManager}
          />
          <section
            className="publication-drawer dataset-manager-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-manager-title"
          >
            <header>
              <div>
                <span className="eyebrow">当前项目 · 版本治理</span>
                <h3 id="dataset-manager-title">Query 数据集管理</h3>
                <p>归档不影响已完成测试、GEO 诊断或报告；永久删除仅适用于从未使用的草稿。</p>
              </div>
              <button
                ref={datasetManagerCloseRef}
                className="icon-button"
                type="button"
                aria-label="关闭 Query 数据集管理"
                onClick={closeDatasetManager}
              >
                <X size={18} />
              </button>
            </header>

            <div className="dataset-manager-filters" role="tablist" aria-label="筛选 Query 数据集">
              {([
                ["all", "全部"],
                ["active", "当前可用"],
                ["draft", "草稿"],
                ["archived", "已归档"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  className={datasetManagerFilter === value ? "selected" : ""}
                  type="button"
                  role="tab"
                  aria-selected={datasetManagerFilter === value}
                  onClick={() => setDatasetManagerFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="dataset-manager-list">
              {filteredDatasetHistory.length ? (
                filteredDatasetHistory.map((dataset) => {
                  const canDelete = dataset.lifecycleStatus === "draft";
                  return (
                    <article
                      key={dataset.id}
                      className={`dataset-manager-row ${dataset.isActive ? "is-active" : ""} ${dataset.archivedAt ? "is-archived" : ""}`}
                    >
                      <div className="dataset-manager-row__top">
                        <div>
                          <div className="dataset-manager-name">
                            <b>{dataset.name}</b>
                            {dataset.isActive && !dataset.archivedAt && (
                              <span className="status ok">当前使用中</span>
                            )}
                            {dataset.archivedAt && (
                              <span className="status muted">已归档</span>
                            )}
                            {!dataset.archivedAt && isTestableQuerySet(dataset) && (
                              <span className="status submitted">可测试</span>
                            )}
                          </div>
                          <small>
                            {queryDatasetMarketLabel(dataset)} · v{dataset.version} · 更新于 {shortDateTime(dataset.updatedAt)}
                          </small>
                        </div>
                        <span className="dataset-manager-lifecycle">
                          {queryDatasetLifecycleLabel(dataset)}
                        </span>
                      </div>
                      <div className="dataset-manager-meta">
                        <span>{dataset.health.approved} 条已批准</span>
                        <span>{dataset.health.excluded} 条已排除</span>
                        <span>{dataset.health.draft} 条待审核</span>
                      </div>
                      <div className="dataset-manager-actions">
                        {!dataset.archivedAt &&
                          !dataset.isActive &&
                          dataset.health.approved > 0 && (
                            <button
                              className="secondary compact"
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() => void activateDataset(dataset)}
                            >
                              <CheckCircle2 size={14} />
                              设为当前
                            </button>
                          )}
                        {dataset.archivedAt ? (
                          <button
                            className="secondary compact"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void restoreDataset(dataset)}
                          >
                            <RotateCcw size={14} />
                            恢复
                          </button>
                        ) : (
                          <button
                            className="link-button"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void archiveDataset(dataset)}
                          >
                            <Archive size={14} />
                            归档
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="link-button dataset-manager-danger"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setDeleteDatasetTarget(dataset);
                              setDeleteDatasetConfirmation("");
                            }}
                          >
                            <Trash2 size={14} />
                            永久删除
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="dataset-manager-empty">当前筛选下没有 Query Dataset。</div>
              )}
            </div>

            {deleteDatasetTarget && (
              <section className="dataset-delete-confirmation" aria-live="polite">
                <div>
                  <strong>永久删除未使用草稿</strong>
                  <p>此操作不可恢复。请输入完整名称确认：<b>{deleteDatasetTarget.name}</b></p>
                </div>
                <input
                  value={deleteDatasetConfirmation}
                  onChange={(event) => setDeleteDatasetConfirmation(event.target.value)}
                  placeholder="输入完整 Dataset 名称"
                  aria-label="输入完整 Dataset 名称确认永久删除"
                />
                <div className="dataset-delete-actions">
                  <button
                    className="secondary compact"
                    type="button"
                    onClick={() => {
                      setDeleteDatasetTarget(null);
                      setDeleteDatasetConfirmation("");
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="primary compact dataset-manager-danger-button"
                    type="button"
                    disabled={
                      Boolean(busy) ||
                      deleteDatasetConfirmation !== deleteDatasetTarget.name
                    }
                    onClick={() => void deleteDataset()}
                  >
                    <Trash2 size={14} />
                    确认永久删除
                  </button>
                </div>
              </section>
            )}
          </section>
        </div>
      )}

      {isResearch && promptManagerOpen && (
        <div
          className="prompt-manager-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="管理核心 Query 生成 Prompt"
        >
          <section className="prompt-manager">
            <header>
              <div>
                <span className="eyebrow">Query 生成治理</span>
                <h3>管理 Prompt</h3>
                <p>
                  Prompt 仅影响核心 Query
                  生成；不会触发真实平台采集，也不会读取或展示 API Key。
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭 Prompt 管理"
                onClick={() => setPromptManagerOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="prompt-manager-grid">
              <div className="prompt-editor">
                <label>
                  Prompt 名称
                  <input
                    value={promptDraftName}
                    onChange={(event) => setPromptDraftName(event.target.value)}
                    placeholder="例如：B2B GEO 核心 Query 生成"
                  />
                </label>
                <label>
                  Prompt 模板
                  <textarea
                    value={promptDraftTemplate}
                    onChange={(event) =>
                      setPromptDraftTemplate(event.target.value)
                    }
                    placeholder="说明模型需要如何生成 Query…"
                  />
                </label>
                <div className="prompt-token-guide">
                  <b>必填变量</b>
                  <div>
                    {requiredPromptVariables.map((token) => (
                      <code
                        className={
                          missingPromptVariables.includes(token)
                            ? "missing"
                            : ""
                        }
                        key={token}
                      >
                        {token}
                      </code>
                    ))}
                  </div>
                  {missingPromptVariables.length ? (
                    <small>
                      缺少：{missingPromptVariables.join("、")}
                      。保存前需要补齐。
                    </small>
                  ) : (
                    <small>
                      变量完整。系统将在每次执行时以当前产品档案和生成输入替换这些变量。
                    </small>
                  )}
                </div>
                <div className="prompt-optimize">
                  <div>
                    <WandSparkles size={16} />
                    <span>
                      <b>让已验证模型给出优化建议</b>
                      <small>只生成建议，不会自动覆盖或保存当前版本。</small>
                    </span>
                  </div>
                  <label>
                    优化目标
                    <input
                      value={optimizationGoal}
                      onChange={(event) =>
                        setOptimizationGoal(event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="secondary"
                    type="button"
                    disabled={Boolean(busy) || !selectedProvider}
                    onClick={optimizePrompt}
                  >
                    {busy === "optimize-prompt" ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <WandSparkles size={15} />
                    )}
                    生成优化建议
                  </button>
                </div>
              </div>
              <aside className="prompt-side">
                <section>
                  <div className="prompt-side-title">
                    <Eye size={16} />
                    <div>
                      <b>本次输入预览</b>
                      <small>仅本地预览；实际产品档案以服务端记录为准。</small>
                    </div>
                  </div>
                  <pre>{promptPreview || "请填写 Prompt 模板"}</pre>
                </section>
                <section>
                  <div className="prompt-side-title">
                    <History size={16} />
                    <div>
                      <b>版本历史</b>
                      <small>
                        恢复旧版会新建一个当前版本，保留所有审计记录。
                      </small>
                    </div>
                  </div>
                  <div className="prompt-history">
                    {promptHistory.map((item) => (
                      <article
                        key={item.id}
                        className={item.id === prompt?.id ? "active" : ""}
                      >
                        <div>
                          <b>
                            {item.name} · v{item.version}
                          </b>
                          <small>
                            {item.id === prompt?.id
                              ? "当前生效"
                              : item.status === "archived"
                                ? "历史版本"
                                : item.status}
                          </small>
                        </div>
                        {item.id !== prompt?.id && (
                          <button
                            className="link-button"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => restorePrompt(item)}
                          >
                            <RotateCcw size={13} />
                            恢复为新版本
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
            <footer>
              <span>
                保存后，下一次「调用 LLM 生成 Query」才会使用新 Prompt 版本。
              </span>
              <div>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setPromptManagerOpen(false)}
                >
                  取消
                </button>
                <button
                  className="primary"
                  type="button"
                  disabled={
                    Boolean(busy) || Boolean(missingPromptVariables.length)
                  }
                  onClick={savePrompt}
                >
                  {busy === "save-prompt" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  保存为新版本
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}


