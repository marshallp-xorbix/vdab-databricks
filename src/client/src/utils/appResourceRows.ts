import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import {
  AppResourceKindSlug,
  type AppResourceKind,
} from "../types/appResourceKinds";

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/;

/** Builds a blank grant row for the selected Databricks resource kind. */
export function createEmptyAppResource(
  kind: AppResourceKind,
  name: string,
): IWorkspaceAppResource {
  const description = "VDAB app resource";
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

/** Chooses the next unused resource key for a newly added row. */
export function nextAppResourceKey(
  kind: AppResourceKind,
  resources: readonly IWorkspaceAppResource[],
): string {
  const base = kind.replaceAll("_", "-");
  const names = new Set(resources.map((resource) => resource.name));
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
