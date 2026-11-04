import type { ProjectJsonObject } from "./project-components-contract.ts";
import { invalidComponents } from "./project-component-validation-errors.ts";

export function readOptionalTextProperty(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: string,
): string {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalidComponents();
  }

  return value;
}

export function readOptionalBooleanProperty(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: boolean,
): boolean {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalidComponents();
  }

  return value;
}

export function readOptionalNullableText(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: string,
): string {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalidComponents();
  }

  return value;
}

export function readOptionalNullableBoolean(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: boolean,
): boolean {
  const value = properties[propertyName];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalidComponents();
  }

  return value;
}

export function readOptionalNullableNumber(
  properties: ProjectJsonObject,
  propertyName: string,
  defaultValue: number,
): number | null {
  const value = properties[propertyName];
  if (value === undefined) {
    return defaultValue;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number") {
    throw invalidComponents();
  }

  return value;
}
