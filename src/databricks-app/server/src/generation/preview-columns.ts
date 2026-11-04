import type { ProjectComponent } from "../db/project-components-contract.ts";
import { invalidColumns } from "./preview-errors.ts";
import type { ColumnsProperties } from "./preview-models.ts";
import { readOptionalNullableNumber } from "./preview-property-utils.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { pythonString, uniqueVariableName } from "./preview-python.ts";
import type { WorkflowEventKeys } from "./preview-workflow-runtime.ts";

const DEFAULT_COLUMN_COUNT = 2;
const MAX_COLUMN_COUNT = 12;
const COLUMNS_PROPERTIES = new Set(["columnCount"]);

/** Reads the supported Columns schema and bounds its generated slot count. */
export function readColumnsProperties(
  component: ProjectComponent,
): ColumnsProperties {
  if (component.schemaVersion !== 1) {
    throw invalidColumns("The Columns schema version is not supported.");
  }

  if (Object.keys(component.properties).some((key) => !COLUMNS_PROPERTIES.has(key))) {
    throw invalidColumns("Columns contains an unsupported property.");
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalidColumns("Columns does not support resource bindings.");
  }

  if (component.layout !== null) {
    throw invalidColumns("Columns does not support layout settings.");
  }

  const columnCount = readOptionalNullableNumber(
    component.properties,
    "columnCount",
    DEFAULT_COLUMN_COUNT,
    invalidColumns,
  ) ?? DEFAULT_COLUMN_COUNT;

  if (
    !Number.isSafeInteger(columnCount) ||
    columnCount < 1 ||
    columnCount > MAX_COLUMN_COUNT
  ) {
    throw invalidColumns("Columns requires between 1 and 12 integer slots.");
  }

  if (component.children.length > columnCount) {
    throw invalidColumns("Columns cannot have more children than configured slots.");
  }

  return { columnCount };
}

/** Emits ordered controls into their matching Streamlit column slots. */
export function appendColumns(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  const { columnCount } = readColumnsProperties(component);
  const variableName = uniqueVariableName(
    component,
    componentIndexes.get(component.key) ?? 0,
    usedVariableNames,
  );
  lines.push("", `${variableName} = st.columns(${columnCount})`);

  for (let slotIndex = 0; slotIndex < columnCount; slotIndex += 1) {
    lines.push(`with ${variableName}[${slotIndex}]:`);
    const childKey = component.children[slotIndex];

    if (childKey === undefined) {
      lines.push(`    st.text(${pythonString(`Column ${slotIndex + 1}`)})`);
      continue;
    }

    const child = componentsByKey.get(childKey);
    const componentIndex = componentIndexes.get(childKey);
    if (child === undefined || componentIndex === undefined) {
      throw invalidColumns("Column children must resolve to project components.");
    }

    const childLines: string[] = [];
    appendGeneratedControl(childLines, child, componentIndex, usedVariableNames, workflowEventKeys);
    lines.push(...childLines.map(indentPythonLine));
  }
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
