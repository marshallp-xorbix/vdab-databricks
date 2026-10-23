import type { ProjectJsonObject, ProjectJsonValue } from "./project-components-contract.ts";
import { hasUnexpectedProperties } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  readOptionalBooleanProperty,
  readOptionalNullableBoolean,
  readOptionalNullableNumber,
  readOptionalNullableText,
  readOptionalTextProperty,
} from "./project-component-property-readers.ts";
import {
  DEFAULT_LAYOUT_SLOT_COUNT,
  MAX_FORM_DIMENSION_PIXELS,
  MAX_LAYOUT_SLOT_COUNT,
  MAX_LEGACY_MODAL_DIMENSION_PIXELS,
  MAX_MODAL_TITLE_LENGTH,
  MAX_TAB_NAME_LENGTH,
} from "./project-component-validation-constants.ts";

const FORM_PROPERTY_NAMES = [
  "submitButtonText",
  "clearOnSubmit",
  "enterToSubmit",
  "border",
  "width",
  "height",
];
const FORM_WIDTH_MODES = new Set(["stretch", "content"]);
const FORM_HEIGHT_MODES = new Set(["content", "stretch"]);
const MODAL_WIDTH_MODES = new Set(["small", "medium", "large"]);
const MODAL_POSITION_MODES = new Set(["center", "left", "right"]);

export function validateFormProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, FORM_PROPERTY_NAMES)) {
    throw invalidComponents();
  }

  const submitButtonText = readOptionalNullableText(
    properties,
    "submitButtonText",
    "Submit",
  );
  readOptionalNullableBoolean(properties, "clearOnSubmit", false);
  readOptionalNullableBoolean(properties, "enterToSubmit", true);
  readOptionalNullableBoolean(properties, "border", true);

  if (submitButtonText.length > 2000) {
    throw invalidComponents();
  }

  validateFormDimension(properties.width, FORM_WIDTH_MODES);
  validateFormDimension(properties.height, FORM_HEIGHT_MODES);
}

export function validateModalProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, [
    "title",
    "width",
    "height",
    "position",
    "dismissible",
  ])) {
    throw invalidComponents();
  }

  const title = readOptionalNullableText(properties, "title", "My Modal");
  if (title.trim() === "" || title.length > MAX_MODAL_TITLE_LENGTH) {
    throw invalidComponents();
  }

  validateModalDimension(properties.width, true);
  validateModalDimension(properties.height, false);
  const position = readOptionalNullableText(properties, "position", "center");
  if (!MODAL_POSITION_MODES.has(position)) {
    throw invalidComponents();
  }
  readOptionalNullableBoolean(properties, "dismissible", true);
}

function validateModalDimension(
  value: ProjectJsonValue | undefined,
  allowDialogWidth: boolean,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_LEGACY_MODAL_DIMENSION_PIXELS
  ) {
    return;
  }

  if (
    allowDialogWidth &&
    typeof value === "string" &&
    MODAL_WIDTH_MODES.has(value)
  ) {
    return;
  }

  throw invalidComponents();
}

function validateFormDimension(
  value: ProjectJsonValue | undefined,
  supportedModes: Set<string>,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_FORM_DIMENSION_PIXELS
  ) {
    return;
  }

  if (typeof value === "string" && supportedModes.has(value)) {
    return;
  }

  throw invalidComponents();
}

export function validateTabsProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["tabs", "defaultTabIndex"])) {
    throw invalidComponents();
  }

  const tabsValue = properties.tabs;
  if (
    !Array.isArray(tabsValue) ||
    tabsValue.length < 1 ||
    !tabsValue.every((tabName) => typeof tabName === "string")
  ) {
    throw invalidComponents();
  }

  const tabNames = tabsValue as string[];
  if (
    tabNames.some(
      (tabName) => tabName.trim() === "" || tabName.trim().length > MAX_TAB_NAME_LENGTH,
    )
  ) {
    throw invalidComponents();
  }

  const defaultTabIndex = properties.defaultTabIndex;
  if (defaultTabIndex !== undefined && defaultTabIndex !== null) {
    if (
      typeof defaultTabIndex !== "number" ||
      !Number.isSafeInteger(defaultTabIndex) ||
      defaultTabIndex < 0 ||
      defaultTabIndex >= tabNames.length
    ) {
      throw invalidComponents();
    }

    const defaultTabName = tabNames[defaultTabIndex];
    if (defaultTabName === undefined || tabNames.indexOf(defaultTabName) !== defaultTabIndex) {
      throw invalidComponents();
    }
  }
}

export function validateExpanderProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["sectionTitle", "defaultExpanded"])) {
    throw invalidComponents();
  }

  const sectionTitle = readOptionalTextProperty(properties, "sectionTitle", "Section");
  readOptionalBooleanProperty(properties, "defaultExpanded", false);

  if (sectionTitle.trim() === "" || sectionTitle.length > 500) {
    throw invalidComponents();
  }
}

export function validateColumnsProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["columnCount"])) {
    throw invalidComponents();
  }

  const columnCount = readOptionalNullableNumber(
    properties,
    "columnCount",
    DEFAULT_LAYOUT_SLOT_COUNT,
  ) ?? DEFAULT_LAYOUT_SLOT_COUNT;

  if (
    !Number.isSafeInteger(columnCount) ||
    columnCount < 1 ||
    columnCount > MAX_LAYOUT_SLOT_COUNT
  ) {
    throw invalidComponents();
  }
}

export function validateRowsProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["rowCount"])) {
    throw invalidComponents();
  }

  const rowCount = readOptionalNullableNumber(
    properties,
    "rowCount",
    DEFAULT_LAYOUT_SLOT_COUNT,
  ) ?? DEFAULT_LAYOUT_SLOT_COUNT;

  if (
    !Number.isSafeInteger(rowCount) ||
    rowCount < 1 ||
    rowCount > MAX_LAYOUT_SLOT_COUNT
  ) {
    throw invalidComponents();
  }
}
