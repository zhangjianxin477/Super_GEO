import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApplication } from "../../server/application.mjs";

let application;
let origin;
let workspaceId;
let otherWorkspaceId;

const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  return { response, body: await response.json() };
};

const auth = (userId = "admin-a", id = workspaceId) => ({
  "x-user-id": userId,
  "x-workspace-id": id,
});

const diagnosticInput = () => ({
  name: "Coverage map validation",
  brandName: "Example Knowledge",
  website: "https://example.test/",
  markets: ["中国"],
  locales: ["zh-CN"],
  audiences: ["企业知识库负责人"],
  objective: "验证 Query 覆盖地图的目标校准与版本隔离。",
  ownerId: "admin-a",
});

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "geo-query-coverage-"));
  application = createApplication({
    config: {
      projectRoot: process.cwd(),
      dataDir,
      dbPath: join(dataDir, "harness.sqlite"),
      port: 0,
    },
  });
  await new Promise((resolve) =>
    application.server.listen(0, "127.0.0.1", resolve),
  );
  origin = `http://127.0.0.1:${application.server.address().port}`;

  const workspace = await json("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({
      name: "Coverage tenant",
      brand: "Example Knowledge",
      administrator: { id: "admin-a", name: "Admin A" },
    }),
  });
  assert.equal(workspace.response.status, 201);
  workspaceId = workspace.body.workspace.id;

  const other = await json("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({
      name: "Other tenant",
      brand: "Other",
      administrator: { id: "admin-b", name: "Admin B" },
    }),
  });
  assert.equal(other.response.status, 201);
  otherWorkspaceId = other.body.workspace.id;
});

after(async () => {
  await new Promise((resolve) => application.server.close(resolve));
  const dataDir = application.config.dataDir;
  application.database.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("Query coverage map API", () => {
  it("materializes the full type × journey grid, persists targets, excludes removed Queries, and protects published versions", async () => {
    const created = await json(
      `/api/workspaces/${workspaceId}/brand-diagnostics`,
      {
        method: "POST",
        headers: auth(),
        body: JSON.stringify(diagnosticInput()),
      },
    );
    assert.equal(created.response.status, 201);
    const caseId = created.body.project.project.id;

    const generated = await json(
      `/api/workspaces/${workspaceId}/brand-diagnostics/${caseId}/baseline-query-sets/generate`,
      {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({
          marketPack: "CN",
          count: 5,
          generator: "template",
        }),
      },
    );
    assert.equal(generated.response.status, 201);
    let querySet = generated.body.querySet;
    assert.equal(querySet.coverage.cells.length, 24);
    assert.equal(
      querySet.coverage.cells.find(
        (cell) => cell.key === "category-discovery::awareness",
      ).target,
      4,
    );
    assert.equal(
      querySet.coverage.cells.find(
        (cell) => cell.key === "problem-solving::awareness",
      ).state,
      "not-applicable",
    );

    const badTarget = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/coverage-targets`,
      {
        method: "PATCH",
        headers: auth(),
        body: JSON.stringify({
          targets: { "category-discovery::awareness": 201 },
        }),
      },
    );
    assert.equal(badTarget.response.status, 409);

    const calibrated = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/coverage-targets`,
      {
        method: "PATCH",
        headers: auth(),
        body: JSON.stringify({
          targets: {
            "category-discovery::awareness": 7,
            "problem-solving::support": 0,
          },
        }),
      },
    );
    assert.equal(calibrated.response.status, 200);
    querySet = calibrated.body.querySet;
    assert.equal(querySet.coverageTargets["category-discovery::awareness"], 7);
    assert.equal(
      querySet.coverage.cells.find(
        (cell) => cell.key === "category-discovery::awareness",
      ).target,
      7,
    );
    assert.equal(
      querySet.coverage.cells.find(
        (cell) => cell.key === "problem-solving::support",
      ).state,
      "not-applicable",
    );

    const manual = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries`,
      {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({
          question: "有哪些可用于替代现有企业知识库的工具？",
          intent: "竞品替代",
          rationale: "验证排除的 Query 不应计入覆盖。",
          priority: "medium",
          queryType: "competitor-alternative",
          journeyStage: "awareness",
          targetEntityType: "competitor",
          targetEntities: [],
          sourceType: "manual",
          isBaseline: true,
        }),
      },
    );
    assert.equal(manual.response.status, 201);
    const manualQuery = manual.body.querySet.queries.at(-1);
    assert.equal(
      manual.body.querySet.coverage.cells.find(
        (cell) => cell.key === "competitor-alternative::awareness",
      ).current,
      1,
    );

    const excluded = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${manualQuery.id}`,
      {
        method: "PATCH",
        headers: auth(),
        body: JSON.stringify({ status: "excluded" }),
      },
    );
    assert.equal(excluded.response.status, 200);
    assert.equal(
      excluded.body.querySet.coverage.cells.find(
        (cell) => cell.key === "competitor-alternative::awareness",
      ).current,
      0,
    );

    const isolated = await json(
      `/api/workspaces/${otherWorkspaceId}/baseline-query-sets/${querySet.id}/coverage-targets`,
      {
        method: "PATCH",
        headers: auth("admin-b", otherWorkspaceId),
        body: JSON.stringify({
          targets: { "category-discovery::awareness": 8 },
        }),
      },
    );
    assert.equal(isolated.response.status, 409);

    for (const query of excluded.body.querySet.queries.filter(
      (item) => item.status !== "excluded",
    )) {
      const approved = await json(
        `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/queries/${query.id}`,
        {
          method: "PATCH",
          headers: auth(),
          body: JSON.stringify({ status: "approved" }),
        },
      );
      assert.equal(approved.response.status, 200);
    }
    const published = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/publish`,
      { method: "POST", headers: auth() },
    );
    assert.equal(published.response.status, 200);

    const immutable = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/coverage-targets`,
      {
        method: "PATCH",
        headers: auth(),
        body: JSON.stringify({
          targets: { "category-discovery::awareness": 8 },
        }),
      },
    );
    assert.equal(immutable.response.status, 409);

    const revision = await json(
      `/api/workspaces/${workspaceId}/baseline-query-sets/${querySet.id}/revision`,
      { method: "POST", headers: auth() },
    );
    assert.equal(revision.response.status, 201);
    assert.equal(
      revision.body.querySet.coverageTargets["category-discovery::awareness"],
      7,
    );
  });
});



