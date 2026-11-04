import { ApplicationError } from "../application-error.ts";
import type { ComponentDefinition } from "../component-registry/contracts.ts";
import type { ProjectComponent } from "./project-components-contract.ts";
import type { ProjectWorkflow, ProjectWorkflowDefinition } from "./project-workflow-contract.ts";

const FORM_CHILD_TYPES = new Set([
  "TextInput", "Checkbox", "Toggle", "Dropdown", "DatePicker", "TimePicker", "Slider", "Label",
]);

/** Validates workflow references against the component aggregate and registry. */
export function validateProjectWorkflowComponentReferences(
  workflow: ProjectWorkflowDefinition,
  components: ProjectComponent[],
  definitions: ComponentDefinition[],
): void {
  const componentsByKey = new Map(components.map((component) => [component.key, component]));
  const definitionsByType = new Map(definitions.map((definition) => [definition.type, definition]));

  for (const definition of workflow.workflows) {
    validateTrigger(definition, componentsByKey, definitionsByType);
    for (const node of definition.nodes) {
      validateNodeReferences(definition, node, componentsByKey);
    }
  }
}

function validateTrigger(
  workflow: ProjectWorkflow,
  componentsByKey: Map<string, ProjectComponent>,
  definitionsByType: Map<string, ComponentDefinition>,
): void {
  const component = componentsByKey.get(workflow.trigger.componentKey);
  const componentDefinition = component
    ? definitionsByType.get(component.type)
    : undefined;
  if (!component || !componentDefinition?.supportedEvents?.includes(workflow.trigger.eventKey)) {
    throw invalidWorkflow("Workflow trigger must reference a component event supported by the project registry.");
  }
}

function validateNodeReferences(
  workflow: ProjectWorkflow,
  node: ProjectWorkflow["nodes"][number],
  componentsByKey: Map<string, ProjectComponent>,
): void {
  const params = node.params;
  if (node.actionType === "showModal") {
    const modal = componentsByKey.get(String(params.modalComponentKey));
    if (modal?.type !== "Modal") throw invalidWorkflow("ShowModal must reference a Modal component in this project.");
  }
  if (node.actionType === "saveToTable") {
    validateSaveToTableReferences(workflow, params, componentsByKey);
  }
  if (node.actionType === "buildSql") {
    validateSqlPlaceholderReferences(params, componentsByKey);
  }
  if (node.actionType === "setBinding") {
    validateBindingTarget(params, componentsByKey);
  }
}

function validateSaveToTableReferences(
  workflow: ProjectWorkflow,
  params: Record<string, unknown>,
  componentsByKey: Map<string, ProjectComponent>,
): void {
  const formKey = String(params.sourceFormComponentKey);
  const form = componentsByKey.get(formKey);
  if (form?.type !== "Form" || workflow.trigger.componentKey !== formKey) {
    throw invalidWorkflow("SaveToTable must use the workflow's Form trigger as its source.");
  }

  const formChildren = new Set(form.children);
  const mappings = params.columnMappings;
  if (!Array.isArray(mappings)) return;
  for (const mapping of mappings) {
    if (!isRecord(mapping)) continue;
    const childKey = String(mapping.formChildComponentKey);
    const child = componentsByKey.get(childKey);
    if (!formChildren.has(childKey) || !child || !FORM_CHILD_TYPES.has(child.type)) {
      throw invalidWorkflow("SaveToTable column mappings must reference supported direct children of the source Form.");
    }
  }
}

function validateSqlPlaceholderReferences(
  params: Record<string, unknown>,
  componentsByKey: Map<string, ProjectComponent>,
): void {
  const placeholders = params.placeholders;
  if (!Array.isArray(placeholders)) return;
  for (const placeholder of placeholders) {
    if (!isRecord(placeholder) || !componentsByKey.has(String(placeholder.componentKey))) {
      throw invalidWorkflow("BuildSql placeholders must reference components in this project.");
    }
  }
}

function validateBindingTarget(
  params: Record<string, unknown>,
  componentsByKey: Map<string, ProjectComponent>,
): void {
  const target = params.target;
  if (!isRecord(target)) return;
  const component = componentsByKey.get(String(target.componentKey));
  const expectedType = target.bindingType === "chartData"
    ? new Set(["BarChart", "LineChart", "PieChart", "DonutChart"])
    : new Set(["DataWindow", "EditableDataWindow"]);
  if (!component || !expectedType.has(component.type)) {
    throw invalidWorkflow("SetBinding target must support the selected workflow binding type.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidWorkflow(detail: string): ApplicationError {
  return new ApplicationError(400, "invalid_project_workflow", "Invalid project workflow", detail);
}
