import type { VdabComponent } from "../../types/components";
const PRINTF_REGEX = /%\.?\d*[df%]$/;
const PREDEFINED_FORMATS = new Set([
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

export const isValidSliderRanged = (value: unknown): boolean => {
  return typeof value === "boolean";
};

export const getSliderRangedValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidSliderRanged(value)) {
    return "Slider ranged must be a boolean value.";
  }

  return undefined;
};

export const isValidSliderNumber = (value:unknown): boolean => {
    return typeof value === "number";
}

export const getSliderMinValidationError = (component: VdabComponent): string | undefined => {
    const minValue = component.props.minValue as number;
    const maxValue = component.props.maxValue as number;
    if (!isValidSliderNumber(minValue)) {
        return "Slider min must be a number.";
    }
    if (minValue > maxValue) {
        return "Slider min must be less than max.";
    }
    return undefined;
}

export const getSliderMaxValidationError = (component: VdabComponent): string | undefined => {
    const minValue = component.props.minValue as number;
    const maxValue = component.props.maxValue as number;
    if (!isValidSliderNumber(maxValue)) {
        return "Slider max must be a number.";
    }
    if (minValue > maxValue) {
        return "Slider max must be greater than min.";
    }
    return undefined;
}

export const getSliderStepValidationError = (component: VdabComponent): string | undefined => {
    const stepValue = component.props.step as number;
    const minValue = component.props.minValue as number;
    const maxValue = component.props.maxValue as number;
    if (!isValidSliderNumber(stepValue)) {
        return "Slider step must be a number.";
    }
    if (stepValue <= 0) {
        return "Slider step must be greater than 0.";
    }
    if (stepValue > (maxValue - minValue)) {
        return "Slider step must be less than the difference between max and min.";
    }
    return undefined;
}

export const getSliderDefaultValueValidationError = (component: VdabComponent): string | undefined => {
    const defaultValue = component.props.defaultValue as number;
    const minValue = component.props.minValue as number;
    const maxValue = component.props.maxValue as number;
    if (!isValidSliderNumber(defaultValue)) {
        return "Slider defaultValue must be a number.";
    }
    if (defaultValue < minValue || defaultValue > maxValue) {
        return "Slider defaultValue must be between min and max.";
    }
    return undefined;
}

export const getSliderUpperValueValidationError = (component: VdabComponent): string | undefined => {
    const upperValue = component.props.upperValue as number;
    const minValue = component.props.minValue as number;
    const maxValue = component.props.maxValue as number;
    const defaultValue = component.props.defaultValue as number;
    if (!isValidSliderNumber(upperValue)) {
        return "Slider upper Value must be a number.";
    }
    if (upperValue < minValue || upperValue > maxValue) {
        return "Slider upper Value must be between min and max.";
    }
    if (upperValue < defaultValue) {
        return "Slider upper Value must be greater than lower Value.";
    }
    return undefined;
}

const isValidFormat = (format: unknown): boolean => {
  if (format == null || format === "") return true;
  if (typeof format !== "string") return false;
  if (PREDEFINED_FORMATS.has(format)) return true;
  return PRINTF_REGEX.test(format);
};

export const getSliderFormatValidationError = (value: unknown): string | undefined => {
  if (!isValidFormat(value)) {
    return "Slider format must be a valid predefined format or a printf-style format string.";
  }
  return undefined;
}