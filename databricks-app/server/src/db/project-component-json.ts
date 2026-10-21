import { PROJECT_COMPONENT_TYPES, type ProjectComponent, type ProjectJsonObject, type ProjectJsonValue } from "./project-components-contract.ts";
import { COMPONENT_CODE_NAME_PATTERN, COMPONENT_KEY_PATTERN, MAX_COMPONENT_DEPTH, UNSAFE_PROPERTY_PATTERN } from "./project-component-validation-constants.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";
export function readComponentKey(value: unknown): string {
  if (typeof value !== "string" || !COMPONENT_KEY_PATTERN.test(value)) {
    throw invalidComponents();
  }

  return value;
}

export function readComponentType(value: unknown): ProjectComponent["type"] {
  if (
    typeof value !== "string" ||
    !PROJECT_COMPONENT_TYPES.some((componentType) => componentType === value)
  ) {
    throw invalidComponents();
  }

  return value as ProjectComponent["type"];
}

export function readPositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw invalidComponents();
  }

  return value as number;
}

export function readNullableText(
  value: unknown,
  pattern?: RegExp,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    (pattern !== undefined && !pattern.test(value))
  ) {
    throw invalidComponents();
  }

  return value;
}

export function readChildKeys(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((childKey) => typeof childKey !== "string")) {
    throw invalidComponents();
  }

  return value.map(readComponentKey);
}

export function readJsonObject(value: unknown): ProjectJsonObject {
  if (!isRecord(value)) {
    throw invalidComponents();
  }

  validateJsonValue(value, 0);
  return value as ProjectJsonObject;
}

function validateJsonValue(value: unknown, depth: number): asserts value is ProjectJsonValue {
  if (depth > MAX_COMPONENT_DEPTH) {
    throw invalidComponents();
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((childValue) => validateJsonValue(childValue, depth + 1));
    return;
  }

  if (!isRecord(value)) {
    throw invalidComponents();
  }

  for (const [propertyName, childValue] of Object.entries(value)) {
    if (UNSAFE_PROPERTY_PATTERN.test(propertyName)) {
      throw invalidComponents();
    }

    validateJsonValue(childValue, depth + 1);
  }
}

export function hasUnexpectedProperties(
  value: Record<string, unknown>,
  allowedProperties: string[],
): boolean {
  return Object.keys(value).some(
    (propertyName) => !allowedProperties.includes(propertyName),
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
