namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Sanitized User information included in authentication response.
/// </summary>
public class UserInfo
{
    public required Guid UserId { get; init; }
    public required string UserName { get; init; }
    public required string Email { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required IList<string> Roles { get; init; }
    public string FullName => $"{FirstName} {LastName}".Trim();
}
