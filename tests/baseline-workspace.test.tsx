// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  activateBaselineQuerySet: vi.fn(),
  appendRealSurfaceTestRunPlatforms: vi.fn(),
  archiveBaselineQuerySet: vi.fn(),
  cancelBrowserAgentBatchStart: vi.fn(),
  claimRealSurfaceTask: vi.fn(),
  createManualBaselineSeedQuery: vi.fn(),
  createManualBaselineQuerySet: vi.fn(),
  createBaselineQuerySetRevision: vi.fn(),
  createRealSurfaceTestRun: vi.fn(),
  deleteUnusedBaselineQuerySet: vi.fn(),
  generateBaselineQuerySet: vi.fn(),
  getBrandDiagnostic: vi.fn(),
  getLatestRealSurfaceTestRun: vi.fn(),
  getQueryGenerationSettings: vi.fn(),
  getRealSurfaceTestRun: vi.fn(),
  startBrowserAgentBatch: vi.fn(),
  listBaselineQuerySets: vi.fn(),
  listBrandDiagnostics: vi.fn(),
  listBrowserAgents: vi.fn(),
  listQueryGenerationPromptHistory: vi.fn(),
  optimizeQueryGenerationPrompt: vi.fn(),
  publishBaselineQuerySet: vi.fn(),
  restoreBaselineQuerySet: vi.fn(),
  restoreQueryGenerationPrompt: vi.fn(),
  reviewRealSurfaceObservation: vi.fn(),
  submitRealSurfaceObservation: vi.fn(),
  updateBaselineQueryCoverageTargets: vi.fn(),
  updateBaselineSeedQuery: vi.fn(),
  updateQueryGenerationPrompt: vi.fn(),
}));

vi.mock("../src/api", async () => {
  const actual =
    await vi.importActual<typeof import("../src/api")>("../src/api");
  return { ...actual, ...api };
});
vi.mock("../src/BrandDiagnostics", () => ({ getWorkspaceSession: vi.fn() }));

import { getWorkspaceSession } from "../src/BrandDiagnostics";
import { BaselineWorkspace } from "../src/BaselineWorkspace";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const session = {
  workspaceId: "workspace-1",
  userId: "admin-1",
  userName: "管理员",
};
const project = {
  id: "project-1",
  name: "知识库 GEO",
  brandName: "示例品牌",
  website: "https://example.test",
  markets: ["中国"],
  locales: ["zh-CN"],
  audiences: ["企业知识库负责人"],
  objective: "建立首轮基线",
  ownerId: "admin-1",
  status: "draft",
  updatedAt: "2026-09-28T00:00:00.000Z",
};
const prompt = {
  id: "prompt-1",
  workspaceId: "workspace-1",
  name: "核心 Query 生成 Prompt",
  template:
    "产品 {{product_profile}} 关键词 {{keywords}} 意图 {{intents}} 市场 {{market}} 语言 {{locale}} 数量 {{count}}",
  version: 3,
  status: "active" as const,
  createdAt: "2026-09-28T00:00:00.000Z",
  createdBy: "admin-1",
  updatedAt: "2026-09-28T00:00:00.000Z",
  updatedBy: "admin-1",
};
const querySet = {
  id: "set-1",
  workspaceId: "workspace-1",
  caseId: "project-1",
  name: "中国 · 首轮核心 Query",
  marketPack: "CN" as const,
  locale: "zh-CN",
  generationMode: "template" as const,
  status: "draft" as const,
  lifecycleStatus: "in_review" as const,
  version: 1,
  isActive: true,
  archivedAt: null,
  archivedBy: null,
  coverageTargets: {},
  coverage: {
    queryTypes: ["category-discovery", "capability-evaluation"],
    journeys: ["awareness", "consideration"],
    cells: [
      {
        key: "category-discovery::awareness",
        queryType: "category-discovery",
        journeyStage: "awareness",
        current: 1,
        target: 4,
        gap: 3,
        state: "gap" as const,
        queryIds: ["query-1"],
      },
      {
        key: "category-discovery::consideration",
        queryType: "category-discovery",
        journeyStage: "consideration",
        current: 0,
        target: 0,
        gap: 0,
        state: "not-applicable" as const,
        queryIds: [],
      },
      {
        key: "capability-evaluation::awareness",
        queryType: "capability-evaluation",
        journeyStage: "awareness",
        current: 0,
        target: 0,
        gap: 0,
        state: "not-applicable" as const,
        queryIds: [],
      },
      {
        key: "capability-evaluation::consideration",
        queryType: "capability-evaluation",
        journeyStage: "consideration",
        current: 4,
        target: 4,
        gap: 0,
        state: "covered" as const,
        queryIds: [],
      },
    ],
    summary: {
      applicableCells: 2,
      coveredCells: 1,
      gapCells: 1,
      missingQueries: 3,
    },
  },
  health: {
    total: 12,
    approved: 0,
    draft: 12,
    excluded: 0,
    queryTypes: ["品类发现"],
    journeys: ["认知"],
    targets: ["品牌"],
    recommendations: ["补充已审核 Query"],
  },
  createdAt: "2026-09-28T00:00:00.000Z",
  createdBy: "admin-1",
  updatedAt: "2026-09-28T00:00:00.000Z",
  updatedBy: "admin-1",
  queries: Array.from({ length: 12 }, (_, index) => ({
    id: `query-${index + 1}`,
    workspaceId: "workspace-1",
    querySetId: "set-1",
    sequence: index + 1,
    question: `测试 Query ${index + 1}`,
    intent: "品类发现",
    rationale: `测试理由 ${index + 1}`,
    market: "中国",
    locale: "zh-CN",
    priority: index < 2 ? ("high" as const) : ("medium" as const),
    status: "draft" as const,
    provenance: index === 11 ? "manual" : "template:product-profile-v1",
    queryType: "品类发现",
    journeyStage: "认知",
    targetEntityType: "品牌",
    targetEntities: ["示例品牌"],
    sourceType: index === 11 ? "manual" : "template",
    isBaseline: true,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
  })),
};

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
function setValue(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("core Query baseline workspace", () => {
  let container: HTMLDivElement;
  let root: Root;
  const go = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspaceSession).mockResolvedValue(session);
    api.listBrandDiagnostics.mockResolvedValue({ projects: [project] });
    api.getBrandDiagnostic.mockResolvedValue({
      project: {
        project,
        facts: [],
        queryScope: {
          id: "scope-1",
          journeys: ["认知"],
          queryTypes: ["品类发现"],
          markets: ["中国"],
          locales: ["zh-CN"],
          competitorSeeds: ["竞品甲"],
          expectedCount: 20,
          datasetVersionLabel: "v1",
          updatedAt: "2026-09-28T00:00:00.000Z",
        },
        brief: {
          id: "brief-1",
          caseId: "project-1",
          version: 1,
          goal: "baseline",
          category: "企业知识库",
          marketPacks: ["CN"],
          intents: ["品类发现"],
          evidenceUrls: [],
          competitors: ["竞品甲"],
          executionPreference: "ai-assisted",
          createdAt: "2026-09-28T00:00:00.000Z",
          updatedAt: "2026-09-28T00:00:00.000Z",
          updatedBy: "admin-1",
        },
        activities: [],
        recommendations: [],
        readiness: {
          blockers: [],
          approvedFacts: 0,
          candidateFacts: 0,
          hasScope: true,
          hasPlan: true,
          baselineReady: false,
        },
        coverage: {
          expected: 20,
          imported: 0,
          rate: 0,
          status: "pending",
          message: "待采集",
        },
        collectionBoundary: "controlled-manual",
      },
    });
    api.getLatestRealSurfaceTestRun.mockResolvedValue({ testRun: null });
    api.listBrowserAgents.mockResolvedValue({ agents: [] });
    api.listBaselineQuerySets.mockResolvedValue({ querySets: [querySet] });
    api.getQueryGenerationSettings.mockResolvedValue({
      prompt,
      promptHistory: [prompt],
      providers: [],
    });
    api.listQueryGenerationPromptHistory.mockResolvedValue({
      prompts: [prompt],
    });
    api.createManualBaselineSeedQuery.mockResolvedValue({
      querySet: {
        ...querySet,
        queries: [
          ...querySet.queries,
          {
            ...querySet.queries[0],
            id: "manual-added",
            question: "新建人工问题",
            provenance: "manual",
          },
        ],
      },
    });
    api.updateBaselineQueryCoverageTargets.mockResolvedValue({ querySet });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps platform configuration locked until a Query Dataset contains approved questions", async () => {
    api.listBaselineQuerySets.mockResolvedValue({ querySets: [] });
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="testing" />);
    });
    await settle();

    expect(container.textContent).toContain("还没有可用的 Query Dataset");
    expect(container.textContent).toContain("先建立 Query Dataset");
    expect(container.textContent).toContain("前往 Query 研究");
    expect(container.textContent).not.toContain("选择测试平台");
    expect(
      [...container.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("创建真实平台测试批次"),
      ),
    ).toBe(false);
  });

  it("renders a no-connection state, paginates the Query review at ten rows, and adds manual Queries to the active set", async () => {
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    expect(container.querySelectorAll(".query-table-row")).toHaveLength(10);
    expect(container.textContent).toContain("测试 Query 1");
    expect(container.textContent).not.toContain("测试 Query 11");

    const next = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("下一页"),
    ) as HTMLButtonElement;
    await act(async () => {
      next.click();
    });
    expect(container.textContent).toContain("测试 Query 11");
    expect(container.querySelectorAll(".query-table-row")).toHaveLength(2);

    const fill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("生成与补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      fill.click();
    });
    expect(container.textContent).toContain("尚未配置可执行模型连接");
    expect(container.textContent).toContain("调用 LLM 生成 Query");

    const manual = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("手动添加"),
    ) as HTMLButtonElement;
    await act(async () => {
      manual.click();
    });
    const textareas = container.querySelectorAll("textarea");
    await act(async () => {
      setValue(textareas[0], "企业知识库如何验证回答的来源？");
      setValue(textareas[1], "来自客户访谈的可信度问题。");
    });
    const add = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("加入当前 Query 集"),
    ) as HTMLButtonElement;
    await act(async () => {
      add.click();
      await Promise.resolve();
    });
    await settle();

    expect(api.createManualBaselineSeedQuery).toHaveBeenCalledWith(
      session,
      "set-1",
      expect.objectContaining({
        question: "企业知识库如何验证回答的来源？",
        intent: "品类发现",
        priority: "high",
      }),
    );
    expect(container.textContent).toContain("手动 Query 已加入当前集合");
  });

  it("renders server coverage maps without blanking the Query research page", async () => {
    api.listBaselineQuerySets.mockResolvedValue({
      querySets: [
        {
          ...querySet,
          health: {
            ...querySet.health,
            queryTypes: { general: 12 },
            journeys: { consideration: 12 },
            targets: { category: 12 },
          },
        },
      ],
    });

    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    expect(container.textContent).toContain("类型：general（12）");
    expect(container.textContent).toContain("旅程：consideration（12）");
    expect(container.textContent).toContain("对象：category（12）");
    expect(container.querySelectorAll(".query-table-row")).toHaveLength(10);
  });

  it("lets a reviewer inspect a coverage gap, calibrate its target, and enter targeted fill mode", async () => {
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    const coverage = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("覆盖地图"),
    ) as HTMLButtonElement;
    await act(async () => {
      coverage.click();
    });
    expect(container.textContent).toContain("当前 1 / 目标 4");
    expect(container.textContent).toContain("缺口 3 条");

    const gap = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("待补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      gap.click();
    });
    expect(container.textContent).toContain("当前 Query");
    expect(container.textContent).toContain("使用 AI 补齐 3 条");

    const target = container.querySelector(
      'input[aria-label="覆盖目标数量"]',
    ) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(target, "2");
    await act(async () => {
      target.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存目标"),
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
    });
    await settle();
    expect(api.updateBaselineQueryCoverageTargets).toHaveBeenCalledWith(
      session,
      "set-1",
      expect.objectContaining({ "category-discovery::awareness": 2 }),
    );

    const aiFill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("使用 AI 补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      aiFill.click();
    });
    expect(container.textContent).toContain("正在定向补齐：品类发现 × 认知");
    const template = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("模板草案"),
    ) as HTMLButtonElement;
    expect(template.disabled).toBe(true);
  });

  it("explains the disabled Test Run action and lets a reviewer edit a Query before re-approval", async () => {
    api.updateBaselineSeedQuery.mockResolvedValue({
      querySet: {
        ...querySet,
        queries: querySet.queries.map((item) =>
          item.id === "query-1"
            ? {
                ...item,
                question: "企业知识库如何让回答附带可追溯来源？",
                intent: "能力评估",
                priority: "high" as const,
                rationale: "用于验证来源可追溯能力是否会被 AI 平台引用。",
                status: "draft" as const,
              }
            : item,
        ),
      },
    });
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    expect(
      [...container.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("创建真实平台测试批次"),
      ),
    ).toBe(false);
    expect(container.textContent).toContain("审核核心问题");

    const edit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("编辑"),
    ) as HTMLButtonElement;
    await act(async () => {
      edit.click();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "编辑核心 Query",
    );
    const editor = container.querySelector(".query-editor") as HTMLElement;
    const fields = editor.querySelectorAll("textarea");
    await act(async () => {
      setValue(fields[0], "企业知识库如何让回答附带可追溯来源？");
      setValue(fields[1], "用于验证来源可追溯能力是否会被 AI 平台引用。");
    });
    const save = [...editor.querySelectorAll("button")].find(
      (button) =>
        button.classList.contains("primary") &&
        button.textContent?.includes("保存"),
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
    });
    await settle();

    expect(api.updateBaselineSeedQuery).toHaveBeenCalledWith(
      session,
      "set-1",
      "query-1",
      expect.objectContaining({
        question: "企业知识库如何让回答附带可追溯来源？",
        intent: "品类发现",
        priority: "high",
        rationale: "用于验证来源可追溯能力是否会被 AI 平台引用。",
      }),
    );
    expect(container.textContent).toContain("Query 已保存，并已回到待审核状态");
  });

  it("shows the current Prompt template and rendered input before any LLM run", async () => {
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    const fill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("生成与补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      fill.click();
    });

    const preview = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("预览 Prompt"),
    ) as HTMLButtonElement;
    await act(async () => {
      preview.click();
    });
    await settle();

    expect(container.textContent).toContain("当前 Prompt 内容");
    expect(container.textContent).toContain("Prompt 模板");
    expect(container.textContent).toContain("本次渲染预览");
    expect(container.textContent).toContain("产品 {{product_profile}}");
    expect(container.textContent).toContain("请填写核心关键词");
  });

  it("blocks LLM generation before a verified model connection is configured", async () => {
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    const fill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("生成与补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      fill.click();
    });

    const generate = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("调用 LLM 生成 Query"),
    ) as HTMLButtonElement;

    expect(generate).toBeTruthy();
    expect(generate.disabled).toBe(true);
    expect(generate.title).toContain("配置并验证模型连接");
    expect(api.generateBaselineQuerySet).not.toHaveBeenCalled();
    expect(container.textContent).toContain("尚未配置可执行模型连接");
  });

  it("manages the Prompt in the baseline workflow and makes a real LLM generation visible", async () => {
    const verifiedProvider = {
      id: "provider-1",
      providerId: "通义千问（百炼）",
      market: "CN" as const,
      locale: "zh-CN",
      collectionMode: "official-api" as const,
      status: "configured" as const,
      version: 1,
      executable: true,
      execution: {
        baseUrl: "https://example.test/v1",
        modelName: "qwen-plus",
        updatedAt: "2026-09-28T00:00:00.000Z",
        updatedBy: "admin-1",
      },
      credential: {
        configured: true,
        encryptionVersion: "1",
        lastFour: "1234",
        createdAt: "2026-09-28T00:00:00.000Z",
        updatedAt: "2026-09-28T00:00:00.000Z",
      },
      test: {
        status: "verified" as const,
        model: "qwen-plus",
        testedAt: "2026-09-28T00:00:00.000Z",
        latencyMs: 123,
      },
    };
    api.getQueryGenerationSettings.mockResolvedValue({
      prompt,
      promptHistory: [prompt],
      providers: [verifiedProvider],
    });
    api.generateBaselineQuerySet.mockResolvedValue({
      querySet: {
        ...querySet,
        id: "llm-set",
        generationMode: "llm-assisted",
        queries: querySet.queries.slice(0, 3),
      },
      generation: {
        mode: "llm",
        providerId: "provider-1",
        model: "qwen-plus",
        promptVersion: 3,
        label: "LLM 调用完成",
      },
    });
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    const fill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("生成与补齐"),
    ) as HTMLButtonElement;
    await act(async () => {
      fill.click();
    });

    const manage = [...container.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "查看并管理生成 Prompt",
    ) as HTMLButtonElement;
    await act(async () => {
      manage.click();
    });
    await settle();
    expect(container.textContent).toContain("管理 Prompt");
    expect(container.textContent).toContain("必填变量");
    expect(container.textContent).toContain("本次输入预览");
    expect(container.textContent).toContain("版本历史");

    const keyword = [...container.querySelectorAll("input")].find((input) =>
      input.placeholder.includes("AI 知识库"),
    ) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(keyword, "AI 知识库, 知识图谱");
    await act(async () => {
      keyword.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const close = container.querySelector(
      'button[aria-label="关闭 Prompt 管理"]',
    ) as HTMLButtonElement;
    await act(async () => {
      close.click();
    });
    const generate = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("调用 LLM 生成 Query"),
    ) as HTMLButtonElement;
    await act(async () => {
      generate.click();
    });
    await settle();

    expect(api.generateBaselineQuerySet).toHaveBeenCalledWith(
      session,
      "project-1",
      expect.objectContaining({
        generator: "llm",
        providerConfigurationId: "provider-1",
        promptId: "prompt-1",
        keywords: ["AI 知识库", "知识图谱"],
      }),
    );
    expect(container.textContent).toContain("LLM Query 生成完成");
    expect(container.textContent).toContain("已生成 3 条 Query");
  });

  it("opens the compact Dataset manager and only exposes testable versions to real-platform testing", async () => {
    const readySet = {
      ...querySet,
      id: "set-ready",
      name: "中国 · 已发布 Query",
      isActive: true,
      lifecycleStatus: "ready_for_test" as const,
      health: { ...querySet.health, approved: 5, draft: 0 },
      queries: querySet.queries.map((query, index) => ({
        ...query,
        status: index < 5 ? ("approved" as const) : ("excluded" as const),
      })),
    };
    const secondReadySet = {
      ...readySet,
      id: "set-ready-en",
      name: "美国 · 已发布 Query",
      marketPack: "US" as const,
      locale: "en-US",
      isActive: false,
    };
    const draftSet = {
      ...querySet,
      id: "set-draft",
      name: "中国 · 未审核草稿",
      isActive: false,
    };
    const archivedSet = {
      ...readySet,
      id: "set-archived",
      name: "中国 · 已归档版本",
      isActive: false,
      archivedAt: "2026-09-29T00:00:00.000Z",
    };
    api.listBaselineQuerySets.mockResolvedValue({
      querySets: [readySet, secondReadySet, draftSet, archivedSet],
    });

    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="testing" />);
    });
    await settle();

    const selector = container.querySelector(
      ".dataset-version-field select",
    ) as HTMLSelectElement;
    expect([...selector.options].map((option) => option.textContent)).toEqual([
      expect.stringContaining("中国 · 已发布 Query"),
      expect.stringContaining("美国 · 已发布 Query"),
    ]);

    const manage = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("管理数据集"),
    ) as HTMLButtonElement;
    await act(async () => {
      manage.click();
    });

    expect(container.textContent).toContain("Query 数据集管理");
    expect(container.textContent).toContain("中国 · 未审核草稿");
    expect(container.textContent).toContain("中国 · 已归档版本");
  });

  it("manages history actions in context and requires an exact name before permanent deletion", async () => {
    const draftSet = {
      ...querySet,
      id: "set-draft",
      name: "可清理草稿",
      isActive: true,
      lifecycleStatus: "draft" as const,
    };
    api.listBaselineQuerySets.mockResolvedValue({ querySets: [draftSet] });
    api.archiveBaselineQuerySet.mockResolvedValue({
      querySet: { ...draftSet, archivedAt: "2026-10-01T00:00:00.000Z", isActive: false },
    });
    api.deleteUnusedBaselineQuerySet.mockResolvedValue({
      deleted: { id: "set-draft", caseId: "project-1" },
    });

    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="research" />);
    });
    await settle();

    const manage = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("管理数据集"),
    ) as HTMLButtonElement;
    await act(async () => {
      manage.click();
    });
    const deleteButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("永久删除"),
    ) as HTMLButtonElement;
    await act(async () => {
      deleteButton.click();
    });

    const confirm = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("确认永久删除"),
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input = container.querySelector(
      'input[aria-label="输入完整 Dataset 名称确认永久删除"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "可清理草稿");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      confirm.click();
      await Promise.resolve();
    });
    await settle();
    expect(api.deleteUnusedBaselineQuerySet).toHaveBeenCalledWith(
      session,
      "set-draft",
      "可清理草稿",
    );
  });

  it("keeps testing mode read-only for Query data and exposes the Dataset handoff before run setup", async () => {
    api.listBaselineQuerySets.mockResolvedValue({
      querySets: [
        {
          ...querySet,
          status: "approved" as const,
          lifecycleStatus: "ready_for_test" as const,
          health: {
            ...querySet.health,
            approved: 5,
            draft: 0,
            excluded: 7,
            recommendations: [],
          },
          queries: querySet.queries.map((query, index) => ({
            ...query,
            status: index < 5 ? ("approved" as const) : ("excluded" as const),
          })),
        },
      ],
    });
    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="testing" />);
    });
    await settle();

    expect(container.textContent).toContain("Dataset 交接");
    expect(container.textContent).toContain("当前 Dataset");
    expect(container.textContent).toContain("本批次将使用全部已批准 Query");
    expect(container.textContent).toContain("配置真实平台测试");
    expect(container.textContent).not.toContain("调用 LLM 生成 Query");
    expect(container.textContent).not.toContain("手动创建");
    expect(container.textContent).not.toContain("管理 Prompt");
    expect(container.querySelectorAll(".query-table-row")).toHaveLength(0);
    expect(api.getQueryGenerationSettings).not.toHaveBeenCalled();
  });

  it("runs each model in an independent Browser Agent lane without mixing Query queues", async () => {
    const onlineAgent = {
      id: "agent-1",
      workspaceId: "workspace-1",
      label: "我的 Windows 浏览器采集代理",
      platforms: ["豆包", "Kimi", "DeepSeek"],
      adapters: [
        { id: "doubao-web", version: "0.3.12", platform: "豆包" },
        { id: "kimi-web", version: "0.3.11", platform: "Kimi" },
        { id: "deepseek-web", version: "v0.3.11", platform: "DeepSeek" },
      ],
      status: "online" as const,
      lastSeenAt: "2026-09-29T00:00:00.000Z",
      createdAt: "2026-09-28T00:00:00.000Z",
      createdBy: "admin-1",
    };
    const approvedSet = {
      ...querySet,
      status: "approved" as const,
      lifecycleStatus: "ready_for_test" as const,
      health: {
        total: 12,
        approved: 5,
        draft: 0,
        excluded: 7,
        queryTypes: ["品类发现"],
        journeys: ["认知"],
        targets: ["品牌"],
        recommendations: [],
      },
      queries: querySet.queries.map((query, index) => ({
        ...query,
        status: index < 5 ? ("approved" as const) : ("excluded" as const),
      })),
    };
    const run = {
      id: "run-start",
      workspaceId: "workspace-1",
      caseId: "project-1",
      querySetId: "set-1",
      name: "首轮真实平台测试",
      marketPack: "CN" as const,
      locale: "zh-CN",
      collectionMode: "controlled-manual" as const,
      executionMode: "browser-agent" as const,
      browserAgentId: "agent-1",
      state: "collecting" as const,
      instructions: "在本地浏览器执行。",
      createdAt: "2026-09-29T00:00:00.000Z",
      createdBy: "admin-1",
      updatedAt: "2026-09-29T00:00:00.000Z",
      updatedBy: "admin-1",
      progress: { total: 2, byState: { unassigned: 2 }, state: "collecting" },
      startRequests: [],
      tasks: [
        {
          id: "task-kimi",
          workspaceId: "workspace-1",
          testRunId: "run-start",
          seedQueryId: "query-1",
          platform: "Kimi",
          providerFamily: "kimi",
          state: "unassigned" as const,
          executionMode: "browser-agent" as const,
          browserAgentId: "agent-1",
          agentState: "queued" as const,
          adapterId: "kimi-web",
          adapterVersion: "0.2.0",
          attemptNumber: 1,
          question: "Kimi 测试 Query",
          intent: "品类发现",
          rationale: "验证 Kimi 独立执行。",
        },
        {
          id: "task-deepseek",
          workspaceId: "workspace-1",
          testRunId: "run-start",
          seedQueryId: "query-2",
          platform: "DeepSeek",
          providerFamily: "deepseek",
          state: "unassigned" as const,
          executionMode: "browser-agent" as const,
          browserAgentId: "agent-1",
          agentState: "queued" as const,
          adapterId: "deepseek-web",
          adapterVersion: "0.2.0",
          attemptNumber: 1,
          question: "DeepSeek 测试 Query",
          intent: "能力评估",
          rationale: "验证 DeepSeek 独立执行。",
        },
      ],
    };
    const kimiRequest = {
      id: "start-kimi",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      testRunId: "run-start",
      platform: "Kimi",
      status: "requested" as const,
      requestedBy: "admin-1",
      requestedAt: "2026-09-29T00:00:00.000Z",
      expiresAt: "2026-09-29T00:05:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
    };
    const deepseekRequest = {
      ...kimiRequest,
      id: "start-deepseek",
      platform: "DeepSeek",
    };
    api.listBrowserAgents.mockResolvedValue({ agents: [onlineAgent] });
    api.listBaselineQuerySets.mockResolvedValue({ querySets: [approvedSet] });
    api.getLatestRealSurfaceTestRun.mockResolvedValue({ testRun: run });
    api.startBrowserAgentBatch.mockImplementation(
      async (
        _session: unknown,
        _runId: string,
        input: { platform: string },
      ) => ({
        startRequest: input.platform === "Kimi" ? kimiRequest : deepseekRequest,
        testRun: {
          ...run,
          startRequests:
            input.platform === "Kimi"
              ? [kimiRequest]
              : [kimiRequest, deepseekRequest],
        },
      }),
    );

    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="testing" />);
    });
    await settle();
    expect(container.textContent).toContain(
      "不同平台可并行；同一平台按 Query 严格串行",
    );
    expect(container.textContent).toContain("Kimi");
    expect(container.textContent).toContain("DeepSeek Query 列表");
    expect(container.textContent).not.toContain("Kimi 测试 Query");
    expect(container.textContent).toContain("DeepSeek 测试 Query");

    const kimiTab = [
      ...container.querySelectorAll(".platform-tabs button"),
    ].find((button) =>
      button.textContent?.startsWith("Kimi"),
    ) as HTMLButtonElement;
    await act(async () => {
      kimiTab.click();
    });
    await settle();
    expect(container.textContent).toContain("Kimi Query 列表");
    expect(container.textContent).toContain("Kimi 测试 Query");
    const kimiLane = container.querySelector(
      '[data-agent-lane="Kimi"]',
    ) as HTMLElement;
    const kimiLaunch = kimiLane.querySelector(
      "button.primary",
    ) as HTMLButtonElement;
    expect(kimiLaunch).toBeTruthy();
    // The current local release must be accepted: otherwise a healthy Agent makes every lane look unavailable.
    expect(kimiLaunch.disabled).toBe(false);
    await act(async () => {
      kimiLaunch.click();
    });
    await settle();

    const deepseekLane = container.querySelector(
      '[data-agent-lane="DeepSeek"]',
    ) as HTMLElement;
    const deepseekLaunch = deepseekLane.querySelector(
      "button.primary",
    ) as HTMLButtonElement;
    expect(deepseekLaunch).toBeTruthy();
    expect(deepseekLaunch.disabled).toBe(false);
    await act(async () => {
      deepseekLaunch.click();
    });
    await settle();

    expect(api.startBrowserAgentBatch).toHaveBeenCalledWith(
      session,
      "run-start",
      { browserAgentId: "agent-1", platform: "Kimi" },
    );
    expect(api.startBrowserAgentBatch).toHaveBeenCalledWith(
      session,
      "run-start",
      { browserAgentId: "agent-1", platform: "DeepSeek" },
    );
    expect(container.textContent).toContain("停止");
    expect(container.textContent).toContain("已发出启动授权");
  });
  it("automatically refreshes Browser Agent captures and exposes the immutable answer and visible links", async () => {
    const onlineAgent = {
      id: "agent-1",
      workspaceId: "workspace-1",
      label: "本地浏览器采集代理",
      status: "online" as const,
      platforms: ["豆包"],
      adapters: [{ id: "doubao-web", version: "0.3.10", platform: "豆包" }],
      enrolledAt: "2026-09-28T00:00:00.000Z",
      lastSeenAt: "2026-09-28T00:00:00.000Z",
      createdAt: "2026-09-28T00:00:00.000Z",
      createdBy: "admin-1",
    };
    const approvedSet = {
      ...querySet,
      status: "approved" as const,
      lifecycleStatus: "ready_for_test" as const,
      health: {
        total: 12,
        approved: 5,
        draft: 0,
        excluded: 7,
        queryTypes: ["品类发现"],
        journeys: ["认知"],
        targets: ["品牌"],
        recommendations: [],
      },
      queries: querySet.queries.map((query, index) => ({
        ...query,
        status: index < 5 ? ("approved" as const) : ("excluded" as const),
      })),
    };
    const queuedRun = {
      id: "run-agent",
      workspaceId: "workspace-1",
      caseId: "project-1",
      querySetId: "set-1",
      name: "首轮真实平台测试",
      marketPack: "CN" as const,
      locale: "zh-CN",
      collectionMode: "controlled-manual" as const,
      executionMode: "browser-agent" as const,
      browserAgentId: "agent-1",
      state: "collecting" as const,
      instructions: "在本地浏览器执行。",
      createdAt: "2026-09-28T00:00:00.000Z",
      createdBy: "admin-1",
      updatedAt: "2026-09-28T00:00:00.000Z",
      updatedBy: "admin-1",
      progress: { total: 1, byState: { unassigned: 1 }, state: "collecting" },
      tasks: [
        {
          id: "task-doubao",
          workspaceId: "workspace-1",
          testRunId: "run-agent",
          seedQueryId: "query-1",
          platform: "豆包",
          providerFamily: "doubao",
          state: "unassigned" as const,
          executionMode: "browser-agent" as const,
          browserAgentId: "agent-1",
          agentState: "queued" as const,
          adapterId: "doubao-web",
          adapterversion: "0.3.10",
          attemptNumber: 1,
          question: "有哪些可追溯来源的 AI 知识库工具？",
          intent: "品类发现",
          rationale: "验证来源引用。",
        },
      ],
    };
    const capturedRun = {
      ...queuedRun,
      state: "ready_for_review" as const,
      progress: {
        total: 1,
        byState: { submitted: 1 },
        state: "ready_for_review",
      },
      tasks: [
        {
          ...queuedRun.tasks[0],
          state: "submitted" as const,
          agentState: "captured" as const,
          submittedAt: "2026-09-28T00:05:00.000Z",
          observation: {
            id: "observation-1",
            rawAnswer: "CoreNote 可以通过知识图谱和来源追溯帮助团队核验回答。",
            citations: ["https://example.com/core-note-source"],
            freshSession: true,
            searchEnabled: true,
            platformLabel: "豆包",
            observedAt: "2026-09-28T00:05:00.000Z",
            submittedBy: "agent-1",
            submittedAt: "2026-09-28T00:05:00.000Z",
            collectionMethod: "browser-agent" as const,
            browserAgentId: "agent-1",
            adapterId: "doubao-web",
            adapterVersion: "0.1.5",
            captureMetadata: {
              platformSearchDeclaredCount: 2,
              visibleLinks: [
                {
                  url: "https://example.com/core-note-source",
                  title: "CoreNote 官方来源",
                  visibleText: "CoreNote 官方来源",
                  sourceType: "answer-citation",
                  position: 1,
                },
                {
                  url: "https://example.com/search-result",
                  title: "知识库工具对比",
                  visibleText: "知识库工具对比",
                  sourceType: "platform-search-result",
                  position: 1,
                  urlAvailable: true,
                },
                {
                  url: "",
                  title: "豆包页面可见来源标题",
                  visibleText: "豆包页面可见来源标题",
                  sourceType: "platform-search-result",
                  position: 2,
                  urlAvailable: false,
                },
              ],
            },
          },
        },
      ],
    };
    api.listBrowserAgents.mockResolvedValue({ agents: [onlineAgent] });
    api.listBaselineQuerySets.mockResolvedValue({ querySets: [approvedSet] });
    api.createRealSurfaceTestRun.mockResolvedValue({ testRun: queuedRun });
    api.getRealSurfaceTestRun.mockResolvedValue({ testRun: capturedRun });
    api.reviewRealSurfaceObservation.mockResolvedValue({
      testRun: {
        ...capturedRun,
        state: "baseline_ready",
        progress: {
          total: 1,
          byState: { reviewed: 1 },
          state: "baseline_ready",
        },
        tasks: capturedRun.tasks.map((task) => ({
          ...task,
          state: "reviewed",
        })),
      },
    });

    await act(async () => {
      root.render(<BaselineWorkspace go={go} mode="testing" />);
    });
    await settle();
    const createRun = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("创建真实平台测试批次"),
    ) as HTMLButtonElement;
    await act(async () => {
      createRun.click();
    });
    await settle();

    expect(api.getRealSurfaceTestRun).toHaveBeenCalledWith(
      session,
      "run-agent",
    );
    expect(container.textContent).toContain("Browser Agent · 已捕获");
    expect(container.textContent).toContain("原始回答已自动回传");
    expect(container.textContent).toContain(
      "已自动回传原始回答、1 条回答内引用与 2 条平台搜索来源",
    );

    const viewEvidence = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("查看已采集证据"),
    ) as HTMLButtonElement;
    await act(async () => {
      viewEvidence.click();
    });
    await settle();
    expect(container.textContent).toContain("CoreNote 可以通过知识图谱");
    expect(container.textContent).toContain("CoreNote 官方来源");
    expect(container.textContent).toContain("平台搜索来源");
    expect(container.textContent).toContain("可打开原链 1");
    expect(container.textContent).toContain("知识库工具对比");
    expect(container.textContent).toContain("豆包页面可见来源标题");
    expect(container.textContent).toContain("页面未暴露可打开 URL");
    expect(container.textContent).toContain("旧版可能把页面导航误记为搜索来源");
    expect(container.textContent).toContain("用新版重新采集");
    expect(
      container.querySelectorAll(".source-evidence-unavailable"),
    ).toHaveLength(1);
    expect(container.querySelector(".raw-answer-body")?.textContent).toContain(
      "CoreNote 可以通过知识图谱",
    );
    expect(container.querySelector(".evidence-drawer textarea")).toBeNull();

    const approveEvidence = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("批准证据"),
    ) as HTMLButtonElement;
    await act(async () => {
      approveEvidence.click();
    });
    await settle();

    expect(api.reviewRealSurfaceObservation).toHaveBeenCalledWith(
      session,
      "run-agent",
      "task-doubao",
      "approved",
    );
    expect(container.textContent).toContain(
      "证据已批准，已自动同步到 03「GEO 诊断与基线」。",
    );
  });
});
