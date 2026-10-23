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

import {
  createAppHarness,
  WORKSPACE_HOST,
  FORWARDED_TOKEN,
  readProjectId,
  readProjectVersion,
  readWorkflowDefinition,
  readCustomModulesSource,
  isRecord,
} from "./http-app-test-support.ts";

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

test("HttpApp_ProjectDeploymentRoutes_UsesProjectServiceAndReturnsLifecycleContract", async () => {
  let callCount = 0;
  const projectDeploymentService = {
    listHistory: async (
      _caller: CallerIdentity,
      _requestId: string,
      projectId: string,
    ) => {
      callCount += 1;
      assert.equal(projectId, "11111111-1111-4111-8111-111111111111");
      return { childApp: null, items: [] };
    },
    deploy: async (
      _caller: CallerIdentity,
      _requestId: string,
      _projectId: string,
      body: unknown,
    ) => {
      callCount += 1;
      assert.deepEqual(body, {
        mode: "createNew",
        appName: "new-child",
        confirmOverwrite: false,
      });
      return { id: "deployment-record", status: "running" };
    },
  } as unknown as ProjectDeploymentService;
  const appHarness = await createAppHarness({ projectDeploymentService });

  try {
    const history = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/11111111-1111-4111-8111-111111111111/deployments`,
    );
    assert.equal(history.status, 200);
    assert.deepEqual(await history.json(), { childApp: null, items: [] });

    const started = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/11111111-1111-4111-8111-111111111111/deployments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "createNew",
          appName: "new-child",
          confirmOverwrite: false,
        }),
      },
    );
    assert.equal(started.status, 201);
    assert.deepEqual(await started.json(), {
      id: "deployment-record",
      status: "running",
    });
    assert.equal(callCount, 2);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectDeploymentReadinessStatusRetryAndRollback_UseServiceContracts", async () => {
  const calls: string[] = [];
  const projectDeploymentService = {
    getReadiness: async (
      _caller: CallerIdentity,
      _requestId: string,
      projectId: string,
    ) => {
      calls.push(`readiness:${projectId}`);
      return { userApiScopes: ["sql"], blockers: [] };
    },
    getDeployment: async (
      _caller: CallerIdentity,
      _requestId: string,
      _projectId: string,
      deploymentId: string,
    ) => {
      calls.push(`status:${deploymentId}`);
      return { id: deploymentId, status: "succeeded" };
    },
    retry: async (
      _caller: CallerIdentity,
      _requestId: string,
      _projectId: string,
      deploymentId: string,
      body: unknown,
    ) => {
      calls.push(
        `retry:${deploymentId}:${String((body as { confirmOverwrite: boolean }).confirmOverwrite)}`,
      );
      return { id: "retry-record", status: "running" };
    },
    rollback: async (
      _caller: CallerIdentity,
      _requestId: string,
      _projectId: string,
      deploymentId: string,
      body: unknown,
    ) => {
      calls.push(
        `rollback:${deploymentId}:${String((body as { confirmOverwrite: boolean }).confirmOverwrite)}`,
      );
      return { id: "rollback-record", status: "running" };
    },
  } as unknown as ProjectDeploymentService;
  const appHarness = await createAppHarness({ projectDeploymentService });
  const projectPath = `${appHarness.baseUrl}/api/v1/projects/11111111-1111-4111-8111-111111111111/deployments`;
  const deploymentId = "22222222-2222-4222-8222-222222222222";

  try {
    const readiness = await fetch(`${projectPath}/readiness`);
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), {
      userApiScopes: ["sql"],
      blockers: [],
    });

    const status = await fetch(`${projectPath}/${deploymentId}`);
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), {
      id: deploymentId,
      status: "succeeded",
    });

    const retry = await fetch(`${projectPath}/${deploymentId}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmOverwrite: true }),
    });
    assert.equal(retry.status, 202);
    assert.deepEqual(await retry.json(), {
      id: "retry-record",
      status: "running",
    });

    const rollback = await fetch(`${projectPath}/${deploymentId}/rollback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmOverwrite: true }),
    });
    assert.equal(rollback.status, 202);
    assert.deepEqual(await rollback.json(), {
      id: "rollback-record",
      status: "running",
    });

    const readinessWithAuthority = await fetch(
      `${projectPath}/readiness?workspaceId=attacker`,
      { method: "GET" },
    );
    assert.equal(readinessWithAuthority.status, 400);
    assert.deepEqual(calls, [
      "readiness:11111111-1111-4111-8111-111111111111",
      `status:${deploymentId}`,
      `retry:${deploymentId}:true`,
      `rollback:${deploymentId}:true`,
    ]);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectDeploymentRoutes_ReturnUnavailableWhenServiceIsNotConfigured", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/11111111-1111-4111-8111-111111111111/deployments`,
    );
    assert.equal(response.status, 503);
    const problem = (await response.json()) as { code: string };
    assert.equal(problem.code, "child_app_deployment_unavailable");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_WorkspaceAppDeploymentTarget_UsesCurrentCallerAndRejectsAuthorityQuery", async () => {
  let targetCalls = 0;
  const projectDeploymentService = {
    getWorkspaceAppDeploymentTarget: async (
      _caller: CallerIdentity,
      appName: string,
    ) => {
      targetCalls += 1;
      assert.equal(appName, "selected-child");
      return {
        appId: "app-id",
        name: appName,
        description: null,
        spaceName: null,
        effectiveUserApiScopes: null,
        appState: "STOPPED",
        computeState: "STOPPED",
        appUrl: null,
        activeDeploymentId: "deployment-id",
        sourceCodePath: "/Workspace/Users/user@example.test/old-source",
        usesGitSource: false,
        userApiScopes: ["sql"],
      };
    },
  } as unknown as ProjectDeploymentService;
  const appHarness = await createAppHarness({ projectDeploymentService });

  try {
    const response = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/apps/selected-child/deployment-target`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      appId: "app-id",
      name: "selected-child",
      description: null,
      spaceName: null,
      effectiveUserApiScopes: null,
      appState: "STOPPED",
      computeState: "STOPPED",
      appUrl: null,
      activeDeploymentId: "deployment-id",
      sourceCodePath: "/Workspace/Users/user@example.test/old-source",
      usesGitSource: false,
      userApiScopes: ["sql"],
    });
    const authorityResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/workspace/apps/selected-child/deployment-target?workspaceHost=attacker.invalid`,
    );
    assert.equal(authorityResponse.status, 400);
    assert.equal(targetCalls, 1);
  } finally {
    await appHarness.dispose();
  }
});
