import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { PostgresProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import { PostgresProjectPortabilityRepository } from "../src/db/project-portability-repository.ts";
import type { ImportedProjectAggregate } from "../src/db/project-portability-contract.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import { runLakebaseMigrations } from "../src/db/migrations.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

const databaseUrl = process.env.VDAB_TEST_DATABASE_URL;

test(
  "PostgresMigrations_AllowNullBindingsAndLayout_AndReadOneConsistentAggregate",
  { skip: databaseUrl ? false : "Set VDAB_TEST_DATABASE_URL to a disposable PostgreSQL database." },
  async () => {
    assert.ok(databaseUrl);
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });

    try {
      await runLakebaseMigrations(adaptPool(pool));
      const projectId = "c2b4ebc7-a404-48a5-a705-66e1a8a46dcb";
      await pool.query(
        `INSERT INTO vdab_projects (id, workspace_id, name, created_by)
         VALUES ($1, $2, $3, $4)`,
        [projectId, "postgres-test-workspace", "PostgreSQL integration", "owner-1"],
      );

      const repository = new PostgresProjectComponentsRepository(adaptPool(pool));
      const actor: ProjectActor = {
        workspaceId: "postgres-test-workspace",
        userId: "owner-1",
        isInstallationAdmin: false,
        requestId: "postgres-integration-request",
      };
      const savedDocument = await repository.replaceComponents(
        projectId,
        1,
        [
          {
            key: "input-one",
            type: "TextInput",
            schemaVersion: 1,
            componentVersion: 1,
            codeName: "inputOne",
            description: null,
            properties: { label: "Name" },
            bindings: null,
            children: [],
            layout: null,
          },
        ],
        actor,
      );
      const loadedDocument = await repository.getComponents(projectId, actor);

      assert.equal(savedDocument?.version, 2);
      assert.equal(loadedDocument?.version, 2);
      assert.equal(loadedDocument?.components[0]?.bindings, null);
      assert.equal(loadedDocument?.components[0]?.layout, null);

      const portabilityRepository = new PostgresProjectPortabilityRepository(adaptPool(pool));
      const importedAggregate: ImportedProjectAggregate = {
        name: "Portable imported project",
        description: "Created by the portability integration test.",
        theme: { primaryColor: "#123456" },
        components: [
          {
            key: "imported-input",
            type: "TextInput",
            schemaVersion: 1,
            componentVersion: 1,
            codeName: "importedInput",
            description: null,
            properties: { label: "Imported name" },
            bindings: null,
            children: [],
            layout: null,
          },
        ],
        workflow: { version: 1, workflows: [] },
        customModulesSource: "def imported_helper(ctx):\n    return ctx",
        resourceReferences: [{ key: "resource_1", kind: "sqlWarehouse", label: "Shared warehouse" }],
      };
      const importedProject = await portabilityRepository.importProjectAggregate(importedAggregate, actor);
      assert.equal(importedProject.callerRole, "owner");
      assert.equal(importedProject.createdBy, actor.userId);

      const portableSnapshot = await portabilityRepository.getProjectAggregate(importedProject.id, actor);
      assert.equal(portableSnapshot?.theme?.primaryColor, "#123456");
      assert.equal(portableSnapshot?.components[0]?.key, "imported-input");
      assert.equal(portableSnapshot?.customModulesSource, importedAggregate.customModulesSource);
      assert.deepEqual(portableSnapshot?.resourceReferences, importedAggregate.resourceReferences);

      await assert.rejects(
        () => portabilityRepository.importProjectAggregate({
          ...importedAggregate,
          name: "Rollback imported project",
          components: [importedAggregate.components[0]!, importedAggregate.components[0]!],
        }, actor),
      );
      const failedImport = await pool.query<{ id: string }>(
        "SELECT id FROM vdab_projects WHERE workspace_id = $1 AND name = $2 AND deleted_at IS NULL",
        [actor.workspaceId, "Rollback imported project"],
      );
      assert.equal(failedImport.rows.length, 0);

      const unrelatedActor = { ...actor, userId: "unrelated-user" };
      assert.equal(await portabilityRepository.getProjectAggregate(importedProject.id, unrelatedActor), null);

      const appliedMigrations = await pool.query<{ migration_id: string }>(
        "SELECT migration_id FROM vdab_schema_migrations ORDER BY migration_id",
      );
      assert.deepEqual(
        appliedMigrations.rows.map((row) => row.migration_id),
        [
          "001_initial_schema",
          "002_component_aggregate",
          "003_component_nullable_properties",
          "004_workflow_aggregate",
          "005_project_portability",
        ],
      );
    } finally {
      await pool.end();
    }
  },
);

function adaptPool(pool: Pool): SqlPool {
  return {
    query: async <Row extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ) => {
      const result = await pool.query<Row>(text, values);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    connect: async (): Promise<SqlClient> => {
      const client = await pool.connect();
      return {
        query: async <Row extends Record<string, unknown>>(
          text: string,
          values?: unknown[],
        ) => {
          const result = await client.query<Row>(text, values);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        release: () => client.release(),
      };
    },
  };
}
