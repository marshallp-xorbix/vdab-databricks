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
