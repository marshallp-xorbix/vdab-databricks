import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createHttpApp } from "../src/http-app.ts";
import { createIdentityResolver } from "../src/identity.ts";
import type { CallerIdentity, WorkspaceAppsPage } from "../src/contracts.ts";
import type { WorkspaceAppsClient } from "../src/workspace-apps-client.ts";
import { WorkspaceAppsService } from "../src/workspace-apps-service.ts";
import type { WorkspaceResourcesClient } from "../src/workspace-resources-client.ts";
import { WorkspaceResourcesService } from "../src/workspace-resources-service.ts";
import { WorkspaceExecutionResourcesService } from "../src/workspace-execution-resources-service.ts";
import { LocalTestWorkspaceExecutionResourcesClient } from "../src/local-test-workspace-execution-resources-client.ts";
import { WorkspaceLakebaseResourcesService } from "../src/workspace-lakebase-resources-service.ts";
import { LocalTestWorkspaceLakebaseResourcesClient } from "../src/local-test-workspace-lakebase-resources-client.ts";
import type { WorkspaceLakebaseResourcesClient } from "../src/workspace-lakebase-resources-client.ts";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";
import type { ProjectRepository } from "../src/db/project-repository.ts";
import { ProjectService } from "../src/db/project-service.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import { ProjectWorkflowService } from "../src/db/project-workflow-service.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectWorkflowRepository } from "../src/db/project-workflow-repository.ts";
import type { ProjectCustomModulesRepository } from "../src/db/project-custom-modules-repository.ts";
import { ProjectCustomModulesService } from "../src/db/project-custom-modules-service.ts";
import type { ProjectPortabilityRepository } from "../src/db/project-portability-repository.ts";
import { ProjectPortabilityService } from "../src/db/project-portability-service.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { ProjectPreviewService } from "../src/generation/project-preview-service.ts";
import type { AiBuilderService } from "../src/ai-builder-service.ts";

const WORKSPACE_HOST = "https://dbc-example.cloud.databricks.com";
const FORWARDED_TOKEN = "caller-token-never-return-this";

test("HttpApp_HealthEndpoint_ReturnsLivenessWithoutAuthentication", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/health/live`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.ok(response.headers.get("x-request-id"));
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_AiBuilderStreamsProgressAndResultEvents", async () => {
  const aiBuilderService = {
    prepare: async (_caller: CallerIdentity, _requestId: string, projectId: string) => {
      assert.equal(projectId, "11111111-1111-4111-8111-111111111111");
      return {
        execute: async (_signal: AbortSignal, emit: (event: import("../src/ai-builder-contract.ts").AiBuilderEvent) => Promise<void>) => {
          await emit({ event: "progress", data: { message: "Generating" } });
          await emit({
            event: "result",
            data: { assistantMessage: "Ready", proposal: null, version: 1 },
          });
        },
      };
    },
  } as unknown as AiBuilderService;
  const appHarness = await createAppHarness({ aiBuilderService });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/projects/11111111-1111-4111-8111-111111111111/ai-builder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    });
    const body = await response.text();

    assert.equal(response.status, 200, body);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.match(body, /event: progress\ndata: \{"message":"Generating"\}/);
    assert.match(body, /event: result\ndata: \{"assistantMessage":"Ready","proposal":null,"version":1\}/);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_SessionUsesTrustedDatabricksHeaders_AndNeverReturnsToken", async () => {
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
  });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/session`, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "databricks-user-17",
        "x-forwarded-preferred-username": "pat@example.com",
        "x-forwarded-email": "pat@example.com",
      },
    });
    const responseText = await response.text();

    assert.equal(response.status, 200);
    assert.match(responseText, /databricks-user-17/);
    assert.match(responseText, /https:\/\/dbc-example\.cloud\.databricks\.com/);
    assert.doesNotMatch(responseText, new RegExp(FORWARDED_TOKEN));
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_SessionWithoutForwardedToken_ReturnsUnauthorized", async () => {
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
  });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/session`, {
      headers: { "x-forwarded-user": "forged-user" },
    });
    const problem = await response.json();

    assert.equal(response.status, 401);
    assert.equal(problem.code, "databricks_session_required");
    assert.ok(problem.requestId);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_WorkspaceAppsList_ReturnsExplicitOfflineMock_WithoutDatabricksCall", async () => {
  let callCount = 0;
  const localIdentityResolver = createIdentityResolver({
    authenticationMode: "local-test",
    nodeEnvironment: "test",
    localUserId: "local-editor",
    workspaceHost: undefined,
    workspaceId: undefined,
  });
  const workspaceAppsClient: WorkspaceAppsClient = {
    listApps: async () => {
      callCount += 1;
      return {
        items: [],
        nextPageToken: null,
        authenticationMode: "local-test",
      };
    },
  };
  const appHarness = await createAppHarness({
    identityResolver: localIdentityResolver,
    workspaceAppsClient,
  });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/workspace/apps`, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "attacker-selected-user",
      },
    });
    const appsPage = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(appsPage, {
      items: [],
      nextPageToken: null,
      authenticationMode: "local-test",
    });
    assert.equal(callCount, 1);
    assert.doesNotMatch(JSON.stringify(appsPage), /caller-token/);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_WorkspaceResourceRoutes_UseCurrentWorkspaceAndRejectHostAuthority", async () => {
  const calls: string[] = [];
  const workspaceResourcesClient: WorkspaceResourcesClient = {
    listCatalogs: async () => {
      calls.push("catalogs");
      return [{ name: "main" }];
    },
    listTableSummaries: async () => ({ items: [], hasMore: false }),
    listSchemas: async (_caller, catalogName) => {
      calls.push(`schemas:${catalogName}`);
      return [{ name: "default" }];
    },
    listVolumes: async (_caller, catalogName, schemaName) => {
      calls.push(`volumes:${catalogName}.${schemaName}`);
      return [{ name: "uploads" }];
    },
    listTables: async (_caller, catalogName, schemaName) => {
      calls.push(`tables:${catalogName}.${schemaName}`);
      return [{ name: "customers", dataSourceFormat: "DELTA", columns: [{ name: "id", type: "BIGINT", dataType: "LONG" }] }];
    },
    listGenieSpaces: async () => {
      calls.push("genie-spaces");
      return [{ spaceId: "0123456789abcdef0123456789abcdef", title: "Sales Genie" }];
    },
    listServingEndpoints: async () => {
      calls.push("serving-endpoints");
      return [{ name: "support-chat", readiness: "ready", permissionLevel: "CAN_QUERY" }];
    },
  };
  const appHarness = await createAppHarness({ workspaceResourcesClient });

  try {
    const catalogsResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/catalogs`,
    );
    const schemasResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/schemas?catalogName=main`,
    );
    const volumesResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/volumes?catalogName=main&schemaName=default`,
    );
    const tablesResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/tables?catalogName=main&schemaName=default`,
    );
    const genieSpacesResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/genie-spaces`,
    );
    const servingEndpointsResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/serving-endpoints`,
    );
    const hostileResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/schemas?catalogName=main&workspaceHost=https%3A%2F%2Fattacker.invalid`,
    );

    assert.deepEqual((await catalogsResponse.json()).items, [{ name: "main" }]);
    assert.deepEqual((await schemasResponse.json()).items, [{ name: "default" }]);
    assert.deepEqual((await volumesResponse.json()).items, [{ name: "uploads" }]);
    assert.deepEqual((await tablesResponse.json()).items, [
      { name: "customers", dataSourceFormat: "DELTA", columns: [{ name: "id", type: "BIGINT", dataType: "LONG" }] },
    ]);
    assert.deepEqual((await genieSpacesResponse.json()).items, [
      { spaceId: "0123456789abcdef0123456789abcdef", title: "Sales Genie" },
    ]);
    assert.deepEqual((await servingEndpointsResponse.json()).items, [
      { name: "support-chat", readiness: "ready", permissionLevel: "CAN_QUERY" },
    ]);
    assert.equal(hostileResponse.status, 400);
    assert.equal((await hostileResponse.json()).code, "invalid_workspace_resource_request");
    assert.deepEqual(calls, [
      "catalogs",
      "schemas:main",
      "volumes:main.default",
      "tables:main.default",
      "genie-spaces",
      "serving-endpoints",
    ]);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_WorkflowResourcesUseLocalMocksAndRejectCallerWorkspaceAuthority", async () => {
  const appHarness = await createAppHarness();
  try {
    const jobsResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/resources/jobs`);
    const jobs = await jobsResponse.json();
    const warehouseResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/resources/sql-warehouses`);
    const warehouses = await warehouseResponse.json();
    const forgedHostResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/resources/jobs?workspaceHost=https%3A%2F%2Fattacker.example`,
    );

    assert.equal(jobsResponse.status, 200);
    assert.equal(jobs.items[0].jobId, "1001");
    assert.equal(warehouseResponse.status, 200);
    assert.equal(warehouses.items[0].id, "sample-warehouse");
    assert.equal(forgedHostResponse.status, 404);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_LakebaseResourceRoutesUseLocalMocksAndRejectAuthorityInput", async () => {
  const appHarness = await createAppHarness();
  try {
    const projectsResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/projects`);
    const projects = await projectsResponse.json();
    const branchesResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/branches?projectId=sample-project`);
    const branches = await branchesResponse.json();
    const endpointsResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/endpoints?projectId=sample-project&branchId=production`);
    const endpoints = await endpointsResponse.json();
    const databasesResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/databases?projectId=sample-project&branchId=production`);
    const databases = await databasesResponse.json();
    const schemasResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/schemas?projectId=sample-project&branchId=production&endpointId=primary&databaseName=databricks_postgres`);
    const schemas = await schemasResponse.json();
    const tablesResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/tables?projectId=sample-project&branchId=production&endpointId=primary&databaseName=databricks_postgres&schemaName=public`);
    const tables = await tablesResponse.json();
    const hostileResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/projects?workspaceHost=https%3A%2F%2Fattacker.example`);

    assert.equal(projectsResponse.status, 200);
    assert.equal(projects.items[0].projectId, "sample-project");
    assert.equal(branchesResponse.status, 200);
    assert.equal(branches.items[0].isDefault, true);
    assert.equal(endpoints.items[0].endpointType, "read-write");
    assert.equal(databases.items[0].databaseName, "databricks_postgres");
    assert.deepEqual(schemas.items, [{ name: "public" }]);
    assert.equal(tables.items[0].name, "sample_records");
    assert.equal(hostileResponse.status, 400);
    assert.equal((await hostileResponse.json()).code, "invalid_lakebase_resource_request");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_WorkspaceAppsList_RejectsLongPageTokenBeforeAdapter", async () => {
  let callCount = 0;
  const workspaceAppsClient: WorkspaceAppsClient = {
    listApps: async () => {
      callCount += 1;
      return {
        items: [],
        nextPageToken: null,
        authenticationMode: "local-test",
      };
    },
  };
  const appHarness = await createAppHarness({ workspaceAppsClient });

  try {
    const longPageToken = "x".repeat(2049);
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/apps?pageToken=${longPageToken}`,
    );
    const problem = await response.json();

    assert.equal(response.status, 400);
    assert.equal(problem.code, "invalid_page_token");
    assert.equal(callCount, 0);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_LocalTestIdentity_IgnoresForwardedIdentityAndToken", async () => {
  const identityResolver = createIdentityResolver({
    authenticationMode: "local-test",
    nodeEnvironment: "test",
    localUserId: "local-editor",
    workspaceHost: undefined,
    workspaceId: undefined,
  });
  const appHarness = await createAppHarness({ identityResolver });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/session`, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "attacker-selected-user",
      },
    });
    const session = await response.json();

    assert.equal(response.status, 200);
    assert.equal(session.userId, "local-editor");
    assert.equal(session.authenticationMode, "local-test");
    assert.doesNotMatch(JSON.stringify(session), new RegExp(FORWARDED_TOKEN));
  } finally {
    await appHarness.dispose();
  }
});

test("IdentityResolver_LocalTestModeInProduction_ThrowsConfigurationError", () => {
  assert.throws(
    () =>
      createIdentityResolver({
        authenticationMode: "local-test",
        nodeEnvironment: "production",
        localUserId: "local-editor",
        workspaceHost: undefined,
        workspaceId: undefined,
      }),
    /forbidden in production/,
  );
});

test("IdentityResolver_UsesOnlyExplicitInstallationAdminIds", async () => {
  const identityResolver = createIdentityResolver({
    authenticationMode: "databricks",
    nodeEnvironment: "test",
    localUserId: undefined,
    workspaceHost: WORKSPACE_HOST,
    workspaceId: "test-workspace",
    installationAdminIds: " install-admin-1,install-admin-2 ",
  });
  const appHarness = await createAppHarness({ identityResolver });

  try {
    const adminResponse = await fetch(`${appHarness.baseUrl}/api/v1/session`, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "install-admin-2",
      },
    });
    const regularUserResponse = await fetch(`${appHarness.baseUrl}/api/v1/session`, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "install-admin-20",
      },
    });

    assert.equal(adminResponse.status, 200);
    assert.equal(regularUserResponse.status, 200);
    const adminSession = await adminResponse.json();
    const regularUserSession = await regularUserResponse.json();

    assert.equal(adminSession.authenticationMode, "databricks");
    assert.equal(adminSession.installationAdmin, true);
    assert.equal(regularUserSession.userId, "install-admin-20");
    assert.equal(regularUserSession.installationAdmin, false);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_StaticRequest_ReturnsFileAndFallsBackToSpaEntry", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(`${appHarness.baseUrl}/apps/example-app`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(await response.text(), "<!doctype html><title>test</title>");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_LargeRequestBody_ReturnsPayloadTooLarge", async () => {
  const appHarness = await createAppHarness({ maxRequestBytes: 8 });

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/unused`, {
      method: "POST",
      body: "123456789",
    });
    const problem = await response.json();

    assert.equal(response.status, 413);
    assert.equal(problem.code, "request_too_large");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_UnknownApiRoute_ReturnsProblemDetails", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/missing`);
    const problem = await response.json();

    assert.equal(response.status, 404);
    assert.equal(problem.title, "API route not found");
    assert.equal(problem.status, 404);
    assert.ok(problem.requestId);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectRoutes_CreateListAndReturnCallerOwnedProjects", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Sales dashboard", description: "A view" }),
    });
    const createdProject = await createResponse.json();
    const listResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`);
    const projectList = await listResponse.json();
    const getResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${createdProject.id}`,
    );
    const loadedProject = await getResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createdProject.name, "Sales dashboard");
    assert.equal(createdProject.createdBy, "local-editor");
    assert.equal(createdProject.callerRole, "owner");
    assert.equal(listResponse.status, 200);
    assert.equal(projectList.items.length, 1);
    assert.equal(getResponse.status, 200);
    assert.equal(loadedProject.id, createdProject.id);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectPortability_ExportsAndImportsCallerOwnedStandaloneProjects", async () => {
  const appHarness = await createAppHarness();
  const headers = { "content-type": "application/json" };

  try {
    const createdResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Source portable project", description: "Round trip" }),
    });
    const sourceProject = await createdResponse.json();
    const exportResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${sourceProject.id}/export`,
      { headers },
    );
    const bundle = await exportResponse.json();

    assert.equal(exportResponse.status, 200);
    assert.equal(bundle.format, "vdab-project");
    assert.equal(bundle.project.name, "Source portable project");
    assert.equal(JSON.stringify(bundle).includes("workspaceId"), false);
    bundle.project.name = "Imported portable project";
    bundle.project.resourceReferences = [
      { key: "resource_1", kind: "sqlWarehouse", label: "Warehouse requiring reselection" },
    ];

    const importResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects/import`, {
      method: "POST",
      headers,
      body: JSON.stringify(bundle),
    });
    const importResult = await importResponse.json();

    assert.equal(importResponse.status, 201);
    assert.equal(importResult.project.name, "Imported portable project");
    assert.equal(importResult.project.createdBy, "local-editor");
    assert.equal(importResult.project.callerRole, "owner");
    assert.equal(importResult.requiresChildAppSelection, true);
    assert.deepEqual(importResult.unresolvedResources, bundle.project.resourceReferences);

    const importedComponents = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${importResult.project.id}/components`,
      { headers },
    );
    assert.equal(importedComponents.status, 200);
    assert.deepEqual((await importedComponents.json()).components, []);

    const legacyImport = await fetch(`${appHarness.baseUrl}/api/v1/projects/import`, {
      method: "POST",
      headers,
      body: JSON.stringify({ format: "former-saas-project", schemaVersion: 1 }),
    });
    assert.equal(legacyImport.status, 400);
    assert.equal((await legacyImport.json()).code, "invalid_project_export");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectMetadataUpdate_SavesAndRejectsStaleVersion", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Sales dashboard", description: "Initial" }),
    });
    const createdProject = await createResponse.json();
    const updateResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${createdProject.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Sales overview",
          description: "Saved description",
          version: createdProject.version,
        }),
      },
    );
    const updatedProject = await updateResponse.json();
    const staleResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${createdProject.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Stale edit",
          description: null,
          version: createdProject.version,
        }),
      },
    );
    const staleProblem = await staleResponse.json();
    const reopenedResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${createdProject.id}`,
    );
    const reopenedProject = await reopenedResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updatedProject.name, "Sales overview");
    assert.equal(updatedProject.version, createdProject.version + 1);
    assert.equal(staleResponse.status, 409);
    assert.equal(staleProblem.code, "project_version_conflict");
    assert.equal(reopenedProject.name, "Sales overview");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectMetadataUpdate_RejectsAuthorityFields", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Sales dashboard" }),
    });
    const project = await createResponse.json();
    const updateResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Sales dashboard",
          description: null,
          version: 1,
          workspaceHost: "https://other.example.com",
        }),
      },
    );
    const problem = await updateResponse.json();

    assert.equal(updateResponse.status, 400);
    assert.equal(problem.code, "invalid_project");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectComponents_SaveReopenAndRejectStaleVersion", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Canvas project" }),
    });
    const project: unknown = await createResponse.json();
    const projectId = readProjectId(project);
    const components = [
      {
        key: "parent-page",
        type: "Tabs",
        schemaVersion: 1,
        componentVersion: 2,
        codeName: "mainTabs",
        description: "Main page tabs",
        properties: { tabs: ["Summary", "Details"], defaultTabIndex: 0 },
        bindings: null,
        children: ["child-input"],
        layout: null,
      },
      {
        key: "child-input",
        type: "TextInput",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "customerName",
        description: null,
        properties: { label: "Customer name", required: true },
        bindings: { value: { kind: "local", path: "customer.name" } },
        children: [],
        layout: { tabIndex: 0, y: 0 },
      },
    ];
    const saveResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: 1, components }),
      },
    );
    const saved: unknown = await saveResponse.json();
    const readResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
    );
    const reopened: unknown = await readResponse.json();
    const staleResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: 1, components: [] }),
      },
    );
    const staleProblem = await staleResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(saveResponse.status, 200);
    assert.equal(readResponse.status, 200);
    assert.equal(staleResponse.status, 409);
    assert.equal(staleProblem.code, "project_version_conflict");
    assert.deepEqual(saved, {
      projectId,
      version: 2,
      components,
    });
    assert.deepEqual(reopened, saved);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectPreview_GeneratesSavedTextInputAndMarksItPreviewOnly", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Preview example" }),
    });
    const projectId = readProjectId(await createResponse.json());
    const saveResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          components: [
            {
              key: "customer-name",
              type: "TextInput",
              schemaVersion: 1,
              componentVersion: 1,
              codeName: "customerName",
              description: null,
              properties: {
                label: "Customer name",
                placeholder: "Enter a name",
                defaultValue: "Ada",
                help: "Shown on the customer record.",
                disabled: false,
                type: "default",
                multiline: false,
                height: "",
              },
              bindings: null,
              children: [],
              layout: null,
            },
          ],
        }),
      },
    );
    assert.equal(saveResponse.status, 200);

    const previewResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/preview`,
      { method: "POST" },
    );
    const preview: unknown = await previewResponse.json();

    assert.equal(previewResponse.status, 200);
    assert.equal(isRecord(preview) && preview.previewOnly, true);
    assert.equal(isRecord(preview) && preview.version, 2);
    assert.equal(
      isRecord(preview) && Array.isArray(preview.files)
        ? isRecord(preview.files[0]) &&
          typeof preview.files[0].content === "string" &&
          preview.files[0].content.includes("st.text_input(")
        : false,
      true,
    );
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ModelChatPreview_UsesCurrentWorkspaceViewerAuthorizationAndRejectsRequestBodies", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Model chat preview" }),
    });
    const projectId = readProjectId(await createResponse.json());
    const saveResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects/${projectId}/components`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: 1,
        components: [
          {
            key: "model-chat-preview",
            type: "ModelChat",
            schemaVersion: 1,
            properties: {
              servingEndpointName: "support-chat",
              title: "Support chat",
              showBorder: true,
              chatTotalHeightPixels: 720,
            },
            bindings: null,
            children: [],
            layout: null,
          },
        ],
      }),
    });

    const previewResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/preview`,
      { method: "POST" },
    );
    const preview = await previewResponse.json();
    const bodyResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceHost: "https://external.invalid" }),
      },
    );
    const bodyProblem = await bodyResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(previewResponse.status, 200);
    assert.match(JSON.stringify(preview), /x-forwarded-access-token/);
    assert.match(JSON.stringify(preview), /serving-endpoints/);
    assert.equal(bodyResponse.status, 400);
    assert.equal(bodyProblem.code, "preview_body_not_supported");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectComponents_RejectsAuthorityFieldsAndBrokenReferences", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Validation project" }),
    });
    const projectId = readProjectId(await createResponse.json());
    const invalidResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          components: [
            {
              key: "component-1",
              type: "TextInput",
              schemaVersion: 1,
              properties: { workspaceHost: "https://attacker.invalid" },
              children: ["missing-child"],
            },
          ],
        }),
      },
    );
    const problem = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.equal(problem.code, "invalid_component_aggregate");
    assert.doesNotMatch(JSON.stringify(problem), /attacker\.invalid/);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectAccess_HidesUnrelatedUsersAndAllowsCreatorGrantedEditor", async () => {
  const projectRepository = new LocalTestProjectRepository();
  const creator = await createAppHarness({ projectRepository });
  const collaboratorIdentity = createIdentityResolver({
    authenticationMode: "local-test",
    nodeEnvironment: "test",
    localUserId: "local-collaborator",
    workspaceHost: undefined,
    workspaceId: undefined,
  });
  const collaborator = await createAppHarness({
    projectRepository,
    identityResolver: collaboratorIdentity,
  });

  try {
    const createResponse = await fetch(`${creator.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Private project" }),
    });
    const project = await createResponse.json();
    const deniedResponse = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}`,
    );
    const deniedProblem = await deniedResponse.json();

    assert.equal(deniedResponse.status, 404);
    assert.equal(deniedProblem.code, "project_not_found");

    const grantResponse = await fetch(
      `${creator.baseUrl}/api/v1/projects/${project.id}/collaborators`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "local-collaborator" }),
      },
    );
    const allowedResponse = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}`,
    );
    const allowedProject = await allowedResponse.json();
    const editorUpdateResponse = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Edited by collaborator",
          description: null,
          version: project.version,
        }),
      },
    );
    const editorUpdatedProject = await editorUpdateResponse.json();
    const editorComponentSaveResponse = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}/components`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: editorUpdatedProject.version,
          components: [
            {
              key: "editor-input",
              type: "TextInput",
              schemaVersion: 1,
              properties: { label: "Shared editor input" },
            },
          ],
        }),
      },
    );
    const editorSavedComponents = await editorComponentSaveResponse.json();
    const editorRemoveResponse = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}/collaborators/local-collaborator`,
      { method: "DELETE" },
    );
    const stillAllowedAfterEditorRemoval = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}`,
    );
    const ownerRemoveResponse = await fetch(
      `${creator.baseUrl}/api/v1/projects/${project.id}/collaborators/local-collaborator`,
      { method: "DELETE" },
    );
    const deniedAfterRemoval = await fetch(
      `${collaborator.baseUrl}/api/v1/projects/${project.id}`,
    );

    assert.equal(grantResponse.status, 204);
    assert.equal(allowedResponse.status, 200);
    assert.equal(allowedProject.callerRole, "editor");
    assert.equal(editorUpdateResponse.status, 200);
    assert.equal(editorUpdatedProject.name, "Edited by collaborator");
    assert.equal(editorComponentSaveResponse.status, 200);
    assert.equal(editorSavedComponents.version, editorUpdatedProject.version + 1);
    assert.equal(editorSavedComponents.components[0].key, "editor-input");
    assert.equal(editorRemoveResponse.status, 404, await editorRemoveResponse.clone().text());
    assert.equal(stillAllowedAfterEditorRemoval.status, 200);
    assert.equal(ownerRemoveResponse.status, 204);
    assert.equal(deniedAfterRemoval.status, 404);
  } finally {
    await Promise.all([creator.dispose(), collaborator.dispose()]);
  }
});

test("HttpApp_ProjectCreate_RejectsWorkspaceAndSecretAuthorityFields", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Invalid authority",
        workspaceHost: "https://other-workspace.example.com",
        accessToken: "not-accepted",
      }),
    });
    const problem = await response.json();

    assert.equal(response.status, 400);
    assert.equal(problem.code, "invalid_project");
    assert.doesNotMatch(JSON.stringify(problem), /not-accepted/);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ComponentDefinitions_ReturnsAuthenticatedFullCatalog", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/component-definitions`,
    );
    const registry: unknown = await response.json();

    assert.equal(response.status, 200);
    assert.ok(isRecord(registry));
    assert.equal(registry.version, 1);
    assert.ok(Array.isArray(registry.components));
    assert.equal(registry.components.length, 33);
    assert.ok(Array.isArray(registry.bindingSchemas));
    assert.equal(registry.bindingSchemas.length, 4);
    const firstStory = registry.components.find(
      (component: unknown) =>
        isRecord(component) && component.type === "AmoebaStory",
    );
    assert.ok(firstStory);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ComponentDefinitionLookup_ReturnsOneDefinitionAndSanitized404", async () => {
  const appHarness = await createAppHarness();

  try {
    const storyResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/component-definitions/HeatMapStory`,
    );
    const story: unknown = await storyResponse.json();
    const missingResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/component-definitions/UnknownComponent`,
    );
    const missingProblem = await missingResponse.json();

    assert.equal(storyResponse.status, 200);
    assert.ok(isRecord(story));
    assert.equal(story.type, "HeatMapStory");
    assert.ok(isRecord(story.props));
    assert.equal(story.props.geographicLevel, "state");
    assert.equal(missingResponse.status, 404);
    assert.equal(missingProblem.code, "component_definition_not_found");
    assert.doesNotMatch(JSON.stringify(missingProblem), /workspace|credential|token/i);

    const malformedResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/component-definitions/%2Fforeign`,
    );
    const malformedProblem: unknown = await malformedResponse.json();

    assert.equal(malformedResponse.status, 400);
    assert.ok(isRecord(malformedProblem));
    assert.equal(malformedProblem.code, "invalid_component_type");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ComponentDefinitions_RequireTrustedDatabricksIdentity", async () => {
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
  });

  try {
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/component-definitions`,
      { headers: { "x-forwarded-user": "spoofed-user" } },
    );
    const problem: unknown = await response.json();

    assert.equal(response.status, 401);
    assert.ok(isRecord(problem));
    assert.equal(problem.code, "databricks_session_required");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectWorkflow_RoundTripsWithSharedVersionAndRejectsStaleOrForeignAuthority", async () => {
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
  });
  const callerHeaders = {
    "x-forwarded-access-token": FORWARDED_TOKEN,
    "x-forwarded-user": "workflow-owner",
  };

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { ...callerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "Workflow project" }),
    });
    const project: unknown = await createResponse.json();
    const projectId = readProjectId(project);
    const route = `${appHarness.baseUrl}/api/v1/projects/${projectId}/workflow`;
    const componentResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/components`,
      {
        method: "PUT",
        headers: { ...callerHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          components: [{
            key: "continue-button",
            type: "Button",
            schemaVersion: 1,
            componentVersion: 1,
            codeName: "continueButton",
            description: null,
            properties: { label: "Continue", variant: "primary", disabled: false, help: "" },
            bindings: null,
            children: [],
            layout: null,
          }],
        }),
      },
    );
    assert.equal(componentResponse.status, 200);

    const initialResponse = await fetch(route, { headers: callerHeaders });
    const initialWorkflow: unknown = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.equal(readProjectVersion(initialWorkflow), 2);
    assert.deepEqual(readWorkflowDefinition(initialWorkflow), { version: 1, workflows: [] });

    const workflow = {
      version: 1,
      workflows: [{
        codeName: "onClick",
        trigger: { componentKey: "continue-button", eventKey: "onClick" },
        nodes: [{
          id: "toast",
          actionType: "triggerToast",
          schemaVersion: 1,
          params: { body: "Complete", duration: { kind: "preset", value: "short" } },
        }],
        edges: [],
      }],
    };
    const saveResponse = await fetch(route, {
      method: "PUT",
      headers: { ...callerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ version: 2, workflow }),
    });
    const savedWorkflow: unknown = await saveResponse.json();
    assert.equal(saveResponse.status, 200);
    assert.equal(readProjectVersion(savedWorkflow), 3);
    assert.deepEqual(readWorkflowDefinition(savedWorkflow), workflow);

    const reopenResponse = await fetch(route, { headers: callerHeaders });
    const reopenedWorkflow: unknown = await reopenResponse.json();
    assert.equal(reopenResponse.status, 200);
    assert.equal(readProjectVersion(reopenedWorkflow), 3);
    assert.deepEqual(readWorkflowDefinition(reopenedWorkflow), workflow);

    const staleResponse = await fetch(route, {
      method: "PUT",
      headers: { ...callerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ version: 2, workflow }),
    });
    const staleProblem: unknown = await staleResponse.json();
    assert.equal(staleResponse.status, 409);
    assert.ok(isRecord(staleProblem));
    assert.equal(staleProblem.code, "project_version_conflict");

    const hostileWorkflow = structuredClone(workflow);
    const hostileParams = hostileWorkflow.workflows[0]!.nodes[0]!.params as Record<string, unknown>;
    hostileParams.workspaceConnectionId = 4;
    const hostileResponse = await fetch(route, {
      method: "PUT",
      headers: { ...callerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ version: 3, workflow: hostileWorkflow }),
    });
    assert.equal(hostileResponse.status, 400);
    assert.equal((await hostileResponse.json()).code, "invalid_project_workflow");

    const unrelatedResponse = await fetch(route, {
      headers: {
        "x-forwarded-access-token": FORWARDED_TOKEN,
        "x-forwarded-user": "unrelated-user",
      },
    });
    assert.equal(unrelatedResponse.status, 404);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectCustomModules_SaveReopenPreviewAndRejectSecrets", async () => {
  const appHarness = await createAppHarness({
    identityResolver: createIdentityResolver({
      authenticationMode: "databricks",
      nodeEnvironment: "test",
      localUserId: undefined,
      workspaceHost: WORKSPACE_HOST,
      workspaceId: "test-workspace",
    }),
  });
  const headers = {
    "x-forwarded-access-token": FORWARDED_TOKEN,
    "x-forwarded-user": "module-owner",
  };

  try {
    const createResponse = await fetch(`${appHarness.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Module project" }),
    });
    const project = await createResponse.json();
    const projectId = readProjectId(project);
    const route = `${appHarness.baseUrl}/api/v1/projects/${projectId}/custom-modules`;
    const initialResponse = await fetch(route, { headers });
    const initial = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.equal(readProjectVersion(initial), 1);
    assert.match(readCustomModulesSource(initial), /Call Custom Module actions/);

    const source = "def normalize_order(ctx):\n    return {'ok': True}\n";
    const saveResponse = await fetch(route, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: 1, source }),
    });
    const saved = await saveResponse.json();
    assert.equal(saveResponse.status, 200);
    assert.equal(readProjectVersion(saved), 2);
    assert.equal(readCustomModulesSource(saved), source);

    const reopenResponse = await fetch(route, { headers });
    const reopened = await reopenResponse.json();
    assert.equal(readProjectVersion(reopened), 2);
    assert.equal(readCustomModulesSource(reopened), source);

    const previewResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${projectId}/preview`,
      { method: "POST", headers },
    );
    const preview = await previewResponse.json();
    assert.equal(previewResponse.status, 200);
    assert.deepEqual(
      (preview as { files: Array<{ path: string }> }).files.map((file) => file.path),
      ["app.py", "custom_modules.py"],
    );
    assert.match(
      (preview as { files: Array<{ path: string; content: string }> }).files[1]?.content ?? "",
      /def normalize_order\(ctx\):/,
    );

    const secretResponse = await fetch(route, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: 2, source: "API_KEY = 'this-is-a-secret-value'" }),
    });
    assert.equal(secretResponse.status, 422);
    assert.equal((await secretResponse.json()).code, "custom_modules_secret_detected");

    const unrelatedResponse = await fetch(route, {
      headers: { ...headers, "x-forwarded-user": "unrelated-user" },
    });
    assert.equal(unrelatedResponse.status, 404);
  } finally {
    await appHarness.dispose();
  }
});

interface AppHarnessOptions {
  identityResolver?: ReturnType<typeof createIdentityResolver>;
  projectRepository?: ProjectRepository & ProjectComponentsRepository & ProjectWorkflowRepository & ProjectCustomModulesRepository & ProjectPortabilityRepository;
  workspaceAppsClient?: WorkspaceAppsClient;
  workspaceResourcesClient?: WorkspaceResourcesClient;
  workspaceExecutionResourcesClient?: import("../src/workspace-execution-resources-client.ts").WorkspaceExecutionResourcesClient;
  workspaceLakebaseResourcesClient?: WorkspaceLakebaseResourcesClient;
  maxRequestBytes?: number;
  aiBuilderService?: AiBuilderService;
}

interface AppHarness {
  baseUrl: string;
  server: Server;
  dispose: () => Promise<void>;
}

async function createAppHarness(
  options: AppHarnessOptions = {},
): Promise<AppHarness> {
  const staticDirectory = await mkdtemp(join(tmpdir(), "vdab-app-test-"));
  await writeFile(
    join(staticDirectory, "index.html"),
    "<!doctype html><title>test</title>",
  );
  const identityResolver =
    options.identityResolver ??
    createIdentityResolver({
      authenticationMode: "local-test",
      nodeEnvironment: "test",
      localUserId: "local-editor",
      workspaceHost: undefined,
      workspaceId: undefined,
    });
  const workspaceAppsService = new WorkspaceAppsService(
    options.workspaceAppsClient ?? createEmptyAppsClient(),
  );
  const workspaceResourcesService = new WorkspaceResourcesService(
    options.workspaceResourcesClient ?? createEmptyWorkspaceResourcesClient(),
  );
  const workspaceExecutionResourcesService = new WorkspaceExecutionResourcesService(
    options.workspaceExecutionResourcesClient ?? new LocalTestWorkspaceExecutionResourcesClient(),
  );
  const workspaceLakebaseResourcesService = new WorkspaceLakebaseResourcesService(
    options.workspaceLakebaseResourcesClient ?? new LocalTestWorkspaceLakebaseResourcesClient(),
  );
  const projectRepository = options.projectRepository ?? new LocalTestProjectRepository();
  const projectService = new ProjectService(projectRepository, "test-workspace");
  const projectComponentsService = new ProjectComponentsService(
    projectRepository,
    "test-workspace",
  );
  const componentRegistryService = new ComponentRegistryService();
  const projectWorkflowService = new ProjectWorkflowService(
    projectRepository,
    "test-workspace",
    projectComponentsService,
    componentRegistryService,
  );
  const projectCustomModulesService = new ProjectCustomModulesService(
    projectRepository,
    projectRepository,
    "test-workspace",
  );
  const projectPreviewService = new ProjectPreviewService(
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
  );
  const projectPortabilityService = new ProjectPortabilityService(
    projectRepository,
    "test-workspace",
  );
  const server = createHttpApp({
    identityResolver,
    workspaceAppsService,
    workspaceResourcesService,
    workspaceExecutionResourcesService,
    workspaceLakebaseResourcesService,
    projectService,
    projectComponentsService,
    projectWorkflowService,
    projectCustomModulesService,
    projectPreviewService,
    projectPortabilityService,
    aiBuilderService: options.aiBuilderService,
    componentRegistryService,
    staticDirectory,
    workspaceId: "test-workspace",
    workspaceHost: WORKSPACE_HOST,
    maxRequestBytes: options.maxRequestBytes,
    logRequest: () => undefined,
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    dispose: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }

          resolveClose();
        });
      });
      await rm(staticDirectory, { recursive: true, force: true });
    },
  };
}

function createEmptyAppsClient(): WorkspaceAppsClient {
  return {
    listApps: async (): Promise<WorkspaceAppsPage> => ({
      items: [],
      nextPageToken: null,
      authenticationMode: "local-test",
    }),
  };
}

function createEmptyWorkspaceResourcesClient(): WorkspaceResourcesClient {
  return {
    listCatalogs: async () => [],
    listTableSummaries: async () => ({ items: [], hasMore: false }),
    listSchemas: async () => [],
    listVolumes: async () => [],
    listTables: async () => [],
    listGenieSpaces: async () => [],
    listServingEndpoints: async () => [],
  };
}

function readProjectId(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    throw new Error("The HTTP test response did not contain a project ID.");
  }

  return value.id;
}

function readProjectVersion(value: unknown): number {
  if (!isRecord(value) || typeof value.version !== "number") {
    throw new Error("The HTTP test response did not contain a project version.");
  }

  return value.version;
}

function readWorkflowDefinition(value: unknown): unknown {
  if (!isRecord(value) || !("workflow" in value)) {
    throw new Error("The HTTP test response did not contain the workflow.");
  }

  return value.workflow;
}

function readCustomModulesSource(value: unknown): string {
  if (!isRecord(value) || typeof value.source !== "string") {
    throw new Error("The HTTP test response did not contain custom module source.");
  }
  return value.source;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

