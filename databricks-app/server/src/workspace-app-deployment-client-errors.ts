import { ApplicationError } from "./application-error.ts";
import {
  MAX_WORKSPACE_JSON_RESPONSE_BYTES,
  readBoundedJsonResponse,
} from "./bounded-json-response.ts";

/** Reads only a machine error code, excluding upstream messages and resource values. */
export async function readDatabricksErrorCode(
  response: Response,
): Promise<string> {
  try {
    const value: unknown = await readBoundedJsonResponse(
      response,
      MAX_WORKSPACE_JSON_RESPONSE_BYTES,
    );
    if (
      typeof value === "object" &&
      value !== null &&
      "error_code" in value &&
      typeof value.error_code === "string" &&
      /^[A-Z_]{1,80}$/.test(value.error_code)
    )
      return value.error_code;
  } catch {
    // Malformed error bodies remain a sanitized request failure.
  }
  return "UNKNOWN";
}

/** Returns a stable conflict when a workspace App name already exists. */
export function appNameConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_name_conflict",
    "App name is already in use",
    "Choose a different name or link the existing workspace App after reviewing its current deployment.",
  );
}

/** Returns a validation error for an invalid deployment identifier. */
export function invalidDeploymentId(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_deployment_id",
    "Invalid deployment",
    "The deployment identifier is invalid.",
  );
}

/** Returns a validation error for generated source that cannot be deployed. */
export function invalidSourceBundle(): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_generated_source",
    "Generated source cannot be deployed",
    "The generated source tree is invalid or exceeds the supported size limits.",
  );
}

/** Returns a sanitized error for malformed upstream App responses. */
export function invalidDatabricksResponse(): ApplicationError {
  return new ApplicationError(
    502,
    "databricks_invalid_response",
    "Invalid Databricks response",
    "Databricks returned an invalid child App response.",
  );
}
