import type { IProjectComponent } from "../models/ProjectComponents";
import type {
  IProjectWorkflowDefinition,
  IProjectWorkflowNode,
  ProjectWorkflowActionType,
} from "../models/ProjectWorkflow";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import type { VdabComponent } from "../types/components/vdabComponent";
import type {
  WorkflowActionKind,
  WorkflowDefinition as LegacyWorkflowDefinition,
  WorkflowNode as LegacyWorkflowNode,
} from "../types/workflow";

const LEGACY_TO_PORTABLE_ACTION: Record<WorkflowActionKind, ProjectWorkflowActionType> = {
  TriggerToast: "triggerToast",
  ShowModal: "showModal",
  SaveToTable: "saveToTable",
  BuildSql: "buildSql",
  RunSql: "runSql",
  SetBinding: "setBinding",
  StartDatabricksJob: "startDatabricksJob",
  CallCustomModule: "callCustomModule",
  CallPrebuiltModule: "callPrebuiltModule",
};

const PORTABLE_TO_LEGACY_ACTION: Record<ProjectWorkflowActionType, WorkflowActionKind> = {
  triggerToast: "TriggerToast",
  showModal: "ShowModal",
  saveToTable: "SaveToTable",
  buildSql: "BuildSql",
  runSql: "RunSql",
  setBinding: "SetBinding",
  startDatabricksJob: "StartDatabricksJob",
  callCustomModule: "CallCustomModule",
  callPrebuiltModule: "CallPrebuiltModule",
};

const FNV_OFFSET = 14_695_981_039_346_656_037n;
const FNV_PRIME = 1_099_511_628_211n;
const UINT64_MASK = 18_446_744_073_709_551_615n;

/** Maps persisted components onto the existing visual workflow editor model. */
export function toWorkflowBuilderComponents(
  components: IProjectComponent[],
  definitions: IComponentDefinition[],
): VdabComponent[] {
  const definitionsByType = new Map(
    definitions.map((definition) => [definition.type, definition]),
  );

  return components.flatMap((component, index): VdabComponent[] => {
    const definition = definitionsByType.get(component.type);
    if (!definition) return [];

    return [{
      id: component.key,
      codeName: getEditorCodeName(component, index),
      type: component.type as VdabComponent["type"],
      category: definition.category,
      icon: definition.icon,
      props: component.properties,
      supportedEvents: definition.supportedEvents ?? undefined,
      supportedBindings: definition.supportedBindings ?? undefined,
      children: component.children,
      schemaVersion: component.schemaVersion,
    }];
  });
}

/** Translates key-based portable workflows into the retained editor contract. */
export function toWorkflowBuilderDefinition(
  definition: IProjectWorkflowDefinition,
  components: IProjectComponent[],
): LegacyWorkflowDefinition {
  const codeNameByKey = buildEditorCodeNameByKey(components);
  return {
    version: 1,
    workflows: definition.workflows.map((workflow) => ({
      codeName: workflow.codeName,
      trigger: {
        componentCodeName:
          codeNameByKey.get(workflow.trigger.componentKey) ?? workflow.trigger.componentKey,
        eventKey: workflow.trigger.eventKey,
      },
      nodes: workflow.nodes.map((node) => toLegacyNode(node, codeNameByKey)),
      edges: workflow.edges.map((edge) => ({ ...edge })),
    })),
  };
}

/** Translates retained editor values to hostless project component/resource keys. */
export function toPortableWorkflowDefinition(
  definition: LegacyWorkflowDefinition,
  components: IProjectComponent[],
): IProjectWorkflowDefinition {
  const keyByEditorCodeName = buildKeyByEditorCodeName(components);
  return {
    version: 1,
    workflows: definition.workflows.map((workflow) => ({
      codeName: workflow.codeName,
      trigger: {
        componentKey:
          keyByEditorCodeName.get(workflow.trigger.componentCodeName) ?? workflow.trigger.componentCodeName,
        eventKey: workflow.trigger.eventKey,
      },
      nodes: workflow.nodes.map((node) => toPortableNode(node, keyByEditorCodeName)),
      edges: workflow.edges.map((edge) => ({ ...edge })),
    })),
  };
}

/** Returns a stable hostless resource key for a selected target table. */
export function createTableResourceKey(reference: Record<string, unknown>): string {
  const source = Object.keys(reference)
    .filter((key) => key !== "workspaceConnectionId")
    .sort()
    .map((key) => `${key}=${String(reference[key] ?? "")}`)
    .join("&");
  let hash = FNV_OFFSET;

  for (const byte of new TextEncoder().encode(source)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }

  return `table_${hash.toString(16).padStart(16, "0")}`;
}

function toLegacyNode(
  node: IProjectWorkflowNode,
  codeNameByKey: Map<string, string>,
): LegacyWorkflowNode {
  const params = structuredClone(node.params);
  const actionType = PORTABLE_TO_LEGACY_ACTION[node.actionType];

  if (actionType === "ShowModal") {
    renameProperty(params, "modalComponentKey", "modalCodeName");
    mapReference(params, "modalCodeName", codeNameByKey);
  } else if (actionType === "SaveToTable") {
    renameProperty(params, "sourceFormComponentKey", "sourceFormComponentCodeName");
    mapReference(params, "sourceFormComponentCodeName", codeNameByKey);
    if (Array.isArray(params.columnMappings)) {
      params.columnMappings = params.columnMappings.map((mapping) => {
        const nextMapping = asRecord(structuredClone(mapping));
        renameProperty(nextMapping, "formChildComponentKey", "formChildComponentCodeName");
        mapReference(nextMapping, "formChildComponentCodeName", codeNameByKey);
        return nextMapping;
      });
    }
    if (isRecord(params.targetTable)) {
      params.targetTable = toLegacyTableReference(params.targetTable);
    }
  } else if (actionType === "BuildSql") {
    if (Array.isArray(params.placeholders)) {
      params.placeholders = params.placeholders.map((placeholder) => {
        const nextPlaceholder = asRecord(structuredClone(placeholder));
        renameProperty(nextPlaceholder, "componentKey", "componentCodeName");
        mapReference(nextPlaceholder, "componentCodeName", codeNameByKey);
        return nextPlaceholder;
      });
    }
  } else if (actionType === "RunSql") {
    renameNestedActionType(params, "statement", "buildSql", "BuildSql");
  } else if (actionType === "SetBinding") {
    renameNestedActionType(params, "source", "runSql", "RunSql");
    if (isRecord(params.target)) {
      renameProperty(params.target, "componentKey", "componentCodeName");
      mapReference(params.target, "componentCodeName", codeNameByKey);
    }
  } else if (actionType === "StartDatabricksJob" && isRecord(params.job)) {
    params.job.workspaceConnectionId = 0;
    renameProperty(params.job, "resourceKey", "jobId");
  }

  return {
    id: node.id,
    actionType,
    schemaVersion: 1,
    params,
  } as unknown as LegacyWorkflowNode;
}

function toPortableNode(
  node: LegacyWorkflowNode,
  keyByEditorCodeName: Map<string, string>,
): IProjectWorkflowNode {
  const params = structuredClone(node.params) as unknown as Record<string, unknown>;
  const actionType = LEGACY_TO_PORTABLE_ACTION[node.actionType];

  if (node.actionType === "ShowModal") {
    renameProperty(params, "modalCodeName", "modalComponentKey");
    mapReference(params, "modalComponentKey", keyByEditorCodeName);
  } else if (node.actionType === "SaveToTable") {
    renameProperty(params, "sourceFormComponentCodeName", "sourceFormComponentKey");
    mapReference(params, "sourceFormComponentKey", keyByEditorCodeName);
    if (Array.isArray(params.columnMappings)) {
      params.columnMappings = params.columnMappings.map((mapping) => {
        const nextMapping = asRecord(structuredClone(mapping));
        renameProperty(nextMapping, "formChildComponentCodeName", "formChildComponentKey");
        mapReference(nextMapping, "formChildComponentKey", keyByEditorCodeName);
        return nextMapping;
      });
    }
    if (isRecord(params.targetTable)) {
      params.targetTable = toPortableTableReference(params.targetTable);
    }
  } else if (node.actionType === "BuildSql" && Array.isArray(params.placeholders)) {
    params.placeholders = params.placeholders.map((placeholder) => {
      const nextPlaceholder = asRecord(structuredClone(placeholder));
      renameProperty(nextPlaceholder, "componentCodeName", "componentKey");
      mapReference(nextPlaceholder, "componentKey", keyByEditorCodeName);
      return nextPlaceholder;
    });
  } else if (node.actionType === "RunSql") {
    renameNestedActionType(params, "statement", "BuildSql", "buildSql");
  } else if (node.actionType === "SetBinding") {
    renameNestedActionType(params, "source", "RunSql", "runSql");
    if (isRecord(params.target)) {
      renameProperty(params.target, "componentCodeName", "componentKey");
      mapReference(params.target, "componentKey", keyByEditorCodeName);
    }
  } else if (node.actionType === "StartDatabricksJob" && isRecord(params.job)) {
    delete params.job.workspaceConnectionId;
    renameProperty(params.job, "jobId", "resourceKey");
  }

  return { id: node.id, actionType, schemaVersion: 1, params };
}

function toLegacyTableReference(reference: Record<string, unknown>): Record<string, unknown> {
  const legacyReference: Record<string, unknown> = {
    ...reference,
    workspaceConnectionId: 0,
  };
  delete legacyReference.resourceKey;

  return legacyReference;
}

function toPortableTableReference(reference: Record<string, unknown>): Record<string, unknown> {
  const portableReference: Record<string, unknown> = {
    tableType: reference.tableType,
    resourceKey: createTableResourceKey(reference),
    catalog: reference.catalog ?? "",
    schema: reference.schema ?? "",
    table: reference.table ?? "",
  };

  for (const propertyName of [
    "instanceName",
    "database",
    "projectId",
    "branchId",
    "endpointId",
  ]) {
    if (typeof reference[propertyName] === "string") {
      portableReference[propertyName] = reference[propertyName];
    }
  }

  return portableReference;
}

function renameNestedActionType(
  params: Record<string, unknown>,
  propertyName: string,
  oldValue: string,
  newValue: string,
): void {
  const value = params[propertyName];
  if (isRecord(value) && value.sourceActionType === oldValue) {
    value.sourceActionType = newValue;
  }
}

function renameProperty(
  record: Record<string, unknown>,
  oldName: string,
  newName: string,
): void {
  if (!(oldName in record)) return;
  record[newName] = record[oldName];
  delete record[oldName];
}

function mapReference(
  record: Record<string, unknown>,
  propertyName: string,
  mapping: Map<string, string>,
): void {
  const value = record[propertyName];
  if (typeof value === "string") {
    record[propertyName] = mapping.get(value) ?? value;
  }
}

function buildEditorCodeNameByKey(components: IProjectComponent[]): Map<string, string> {
  return new Map(components.map((component, index) => [
    component.key,
    getEditorCodeName(component, index),
  ]));
}

function buildKeyByEditorCodeName(components: IProjectComponent[]): Map<string, string> {
  return new Map(components.map((component, index) => [
    getEditorCodeName(component, index),
    component.key,
  ]));
}

function getEditorCodeName(component: IProjectComponent, index: number): string {
  const codeName = component.codeName?.trim();
  return codeName || `projectComponent${index + 1}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
