import type {
  WorkspaceAppResource,
  WorkspaceSecretAppResource,
  WorkspaceSecretResourceSelection,
} from "./contracts.ts";
import {
  CHILD_APP_SECRET_ENVIRONMENT_PREFIX,
  CHILD_APP_SECRET_RESOURCE_DESCRIPTION,
} from "./contracts.ts";
import { ApplicationError } from "./application-error.ts";

/** Builds a read-only Apps resource from identifiers supplied by an editor. */
export function createWorkspaceSecretAppResource(
  name: string,
  scope: string,
  key: string,
): WorkspaceSecretAppResource {
  return {
    name,
    description: CHILD_APP_SECRET_RESOURCE_DESCRIPTION,
    secret: { scope, key, permission: "READ" },
  };
}

/** Resolves new secret identifiers or explicit read-only bindings on an existing App. */
export function resolveWorkspaceSecretResources(
  selections: WorkspaceSecretResourceSelection[],
  existingResources: WorkspaceAppResource[] | null,
): WorkspaceSecretAppResource[] {
  if (existingResources === null) {
    return selections.map((selection) =>
      createWorkspaceSecretAppResource(
        selection.name,
        selection.scope,
        selection.key,
      ),
    );
  }

  const secretResources = existingResources.filter(isSecretResource);
  return selections.map((selection) => {
    const existing = secretResources.find(
      (resource) => resource.name === selection.name,
    );
    if (
      !existing ||
      existing.secret.permission !== "READ" ||
      existing.secret.scope !== selection.scope ||
      existing.secret.key !== selection.key
    ) {
      throw invalidSecretSelection();
    }
    return existing;
  });
}

/** Returns the runtime environment variable used to access one selected secret. */
export function workspaceSecretEnvironmentVariable(
  resource: WorkspaceSecretAppResource,
): string {
  return `${CHILD_APP_SECRET_ENVIRONMENT_PREFIX}${resource.name.toUpperCase().replaceAll("-", "_")}`;
}

function isSecretResource(
  resource: WorkspaceAppResource,
): resource is WorkspaceSecretAppResource {
  return "secret" in resource;
}

function invalidSecretSelection(): ApplicationError {
  return new ApplicationError(
    422,
    "invalid_child_app_secret_resource",
    "Child App secret selection is invalid",
    "Choose secret identifiers for a new App or select an existing read-only secret resource from the target App.",
  );
}
