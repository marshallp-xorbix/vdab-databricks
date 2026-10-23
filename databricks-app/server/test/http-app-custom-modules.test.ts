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
