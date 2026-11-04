import type { VdabComponent } from "../../types/components";

export const isValidDefaultChecked = (value: unknown): boolean => {
  return typeof value === "boolean";
};

export const getDefaultCheckedValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidDefaultChecked(value)) {
    return "defaultChecked must be a boolean value.";
  }

  return undefined;
};

const getCheckboxDefaultChecked = (component: VdabComponent): any => {
  if (component.props && "defaultChecked" in component.props) {
    return component.props.defaultChecked;
  }

  return undefined;
};

export const getCheckboxDefaultCheckedValidationError = (
  component: VdabComponent
): string | undefined => {
  const defaultCheckedValue = getCheckboxDefaultChecked(component);

  if (defaultCheckedValue === undefined) {
    return "Checkbox defaultChecked is required.";
  }

  return getDefaultCheckedValidationError(defaultCheckedValue);
};
