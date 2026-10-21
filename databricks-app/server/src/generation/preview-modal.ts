import type { ProjectComponent } from "../db/project-components-contract.ts";
import {
  MAX_LEGACY_MODAL_DIMENSION_PIXELS,
  MAX_MODAL_TITLE_LENGTH,
} from "../db/project-component-validation-constants.ts";
import { invalidModal } from "./preview-errors.ts";
import type { ModalProperties } from "./preview-models.ts";
import {
  readOptionalNullableBoolean,
  readOptionalNullableString,
} from "./preview-property-utils.ts";
import { pythonString, uniqueVariableName } from "./preview-python.ts";

const MODAL_PROPERTY_NAMES = new Set([
  "title",
  "width",
  "height",
  "position",
  "dismissible",
]);
const DEFAULT_MODAL_TITLE = "My Modal";
const DEFAULT_MODAL_WIDTH = "large";
const DEFAULT_MODAL_POSITION = "center";
const DEFAULT_MODAL_DISMISSIBLE = true;
const EMPTY_MODAL_MESSAGE = "Modal Content";

/** Validates Modal properties independently before generating dialog source. */
export function readModalProperties(component: ProjectComponent): ModalProperties {
  if (
    component.schemaVersion !== 1 ||
    Object.keys(component.properties).some((key) => !MODAL_PROPERTY_NAMES.has(key)) ||
    (component.bindings !== null && Object.keys(component.bindings).length > 0) ||
    component.layout !== null
  ) {
    throw invalidModal("Modal contains an unsupported schema, property, binding, or layout.");
  }

  const title = component.properties.title;
  const normalizedTitle = title === undefined || title === null
    ? DEFAULT_MODAL_TITLE
    : title;

  if (
    typeof normalizedTitle !== "string" ||
    normalizedTitle.trim() === "" ||
    normalizedTitle.length > MAX_MODAL_TITLE_LENGTH
  ) {
    throw invalidModal("Modal title must contain 1 to 2000 characters.");
  }

  const width = readModalWidth(component.properties.width);
  readLegacyDimension(component.properties.height, "height");
  const position = readOptionalNullableString(
    component.properties,
    "position",
    DEFAULT_MODAL_POSITION,
    invalidModal,
  );
  if (!isModalPosition(position)) {
    throw invalidModal("Modal position must be center, left, or right.");
  }
  const dismissible = readOptionalNullableBoolean(
    component.properties,
    "dismissible",
    DEFAULT_MODAL_DISMISSIBLE,
    invalidModal,
  );

  return { title: normalizedTitle, width, position, dismissible };
}

function isModalPosition(value: string): value is ModalProperties["position"] {
  return value === "center" || value === "left" || value === "right";
}

/** Appends a named dialog definition and delegates each ordered child subtree. */
export function appendModal(
  lines: string[],
  component: ProjectComponent,
  componentIndex: number,
  componentsByKey: Map<string, ProjectComponent>,
  componentIndexes: Map<string, number>,
  usedVariableNames: Set<string>,
  appendChildSource: (lines: string[], child: ProjectComponent) => void,
): void {
  const properties = readModalProperties(component);
  const orderedChildren = component.children
    .map((key, arrayIndex) => ({
      child: componentsByKey.get(key),
      arrayIndex,
    }))
    .map(({ child, arrayIndex }) => {
      if (child === undefined || !componentIndexes.has(child.key)) {
        throw invalidModal("Modal children must resolve to project components.");
      }

      return { child, arrayIndex, y: readChildY(child, arrayIndex) };
    })
    .sort((left, right) => left.y - right.y || left.arrayIndex - right.arrayIndex);
  const variableName = uniqueVariableName(component, componentIndex, usedVariableNames);
  const functionName = readModalFunctionName(component, componentIndex);
  lines.push(
    "",
    `@st.dialog(${pythonString(properties.title)}, width=${pythonString(properties.width)}, position=${pythonString(properties.position)}, dismissible=${properties.dismissible ? "True" : "False"})`,
    `def ${functionName}():`,
  );

  if (orderedChildren.length === 0) {
    lines.push(`    st.write(${pythonString(EMPTY_MODAL_MESSAGE)})`);
  } else {
    for (const { child } of orderedChildren) {
      const childLines: string[] = [];
      appendChildSource(childLines, { ...child, layout: null });
      lines.push(...childLines.map(indentPythonLine));
    }
  }

  lines.push(
    `    if st.button('Close', key=${pythonString(`${variableName}_close`)}):`,
    "        st.rerun()",
  );
}

function readModalWidth(value: unknown): ModalProperties["width"] {
  if (value === undefined || value === null) {
    return DEFAULT_MODAL_WIDTH;
  }

  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }

  readLegacyDimension(value, "width");
  return DEFAULT_MODAL_WIDTH;
}

function readLegacyDimension(value: unknown, propertyName: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_LEGACY_MODAL_DIMENSION_PIXELS
  ) {
    throw invalidModal(`Legacy Modal ${propertyName} must be a positive integer or null.`);
  }
}

function readChildY(component: ProjectComponent, fallback: number): number {
  const y = component.layout?.y;
  return typeof y === "number" && Number.isFinite(y) && y >= 0 ? y : fallback;
}

function readModalFunctionName(component: ProjectComponent, index: number): string {
  const codeName = component.codeName ?? `modal_${index + 1}`;
  return `show_${codeName}`;
}

function indentPythonLine(line: string): string {
  return line === "" ? "" : `    ${line}`;
}
