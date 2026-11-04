import type { ProjectJsonObject, ProjectJsonValue } from "./project-components-contract.ts";
import { hasUnexpectedProperties, isRecord } from "./project-component-json.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
import {
  readOptionalBooleanProperty,
  readOptionalNullableBoolean,
  readOptionalNullableNumber,
  readOptionalNullableText,
  readOptionalTextProperty,
} from "./project-component-property-readers.ts";
import {
  DATE_FORMATS,
  DEFAULT_SLIDER_MAX_VALUE,
  DEFAULT_SLIDER_MIN_VALUE,
  DEFAULT_SLIDER_STEP,
  DEFAULT_SLIDER_UPPER_VALUE,
  DEFAULT_SLIDER_VALUE,
  LABEL_FONT_SIZES,
  MAX_SLIDER_VALUE,
  SLIDER_FORMATS,
  SLIDER_PRINTF_FORMAT_PATTERN,
} from "./project-component-validation-constants.ts";

export function validateLabelProperties(properties: ProjectJsonObject): void {
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

export function validateDropdownProperties(properties: ProjectJsonObject): void {
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

export function validateDatePickerProperties(properties: ProjectJsonObject): void {
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

export function validateTimePickerProperties(properties: ProjectJsonObject): void {
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

export function validateSliderProperties(properties: ProjectJsonObject): void {
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
