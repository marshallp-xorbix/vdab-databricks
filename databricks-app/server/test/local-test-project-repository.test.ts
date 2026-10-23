import assert from "node:assert/strict";
import test from "node:test";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";

test("LocalTestProjectRepository_RejectsDuplicateNamesWithinWorkspace", async () => {
  const repository = new LocalTestProjectRepository();
  const input = {
    workspaceId: "workspace-a",
    actorId: "creator-1",
    name: "Revenue",
    description: null,
    requestId: "request-local",
  };

  await repository.createProject(input);

  await assert.rejects(() => repository.createProject(input), {
    code: "project_name_conflict",
    status: 409,
  });
});

test("LocalTestProjectRepository_DeleteProjectRemovesItFromActiveAccess", async () => {
  const repository = new LocalTestProjectRepository();
  const actor = {
    workspaceId: "workspace-a",
    userId: "creator-1",
    isInstallationAdmin: false,
    requestId: "request-local-delete",
  };
  const project = await repository.createProject({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    name: "Delete me",
    description: null,
    requestId: actor.requestId,
  });

  assert.equal(await repository.deleteProject(project.id, actor), true);
  assert.equal(await repository.getProject(project.id, actor), null);
  assert.deepEqual(await repository.listProjects(actor), []);
  assert.equal(await repository.deleteProject(project.id, actor), false);
});
