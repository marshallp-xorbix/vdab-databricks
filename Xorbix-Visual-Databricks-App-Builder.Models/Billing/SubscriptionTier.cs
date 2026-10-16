namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Supported subscription tiers for tenant billing and feature limits.
/// </summary>
public enum SubscriptionTier
{
    None = 0,
    Trial = 1,
    Individual = 2,
    Team = 3,
    Enterprise = 4,
}