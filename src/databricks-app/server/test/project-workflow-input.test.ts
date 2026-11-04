import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { readProjectWorkflowInput } from "../src/db/project-workflow-input.ts";

interface WorkflowFixture {
  version: number;
  workflow: {
    version: number;
    workflows: Array<{
      codeName: string;
      trigger: { componentKey: string; eventKey: string };
      nodes: Array<{ id: string; actionType: string; schemaVersion: number; params: Record<string, unknown> }>;
      edges: Array<{ fromNodeId: string; toNodeId: string; route: string }>;
    }>;
  };
}

const validInput: WorkflowFixture = {
  version: 7,
  workflow: {
    version: 1,
    workflows: [
      {
        codeName: "onSubmit",
        trigger: { componentKey: "order-form", eventKey: "onSubmit" },
        nodes: [
          { id: "toast", actionType: "triggerToast", schemaVersion: 1, params: { body: "Saved", duration: { kind: "preset", value: "short" } } },
          { id: "modal", actionType: "showModal", schemaVersion: 1, params: { modalComponentKey: "saved-modal" } },
          { id: "save", actionType: "saveToTable", schemaVersion: 1, params: { sourceFormComponentKey: "order-form", targetTable: { tableType: "unityCatalogTable", resourceKey: "orders-table", catalog: "main", schema: "default", table: "orders" }, excludedColumns: [], columnMappings: [{ formChildComponentKey: "order-name", targetColumnName: "name" }] } },
          { id: "build", actionType: "buildSql", schemaVersion: 1, params: { sqlSourceKind: "unityCatalogTable", sqlTemplate: "SELECT * FROM orders WHERE name = {{name}}", placeholders: [{ token: "name", componentKey: "order-name", valueType: "string", formatHint: "sqlStringLiteral" }], sqlWarehouseId: "warehouse-123", sqlWarehouseName: "Analytics" } },
          { id: "run", actionType: "runSql", schemaVersion: 1, params: { statement: { sourceActionType: "buildSql", nodeId: "build" } } },
          { id: "bind", actionType: "setBinding", schemaVersion: 1, params: { source: { sourceActionType: "runSql", nodeId: "run", outputKey: "rows" }, target: { componentKey: "orders-grid", bindingType: "unityCatalogTable" } } },
          { id: "job", actionType: "startDatabricksJob", schemaVersion: 1, params: { job: { resourceType: "databricksJob", resourceKey: "12345", jobName: "Refresh orders" } } },
          { id: "custom", actionType: "callCustomModule", schemaVersion: 1, params: { functionName: "normalize_order" } },
          { id: "prebuilt", actionType: "callPrebuiltModule", schemaVersion: 1, params: { functionName: "send_notification", namedArguments: { channel: "ops" } } },
        ],
        edges: [
          { fromNodeId: "toast", toNodeId: "modal", route: "onSuccess" },
          { fromNodeId: "modal", toNodeId: "save", route: "onSuccess" },
          { fromNodeId: "save", toNodeId: "build", route: "onSuccess" },
          { fromNodeId: "build", toNodeId: "run", route: "onSuccess" },
          { fromNodeId: "run", toNodeId: "bind", route: "onSuccess" },
          { fromNodeId: "bind", toNodeId: "job", route: "onSuccess" },
          { fromNodeId: "job", toNodeId: "custom", route: "onSuccess" },
          { fromNodeId: "custom", toNodeId: "prebuilt", route: "onSuccess" },
        ],
      },
    ],
  },
};

test("ProjectWorkflowInput_AcceptsAllAgreedActionContracts_AndPreservesPortableKeys", () => {
  const input = readProjectWorkflowInput(validInput);

  assert.equal(input.expectedVersion, 7);
  assert.equal(input.workflow.workflows[0]?.nodes.length, 9);
  assert.deepEqual(input.workflow.workflows[0]?.trigger, {
    componentKey: "order-form",
    eventKey: "onSubmit",
  });
  assert.match(JSON.stringify(input.workflow), /orders-table/);
  assert.doesNotMatch(JSON.stringify(input.workflow), /workspaceConnectionId|workspaceHost|accessToken/i);
});

test("ProjectWorkflowInput_DigitPrefixedUuidActions_PreservesGraphAndDataReferences", () => {
  const request = structuredClone(validInput);
  const workflow = request.workflow.workflows[0]!;
  const replacements = new Map(workflow.nodes.map((node, index) => [node.id, `${index}1111111-1111-4111-8111-111111111111`]));
  for (const node of workflow.nodes) node.id = replacements.get(node.id)!;
  for (const edge of workflow.edges) {
    edge.fromNodeId = replacements.get(edge.fromNodeId)!;
    edge.toNodeId = replacements.get(edge.toNodeId)!;
  }
  (workflow.nodes[4]!.params.statement as Record<string, unknown>).nodeId = workflow.nodes[3]!.id;
  (workflow.nodes[5]!.params.source as Record<string, unknown>).nodeId = workflow.nodes[4]!.id;
  const parsed = readProjectWorkflowInput(request).workflow.workflows[0]!;
  assert.equal(parsed.nodes[0]?.id, "01111111-1111-4111-8111-111111111111");
  assert.equal(parsed.edges[0]?.fromNodeId, parsed.nodes[0]?.id);
  assert.equal(parsed.edges[0]?.toNodeId, parsed.nodes[1]?.id);
});

test("ProjectWorkflowInput_ActionIdentifiers_RejectsUnsafeCharacters", () => {
  for (const id of ["", "../action", "action;exec", "action with spaces", "https://foreign.example"]) {
    const request = structuredClone(validInput);
    request.workflow.workflows[0]!.nodes[0]!.id = id;
    assertInvalidWorkflow(request);
  }
});

test("ProjectWorkflowInput_RejectsWorkspaceAuthorityAndUnknownNestedFields", () => {
  const request = structuredClone(validInput);
  const firstWorkflow = request.workflow.workflows[0]!;
  const saveNode = firstWorkflow.nodes[2]!;
  const targetTable = saveNode.params.targetTable as Record<string, unknown>;
  targetTable.workspaceConnectionId = 17;

  assertInvalidWorkflow(request);

  const secondRequest = structuredClone(validInput);
  secondRequest.workflow.workflows[0]!.nodes[0]!.params.unsupported = true;
  assertInvalidWorkflow(secondRequest);
});

test("ProjectWorkflowInput_AcceptsLegacyCyclesAndIndependentRoots", () => {
  const cycle = structuredClone(validInput);
  cycle.workflow.workflows[0]!.edges.push({
    fromNodeId: "modal",
    toNodeId: "toast",
    route: "onSuccess",
  });
  assert.equal(readProjectWorkflowInput(cycle).workflow.workflows[0]?.edges.length, 9);

  const independentRoots = structuredClone(validInput);
  independentRoots.workflow.workflows[0]!.edges = [];
  assert.equal(readProjectWorkflowInput(independentRoots).workflow.workflows[0]?.nodes.length, 9);
});

test("ProjectWorkflowInput_AcceptsForwardActionReferencesWhenTheyAreGraphPredecessors", () => {
  const request = structuredClone(validInput);
  const nodes = request.workflow.workflows[0]!.nodes;
  const buildNode = nodes[3]!;
  nodes[3] = nodes[4]!;
  nodes[4] = buildNode;

  const workflow = readProjectWorkflowInput(request).workflow.workflows[0];
  assert.equal(workflow?.nodes[3]?.id, "run");
  assert.equal(workflow?.nodes[4]?.id, "build");
});

test("ProjectWorkflowInput_PreservesPortableLakebaseTargetMetadata", () => {
  const request = structuredClone(validInput);
  const table = request.workflow.workflows[0]!.nodes[2]!.params.targetTable as Record<string, unknown>;
  request.workflow.workflows[0]!.nodes[2]!.params.targetTable = {
    tableType: "lakebaseAutoscaling",
    resourceKey: "sales-database",
    catalog: "",
    schema: "public",
    table: "orders",
    projectId: "project-one",
    branchId: "production",
    endpointId: "primary",
    databaseId: "database-one",
    database: "app",
  };

  const saved = readProjectWorkflowInput(request).workflow.workflows[0]?.nodes[2]?.params.targetTable;
  assert.deepEqual(saved, {
    tableType: "lakebaseAutoscaling",
    resourceKey: "sales-database",
    catalog: "",
    schema: "public",
    table: "orders",
    projectId: "project-one",
    branchId: "production",
    endpointId: "primary",
    databaseId: "database-one",
    database: "app",
  });
  assert.ok(table);
});

test("ProjectWorkflowInput_RejectsInvalidRoutesAndMissingActionReferences", () => {
  const invalidRoute = structuredClone(validInput);
  invalidRoute.workflow.workflows[0]!.edges[0]!.route = "later";
  assertInvalidWorkflow(invalidRoute);

  const missingReference = structuredClone(validInput);
  const statement = missingReference.workflow.workflows[0]!.nodes[4]!.params.statement as Record<string, unknown>;
  statement.nodeId = "missing";
  assertInvalidWorkflow(missingReference);
});

test("ProjectWorkflowInput_ValidatesCurrentWorkspaceSqlWarehouseReference", () => {
  const accepted = readProjectWorkflowInput(validInput);
  const buildParams = accepted.workflow.workflows[0]?.nodes.find(
    (node) => node.actionType === "buildSql",
  )?.params;
  assert.equal(buildParams?.sqlWarehouseId, "warehouse-123");
  assert.equal(buildParams?.sqlWarehouseName, "Analytics");

  const malformedId = structuredClone(validInput);
  malformedId.workflow.workflows[0]!.nodes[3]!.params.sqlWarehouseId = "warehouse/other-workspace";
  assertInvalidWorkflow(malformedId);

  const mismatchedPair = structuredClone(validInput);
  delete mismatchedPair.workflow.workflows[0]!.nodes[3]!.params.sqlWarehouseName;
  assertInvalidWorkflow(mismatchedPair);

  const wrongSource = structuredClone(validInput);
  wrongSource.workflow.workflows[0]!.nodes[3]!.params.sqlSourceKind = "lakebaseAutoscaling";
  assertInvalidWorkflow(wrongSource);

  const injectedAuthority = structuredClone(validInput);
  injectedAuthority.workflow.workflows[0]!.nodes[3]!.params.workspaceHost = "https://other.example";
  assertInvalidWorkflow(injectedAuthority);
});

test("ProjectWorkflowInput_ValidatesLakebaseEndpointAndImportedUnresolvedReferences", () => {
  const autoscaling = structuredClone(validInput);
  const buildSqlParams = autoscaling.workflow.workflows[0]!.nodes[3]!.params;
  buildSqlParams.sqlSourceKind = "lakebaseAutoscaling";
  delete buildSqlParams.sqlWarehouseId;
  delete buildSqlParams.sqlWarehouseName;
  buildSqlParams.lakebaseAppResourceName = "lakebase-resource";
  buildSqlParams.lakebaseDatabaseName = "appdb";
  buildSqlParams.lakebaseProjectId = "project-one";
  buildSqlParams.lakebaseBranchId = "production";
  buildSqlParams.lakebaseEndpointId = "read-write";
  assert.doesNotThrow(() => readProjectWorkflowInput(autoscaling));

  const selectedDatabase = structuredClone(autoscaling);
  selectedDatabase.workflow.workflows[0]!.nodes[3]!.params.lakebaseDatabaseId = "database-one";
  assert.equal(
    readProjectWorkflowInput(selectedDatabase).workflow.workflows[0]?.nodes[3]?.params.lakebaseDatabaseId,
    "database-one",
  );

  const malformedDatabaseId = structuredClone(selectedDatabase);
  malformedDatabaseId.workflow.workflows[0]!.nodes[3]!.params.lakebaseDatabaseId = "database/other-workspace";
  assertInvalidWorkflow(malformedDatabaseId);

  const malformedEndpoint = structuredClone(autoscaling);
  malformedEndpoint.workflow.workflows[0]!.nodes[3]!.params.lakebaseEndpointId = "endpoint/other-project";
  assertInvalidWorkflow(malformedEndpoint);

  const mismatchedPortableFields = structuredClone(autoscaling);
  mismatchedPortableFields.workflow.workflows[0]!.nodes[3]!.params.lakebaseProjectId = "unresolved_resource_1";
  assertInvalidWorkflow(mismatchedPortableFields);

  const unresolved = structuredClone(autoscaling);
  const unresolvedParams = unresolved.workflow.workflows[0]!.nodes[3]!.params;
  unresolvedParams.lakebaseAppResourceName = "unresolved_resource_4";
  unresolvedParams.lakebaseDatabaseName = "unresolved_resource_4";
  unresolvedParams.lakebaseProjectId = "unresolved_resource_4";
  unresolvedParams.lakebaseBranchId = "unresolved_resource_4";
  unresolvedParams.lakebaseEndpointId = "unresolved_resource_4";
  assert.doesNotThrow(() => readProjectWorkflowInput(unresolved));

  const wrongSource = structuredClone(validInput);
  wrongSource.workflow.workflows[0]!.nodes[3]!.params.lakebaseEndpointId = "endpoint-one";
  assertInvalidWorkflow(wrongSource);
});

test("ProjectWorkflowInput_ValidatesProvisionedLakebaseInstanceAndDatabase", () => {
  const accepted = structuredClone(validInput);
  const buildSqlParams = accepted.workflow.workflows[0]!.nodes[3]!.params;
  buildSqlParams.sqlSourceKind = "lakebaseProvisionedDatabase";
  delete buildSqlParams.sqlWarehouseId;
  delete buildSqlParams.sqlWarehouseName;
  buildSqlParams.lakebaseInstanceName = "legacy-instance";
  buildSqlParams.lakebaseDatabaseName = "databricks_postgres";
  assert.doesNotThrow(() => readProjectWorkflowInput(accepted));

  const missingInstance = structuredClone(accepted);
  delete missingInstance.workflow.workflows[0]!.nodes[3]!.params.lakebaseInstanceName;
  assertInvalidWorkflow(missingInstance);

  const injectedInstance = structuredClone(accepted);
  injectedInstance.workflow.workflows[0]!.nodes[3]!.params.lakebaseInstanceName = "instance/other-workspace";
  assertInvalidWorkflow(injectedInstance);

  const unexpectedAutoscalingReference = structuredClone(accepted);
  unexpectedAutoscalingReference.workflow.workflows[0]!.nodes[3]!.params.lakebaseEndpointId = "endpoint-one";
  assertInvalidWorkflow(unexpectedAutoscalingReference);
});

test("ProjectWorkflowInput_ValidatesPositiveInt64DatabricksJobIds", () => {
  const maximumId = structuredClone(validInput);
  const maximumJob = maximumId.workflow.workflows[0]!.nodes[6]!.params.job as Record<string, unknown>;
  maximumJob.resourceKey = "9223372036854775807";
  assert.equal(
    (readProjectWorkflowInput(maximumId).workflow.workflows[0]?.nodes[6]?.params.job as Record<string, unknown>).resourceKey,
    "9223372036854775807",
  );

  for (const jobId of ["0", "0123", "refresh-orders", "9223372036854775808", "123456789012345678901"]) {
    const request = structuredClone(validInput);
    const job = request.workflow.workflows[0]!.nodes[6]!.params.job as Record<string, unknown>;
    job.resourceKey = jobId;
    assertInvalidWorkflow(request);
  }
});

test("ProjectWorkflowInput_RejectsDuplicateTriggerAndUnsupportedActionVersion", () => {
  const duplicateTrigger = structuredClone(validInput);
  duplicateTrigger.workflow.workflows.push({
    codeName: "secondWorkflow",
    trigger: { componentKey: "order-form", eventKey: "onSubmit" },
    nodes: [],
    edges: [],
  });
  assertInvalidWorkflow(duplicateTrigger);

  const unsupportedVersion = structuredClone(validInput);
  unsupportedVersion.workflow.workflows[0]!.nodes[0]!.schemaVersion = 2;
  assertInvalidWorkflow(unsupportedVersion);
});

function assertInvalidWorkflow(value: unknown): void {
  assert.throws(
    () => readProjectWorkflowInput(value),
    (error: unknown) => error instanceof ApplicationError && error.code === "invalid_project_workflow",
  );
}
