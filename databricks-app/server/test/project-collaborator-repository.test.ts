import assert from "node:assert/strict";
import test from "node:test";
import { PostgresProjectRepository } from "../src/db/project-repository.ts";
import { FakeSqlPool } from "./project-repository-test-support.ts";

test("ProjectRepository_GrantEditorUsesParameterizedActorAndAuditsGrant", async () => {
  const database = new FakeSqlPool();
  database.ownerRows = [{ created_by: "creator-1" }];
  const repository = new PostgresProjectRepository(database);

  const granted = await repository.grantEditor("project-1", "editor-2", {
    workspaceId: "workspace-a",
    userId: "creator-1",
    isInstallationAdmin: false,
    requestId: "request-5",
  });

  assert.equal(granted, true);
  const collaboratorInsert = database.statements.find((statement) =>
    statement.text.includes("INSERT INTO vdab_project_collaborators"),
  );
  assert.deepEqual(collaboratorInsert?.values, [
    "project-1",
    "editor-2",
    "creator-1",
  ]);
  const audit = database.statements.find((statement) =>
    statement.text.includes("INSERT INTO vdab_audit_events"),
  );
  assert.deepEqual(audit?.values?.slice(1, 7), [
    "workspace-a",
    "project-1",
    "creator-1",
    "project.collaborator.grant-editor",
    "request-5",
    JSON.stringify({ targetUserId: "editor-2" }),
  ]);
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_RemoveEditorDeletesAndAuditsInOneTransaction", async () => {
  const database = new FakeSqlPool();
  database.ownerRows = [{ created_by: "creator-1" }];
  database.removedCollaboratorRows = [{ user_id: "editor-2" }];
  const repository = new PostgresProjectRepository(database);

  const removed = await repository.removeEditor("project-1", "editor-2", {
    workspaceId: "workspace-a",
    userId: "creator-1",
    isInstallationAdmin: false,
    requestId: "request-revoke",
  });

  assert.equal(removed, true);
  const deletion = database.statements.find((statement) =>
    statement.text.includes("DELETE FROM vdab_project_collaborators"),
  );
  assert.deepEqual(deletion?.values, [
    "project-1",
    "editor-2",
    "creator-1",
    "creator-1",
  ]);
  const audit = database.statements.find((statement) =>
    statement.text.includes("INSERT INTO vdab_audit_events"),
  );
  assert.deepEqual(audit?.values?.slice(1, 7), [
    "workspace-a",
    "project-1",
    "creator-1",
    "project.collaborator.revoke-editor",
    "request-revoke",
    JSON.stringify({ targetUserId: "editor-2" }),
  ]);
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_RemoveEditorDoesNotAuditAnIdempotentRemoval", async () => {
  const database = new FakeSqlPool();
  database.ownerRows = [{ created_by: "creator-1" }];
  const repository = new PostgresProjectRepository(database);

  const removed = await repository.removeEditor("project-1", "editor-2", {
    workspaceId: "workspace-a",
    userId: "creator-1",
    isInstallationAdmin: false,
    requestId: "request-revoke-missing",
  });

  assert.equal(removed, true);
  assert.equal(
    database.statements.some((statement) =>
      statement.text.includes("INSERT INTO vdab_audit_events"),
    ),
    false,
  );
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_InstallationAdminCollaboratorRecoveryReadIsAudited", async () => {
  const database = new FakeSqlPool();
  database.ownerRows = [{ created_by: "creator-1" }];
  const repository = new PostgresProjectRepository(database);

  const collaborators = await repository.listCollaborators("project-1", {
    workspaceId: "workspace-a",
    userId: "recovery-admin",
    isInstallationAdmin: true,
    requestId: "request-collaborators-admin",
  });

  assert.deepEqual(collaborators, []);
  assert.match(
    database.statements[2]?.text ?? "",
    /INSERT INTO vdab_audit_events/,
  );
  assert.deepEqual(database.statements[2]?.values?.slice(1, 6), [
    "workspace-a",
    "project-1",
    "recovery-admin",
    "project.collaborators.read.recovery",
    "request-collaborators-admin",
  ]);
});
