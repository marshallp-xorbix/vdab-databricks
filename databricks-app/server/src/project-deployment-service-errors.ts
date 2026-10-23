import { MAX_APPS_PER_WORKSPACE } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

/** Checks whether a project role can change or deploy its child App. */
export function canEditProjectDeployment(role: string): boolean {
  return role === "owner" || role === "editor" || role === "installationAdmin";
}

/** Requires a project role that can change or deploy its child App. */
export function requireProjectDeploymentEditor(role: string): void {
  if (!canEditProjectDeployment(role)) {
    throw new ApplicationError(
      403,
      "project_edit_permission_required",
      "Project edit permission required",
      "Only project editors can deploy this child App.",
    );
  }
}

/** Converts an unknown failure into a bounded deployment status code. */
export function readProjectDeploymentFailureCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 128);
  }
  return "workspace_deployment_failed";
}

export function childAppTargetConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_target_conflict",
    "Project child App cannot be changed",
    "This project is already linked to a different Databricks App. Create a separate project to target another App.",
  );
}

export function childAppNameConflict(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_name_conflict",
    "App name is already in use",
    "The selected name is already in use by an App that is not linked to this VDAB deployment. Choose another name or use Link existing.",
  );
}

export function childAppMissing(): ApplicationError {
  return new ApplicationError(
    404,
    "child_app_not_found",
    "Databricks App not found",
    "The selected child App is no longer available in the installed workspace.",
  );
}

export function childAppMarkerMissing(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_recovery_marker_missing",
    "Child App recovery needs review",
    "VDAB cannot verify ownership of the interrupted App creation. Link the target manually after reviewing its details.",
  );
}

export function childAppIdentityUnavailable(): ApplicationError {
  return new ApplicationError(
    502,
    "child_app_identity_unavailable",
    "Databricks App identity unavailable",
    "Databricks did not return the identifier required to safely track the created App.",
  );
}

export function childAppIdentityChanged(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_identity_changed",
    "Linked Databricks App changed",
    "The workspace App identifier no longer matches this project's saved link. Review the target before deploying.",
  );
}

export function childAppSpaceMismatch(
  expectedSpaceName: string | null,
): ApplicationError {
  const expectedSpace = expectedSpaceName ?? "the default workspace scope";
  return new ApplicationError(
    409,
    "child_app_space_mismatch",
    "Child App belongs to a different App Space",
    `Link the App in ${expectedSpace} to keep the child App within the installed VDAB App's workspace policy.`,
  );
}

export function overwriteConfirmationRequired(): ApplicationError {
  return new ApplicationError(
    400,
    "deployment_overwrite_confirmation_required",
    "Confirm App replacement",
    "Confirm that deploying will replace the selected child App's current source code.",
  );
}

export function workspaceAppLimitReached(): ApplicationError {
  return new ApplicationError(
    409,
    "workspace_app_limit_reached",
    "Workspace App limit reached",
    `This workspace has reached Databricks' limit of ${MAX_APPS_PER_WORKSPACE} Apps. Remove an unused App or use Link existing.`,
  );
}

export function missingChildAppScopes(scopes: string[]): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_scopes_missing",
    "Child App authorization scopes are missing",
    `Add these user authorization scopes to the selected App before deploying: ${scopes.join(", ")}.`,
  );
}

export function childAppScopePolicyUnavailable(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_scope_policy_unavailable",
    "Child App authorization policy could not be verified",
    "Databricks did not return the effective user authorization scopes for this App Space. Confirm the space policy and retry after the workspace returns its effective scope list.",
  );
}

export function missingChildAppResources(): ApplicationError {
  return new ApplicationError(
    409,
    "child_app_resources_missing",
    "Child App resources do not match",
    "The selected App must already have exactly the required Lakebase and SQL warehouse resources. VDAB left the App configuration unchanged; update its resources in Databricks, then retry.",
  );
}

export function gitSourceNotSupported(): ApplicationError {
  return new ApplicationError(
    409,
    "git_source_deployment_not_supported",
    "Git-backed App cannot be replaced safely",
    "This deployment publishes an immutable workspace source folder. Linking a Git-backed App can replace its source mode and remove Git credentials, so it was left unchanged. Use a workspace-source App or publish the generated source through its Git provider.",
  );
}

export function deploymentNotFound(): ApplicationError {
  return new ApplicationError(
    404,
    "deployment_not_found",
    "Deployment not found",
    "The requested deployment does not exist or is not available to you.",
  );
}
