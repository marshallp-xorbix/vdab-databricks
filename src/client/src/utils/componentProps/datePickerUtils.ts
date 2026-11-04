import type { VdabComponent } from "../../types/components";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isValidISODateString = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  if (value.toLowerCase() === "today") return true;
  if (!ISO_DATE_REGEX.test(value)) return false;

  const parsed = new Date(value);
  return !isNaN(parsed.getTime());
};

const parseISODate = (value: string): Date => {
  return new Date(value);
};

// default value validation
export const getDatePickerDefaultValueValidationError = (
  component: VdabComponent
): string | undefined => {
  const defaultValue = component.props.defaultValue as string;
  const minDate = component.props.minDate as string;
  const maxDate = component.props.maxDate as string;

  if (defaultValue == null || defaultValue === "") return undefined;

  if (!isValidISODateString(defaultValue)) {
    return "Default value must be a valid ISO date string (YYYY-MM-DD) or \"today\".";
  }

  const defaultDate = parseISODate(defaultValue);

  if (minDate && isValidISODateString(minDate)) {
    const min = parseISODate(minDate);
    if (defaultDate < min) {
      return "Default value must be greater than or equal to minDate.";
    }
  }

  if (maxDate && isValidISODateString(maxDate)) {
    const max = parseISODate(maxDate);
    if (defaultDate > max) {
      return "Default value must be less than or equal to maxDate.";
    }
  }

  return undefined;
};

// Min Date Validation
export const getDatePickerMinDateValidationError = (
  component: VdabComponent
): string | undefined => {
  const minDate = component.props.minDate as string;
  const maxDate = component.props.maxDate as string;

  if (!minDate) return undefined;

  if (!isValidISODateString(minDate)) {
    return "Min date must be a valid ISO date string (YYYY-MM-DD) or \"today\".";
  }

  if (maxDate && isValidISODateString(maxDate)) {
    const min = parseISODate(minDate);
    const max = parseISODate(maxDate);

    if (min >= max) {
      return "Min date must be less than max date.";
    }
  }

  return undefined;
};

// Max Date Validation
export const getDatePickerMaxDateValidationError = (
  component: VdabComponent
): string | undefined => {
  const minDate = component.props.minDate as string;
  const maxDate = component.props.maxDate as string;

  if (!maxDate) return undefined;

  if (!isValidISODateString(maxDate)) {
    return "Max date must be a valid ISO date string (YYYY-MM-DD) or \"today\".";
  }

  if (minDate && isValidISODateString(minDate)) {
    const min = parseISODate(minDate);
    const max = parseISODate(maxDate);

    if (max <= min) {
      return "Max date must be greater than min date.";
    }
  }

  return undefined;
};

// format validation
const DATE_FORMAT_REGEX = /^(YYYY|DD|MM)([\/.-])(YYYY|DD|MM)\2(YYYY|DD|MM)$/;
const isValidDateFormat = (value: unknown): boolean => {
  if (value == null || value === "") return true;
  if (typeof value !== "string") return false;

  const match = value.match(DATE_FORMAT_REGEX);
  if (!match) return false;

  const [, part1, separator, part2, part3] = match;

  const parts = [part1, part2, part3];
  const required = ["YYYY", "MM", "DD"];

  return required.every((r) => parts.includes(r));
};

export const getDatePickerFormatValidationError = (
  value: unknown
): string | undefined => {
  if (!isValidDateFormat(value)) {
    return "Date format must be one of YYYY/MM/DD, DD/MM/YYYY, or MM/DD/YYYY using '/', '-', or '.' separators.";
  }
  return undefined;
};
