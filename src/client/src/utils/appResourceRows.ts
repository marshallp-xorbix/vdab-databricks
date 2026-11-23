import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import {
  AppResourceKindSlug,
  KIND_LABELS,
  type AppResourceKind,
} from "../types/appResourceKinds";

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/;

/** Builds a blank grant row for the selected Databricks resource kind. */
export function createEmptyAppResource(
  kind: AppResourceKind,
  name: string,
): IWorkspaceAppResource {
  const description = "";
  switch (kind) {
    case AppResourceKindSlug.SqlWarehouse:
      return { name, description, sql_warehouse: { id: "", permission: "CAN_USE" } };
    case AppResourceKindSlug.Job:
      return { name, description, job: { id: "", permission: "CAN_VIEW" } };
    case AppResourceKindSlug.Database:
      return {
        name,
        description,
        database: { instance_name: "", database_name: "", permission: "CAN_CONNECT_AND_CREATE" },
      };
    case AppResourceKindSlug.AutoscalingDatabase:
      return {
        name,
        description,
        postgres: { database: "", permission: "CAN_CONNECT_AND_CREATE" },
      };
    case AppResourceKindSlug.Secret:
      return { name, description, secret: { scope: "", key: "", permission: "READ" } };
    case AppResourceKindSlug.Experiment:
      return { name, description, experiment: { experiment_id: "", permission: "CAN_READ" } };
    case AppResourceKindSlug.GenieSpace:
      return { name, description, genie_space: { name: "", space_id: "", permission: "CAN_VIEW" } };
    case AppResourceKindSlug.ServingEndpoint:
      return { name, description, serving_endpoint: { name: "", permission: "CAN_QUERY" } };
    case AppResourceKindSlug.UcSecurable:
      return {
        name,
        description,
        uc_securable: { securable_full_name: "", securable_type: "TABLE", permission: "SELECT" },
      };
  }
}

/** Lowercase label with runs of whitespace turned into single hyphens. */
export function slugifyResourceTypeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Default resource key for a new row: slug from the kind's display label,
 * unique among existing names (matches SaaS nextAvailableDefaultResourceKey).
 */
export function nextAppResourceKey(
  kind: AppResourceKind,
  resources: readonly IWorkspaceAppResource[],
): string {
  const base = slugifyResourceTypeLabel(KIND_LABELS[kind]);
  const names = new Set(resources.map((resource) => resource.name.trim()));
  if (!names.has(base) && KEY_PATTERN.test(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`.slice(0, 30);
    if (!names.has(candidate) && KEY_PATTERN.test(candidate)) return candidate;
  }
  return `resource-${resources.length + 1}`;
}

/** Returns resource keys that appear more than once. */
export function duplicateAppResourceKeys(
  resources: readonly IWorkspaceAppResource[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const resource of resources) {
    const name = resource.name.trim();
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates];
}

/** Returns a user-facing message if the row is invalid, or null if valid. */
export function validateResourceRow(resource: IWorkspaceAppResource): string | null {
  const name = resource.name.trim();
  if (!name) return "Resource key is required.";
  if (!KEY_PATTERN.test(name)) {
    return "Resource key must be 2–30 characters: start with a letter, then lowercase letters, digits, or hyphens.";
  }

  if ("sql_warehouse" in resource) {
    if (!resource.sql_warehouse.id.trim()) return "Select a SQL warehouse.";
    if (!resource.sql_warehouse.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("job" in resource) {
    if (!resource.job.id.trim()) return "Select a job.";
    if (!resource.job.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("database" in resource) {
    if (!resource.database.instance_name.trim() || !resource.database.database_name.trim()) {
      return "Select a Lakebase database instance.";
    }
    if (!resource.database.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("postgres" in resource) {
    if (!resource.postgres.database.trim()) {
      return "Select an autoscaling Lakebase database.";
    }
    if (!resource.postgres.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("secret" in resource) {
    if (!resource.secret.scope.trim() || !resource.secret.key.trim()) {
      return "Select a secret scope and key.";
    }
    if (!resource.secret.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("experiment" in resource) {
    if (!resource.experiment.experiment_id.trim()) {
      return "Select an MLflow experiment.";
    }
    if (!resource.experiment.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("genie_space" in resource) {
    if (!resource.genie_space.space_id.trim() || !resource.genie_space.name.trim()) {
      return "Select a Genie space.";
    }
    if (!resource.genie_space.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("serving_endpoint" in resource) {
    if (!resource.serving_endpoint.name.trim()) {
      return "Select a model serving endpoint.";
    }
    if (!resource.serving_endpoint.permission.trim()) return "Permission is required.";
    return null;
  }
  if ("uc_securable" in resource) {
    if (!resource.uc_securable.securable_full_name.trim()) {
      return "Select a Unity Catalog table or enter securable full name.";
    }
    if (!resource.uc_securable.securable_type.trim()) {
      return "Securable type is required.";
    }
    if (!resource.uc_securable.permission.trim()) return "Permission is required.";
    return null;
  }
  return "Unknown resource type.";
}

/** True when every staged row is complete and keys are unique. */
export function canSaveAppResources(
  resources: readonly IWorkspaceAppResource[],
): boolean {
  if (duplicateAppResourceKeys(resources).length > 0) return false;
  return resources.every((resource) => validateResourceRow(resource) === null);
}
