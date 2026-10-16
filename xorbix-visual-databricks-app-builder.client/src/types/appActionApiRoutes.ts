/**
 * Route segments for `/api/AppActions/{appId}/…`.
 *
 * IMPORTANT: Keep in sync with C# `AppActionRouteSegment` and `AppActionApiRoutes` in
 * Xorbix-Visual-Databricks-App-Builder.Models/AppActionApiRoutes.cs (same string values).
 */
export enum AppActionRouteSegment {
  Status = "status",
  Details = "details",
  Resources = "resources",
  Start = "start",
  Stop = "stop",
  DatabricksAppNames = "databricks-app-names",
  DatabricksApps = "databricks-apps",
}

/**
 * Matches `[controller]` for `AppActionsController` → `AppActions`.
 *
 * IMPORTANT: Keep in sync with `AppActionApiRoutes.ControllerName` in the Models project.
 */
export const AppActionApiControllerName = "AppActions" as const;
