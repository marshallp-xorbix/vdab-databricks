using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Route segments for <c>/api/AppActions/{appId}/…</c>. Member names align with <see cref="AppActionApiRoutes"/>.
/// </summary>
/// <remarks>
/// IMPORTANT: Keep in sync with the TypeScript <c>AppActionRouteSegment</c> enum in
/// xorbix-visual-databricks-app-builder.client/src/types/appActionApiRoutes.ts (same string values).
/// </remarks>
public enum AppActionRouteSegment
{
    Status,
    Details,
    Resources,
    Start,
    Stop,
    DatabricksAppNames,
    DatabricksApps,
}

/// <summary>
/// URL strings for App Actions API routes (<see cref="AppActionRouteSegment"/>).
/// </summary>
/// <remarks>
/// IMPORTANT: Keep in sync with the TypeScript <c>AppActionRouteSegment</c> enum in
/// xorbix-visual-databricks-app-builder.client/src/types/appActionApiRoutes.ts (same string values).
/// </remarks>
[ExcludeFromCodeCoverage]
public static class AppActionApiRoutes
{
    /// <summary>Matches <c>[controller]</c> for <c>AppActionsController</c> (<c>AppActions</c>).</summary>
    public const string ControllerName = "AppActions";

    public const string Status = "status";
    public const string Details = "details";
    public const string Resources = "resources";
    public const string Start = "start";
    public const string Stop = "stop";
    public const string DatabricksAppNames = "databricks-app-names";

    /// <summary>POST create Databricks app in workspace (no <c>{appId}</c> segment).</summary>
    public const string DatabricksApps = "databricks-apps";
}
