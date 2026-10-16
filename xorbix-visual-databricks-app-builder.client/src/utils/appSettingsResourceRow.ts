import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import {
  AppResourceKindSlug,
  formatPermissionLabel,
  KIND_LABELS,
  type AppResourceKind,
} from "../types/appResourceKinds";

export interface AppSettingsResourceTableRow {
  key: string;
  typeLabel: string;
  details: string;
  permissions: string;
}

const EM_DASH = "—";

function kindToLabel(kind: string): string {
  return KIND_LABELS[kind as AppResourceKind] ?? kind;
}

function joinDetails(parts: (string | undefined | null)[]): string {
  const filtered = parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return filtered.length > 0 ? filtered.join(" · ") : EM_DASH;
}

/**
 * Maps a normalized API resource to read-only table columns (Key, Type, Details, Permissions).
 * Details exclude permission fields; values are plain text only.
 */
export function buildAppSettingsResourceTableRow(
  resource: NormalizedAppResource,
): AppSettingsResourceTableRow {
  const key = resource.name?.trim() ? resource.name : EM_DASH;
  const typeLabel = kindToLabel(resource.kind);

  let details = EM_DASH;
  let permissions = "";

  switch (resource.kind) {
    case AppResourceKindSlug.SqlWarehouse:
      if (resource.sqlWarehouse) {
        details = joinDetails([resource.sqlWarehouse.id]);
        permissions = resource.sqlWarehouse.permission ?? "";
      }
      break;
    case AppResourceKindSlug.Job:
      if (resource.job) {
        details = joinDetails([resource.job.id]);
        permissions = resource.job.permission ?? "";
      }
      break;
    case AppResourceKindSlug.Database:
      if (resource.database) {
        details = joinDetails([
          resource.database.database_name,
          resource.database.instance_name,
        ]);
        permissions = resource.database.permission ?? "";
      }
      break;
    case AppResourceKindSlug.AutoscalingDatabase:
      if (resource.database) {
        details = joinDetails([
          resource.database.database_display_name || resource.database.database_name,
        ]);
        permissions = resource.database.permission ?? "";
      }
      break;
    case AppResourceKindSlug.Secret:
      if (resource.secret) {
        details = joinDetails([resource.secret.key, resource.secret.scope]);
        permissions = resource.secret.permission ?? "";
      }
      break;
    case AppResourceKindSlug.Experiment:
      if (resource.experiment) {
        details = joinDetails([resource.experiment.experiment_id]);
        permissions = resource.experiment.permission ?? "";
      }
      break;
    case AppResourceKindSlug.GenieSpace:
      if (resource.genieSpace) {
        details = joinDetails([
          resource.genieSpace.name,
          resource.genieSpace.space_id,
        ]);
        permissions = resource.genieSpace.permission ?? "";
      }
      break;
    case AppResourceKindSlug.ServingEndpoint:
      if (resource.servingEndpoint) {
        details = joinDetails([resource.servingEndpoint.name]);
        permissions = resource.servingEndpoint.permission ?? "";
      }
      break;
    case AppResourceKindSlug.UcSecurable:
      if (resource.ucSecurable) {
        details = joinDetails([
          resource.ucSecurable.securable_full_name,
          resource.ucSecurable.securable_type,
        ]);
        permissions = resource.ucSecurable.permission ?? "";
      }
      break;
    default:
      details = resource.description?.trim()
        ? resource.description
        : EM_DASH;
      break;
  }

  if (resource.description?.trim()) {
    const base = details === EM_DASH ? "" : details;
    details = joinDetails([base, resource.description.trim()].filter(Boolean));
  }

  const permissionRaw = permissions.trim();
  const permissionsDisplay = permissionRaw
    ? formatPermissionLabel(permissionRaw)
    : EM_DASH;

  return {
    key,
    typeLabel,
    details,
    permissions: permissionsDisplay,
  };
}
