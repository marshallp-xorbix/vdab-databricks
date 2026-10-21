import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { runLakebaseMigrations } from "../src/db/migrations.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

test("LakebaseMigrations_AppliesInitialSchemaOnce_AndRecordsChecksum", async () => {
  const database = new FakeSqlPool();

  await runLakebaseMigrations(database);
  await runLakebaseMigrations(database);

  const schemaCalls = database.statements.filter((statement) =>
    statement.text.includes("CREATE TABLE IF NOT EXISTS vdab_projects"),
  );
  const componentCalls = database.statements.filter((statement) =>
    statement.text.includes("ADD COLUMN component_version"),
  );
  const nullableComponentCalls = database.statements.filter((statement) =>
    statement.text.includes("ALTER COLUMN bindings DROP NOT NULL"),
  );
  const migrationRecord = database.migrations.get("001_initial_schema");
  const componentMigrationRecord = database.migrations.get("002_component_aggregate");
  const nullableComponentMigrationRecord = database.migrations.get(
    "003_component_nullable_properties",
  );
  const workflowAggregateMigrationRecord = database.migrations.get(
    "004_workflow_aggregate",
  );
  const projectPortabilityMigrationRecord = database.migrations.get(
    "005_project_portability",
  );

  assert.equal(schemaCalls.length, 1);
  assert.equal(componentCalls.length, 1);
  assert.equal(nullableComponentCalls.length, 1);
  assert.ok(migrationRecord?.checksum);
  assert.ok(componentMigrationRecord?.checksum);
  assert.ok(nullableComponentMigrationRecord?.checksum);
  assert.ok(workflowAggregateMigrationRecord?.checksum);
  assert.ok(projectPortabilityMigrationRecord?.checksum);
  assert.ok(database.statements.some((statement) =>
    statement.text.includes("pg_advisory_xact_lock"),
  ));
  assert.ok(database.statements.some((statement) =>
    statement.text.includes("vdab_project_collaborators"),
  ));
  assert.ok(database.statements.some((statement) =>
    statement.text.includes("vdab_audit_events"),
  ));
});

test("LakebaseMigrations_RejectsModifiedAppliedMigration_AndRollsBack", async () => {
  const database = new FakeSqlPool();
  database.migrations.set("001_initial_schema", { checksum: "old-checksum" });

  await assert.rejects(
    () => runLakebaseMigrations(database, async () => undefined),
    /was modified/,
  );

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

test("LakebaseMigrations_RejectsModifiedComponentMigration_AndRollsBack", async () => {
  const database = new FakeSqlPool();
  await runLakebaseMigrations(database);
  database.migrations.set("002_component_aggregate", {
    checksum: "edited-checksum",
  });

  await assert.rejects(
    () => runLakebaseMigrations(database, async () => undefined),
    /002_component_aggregate was modified/,
  );

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

test("LakebaseMigrations_RejectsModifiedNullableComponentMigration_AndRollsBack", async () => {
  const database = new FakeSqlPool();
  await runLakebaseMigrations(database);
  database.migrations.set("003_component_nullable_properties", {
    checksum: "edited-checksum",
  });

  await assert.rejects(
    () => runLakebaseMigrations(database, async () => undefined),
    /003_component_nullable_properties was modified/,
  );

  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

test("LakebaseMigrations_RetriesTransientConnectionFailure", async () => {
  const database = new FakeSqlPool();
  const delays: number[] = [];
  database.connectionFailuresRemaining = 1;

  await runLakebaseMigrations(database, async (delayMs) => {
    delays.push(delayMs);
  });

  assert.deepEqual(delays, [1000]);
  assert.ok(database.migrations.has("001_initial_schema"));
});

test("LakebaseMigrations_DoesNotRetryInvalidSchemaFailure", async () => {
  const database = new FakeSqlPool();
  const delays: number[] = [];
  database.failSchema = true;

  await assert.rejects(
    () =>
      runLakebaseMigrations(database, async (delayMs) => {
        delays.push(delayMs);
      }),
    /synthetic invalid schema/,
  );

  assert.deepEqual(delays, []);
  assert.ok(database.statements.some((statement) => statement.text === "ROLLBACK"));
});

test("LakebaseMigrations_SchemaContainsNoSaasOrCredentialAuthorityColumns", async () => {
  const schemaPath = resolve(
    import.meta.dirname,
    "../src/db/migrations/001_initial_schema.sql",
  );
  const schema = await readFile(schemaPath, "utf8");

  assert.doesNotMatch(
    schema,
    /\btenant_id\b|\bworkspace_connection_id\b|\baccess_token\b|\brefresh_token\b|\bclient_secret\b|\bpassword\b/i,
  );
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_projects/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_project_components/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_project_workflows/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_project_custom_modules/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_project_resource_references/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_project_deployments/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS vdab_audit_events/);

  const componentMigrationPath = resolve(
    import.meta.dirname,
    "../src/db/migrations/002_component_aggregate.sql",
  );
  const componentMigration = await readFile(componentMigrationPath, "utf8");

  assert.match(componentMigration, /ADD COLUMN code_name/);
  assert.match(componentMigration, /ADD COLUMN component_version/);
  assert.match(componentMigration, /ADD COLUMN children jsonb/);
  assert.match(componentMigration, /ADD COLUMN layout jsonb/);
  assert.doesNotMatch(
    componentMigration,
    /\btenant_id\b|\bworkspace_connection_id\b|\baccess_token\b|\brefresh_token\b|\bclient_secret\b|\bpassword\b/i,
  );

  const nullableComponentMigrationPath = resolve(
    import.meta.dirname,
    "../src/db/migrations/003_component_nullable_properties.sql",
  );
  const nullableComponentMigration = await readFile(
    nullableComponentMigrationPath,
    "utf8",
  );

  assert.match(nullableComponentMigration, /ALTER COLUMN bindings DROP NOT NULL/);
  assert.match(nullableComponentMigration, /ALTER COLUMN layout DROP NOT NULL/);
  assert.doesNotMatch(
    nullableComponentMigration,
    /\btenant_id\b|\bworkspace_connection_id\b|\baccess_token\b|\brefresh_token\b|\bclient_secret\b|\bpassword\b/i,
  );

  const workflowMigrationPath = resolve(
    import.meta.dirname,
    "../src/db/migrations/004_workflow_aggregate.sql",
  );
  const workflowMigration = await readFile(workflowMigrationPath, "utf8");

  assert.match(workflowMigration, /ADD COLUMN sort_order integer NOT NULL DEFAULT 0/);
  assert.match(workflowMigration, /CREATE INDEX ix_vdab_project_workflows_order/);
  assert.doesNotMatch(
    workflowMigration,
    /tenant_id|workspace_connection_id|access_token|refresh_token|client_secret|password/i,
  );

  const projectPortabilityMigration = await readFile(
    resolve(import.meta.dirname, "../src/db/migrations/005_project_portability.sql"),
    "utf8",
  );
  assert.match(projectPortabilityMigration, /ADD COLUMN theme jsonb NULL/);
  assert.doesNotMatch(
    projectPortabilityMigration,
    /tenant_id|workspace_connection_id|access_token|refresh_token|client_secret|password/i,
  );
});

interface MigrationResult extends Record<string, unknown> {
  migration_id: string;
  checksum: string;
}

interface RecordedMigration {
  checksum: string;
}

class FakeSqlPool implements SqlPool {
  readonly statements: Array<{ text: string; values: unknown[] | undefined }> = [];
  readonly migrations = new Map<string, RecordedMigration>();
  connectionFailuresRemaining = 0;
  failSchema = false;

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>> {
    return this.execute<Row>(text, values);
  }

  async connect(): Promise<SqlClient> {
    if (this.connectionFailuresRemaining > 0) {
      this.connectionFailuresRemaining -= 1;
      throw Object.assign(new Error("database starting"), { code: "57P03" });
    }

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

    if (text.includes("SELECT migration_id, checksum")) {
      const migration = this.migrations.get(String(values?.[0]));
      const rows: MigrationResult[] = migration
        ? [
            {
              migration_id: String(values?.[0]),
              checksum: migration.checksum,
            },
          ]
        : [];
      return { rows: rows as unknown as Row[], rowCount: rows.length };
    }

    if (text.includes("INSERT INTO vdab_schema_migrations")) {
      this.migrations.set(String(values?.[0]), {
        checksum: String(values?.[1]),
      });
    }

    if (
      this.failSchema &&
      text.includes("CREATE TABLE IF NOT EXISTS vdab_projects")
    ) {
      throw Object.assign(new Error("synthetic invalid schema"), { code: "42601" });
    }

    return { rows: [], rowCount: null };
  }
}
