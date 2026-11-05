import type { WorkspaceAppResource } from "./contracts.ts";
import { MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH } from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

/** Validates supported resources before the Apps API mutation. */
export function validateWorkspaceAppResources(
  resources: WorkspaceAppResource[],
): WorkspaceAppResource[] {
  if (
    resources.length > 100 ||
    new Set(resources.map((resource) => resource.name)).size !==
      resources.length
  ) {
    throw invalidDeploymentResource();
  }
  for (const resource of resources) validateWorkspaceAppResource(resource);
  return resources;
}

/** Compares the complete set of VDAB-managed App resource bindings. */
export function hasExactWorkspaceAppResources(
  existing: WorkspaceAppResource[],
  required: WorkspaceAppResource[],
): boolean {
  return (
    existing.length === required.length &&
    required.every((requiredResource) =>
      existing.some((existingResource) =>
        sameWorkspaceAppResource(existingResource, requiredResource),
      ),
    )
  );
}

/** Checks that every project-required binding remains in an edited grant set. */
export function containsWorkspaceAppResources(
  resources: WorkspaceAppResource[],
  required: WorkspaceAppResource[],
): boolean {
  return required.every((requiredResource) =>
    resources.some((resource) =>
      sameWorkspaceAppResource(resource, requiredResource),
    ),
  );
}

function validateWorkspaceAppResource(resource: WorkspaceAppResource): void {
  if (
    !/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(resource.name) ||
    resource.description.length > 50 ||
    /[\u0000-\u001f\u007f]/.test(resource.description)
  ) {
    throw invalidDeploymentResource();
  }
  if ("postgres" in resource) {
    if (
      (resource.postgres.branch !== undefined &&
        (!/^projects\/[A-Za-z0-9_-]{1,128}\/branches\/[A-Za-z0-9_-]{1,128}$/.test(resource.postgres.branch) ||
          !resource.postgres.database.startsWith(`${resource.postgres.branch}/databases/`))) ||
      !/^projects\/[A-Za-z0-9_-]{1,128}\/branches\/[A-Za-z0-9_-]{1,128}\/databases\/[A-Za-z0-9_-]{1,128}$/.test(
        resource.postgres.database,
      ) ||
      resource.postgres.permission !== "CAN_CONNECT_AND_CREATE"
    ) {
      throw invalidDeploymentResource();
    }
    return;
  }
  if ("sql_warehouse" in resource) {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(resource.sql_warehouse.id) ||
      !["CAN_USE", "CAN_MANAGE", "IS_OWNER"].includes(
        resource.sql_warehouse.permission,
      )
    ) {
      throw invalidDeploymentResource();
    }
    return;
  }
  if ("secret" in resource) {
    if (
      !isValidSecretIdentifier(resource.secret.scope) ||
      !isValidSecretIdentifier(resource.secret.key) ||
      !["READ", "WRITE", "MANAGE"].includes(resource.secret.permission)
    ) {
      throw invalidDeploymentResource();
    }
    return;
  }
  if ("job" in resource) {
    if (!isResourceId(resource.job.id) || !["CAN_VIEW", "CAN_MANAGE_RUN", "CAN_MANAGE", "IS_OWNER"].includes(resource.job.permission)) throw invalidDeploymentResource();
    return;
  }
  if ("experiment" in resource) {
    if (!isResourceId(resource.experiment.experiment_id) || !["CAN_READ", "CAN_EDIT", "CAN_MANAGE"].includes(resource.experiment.permission)) throw invalidDeploymentResource();
    return;
  }
  if ("genie_space" in resource) {
    if (!isResourceId(resource.genie_space.space_id) || !isResourceLabel(resource.genie_space.name) || !["CAN_VIEW", "CAN_RUN", "CAN_EDIT", "CAN_MANAGE"].includes(resource.genie_space.permission)) throw invalidDeploymentResource();
    return;
  }
  if ("serving_endpoint" in resource) {
    if (!isResourceLabel(resource.serving_endpoint.name) || !["CAN_VIEW", "CAN_QUERY", "CAN_MANAGE"].includes(resource.serving_endpoint.permission)) throw invalidDeploymentResource();
    return;
  }
  if ("uc_securable" in resource) {
    if (!isResourceLabel(resource.uc_securable.securable_full_name) || !["VOLUME", "TABLE", "FUNCTION", "CONNECTION", "MODEL_SERVICE"].includes(resource.uc_securable.securable_type) || !["READ_VOLUME", "WRITE_VOLUME", "SELECT", "EXECUTE", "USE_CONNECTION", "MODIFY"].includes(resource.uc_securable.permission)) throw invalidDeploymentResource();
    return;
  }
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(resource.database.instance_name) ||
    !/^[A-Za-z0-9_$-]{1,63}$/.test(resource.database.database_name) ||
    resource.database.permission !== "CAN_CONNECT_AND_CREATE"
  ) {
    throw invalidDeploymentResource();
  }
}

function sameWorkspaceAppResource(
  existing: WorkspaceAppResource,
  required: WorkspaceAppResource,
): boolean {
  if (existing.name !== required.name) return false;
  if ("secret" in existing && "secret" in required) {
    return (
      existing.secret.scope === required.secret.scope &&
      existing.secret.key === required.secret.key &&
      existing.secret.permission === required.secret.permission
    );
  }
  if ("sql_warehouse" in existing && "sql_warehouse" in required) {
    return (
      existing.sql_warehouse.id === required.sql_warehouse.id &&
      existing.sql_warehouse.permission === required.sql_warehouse.permission
    );
  }
  if ("postgres" in existing && "postgres" in required) {
    return (
      existing.postgres.database === required.postgres.database &&
      existing.postgres.permission === required.postgres.permission
    );
  }
  if ("database" in existing && "database" in required) {
    return (
      existing.database.instance_name === required.database.instance_name &&
      existing.database.database_name === required.database.database_name &&
      existing.database.permission === required.database.permission
    );
  }
  if ("job" in existing && "job" in required) return existing.job.id === required.job.id && existing.job.permission === required.job.permission;
  if ("experiment" in existing && "experiment" in required) return existing.experiment.experiment_id === required.experiment.experiment_id && existing.experiment.permission === required.experiment.permission;
  if ("genie_space" in existing && "genie_space" in required) return existing.genie_space.space_id === required.genie_space.space_id && existing.genie_space.name === required.genie_space.name && existing.genie_space.permission === required.genie_space.permission;
  if ("serving_endpoint" in existing && "serving_endpoint" in required) return existing.serving_endpoint.name === required.serving_endpoint.name && existing.serving_endpoint.permission === required.serving_endpoint.permission;
  if ("uc_securable" in existing && "uc_securable" in required) return existing.uc_securable.securable_full_name === required.uc_securable.securable_full_name && existing.uc_securable.securable_type === required.uc_securable.securable_type && existing.uc_securable.permission === required.uc_securable.permission;
  return false;
}

function isResourceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isResourceLabel(value: string): boolean {
  return value.length > 0 && value.length <= 255 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidSecretIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CHILD_APP_SECRET_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function invalidDeploymentResource(): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_child_app_resource",
    "Databricks App resource is invalid",
    "A selected resource does not match the supported Databricks Apps resource contract.",
  );
}
