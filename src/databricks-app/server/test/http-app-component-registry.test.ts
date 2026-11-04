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
