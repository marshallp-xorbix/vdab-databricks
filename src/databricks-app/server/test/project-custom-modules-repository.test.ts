import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "../src/db/project-custom-modules-contract.ts";
import { PostgresProjectCustomModulesRepository } from "../src/db/project-custom-modules-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

const owner: ProjectActor = {
  workspaceId: "workspace-a",
  userId: "owner-1",
  isInstallationAdmin: false,
  requestId: "request-1",
};

test("ProjectCustomModulesRepository_ReadsDefaultSourceWithinProjectAcl", async () => {
  const database = new FakeCustomModulesPool();
  database.readRows = [{ version: 3, created_by: "owner-1", source_text: null }];
  const repository = new PostgresProjectCustomModulesRepository(database);

  const document = await repository.getCustomModules("project-1", owner);

  assert.deepEqual(document, {
    projectId: "project-1",
    version: 3,
    source: DEFAULT_CUSTOM_MODULES_SOURCE,
  });
  assert.match(database.statements[0]?.text ?? "", /p\.workspace_id = \$2/);
  assert.match(database.statements[0]?.text ?? "", /acl\.user_id IS NOT NULL OR \$4/);
  assert.deepEqual(database.statements[0]?.values, ["project-1", "workspace-a", "owner-1", false]);
});

test("ProjectCustomModulesRepository_UpsertsSourceAdvancesVersionAndAuditsAtomically", async () => {
  const database = new FakeCustomModulesPool();
  const repository = new PostgresProjectCustomModulesRepository(database);
  const source = "def normalize_order(ctx):\n    return {'ok': True}\n";

  const saved = await repository.replaceCustomModules("project-1", 7, source, owner);

  assert.deepEqual(saved, { projectId: "project-1", version: 8, source });
  assert.equal(database.statements[0]?.text, "BEGIN");
  const access = database.statements.find((statement) => statement.text.includes("FOR UPDATE OF p"));
  assert.match(access?.text ?? "", /c\.role = 'editor'/);
  const upsert = database.statements.find((statement) => statement.text.includes("INSERT INTO vdab_project_custom_modules"));
  assert.deepEqual(upsert?.values, ["project-1", source]);
  assert.ok(database.statements.some((statement) => statement.text.includes("UPDATE vdab_projects")));
  assert.ok(database.statements.some((statement) => statement.text.includes("INSERT INTO vdab_audit_events")));
  assert.equal(database.statements.at(-1)?.text, "COMMIT");
});

test("ProjectCustomModulesRepository_RejectsStaleVersionBeforeWritingSource", async () => {
  const database = new FakeCustomModulesPool();
  database.projectVersion = 8;
  const repository = new PostgresProjectCustomModulesRepository(database);

  await assert.rejects(
    () => repository.replaceCustomModules("project-1", 7, "# source", owner),
    (error: unknown) => error instanceof ApplicationError && error.status === 409,
  );
  assert.ok(!database.statements.some((statement) => statement.text.includes("INSERT INTO vdab_project_custom_modules")));
  assert.equal(database.statements.at(-1)?.text, "ROLLBACK");
});

class FakeCustomModulesPool implements SqlPool {
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
          const rows = this.hasProject
            ? [{ version: this.projectVersion, created_by: "owner-1", collaborator_role: null }]
            : [];
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
