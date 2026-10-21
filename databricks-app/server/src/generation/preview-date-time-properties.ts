import { invalidDatePicker, invalidTimePicker } from "./preview-errors.ts";
import { readOptionalNullableBoolean, readOptionalNullableNumber, readOptionalNullableString, readOptionalString } from "./preview-property-utils.ts";
import type { ProjectJsonObject } from "../db/project-components-contract.ts";
import type { DatePickerProperties, TimePickerProperties } from "./preview-models.ts";

const DATE_PICKER_PROPERTIES = new Set([
  "label",
  "defaultValue",
  "minDate",
  "maxDate",
  "format",
  "help",
  "disabled",
]);
const TIME_PICKER_PROPERTIES = new Set([
  "label",
  "defaultValue",
  "step",
  "help",
  "disabled",
]);

const DATE_FORMATS = new Set([
  "YYYY/MM/DD",
  "YYYY.MM.DD",
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "DD.MM.YYYY",
  "DD-MM-YYYY",
  "MM/DD/YYYY",
  "MM.DD.YYYY",
  "MM-DD-YYYY",
]);

export function readDatePickerProperties(value: ProjectJsonObject): DatePickerProperties {
  if (Object.keys(value).some((key) => !DATE_PICKER_PROPERTIES.has(key))) {
    throw invalidDatePicker("DatePicker contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Select Date", invalidDatePicker);
  const defaultValue = readOptionalNullableString(
    value,
    "defaultValue",
    "today",
    invalidDatePicker,
  );
  const minDate = readOptionalNullableString(value, "minDate", "", invalidDatePicker);
  const maxDate = readOptionalNullableString(value, "maxDate", "", invalidDatePicker);
  const format = readOptionalNullableString(value, "format", "", invalidDatePicker);

  if (label.trim() === "") {
    throw invalidDatePicker("DatePicker requires a non-empty label.");
  }

  if (
    (defaultValue !== "" && defaultValue !== "today" && !isIsoDate(defaultValue)) ||
    (minDate !== "" && !isIsoDate(minDate)) ||
    (maxDate !== "" && !isIsoDate(maxDate)) ||
    (format !== "" && !DATE_FORMATS.has(format)) ||
    (minDate !== "" && maxDate !== "" && minDate > maxDate)
  ) {
    throw invalidDatePicker("DatePicker contains an invalid date, bound, or format.");
  }

  return {
    label,
    defaultValue,
    minDate,
    maxDate,
    format,
    help: readOptionalNullableString(value, "help", "", invalidDatePicker),
    disabled: readOptionalNullableBoolean(value, "disabled", false, invalidDatePicker),
  };
}

export function readTimePickerProperties(value: ProjectJsonObject): TimePickerProperties {
  if (Object.keys(value).some((key) => !TIME_PICKER_PROPERTIES.has(key))) {
    throw invalidTimePicker("TimePicker contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Select Time", invalidTimePicker);
  const defaultValue = readOptionalNullableString(
    value,
    "defaultValue",
    "now",
    invalidTimePicker,
  );
  const step = readOptionalNullableNumber(value, "step", 900, invalidTimePicker);

  if (label.trim() === "") {
    throw invalidTimePicker("TimePicker requires a non-empty label.");
  }

  if (
    (defaultValue !== "" && defaultValue !== "now" && !isIsoTime(defaultValue)) ||
    (step !== null && (!Number.isSafeInteger(step) || step < 1 || step > 82_800))
  ) {
    throw invalidTimePicker("TimePicker contains an invalid time or step.");
  }

  return {
    label,
    defaultValue,
    step,
    help: readOptionalNullableString(value, "help", "", invalidTimePicker),
    disabled: readOptionalNullableBoolean(value, "disabled", false, invalidTimePicker),
  };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isIsoTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(value);
}
