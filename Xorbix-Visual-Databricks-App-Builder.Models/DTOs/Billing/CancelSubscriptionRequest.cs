namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;

/// <summary>
/// Request model for canceling a subscription.
/// </summary>
public class CancelSubscriptionRequest
{
    /// <summary>
    /// When true, cancels immediately. When false, cancels at period end.
    /// </summary>
    public bool Immediate { get; init; } = false;
}
