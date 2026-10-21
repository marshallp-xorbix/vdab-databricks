import { ApplicationError } from "../application-error.ts";
import type { ProjectCustomModulesInput } from "./project-custom-modules-contract.ts";

const MAX_CUSTOM_MODULE_SOURCE_LENGTH = 256_000;
const SOURCE_ASSIGNMENT_SECRET_PATTERN = /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*=\s*(['"])(?:(?!\1)[^\r\n]){12,}\1/i;
const BEARER_SECRET_PATTERN = /\bBearer\s+[A-Za-z0-9._~-]{20,}/i;
const DATABRICKS_TOKEN_PATTERN = /\bdapi[a-f0-9]{32}\b/i;

/** Validates an untrusted custom-module save request. */
export function readProjectCustomModulesInput(value: unknown): ProjectCustomModulesInput {
  if (!isRecord(value) || !hasExactKeys(value, ["expectedVersion", "source"])) {
    throw invalidCustomModules("Custom module requests must contain only version and source.");
  }
  if (!isPositiveInteger(value.expectedVersion)) {
    throw invalidCustomModules("A positive project version is required.");
  }
  if (typeof value.source !== "string" || value.source.length > MAX_CUSTOM_MODULE_SOURCE_LENGTH) {
    throw invalidCustomModules("Custom Python source must be text no longer than 256,000 characters.");
  }
  if (
    SOURCE_ASSIGNMENT_SECRET_PATTERN.test(value.source) ||
    BEARER_SECRET_PATTERN.test(value.source) ||
    DATABRICKS_TOKEN_PATTERN.test(value.source)
  ) {
    throw new ApplicationError(
      422,
      "custom_modules_secret_detected",
      "Secret-like value detected",
      "Remove credentials and secret values from custom Python before saving it.",
    );
  }

  return { expectedVersion: value.expectedVersion, source: value.source };
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidCustomModules(detail: string): ApplicationError {
  return new ApplicationError(400, "invalid_custom_modules", "Invalid custom modules", detail);
}
