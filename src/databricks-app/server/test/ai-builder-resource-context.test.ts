import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import {
  AiBuilderResourceContextService,
} from "../src/ai-builder-resource-context.ts";
import type { CallerIdentity } from "../src/contracts.ts";
import type { WorkspaceExecutionResourcesService } from "../src/workspace-execution-resources-service.ts";
import type { WorkspaceLakebaseResourcesService } from "../src/workspace-lakebase-resources-service.ts";
import type { WorkspaceResourcesService } from "../src/workspace-resources-service.ts";

const CALLER: CallerIdentity = {
  userId: "caller-1",
  preferredUsername: "caller@example.com",
  email: "caller@example.com",
  workspaceId: "workspace-1",
  authenticationMode: "databricks",
  isInstallationAdmin: false,
  databricksAccessToken: "private-caller-token",
};

test("AiBuilderResourceContextService_ReturnsDeterministicCurrentWorkspaceResourcesWithoutAuthority", async () => {
  const observedSignals: AbortSignal[] = [];
  const service = createService({
    workspaceResources: {
      listCatalogs: async (_caller: CallerIdentity, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ name: "z_catalog" }, { name: "a_catalog" }], authenticationMode: "databricks" };
      },
      listTableSummaries: async (_caller: CallerIdentity, catalogName: string, _limit: number, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return {
          items: [{ fullName: `${catalogName}.default.records` }],
          hasMore: false,
          authenticationMode: "databricks",
        };
      },
    },
    executionResources: {
      listJobs: async (_caller: CallerIdentity, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ jobId: "101", name: "Refresh records" }], authenticationMode: "databricks" };
      },
      listSqlWarehouses: async (_caller: CallerIdentity, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ id: "warehouse-1", name: "Analytics", state: "running" }], authenticationMode: "databricks" };
      },
    },
    lakebaseResources: {
      listProjects: async (_caller: CallerIdentity, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ projectId: "project-1", displayName: "Builder store" }], authenticationMode: "databricks" };
      },
      listBranches: async (_caller: CallerIdentity, _projectId: string, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ branchId: "production", isDefault: true, state: "ready" }], authenticationMode: "databricks" };
      },
      listEndpoints: async (_caller: CallerIdentity, _projectId: string, _branchId: string, signal?: AbortSignal) => {
        if (signal) observedSignals.push(signal);
        return { items: [{ endpointId: "primary", endpointType: "read-write", state: "active" }], authenticationMode: "databricks" };
      },
    },
  });
  const controller = new AbortController();

  const context = await service.getContext(CALLER, controller.signal);

  assert.deepEqual(context, {
    unityCatalogTables: {
      status: "available",
      items: ["a_catalog.default.records", "z_catalog.default.records"],
    },
    jobs: { status: "available", items: [{ jobId: "101", name: "Refresh records" }] },
    sqlWarehouses: { status: "available", items: [{ id: "warehouse-1", name: "Analytics", state: "running" }] },
    lakebaseAutoscaling: {
      status: "available",
      items: [{
        projectId: "project-1",
        displayName: "Builder store",
        branches: [{ branchId: "production", endpoints: [{ endpointId: "primary", endpointType: "read-write", state: "active" }] }],
      }],
    },
  });
  assert.ok(observedSignals.length >= 7);
  assert.ok(observedSignals.every((signal) => signal === controller.signal));
  assert.doesNotMatch(JSON.stringify(context), /private-caller-token|workspace-1|dbc-example|password|host/i);
});

test("AiBuilderResourceContextService_DistinguishesAuthorizedEmptyFromUnavailable", async () => {
  const emptyService = createService();
  const empty = await emptyService.getContext(CALLER, new AbortController().signal);
  assert.deepEqual(empty, {
    unityCatalogTables: { status: "empty", items: [] },
    jobs: { status: "empty", items: [] },
    sqlWarehouses: { status: "empty", items: [] },
    lakebaseAutoscaling: { status: "empty", items: [] },
  });

  const unavailableService = createService({
    workspaceResources: {
      listCatalogs: async () => { throw new ApplicationError(403, "denied", "Denied", "Do not expose this detail"); },
    },
    executionResources: {
      listJobs: async () => { throw new ApplicationError(403, "denied", "Denied", "Do not expose this detail"); },
      listSqlWarehouses: async () => { throw new ApplicationError(502, "failed", "Failed", "Do not expose this detail"); },
    },
    lakebaseResources: {
      listProjects: async () => { throw new ApplicationError(403, "denied", "Denied", "Do not expose this detail"); },
    },
  });
  const unavailable = await unavailableService.getContext(CALLER, new AbortController().signal);
  assert.deepEqual(unavailable, {
    unityCatalogTables: { status: "unavailable", items: [], reason: "permission_required" },
    jobs: { status: "unavailable", items: [], reason: "permission_required" },
    sqlWarehouses: { status: "unavailable", items: [], reason: "temporarily_unavailable" },
    lakebaseAutoscaling: { status: "unavailable", items: [], reason: "permission_required" },
  });
  assert.doesNotMatch(JSON.stringify(unavailable), /Do not expose this detail/);
});

test("AiBuilderResourceContextService_MarksPermissionFailuresAsPartialWhenSomeResourcesRemain", async () => {
  const service = createService({
    workspaceResources: {
      listCatalogs: async () => ({
        items: [{ name: "a_catalog" }, { name: "b_catalog" }],
        authenticationMode: "databricks",
      }),
      listTableSummaries: async (_caller: CallerIdentity, catalogName: string) => {
        if (catalogName === "b_catalog") {
          throw new ApplicationError(403, "denied", "Denied", "Do not leak upstream details");
        }
        return { items: [{ fullName: "a_catalog.default.records" }], hasMore: false, authenticationMode: "databricks" };
      },
    },
    lakebaseResources: {
      listProjects: async () => ({
        items: [{ projectId: "project-1", displayName: "Visible project" }],
        authenticationMode: "databricks",
      }),
      listBranches: async () => {
        throw new ApplicationError(403, "denied", "Denied", "Do not leak upstream details");
      },
    },
  });

  const context = await service.getContext(CALLER, new AbortController().signal);

  assert.deepEqual(context.unityCatalogTables, {
    status: "partial",
    items: ["a_catalog.default.records"],
    reason: "permission_required",
  });
  assert.deepEqual(context.lakebaseAutoscaling, {
    status: "partial",
    items: [{ projectId: "project-1", displayName: "Visible project", branches: [] }],
    reason: "permission_required",
  });
  assert.doesNotMatch(JSON.stringify(context), /Do not leak upstream details/);
});

test("AiBuilderResourceContextService_MarksPartialInventoriesAndAppliesCountAndByteCaps", async () => {
  const service = createService({
    workspaceResources: {
      listCatalogs: async () => ({
        items: Array.from({ length: 10 }, (_, index) => ({ name: `catalog-${index}` })),
        authenticationMode: "databricks",
      }),
      listTableSummaries: async (_caller: CallerIdentity, catalogName: string, limit: number) => ({
        items: [{ fullName: `${catalogName}.default.table` }],
        hasMore: catalogName === "catalog-0" || limit === 0,
        authenticationMode: "databricks",
      }),
    },
    executionResources: {
      listJobs: async () => ({
        items: Array.from({ length: 40 }, (_, index) => ({ jobId: String(index + 1), name: `job-${index}` })),
        authenticationMode: "databricks",
      }),
      listSqlWarehouses: async () => ({
        items: Array.from({ length: 25 }, (_, index) => ({ id: `warehouse-${index}`, name: `warehouse-${index}`, state: "running" as const })),
        authenticationMode: "databricks",
      }),
    },
    lakebaseResources: {
      listProjects: async () => ({
        items: Array.from({ length: 6 }, (_, index) => ({ projectId: `project-${index}`, displayName: `Project ${index}` })),
        authenticationMode: "databricks",
      }),
      listBranches: async () => ({
        items: Array.from({ length: 4 }, (_, index) => ({ branchId: `branch-${index}`, isDefault: false, state: "ready" as const })),
        authenticationMode: "databricks",
      }),
      listEndpoints: async () => ({
        items: Array.from({ length: 4 }, (_, index) => ({ endpointId: `endpoint-${index}`, endpointType: "read-write" as const, state: "active" as const })),
        authenticationMode: "databricks",
      }),
    },
  });

  const context = await service.getContext(CALLER, new AbortController().signal);

  assert.equal(context.unityCatalogTables.status, "partial");
  assert.equal(context.unityCatalogTables.truncated, true);
  assert.equal(context.jobs.items.length, 30);
  assert.equal(context.jobs.status, "partial");
  assert.equal(context.sqlWarehouses.items.length, 20);
  assert.equal(context.sqlWarehouses.status, "partial");
  assert.equal(context.lakebaseAutoscaling.items.length, 5);
  assert.equal(context.lakebaseAutoscaling.status, "partial");
  assert.ok(context.lakebaseAutoscaling.items.every((project) => project.branches.length <= 3));
  assert.ok(context.lakebaseAutoscaling.items.every((project) =>
    project.branches.every((branch) => branch.endpoints.length <= 3)));
  assert.ok(Buffer.byteLength(JSON.stringify(context), "utf8") <= 16_000);
});

test("AiBuilderResourceContextService_EnforcesSerializedByteLimit", async () => {
  const service = createService({
    executionResources: {
      listJobs: async () => ({
        items: [{ jobId: "oversized", name: "j".repeat(20_000) }],
        authenticationMode: "databricks",
      }),
    },
  });

  const context = await service.getContext(CALLER, new AbortController().signal);

  assert.ok(Buffer.byteLength(JSON.stringify(context), "utf8") <= 16_000);
  assert.deepEqual(context.jobs, { status: "partial", items: [], truncated: true });
});

test("AiBuilderResourceContextService_PropagatesAbortAndUnexpectedErrors", async () => {
  const controller = new AbortController();
  const service = createService({
    workspaceResources: {
      listCatalogs: async (_caller: CallerIdentity, signal?: AbortSignal) => {
        assert.equal(signal, controller.signal);
        return { items: [], authenticationMode: "databricks" };
      },
    },
  });
  controller.abort();
  await assert.rejects(service.getContext(CALLER, controller.signal));

  const unexpectedService = createService({
    workspaceResources: {
      listCatalogs: async () => { throw new Error("unexpected implementation failure"); },
    },
  });
  await assert.rejects(
    unexpectedService.getContext(CALLER, new AbortController().signal),
    /unexpected implementation failure/,
  );
});

interface ContextServiceOverrides {
  workspaceResources?: Partial<WorkspaceResourcesService>;
  executionResources?: Partial<WorkspaceExecutionResourcesService>;
  lakebaseResources?: Partial<WorkspaceLakebaseResourcesService>;
}

function createService(overrides: ContextServiceOverrides = {}): AiBuilderResourceContextService {
  const workspaceResources = {
    listCatalogs: async () => ({ items: [], authenticationMode: "databricks" }),
    listTableSummaries: async () => ({ items: [], hasMore: false, authenticationMode: "databricks" }),
    ...overrides.workspaceResources,
  } as unknown as WorkspaceResourcesService;
  const executionResources = {
    listJobs: async () => ({ items: [], authenticationMode: "databricks" }),
    listSqlWarehouses: async () => ({ items: [], authenticationMode: "databricks" }),
    ...overrides.executionResources,
  } as unknown as WorkspaceExecutionResourcesService;
  const lakebaseResources = {
    listProjects: async () => ({ items: [], authenticationMode: "databricks" }),
    listBranches: async () => ({ items: [], authenticationMode: "databricks" }),
    listEndpoints: async () => ({ items: [], authenticationMode: "databricks" }),
    ...overrides.lakebaseResources,
  } as unknown as WorkspaceLakebaseResourcesService;
  return new AiBuilderResourceContextService(workspaceResources, executionResources, lakebaseResources);
}
