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
  return false;
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
