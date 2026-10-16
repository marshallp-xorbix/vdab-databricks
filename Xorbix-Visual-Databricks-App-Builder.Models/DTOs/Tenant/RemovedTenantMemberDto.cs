namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;

/// <summary>
/// A previously removed (soft-deleted) tenant membership for admin restore UI.
/// </summary>
public class RemovedTenantMemberDto
{
    /// <summary>The removed user's unique identifier.</summary>
    public required Guid UserId { get; init; }

    /// <summary>Email address of the removed user.</summary>
    public required string Email { get; init; }

    /// <summary>Display first name.</summary>
    public string? FirstName { get; init; }

    /// <summary>Display last name.</summary>
    public string? LastName { get; init; }

    /// <summary>Role preserved on the soft-deleted membership.</summary>
    public required string Role { get; init; }

    /// <summary>When the membership was soft-deleted.</summary>
    public required DateTime RemovedOn { get; init; }

    /// <summary>Who removed the membership, when recorded.</summary>
    public Guid? RemovedBy { get; init; }
}
