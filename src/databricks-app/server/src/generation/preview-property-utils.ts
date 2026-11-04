import type { ApplicationError } from "../application-error.ts";
import type { ProjectJsonObject, ProjectJsonValue } from "../db/project-components-contract.ts";

export function isProjectJsonObject(value: ProjectJsonValue): value is ProjectJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readOptionalString(
  properties: ProjectJsonObject,
  key: string,
  defaultValue: string,
  invalid: (detail: string) => ApplicationError,
): string {
  const value = properties[key];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalid(`Component property '${key}' must be text.`);
  }

  return value;
}

export function readOptionalBoolean(
  properties: ProjectJsonObject,
  key: string,
  defaultValue: boolean,
  invalid: (detail: string) => ApplicationError,
): boolean {
  const value = properties[key];
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalid(`Component property '${key}' must be true or false.`);
  }

  return value;
}

export function readOptionalNullableString(
  properties: ProjectJsonObject,
  key: string,
  defaultValue: string,
  invalid: (detail: string) => ApplicationError,
): string {
  const value = properties[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw invalid(`Component property '${key}' must be text.`);
  }

  return value;
}

export function readOptionalNullableBoolean(
  properties: ProjectJsonObject,
  key: string,
  defaultValue: boolean,
  invalid: (detail: string) => ApplicationError,
): boolean {
  const value = properties[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw invalid(`Component property '${key}' must be true or false.`);
  }

  return value;
}

export function readOptionalNullableNumber(
  properties: ProjectJsonObject,
  key: string,
  defaultValue: number,
  invalid: (detail: string) => ApplicationError,
): number | null {
  const value = properties[key];
  if (value === undefined) {
    return defaultValue;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number") {
    throw invalid(`Component property '${key}' must be a number.`);
  }

  return value;
}

