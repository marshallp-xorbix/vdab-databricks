import { invalidLabel, invalidSlider } from "./preview-errors.ts";
import { readOptionalBoolean, readOptionalNullableBoolean, readOptionalNullableNumber, readOptionalNullableString, readOptionalString } from "./preview-property-utils.ts";
import type { ProjectJsonObject } from "../db/project-components-contract.ts";
import type { LabelProperties, SliderProperties } from "./preview-models.ts";

const SLIDER_PROPERTIES = new Set([
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
]);
const LABEL_PROPERTIES = new Set(["text", "fontSize", "bold"]);
export const LABEL_FONT_SIZES = new Map([
  ["small", "16px"],
  ["medium", "20px"],
  ["large", "28px"],
]);
const SLIDER_FORMATS = new Set([
  "plain",
  "localized",
  "percent",
  "dollar",
  "euro",
  "yen",
  "compact",
  "scientific",
  "engineering",
  "accounting",
  "bytes",
]);
const SLIDER_PRINTF_FORMAT_PATTERN = /^%\.?\d*[df%]$/;
const DEFAULT_SLIDER_MIN_VALUE = 0;
const DEFAULT_SLIDER_MAX_VALUE = 100;
const DEFAULT_SLIDER_VALUE = 50;
const DEFAULT_SLIDER_UPPER_VALUE = 60;
const DEFAULT_SLIDER_STEP = 1;
const MAX_SLIDER_VALUE = Number.MAX_SAFE_INTEGER;
export function readSliderProperties(value: ProjectJsonObject): SliderProperties {
  if (Object.keys(value).some((key) => !SLIDER_PROPERTIES.has(key))) {
    throw invalidSlider("Slider contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Slider", invalidSlider);
  const minValue = readOptionalNullableNumber(
    value,
    "minValue",
    DEFAULT_SLIDER_MIN_VALUE,
    invalidSlider,
  );
  const maxValue = readOptionalNullableNumber(
    value,
    "maxValue",
    DEFAULT_SLIDER_MAX_VALUE,
    invalidSlider,
  );
  const defaultValue = readOptionalNullableNumber(
    value,
    "defaultValue",
    DEFAULT_SLIDER_VALUE,
    invalidSlider,
  );
  const upperValue = readOptionalNullableNumber(
    value,
    "upperValue",
    DEFAULT_SLIDER_UPPER_VALUE,
    invalidSlider,
  );
  const step = readOptionalNullableNumber(value, "step", DEFAULT_SLIDER_STEP, invalidSlider);
  const disabled = readOptionalNullableBoolean(value, "disabled", false, invalidSlider);
  const help = readOptionalNullableString(value, "help", "", invalidSlider);
  const format = readOptionalNullableString(value, "format", "", invalidSlider);
  const ranged = readOptionalNullableBoolean(value, "ranged", false, invalidSlider);
  const hasUpperValue = value.upperValue !== undefined && value.upperValue !== null;
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
    throw invalidSlider("Slider contains invalid bounds, values, step, or format.");
  }

  return {
    label,
    minValue,
    maxValue,
    defaultValue,
    upperValue,
    step,
    disabled,
    help,
    format,
    ranged,
  };
}

export function readLabelProperties(value: ProjectJsonObject): LabelProperties {
  if (Object.keys(value).some((key) => !LABEL_PROPERTIES.has(key))) {
    throw invalidLabel("Label contains an unsupported property.");
  }

  const text = readOptionalString(value, "text", "Label Text", invalidLabel);
  const fontSize = readOptionalString(value, "fontSize", "medium", invalidLabel);
  const bold = readOptionalBoolean(value, "bold", false, invalidLabel);

  if (fontSize !== "small" && fontSize !== "medium" && fontSize !== "large") {
    throw invalidLabel("Label font size must be small, medium, or large.");
  }

  return { text, fontSize, bold };
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
