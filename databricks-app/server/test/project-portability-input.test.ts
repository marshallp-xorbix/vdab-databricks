import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import type { ProjectComponent } from "../src/db/project-components-contract.ts";
import type { ProjectAggregateSnapshot } from "../src/db/project-portability-contract.ts";
import {
  createStandaloneProjectExport,
  readStandaloneProjectImport,
} from "../src/db/project-portability-input.ts";

test("ProjectPortability_FixtureImportsWithoutWorkspaceBindingsOrChildAppIdentity", async () => {
  const fixture = JSON.parse(await readFile(
    resolve(import.meta.dirname, "../../../.documentation/databricks-app-transition/contracts/fixtures/standalone-project-v1.json"),
    "utf8",
  )) as unknown;

  const aggregate = readStandaloneProjectImport(fixture);

  assert.equal(aggregate.name, "Sales overview");
  assert.equal(aggregate.components[0]?.bindings, null);
  assert.deepEqual(aggregate.resourceReferences, [
    {
      key: "resource-sales-table",
      kind: "unityCatalogTable",
      label: "analytics.sales.monthly_sales",
      componentKeys: ["component-sales-chart"],
    },
  ]);
  assert.equal(JSON.stringify(aggregate).includes("workspaceConnectionId"), false);
});

test("ProjectPortability_ExportStripsInstallBoundBindingsAndRequiresReselection", () => {
  const source = createSnapshot();
  const bundle = createStandaloneProjectExport({
    name: source.project.name,
    description: source.project.description,
    theme: source.theme,
    customModulesSource: source.customModulesSource,
    components: source.components,
    workflow: source.workflow,
    resourceReferences: source.resourceReferences,
    childAppDisplayName: source.childAppDisplayName,
  });

  assert.equal(bundle.project.components[0]?.bindings?.portableResourceKey, "resource_1");
  assert.equal(bundle.project.components[0]?.properties.servingEndpointName, "");
  assert.equal(bundle.project.workflow.workflows[0]?.nodes[0]?.params.job &&
    (bundle.project.workflow.workflows[0]?.nodes[0]?.params.job as Record<string, unknown>).resourceKey,
  "unresolved_resource_3");
  assert.equal(bundle.project.workflow.workflows[0]?.nodes[1]?.params.sqlWarehouseId, undefined);
  const lakebaseBuild = bundle.project.workflow.workflows[0]?.nodes[2]?.params;
  assert.equal(lakebaseBuild?.sqlSourceKind, "lakebaseAutoscaling");
  assert.equal(lakebaseBuild?.lakebaseAppResourceName, "unresolved_resource_5");
  assert.equal(lakebaseBuild?.lakebaseDatabaseName, "unresolved_resource_5");
  assert.equal(lakebaseBuild?.lakebaseDatabaseId, "unresolved_resource_5");
  assert.equal(lakebaseBuild?.lakebaseProjectId, "unresolved_resource_5");
  assert.equal(lakebaseBuild?.lakebaseBranchId, "unresolved_resource_5");
  assert.equal(lakebaseBuild?.lakebaseEndpointId, "unresolved_resource_5");
  const lakebaseSaveTable = bundle.project.workflow.workflows[0]?.nodes[3]?.params.targetTable as Record<string, unknown>;
  assert.equal(lakebaseSaveTable.projectId, "unresolved_resource_6");
  assert.equal(lakebaseSaveTable.branchId, "unresolved_resource_6");
  assert.equal(lakebaseSaveTable.endpointId, "unresolved_resource_6");
  assert.equal(lakebaseSaveTable.database, "unresolved_resource_6");
  assert.equal(lakebaseSaveTable.databaseId, "unresolved_resource_6");
  assert.equal(lakebaseSaveTable.schema, "");
  assert.equal(lakebaseSaveTable.table, "");
  assert.equal(bundle.project.childAppLink.requiresSelection, true);
  assert.equal(JSON.stringify(bundle).includes("warehouse-id"), false);
  assert.equal(JSON.stringify(bundle).includes("private-lakebase-project"), false);
  assert.equal(JSON.stringify(bundle).includes("private-endpoint"), false);
  assert.equal(bundle.project.childAppLink.sourceDisplayName, "sales-child");
  assert.equal(JSON.stringify(bundle).includes("old-child-app-id"), false);

  const imported = readStandaloneProjectImport(bundle);
  assert.equal(imported.components[0]?.bindings, null);
  assert.ok(imported.resourceReferences.some((reference) => reference.kind === "databricksJob"));
  assert.ok(imported.resourceReferences.some((reference) => reference.kind === "sqlWarehouse"));
  assert.deepEqual(
    imported.resourceReferences
      .filter((reference) => reference.kind === "lakebaseDatabase")
      .map((reference) => reference.workflowNodeIds),
    [["build-lakebase"], ["save-lakebase"]],
  );
  assert.deepEqual(imported.resourceReferences.find((reference) => reference.kind === "unityCatalogTable")?.componentKeys, ["model-chat"]);
  assert.deepEqual(imported.resourceReferences.find((reference) => reference.kind === "databricksJob")?.workflowNodeIds, ["start-job"]);
  assert.deepEqual(imported.resourceReferences.find((reference) => reference.kind === "sqlWarehouse")?.workflowNodeIds, ["build-sql"]);
});

test("ProjectPortability_ExportNormalizesDatabricksVolumeBindings", () => {
  const source = createSnapshot();
  const component: ProjectComponent = {
    key: "file-upload",
    type: "FileUpload",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "fileUpload",
    description: null,
    properties: { label: "Upload a file" },
    bindings: {
      databricksVolume: {
        bindingType: "databricksVolume",
        source: {
          kind: "resource",
          valueType: "file",
          resource: {
            type: "databricksVolume",
            catalog: "main",
            schema: "default",
            volume: "uploads",
            filePath: "imports",
          },
        },
      },
    },
    children: [],
    layout: null,
  };
  const bundle = createStandaloneProjectExport({
    name: source.project.name,
    description: source.project.description,
    theme: source.theme,
    customModulesSource: source.customModulesSource,
    components: [component],
    workflow: source.workflow,
    resourceReferences: source.resourceReferences,
    childAppDisplayName: source.childAppDisplayName,
  });

  assert.deepEqual(bundle.project.resourceReferences[0], {
    key: "resource_1",
    kind: "unityCatalogVolume",
    label: "main.default.uploads",
    componentKeys: ["file-upload"],
  });
  assert.equal(bundle.project.components[0]?.bindings?.portableResourceKey, "resource_1");
  assert.equal(readStandaloneProjectImport(bundle).components[0]?.bindings, null);
});

test("ProjectPortability_RejectsFormerSaasExportFormats", async () => {
  const fixture = await readFixture();
  assert.throws(
    () => readStandaloneProjectImport({ ...fixture, format: "xorbix-saas-export" }),
    /Only standalone VDAB project schema version 1 is supported/,
  );
});

test("ProjectPortability_RejectsWorkspaceAuthorityAndBrokenResourceReferences", async () => {
  const fixture = await readFixture();
  const project = fixture.project as Record<string, unknown>;
  const components = project.components as Array<Record<string, unknown>>;
  components[0]!.properties = { workspaceUrl: "https://other.invalid" };
  assert.throws(() => readStandaloneProjectImport(fixture), /forbidden authority field/);

  const safeFixture = await readFixture();
  const safeProject = safeFixture.project as Record<string, unknown>;
  const references = safeProject.resourceReferences as Array<Record<string, unknown>>;
  references[0]!.key = "different-key";
  assert.throws(() => readStandaloneProjectImport(safeFixture), /missing portable resource reference/);
});

test("ProjectPortability_RejectsEmbeddedSecretLikeCustomModuleValues", async () => {
  const fixture = await readFixture();
  (fixture.project as Record<string, unknown>).customModulesSource = "API_KEY = 'this-is-a-secret-value'";
  assert.throws(() => readStandaloneProjectImport(fixture), /secret values/);
});

test("ProjectPortability_RejectsConcreteWorkspaceBindingsInPortableFiles", async () => {
  const fixture = await readFixture();
  const project = fixture.project as Record<string, unknown>;
  const components = project.components as Array<Record<string, unknown>>;
  components[0]!.bindings = {
    unityCatalogTable: {
      source: {
        resource: { type: "unityCatalogTable", catalog: "main", schema: "sales", table: "orders" },
      },
    },
  };

  assert.throws(() => readStandaloneProjectImport(fixture), /must be represented by an unresolved portable resource key/);
});

function createSnapshot(): ProjectAggregateSnapshot {
  return {
    project: {
      id: "project-1",
      name: "Export project",
      description: null,
      version: 3,
      createdBy: "user-1",
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
      callerRole: "owner",
    },
    theme: null,
    components: [
      {
        key: "model-chat",
        type: "ModelChat",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "modelChat",
        description: null,
        properties: {
          servingEndpointName: "customer-model",
          title: "Chat",
          showBorder: false,
          chatTotalHeightPixels: 600,
        },
        bindings: {
          unityCatalogTable: {
            source: {
              resource: {
                type: "unityCatalogTable",
                catalog: "main",
                schema: "sales",
                table: "orders",
              },
            },
          },
        },
        children: [],
        layout: null,
      },
    ],
    workflow: {
      version: 1,
      workflows: [
        {
          codeName: "buttonClicked",
          trigger: { componentKey: "model-chat", eventKey: "onClick" },
          nodes: [
            {
              id: "start-job",
              actionType: "startDatabricksJob",
              schemaVersion: 1,
              params: { job: { resourceType: "databricksJob", resourceKey: "12345", jobName: "Refresh" } },
            },
            {
              id: "build-sql",
              actionType: "buildSql",
              schemaVersion: 1,
              params: {
                sqlSourceKind: "unityCatalogTable",
                sqlTemplate: "SELECT 1",
                placeholders: [],
                sqlWarehouseId: "warehouse-id",
                sqlWarehouseName: "Shared warehouse",
              },
            },
            {
              id: "build-lakebase",
              actionType: "buildSql",
              schemaVersion: 1,
              params: {
                sqlSourceKind: "lakebaseAutoscaling",
                sqlTemplate: "SELECT * FROM public.orders",
                placeholders: [],
                lakebaseAppResourceName: "customer-lakebase",
                lakebaseDatabaseName: "appdb",
                lakebaseDatabaseId: "database-one",
                lakebaseProjectId: "private-lakebase-project",
                lakebaseBranchId: "production",
                lakebaseEndpointId: "private-endpoint",
              },
            },
            {
              id: "save-lakebase",
              actionType: "saveToTable",
              schemaVersion: 1,
              params: {
                sourceFormComponentKey: "order-form",
                targetTable: {
                  tableType: "lakebaseAutoscaling",
                  resourceKey: "orders-table",
                  catalog: "",
                  schema: "public",
                  table: "orders",
                  projectId: "private-lakebase-project",
                  branchId: "production",
                  endpointId: "private-endpoint",
                  databaseId: "database-one",
                  database: "appdb",
                },
                excludedColumns: [],
                columnMappings: [],
              },
            },
          ],
          edges: [],
        },
      ],
    },
    customModulesSource: "# no secret values",
    resourceReferences: [],
    childAppDisplayName: "sales-child",
  };
}

async function readFixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(
    resolve(import.meta.dirname, "../../../.documentation/databricks-app-transition/contracts/fixtures/standalone-project-v1.json"),
    "utf8",
  )) as Record<string, unknown>;
}
