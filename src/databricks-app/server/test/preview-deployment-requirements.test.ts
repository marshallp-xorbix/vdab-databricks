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
  assert.match(
    missing.blockers[0]?.detail ?? "",
    /App Settings → Resources/,
  );
  assert.deepEqual(missing.appResources, []);
  assert.deepEqual(invalid.appResources, []);
});

test("ProjectDeploymentRequirements_UsesChildAppSqlWarehouseWithoutBuilderEnv", () => {
  const childWarehouse = {
    name: "sql-warehouse",
    description: "Analytics warehouse",
    sql_warehouse: { id: "child-wh-1", permission: "CAN_USE" as const },
  };
  const requirements = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    { version: 1, workflows: [] },
    null,
    [childWarehouse],
  );

  assert.deepEqual(requirements.appResources, [childWarehouse]);
  assert.deepEqual(requirements.userApiScopes, ["sql"]);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_PrefersSqlWarehouseKeyOverOtherWarehouseNames", () => {
  const other = {
    name: "analytics-wh",
    description: "Other",
    sql_warehouse: { id: "other-id", permission: "CAN_USE" as const },
  };
  const preferred = {
    name: "sql-warehouse",
    description: "Preferred",
    sql_warehouse: { id: "preferred-id", permission: "CAN_USE" as const },
  };
  const requirements = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    { version: 1, workflows: [] },
    "builder-fallback",
    [other, preferred],
  );

  assert.deepEqual(requirements.appResources, [preferred]);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_IncompleteUnityCatalogBinding_DoesNotRequireWarehouse", () => {
  const requirements = getProjectDeploymentRequirements(
    [createIncompleteUnityCatalogComponent()],
    { version: 1, workflows: [] },
  );

  assert.deepEqual(requirements.userApiScopes, []);
  assert.deepEqual(requirements.appResources, []);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_FallsBackToBuilderEnvWhenChildHasNoWarehouse", () => {
  const requirements = getProjectDeploymentRequirements(
    [createUnityCatalogComponent()],
    { version: 1, workflows: [] },
    "warehouse-123",
    [],
  );

  assert.deepEqual(requirements.appResources, [
    createSqlWarehouseAppResourceBinding("warehouse-123").resource,
  ]);
  assert.deepEqual(requirements.blockers, []);
});

test("ProjectDeploymentRequirements_ExplicitBuildSqlWarehouseStillRequiresDefaultResource", () => {
  const workflow = createWorkflow({
    sqlSourceKind: "unityCatalogTable",
    sqlTemplate: "SELECT 1",
    placeholders: [],
    sqlWarehouseId: "warehouse-123",
    sqlWarehouseName: "Analytics",
  });

  const missing = getProjectDeploymentRequirements([], workflow);
  const withDefault = getProjectDeploymentRequirements(
    [],
    workflow,
    "warehouse-123",
  );

  assert.deepEqual(missing.userApiScopes, ["sql"]);
  assert.deepEqual(missing.appResources, []);
  assert.equal(missing.blockers[0]?.code, "default_sql_warehouse_unavailable");
  assert.deepEqual(withDefault.appResources, [
    createSqlWarehouseAppResourceBinding("warehouse-123").resource,
  ]);
  assert.deepEqual(withDefault.blockers, []);
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

test("ProjectDeploymentRequirements_UnboundGenieAndModelChat_AddDeployBlockers", () => {
  const requirements = getProjectDeploymentRequirements(
    [
      {
        key: "genie-chat",
        type: "GenieChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "genieChat",
        description: null,
        properties: { genieSpaceAppResourceName: "" },
        bindings: null,
        children: [],
        layout: null,
      },
      {
        key: "model-chat",
        type: "ModelChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "modelChat",
        description: null,
        properties: { servingEndpointAppResourceName: "" },
        bindings: null,
        children: [],
        layout: null,
      },
    ],
    { version: 1, workflows: [] },
  );

  assert.deepEqual(requirements.userApiScopes, ["genie", "model-serving"]);
  assert.equal(requirements.blockers.length, 2);
  assert.equal(requirements.blockers[0]?.code, "genie_chat_unbound");
  assert.equal(requirements.blockers[1]?.code, "model_chat_unbound");
});

test("ProjectDeploymentRequirements_BoundChatResources_MergeFromChildAppGrants", () => {
  const genieGrant = {
    name: "claims-genie",
    description: "Claims Genie",
    genie_space: {
      name: "Claims",
      space_id: "space-1",
      permission: "CAN_RUN" as const,
    },
  };
  const servingGrant = {
    name: "claims-endpoint",
    description: "Claims endpoint",
    serving_endpoint: {
      name: "claims-endpoint",
      permission: "CAN_QUERY" as const,
    },
  };
  const requirements = getProjectDeploymentRequirements(
    [
      {
        key: "genie-chat",
        type: "GenieChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "genieChat",
        description: null,
        properties: { genieSpaceAppResourceName: "claims-genie" },
        bindings: null,
        children: [],
        layout: null,
      },
      {
        key: "model-chat",
        type: "ModelChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "modelChat",
        description: null,
        properties: { servingEndpointAppResourceName: "claims-endpoint" },
        bindings: null,
        children: [],
        layout: null,
      },
    ],
    { version: 1, workflows: [] },
    null,
    [genieGrant, servingGrant],
  );

  assert.deepEqual(requirements.userApiScopes, ["genie", "model-serving"]);
  assert.deepEqual(requirements.appResources, [genieGrant, servingGrant]);
  assert.deepEqual(requirements.blockers, []);
});

test("DeploymentAppResourceSnapshot_RoundTripsGenieAndServingResources", async () => {
  const { readDeploymentAppResourceArray } = await import(
    "../src/db/project-deployment-repository-mapping.ts"
  );
  const resources = [
    {
      name: "claims-genie",
      description: "Claims Genie",
      genie_space: {
        name: "Claims",
        space_id: "space-1",
        permission: "CAN_RUN" as const,
      },
    },
    {
      name: "claims-endpoint",
      description: "Claims endpoint",
      serving_endpoint: {
        name: "claims-endpoint",
        permission: "CAN_QUERY" as const,
      },
    },
  ];
  assert.deepEqual(
    readDeploymentAppResourceArray(JSON.stringify(resources)),
    resources,
  );
});

test("DeploymentAppResourceSnapshot_RoundTripsChildSqlWarehouseAndLakebaseResources", async () => {
  const { readDeploymentAppResourceArray } = await import(
    "../src/db/project-deployment-repository-mapping.ts"
  );
  const resources = [
    {
      name: "sql-warehouse",
      description: "Analytics warehouse",
      sql_warehouse: { id: "child-wh-1", permission: "CAN_MANAGE" as const },
    },
    {
      name: "vdab-pg-0123456789abcdef",
      description: "VDAB Lakebase Autoscaling",
      postgres: {
        branch: "projects/db-project/branches/production",
        database:
          "projects/db-project/branches/production/databases/database-id",
        permission: "CAN_CONNECT_AND_CREATE" as const,
      },
    },
    {
      name: "nightly-job",
      description: "Nightly job",
      job: { id: "job-1", permission: "CAN_MANAGE_RUN" as const },
    },
    {
      name: "claims-table",
      description: "Claims table",
      uc_securable: {
        securable_full_name: "main.sales.claims",
        securable_type: "TABLE" as const,
        permission: "SELECT" as const,
      },
    },
  ];
  assert.deepEqual(
    readDeploymentAppResourceArray(JSON.stringify(resources)),
    resources,
  );
});

test("ProjectDeploymentRequirements_MissingOrWeakChatGrants_BlockDeploy", () => {
  const requirements = getProjectDeploymentRequirements(
    [
      {
        key: "genie-chat",
        type: "GenieChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "genieChat",
        description: null,
        properties: { genieSpaceAppResourceName: "missing-genie" },
        bindings: null,
        children: [],
        layout: null,
      },
      {
        key: "model-chat",
        type: "ModelChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "modelChat",
        description: null,
        properties: { servingEndpointAppResourceName: "view-only" },
        bindings: null,
        children: [],
        layout: null,
      },
    ],
    { version: 1, workflows: [] },
    null,
    [
      {
        name: "view-only",
        description: "View only endpoint",
        serving_endpoint: {
          name: "view-only",
          permission: "CAN_VIEW" as const,
        },
      },
    ],
  );

  assert.equal(requirements.blockers[0]?.code, "genie_chat_resource_missing");
  assert.equal(
    requirements.blockers[1]?.code,
    "model_chat_resource_permission",
  );
  assert.deepEqual(requirements.appResources, []);
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
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: "default",
            table: "orders",
            primaryKeyColumn: null,
          },
        },
      },
    },
    children: [],
    layout: null,
  };
}

function createIncompleteUnityCatalogComponent(): ProjectComponent {
  return {
    key: "data-window",
    type: "DataWindow",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "dataWindow",
    description: null,
    properties: {},
    bindings: {
      unityCatalogTable: {
        bindingType: "unityCatalogTable",
        source: {
          kind: "resource",
          valueType: "table",
          resource: {
            type: "unityCatalogTable",
            catalog: "main",
            schema: null,
            table: null,
            primaryKeyColumn: null,
          },
        },
      },
    },
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
