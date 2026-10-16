import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRoute,
} from "../../../types/workflow";
import type { VdabComponent } from "../../../types/components";
import {
  isWorkflowActionNode,
  type WorkflowActionKind,
} from "../../../types/workflow";
import { WORKFLOW_ROUTES } from "../../../types/workflow/workflowRoutes";
import { getWorkflowActionDefinition } from "./ActionRegistry";
import { createDefaultActionNode } from "./registry/actionDefaults";

export const ROUTE_OPTIONS: WorkflowRoute[] = [...WORKFLOW_ROUTES];

export const createDefaultWorkflow = (
  componentCodeName = "",
  workflowCodeName = "workflow_1",
): Workflow => ({
  codeName: workflowCodeName,
  trigger: {
    componentCodeName,
    eventKey: "onClick",
  },
  nodes: [],
  edges: [],
});

export const createDefaultNode = (): WorkflowNode => ({
  ...createDefaultActionNode("TriggerToast"),
});

export const getActionDefinition = (actionType: WorkflowActionKind) =>
  getWorkflowActionDefinition(actionType);

export const getNodeLabel = (node: WorkflowNode, index: number) =>
  `Action ${index + 1}: ${getActionDefinition(node.actionType)?.label ?? node.actionType}`;

export const getWorkflowLabel = (workflow: Workflow, index: number) =>
  workflow.codeName.trim() || `workflow_${index + 1}`;

export const buildDefaultWorkflowCodeName = (existingWorkflows: Workflow[]) => {
  const existingCodeNames = new Set(
    existingWorkflows
      .map((workflow) => workflow.codeName?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );

  let index = existingWorkflows.length + 1;
  let candidate = `workflow_${index}`;
  while (existingCodeNames.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `workflow_${index}`;
  }

  return candidate;
};

const VALID_CODE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isValidWorkflowCodeName = (value: string) =>
  VALID_CODE_NAME_PATTERN.test(value);

export const getWorkflowCodeNameValidationError = (
  workflows: Workflow[],
  currentCodeName: string,
  value?: string,
) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "Code name is required.";
  }

  if (!isValidWorkflowCodeName(trimmed)) {
    return "Code name must start with a letter or underscore and contain only letters, digits, and underscores.";
  }

  const isDuplicate = workflows.some(
    (workflow) =>
      workflow.codeName !== currentCodeName &&
      workflow.codeName.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  if (isDuplicate) {
    return "Workflow code name must be unique.";
  }

  return null;
};

export const getWorkflowTriggerValidationError = (
  workflows: Workflow[],
  currentCodeName: string,
  componentCodeName: string,
  eventKey: string,
) => {
  if (!componentCodeName || !eventKey) {
    return null;
  }

  const duplicateTrigger = workflows.some(
    (workflow) =>
      workflow.codeName !== currentCodeName &&
      workflow.trigger.componentCodeName.toLowerCase() ===
        componentCodeName.toLowerCase() &&
      workflow.trigger.eventKey.toLowerCase() === eventKey.toLowerCase(),
  );

  return duplicateTrigger
    ? "Only one workflow can use the same trigger component and event."
    : null;
};

export const renameWorkflowComponentReferences = (
  definition: WorkflowDefinition,
  oldCodeName: string,
  newCodeName: string,
  options?: { isModal?: boolean },
): WorkflowDefinition => {
  if (!oldCodeName || !newCodeName || oldCodeName === newCodeName) {
    return definition;
  }

  return {
    ...definition,
    workflows: definition.workflows.map((workflow) => ({
      ...workflow,
      trigger:
        workflow.trigger.componentCodeName.toLowerCase() ===
        oldCodeName.toLowerCase()
          ? { ...workflow.trigger, componentCodeName: newCodeName }
          : workflow.trigger,
      nodes: workflow.nodes.map((node) => {
        if (isWorkflowActionNode(node, "SetBinding")) {
          return node.params.target.componentCodeName.toLowerCase() ===
            oldCodeName.toLowerCase()
            ? {
                ...node,
                params: {
                  ...node.params,
                  target: {
                    ...node.params.target,
                    componentCodeName: newCodeName,
                  },
                },
              }
            : node;
        }

        if (isWorkflowActionNode(node, "SaveToTable")) {
          return node.params.sourceFormComponentCodeName.toLowerCase() ===
            oldCodeName.toLowerCase()
            ? {
                ...node,
                params: {
                  ...node.params,
                  sourceFormComponentCodeName: newCodeName,
                },
              }
            : node;
        }

        if (isWorkflowActionNode(node, "BuildSql")) {
          return {
            ...node,
            params: {
              ...node.params,
              placeholders: node.params.placeholders.map((placeholder) =>
                placeholder.componentCodeName.toLowerCase() ===
                oldCodeName.toLowerCase()
                  ? { ...placeholder, componentCodeName: newCodeName }
                  : placeholder,
              ),
            },
          };
        }

        if (
          options?.isModal &&
          isWorkflowActionNode(node, "ShowModal") &&
          node.params.modalCodeName.toLowerCase() === oldCodeName.toLowerCase()
        ) {
          return {
            ...node,
            params: {
              ...node.params,
              modalCodeName: newCodeName,
            },
          };
        }

        return node;
      }),
    })),
  };
};

const containsCodeNameReference = (
  value: unknown,
  codeNames: Set<string>,
): boolean => {
  if (typeof value === "string") {
    return codeNames.has(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsCodeNameReference(item, codeNames));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      containsCodeNameReference(item, codeNames),
    );
  }

  return false;
};

export const removeWorkflowsForComponentIds = (
  definition: WorkflowDefinition,
  components: VdabComponent[],
  componentIds: Set<string>,
): WorkflowDefinition => {
  if (componentIds.size === 0) {
    return definition;
  }

  const removedCodeNames = new Set(
    components
      .filter((component) => componentIds.has(component.id))
      .map((component) => component.codeName?.trim())
      .filter((codeName): codeName is string => Boolean(codeName)),
  );

  if (removedCodeNames.size === 0) {
    return definition;
  }

  const workflows = definition.workflows.filter((workflow) => {
    if (removedCodeNames.has(workflow.trigger.componentCodeName)) {
      return false;
    }

    return !workflow.nodes.some((node) =>
      containsCodeNameReference(node.params, removedCodeNames),
    );
  });

  return workflows.length === definition.workflows.length
    ? definition
    : { ...definition, workflows };
};

export const removeWorkflowsWithMissingTriggers = (
  definition: WorkflowDefinition,
  components: VdabComponent[],
): WorkflowDefinition => {
  const componentCodeNames = new Set(
    components
      .map((component) => component.codeName?.trim())
      .filter((codeName): codeName is string => Boolean(codeName)),
  );

  const workflows = definition.workflows.filter((workflow) =>
    componentCodeNames.has(workflow.trigger.componentCodeName),
  );

  return workflows.length === definition.workflows.length
    ? definition
    : { ...definition, workflows };
};

export const isSqlProducingAction = (actionType: WorkflowActionKind) =>
  actionType === "BuildSql";

export const updateWorkflowDefinition = (
  definition: WorkflowDefinition,
  workflowCodeName: string,
  updater: (workflow: Workflow) => Workflow,
): WorkflowDefinition => ({
  ...definition,
  workflows: definition.workflows.map((workflow) =>
    workflow.codeName === workflowCodeName ? updater(workflow) : workflow,
  ),
});
