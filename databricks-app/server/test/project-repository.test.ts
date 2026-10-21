import assert from "node:assert/strict";
import test from "node:test";
import { LocalTestProjectRepository } from "../src/db/local-test-project-repository.ts";
import { PostgresProjectRepository } from "../src/db/project-repository.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

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
  assert.match(database.statements[2]?.text ?? "", /INSERT INTO vdab_audit_events/);
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
  assert.match(query?.text ?? "", /p\.created_by = \$1 OR c\.user_id = \$1 OR \$3/);
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
  assert.match(database.statements[0]?.text ?? "", /p\.created_by = \$1 OR c\.user_id = \$1 OR \$4/);
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

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
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
  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
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
  assert.match(database.statements[1]?.text ?? "", /INSERT INTO vdab_audit_events/);
  assert.deepEqual(database.statements[1]?.values?.slice(1, 6), [
    "workspace-a",
    "project-1",
    "recovery-admin",
    "project.read",
    "request-4",
  ]);
  assert.match(database.statements[1]?.text ?? "", /'success'/);
});

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
  assert.deepEqual(deletion?.values, ["project-1", "editor-2", "creator-1", "creator-1"]);
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
  assert.match(database.statements[2]?.text ?? "", /INSERT INTO vdab_audit_events/);
  assert.deepEqual(database.statements[2]?.values?.slice(1, 6), [
    "workspace-a",
    "project-1",
    "recovery-admin",
    "project.collaborators.read.recovery",
    "request-collaborators-admin",
  ]);
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

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

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

  await assert.rejects(
    () => repository.createProject(input),
    { code: "project_name_conflict", status: 409 },
  );
});

interface ProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  caller_role: "owner" | "editor" | "viewer" | "installationAdmin";
}

class FakeSqlPool implements SqlPool {
  readonly statements: Array<{ text: string; values: unknown[] | undefined }> = [];
  projectRows: ProjectRow[] = [];
  ownerRows: Array<Record<string, unknown> & { created_by: string }> = [];
  collaboratorRows: Array<Record<string, unknown>> = [];
  failProjectInsert = false;
  failAuditInsert = false;
  removedCollaboratorRows: Array<Record<string, unknown> & { user_id: string }> = [];
  updateRows: ProjectRow[] = [];
  accessibleRows: Array<Record<string, unknown> & { id: string }> = [];

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>> {
    return this.execute<Row>(text, values);
  }

  async connect(): Promise<SqlClient> {
    return {
      query: <Row extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        values?: unknown[],
      ) => this.execute<Row>(text, values),
      release: () => undefined,
    };
  }

  private async execute<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>> {
    this.statements.push({ text, values });

    if (this.failProjectInsert && text.includes("INSERT INTO vdab_projects")) {
      throw Object.assign(new Error("duplicate project name"), {
        code: "23505",
        constraint: "ux_vdab_projects_workspace_name",
      });
    }

    if (this.failAuditInsert && text.includes("INSERT INTO vdab_audit_events")) {
      throw new Error("audit database unavailable");
    }

    if (text.includes("INSERT INTO vdab_projects")) {
      const project = createProjectRow(
        String(values?.[4]),
        "owner",
        String(values?.[0]),
      );
      project.name = String(values?.[2]);
      project.description = values?.[3] as string | null;
      return { rows: [project as unknown as Row], rowCount: 1 };
    }

    if (text.includes("SELECT p.id, p.name")) {
      return { rows: this.projectRows as unknown as Row[], rowCount: this.projectRows.length };
    }

    if (text.includes("UPDATE vdab_projects")) {
      return { rows: this.updateRows as unknown as Row[], rowCount: this.updateRows.length };
    }

    if (text.includes("SELECT p.id FROM vdab_projects")) {
      return {
        rows: this.accessibleRows as unknown as Row[],
        rowCount: this.accessibleRows.length,
      };
    }

    if (text.includes("SELECT created_by")) {
      return { rows: this.ownerRows as unknown as Row[], rowCount: this.ownerRows.length };
    }

    if (text.includes("SELECT user_id, role")) {
      return {
        rows: this.collaboratorRows as unknown as Row[],
        rowCount: this.collaboratorRows.length,
      };
    }

    if (text.includes("DELETE FROM vdab_project_collaborators")) {
      return {
        rows: this.removedCollaboratorRows as unknown as Row[],
        rowCount: this.removedCollaboratorRows.length,
      };
    }

    return { rows: [], rowCount: null };
  }
}

function createProjectRow(
  createdBy: string,
  callerRole: ProjectRow["caller_role"],
  id = "project-1",
): ProjectRow {
  const timestamp = new Date("2026-10-16T00:00:00.000Z");
  return {
    id,
    name: "Revenue",
    description: null,
    version: 1,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    caller_role: callerRole,
  };
}
