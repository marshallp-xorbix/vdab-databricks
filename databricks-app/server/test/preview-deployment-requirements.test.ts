import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";
import { getProjectDeploymentRequirements } from "../src/generation/preview-deployment-requirements.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../src/lakebase-app-resource-binding.ts";
import { createSqlWarehouseAppResourceBinding } from "../src/sql-warehouse-app-resource-binding.ts";

const autoscalingWorkflow = createWorkflow({
  sqlSourceKind: "lakebaseAutoscaling",
  sqlTemplate: "SELECT 1",
  placeholders: [],
  lakebaseAppResourceName: "postgres",
  lakebaseDatabaseName: "appdb",
  lakebaseDatabaseId: "database-one",
  lakebaseProjectId: "project-one",
  lakebaseBranchId: "branch-one",
  lakebaseEndpointId: "endpoint-one",
});

test("ProjectDeploymentRequirements_DerivesAutoscalingAppResourceFromWorkspaceBinding", () => {
  const requirements = getProjectDeploymentRequirements(
    [],
    autoscalingWorkflow,
  );

  assert.deepEqual(requirements.appResources, [
    createAutoscalingAppResourceBinding({
      projectId: "project-one",
      branchId: "branch-one",
      endpointId: "endpoint-one",
      databaseId: "database-one",
    }).resource,
  ]);
  assert.deepEqual(requirements.blockers, []);
  assert.deepEqual(requirements.userApiScopes, ["postgres"]);
});

test("ProjectDeploymentRequirements_DeduplicatesSameAutoscalingDatabaseAcrossComponentsAndWorkflows", () => {
  const requirements = getProjectDeploymentRequirements(
    [createAutoscalingComponent()],
    autoscalingWorkflow,
  );

  assert.equal(requirements.appResources.length, 1);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_AllowsMultipleDistinctLakebaseDatabases", () => {
  const requirements = getProjectDeploymentRequirements(
    [createAutoscalingComponent("database-two")],
    autoscalingWorkflow,
  );

  assert.equal(requirements.appResources.length, 2);
  assert.deepEqual(requirements.blockers, []);
  assert.notEqual(
    requirements.appResources[0]?.name,
    requirements.appResources[1]?.name,
  );
});

test("ProjectDeploymentRequirements_BlocksUnresolvedOrLegacyAutoscalingReferences", () => {
  const missingDatabaseIdWorkflow = createWorkflow({
    ...autoscalingWorkflow.workflows[0]!.nodes[0]!.params,
    lakebaseDatabaseId: undefined,
  });
  const unresolvedWorkflow = createWorkflow({
    ...autoscalingWorkflow.workflows[0]!.nodes[0]!.params,
    lakebaseDatabaseId: "unresolved_resource_1",
    lakebaseDatabaseName: "unresolved_resource_1",
    lakebaseProjectId: "unresolved_resource_1",
    lakebaseBranchId: "unresolved_resource_1",
    lakebaseEndpointId: "unresolved_resource_1",
    lakebaseAppResourceName: "unresolved_resource_1",
  });

  assert.equal(
    getProjectDeploymentRequirements([], missingDatabaseIdWorkflow).blockers[0]
      ?.code,
    "lakebase_app_resource_incomplete",
  );
  assert.equal(
    getProjectDeploymentRequirements([], unresolvedWorkflow).blockers[0]?.code,
    "lakebase_app_resource_incomplete",
  );
});

test("ProjectDeploymentRequirements_DerivesProvisionedAppResourceFromExistingDatabase", () => {
  const workflow = createWorkflow({
    sqlSourceKind: "lakebaseProvisionedDatabase",
    sqlTemplate: "SELECT 1",
    placeholders: [],
    lakebaseInstanceName: "existing-instance",
    lakebaseDatabaseName: "databricks_postgres",
  });

  const requirements = getProjectDeploymentRequirements([], workflow);

  assert.deepEqual(requirements.appResources, [
    createProvisionedAppResourceBinding({
      instanceName: "existing-instance",
      databaseName: "databricks_postgres",
    }).resource,
  ]);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_BindsInstalledDefaultForUnityCatalogComponents", () => {
  const requirements = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    { version: 1, workflows: [] },
    "warehouse-123",
  );

  assert.deepEqual(requirements.appResources, [
    createSqlWarehouseAppResourceBinding("warehouse-123").resource,
  ]);
  assert.deepEqual(requirements.userApiScopes, ["sql"]);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_BlocksUnityCatalogWhenDefaultIsMissingOrInvalid", () => {
  const workflow: ProjectWorkflowDefinition = { version: 1, workflows: [] };

  const missing = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    workflow,
  );
  const invalid = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    workflow,
    "https://untrusted-workspace.example",
  );

  assert.equal(missing.blockers[0]?.code, "default_sql_warehouse_unavailable");
  assert.equal(invalid.blockers[0]?.code, "default_sql_warehouse_unavailable");
  assert.deepEqual(missing.appResources, []);
  assert.deepEqual(invalid.appResources, []);
});

test("ProjectDeploymentRequirements_UsesExplicitBuildSqlWarehouseWithoutDefaultResource", () => {
  const workflow = createWorkflow({
    sqlSourceKind: "unityCatalogTable",
    sqlTemplate: "SELECT 1",
    placeholders: [],
    sqlWarehouseId: "warehouse-123",
    sqlWarehouseName: "Analytics",
  });

  const requirements = getProjectDeploymentRequirements([], workflow);

  assert.deepEqual(requirements.userApiScopes, ["sql"]);
  assert.deepEqual(requirements.appResources, []);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_RequiresViewerFilesScopeForFileUpload", () => {
  const requirements = getProjectDeploymentRequirements(
    [createFileUploadComponent()],
    { version: 1, workflows: [] },
  );

  assert.deepEqual(requirements.userApiScopes, ["files"]);
  assert.deepEqual(requirements.appResources, []);
  assert.deepEqual(requirements.blockers, []);
});

function createUnityCatalogComponent(): ProjectComponent {
  return {
    key: "data-window",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dataWindow",
    description: null,
    properties: {},
    bindings: { unityCatalogTable: {} },
    children: [],
    layout: null,
  };
}

function createFileUploadComponent(): ProjectComponent {
  return {
    key: "file-upload",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "fileUpload",
    description: null,
    properties: {},
    bindings: {},
    children: [],
    layout: null,
  };
}

function createAutoscalingComponent(
  databaseId = "database-one",
): ProjectComponent {
  return {
    key: "data-window",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dataWindow",
    description: null,
    properties: {},
    bindings: {
      lakebaseAutoscaling: {
        bindingType: "lakebaseAutoscaling",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "lakebaseAutoscaling",
            projectId: "project-one",
            branchId: "branch-one",
            endpointId: "endpoint-one",
            databaseId,
            database: "appdb",
          },
        },
      },
    },
    children: [],
    layout: null,
  };
}

function createWorkflow(
  params: Record<string, unknown>,
): ProjectWorkflowDefinition {
  return {
    version: 1,
    workflows: [
      {
        codeName: "onSubmit",
        trigger: { componentKey: "form", eventKey: "onSubmit" },
        nodes: [
          { id: "build", actionType: "buildSql", schemaVersion: 1, params },
        ],
        edges: [],
      },
    ],
  };
}
