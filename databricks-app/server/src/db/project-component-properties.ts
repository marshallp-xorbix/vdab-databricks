import type { ProjectComponent, ProjectJsonObject, ProjectJsonValue } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import { validateFileUploadProperties } from "./project-component-file-upload.ts";
import { validateDataWindowProperties } from "./project-component-data-window.ts";
import { validateEditableDataWindowProperties } from "./project-component-editable-data-window.ts";
import { validateCartesianChartProperties } from "./project-component-cartesian-chart.ts";
import {
  validateDonutChartProperties,
  validatePieChartProperties,
} from "./project-component-pie-chart.ts";
import { validateAmoebaStoryProperties } from "./project-component-amoeba-story.ts";
import { validateFlowFieldStoryProperties } from "./project-component-flow-field-story.ts";
import { validateHeatMapStoryProperties } from "./project-component-heat-map-story.ts";
import { validateHoneycombStoryProperties } from "./project-component-honeycomb-story.ts";
import { validateNetworkWebStoryProperties } from "./project-component-network-web-story.ts";
import { validatePulseWaveStoryProperties } from "./project-component-pulse-wave-story.ts";
import { validateSpiralStoryProperties } from "./project-component-spiral-story.ts";
import { validateTerrainStoryProperties } from "./project-component-terrain-story.ts";
import { validateDashboardEmbedProperties } from "./project-component-dashboard-embed.ts";
import { validateGenieChatProperties } from "./project-component-genie-chat.ts";
import { validateModelChatProperties } from "./project-component-model-chat.ts";
import {
  DATE_FORMATS, DEFAULT_LAYOUT_SLOT_COUNT, DEFAULT_SLIDER_MAX_VALUE,
  DEFAULT_SLIDER_MIN_VALUE, DEFAULT_SLIDER_STEP, DEFAULT_SLIDER_UPPER_VALUE,
  DEFAULT_SLIDER_VALUE, LABEL_FONT_SIZES, MAX_FORM_DIMENSION_PIXELS,
  MAX_LAYOUT_SLOT_COUNT, MAX_LEGACY_MODAL_DIMENSION_PIXELS, MAX_MODAL_TITLE_LENGTH,
  MAX_SLIDER_VALUE, MAX_TAB_NAME_LENGTH, SLIDER_FORMATS, SLIDER_PRINTF_FORMAT_PATTERN,
} from "./project-component-validation-constants.ts";
export function validateComponentProperties(
  type: ProjectComponent["type"],
  properties: ProjectJsonObject,
): void {
  if (type === "DashboardEmbed") {
    validateDashboardEmbedProperties(properties);
  } else if (type === "GenieChat") {
    validateGenieChatProperties(properties);
  } else if (type === "ModelChat") {
    validateModelChatProperties(properties);
  } else if (type === "Dropdown") {
    validateDropdownProperties(properties);
  } else if (type === "DatePicker") {
    validateDatePickerProperties(properties);
  } else if (type === "TimePicker") {
    validateTimePickerProperties(properties);
  } else if (type === "Slider") {
    validateSliderProperties(properties);
  } else if (type === "Label") {
    validateLabelProperties(properties);
  } else if (type === "Expander") {
    validateExpanderProperties(properties);
  } else if (type === "Columns") {
    validateColumnsProperties(properties);
  } else if (type === "Rows") {
    validateRowsProperties(properties);
  } else if (type === "Tabs") {
    validateTabsProperties(properties);
  } else if (type === "Form") {
    validateFormProperties(properties);
  } else if (type === "Modal") {
    validateModalProperties(properties);
  } else if (type === "FileUpload") {
    validateFileUploadProperties(properties);
  } else if (type === "DataWindow") {
    validateDataWindowProperties(properties);
  } else if (type === "EditableDataWindow") {
    validateEditableDataWindowProperties(properties);
  } else if (type === "BarChart" || type === "LineChart") {
    validateCartesianChartProperties(properties, type);
  } else if (type === "PieChart") {
    validatePieChartProperties(properties);
  } else if (type === "DonutChart") {
    validateDonutChartProperties(properties);
  } else if (type === "AmoebaStory") {
    validateAmoebaStoryProperties(properties);
  } else if (type === "FlowFieldStory") {
    validateFlowFieldStoryProperties(properties);
  } else if (type === "HeatMapStory") {
    validateHeatMapStoryProperties(properties);
  } else if (type === "HoneycombStory") {
    validateHoneycombStoryProperties(properties);
  } else if (type === "NetworkWebStory") {
    validateNetworkWebStoryProperties(properties);
  } else if (type === "PulseWaveStory") {
    validatePulseWaveStoryProperties(properties);
  } else if (type === "SpiralStory") {
    validateSpiralStoryProperties(properties);
  } else if (type === "TerrainStory") {
    validateTerrainStoryProperties(properties);
  }
}

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

function validateFormProperties(properties: ProjectJsonObject): void {
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

function validateModalProperties(properties: ProjectJsonObject): void {
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

function validateTabsProperties(properties: ProjectJsonObject): void {
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

function validateExpanderProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["sectionTitle", "defaultExpanded"])) {
    throw invalidComponents();
  }

  const sectionTitle = readOptionalTextProperty(properties, "sectionTitle", "Section");
  readOptionalBooleanProperty(properties, "defaultExpanded", false);

  if (sectionTitle.trim() === "" || sectionTitle.length > 500) {
    throw invalidComponents();
  }
}

function validateColumnsProperties(properties: ProjectJsonObject): void {
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

function validateRowsProperties(properties: ProjectJsonObject): void {
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

function validateLabelProperties(properties: ProjectJsonObject): void {
  if (hasUnexpectedProperties(properties, ["text", "fontSize", "bold"])) {
    throw invalidComponents();
  }

  readOptionalTextProperty(properties, "text", "Label Text");
  const fontSize = readOptionalTextProperty(properties, "fontSize", "medium");
  readOptionalBooleanProperty(properties, "bold", false);

  if (!LABEL_FONT_SIZES.has(fontSize)) {
    throw invalidComponents();
  }
}

function validateDropdownProperties(properties: ProjectJsonObject): void {
  if (
    hasUnexpectedProperties(properties, [
      "label",
      "options",
      "defaultValue",
      "disabled",
      "help",
      "placeholder",
      "multiselect",
    ])
  ) {
    throw invalidComponents();
  }

  const label = readOptionalTextProperty(properties, "label", "Select an option");
  const defaultValue = readOptionalTextProperty(properties, "defaultValue", "");
  readOptionalTextProperty(properties, "help", "");
  readOptionalTextProperty(properties, "placeholder", "");
  readOptionalBooleanProperty(properties, "disabled", false);
  const multiselect = readOptionalBooleanProperty(properties, "multiselect", false);
  const options = readDropdownOptions(properties.options);

  if (label.trim() === "" || options.length === 0) {
    throw invalidComponents();
  }

  if (multiselect && defaultValue !== "" && !options.includes(defaultValue)) {
    throw invalidComponents();
  }
}

function readDropdownOptions(value: ProjectJsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    throw invalidComponents();
  }

  return value.map((option) => {
    if (
      !isRecord(option) ||
      hasUnexpectedProperties(option, ["value"]) ||
      typeof option.value !== "string" ||
      option.value.trim() === ""
    ) {
      throw invalidComponents();
    }

    return option.value;
  });
}

function readOptionalTextProperty(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: string,
): string {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalidComponents();
  }

  return value;
}

function readOptionalBooleanProperty(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: boolean,
): boolean {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalidComponents();
  }

  return value;
}

function validateDatePickerProperties(properties: ProjectJsonObject): void {
  if (
    hasUnexpectedProperties(properties, [
      "label",
      "defaultValue",
      "minDate",
      "maxDate",
      "format",
      "help",
      "disabled",
    ])
  ) {
    throw invalidComponents();
  }

  const label = readOptionalTextProperty(properties, "label", "Select Date");
  const defaultValue = readOptionalNullableText(properties, "defaultValue", "today");
  const minDate = readOptionalNullableText(properties, "minDate", "");
  const maxDate = readOptionalNullableText(properties, "maxDate", "");
  const format = readOptionalNullableText(properties, "format", "");
  readOptionalNullableText(properties, "help", "");
  readOptionalNullableBoolean(properties, "disabled", false);

  if (
    label.trim() === "" ||
    (defaultValue !== "" && defaultValue !== "today" && !isIsoDate(defaultValue)) ||
    (minDate !== "" && !isIsoDate(minDate)) ||
    (maxDate !== "" && !isIsoDate(maxDate)) ||
    (format !== "" && !DATE_FORMATS.has(format)) ||
    (minDate !== "" && maxDate !== "" && minDate > maxDate)
  ) {
    throw invalidComponents();
  }
}

function validateTimePickerProperties(properties: ProjectJsonObject): void {
  if (
    hasUnexpectedProperties(properties, [
      "label",
      "defaultValue",
      "step",
      "help",
      "disabled",
    ])
  ) {
    throw invalidComponents();
  }

  const label = readOptionalTextProperty(properties, "label", "Select Time");
  const defaultValue = readOptionalNullableText(properties, "defaultValue", "now");
  const step = readOptionalNullableNumber(properties, "step", 900);
  readOptionalNullableText(properties, "help", "");
  readOptionalNullableBoolean(properties, "disabled", false);

  if (
    label.trim() === "" ||
    (defaultValue !== "" && defaultValue !== "now" && !isIsoTime(defaultValue)) ||
    (step !== null && (!Number.isSafeInteger(step) || step < 1 || step > 82_800))
  ) {
    throw invalidComponents();
  }
}

function validateSliderProperties(properties: ProjectJsonObject): void {
  if (
    hasUnexpectedProperties(properties, [
      "label",
      "minValue",
      "maxValue",
      "defaultValue",
      "upperValue",
      "step",
      "disabled",
      "help",
      "format",
      "ranged",
    ])
  ) {
    throw invalidComponents();
  }

  const label = readOptionalTextProperty(properties, "label", "Slider");
  const minValue = readOptionalNullableNumber(properties, "minValue", DEFAULT_SLIDER_MIN_VALUE);
  const maxValue = readOptionalNullableNumber(properties, "maxValue", DEFAULT_SLIDER_MAX_VALUE);
  const defaultValue = readOptionalNullableNumber(properties, "defaultValue", DEFAULT_SLIDER_VALUE);
  const upperValue = readOptionalNullableNumber(properties, "upperValue", DEFAULT_SLIDER_UPPER_VALUE);
  const step = readOptionalNullableNumber(properties, "step", DEFAULT_SLIDER_STEP);
  readOptionalNullableBoolean(properties, "disabled", false);
  const help = readOptionalNullableText(properties, "help", "");
  const format = readOptionalNullableText(properties, "format", "");
  const ranged = readOptionalNullableBoolean(properties, "ranged", false);
  const hasUpperValue = properties.upperValue !== undefined && properties.upperValue !== null;
  const effectiveMin = minValue ?? DEFAULT_SLIDER_MIN_VALUE;
  const effectiveMax = maxValue ?? DEFAULT_SLIDER_MAX_VALUE;

  if (
    label.trim() === "" ||
    !isValidSliderNumber(minValue) ||
    !isValidSliderNumber(maxValue) ||
    !isValidSliderNumber(defaultValue) ||
    !isValidSliderNumber(upperValue) ||
    !isValidSliderNumber(step) ||
    !isValidSliderFormat(format) ||
    effectiveMin >= effectiveMax ||
    (step !== null && (step <= 0 || step > effectiveMax - effectiveMin)) ||
    (defaultValue !== null && (defaultValue < effectiveMin || defaultValue > effectiveMax)) ||
    (ranged && upperValue !== null && (upperValue < effectiveMin || upperValue > effectiveMax)) ||
    (ranged && defaultValue !== null && upperValue !== null && upperValue < defaultValue) ||
    (ranged && (!hasUpperValue || defaultValue === null || upperValue === null))
  ) {
    throw invalidComponents();
  }
}

function isValidSliderNumber(value: number | null): boolean {
  return value === null ||
    (Number.isFinite(value) && Math.abs(value) <= MAX_SLIDER_VALUE);
}

function isValidSliderFormat(value: string): boolean {
  return value === "" ||
    SLIDER_FORMATS.has(value) ||
    SLIDER_PRINTF_FORMAT_PATTERN.test(value);
}

function readOptionalNullableText(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: string,
): string {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalidComponents();
  }

  return value;
}

function readOptionalNullableBoolean(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: boolean,
): boolean {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalidComponents();
  }

  return value;
}

export function readOptionalNullableNumber(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: number,
): number | null {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number") {
    throw invalidComponents();
  }

  return value;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(value);
}
