namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;

/// <summary>
/// Request model for updating user account settings (security and notification preferences).
/// </summary>
public record UpdateUserSettingsRequest
{
    public bool UsePasswordlessLogin { get; init; }
    public bool TwoFactorEnabled { get; init; }
    public bool EmailNotificationsEnabled { get; init; }
    public bool WorkflowNotificationsEnabled { get; init; }
}
