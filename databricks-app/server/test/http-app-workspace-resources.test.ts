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
import type { WorkspaceLakebaseProvisionedResourcesClient } from "../src/workspace-lakebase-provisioned-resources-client.ts";
import { LocalTestWorkspaceLakebaseProvisionedResourcesClient } from "../src/local-test-workspace-lakebase-provisioned-resources-client.ts";
import { WorkspaceLakebaseProvisionedResourcesService } from "../src/workspace-lakebase-provisioned-resources-service.ts";
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
import type { ProjectDeploymentService } from "../src/project-deployment-service.ts";

import { createAppHarness, WORKSPACE_HOST, FORWARDED_TOKEN, readProjectId, readProjectVersion, readWorkflowDefinition, readCustomModulesSource, isRecord } from "./http-app-test-support.ts";

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


test("HttpApp_ProvisionedLakebaseRoutesUseInstalledWorkspaceIdentityAndRejectAuthorityInput", async () => {
  const callerIdentities: Array<{ userId: string; accessToken: string | null }> = [];
  const client: WorkspaceLakebaseProvisionedResourcesClient = {
    listInstances: async (caller) => {
      callerIdentities.push({ userId: caller.userId, accessToken: caller.databricksAccessToken });
      return [{ instanceName: "instance-a", state: "AVAILABLE" }];
    },
    listSchemas: async (_caller, instanceName, databaseName) =>
      instanceName === "instance-a" && databaseName === "databricks_postgres" ? ["public"] : [],
    listTables: async (_caller, instanceName, databaseName, schemaName) =>
      instanceName === "instance-a" && databaseName === "databricks_postgres" && schemaName === "public"
        ? [{ name: "orders", tableType: "BASE TABLE", columns: [{ name: "id", type: "integer", nullable: false }] }]
        : [],
  };
  const appHarness = await createAppHarness({ workspaceLakebaseProvisionedResourcesClient: client });

  try {
    const instancesResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/instances`);
    const schemasResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/schemas?instanceName=instance-a&databaseName=databricks_postgres`);
    const tablesResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/tables?instanceName=instance-a&databaseName=databricks_postgres&schemaName=public`);
    const authorityResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/instances?workspaceHost=https%3A%2F%2Fattacker.example`);
    const duplicateResponse = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/schemas?instanceName=instance-a&instanceName=instance-b&databaseName=databricks_postgres`);

    assert.deepEqual((await instancesResponse.json()).items, [{ instanceName: "instance-a", state: "AVAILABLE" }]);
    assert.deepEqual((await schemasResponse.json()).items, [{ name: "public" }]);
    assert.deepEqual((await tablesResponse.json()).items, [
      { name: "orders", tableType: "BASE TABLE", columns: [{ name: "id", type: "integer", nullable: false }] },
    ]);
    assert.equal(authorityResponse.status, 400);
    assert.equal((await authorityResponse.json()).code, "invalid_lakebase_provisioned_request");
    assert.equal(duplicateResponse.status, 400);
    assert.equal(callerIdentities.length, 1);
    assert.equal(callerIdentities[0]?.userId, "local-editor");
    assert.equal(callerIdentities[0]?.accessToken, null);
  } finally {
    await appHarness.dispose();
  }
});


test("HttpApp_ProvisionedLakebaseRoutesRequireTrustedDatabricksSession", async () => {
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
    const response = await fetch(`${appHarness.baseUrl}/api/v1/workspace/lakebase/provisioned/instances`, {
      headers: { "x-forwarded-user": "spoofed-user" },
    });
    const problem = await response.json();

    assert.equal(response.status, 401);
    assert.equal(problem.code, "databricks_session_required");
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
    getApp: async (_caller, name) => ({ name, description: null, appState: "UNAVAILABLE", computeState: "STOPPED" }),
    startApp: async (_caller, name) => ({ name, description: null, appState: "RUNNING", computeState: "ACTIVE" }),
    stopApp: async (_caller, name) => ({ name, description: null, appState: "UNAVAILABLE", computeState: "STOPPED" }),
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
