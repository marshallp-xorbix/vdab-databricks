import { ApplicationError } from "./application-error.ts";

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
