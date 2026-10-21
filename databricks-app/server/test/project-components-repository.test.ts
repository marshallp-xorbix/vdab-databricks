import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import { PostgresProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

const ownerActor: ProjectActor = {
  workspaceId: "workspace-a",
  userId: "owner-1",
  isInstallationAdmin: false,
  requestId: "request-1",
};

const componentSet: ProjectComponent[] = [
  {
    key: "page-tabs",
    type: "Tabs",
    schemaVersion: 1,
    componentVersion: 2,
    codeName: "mainTabs",
    description: "Project tabs",
    properties: { tabs: ["Overview", "Details"] },
    bindings: null,
    children: ["customer-input"],
    layout: { order: 0 },
  },
  {
    key: "customer-input",
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "customerInput",
    description: null,
    properties: { label: "Customer" },
    bindings: { value: { kind: "local", path: "customer.name" } },
    children: [],
    layout: { order: 0, column: 1 },
  },
];

test("ProjectComponentsRepository_ReadsWorkspaceScopedComponentsInStableOrder", async () => {
  const database = new FakeSqlPool();
  database.componentRows = [
    toRow(componentSet[1]!, 1, "page-tabs"),
    toRow(componentSet[0]!, 0, null),
  ];
  const repository = new PostgresProjectComponentsRepository(database);

  const document = await repository.getComponents("project-1", {
    ...ownerActor,
    userId: "editor-1",
  });

  assert.equal(document?.version, 7);
  assert.deepEqual(document?.components, componentSet);
  const readQueries = database.statements.filter((statement) =>
    statement.text.includes("SELECT p.version, p.created_by"),
  );
  assert.equal(readQueries.length, 1);
  assert.match(readQueries[0]?.text ?? "", /p\.workspace_id = \$2/);
  assert.match(readQueries[0]?.text ?? "", /acl\.user_id IS NOT NULL OR \$4/);
  assert.match(readQueries[0]?.text ?? "", /LEFT JOIN vdab_project_components pc/);
  assert.match(readQueries[0]?.text ?? "", /ORDER BY pc\.sort_order, pc\.component_key/);
  assert.deepEqual(readQueries[0]?.values, [
    "project-1",
    "workspace-a",
    "editor-1",
    false,
  ]);
});

test("ProjectComponentsRepository_ReturnsEmptyAggregateFromSingleVersionedRead", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectComponentsRepository(database);

  const document = await repository.getComponents("project-1", ownerActor);

  assert.deepEqual(document, {
    projectId: "project-1",
    version: 7,
    components: [],
  });
  assert.equal(
    database.statements.filter((statement) =>
      statement.text.includes("SELECT p.version, p.created_by"),
    ).length,
    1,
  );
});

test("ProjectComponentsRepository_ReplacesComponentsAndProjectVersionAtomically", async () => {
  const database = new FakeSqlPool();
  const repository = new PostgresProjectComponentsRepository(database);

  const result = await repository.replaceComponents(
    "project-1",
    7,
    componentSet,
    ownerActor,
  );

  assert.equal(result?.version, 8);
  assert.deepEqual(result?.components, componentSet);
  assert.equal(database.statements[0]?.text, "BEGIN");
  const accessQuery = database.statements.find((statement) =>
    statement.text.includes("FOR UPDATE OF p"),
  );
  assert.deepEqual(accessQuery?.values, [
    "project-1",
    "workspace-a",
    "owner-1",
    false,
  ]);
  const insertStatements = database.statements.filter((statement) =>
    statement.text.includes("INSERT INTO vdab_project_components"),
  );
  assert.equal(insertStatements.length, 2);
  assert.deepEqual(insertStatements[0]?.values?.slice(1, 7), [
    "page-tabs",
    "Tabs",
    1,
    2,
    0,
    null,
  ]);
  assert.equal(insertStatements[1]?.values?.[6], "page-tabs");
  assert.equal(
    JSON.parse(String(insertStatements[1]?.values?.[9])).label,
    "Customer",
  );
  const auditIndex = database.statements.findIndex((statement) =>
    statement.text.includes("INSERT INTO vdab_audit_events"),
  );
  const commitIndex = database.statements.findIndex(
    (statement) => statement.text === "COMMIT",
  );
  assert.ok(auditIndex > 0 && auditIndex < commitIndex);
  assert.equal(database.projectVersion, 8);
});

test("ProjectComponentsRepository_RejectsStaleVersionWithoutChangingRowsOrAuditing", async () => {
  const database = new FakeSqlPool();
  database.projectVersion = 8;
  database.componentRows = [toRow(componentSet[0]!, 0, null)];
  const repository = new PostgresProjectComponentsRepository(database);

  await assert.rejects(
    () => repository.replaceComponents("project-1", 7, [], ownerActor),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.status === 409 &&
      error.code === "project_version_conflict",
  );

  assert.equal(database.componentRows.length, 1);
  assert.equal(database.projectVersion, 8);
  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
  assert.equal(
    database.statements.some((statement) =>
      statement.text.includes("INSERT INTO vdab_audit_events"),
    ),
    false,
  );
});

test("ProjectComponentsRepository_HidesUnauthorizedProjectWithoutMutation", async () => {
  const database = new FakeSqlPool();
  database.projectAccessible = false;
  const repository = new PostgresProjectComponentsRepository(database);

  const result = await repository.replaceComponents(
    "project-1",
    7,
    componentSet,
    { ...ownerActor, userId: "unrelated-user" },
  );

  assert.equal(result, null);
  assert.equal(database.projectVersion, 7);
  assert.equal(database.statements.some((statement) =>
    statement.text.includes("DELETE FROM vdab_project_components"),
  ), false);
});

test("ProjectComponentsRepository_RollsBackComponentsVersionAndAuditWhenAuditFails", async () => {
  const database = new FakeSqlPool();
  database.componentRows = [toRow(componentSet[0]!, 0, null)];
  database.failAudit = true;
  const repository = new PostgresProjectComponentsRepository(database);

  await assert.rejects(() =>
    repository.replaceComponents("project-1", 7, componentSet, ownerActor),
  );

  assert.equal(database.projectVersion, 7);
  assert.equal(database.componentRows.length, 1);
  assert.equal(database.componentRows[0]?.component_key, "page-tabs");
  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

test("ProjectComponentsRepository_AuditsInstallationAdminRecoveryRead", async () => {
  const database = new FakeSqlPool();
  database.projectCreatedBy = "different-owner";
  const repository = new PostgresProjectComponentsRepository(database);

  const result = await repository.getComponents("project-1", {
    ...ownerActor,
    userId: "recovery-admin",
    isInstallationAdmin: true,
  });

  assert.ok(result);
  const audit = database.statements.at(-1);
  assert.match(audit?.text ?? "", /INSERT INTO vdab_audit_events/);
  assert.equal(audit?.values?.[4], "project.components.read.recovery");
});

interface Statement {
  text: string;
  values: unknown[] | undefined;
}

interface ComponentRow extends Record<string, unknown> {
  component_key: string;
  component_type: ProjectComponent["type"];
  schema_version: number;
  component_version: number;
  sort_order: number;
  code_name: string | null;
  description: string | null;
  properties: ProjectComponent["properties"];
  bindings: ProjectComponent["bindings"];
  children: string[];
  layout: ProjectComponent["layout"];
}

class FakeSqlPool implements SqlPool {
  statements: Statement[] = [];
  componentRows: ComponentRow[] = [];
  projectVersion = 7;
  projectCreatedBy = "owner-1";
  projectAccessible = true;
  failAudit = false;
  private transactionSnapshot: {
    projectVersion: number;
    componentRows: ComponentRow[];
  } | null = null;

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

    if (text === "BEGIN") {
      this.transactionSnapshot = {
        projectVersion: this.projectVersion,
        componentRows: structuredClone(this.componentRows),
      };
    } else if (text === "ROLLBACK" && this.transactionSnapshot) {
      this.projectVersion = this.transactionSnapshot.projectVersion;
      this.componentRows = this.transactionSnapshot.componentRows;
      this.transactionSnapshot = null;
    } else if (text === "COMMIT") {
      this.transactionSnapshot = null;
    } else if (text.includes("SELECT p.version, p.created_by")) {
      const rows = this.projectAccessible
        ? this.readProjectRows()
        : [];
      return { rows: rows as unknown as Row[], rowCount: rows.length };
    } else if (text.includes("DELETE FROM vdab_project_components")) {
      this.componentRows = [];
    } else if (text.includes("INSERT INTO vdab_project_components")) {
      this.componentRows.push({
        component_key: String(values?.[1]),
        component_type: String(values?.[2]) as ProjectComponent["type"],
        schema_version: Number(values?.[3]),
        component_version: Number(values?.[4]),
        sort_order: Number(values?.[5]),
        parent_key: values?.[6],
        code_name: values?.[7] as string | null,
        description: values?.[8] as string | null,
        properties: JSON.parse(String(values?.[9])) as ProjectComponent["properties"],
        bindings:
          values?.[10] === null
            ? null
            : (JSON.parse(String(values?.[10])) as ProjectComponent["bindings"]),
        children: JSON.parse(String(values?.[11])) as string[],
        layout:
          values?.[12] === null
            ? null
            : (JSON.parse(String(values?.[12])) as ProjectComponent["layout"]),
      });
    } else if (text.includes("UPDATE vdab_projects AS p")) {
      this.projectVersion += 1;
      const rows = [{ version: this.projectVersion }];
      return { rows: rows as unknown as Row[], rowCount: 1 };
    } else if (text.includes("INSERT INTO vdab_audit_events") && this.failAudit) {
      throw new Error("Synthetic audit write failure");
    }

    return { rows: [], rowCount: null };
  }

  private readProjectRows(): Array<Record<string, unknown>> {
    if (this.componentRows.length === 0) {
      return [
        {
          version: this.projectVersion,
          created_by: this.projectCreatedBy,
          component_key: null,
          component_type: null,
          schema_version: null,
          component_version: null,
          sort_order: null,
          code_name: null,
          description: null,
          properties: null,
          bindings: null,
          children: null,
          layout: null,
        },
      ];
    }

    return [...this.componentRows]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((component) => ({
        version: this.projectVersion,
        created_by: this.projectCreatedBy,
        ...component,
      }));
  }
}

function toRow(
  component: ProjectComponent,
  sortOrder: number,
  parentKey: string | null,
): ComponentRow {
  return {
    component_key: component.key,
    component_type: component.type,
    schema_version: component.schemaVersion,
    component_version: component.componentVersion,
    sort_order: sortOrder,
    parent_key: parentKey,
    code_name: component.codeName,
    description: component.description,
    properties: component.properties,
    bindings: component.bindings,
    children: component.children,
    layout: component.layout,
  };
}
