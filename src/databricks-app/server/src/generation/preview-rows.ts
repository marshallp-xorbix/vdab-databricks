import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidRows } from "./preview-errors.ts";
import type { RowsProperties } from "./preview-models.ts";
import { readOptionalNullableNumber } from "./preview-property-utils.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { pythonString, uniqueVariableName } from "./preview-python.ts";
import type { WorkflowEventKeys } from "./preview-workflow-runtime.ts";

const DEFAULT_ROW_COUNT = 2;
const MAX_ROW_COUNT = 12;
const ROWS_PROPERTIES = new Set(["rowCount"]);

/** Reads the supported Rows schema and validates its ordered row slots. */
export function readRowsProperties(component: ProjectComponent): RowsProperties {
  if (component.schemaVersion !== 1) {
    throw invalidRows("The Rows schema version is not supported.");
  }

  if (Object.keys(component.properties).some((key) => !ROWS_PROPERTIES.has(key))) {
    throw invalidRows("Rows contains an unsupported property.");
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalidRows("Rows does not support resource bindings.");
  }

  if (component.layout !== null) {
    throw invalidRows("Rows does not support layout settings.");
  }

  const rowCount = readOptionalNullableNumber(
    component.properties,
    "rowCount",
    DEFAULT_ROW_COUNT,
    invalidRows,
  ) ?? DEFAULT_ROW_COUNT;

  if (!Number.isSafeInteger(rowCount) || rowCount < 1 || rowCount > MAX_ROW_COUNT) {
    throw invalidRows("Rows requires between 1 and 12 integer slots.");
  }

  if (component.children.length > rowCount) {
    throw invalidRows("Rows cannot have more children than configured slots.");
  }

  return { rowCount };
}

/** Emits ordered child controls inside the legacy single vertical container. */
export function appendRows(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  const { rowCount } = readRowsProperties(component);
  const variableName = uniqueVariableName(
    component,
    componentIndexes.get(component.key) ?? 0,
    usedVariableNames,
  );
  lines.push("", `${variableName} = st.container()`, `with ${variableName}:`);

  if (component.children.length === 0) {
    lines.push("    pass");
    return;
  }

  for (let slotIndex = 0; slotIndex < rowCount; slotIndex += 1) {
    const childKey = component.children[slotIndex];
    if (childKey === undefined) {
      lines.push(`    st.text(${pythonString(`Row ${slotIndex + 1}`)})`);
      continue;
    }

    const child = componentsByKey.get(childKey);
    const componentIndex = componentIndexes.get(childKey);
    if (child === undefined || componentIndex === undefined) {
      throw invalidRows("Row children must resolve to project components.");
    }

    const childLines: string[] = [];
    appendGeneratedControl(childLines, child, componentIndex, usedVariableNames, workflowEventKeys);
    lines.push(...childLines.map(indentPythonLine));
  }
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
