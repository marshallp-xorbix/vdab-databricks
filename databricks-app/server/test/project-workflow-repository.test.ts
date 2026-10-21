import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { PostgresProjectWorkflowRepository } from "../src/db/project-workflow-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";

const ownerActor: ProjectActor = {
  workspaceId: "workspace-a",
  userId: "owner-1",
  isInstallationAdmin: false,
  requestId: "request-1",
};

const workflow: ProjectWorkflowDefinition = {
  version: 1,
  workflows: [{
    codeName: "onSubmit",
    trigger: { componentKey: "form-one", eventKey: "onSubmit" },
    nodes: [{
      id: "toast-one",
      actionType: "triggerToast",
      schemaVersion: 1,
      params: { body: "Saved", duration: { kind: "preset", value: "short" } },
    }],
    edges: [],
  }],
};

test("ProjectWorkflowRepository_ReadsOrderedProjectScopedWorkflowRows", async () => {
  const database = new FakeWorkflowSqlPool();
  database.readRows = [
    {
      version: 8,
      created_by: "owner-1",
      workflow_key: "onSubmit",
      definition: workflow.workflows[0],
      sort_order: 0,
    },
  ];
  const repository = new PostgresProjectWorkflowRepository(database);

  const document = await repository.getWorkflow("project-1", {
    ...ownerActor,
    userId: "editor-1",
  });

  assert.deepEqual(document, { projectId: "project-1", version: 8, workflow });
  assert.match(database.statements[0]?.text ?? "", /p\.workspace_id = \$2/);
  assert.match(database.statements[0]?.text ?? "", /acl\.user_id IS NOT NULL OR \$4/);
  assert.match(database.statements[0]?.text ?? "", /ORDER BY w\.sort_order, w\.workflow_key/);
  assert.deepEqual(database.statements[0]?.values, ["project-1", "workspace-a", "editor-1", false]);
});

test("ProjectWorkflowRepository_ReplacesWorkflowAndProjectVersionInOneAuditedTransaction", async () => {
  const database = new FakeWorkflowSqlPool();
  const repository = new PostgresProjectWorkflowRepository(database);

  const saved = await repository.replaceWorkflow("project-1", 7, workflow, ownerActor);

  assert.deepEqual(saved, { projectId: "project-1", version: 8, workflow });
  assert.equal(database.statements[0]?.text, "BEGIN");
  const access = database.statements.find((statement) => statement.text.includes("FOR UPDATE OF p"));
  assert.match(access?.text ?? "", /c\.role = 'editor'/);
  assert.deepEqual(access?.values, ["project-1", "workspace-a", "owner-1", false]);
  const workflowInsert = database.statements.find((statement) => statement.text.includes("INSERT INTO vdab_project_workflows"));
  assert.deepEqual(workflowInsert?.values, ["project-1", "onSubmit", JSON.stringify(workflow.workflows[0]), 0]);
  assert.ok(database.statements.some((statement) => statement.text.includes("UPDATE vdab_projects")));
  assert.ok(database.statements.some((statement) => statement.text.includes("INSERT INTO vdab_audit_events")));
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectWorkflowRepository_RejectsStaleVersionBeforeDeletingSavedRows", async () => {
  const database = new FakeWorkflowSqlPool();
  database.projectVersion = 8;
  const repository = new PostgresProjectWorkflowRepository(database);

  await assert.rejects(
    () => repository.replaceWorkflow("project-1", 7, workflow, ownerActor),
    (error: unknown) => error instanceof ApplicationError && error.status === 409,
  );

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
  assert.ok(!database.statements.some((statement) => statement.text.startsWith("DELETE FROM vdab_project_workflows")));
});

class FakeWorkflowSqlPool implements SqlPool {
  readonly statements: Array<{ text: string; values: unknown[] | undefined }> = [];
  readRows: Array<Record<string, unknown>> = [];
  projectVersion = 7;
  hasProject = true;

  async query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<Row>> {
    this.statements.push({ text, values });
    return { rows: this.readRows as Row[], rowCount: this.readRows.length };
  }

  async connect(): Promise<SqlClient> {
    return {
      query: async <Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<Row>> => {
        this.statements.push({ text, values });
        if (text.includes("SELECT p.version, p.created_by")) {
          const rows = this.hasProject ? [{ version: this.projectVersion, created_by: "owner-1" }] : [];
          return { rows: rows as unknown as Row[], rowCount: rows.length };
        }
        if (text.includes("UPDATE vdab_projects")) {
          const rows = [{ version: this.projectVersion + 1 }];
          return { rows: rows as unknown as Row[], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    };
  }
}
