/**
 * Wire-format kind strings for Databricks Apps resources (JSON keys).
 *
 * IMPORTANT: Keep in sync with `DatabricksAppResourceKinds` in
 * Xorbix-Visual-Databricks-App-Builder.ServiceDefaults/Constants.cs (same string values).
 */
export const AppResourceKindSlug = {
  SqlWarehouse: "sql_warehouse",
  Job: "job",
  Database: "database",
  AutoscalingDatabase: "autoscaling_database",
  Secret: "secret",
  Experiment: "experiment",
  GenieSpace: "genie_space",
  ServingEndpoint: "serving_endpoint",
  UcSecurable: "uc_securable",
} as const;

/** Ordered list for dropdowns (order is UI-only). */
export const APP_RESOURCE_KINDS = [
  AppResourceKindSlug.SqlWarehouse,
  AppResourceKindSlug.Job,
  AppResourceKindSlug.Database,
  AppResourceKindSlug.AutoscalingDatabase,
  AppResourceKindSlug.Secret,
  AppResourceKindSlug.Experiment,
  AppResourceKindSlug.GenieSpace,
  AppResourceKindSlug.ServingEndpoint,
  AppResourceKindSlug.UcSecurable,
] as const;

export type AppResourceKind = (typeof APP_RESOURCE_KINDS)[number];

/** Unity Catalog <c>securable_type</c> values used in table vs manual UC flows. */
export const UcSecurableTypeWire = {
  Table: "TABLE",
  Volume: "VOLUME",
} as const;

/** Sensible default permission when adding a new resource row (least-privilege oriented). */
export const DEFAULT_APP_RESOURCE_PERMISSION: Record<AppResourceKind, string> = {
  [AppResourceKindSlug.SqlWarehouse]: "CAN_USE",
  [AppResourceKindSlug.Job]: "CAN_VIEW",
  [AppResourceKindSlug.Database]: "CAN_CONNECT_AND_CREATE",
  [AppResourceKindSlug.AutoscalingDatabase]: "CAN_CONNECT_AND_CREATE",
  [AppResourceKindSlug.Secret]: "READ",
  [AppResourceKindSlug.Experiment]: "CAN_READ",
  [AppResourceKindSlug.GenieSpace]: "CAN_VIEW",
  [AppResourceKindSlug.ServingEndpoint]: "CAN_QUERY",
  [AppResourceKindSlug.UcSecurable]: "SELECT",
};

/** Permission options shown per kind (Databricks Apps resource permissions; see Databricks docs per resource type). */
export const PERMISSION_OPTIONS_BY_KIND: Record<AppResourceKind, string[]> = {
  [AppResourceKindSlug.SqlWarehouse]: ["CAN_MANAGE", "CAN_USE"],
  [AppResourceKindSlug.Job]: ["CAN_MANAGE", "CAN_MANAGE_RUN", "CAN_VIEW"],
  [AppResourceKindSlug.Database]: ["CAN_CONNECT_AND_CREATE"],
  [AppResourceKindSlug.AutoscalingDatabase]: ["CAN_CONNECT_AND_CREATE"],
  [AppResourceKindSlug.Secret]: ["READ", "WRITE", "MANAGE"],
  [AppResourceKindSlug.Experiment]: ["CAN_MANAGE", "CAN_READ", "CAN_EDIT"],
  [AppResourceKindSlug.GenieSpace]: [
    "CAN_VIEW",
    "CAN_RUN",
    "CAN_EDIT",
    "CAN_MANAGE",
  ],
  [AppResourceKindSlug.ServingEndpoint]: ["CAN_MANAGE", "CAN_QUERY", "CAN_VIEW"],
  /** UC table-style securables (SELECT / MODIFY per Databricks Apps table resources). */
  [AppResourceKindSlug.UcSecurable]: ["SELECT", "MODIFY"],
};

export const KIND_LABELS: Record<AppResourceKind, string> = {
  [AppResourceKindSlug.SqlWarehouse]: "SQL warehouse",
  [AppResourceKindSlug.Job]: "Job",
  [AppResourceKindSlug.Database]: "Provisioned Lakebase",
  [AppResourceKindSlug.AutoscalingDatabase]: "Autoscaling Lakebase",
  [AppResourceKindSlug.Secret]: "Secret",
  [AppResourceKindSlug.Experiment]: "Experiment",
  [AppResourceKindSlug.GenieSpace]: "Genie space",
  [AppResourceKindSlug.ServingEndpoint]: "Serving endpoint",
  [AppResourceKindSlug.UcSecurable]: "Unity Catalog securable",
};

/** Human-readable labels for Databricks permission strings (UI only). */
export const PERMISSION_DISPLAY_LABELS: Record<string, string> = {
  CAN_USE: "Can use",
  CAN_MANAGE: "Can manage",
  CAN_VIEW: "Can view",
  CAN_RUN: "Can run",
  CAN_MANAGE_RUN: "Can manage and run",
  CAN_QUERY: "Can query",
  CAN_READ: "Can read",
  CAN_EDIT: "Can edit",
  CAN_CONNECT_AND_CREATE: "Can connect and create",
  READ: "Read",
  WRITE: "Write",
  MANAGE: "Manage",
  SELECT: "Select",
  MODIFY: "Modify",
  READ_METADATA: "Read metadata",
};

export function formatPermissionLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return PERMISSION_DISPLAY_LABELS[trimmed] ?? trimmed;
}

const FALLBACK_PERMISSION_OPTIONS: string[] = ["CAN_MANAGE", "CAN_USE"];

/**
 * Known permission values for a kind, plus the current wire value when it is
 * non-empty and not already listed (e.g. legacy or newer Databricks values).
 */
export function mergePermissionOptionsForKind(
  kind: AppResourceKind,
  currentValue: string,
): string[] {
  const base =
    PERMISSION_OPTIONS_BY_KIND[kind] ?? FALLBACK_PERMISSION_OPTIONS;
  const trimmed = currentValue.trim();
  if (!trimmed || base.includes(trimmed)) {
    return base;
  }
  return [...base, trimmed];
}
