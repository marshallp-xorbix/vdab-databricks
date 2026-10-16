using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Audit Action type enumeration for events (different from AuditLog.ActionType)
/// </summary>
public enum AuditActionType
{
    Login=1,
    Logout=2,
    Create=3,
    Update=4,
    Delete=5,
    Publish=6,
    ConnectionChange=7,
    RoleChange=8,
    TenantSwitch=9
}

public class AuditActionDto
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public required AuditActionType Type { get; set; }

    [JsonPropertyName("params")]
    public Dictionary<string, object>? Parameters { get; set; }
}
