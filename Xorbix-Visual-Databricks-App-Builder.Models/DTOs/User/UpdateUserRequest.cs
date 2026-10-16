namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for updating user information.
/// </summary>
public record UpdateUserRequest
{
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public string? PhoneNumber { get; init; }
    public string? AzureAdObjectId { get; init; }
    public bool ClearAzureAdObjectId { get; init; }
}
