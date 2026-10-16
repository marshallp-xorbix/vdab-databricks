namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Paginated response containing user sessions and total count.
/// </summary>
public class UserSessionsResponse
{
    /// <summary>
    /// The list of user sessions for the current page.
    /// </summary>
    public required List<UserSessionDto> Sessions { get; init; }

    /// <summary>
    /// The total number of sessions for the user.
    /// </summary>
    public required int TotalCount { get; init; }
}
