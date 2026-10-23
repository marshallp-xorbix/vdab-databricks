import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { PostgresProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import { PostgresProjectPortabilityRepository } from "../src/db/project-portability-repository.ts";
import { PostgresProjectRepository } from "../src/db/project-repository.ts";
import type { ImportedProjectAggregate } from "../src/db/project-portability-contract.ts";
import { PostgresProjectDeploymentRepository } from "../src/db/project-deployment-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import { runLakebaseMigrations } from "../src/db/migrations.ts";
import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";
import { createAutoscalingAppResourceBinding } from "../src/lakebase-app-resource-binding.ts";
import { createSqlWarehouseAppResourceBinding } from "../src/sql-warehouse-app-resource-binding.ts";

const databaseUrl = process.env.VDAB_TEST_DATABASE_URL;
const requiredAppResources = [
  createAutoscalingAppResourceBinding({
    projectId: "project-one",
    branchId: "branch-one",
    endpointId: "endpoint-one",
    databaseId: "database-one",
  }).resource,
  createSqlWarehouseAppResourceBinding("warehouse-123").resource,
];

test(
  "PostgresMigrations_AllowNullBindingsAndLayout_AndReadOneConsistentAggregate",
  {
    skip: databaseUrl
      ? false
      : "Set VDAB_TEST_DATABASE_URL to a disposable PostgreSQL database.",
  },
  async () => {
    assert.ok(databaseUrl);
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });

    try {
      await runLakebaseMigrations(adaptPool(pool));
      const projectId = "c2b4ebc7-a404-48a5-a705-66e1a8a46dcb";
      await pool.query(
        `INSERT INTO vdab_projects (id, workspace_id, name, created_by)
         VALUES ($1, $2, $3, $4)`,
        [
          projectId,
          "postgres-test-workspace",
          "PostgreSQL integration",
          "owner-1",
        ],
      );

      const repository = new PostgresProjectComponentsRepository(
        adaptPool(pool),
      );
      const actor: ProjectActor = {
        workspaceId: "postgres-test-workspace",
        userId: "owner-1",
        isInstallationAdmin: false,
        requestId: "postgres-integration-request",
      };
      const deploymentRepository = new PostgresProjectDeploymentRepository(
        adaptPool(pool),
      );
      const deploymentSource = [
        {
          path: "app.py",
          content: "import streamlit as st\nst.title('Integration')\n",
        },
        {
          path: "app.yaml",
          content: "command: ['streamlit', 'run', 'app.py']\n",
        },
      ];
      const startedDeployment = await deploymentRepository.createDeployment(
        projectId,
        actor,
        {
          appName: "vdab-integration-child",
          mode: "createNew",
          appId: null,
          createMarker: "VDAB:integration",
          sourceVersion: 3,
          sourceFiles: deploymentSource,
          requiredUserApiScopes: ["sql"],
          requiredAppResources,
        },
        actor.requestId,
      );
      assert.equal(startedDeployment.status, "pending");
      assert.deepEqual(
        startedDeployment.requiredAppResources,
        requiredAppResources,
      );
      const appCreatedDeployment = await deploymentRepository.updateDeployment(
        projectId,
        startedDeployment.id,
        actor,
        {
          action: "deployment.app.created",
          appId: "workspace-app-1",
          sourceCodePath:
            "/Workspace/Users/owner@example.test/.vdab/deployments/integration/first",
        },
      );
      assert.deepEqual(
        appCreatedDeployment?.requiredAppResources,
        requiredAppResources,
      );
      await deploymentRepository.updateDeployment(
        projectId,
        startedDeployment.id,
        actor,
        {
          action: "deployment.failed",
          status: "failed",
          failureCode: "deployment_test_failure",
        },
      );

      const retryDeployment =
        await deploymentRepository.createRecoveryDeployment(
          projectId,
          actor,
          startedDeployment.id,
          "retry",
          actor.requestId,
        );
      assert.deepEqual(retryDeployment.sourceFiles, deploymentSource);
      assert.deepEqual(
        retryDeployment.requiredAppResources,
        startedDeployment.requiredAppResources,
      );
      assert.equal(retryDeployment.attemptOf, startedDeployment.id);
      await deploymentRepository.updateDeployment(
        projectId,
        retryDeployment.id,
        actor,
        {
          action: "deployment.submitted",
          deploymentId: "workspace-deployment-2",
          status: "succeeded",
        },
      );

      const deploymentRollback =
        await deploymentRepository.createRecoveryDeployment(
          projectId,
          actor,
          retryDeployment.id,
          "rollback",
          actor.requestId,
        );
      assert.equal(deploymentRollback.attemptOf, retryDeployment.id);
      assert.deepEqual(
        deploymentRollback.requiredAppResources,
        retryDeployment.requiredAppResources,
      );
      await deploymentRepository.updateDeployment(
        projectId,
        deploymentRollback.id,
        actor,
        {
          action: "deployment.submitted",
          deploymentId: "workspace-deployment-3",
          status: "succeeded",
        },
      );
      const deploymentHistory = await deploymentRepository.listDeployments(
        projectId,
        actor,
      );
      assert.equal(deploymentHistory.length, 3);
      assert.equal(deploymentHistory[0]?.status, "succeeded");
      const deploymentAudit = await pool.query<{
        action: string;
        outcome: string;
        source_request_id: string | null;
        metadata: Record<string, unknown>;
      }>(
        `SELECT action, outcome, source_request_id, metadata
         FROM vdab_audit_events
         WHERE project_id = $1
           AND action IN ('deployment.failed', 'deployment.submitted')
         ORDER BY occurred_at, id`,
        [projectId],
      );
      const failureAudit = deploymentAudit.rows.find(
        (event) => event.action === "deployment.failed",
      );
      const successfulDeploymentAudits = deploymentAudit.rows.filter(
        (event) => event.action === "deployment.submitted",
      );
      assert.equal(failureAudit?.outcome, "failure");
      assert.equal(failureAudit?.source_request_id, actor.requestId);
      assert.equal(
        failureAudit?.metadata.deploymentRecordId,
        startedDeployment.id,
      );
      assert.equal(successfulDeploymentAudits.length, 2);
      assert.deepEqual(
        successfulDeploymentAudits.map((event) => event.outcome),
        ["success", "success"],
      );
      assert.deepEqual(
        successfulDeploymentAudits
          .map((event) => event.metadata.deploymentId)
          .sort(),
        ["workspace-deployment-2", "workspace-deployment-3"],
      );
      assert.ok(
        successfulDeploymentAudits.every(
          (event) => event.source_request_id === actor.requestId,
        ),
      );
      await assert.rejects(() =>
        deploymentRepository.listDeployments(projectId, {
          ...actor,
          userId: "outsider",
        }),
      );

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

      const portabilityRepository = new PostgresProjectPortabilityRepository(
        adaptPool(pool),
      );
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
        resourceReferences: [
          {
            key: "resource_1",
            kind: "sqlWarehouse",
            label: "Shared warehouse",
          },
        ],
      };
      const importedProject =
        await portabilityRepository.importProjectAggregate(
          importedAggregate,
          actor,
        );
      assert.equal(importedProject.callerRole, "owner");
      assert.equal(importedProject.createdBy, actor.userId);

      const portableSnapshot = await portabilityRepository.getProjectAggregate(
        importedProject.id,
        actor,
      );
      assert.equal(portableSnapshot?.theme?.primaryColor, "#123456");
      assert.equal(portableSnapshot?.components[0]?.key, "imported-input");
      assert.equal(
        portableSnapshot?.customModulesSource,
        importedAggregate.customModulesSource,
      );
      assert.deepEqual(
        portableSnapshot?.resourceReferences,
        importedAggregate.resourceReferences,
      );

      await assert.rejects(() =>
        portabilityRepository.importProjectAggregate(
          {
            ...importedAggregate,
            name: "Rollback imported project",
            components: [
              importedAggregate.components[0]!,
              importedAggregate.components[0]!,
            ],
          },
          actor,
        ),
      );
      const failedImport = await pool.query<{ id: string }>(
        "SELECT id FROM vdab_projects WHERE workspace_id = $1 AND name = $2 AND deleted_at IS NULL",
        [actor.workspaceId, "Rollback imported project"],
      );
      assert.equal(failedImport.rows.length, 0);

      const unrelatedActor = { ...actor, userId: "unrelated-user" };
      assert.equal(
        await portabilityRepository.getProjectAggregate(
          importedProject.id,
          unrelatedActor,
        ),
        null,
      );

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
          "006_project_deployments",
          "007_deployment_app_resources",
        ],
      );

      const projectRepository = new PostgresProjectRepository(adaptPool(pool));
      assert.equal(
        await projectRepository.deleteProject(projectId, actor),
        true,
      );
      assert.equal(await projectRepository.getProject(projectId, actor), null);
      const activeProjects = await projectRepository.listProjects(actor);
      assert.deepEqual(
        activeProjects.map((project) => project.id),
        [importedProject.id],
      );

      const retainedApp = await pool.query<{ app_name: string }>(
        "SELECT app_name FROM vdab_project_child_apps WHERE project_id = $1",
        [projectId],
      );
      const retainedDeployments = await pool.query<{ id: string }>(
        "SELECT id FROM vdab_project_deployments WHERE project_id = $1",
        [projectId],
      );
      const deletedRow = await pool.query<{ deleted_at: Date | null }>(
        "SELECT deleted_at FROM vdab_projects WHERE id = $1",
        [projectId],
      );
      const deletionAudit = await pool.query<{
        action: string;
        outcome: string;
        source_request_id: string | null;
      }>(
        `SELECT action, outcome, source_request_id
         FROM vdab_audit_events
         WHERE project_id = $1
         ORDER BY occurred_at DESC, id DESC LIMIT 1`,
        [projectId],
      );

      assert.equal(retainedApp.rows[0]?.app_name, "vdab-integration-child");
      assert.equal(retainedDeployments.rows.length, 3);
      assert.ok(deletedRow.rows[0]?.deleted_at instanceof Date);
      assert.equal(deletionAudit.rows[0]?.action, "project.delete");
      assert.equal(deletionAudit.rows[0]?.outcome, "success");
      assert.equal(deletionAudit.rows[0]?.source_request_id, actor.requestId);
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
