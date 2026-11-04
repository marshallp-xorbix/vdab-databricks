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
