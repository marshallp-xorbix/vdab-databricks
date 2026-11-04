import type { VdabComponent } from "../../types/components";
import { ComponentType } from "../../types/components/componentTypes";
import type {
  SetBindingTargetType,
  Workflow,
  WorkflowActionKind,
  WorkflowNode,
} from "../../types/workflow";

export interface WorkflowReferenceOption {
  value: string;
  label: string;
  description?: string;
}

const SAVE_TO_TABLE_SOURCE_COMPONENT_TYPES = new Set<ComponentType>([
  ComponentType.TextInput,
  ComponentType.Checkbox,
  ComponentType.Toggle,
  ComponentType.Dropdown,
  ComponentType.DatePicker,
  ComponentType.TimePicker,
  ComponentType.Slider,
  ComponentType.FileUpload,
]);

const formatActionTypeLabel = (actionType: WorkflowActionKind) =>
  actionType.replace(/([a-z])([A-Z])/g, "$1 $2");

export const buildNodeOptionLabel = (
  workflow: Workflow,
  node: WorkflowNode,
): string => {
  const nodeIndex = workflow.nodes.findIndex(
    (candidate) => candidate.id === node.id,
  );
  const prefix = nodeIndex >= 0 ? `Action ${nodeIndex + 1}` : node.id;

  return `${prefix}: ${formatActionTypeLabel(node.actionType)}`;
};

export const getWorkflowTriggerComponent = (
  workflow: Workflow,
  components: VdabComponent[],
): VdabComponent | undefined =>
  components.find(
    (component) => component.codeName === workflow.trigger.componentCodeName,
  );

export const isWorkflowTriggerForm = (
  workflow: Workflow,
  components: VdabComponent[],
): boolean =>
  getWorkflowTriggerComponent(workflow, components)?.type ===
  ComponentType.Form;

export const getGraphReachablePriorNodes = (
  workflow: Workflow,
  currentNodeId: string,
  actionTypes?: WorkflowActionKind[],
): WorkflowNode[] => {
  const incomingEdgesByNodeId = new Map<string, string[]>();

  workflow.edges.forEach((edge) => {
    const incomingNodeIds = incomingEdgesByNodeId.get(edge.toNodeId) ?? [];
    incomingNodeIds.push(edge.fromNodeId);
    incomingEdgesByNodeId.set(edge.toNodeId, incomingNodeIds);
  });

  const visitedNodeIds = new Set<string>();
  const reachableNodeIds = new Set<string>();
  const queue: string[] = [...(incomingEdgesByNodeId.get(currentNodeId) ?? [])];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visitedNodeIds.has(nodeId)) {
      continue;
    }

    visitedNodeIds.add(nodeId);
    reachableNodeIds.add(nodeId);

    for (const parentNodeId of incomingEdgesByNodeId.get(nodeId) ?? []) {
      if (!visitedNodeIds.has(parentNodeId)) {
        queue.push(parentNodeId);
      }
    }
  }

  return workflow.nodes.filter((node) => {
    if (!reachableNodeIds.has(node.id)) {
      return false;
    }

    return actionTypes == null || actionTypes.includes(node.actionType);
  });
};

export const getGraphReachablePriorNodeOptions = (
  workflow: Workflow,
  currentNodeId: string,
  actionTypes: WorkflowActionKind[],
): WorkflowReferenceOption[] =>
  getGraphReachablePriorNodes(workflow, currentNodeId, actionTypes).map(
    (node) => ({
      value: node.id,
      label: buildNodeOptionLabel(workflow, node),
    }),
  );

export const getModalOptions = (
  components: VdabComponent[],
): WorkflowReferenceOption[] =>
  components
    .filter(
      (component) =>
        component.type === ComponentType.Modal && Boolean(component.codeName),
    )
    .map((component) => ({
      value: component.codeName,
      label: component.codeName,
    }));

const SET_BINDING_CHART_COMPONENT_TYPES = new Set<ComponentType>([
  ComponentType.BarChart,
  ComponentType.LineChart,
  ComponentType.PieChart,
  ComponentType.DonutChart,
]);

const SET_BINDING_TABLE_COMPONENT_TYPES = new Set<ComponentType>([
  ComponentType.DataWindow,
  ComponentType.EditableDataWindow,
]);

const SET_BINDING_TARGET_HELP_TEXT: Partial<Record<ComponentType, string>> = {
  [ComponentType.BarChart]:
    "RunSql must return rows shaped for the chart with columns aliased as 'category' and 'count'.",
  [ComponentType.LineChart]:
    "RunSql must return rows shaped for the chart with columns aliased as 'x' and 'y'.",
  [ComponentType.PieChart]:
    "RunSql must return rows shaped for the chart with columns aliased as 'category' and 'value'.",
  [ComponentType.DonutChart]:
    "RunSql must return rows shaped for the chart with columns aliased as 'category' and 'value'.",
  [ComponentType.DataWindow]:
    "RunSql rows are applied directly to the data window and rendered as tabular data.",
  [ComponentType.EditableDataWindow]:
    "RunSql rows are applied directly to the editable data window as the current table data.",
};

export const getSetBindingTargetTypeForComponent = (
  component?: VdabComponent,
): SetBindingTargetType | null => {
  if (!component?.codeName) {
    return null;
  }

  if (SET_BINDING_CHART_COMPONENT_TYPES.has(component.type)) {
    return "chartData";
  }

  if (SET_BINDING_TABLE_COMPONENT_TYPES.has(component.type)) {
    return "unityCatalogTable";
  }

  return null;
};

export const getSetBindingTargetTypesForComponent = (
  component?: VdabComponent,
): SetBindingTargetType[] => {
  const targetType = getSetBindingTargetTypeForComponent(component);
  return targetType ? [targetType] : [];
};

export const getSetBindingTargetGuidance = (
  component?: VdabComponent,
): string | null => {
  if (!component) {
    return null;
  }

  return SET_BINDING_TARGET_HELP_TEXT[component.type] ?? null;
};

export const getSetBindingTargetComponentOptions = (
  components: VdabComponent[],
): WorkflowReferenceOption[] =>
  components
    .filter(
      (component) =>
        Boolean(component.codeName) &&
        getSetBindingTargetTypesForComponent(component).length > 0,
    )
    .map((component) => ({
      value: component.codeName,
      label: component.codeName,
      description: getSetBindingTargetGuidance(component) ?? undefined,
    }));

const buildComponentMap = (components: VdabComponent[]) =>
  new Map(components.map((component) => [component.id, component] as const));

const getDescendantComponents = (
  rootComponentId: string,
  componentMap: Map<string, VdabComponent>,
): VdabComponent[] => {
  const rootComponent = componentMap.get(rootComponentId);
  if (!rootComponent?.children?.length) {
    return [];
  }

  const descendants: VdabComponent[] = [];
  const stack = [...rootComponent.children].reverse();
  const visitedComponentIds = new Set<string>();

  while (stack.length > 0) {
    const componentId = stack.pop();
    if (!componentId || visitedComponentIds.has(componentId)) {
      continue;
    }

    visitedComponentIds.add(componentId);
    const component = componentMap.get(componentId);
    if (!component) {
      continue;
    }

    descendants.push(component);

    for (const childId of [...(component.children ?? [])].reverse()) {
      stack.push(childId);
    }
  }

  return descendants;
};

export const getSaveToTableSourceComponentOptions = (
  workflow: Workflow,
  components: VdabComponent[],
): WorkflowReferenceOption[] => {
  const triggerComponent = getWorkflowTriggerComponent(workflow, components);
  if (!triggerComponent || triggerComponent.type !== ComponentType.Form) {
    return [];
  }

  const componentMap = buildComponentMap(components);

  return getDescendantComponents(triggerComponent.id, componentMap)
    .filter(
      (component) =>
        Boolean(component.codeName) &&
        SAVE_TO_TABLE_SOURCE_COMPONENT_TYPES.has(component.type),
    )
    .map((component) => ({
      value: component.codeName,
      label: component.codeName,
      description: component.type,
    }));
};
