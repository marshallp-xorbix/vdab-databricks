import {
  PROJECT_WORKFLOW_ACTION_TYPES,
  PROJECT_WORKFLOW_ROUTES,
  type ProjectWorkflow,
  type ProjectWorkflowDefinition,
  type ProjectWorkflowNode,
} from "./project-workflow-contract.ts";
import { invalidWorkflow } from "./project-workflow-errors.ts";
import {
  validateWorkflowCollection,
  validateWorkflowGraph,
} from "./project-workflow-graph-validation.ts";

const MAX_WORKFLOWS = 100;
const MAX_NODES_PER_WORKFLOW = 100;
const MAX_EDGES_PER_WORKFLOW = 500;
const MAX_CODE_NAME_LENGTH = 80;
const MAX_RESOURCE_KEY_LENGTH = 160;
const MAX_DATABRICKS_JOB_ID = "9223372036854775807";
const FORBIDDEN_PROPERTY_NAME = /workspace[_-]?(?:connection[_-]?)?id|workspace[_-]?(?:host|url)|tenant[_-]?id|account[_-]?id|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|credential|authorization/i;

interface ProjectWorkflowInput {
  expectedVersion: number;
  workflow: ProjectWorkflowDefinition;
}

/** Validates the complete nested workflow payload and rejects foreign authority. */
export function readProjectWorkflowInput(body: unknown): ProjectWorkflowInput {
  const input = requireRecord(body, "body");
  assertExactKeys(input, ["version", "workflow"], "body");
  const expectedVersion = requirePositiveInteger(input.version, "version");
  const workflowRecord = requireRecord(input.workflow, "workflow");
  assertExactKeys(workflowRecord, ["version", "workflows"], "workflow");

  if (workflowRecord.version !== 1) {
    throw invalidWorkflow("Workflow version must be 1.");
  }

  if (!Array.isArray(workflowRecord.workflows) || workflowRecord.workflows.length > MAX_WORKFLOWS) {
    throw invalidWorkflow(`Workflow definitions must contain at most ${MAX_WORKFLOWS} workflows.`);
  }

  const workflows = workflowRecord.workflows.map(readWorkflow);
  validateWorkflowCollection(workflows);

  return {
    expectedVersion,
    workflow: { version: 1, workflows },
  };
}

/** Revalidates persisted action JSON before returning it to a caller. */
export function readStoredWorkflow(value: unknown): ProjectWorkflow {
  return readWorkflow(value);
}

function readWorkflow(value: unknown): ProjectWorkflow {
  const workflow = requireRecord(value, "workflow entry");
  assertExactKeys(workflow, ["codeName", "trigger", "nodes", "edges"], "workflow entry");
  const codeName = requireCodeName(workflow.codeName, "workflow code name");
  const trigger = requireRecord(workflow.trigger, "workflow trigger");
  assertExactKeys(trigger, ["componentKey", "eventKey"], "workflow trigger");
  const componentKey = requireResourceKey(trigger.componentKey, "trigger component key");
  const eventKey = requireIdentifier(trigger.eventKey, "trigger event key", 64);

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length > MAX_NODES_PER_WORKFLOW) {
    throw invalidWorkflow(`Each workflow must contain at most ${MAX_NODES_PER_WORKFLOW} actions.`);
  }

  if (!Array.isArray(workflow.edges) || workflow.edges.length > MAX_EDGES_PER_WORKFLOW) {
    throw invalidWorkflow(`Each workflow must contain at most ${MAX_EDGES_PER_WORKFLOW} routes.`);
  }

  const nodes = workflow.nodes.map(readNode);
  const edges = workflow.edges.map(readEdge);
  validateWorkflowGraph(nodes, edges);

  return { codeName, trigger: { componentKey, eventKey }, nodes, edges };
}

function readNode(value: unknown): ProjectWorkflowNode {
  const node = requireRecord(value, "workflow action");
  assertExactKeys(node, ["id", "actionType", "schemaVersion", "params"], "workflow action");
  const id = requireResourceKey(node.id, "action ID");

  if (!isActionType(node.actionType) || node.schemaVersion !== 1) {
    throw invalidWorkflow("Workflow actions must use a supported action type and schema version 1.");
  }

  const params = requireRecord(node.params, "action parameters");
  validateActionParams(node.actionType, params);
  return { id, actionType: node.actionType, schemaVersion: 1, params };
}

function validateActionParams(
  actionType: ProjectWorkflowNode["actionType"],
  params: Record<string, unknown>,
): void {
  switch (actionType) {
    case "triggerToast":
      assertExactKeys(params, ["body", "duration"], "toast parameters", ["icon"]);
      requireBoundedString(params.body, "toast body", 2000);
      if (params.icon !== undefined) requireBoundedString(params.icon, "toast icon", 80);
      validateToastDuration(params.duration);
      return;
    case "showModal":
      assertExactKeys(params, ["modalComponentKey"], "modal parameters");
      requireResourceKey(params.modalComponentKey, "modal component key");
      return;
    case "saveToTable":
      assertExactKeys(params, ["sourceFormComponentKey", "targetTable", "excludedColumns", "columnMappings"], "save-to-table parameters");
      requireResourceKey(params.sourceFormComponentKey, "source form component key");
      validateTableReference(params.targetTable);
      validateColumnOverrides(params.excludedColumns);
      validateColumnMappings(params.columnMappings);
      return;
    case "buildSql":
      assertExactKeys(params, ["sqlSourceKind", "sqlTemplate", "placeholders"], "SQL builder parameters", ["lakebaseAppResourceName", "lakebaseDatabaseName", "lakebaseDatabaseId", "lakebaseInstanceName", "lakebaseProjectId", "lakebaseBranchId", "lakebaseEndpointId", "sqlWarehouseId", "sqlWarehouseName"]);
      if (!isOneOf(params.sqlSourceKind, ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"])) throw invalidWorkflow("SQL source kind is invalid.");
      requireBoundedString(params.sqlTemplate, "SQL template", 100_000);
      if (!Array.isArray(params.placeholders) || params.placeholders.length > 200) throw invalidWorkflow("SQL placeholders are invalid.");
      params.placeholders.forEach(validatePlaceholder);
      if (params.lakebaseAppResourceName !== undefined) requireBoundedString(params.lakebaseAppResourceName, "Lakebase App resource name", 160);
      if (params.lakebaseDatabaseName !== undefined) requireBoundedString(params.lakebaseDatabaseName, "Lakebase database name", 160);
      if (params.lakebaseDatabaseId !== undefined) requireBoundedString(params.lakebaseDatabaseId, "Lakebase database ID", 160);
      if (params.lakebaseInstanceName !== undefined) requireBoundedString(params.lakebaseInstanceName, "Lakebase instance name", 128);
      validateLakebaseEndpointReference(params);
      validateSqlWarehouseReference(params);
      return;
    case "runSql": {
      assertExactKeys(params, ["statement"], "SQL execution parameters");
      const statement = requireRecord(params.statement, "SQL statement reference");
      assertExactKeys(statement, ["sourceActionType", "nodeId"], "SQL statement reference");
      if (statement.sourceActionType !== "buildSql") throw invalidWorkflow("SQL execution must reference a BuildSql action.");
      requireResourceKey(statement.nodeId, "SQL builder action ID");
      return;
    }
    case "setBinding": {
      assertExactKeys(params, ["source", "target"], "binding parameters");
      const source = requireRecord(params.source, "binding source");
      assertExactKeys(source, ["sourceActionType", "nodeId", "outputKey"], "binding source");
      if (source.sourceActionType !== "runSql" || source.outputKey !== "rows") throw invalidWorkflow("A binding must consume rows from a RunSql action.");
      requireResourceKey(source.nodeId, "SQL execution action ID");
      const target = requireRecord(params.target, "binding target");
      assertExactKeys(target, ["componentKey", "bindingType"], "binding target");
      requireResourceKey(target.componentKey, "binding target component key");
      if (!isOneOf(target.bindingType, ["unityCatalogTable", "chartData"])) throw invalidWorkflow("Binding target type is invalid.");
      return;
    }
    case "startDatabricksJob": {
      assertExactKeys(params, ["job"], "job parameters");
      const job = requireRecord(params.job, "job reference");
      assertExactKeys(job, ["resourceType", "resourceKey", "jobName"], "job reference");
      if (job.resourceType !== "databricksJob") throw invalidWorkflow("Job reference type is invalid.");
      requireDatabricksJobId(job.resourceKey);
      requireBoundedString(job.jobName, "job display name", 500);
      return;
    }
    case "callCustomModule":
      assertExactKeys(params, ["functionName"], "custom module parameters");
      requireCodeName(params.functionName, "custom module function name");
      return;
    case "callPrebuiltModule": {
      assertExactKeys(params, ["functionName", "namedArguments"], "prebuilt module parameters");
      requireCodeName(params.functionName, "prebuilt module function name");
      const argumentsRecord = requireRecord(params.namedArguments, "prebuilt module arguments");
      assertPortableKeys(argumentsRecord, "prebuilt module arguments");
      for (const argument of Object.values(argumentsRecord)) requireBoundedString(argument, "prebuilt module argument", 10_000);
      return;
    }
  }
}

function requireDatabricksJobId(value: unknown): asserts value is string {
  if (typeof value === "string" && /^unresolved_resource_[1-9][0-9]*$/.test(value)) {
    return;
  }
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value) ||
      (value.length === MAX_DATABRICKS_JOB_ID.length && value > MAX_DATABRICKS_JOB_ID)) {
    throw invalidWorkflow("Databricks job ID must be a positive 64-bit integer string.");
  }
}

function validateSqlWarehouseReference(params: Record<string, unknown>): void {
  const hasId = params.sqlWarehouseId !== undefined;
  const hasName = params.sqlWarehouseName !== undefined;
  if (hasId !== hasName) {
    throw invalidWorkflow("SQL warehouse ID and name must be provided together.");
  }
  if (!hasId) return;
  if (params.sqlSourceKind !== "unityCatalogTable") {
    throw invalidWorkflow("A SQL warehouse reference is only valid for Unity Catalog SQL.");
  }
  const warehouseId = requireBoundedString(params.sqlWarehouseId, "SQL warehouse ID", 128);
  if (!/^[A-Za-z0-9_-]+$/.test(warehouseId)) {
    throw invalidWorkflow("SQL warehouse ID has an invalid format.");
  }
  const warehouseName = requireBoundedString(params.sqlWarehouseName, "SQL warehouse name", 512);
  if (
    warehouseName.length === 0 ||
    warehouseName.trim() !== warehouseName ||
    /[\u0000-\u001f\u007f]/.test(warehouseName)
  ) {
    throw invalidWorkflow("SQL warehouse name has an invalid format.");
  }
}

function validateLakebaseEndpointReference(params: Record<string, unknown>): void {
  const endpointFields = [params.lakebaseProjectId, params.lakebaseBranchId, params.lakebaseEndpointId];
  const providedCount = endpointFields.filter((value) => value !== undefined).length;
  if (providedCount !== 0 && providedCount !== endpointFields.length) {
    throw invalidWorkflow("Lakebase project, branch, and endpoint must be selected together.");
  }
  if (params.sqlSourceKind === "lakebaseProvisionedDatabase") {
    if (providedCount !== 0) {
      throw invalidWorkflow("Lakebase endpoint details are only valid for Autoscaling sources.");
    }
    const instanceName = requireBoundedString(params.lakebaseInstanceName, "Lakebase instance name", 128);
    const databaseName = requireBoundedString(params.lakebaseDatabaseName, "Lakebase database name", 63);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(instanceName) || !/^[A-Za-z0-9_$-]{1,63}$/.test(databaseName)) {
      throw invalidWorkflow("Select a valid current-workspace Lakebase Provisioned instance and database.");
    }
    return;
  }
  if (params.sqlSourceKind !== "lakebaseAutoscaling" && params.lakebaseInstanceName !== undefined) {
    throw invalidWorkflow("Lakebase instance details are only valid for Provisioned sources.");
  }
  if (params.sqlSourceKind !== "lakebaseAutoscaling" && params.lakebaseDatabaseId !== undefined) {
    throw invalidWorkflow("Lakebase database IDs are only valid for Autoscaling sources.");
  }
  if (params.sqlSourceKind !== "lakebaseAutoscaling") {
    if (providedCount > 0) throw invalidWorkflow("Lakebase endpoint details are only valid for Autoscaling sources.");
    return;
  }
  if (providedCount !== endpointFields.length) {
    throw invalidWorkflow("Select a Lakebase Autoscaling project, branch, and read-write endpoint.");
  }
  const endpointIds: string[] = [];
  for (const [field, value] of [
    ["Lakebase project", params.lakebaseProjectId],
    ["Lakebase branch", params.lakebaseBranchId],
    ["Lakebase endpoint", params.lakebaseEndpointId],
  ] as const) {
    const identifier = requireBoundedString(value, field, 128);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) {
      throw invalidWorkflow(`${field} reference is invalid.`);
    }
    endpointIds.push(identifier);
  }
  const appResourceName = typeof params.lakebaseAppResourceName === "string"
    ? requireBoundedString(params.lakebaseAppResourceName, "Lakebase App resource name", 160)
    : "";
  const databaseName = typeof params.lakebaseDatabaseName === "string"
    ? requireBoundedString(params.lakebaseDatabaseName, "Lakebase database name", 160)
    : "";
  const unresolvedReference = endpointIds[0]?.match(/^unresolved_(resource_[1-9][0-9]*)$/)?.[1];
  if (unresolvedReference !== undefined) {
    const unresolvedValue = `unresolved_${unresolvedReference}`;
    if (!endpointIds.every((identifier) => identifier === unresolvedValue) ||
        appResourceName !== unresolvedValue || databaseName !== unresolvedValue) {
      throw invalidWorkflow("An imported Lakebase resource must remain unresolved until it is rebound in this workspace.");
    }
    if (params.lakebaseDatabaseId !== undefined && params.lakebaseDatabaseId !== unresolvedValue) {
      throw invalidWorkflow("An imported Lakebase database ID must remain unresolved until it is rebound in this workspace.");
    }
    return;
  }
  if (endpointIds.some((identifier) => identifier.startsWith("unresolved_")) ||
      !appResourceName || !databaseName || !/^[A-Za-z0-9_$-]{1,63}$/.test(databaseName) ||
      /[\u0000-\u001f\u007f]/.test(appResourceName)) {
    throw invalidWorkflow("Select the Lakebase Autoscaling App resource and database before saving this workflow.");
  }
  if (params.lakebaseDatabaseId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(String(params.lakebaseDatabaseId))) {
    throw invalidWorkflow("The selected Lakebase Autoscaling database ID is invalid.");
  }
}

function validateToastDuration(value: unknown): void {
  const duration = requireRecord(value, "toast duration");
  if (duration.kind === "preset") {
    assertExactKeys(duration, ["kind", "value"], "toast duration");
    if (!isOneOf(duration.value, ["short", "long", "infinite"])) throw invalidWorkflow("Toast duration preset is invalid.");
    return;
  }
  assertExactKeys(duration, ["kind", "value"], "toast duration");
  if (duration.kind !== "seconds" || typeof duration.value !== "number" || !Number.isFinite(duration.value) || duration.value < 1 || duration.value > 300) throw invalidWorkflow("Toast duration must be a preset or from 1 to 300 seconds.");
}

function validateTableReference(value: unknown): void {
  const table = requireRecord(value, "target table");
  assertPortableKeys(table, "target table");
  if (!isOneOf(table.tableType, ["unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling"])) throw invalidWorkflow("Target table type is invalid.");
  const required = ["tableType", "resourceKey", "catalog", "schema", "table"];
  const lakebaseFields = table.tableType === "lakebaseProvisionedDatabase"
    ? ["instanceName", "database"]
    : table.tableType === "lakebaseAutoscaling"
    ? ["projectId", "branchId", "endpointId", "database"]
    : [];
  assertExactKeys(
    table,
    [...required, ...lakebaseFields],
    "target table",
    table.tableType === "lakebaseAutoscaling" ? ["databaseId"] : [],
  );
  requireResourceKey(table.resourceKey, "table resource key");
  for (const field of ["catalog", "schema", "table"] as const) requireBoundedString(table[field], `table ${field}`, 256);
  for (const field of lakebaseFields) requireBoundedString(table[field], `table ${field}`, 256);
  if (table.tableType === "lakebaseAutoscaling") {
    const unresolvedResource = typeof table.resourceKey === "string"
      ? table.resourceKey.match(/^unresolved_(resource_[1-9][0-9]*)$/)?.[1]
      : undefined;
    const unresolvedValue = unresolvedResource === undefined
      ? undefined
      : `unresolved_${unresolvedResource}`;
    if (unresolvedValue !== undefined &&
        [table.database, table.projectId, table.branchId, table.endpointId].every((value) => value === unresolvedValue) &&
        (table.databaseId === undefined || table.databaseId === unresolvedValue) &&
        table.catalog === "" && table.schema === "" && table.table === "") {
      return;
    }
    for (const field of ["projectId", "branchId", "endpointId"] as const) {
      const identifier = requireBoundedString(table[field], `table ${field}`, 128);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) {
        throw invalidWorkflow(`Lakebase ${field} reference is invalid.`);
      }
    }
    const database = requireBoundedString(table.database, "Lakebase database name", 63);
    if (!/^[A-Za-z0-9_$-]{1,63}$/.test(database)) {
      throw invalidWorkflow("Lakebase database name is invalid.");
    }
    if (table.databaseId !== undefined &&
        !/^[A-Za-z0-9_-]{1,128}$/.test(String(table.databaseId))) {
      throw invalidWorkflow("Lakebase database ID is invalid.");
    }
  } else if (table.tableType === "lakebaseProvisionedDatabase") {
    const instanceName = requireBoundedString(table.instanceName, "Lakebase instance name", 128);
    const database = requireBoundedString(table.database, "Lakebase database name", 63);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(instanceName) || !/^[A-Za-z0-9_$-]{1,63}$/.test(database)) {
      throw invalidWorkflow("Lakebase Provisioned instance and database references are invalid.");
    }
  }
}

function validateColumnOverrides(value: unknown): void {
  if (!Array.isArray(value) || value.length > 500) throw invalidWorkflow("Excluded table columns are invalid.");
  value.forEach((item) => {
    const override = requireRecord(item, "excluded column");
    assertExactKeys(override, ["columnName", "reason"], "excluded column");
    requireBoundedString(override.columnName, "excluded column name", 256);
    if (!isOneOf(override.reason, ["autogenerated", "systemManaged", "manualSkip"])) throw invalidWorkflow("Excluded column reason is invalid.");
  });
}

function validateColumnMappings(value: unknown): void {
  if (!Array.isArray(value) || value.length > 500) throw invalidWorkflow("Table column mappings are invalid.");
  value.forEach((item) => {
    const mapping = requireRecord(item, "column mapping");
    assertExactKeys(mapping, ["formChildComponentKey", "targetColumnName"], "column mapping");
    requireResourceKey(mapping.formChildComponentKey, "form child component key");
    requireBoundedString(mapping.targetColumnName, "target column name", 256);
  });
}

function validatePlaceholder(value: unknown): void {
  const placeholder = requireRecord(value, "SQL placeholder");
  assertExactKeys(placeholder, ["token", "componentKey", "valueType", "formatHint"], "SQL placeholder", ["formatHint"]);
  requireBoundedString(placeholder.token, "SQL placeholder token", 128);
  requireResourceKey(placeholder.componentKey, "SQL placeholder component key");
  if (!isOneOf(placeholder.valueType, ["string", "number", "boolean", "date", "datetime", "unknown"])) throw invalidWorkflow("SQL placeholder value type is invalid.");
  if (placeholder.formatHint !== undefined && !isOneOf(placeholder.formatHint, ["raw", "sqlStringLiteral", "sqlIdentifier", "dateLiteral"])) throw invalidWorkflow("SQL placeholder format hint is invalid.");
}

function readEdge(value: unknown): ProjectWorkflow["edges"][number] {
  const edge = requireRecord(value, "workflow route");
  assertExactKeys(edge, ["fromNodeId", "toNodeId", "route"], "workflow route");
  const fromNodeId = requireResourceKey(edge.fromNodeId, "route source action ID");
  const toNodeId = requireResourceKey(edge.toNodeId, "route target action ID");
  if (!isOneOf(edge.route, PROJECT_WORKFLOW_ROUTES)) throw invalidWorkflow("Workflow route is invalid.");
  return { fromNodeId, toNodeId, route: edge.route };
}

function assertPortableKeys(record: Record<string, unknown>, label: string): void {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_PROPERTY_NAME.test(key)) throw invalidWorkflow(`${label} contains a workspace authority or credential field.`);
  }
}

function assertExactKeys(
  record: Record<string, unknown>,
  requiredKeys: readonly string[],
  label: string,
  optionalKeys: readonly string[] = [],
): void {
  assertPortableKeys(record, label);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  if (requiredKeys.some((key) => !(key in record)) || Object.keys(record).some((key) => !allowed.has(key))) throw invalidWorkflow(`${label} has missing or unsupported fields.`);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidWorkflow(`${label} must be an object.`);
  const record = value as Record<string, unknown>;
  assertPortableKeys(record, label);
  return record;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw invalidWorkflow(`${label} must be a positive integer.`);
  return value;
}

function requireIdentifier(value: unknown, label: string, maxLength: number): string {
  const text = requireBoundedString(value, label, maxLength);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(text)) throw invalidWorkflow(`${label} has an invalid format.`);
  return text;
}

function requireCodeName(value: unknown, label: string): string {
  const text = requireBoundedString(value, label, MAX_CODE_NAME_LENGTH);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(text)) throw invalidWorkflow(`${label} has an invalid format.`);
  return text;
}

function requireResourceKey(value: unknown, label: string): string {
  const text = requireBoundedString(value, label, MAX_RESOURCE_KEY_LENGTH);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(text)) throw invalidWorkflow(`${label} has an invalid format.`);
  return text;
}

function requireBoundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) throw invalidWorkflow(`${label} must be a string of at most ${maxLength} characters.`);
  return value;
}

function isActionType(value: unknown): value is ProjectWorkflowNode["actionType"] {
  return typeof value === "string" && (PROJECT_WORKFLOW_ACTION_TYPES as readonly string[]).includes(value);
}

function isOneOf<const Values extends readonly string[]>(value: unknown, values: Values): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}
