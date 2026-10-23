import assert from "node:assert/strict";
import test from "node:test";
import { PostgresProjectRepository } from "../src/db/project-repository.ts";
import {
  FakeSqlPool,
  createProjectRow,
} from "./project-repository-test-support.ts";

test("ProjectRepository_CreateProjectCommitsOwnerAndAuditAtomically", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectRepository(database);

  const project = await repository.createProject({
    workspaceId: "workspace-a",
    actorId: "creator-1",
    name: "Revenue",
    description: null,
    requestId: "request-1",
  });

  assert.equal(project.createdBy, "creator-1");
  assert.equal(project.callerRole, "owner");
  assert.equal(database.statements[0]?.text, "BEGIN");
  assert.match(database.statements[1]?.text ?? "", /INSERT INTO vdab_projects/);
  assert.deepEqual(database.statements[1]?.values?.slice(1), [
    "workspace-a",
    "Revenue",
    null,
    "creator-1",
  ]);
  assert.match(
    database.statements[2]?.text ?? "",
    /INSERT INTO vdab_audit_events/,
  );
  assert.deepEqual(database.statements[2]?.values?.slice(1, 7), [
    "workspace-a",
    project.id,
    "creator-1",
    "project.create",
    "success",
    "request-1",
  ]);
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_ListProjectsFiltersByWorkspaceCreatorAndCollaborator", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectRepository(database);

  await repository.listProjects({
    workspaceId: "workspace-a",
    userId: "editor-1",
    isInstallationAdmin: false,
    requestId: "request-2",
  });

  const query = database.statements[0];
  assert.match(query?.text ?? "", /p\.workspace_id = \$2/);
  assert.match(
    query?.text ?? "",
    /p\.created_by = \$1 OR c\.user_id = \$1 OR \$3/,
  );
  assert.deepEqual(query?.values, ["editor-1", "workspace-a", false]);
});

test("ProjectRepository_InstallationAdminProjectEnumerationWritesAggregateAudit", async () => {
  const database = new FakeSqlPool();
  database.projectRows = [createProjectRow("creator-1", "installationAdmin")];
  const repository = new PostgresProjectRepository(database);

  const projects = await repository.listProjects({
    workspaceId: "workspace-a",
    userId: "recovery-admin",
    isInstallationAdmin: true,
    requestId: "request-list-admin",
  });

  assert.equal(projects.length, 1);
  const audit = database.statements[1];
  assert.match(audit?.text ?? "", /INSERT INTO vdab_audit_events/);
  assert.deepEqual(audit?.values?.slice(1, 7), [
    "workspace-a",
    null,
    "recovery-admin",
    "project.list.recovery",
    "request-list-admin",
    JSON.stringify({ count: 1 }),
  ]);
});

test("ProjectRepository_HidesUnrelatedProjectByIncludingAclPredicate", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectRepository(database);

  const project = await repository.getProject("project-1", {
    workspaceId: "workspace-a",
    userId: "unrelated-user",
    isInstallationAdmin: false,
    requestId: "request-3",
  });

  assert.equal(project, null);
  assert.match(database.statements[0]?.text ?? "", /p\.workspace_id = \$3/);
  assert.match(
    database.statements[0]?.text ?? "",
    /p\.created_by = \$1 OR c\.user_id = \$1 OR \$4/,
  );
  assert.deepEqual(database.statements[0]?.values, [
    "unrelated-user",
    "project-1",
    "workspace-a",
    false,
  ]);
});

test("ProjectRepository_UpdateIsWorkspaceAndAclScopedAndAuditedInOneTransaction", async () => {
  const database = new FakeSqlPool();
  const updatedRow = createProjectRow("creator-1", "owner");
  updatedRow.name = "Updated revenue";
  updatedRow.version = 2;
  database.updateRows = [updatedRow];
  const repository = new PostgresProjectRepository(database);

  const project = await repository.updateProject(
    "project-1",
    {
      name: "Updated revenue",
      description: "Updated description",
      expectedVersion: 1,
    },
    {
      workspaceId: "workspace-a",
      userId: "creator-1",
      isInstallationAdmin: false,
      requestId: "request-update",
    },
  );

  const update = database.statements[1];
  const audit = database.statements[2];
  assert.equal(project?.version, 2);
  assert.match(update?.text ?? "", /p\.workspace_id = \$2/);
  assert.match(update?.text ?? "", /p\.version = \$3/);
  assert.match(update?.text ?? "", /c\.role = 'editor'/);
  assert.deepEqual(update?.values, [
    "project-1",
    "workspace-a",
    1,
    "creator-1",
    "Updated revenue",
    "Updated description",
    false,
  ]);
  assert.deepEqual(audit?.values?.slice(1, 7), [
    "workspace-a",
    "project-1",
    "creator-1",
    "project.metadata.update",
    "request-update",
    JSON.stringify({ previousVersion: 1, version: 2 }),
  ]);
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_InstallationAdminMetadataUpdateIsRecoveryAudited", async () => {
  const database = new FakeSqlPool();
  const updatedRow = createProjectRow("creator-1", "installationAdmin");
  updatedRow.version = 2;
  database.updateRows = [updatedRow];
  const repository = new PostgresProjectRepository(database);

  await repository.updateProject(
    "project-1",
    { name: "Revenue", description: null, expectedVersion: 1 },
    {
      workspaceId: "workspace-a",
      userId: "recovery-admin",
      isInstallationAdmin: true,
      requestId: "request-admin-update",
    },
  );

  const audit = database.statements.find((statement) =>
    statement.text.includes("INSERT INTO vdab_audit_events"),
  );
  assert.equal(audit?.values?.[4], "project.metadata.update.recovery");
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_UpdateReturnsConflictForStaleVersionWithoutAudit", async () => {
  const database = new FakeSqlPool();
  database.accessibleRows = [{ id: "project-1" }];
  const repository = new PostgresProjectRepository(database);

  await assert.rejects(
    () =>
      repository.updateProject(
        "project-1",
        { name: "Revenue", description: null, expectedVersion: 2 },
        {
          workspaceId: "workspace-a",
          userId: "creator-1",
          isInstallationAdmin: false,
          requestId: "request-stale",
        },
      ),
    { code: "project_version_conflict", status: 409 },
  );

  assert.ok(
    database.statements.some((statement) => statement.text === "ROLLBACK"),
  );
  assert.equal(
    database.statements.some((statement) =>
      statement.text.includes("INSERT INTO vdab_audit_events"),
    ),
    false,
  );
});

test("ProjectRepository_UpdateHidesUnauthorizedProject", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectRepository(database);

  const project = await repository.updateProject(
    "project-1",
    { name: "Revenue", description: null, expectedVersion: 1 },
    {
      workspaceId: "workspace-b",
      userId: "unrelated-user",
      isInstallationAdmin: false,
      requestId: "request-denied",
    },
  );

  assert.equal(project, null);
  assert.ok(
    database.statements.some((statement) => statement.text === "ROLLBACK"),
  );
  assert.equal(
    database.statements.some((statement) =>
      statement.text.includes("INSERT INTO vdab_audit_events"),
    ),
    false,
  );
});

test("ProjectRepository_UpdateRollsBackWhenAuditWriteFails", async () => {
  const database = new FakeSqlPool();
  database.updateRows = [createProjectRow("creator-1", "owner")];
  database.failAuditInsert = true;
  const repository = new PostgresProjectRepository(database);

  await assert.rejects(() =>
    repository.updateProject(
      "project-1",
      { name: "Updated revenue", description: null, expectedVersion: 1 },
      {
        workspaceId: "workspace-a",
        userId: "creator-1",
        isInstallationAdmin: false,
        requestId: "request-audit-fail",
      },
    ),
  );

  assert.equal(database.statements.at(-1)?.text, "ROLLBACK");
});

test("ProjectRepository_DeleteSoftDeletesOwnerProjectAndAuditsAtomically", async () => {
  const database = new FakeSqlPool();
  database.deletedRows = [{ created_by: "creator-1" }];
  const repository = new PostgresProjectRepository(database);

  const deleted = await repository.deleteProject("project-1", {
    workspaceId: "workspace-a",
    userId: "creator-1",
    isInstallationAdmin: false,
    requestId: "request-delete",
  });

  assert.equal(deleted, true);
  const deletion = database.statements[1];
  assert.match(deletion?.text ?? "", /SET deleted_at = now\(\)/);
  assert.match(
    deletion?.text ?? "",
    /p\.created_by = \$3 OR \$4|created_by = \$3 OR \$4/,
  );
  assert.match(deletion?.text ?? "", /workspace_id = \$2/);
  assert.deepEqual(deletion?.values, [
    "project-1",
    "workspace-a",
    "creator-1",
    false,
  ]);
  const audit = database.statements[2];
  assert.equal(audit?.values?.[4], "project.delete");
  assert.equal(audit?.values?.[5], "request-delete");
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectRepository_InstallationAdminDeleteUsesRecoveryAudit", async () => {
  const database = new FakeSqlPool();
  database.deletedRows = [{ created_by: "creator-1" }];
  const repository = new PostgresProjectRepository(database);

  const deleted = await repository.deleteProject("project-1", {
    workspaceId: "workspace-a",
    userId: "recovery-admin",
    isInstallationAdmin: true,
    requestId: "request-admin-delete",
  });

  assert.equal(deleted, true);
  const audit = database.statements.find((statement) =>
    statement.text.includes("INSERT INTO vdab_audit_events"),
  );
  assert.equal(audit?.values?.[4], "project.delete.recovery");
});

test("ProjectRepository_DeleteHidesMissingOrUnownedProject", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectRepository(database);

  const deleted = await repository.deleteProject("project-1", {
    workspaceId: "workspace-b",
    userId: "unrelated-user",
    isInstallationAdmin: false,
    requestId: "request-delete-denied",
  });

  assert.equal(deleted, false);
  assert.equal(database.statements.at(-1)?.text, "ROLLBACK");
  assert.equal(
    database.statements.some((statement) =>
      statement.text.includes("INSERT INTO vdab_audit_events"),
    ),
    false,
  );
});

test("ProjectRepository_DeleteRollsBackWhenAuditWriteFails", async () => {
  const database = new FakeSqlPool();
  database.deletedRows = [{ created_by: "creator-1" }];
  database.failAuditInsert = true;
  const repository = new PostgresProjectRepository(database);

  await assert.rejects(() =>
    repository.deleteProject("project-1", {
      workspaceId: "workspace-a",
      userId: "creator-1",
      isInstallationAdmin: false,
      requestId: "request-delete-audit-fail",
    }),
  );

  assert.equal(database.statements.at(-1)?.text, "ROLLBACK");
});

test("ProjectRepository_InstallationAdminRecoveryReadWritesAuditRecord", async () => {
  const database = new FakeSqlPool();
  database.projectRows = [createProjectRow("creator-1", "installationAdmin")];
  const repository = new PostgresProjectRepository(database);

  const project = await repository.getProject("project-1", {
    workspaceId: "workspace-a",
    userId: "recovery-admin",
    isInstallationAdmin: true,
    requestId: "request-4",
  });

  assert.equal(project?.callerRole, "installationAdmin");
  assert.match(
    database.statements[1]?.text ?? "",
    /INSERT INTO vdab_audit_events/,
  );
  assert.deepEqual(database.statements[1]?.values?.slice(1, 6), [
    "workspace-a",
    "project-1",
    "recovery-admin",
    "project.read",
    "request-4",
  ]);
  assert.match(database.statements[1]?.text ?? "", /'success'/);
});

test("ProjectRepository_RejectsDuplicateNameWithSafeConflict", async () => {
  const database = new FakeSqlPool();
  database.failProjectInsert = true;
  const repository = new PostgresProjectRepository(database);

  await assert.rejects(
    () =>
      repository.createProject({
        workspaceId: "workspace-a",
        actorId: "creator-1",
        name: "Revenue",
        description: null,
        requestId: "request-6",
      }),
    { code: "project_name_conflict", status: 409 },
  );

  assert.ok(
    database.statements.some((statement) => statement.text === "ROLLBACK"),
  );
});
