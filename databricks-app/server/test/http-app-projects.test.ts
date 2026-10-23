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

test("HttpApp_ProjectRoutes_CreateListAndReturnCallerOwnedProjects", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Sales dashboard",
          description: "A view",
        }),
      },
    );
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

test("HttpApp_ProjectDelete_OnlyOwnerCanRemoveProjectFromWorkspaceList", async () => {
  const projectRepository = new LocalTestProjectRepository();
  const identityResolver = createIdentityResolver({
    authenticationMode: "databricks",
    nodeEnvironment: "test",
    localUserId: undefined,
    workspaceHost: WORKSPACE_HOST,
    workspaceId: "test-workspace",
  });
  const appHarness = await createAppHarness({
    identityResolver,
    projectRepository,
  });
  const ownerHeaders = {
    "content-type": "application/json",
    "x-forwarded-access-token": FORWARDED_TOKEN,
    "x-forwarded-user": "project-owner",
  };
  const editorHeaders = {
    "content-type": "application/json",
    "x-forwarded-access-token": FORWARDED_TOKEN,
    "x-forwarded-user": "project-editor",
  };

  try {
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({ name: "Owner project" }),
      },
    );
    const project = await createResponse.json();
    const editorGranted = await projectRepository.grantEditor(
      project.id,
      "project-editor",
      {
        workspaceId: "test-workspace",
        userId: "project-owner",
        isInstallationAdmin: false,
        requestId: "seed-editor-for-delete-test",
      },
    );
    const deniedResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      { method: "DELETE", headers: editorHeaders },
    );
    const stillAvailableResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      { headers: ownerHeaders },
    );
    const deleteResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      { method: "DELETE", headers: ownerHeaders },
    );
    const hiddenResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      { headers: ownerHeaders },
    );
    const projectListResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      { headers: ownerHeaders },
    );

    assert.equal(createResponse.status, 201);
    assert.equal(editorGranted, true);
    assert.equal(deniedResponse.status, 404);
    assert.equal(stillAvailableResponse.status, 200);
    assert.equal(deleteResponse.status, 204);
    assert.equal(await deleteResponse.text(), "");
    assert.equal(hiddenResponse.status, 404);
    assert.deepEqual((await projectListResponse.json()).items, []);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectCollaboratorGrant_RejectsUnverifiedDatabricksUserIds", async () => {
  const identityResolver = createIdentityResolver({
    authenticationMode: "databricks",
    nodeEnvironment: "test",
    localUserId: undefined,
    workspaceHost: WORKSPACE_HOST,
    workspaceId: "test-workspace",
  });
  const appHarness = await createAppHarness({ identityResolver });
  const ownerHeaders = {
    "content-type": "application/json",
    "x-forwarded-access-token": FORWARDED_TOKEN,
    "x-forwarded-user": "project-owner",
  };

  try {
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({ name: "Private project" }),
      },
    );
    const project = await createResponse.json();
    const grantResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}/collaborators`,
      {
        method: "PUT",
        headers: ownerHeaders,
        body: JSON.stringify({ userId: "guessed-workspace-user" }),
      },
    );
    const problem = await grantResponse.json();
    const listResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}/collaborators`,
      { headers: ownerHeaders },
    );

    assert.equal(createResponse.status, 201);
    assert.equal(grantResponse.status, 501);
    assert.equal(problem.code, "collaborator_identity_directory_unavailable");
    assert.doesNotMatch(JSON.stringify(problem), /guessed-workspace-user/);
    assert.deepEqual((await listResponse.json()).items, []);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectDelete_RejectsBodyAndQueryParameters", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Project to retain" }),
      },
    );
    const project = await createResponse.json();
    const queryResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}?force=true`,
      { method: "DELETE" },
    );
    const bodyResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "other-workspace" }),
      },
    );
    const retainedProjectResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${project.id}`,
    );

    assert.equal(queryResponse.status, 400);
    assert.equal(bodyResponse.status, 400);
    assert.equal(retainedProjectResponse.status, 200);
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectPortability_ExportsAndImportsCallerOwnedStandaloneProjects", async () => {
  const appHarness = await createAppHarness();
  const headers = { "content-type": "application/json" };

  try {
    const createdResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Source portable project",
          description: "Round trip",
        }),
      },
    );
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
      {
        key: "resource_1",
        kind: "sqlWarehouse",
        label: "Warehouse requiring reselection",
      },
    ];

    const importResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/import`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(bundle),
      },
    );
    const importResult = await importResponse.json();

    assert.equal(importResponse.status, 201);
    assert.equal(importResult.project.name, "Imported portable project");
    assert.equal(importResult.project.createdBy, "local-editor");
    assert.equal(importResult.project.callerRole, "owner");
    assert.equal(importResult.requiresChildAppSelection, true);
    assert.deepEqual(
      importResult.unresolvedResources,
      bundle.project.resourceReferences,
    );

    const importedComponents = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/${importResult.project.id}/components`,
      { headers },
    );
    assert.equal(importedComponents.status, 200);
    assert.deepEqual((await importedComponents.json()).components, []);

    const legacyImport = await fetch(
      `${appHarness.baseUrl}/api/v1/projects/import`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          format: "former-saas-project",
          schemaVersion: 1,
        }),
      },
    );
    assert.equal(legacyImport.status, 400);
    assert.equal((await legacyImport.json()).code, "invalid_project_export");
  } finally {
    await appHarness.dispose();
  }
});

test("HttpApp_ProjectMetadataUpdate_SavesAndRejectsStaleVersion", async () => {
  const appHarness = await createAppHarness();

  try {
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Sales dashboard",
          description: "Initial",
        }),
      },
    );
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
    const createResponse = await fetch(
      `${appHarness.baseUrl}/api/v1/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Sales dashboard" }),
      },
    );
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
