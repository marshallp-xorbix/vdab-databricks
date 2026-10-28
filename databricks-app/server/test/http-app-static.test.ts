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

test("HttpApp_JavaScriptAsset_ReturnsExecutableModuleContentType", async () => {
  const appHarness = await createAppHarness();

  try {
    const response = await fetch(`${appHarness.baseUrl}/assets/test.js`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/javascript/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await response.text(), "export {};\n");
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
