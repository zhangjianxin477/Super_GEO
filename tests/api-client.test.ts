import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateBaselineQuerySet,
  archiveBaselineQuerySet,
  cancelBrowserAgentBatchStart,
  claimNextObservation,
  configureModelProvider,
  deleteUnusedBaselineQuerySet,
  generateEvidenceGroundedDiagnoses,
  getBatchImportTemplate,
  getProviderExecutionReadiness,
  importObservationBatch,
  listModelProviders,
  onboardWorkspace,
  request,
  restoreBaselineQuerySet,
  startBrowserAgentBatch,
  storeModelProviderCredential,
  updateBaselineQueryCoverageTargets,
} from "../src/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("typed frontend API client", () => {
  it("normalizes successful JSON responses and attaches tenant identity headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ workspace: { id: "workspace-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(
      request<{ workspace: { id: string } }>("/api/workspaces/workspace-1", {
        session: { workspaceId: "workspace-1", userId: "admin-1" },
      }),
    ).resolves.toEqual({ workspace: { id: "workspace-1" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("x-workspace-id")).toBe("workspace-1");
    expect(new Headers(init.headers).get("x-user-id")).toBe("admin-1");
  });

  it("never serializes a Chinese display name into HTTP headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    await request("/api/test", {
      session: {
        workspaceId: "workspace-1",
        userId: "admin-1",
        userName: "张小明",
      },
    });
    const [, init] = fetchMock.mock.calls[0];
    const requestHeaders = new Headers(init.headers);
    expect(requestHeaders.get("x-user-name")).toBeNull();
    expect(
      [...requestHeaders.entries()].some(([, value]) =>
        value.includes("张小明"),
      ),
    ).toBe(false);
  });

  it.each([
    [400, "字段校验失败"],
    [403, "没有此工作区的访问权限"],
  ])("normalizes API error %s", async (status, message) => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: message, requestId: "request-1" }),
          { status, headers: { "content-type": "application/json" } },
        ),
      ) as typeof fetch;
    await expect(request("/api/test")).rejects.toMatchObject({
      problem: { status, message, requestId: "request-1" },
    });
  });

  it("labels a network failure without leaking browser exceptions", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("socket reset")) as typeof fetch;
    await expect(request("/api/test")).rejects.toMatchObject({
      problem: {
        status: 0,
        network: true,
        message: "无法连接本地 API。请确认 8787 服务正在运行。",
      },
    });
  });

  it("uses separate authenticated requests for provider configuration and API-key storage", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            provider: {
              id: "provider-1",
              providerId: "DeepSeek",
              collectionMode: "official-api",
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            provider: { id: "provider-1" },
            persistence: "configured-encryption-key",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            providers: [
              {
                id: "provider-1",
                credential: { configured: true, lastFour: "cdef" },
              },
            ],
            collectionBoundary: "authorised APIs only",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    const session = { workspaceId: "workspace-1", userId: "admin-1" };

    await configureModelProvider(session, {
      providerId: "DeepSeek",
      market: "CN",
      locale: "zh-CN",
      collectionMode: "official-api",
    });
    await storeModelProviderCredential(session, "provider-1", "sk-test-abcdef");
    const listed = await listModelProviders(session);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      providerId: "DeepSeek",
      market: "CN",
      locale: "zh-CN",
      collectionMode: "official-api",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-1/model-providers",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/workspaces/workspace-1/model-providers/provider-1/credential",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      apiKey: "sk-test-abcdef",
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("x-user-id"),
    ).toBe("admin-1");
    expect(listed.providers[0].credential).toEqual({
      configured: true,
      lastFour: "cdef",
    });
  });

  it("reads provider execution readiness for the currently selected market pack", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          readiness: [
            {
              providerId: "DeepSeek",
              state: "manual-fallback",
              credentialConfigured: false,
            },
          ],
          executionBoundary: "authorised integrations only",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await getProviderExecutionReadiness(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "market-pack-1",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-1/market-packs/market-pack-1/execution-readiness",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get("x-user-id"),
    ).toBe("admin-1");
    expect(result.readiness[0].state).toBe("manual-fallback");
  });

  it("gets a batch template and imports completed controlled-manual evidence with tenant headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            template: {
              schemaVersion: "geo-controlled-manual-batch-v1",
              items: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            imported: [],
            skipped: [],
            run: { id: "run-1" },
            collectionMode: "controlled-manual",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    const session = { workspaceId: "workspace-1", userId: "admin-1" };
    await getBatchImportTemplate(session, "run-1");
    await importObservationBatch(session, "run-1", [
      {
        queryId: "q-1",
        providerId: "Kimi",
        modelIdentity: "Kimi export",
        sourceRef: "manual://kimi/batch-1",
        collectedAt: "2026-09-27T12:00:00.000Z",
        citations: [],
        rawAnswer: "真实回答。",
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-1/assessment-runs/run-1/batch-import-template",
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/workspaces/workspace-1/assessment-runs/run-1/observations/batch-import",
    );
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      collectionMode: "controlled-manual",
      rows: [
        {
          queryId: "q-1",
          providerId: "Kimi",
          modelIdentity: "Kimi export",
          sourceRef: "manual://kimi/batch-1",
          collectedAt: "2026-09-27T12:00:00.000Z",
          citations: [],
          rawAnswer: "真实回答。",
        },
      ],
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("x-workspace-id"),
    ).toBe("workspace-1");
  });

  it("loads the latest persisted real-platform run for a product profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ testRun: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const { getLatestRealSurfaceTestRun } = await import("../src/api");
    await getLatestRealSurfaceTestRun(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "project-1",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-1/brand-diagnostics/project-1/real-surface-test-runs",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get("x-workspace-id"),
    ).toBe("workspace-1");
  });

  it("claims the next controlled-manual collection task with the active workspace identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ observation: null, run: { id: "run-1" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    await claimNextObservation(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "run-1",
      "DeepSeek",
    );
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(
      "/api/workspaces/workspace-1/assessment-runs/run-1/observations/claim-next",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ providerId: "DeepSeek" });
    expect(new Headers(init.headers).get("x-workspace-id")).toBe("workspace-1");
  });

  it("can restore only an already-assigned task without claiming a new task", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ observation: null, run: { id: "run-1" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    await claimNextObservation(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "run-1",
      undefined,
      { resumeOnly: true },
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ resumeOnly: true });
  });

  it("creates and cancels a scoped Browser Agent launch authorization with tenant identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            startRequest: { id: "start-1", status: "requested" },
            testRun: { id: "run-1" },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            startRequest: { id: "start-1", status: "cancelled" },
            testRun: { id: "run-1" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    const session = { workspaceId: "workspace-1", userId: "admin-1" };

    await startBrowserAgentBatch(session, "run-1", {
      browserAgentId: "agent-1",
      platform: "豆包",
    });
    await cancelBrowserAgentBatchStart(session, "run-1", "start-1");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/workspace-1/real-surface-test-runs/run-1/browser-agent-start",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      browserAgentId: "agent-1",
      platform: "豆包",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/workspaces/workspace-1/real-surface-test-runs/run-1/browser-agent-start/cancel",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      startRequestId: "start-1",
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("x-workspace-id"),
    ).toBe("workspace-1");
  });

  it("posts a completed assessment run to generate evidence-grounded diagnoses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ diagnoses: [] }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    await generateEvidenceGroundedDiagnoses(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "run-1",
    );
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(
      "/api/workspaces/workspace-1/assessment-runs/run-1/diagnoses/generate",
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-user-id")).toBe("admin-1");
  });
  it("posts a diagnostic onboarding brief without tenant headers before a workspace exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          workspace: { id: "workspace-1" },
          session: { workspaceId: "workspace-1", userId: "admin-1" },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    await onboardWorkspace({
      workspaceName: "诊断工作区",
      administrator: { id: "admin-1", name: "管理员" },
      brandName: "Acme",
      website: "https://acme.test",
      industry: "B2B SaaS",
      audience: "AI 产品负责人",
      objective: "建立基线",
      competitors: [],
      queryTarget: 100,
      markets: [
        {
          market: "CN",
          locale: "zh-CN",
          providers: ["DeepSeek"],
          channels: ["知乎"],
        },
      ],
    });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/workspaces/onboard");
    expect(new Headers(init.headers).get("x-workspace-id")).toBeNull();
  });

  it("calls Query Dataset history management endpoints with the active workspace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ querySet: { id: "set-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ querySet: { id: "set-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ querySet: { id: "set-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deleted: { id: "set-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    const activeSession = { workspaceId: "workspace-1", userId: "admin-1" };

    await archiveBaselineQuerySet(activeSession, "set-1");
    await restoreBaselineQuerySet(activeSession, "set-1");
    await activateBaselineQuerySet(activeSession, "set-1");
    await deleteUnusedBaselineQuerySet(activeSession, "set-1", "草稿 Dataset");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/workspaces/workspace-1/baseline-query-sets/set-1/archive",
      "/api/workspaces/workspace-1/baseline-query-sets/set-1/restore",
      "/api/workspaces/workspace-1/baseline-query-sets/set-1/activate",
      "/api/workspaces/workspace-1/baseline-query-sets/set-1",
    ]);
    expect(fetchMock.mock.calls[3][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      confirmation: "草稿 Dataset",
    });
  });

  it("persists reviewer-calibrated Query coverage targets in the active workspace", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ querySet: { id: "set-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await updateBaselineQueryCoverageTargets(
      { workspaceId: "workspace-1", userId: "admin-1" },
      "set-1",
      {
        "category-discovery::awareness": 5,
        "problem-solving::support": 0,
      },
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "/api/workspaces/workspace-1/baseline-query-sets/set-1/coverage-targets",
    );
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("x-workspace-id")).toBe("workspace-1");
    expect(JSON.parse(init.body)).toEqual({
      targets: {
        "category-discovery::awareness": 5,
        "problem-solving::support": 0,
      },
    });
  });
});
