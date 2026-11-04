/**
 * UI-only strings and Radix Select sentinels for Databricks workspace pickers
 * (app resources editor, property panels). Sentinels must never match real IDs or permission values.
 */

export const WORKSPACE_CONNECTION_MISSING_MESSAGE =
  "Workspace connection is not set for this app.";

/** Permission dropdown: "no selection" (cleared to empty wire value). */
export const SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY = "__none__";

/** Add-resource toolbar: kind dropdown placeholder. */
export const SELECT_VALUE_ADD_APP_RESOURCE_KIND_PLACEHOLDER = "__pick__";

/** Disabled SelectItem values (unique per Select instance; not real resource IDs). */
export const SELECT_DISABLED = {
  error: "__dbc_select_err__",
  emptyList: "__dbc_select_empty__",
  loading: "__dbc_select_loading__",
  chooseCatalogFirst: "__dbc_select_catalog_first__",
  chooseParentsFirst: "__dbc_select_parents__",
} as const;

/** Matches other app-settings resource editor labels. */
export const RESOURCE_FIELD_LABEL_CLASS = "text-xs text-muted-foreground";
