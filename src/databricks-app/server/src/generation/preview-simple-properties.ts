import { invalidBooleanControl, invalidButton, invalidDropdown, invalidTextInput } from "./preview-errors.ts";
import { isProjectJsonObject, readOptionalBoolean, readOptionalString } from "./preview-property-utils.ts";
import type { ProjectJsonObject, ProjectJsonValue } from "../db/project-components-contract.ts";
import type { BooleanControlProperties, ButtonProperties, DropdownProperties, TextInputProperties } from "./preview-models.ts";

const SUPPORTED_TEXT_INPUT_PROPERTIES = new Set([
  "label",
  "placeholder",
  "defaultValue",
  "help",
  "disabled",
  "type",
  "multiline",
  "height",
]);
const SUPPORTED_BUTTON_PROPERTIES = new Set([
  "label",
  "variant",
  "disabled",
  "help",
]);
const CHECKBOX_PROPERTIES = new Set([
  "label",
  "defaultChecked",
  "help",
  "disabled",
]);
const TOGGLE_PROPERTIES = new Set([
  "label",
  "defaultValue",
  "help",
  "disabled",
]);
const DROPDOWN_PROPERTIES = new Set([
  "label",
  "options",
  "defaultValue",
  "disabled",
  "help",
  "placeholder",
  "multiselect",
]);

export function readTextInputProperties(value: ProjectJsonObject): TextInputProperties {
  if (Object.keys(value).some((key) => !SUPPORTED_TEXT_INPUT_PROPERTIES.has(key))) {
    throw invalidTextInput("TextInput contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Label", invalidTextInput);
  if (label.trim() === "") {
    throw invalidTextInput("TextInput requires a non-empty label.");
  }

  const inputType = readOptionalString(value, "type", "default", invalidTextInput);
  if (inputType !== "default" && inputType !== "password") {
    throw invalidTextInput("TextInput type must be default or password.");
  }

  return {
    label,
    placeholder: readOptionalString(value, "placeholder", "", invalidTextInput),
    defaultValue: readOptionalString(value, "defaultValue", "", invalidTextInput),
    help: readOptionalString(value, "help", "", invalidTextInput),
    disabled: readOptionalBoolean(value, "disabled", false, invalidTextInput),
    type: inputType,
    multiline: readOptionalBoolean(value, "multiline", false, invalidTextInput),
    height: readOptionalString(value, "height", "", invalidTextInput),
  };
}

export function readButtonProperties(value: ProjectJsonObject): ButtonProperties {
  if (Object.keys(value).some((key) => !SUPPORTED_BUTTON_PROPERTIES.has(key))) {
    throw invalidButton("Button contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Click Me", invalidButton);
  if (label.trim() === "") {
    throw invalidButton("Button requires a non-empty label.");
  }

  const variant = readOptionalString(value, "variant", "primary", invalidButton);
  if (variant !== "" && variant !== "primary" && variant !== "secondary") {
    throw invalidButton("Button variant must be primary or secondary.");
  }

  return {
    label,
    variant,
    disabled: readOptionalBoolean(value, "disabled", false, invalidButton),
    help: readOptionalString(value, "help", "", invalidButton),
  };
}

export function readBooleanControlProperties(
  properties: ProjectJsonObject,
  componentType: "Checkbox" | "Toggle",
): BooleanControlProperties {
  const allowedProperties = componentType === "Checkbox"
    ? CHECKBOX_PROPERTIES
    : TOGGLE_PROPERTIES;
  if (Object.keys(properties).some((key) => !allowedProperties.has(key))) {
    throw invalidBooleanControl(`${componentType} contains an unsupported property.`);
  }

  const defaultPropertyName = componentType === "Checkbox"
    ? "defaultChecked"
    : "defaultValue";
  const label = readOptionalString(
    properties,
    "label",
    componentType,
    invalidBooleanControl,
  );

  if (label.trim() === "") {
    throw invalidBooleanControl(`${componentType} requires a non-empty label.`);
  }

  return {
    label,
    defaultValue: readOptionalBoolean(
      properties,
      defaultPropertyName,
      false,
      invalidBooleanControl,
    ),
    help: readOptionalString(properties, "help", "", invalidBooleanControl),
    disabled: readOptionalBoolean(
      properties,
      "disabled",
      false,
      invalidBooleanControl,
    ),
  };
}

export function readDropdownProperties(value: ProjectJsonObject): DropdownProperties {
  if (Object.keys(value).some((key) => !DROPDOWN_PROPERTIES.has(key))) {
    throw invalidDropdown("Dropdown contains an unsupported property.");
  }

  const label = readOptionalString(value, "label", "Select an option", invalidDropdown);
  const options = readDropdownOptions(value.options);
  const defaultValue = readOptionalString(value, "defaultValue", "", invalidDropdown);

  if (label.trim() === "") {
    throw invalidDropdown("Dropdown requires a non-empty label.");
  }

  if (options.length === 0) {
    throw invalidDropdown("Dropdown requires at least one option.");
  }

  const multiselect = readOptionalBoolean(value, "multiselect", false, invalidDropdown);
  if (multiselect && defaultValue !== "" && !options.includes(defaultValue)) {
    throw invalidDropdown("Dropdown default value must match an option.");
  }

  return {
    label,
    options,
    defaultValue,
    disabled: readOptionalBoolean(value, "disabled", false, invalidDropdown),
    help: readOptionalString(value, "help", "", invalidDropdown),
    placeholder: readOptionalString(value, "placeholder", "", invalidDropdown),
    multiselect,
  };
}

function readDropdownOptions(value: ProjectJsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    throw invalidDropdown("Dropdown options must be an array.");
  }

  return value.map((option, index) => readDropdownOption(option, index));
}

function readDropdownOption(value: ProjectJsonValue, index: number): string {
  if (!isProjectJsonObject(value) || Object.keys(value).length !== 1 || !("value" in value)) {
    throw invalidDropdown(`Dropdown option ${index + 1} must contain only a value.`);
  }

  const optionValue = value.value;
  if (typeof optionValue !== "string" || optionValue.trim() === "") {
    throw invalidDropdown(`Dropdown option ${index + 1} requires a non-empty text value.`);
  }

  return optionValue;
}
