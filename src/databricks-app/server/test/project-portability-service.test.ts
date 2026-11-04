import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";
import { ProjectPortabilityService } from "../src/db/project-portability-service.ts";
import type { CallerIdentity } from "../src/contracts.ts";

const workspaceId = "portability-test-workspace";
const owner: CallerIdentity = {
  userId: "portability-owner",
  preferredUsername: null,
  email: null,
  authenticationMode: "local-test",
  databricksAccessToken: null,
  isInstallationAdmin: false,
  workspaceId,
};

test("ProjectPortabilityService_ImportsCallerOwnedProjectAndReturnsUnresolvedResources", async () => {
  const repository = new LocalTestProjectRepository();
  const existingProject = await repository.createProject({
    workspaceId,
    actorId: owner.userId,
    name: "Source project",
    description: null,
    requestId: "create-source",
  });
  const service = new ProjectPortabilityService(repository, workspaceId);
  const bundle = await service.exportProject(owner, "export-source", existingProject.id);
  bundle.project.name = "Imported project";
  bundle.project.resourceReferences = [
    { key: "resource_1", kind: "databricksJob", label: "Refresh data" },
  ];

  const result = await service.importProject(owner, "import-project", bundle);

  assert.equal(result.project.name, "Imported project");
  assert.equal(result.project.createdBy, owner.userId);
  assert.equal(result.project.callerRole, "owner");
  assert.equal(result.requiresChildAppSelection, true);
  assert.deepEqual(result.unresolvedResources, bundle.project.resourceReferences);
  assert.ok((await repository.listProjects({
    workspaceId,
    userId: owner.userId,
    isInstallationAdmin: false,
    requestId: "list-imported",
  })).some((project) => project.id === result.project.id));
});

test("ProjectPortabilityService_HidesExportFromUnrelatedUsersAndConflictsOnDuplicateName", async () => {
  const repository = new LocalTestProjectRepository();
  const project = await repository.createProject({
    workspaceId,
    actorId: owner.userId,
    name: "Owned project",
    description: null,
    requestId: "create-owned",
  });
  const service = new ProjectPortabilityService(repository, workspaceId);
  const unrelated = { ...owner, userId: "unrelated-user" };
  await assert.rejects(
    () => service.exportProject(unrelated, "unauthorized-export", project.id),
    (error: unknown) => error instanceof ApplicationError && error.status === 404,
  );

  const bundle = await service.exportProject(owner, "export-owned", project.id);
  bundle.project.name = project.name;
  await assert.rejects(
    () => service.importProject(owner, "duplicate-import", bundle),
    (error: unknown) => error instanceof ApplicationError && error.status === 409,
  );
});
