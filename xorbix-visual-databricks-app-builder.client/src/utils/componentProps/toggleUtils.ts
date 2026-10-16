import type { VdabComponent } from "../../types/components";

export const isValidToggleDefaultValue = (value: unknown): boolean => {
  return typeof value === "boolean";
};

export const getToggleDefaultValueValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidToggleDefaultValue(value)) {
    return "Toggle defaultValue must be a boolean value.";
  }

  return undefined;
};

const getToggleDefaultValue = (component: VdabComponent): unknown => {
  if (component.props && "defaultValue" in component.props) {
    return component.props.defaultValue;
  }

  return undefined;
};

export const getToggleComponentDefaultValueValidationError = (
  component: VdabComponent
): string | undefined => {
  const defaultValue = getToggleDefaultValue(component);

  if (defaultValue === undefined) {
    return "Toggle defaultValue is required.";
  }

  return getToggleDefaultValueValidationError(defaultValue);
};
