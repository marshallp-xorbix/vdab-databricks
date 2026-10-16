namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// Request to transfer ownership of the caller's current tenant to another member.
/// Only the current tenant owner (or a global administrator) may perform this action.
/// </summary>
public class TransferTenantOwnershipRequest
{
    /// <summary>
    /// The member who should become the new tenant owner. Must be an active member of the tenant.
    /// </summary>
    public required Guid TargetUserId { get; init; }
}
