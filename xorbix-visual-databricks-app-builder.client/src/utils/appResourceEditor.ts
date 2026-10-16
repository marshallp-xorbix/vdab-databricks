import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import { SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY } from "../constants/databricksAppResourcesUi";
import {
  AppResourceKindSlug,
  DEFAULT_APP_RESOURCE_PERMISSION,
  KIND_LABELS,
  type AppResourceKind,
} from "../types/appResourceKinds";

export interface StagedResourceRow {
  clientId: string;
  resource: NormalizedAppResource;
}

export function cloneNormalizedResource(
  resource: NormalizedAppResource,
): NormalizedAppResource {
  return JSON.parse(JSON.stringify(resource)) as NormalizedAppResource;
}

/** Lowercase label with runs of whitespace turned into single hyphens (resource key slug). */
export function slugifyResourceTypeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/**
 * Default resource key for a new row: slug from the kind's display label, unique among existing names.
 * Reuses {@link KIND_LABELS} (e.g. SQL warehouse → <code>sql-warehouse</code>, then <code>sql-warehouse-2</code>, …).
 */
export function nextAvailableDefaultResourceKey(
  kind: AppResourceKind,
  existingNames: readonly string[],
): string {
  const base = slugifyResourceTypeLabel(KIND_LABELS[kind]);
  const used = new Set(
    existingNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0),
  );
  if (!used.has(base)) {
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

export function createEmptyResource(kind: AppResourceKind): NormalizedAppResource {
  const base = {
    kind,
    name: "",
    description: "",
  };
  const perm = DEFAULT_APP_RESOURCE_PERMISSION[kind];

  switch (kind) {
    case AppResourceKindSlug.SqlWarehouse:
      return {
        ...base,
        sqlWarehouse: { id: "", permission: perm },
      };
    case AppResourceKindSlug.Job:
      return {
        ...base,
        job: { id: "", permission: perm },
      };
    case AppResourceKindSlug.Database:
      return {
        ...base,
        database: {
          database_name: "",
          database_display_name: "",
          instance_name: "",
          permission: perm,
        },
      };
    case AppResourceKindSlug.AutoscalingDatabase:
      return {
        ...base,
        database: {
          database_name: "",
          database_display_name: "",
          instance_name: "",
          permission: perm,
        },
      };
    case AppResourceKindSlug.Secret:
      return {
        ...base,
        secret: { key: "", scope: "", permission: perm },
      };
    case AppResourceKindSlug.Experiment:
      return {
        ...base,
        experiment: { experiment_id: "", permission: perm },
      };
    case AppResourceKindSlug.GenieSpace:
      return {
        ...base,
        genieSpace: { name: "", space_id: "", permission: perm },
      };
    case AppResourceKindSlug.ServingEndpoint:
      return {
        ...base,
        servingEndpoint: { name: "", permission: perm },
      };
    case AppResourceKindSlug.UcSecurable:
      return {
        ...base,
        ucSecurable: {
          securable_full_name: "",
          securable_type: "",
          permission: perm,
        },
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function rowsFromResources(
  resources: NormalizedAppResource[],
  makeId: () => string,
): StagedResourceRow[] {
  return resources.map((resource) => ({
    clientId: makeId(),
    resource: cloneNormalizedResource(resource),
  }));
}

/** Case-sensitive trimmed keys must be unique (matches backend). */
export function findDuplicateNameKeys(rows: StagedResourceRow[]): Set<string> {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = row.resource.name.trim();
    if (!key) continue;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count >= 1) {
      duplicates.add(key);
    }
  }
  return duplicates;
}

/** Returns a user-facing message if the row is invalid, or null if valid. */
export function validateResourceRow(resource: NormalizedAppResource): string | null {
  if (!resource.kind?.trim()) {
    return "Resource type is required.";
  }
  if (!resource.name.trim()) {
    return "Resource key is required.";
  }

  switch (resource.kind) {
    case AppResourceKindSlug.SqlWarehouse:
      if (!resource.sqlWarehouse?.id?.trim()) {
        return "Select a SQL warehouse.";
      }
      if (!resource.sqlWarehouse?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.Job:
      if (!resource.job?.id?.trim()) {
        return "Select a job.";
      }
      if (!resource.job?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.Database:
      if (!resource.database?.database_name?.trim()) {
        return "Select a Lakebase database instance (Compute → Database instances).";
      }
      if (!resource.database?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.AutoscalingDatabase:
      if (!resource.database?.database_name?.trim()) {
        return "Select an autoscaling Lakebase endpoint.";
      }
      if (!resource.database?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.Secret:
      if (!resource.secret?.scope?.trim() || !resource.secret?.key?.trim()) {
        return "Select a secret scope and key.";
      }
      if (!resource.secret?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.Experiment:
      if (!resource.experiment?.experiment_id?.trim()) {
        return "Select an MLflow experiment.";
      }
      if (!resource.experiment?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.GenieSpace:
      if (
        !resource.genieSpace?.space_id?.trim() ||
        !resource.genieSpace?.name?.trim()
      ) {
        return "Select a Genie space.";
      }
      if (!resource.genieSpace?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.ServingEndpoint:
      if (!resource.servingEndpoint?.name?.trim()) {
        return "Select a model serving endpoint.";
      }
      if (!resource.servingEndpoint?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    case AppResourceKindSlug.UcSecurable:
      if (!resource.ucSecurable?.securable_full_name?.trim()) {
        return "Select a Unity Catalog table or enter securable full name.";
      }
      if (!resource.ucSecurable?.securable_type?.trim()) {
        return "Securable type is required (e.g. TABLE).";
      }
      if (!resource.ucSecurable?.permission?.trim()) {
        return "Permission is required.";
      }
      break;
    default:
      return "Unknown resource type.";
  }

  return null;
}

/** Current permission string for the resource kind (for the permission dropdown). */
export function getResourcePermissionValue(
  resource: NormalizedAppResource,
): string {
  switch (resource.kind) {
    case AppResourceKindSlug.SqlWarehouse:
      return resource.sqlWarehouse?.permission ?? "";
    case AppResourceKindSlug.Job:
      return resource.job?.permission ?? "";
    case AppResourceKindSlug.Database:
      return resource.database?.permission ?? "";
    case AppResourceKindSlug.AutoscalingDatabase:
      return resource.database?.permission ?? "";
    case AppResourceKindSlug.Secret:
      return resource.secret?.permission ?? "";
    case AppResourceKindSlug.Experiment:
      return resource.experiment?.permission ?? "";
    case AppResourceKindSlug.GenieSpace:
      return resource.genieSpace?.permission ?? "";
    case AppResourceKindSlug.ServingEndpoint:
      return resource.servingEndpoint?.permission ?? "";
    case AppResourceKindSlug.UcSecurable:
      return resource.ucSecurable?.permission ?? "";
    default:
      return "";
  }
}

/** Applies a permission choice from the UI to a cloned resource row. */
export function applyPermissionToResource(
  resource: NormalizedAppResource,
  permissionRaw: string,
): NormalizedAppResource {
  const permission =
    permissionRaw === SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY
      ? ""
      : permissionRaw;
  const next = cloneNormalizedResource(resource);
  switch (next.kind) {
    case AppResourceKindSlug.SqlWarehouse:
      next.sqlWarehouse = {
        id: next.sqlWarehouse?.id ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.Job:
      next.job = {
        id: next.job?.id ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.Database:
      next.database = {
        database_name: next.database?.database_name ?? "",
        database_display_name: next.database?.database_display_name ?? "",
        instance_name: next.database?.instance_name ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.AutoscalingDatabase:
      next.database = {
        database_name: next.database?.database_name ?? "",
        database_display_name: next.database?.database_display_name ?? "",
        instance_name: next.database?.instance_name ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.Secret:
      next.secret = {
        key: next.secret?.key ?? "",
        scope: next.secret?.scope ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.Experiment:
      next.experiment = {
        experiment_id: next.experiment?.experiment_id ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.GenieSpace:
      next.genieSpace = {
        name: next.genieSpace?.name ?? "",
        space_id: next.genieSpace?.space_id ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.ServingEndpoint:
      next.servingEndpoint = {
        name: next.servingEndpoint?.name ?? "",
        permission,
      };
      return next;
    case AppResourceKindSlug.UcSecurable:
      next.ucSecurable = {
        securable_full_name: next.ucSecurable?.securable_full_name ?? "",
        securable_type: next.ucSecurable?.securable_type ?? "",
        permission,
      };
      return next;
    default:
      return next;
  }
}
