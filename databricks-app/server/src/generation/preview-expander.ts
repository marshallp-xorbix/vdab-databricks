import { LAYOUT_CHILD_COMPONENT_TYPES } from "../db/project-components-contract.ts";
import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidExpander } from "./preview-errors.ts";
import type { ExpanderProperties } from "./preview-models.ts";
import { readOptionalBoolean, readOptionalString } from "./preview-property-utils.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { pythonString } from "./preview-python.ts";
import type { WorkflowEventKeys } from "./preview-workflow-runtime.ts";

const EXPANDER_PROPERTIES = new Set(["sectionTitle", "defaultExpanded"]);

/** Reads and validates the portable properties supported by an Expander. */
export function readExpanderProperties(
  component: ProjectComponent,
): ExpanderProperties {
  if (component.schemaVersion !== 1) {
    throw invalidExpander("The Expander schema version is not supported.");
  }

  if (Object.keys(component.properties).some((key) => !EXPANDER_PROPERTIES.has(key))) {
    throw invalidExpander("Expander contains an unsupported property.");
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalidExpander("Expander does not support resource bindings.");
  }

  if (component.layout !== null) {
    throw invalidExpander("Expander does not support layout settings.");
  }

  const sectionTitle = readOptionalString(
    component.properties,
    "sectionTitle",
    "Section",
    invalidExpander,
  );
  const defaultExpanded = readOptionalBoolean(
    component.properties,
    "defaultExpanded",
    false,
    invalidExpander,
  );

  if (sectionTitle.trim() === "" || sectionTitle.length > 500) {
    throw invalidExpander("Expander requires a non-empty section title.");
  }

  return { sectionTitle, defaultExpanded };
}

/** Appends the Expander context-manager line using an escaped title. */
export function appendExpanderStart(
  lines: string[],
  properties: ExpanderProperties,
): void {
  lines.push(
    "",
    `with st.expander(${pythonString(properties.sectionTitle)}, expanded=${properties.defaultExpanded ? "True" : "False"}):`,
  );
}

/** Appends ordered control children inside a validated Expander context. */
export function appendExpanderChildren(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  if (component.children.length === 0) {
    lines.push("    st.text('Add components to expander')");
    return;
  }

  for (const childKey of component.children) {
    const child = componentsByKey.get(childKey);
    const componentIndex = componentIndexes.get(childKey);

    if (child === undefined || componentIndex === undefined) {
      throw invalidExpander("Expander child references must resolve to project components.");
    }

    const childLines: string[] = [];
    appendGeneratedControl(childLines, child, componentIndex, usedVariableNames, workflowEventKeys);
    lines.push(...childLines.map(indentPythonLine));
  }
}

/** Confirms an Expander contains only the supported first-level control types. */
export function isAllowedLayoutControlChild(component: ProjectComponent): boolean {
  return LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === component.type) &&
    component.children.length === 0;
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
