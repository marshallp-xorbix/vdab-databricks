namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Effective per-tenant feature limits resolved from a subscription tier, its current status,
/// and the active seat count. A value of <c>0</c> indicates unlimited.
/// </summary>
/// <param name="MaxPublishedApps">Maximum apps allowed for the tenant. Zero indicates unlimited.</param>
/// <param name="MaxWorkspaceConnections">Maximum workspace connections allowed. Zero indicates unlimited.</param>
public readonly record struct EffectiveTierLimits(int MaxPublishedApps, int MaxWorkspaceConnections);
