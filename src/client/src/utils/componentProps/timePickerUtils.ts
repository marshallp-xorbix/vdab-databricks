import type { VdabComponent } from "../../types/components";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTimeString = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return TIME_REGEX.test(value);
};

// Validate defaultValue
export const getTimePickerDefaultValueValidationError = (
  component: VdabComponent
): string | undefined => {
  const { defaultValue } = component.props;

  if (defaultValue == null || defaultValue === "") return undefined;

  if (defaultValue === "now" || defaultValue === "None") {
    return undefined;
  }

  if (!isValidTimeString(defaultValue)) {
    return "Default value must be 'now', 'None', or a valid time string (HH:mm).";
  }

  return undefined;
};

// Validate step 
export const isValidStep = (value: unknown): boolean => {
  if (value == null) return true; 
  if (typeof value !== "number") return false;

  return value >= 60 && value <= 82800;
};

export const getTimePickerStepValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidStep(value)) {
    return "Step must be a number between 60 seconds and 82800 seconds.";
  }
  return undefined;
};
