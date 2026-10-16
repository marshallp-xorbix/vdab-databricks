using System.Diagnostics.CodeAnalysis;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Billing;

/// <summary>
/// Stripe coupon constraints enforced for VDAB promotion codes.
/// </summary>
[ExcludeFromCodeCoverage]
public static class PromoCouponRules
{
    /// <summary>Stripe coupon duration for multi-month free periods.</summary>
    public const string RepeatingDuration = "repeating";

    /// <summary>Required percent-off value for signup promo coupons.</summary>
    public const decimal FullDiscountPercentOff = 100m;
}
