import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import type { CallerIdentity } from "../src/contracts.ts";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import { ProjectWorkflowService } from "../src/db/project-workflow-service.ts";
import { ProjectService } from "../src/db/project-service.ts";
import { ComponentRegistryService } from "../src/component-registry/component-registry-service.ts";
import { ProjectPreviewService } from "../src/generation/project-preview-service.ts";

const creator: CallerIdentity = {
  userId: "owner-1",
  preferredUsername: "Owner",
  email: "owner@example.com",
  workspaceId: "untrusted-workspace",
  authenticationMode: "local-test",
  isInstallationAdmin: false,
  databricksAccessToken: null,
};

test("ProjectPreviewService_EnforcesProjectAclBeforeReadingComponents", async () => {
  const repository = new LocalTestProjectRepository();
  const projectService = new ProjectService(repository, "workspace-one");
  const componentsService = new ProjectComponentsService(repository, "workspace-one");
  const workflowService = new ProjectWorkflowService(
    repository,
    "workspace-one",
    componentsService,
    new ComponentRegistryService(),
  );
  const previewService = new ProjectPreviewService(projectService, componentsService, workflowService);
  const project = await projectService.createProject(creator, "create-request", {
    name: "Private project",
  });
  const unrelatedUser: CallerIdentity = { ...creator, userId: "user-two" };

  await assert.rejects(
    () => previewService.generatePreview(unrelatedUser, "preview-request", project.id),
    (error: unknown) =>
      error instanceof ApplicationError && error.status === 404,
  );
});

test("ProjectPreviewService_GeneratesCurrentProjectVersion", async () => {
  const repository = new LocalTestProjectRepository();
  const projectService = new ProjectService(repository, "workspace-one");
  const componentsService = new ProjectComponentsService(repository, "workspace-one");
  const workflowService = new ProjectWorkflowService(
    repository,
    "workspace-one",
    componentsService,
    new ComponentRegistryService(),
  );
  const previewService = new ProjectPreviewService(projectService, componentsService, workflowService);
  const project = await projectService.createProject(creator, "create-request", {
    name: "Empty project",
  });

  const preview = await previewService.generatePreview(
    creator,
    "preview-request",
    project.id,
  );

  assert.equal(preview.projectId, project.id);
  assert.equal(preview.version, project.version);
  assert.equal(preview.previewOnly, true);
  assert.match(preview.files[0]?.content ?? "", /st\.title\('Empty project'\)/);
});
