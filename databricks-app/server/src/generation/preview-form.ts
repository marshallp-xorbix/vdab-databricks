import {
  FORM_CHILD_COMPONENT_TYPES,
  type ProjectComponent,
  type ProjectJsonObject,
} from "../db/project-components-contract.ts";
import { MAX_FORM_DIMENSION_PIXELS } from "../db/project-component-validation-constants.ts";
import { invalidForm } from "./preview-errors.ts";
import type { FormProperties } from "./preview-models.ts";
import {
  readOptionalNullableBoolean,
  readOptionalNullableString,
} from "./preview-property-utils.ts";
import { appendGeneratedControl } from "./preview-component-dispatch.ts";
import { formatPythonNumber, pythonString, uniqueVariableName } from "./preview-python.ts";
import {
  appendWorkflowComponentRegistration,
  type WorkflowEventKeys,
} from "./preview-workflow-runtime.ts";

const FORM_PROPERTIES = new Set([
  "submitButtonText",
  "clearOnSubmit",
  "enterToSubmit",
  "border",
  "width",
  "height",
]);
const FORM_WIDTH_MODES = new Set(["stretch", "content"]);
const FORM_HEIGHT_MODES = new Set(["content", "stretch"]);
const DEFAULT_FORM_WIDTH = "stretch";
const DEFAULT_FORM_HEIGHT = "content";
const DEFAULT_FORM_SUBMIT_LABEL = "Submit";
const DEFAULT_EMPTY_FORM_MESSAGE = "Drag components into this form container";
const DEFAULT_FORM_SUCCESS_MESSAGE = "Form submitted successfully!";

/** Reads and independently validates portable Form properties before generation. */
export function readFormProperties(component: ProjectComponent): FormProperties {
  if (component.schemaVersion !== 1) {
    throw invalidForm("The Form schema version is not supported.");
  }

  if (Object.keys(component.properties).some((key) => !FORM_PROPERTIES.has(key))) {
    throw invalidForm("Form contains an unsupported property.");
  }

  if (component.bindings !== null && Object.keys(component.bindings).length > 0) {
    throw invalidForm("Form does not support resource bindings.");
  }

  if (component.layout !== null) {
    throw invalidForm("Form does not support layout settings.");
  }

  const submitButtonText = readOptionalNullableString(
    component.properties,
    "submitButtonText",
    DEFAULT_FORM_SUBMIT_LABEL,
    invalidForm,
  );
  const clearOnSubmit = readOptionalNullableBoolean(
    component.properties,
    "clearOnSubmit",
    false,
    invalidForm,
  );
  const enterToSubmit = readOptionalNullableBoolean(
    component.properties,
    "enterToSubmit",
    true,
    invalidForm,
  );
  const border = readOptionalNullableBoolean(
    component.properties,
    "border",
    true,
    invalidForm,
  );

  if (submitButtonText.length > 2000) {
    throw invalidForm("Form submit label must not exceed 2000 characters.");
  }

  return {
    submitButtonText,
    clearOnSubmit,
    enterToSubmit,
    border,
    width: readDimension(
      component.properties,
      "width",
      DEFAULT_FORM_WIDTH,
      FORM_WIDTH_MODES,
    ),
    height: readDimension(
      component.properties,
      "height",
      DEFAULT_FORM_HEIGHT,
      FORM_HEIGHT_MODES,
    ),
  };
}

/** Confirms a component is allowed inside the current Form source slice. */
export function isAllowedFormChild(component: ProjectComponent): boolean {
  return FORM_CHILD_COMPONENT_TYPES.some((type) => type === component.type) &&
    component.children.length === 0;
}

/** Generates an ordered Form and its controls using Streamlit's submit contract. */
export function appendForm(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  const properties = readFormProperties(component);
  const variableName = uniqueVariableName(
    component,
    componentIndexes.get(component.key) ?? 0,
    usedVariableNames,
  );
  if (workflowEventKeys !== undefined) {
    appendWorkflowComponentRegistration(lines, component, variableName);
  }
  lines.push(
    "",
    `with st.form(`,
    `    key=${pythonString(variableName)},`,
    `    clear_on_submit=${toPythonBoolean(properties.clearOnSubmit)},`,
    `    enter_to_submit=${toPythonBoolean(properties.enterToSubmit)},`,
    `    border=${toPythonBoolean(properties.border)},`,
    `    width=${toPythonValue(properties.width)},`,
    `    height=${toPythonValue(properties.height)},`,
    "):",
  );

  appendFormChildren(
    lines,
    component,
    componentsByKey,
    componentIndexes,
    usedVariableNames,
    workflowEventKeys,
  );
  lines.push(
    `    submitted = st.form_submit_button(${pythonString(properties.submitButtonText)})`,
    "",
    "if submitted:",
  );
  const eventKey = workflowEventKeys?.get(component.key);
  if (eventKey === "onSubmit") {
    lines.push(
      `    _vdab_run_component_workflows(${pythonString(component.key)}, ${pythonString(eventKey)})`,
    );
  }
  lines.push(
    `    st.toast(${pythonString(DEFAULT_FORM_SUCCESS_MESSAGE)})`,
  );
}

function appendFormChildren(
  lines: string[],
  component: ProjectComponent,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  workflowEventKeys?: WorkflowEventKeys,
): void {
  if (component.children.length === 0) {
    lines.push(`    st.info(${pythonString(DEFAULT_EMPTY_FORM_MESSAGE)})`);
    return;
  }

  for (const childKey of component.children) {
    const child = componentsByKey.get(childKey);
    const componentIndex = componentIndexes.get(childKey);

    if (child === undefined || componentIndex === undefined || !isAllowedFormChild(child)) {
      throw invalidForm("Form child references must resolve to supported controls.");
    }

    const childLines: string[] = [];
    appendGeneratedControl(
      childLines,
      { ...child, layout: null },
      componentIndex,
      usedVariableNames,
      workflowEventKeys,
      false,
    );
    lines.push(...childLines.map(indentPythonLine));
  }
}

function readDimension(
  properties: ProjectJsonObject,
  propertyName: "width" | "height",
  defaultMode: string,
  supportedModes: Set<string>,
): string | number {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultMode;
  }

  if (typeof value === "string" && supportedModes.has(value)) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_FORM_DIMENSION_PIXELS
  ) {
    return value;
  }

  throw invalidForm(`Form ${propertyName} must be a supported mode or a positive pixel value.`);
}

function toPythonValue(value: string | number): string {
  return typeof value === "number" ? formatPythonNumber(value) : pythonString(value);
}

function toPythonBoolean(value: boolean): string {
  return value ? "True" : "False";
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
