import type { ProjectComponent } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { isRecord } from "../db/project-component-json.ts";
import { pythonString } from "./preview-python.ts";
import { WORKFLOW_HELPERS } from "./preview-workflow-runtime-python.ts";
import {
  createAutoscalingAppResourceBinding,
  createProvisionedAppResourceBinding,
} from "../lakebase-app-resource-binding.ts";

/** Component event callbacks available to the generated Streamlit controls. */
export type WorkflowEventKeys = ReadonlyMap<string, string>;

/** Registers a rendered input so workflow actions can read its session state. */
export function appendWorkflowComponentRegistration(
  lines: string[],
  component: ProjectComponent,
  widgetKey: string,
): void {
  lines.push(
    `_vdab_register_component(${pythonString(component.key)}, ${pythonString(component.codeName ?? component.key)}, ${pythonString(component.type)}, ${pythonString(widgetKey)})`,
  );
}

/** Appends Streamlit's callback and argument pair for a supported event. */
export function appendWorkflowCallbackArguments(
  lines: string[],
  componentKey: string,
  eventKey: string | undefined,
  indentation = "    ",
): void {
  const callbackText = workflowCallbackArgumentsText(componentKey, eventKey);
  if (callbackText === "") return;
  const callbackName = eventKey === "onClick" ? "on_click" : "on_change";
  lines.push(
    `${indentation}${callbackName}=_vdab_run_component_workflows,`,
    `${indentation}args=(${pythonString(componentKey)}, ${pythonString(eventKey ?? "")}),`,
  );
}

/** Returns callback keyword arguments for a one-line generated widget call. */
export function workflowCallbackArgumentsText(
  componentKey: string,
  eventKey: string | undefined,
): string {
  if (eventKey === undefined) return "";
  const callbackName = eventKey === "onClick" ? "on_click" : "on_change";
  return `${callbackName}=_vdab_run_component_workflows, args=(${pythonString(componentKey)}, ${pythonString(eventKey)})`;
}

/** Emits request-local workflow definitions and their generated Python runtime. */
export function appendWorkflowRuntime(
  lines: string[],
  workflow: ProjectWorkflowDefinition,
  components: ProjectComponent[],
  usesProvisionedLakebase = false,
): WorkflowEventKeys {
  const eventKeys = new Map(
    workflow.workflows.map((definition) => [
      definition.trigger.componentKey,
      definition.trigger.eventKey,
    ]),
  );
  const modalFunctions = Object.fromEntries(
    components
      .filter((component) => component.type === "Modal")
      .map((component) => [
        component.key,
        `show_${component.codeName ?? `modal_${components.indexOf(component) + 1}`}`,
      ]),
  );
  const componentDefinitions = components.map((component) => ({
    key: component.key,
    codeName: component.codeName ?? component.key,
    type: component.type,
    children: component.children,
  }));
  const runtimeWorkflow = addLakebaseResourceEnvironmentVariables(workflow);

  lines.push(
    "binding_overrides = st.session_state.setdefault('binding_overrides', {})",
    "vdab_component_registry = st.session_state.setdefault('_vdab_component_registry', {})",
    `VDAB_WORKFLOW_DEFINITION = json.loads(${pythonString(JSON.stringify(runtimeWorkflow))})`,
    `VDAB_COMPONENT_DEFINITIONS = json.loads(${pythonString(JSON.stringify(componentDefinitions))})`,
    `VDAB_MODAL_FUNCTIONS = json.loads(${pythonString(JSON.stringify(modalFunctions))})`,
    "workflow_results = st.session_state.setdefault('workflow_results', {})",
    "",
    ...workflowHelperLines(usesProvisionedLakebase),
  );

  return eventKeys;
}

function addLakebaseResourceEnvironmentVariables(
  workflow: ProjectWorkflowDefinition,
): ProjectWorkflowDefinition {
  return {
    ...workflow,
    workflows: workflow.workflows.map((definition) => ({
      ...definition,
      nodes: definition.nodes.map((node) => {
        if (node.actionType === "buildSql") {
          const environmentVariable = readBuildSqlLakebaseEnvironmentVariable(node.params);
          return environmentVariable === null
            ? node
            : { ...node, params: { ...node.params, lakebaseResourceEnvironmentVariable: environmentVariable } };
        }
        if (node.actionType === "saveToTable" && isRecord(node.params.targetTable)) {
          const environmentVariable = readSaveTargetLakebaseEnvironmentVariable(node.params.targetTable);
          return environmentVariable === null
            ? node
            : {
              ...node,
              params: {
                ...node.params,
                targetTable: { ...node.params.targetTable, resourceEnvironmentVariable: environmentVariable },
              },
            };
        }
        return node;
      }),
    })),
  };
}

function readBuildSqlLakebaseEnvironmentVariable(
  params: Record<string, unknown>,
): string | null {
  if (params.sqlSourceKind === "lakebaseAutoscaling") {
    const projectId = readLakebaseReference(params.lakebaseProjectId);
    const branchId = readLakebaseReference(params.lakebaseBranchId);
    const endpointId = readLakebaseReference(params.lakebaseEndpointId);
    const databaseId = readLakebaseReference(params.lakebaseDatabaseId);
    return projectId && branchId && endpointId && databaseId
      ? createAutoscalingAppResourceBinding({ projectId, branchId, endpointId, databaseId }).environmentVariable
      : null;
  }
  if (params.sqlSourceKind === "lakebaseProvisionedDatabase") {
    const instanceName = readLakebaseReference(params.lakebaseInstanceName);
    const databaseName = readLakebaseDatabaseName(params.lakebaseDatabaseName);
    return instanceName && databaseName
      ? createProvisionedAppResourceBinding({ instanceName, databaseName }).environmentVariable
      : null;
  }
  return null;
}

function readSaveTargetLakebaseEnvironmentVariable(
  target: Record<string, unknown>,
): string | null {
  if (target.tableType === "lakebaseAutoscaling") {
    const projectId = readLakebaseReference(target.projectId);
    const branchId = readLakebaseReference(target.branchId);
    const endpointId = readLakebaseReference(target.endpointId);
    const databaseId = readLakebaseReference(target.databaseId);
    return projectId && branchId && endpointId && databaseId
      ? createAutoscalingAppResourceBinding({ projectId, branchId, endpointId, databaseId }).environmentVariable
      : null;
  }
  if (target.tableType === "lakebaseProvisionedDatabase") {
    const instanceName = readLakebaseReference(target.instanceName);
    const databaseName = readLakebaseDatabaseName(target.database);
    return instanceName && databaseName
      ? createProvisionedAppResourceBinding({ instanceName, databaseName }).environmentVariable
      : null;
  }
  return null;
}

function readLakebaseReference(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
    !value.startsWith("unresolved_")
    ? value
    : null;
}

function readLakebaseDatabaseName(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_$-]{1,63}$/.test(value) &&
    !value.startsWith("unresolved_")
    ? value
    : null;
}

function workflowHelperLines(usesProvisionedLakebase: boolean): string[] {
  if (usesProvisionedLakebase) return [...WORKFLOW_HELPERS];

  const provisionedOnlyLines = new Set([
    "            if params.get('sqlSourceKind') == 'lakebaseProvisionedDatabase':",
    "                output['lakebaseInstanceName'] = params.get('lakebaseInstanceName')",
    "            elif source_kind == 'lakebaseProvisionedDatabase':",
    "                rows = _vdab_lakebase_provisioned_query_df('', '', 10000, query_statement=str(source_output.get('sql', '')), database=source_output.get('lakebaseDatabaseName'), instance_name=source_output.get('lakebaseInstanceName'), resource_environment_variable=source_output.get('lakebaseResourceEnvironmentVariable'))",
    "        instance_name = target.get('instanceName') if table_type == 'lakebaseProvisionedDatabase' else None",
    "        if (table_type == 'lakebaseAutoscaling' and not isinstance(endpoint, str)) or (table_type == 'lakebaseProvisionedDatabase' and not isinstance(instance_name, str)):",
    "        if table_type == 'lakebaseProvisionedDatabase':",
  ]);
  const legacyLines = new Map([
    [
      "            output = {'sql': rendered_sql, 'sqlSourceKind': params.get('sqlSourceKind'), 'sqlWarehouseId': params.get('sqlWarehouseId'), 'lakebaseDatabaseName': params.get('lakebaseDatabaseName'), 'lakebaseEndpoint': 'projects/' + str(params.get('lakebaseProjectId', '')) + '/branches/' + str(params.get('lakebaseBranchId', '')) + '/endpoints/' + str(params.get('lakebaseEndpointId', '')), 'lakebaseResourceEnvironmentVariable': params.get('lakebaseResourceEnvironmentVariable')}",
      "            output = {'sql': rendered_sql, 'sqlSourceKind': params.get('sqlSourceKind'), 'sqlWarehouseId': params.get('sqlWarehouseId'), 'lakebaseDatabaseName': params.get('lakebaseDatabaseName'), 'lakebaseEndpoint': 'projects/' + str(params.get('lakebaseProjectId', '')) + '/branches/' + str(params.get('lakebaseBranchId', '')) + '/endpoints/' + str(params.get('lakebaseEndpointId', '')), 'lakebaseResourceEnvironmentVariable': params.get('lakebaseResourceEnvironmentVariable')}",
    ],
    [
      "                raise RuntimeError('Generated workflow SQL requires Unity Catalog or a supported Lakebase database in the hosting workspace.')",
      "                raise RuntimeError('Generated workflow SQL requires Unity Catalog or Lakebase Autoscaling in the hosting workspace.')",
    ],
    [
      "    lakebase_target = table_type in ('lakebaseAutoscaling', 'lakebaseProvisionedDatabase')",
      "    lakebase_target = table_type == 'lakebaseAutoscaling'",
    ],
    [
      "        raise RuntimeError('SaveToTable supports Unity Catalog or Lakebase targets.')",
      "        raise RuntimeError('SaveToTable supports Unity Catalog or Lakebase Autoscaling targets.')",
    ],
    [
      "    if table_type not in ('unityCatalogTable', 'lakebaseAutoscaling', 'lakebaseProvisionedDatabase'):",
      "    if table_type not in ('unityCatalogTable', 'lakebaseAutoscaling'):",
    ],
    [
      "        endpoint = 'projects/' + str(target.get('projectId', '')) + '/branches/' + str(target.get('branchId', '')) + '/endpoints/' + str(target.get('endpointId', '')) if table_type == 'lakebaseAutoscaling' else None",
      "        endpoint = 'projects/' + str(target.get('projectId', '')) + '/branches/' + str(target.get('branchId', '')) + '/endpoints/' + str(target.get('endpointId', ''))",
    ],
    [
      "            rows_affected = _vdab_lakebase_execute(statement, postgres_values, database, endpoint, target.get('resourceEnvironmentVariable'))",
      "        rows_affected = _vdab_lakebase_execute(statement, postgres_values, database, endpoint, target.get('resourceEnvironmentVariable'))",
    ],
  ]);
  const result: string[] = [];
  let skipProvisionedElse = false;
  let skipProvisionedBranchLine = false;
  for (const line of WORKFLOW_HELPERS) {
    if (skipProvisionedBranchLine) {
      skipProvisionedBranchLine = false;
      continue;
    }
    if (skipProvisionedElse && line === "        else:") {
      skipProvisionedElse = false;
      continue;
    }
    if (provisionedOnlyLines.has(line)) {
      if (line === "        if table_type == 'lakebaseProvisionedDatabase':") {
        skipProvisionedElse = true;
        skipProvisionedBranchLine = true;
      }
      continue;
    }
    result.push(legacyLines.get(line) ?? line);
  }
  return result;
}
