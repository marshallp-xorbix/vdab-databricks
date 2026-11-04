import type { VdabComponent } from "../../types/components";

export const MAX_OPTION_VALUE_LENGTH = 255;
export const MIN_OPTIONS_REQUIRED = 1;

export interface DropdownOption {
  value: string;
  label?: string;
}
// dropdown validation
export const isValidOption = (option: DropdownOption | unknown): boolean => {
  if (!option || typeof option !== "object") {
    return false;
  }

  const opt = option as DropdownOption;
  if (typeof opt.value !== "string") {
    return false;
  }

  const trimmedValue = opt.value.trim();
  return trimmedValue.length > 0 && trimmedValue.length <= MAX_OPTION_VALUE_LENGTH;
};

export const normalizeOption = (option: DropdownOption | unknown): DropdownOption | undefined => {
  if (!isValidOption(option)) {
    return undefined;
  }

  const opt = option as DropdownOption;
  const trimmedValue = opt.value.trim();
  const trimmedLabel = opt.label?.trim();

  return {
    value: trimmedValue,
    label: trimmedLabel && trimmedLabel.length > 0 ? trimmedLabel : undefined,
  };
};

export const getOptionValidationError = (
  option: DropdownOption | unknown,
  index?: number
): string | undefined => {
  if (!option || typeof option !== "object") {
    const context = index !== undefined ? ` at index ${index}` : "";
    return `Option${context} is missing or invalid.`;
  }

  const opt = option as DropdownOption;

  if (typeof opt.value !== "string") {
    const context = index !== undefined ? ` at index ${index}` : "";
    return `Option value${context} must be a string.`;
  }

  const trimmedValue = opt.value.trim();

  if (trimmedValue.length === 0) {
    const context = index !== undefined ? ` at index ${index}` : "";
    return `Option value${context} cannot be empty.`;
  }

  if (trimmedValue.length > MAX_OPTION_VALUE_LENGTH) {
    const context = index !== undefined ? ` at index ${index}` : "";
    return `Option value${context} cannot exceed ${MAX_OPTION_VALUE_LENGTH} characters.`;
  }

  return undefined;
};

const getDropdownOptions = (component: VdabComponent): DropdownOption[] => {
  if (component.props && Array.isArray(component.props.options)) {
    return component.props.options;
  }
  return [];
};

export const isValidOptionsArray = (options: unknown): boolean => {
  if (!Array.isArray(options)) {
    return false;
  }

  if (options.length < MIN_OPTIONS_REQUIRED) {
    return false;
  }

  return options.every((opt) => isValidOption(opt));
};

export const getOptionsArrayValidationError = (options: unknown): string | undefined => {
  if (!Array.isArray(options)) {
    return "Options must be an array.";
  }

  if (options.length < MIN_OPTIONS_REQUIRED) {
    return `At least ${MIN_OPTIONS_REQUIRED} option is required.`;
  }

  for (let i = 0; i < options.length; i++) {
    const error = getOptionValidationError(options[i], i);
    if (error) {
      return error;
    }
  }

  return undefined;
};

export const getDuplicateOptionValues = (options: DropdownOption[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  options.forEach((opt) => {
    if (!isValidOption(opt)) {
      return;
    }

    const trimmedValue = (opt as DropdownOption).value.trim();
    if (seen.has(trimmedValue)) {
      duplicates.add(trimmedValue);
    } else {
      seen.add(trimmedValue);
    }
  });

  return Array.from(duplicates);
};

export const getDropdownOptionsValidationError = (
  component: VdabComponent
): string | undefined => {
  const multiselectError = getDropdownMultiselectValidationError(component);
  if (multiselectError) {
    return multiselectError;
  }

  const options = getDropdownOptions(component);

  const arrayError = getOptionsArrayValidationError(options);
  if (arrayError) {
    return arrayError;
  }

  const duplicates = getDuplicateOptionValues(options);
  if (duplicates.length > 0) {
    return `Duplicate option values found: ${duplicates.join(", ")}`;
  }

  return undefined;
};

export const getDropdownOptionsInputValidationError = (options: unknown): string | undefined => {
  const arrayError = getOptionsArrayValidationError(options);
  if (arrayError) {
    return arrayError;
  }

  if (!Array.isArray(options)) {
    return undefined;
  }

  const duplicates = getDuplicateOptionValues(options as DropdownOption[]);
  if (duplicates.length > 0) {
    return `Duplicate values: ${duplicates.join(", ")}`;
  }

  return undefined;
};

export const normalizeOptionsArray = (options: unknown): DropdownOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((opt) => normalizeOption(opt))
    .filter((opt): opt is DropdownOption => opt !== undefined);
};
// multiselect validation
export const isValidMultiselect = (value: unknown): boolean => {
  return typeof value === "boolean";
};

export const getMultiselectValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidMultiselect(value)) {
    return "Multiselect must be a boolean value.";
  }
  return undefined;
};

export const getDropdownMultiselectValidationError = (
  component: VdabComponent
): string | undefined => {
  if (!component.props || component.props.multiselect === undefined) {
    return "Dropdown multiselect is required.";
  }

  return getMultiselectValidationError(component.props.multiselect);
};
// default value validation
export const isValidDropdownDefaultValue = (value: unknown, options: DropdownOption[]): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  return options.some((opt) => opt.value === value);
};

export const getDropdownDefaultValueValidationError = (
  value: unknown,
  options: DropdownOption[]
): string | undefined => {
  if (!isValidDropdownDefaultValue(value, options)) {
    return "Default value must be one of the available options or None.";
  }
  return undefined;
};
