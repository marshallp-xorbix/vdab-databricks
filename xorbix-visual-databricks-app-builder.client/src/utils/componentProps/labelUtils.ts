import type { VdabComponent } from "../../types/components";

export const MAX_LABEL_LENGTH = 1000;

export const normalizeLabel = (label?: string): string | undefined => {
  if (label === undefined) {
    return undefined;
  }

  const trimmedLabel = label.trim();
  return trimmedLabel.length > 0 ? trimmedLabel : undefined;
};

const getLabelForComponent = (component: VdabComponent): string => {
  if (component.props && typeof component.props.label === "string") {
    return component.props.label;
  }
  return "";
};

export const isValidLabel = (label?: string): boolean => {
  return normalizeLabel(label) !== undefined;
};

export const getLabelValidationError = (
  component: VdabComponent
): string | undefined => {
  const label = getLabelForComponent(component);
  const normalizedLabel = normalizeLabel(label);

  if (!normalizedLabel) {
    return "Label is required.";
  }

  if (normalizedLabel.length > MAX_LABEL_LENGTH) {
    return `Label cannot exceed ${MAX_LABEL_LENGTH} characters.`;
  }

  return undefined;
};

export const getLabelInputValidationError = (
  labelInput: string
): string | undefined => {
  const normalizedLabel = normalizeLabel(labelInput);

  if (!normalizedLabel) {
    return "Label is required.";
  }

  if (normalizedLabel.length > MAX_LABEL_LENGTH) {
    return `Label cannot exceed ${MAX_LABEL_LENGTH} characters.`;
  }

  return undefined;
};