import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createHttpApp } from "../src/http-app.ts";
import { createIdentityResolver } from "../src/identity.ts";
import { normalizeWorkspaceHost } from "../src/workspace-host.ts";
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

test("WorkspaceHost_NormalizeSchemeLessDatabricksHost_AddsHttpsOrigin", () => {
  assert.equal(
    normalizeWorkspaceHost("dbc-example.cloud.databricks.com"),
    "https://dbc-example.cloud.databricks.com",
  );
});

test("WorkspaceHost_NormalizeHost_RejectsUnsafeComponents", () => {
  assert.throws(
    () => normalizeWorkspaceHost("dbc-example.cloud.databricks.com/other"),
    /HTTPS workspace origin/,
  );
  assert.throws(
    () => normalizeWorkspaceHost("http://dbc-example.cloud.databricks.com"),
    /HTTPS workspace origin/,
  );
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
    getApp: async (_caller, name) => ({ name, description: null, appState: "UNAVAILABLE", computeState: "STOPPED" }),
    startApp: async (_caller, name) => ({ name, description: null, appState: "RUNNING", computeState: "ACTIVE" }),
    stopApp: async (_caller, name) => ({ name, description: null, appState: "UNAVAILABLE", computeState: "STOPPED" }),
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
