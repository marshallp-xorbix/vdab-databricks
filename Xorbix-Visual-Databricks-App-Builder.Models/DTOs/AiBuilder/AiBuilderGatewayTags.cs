namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// Request-scoped metadata stamped onto Databricks AI Gateway calls during AI Builder sessions.
/// </summary>
public sealed class AiBuilderGatewayTags
{
    public required Guid TenantId { get; init; }

    public string? TenantName { get; init; }

    public required Guid UserId { get; init; }

    public required int AppId { get; init; }

    public string? AppName { get; init; }

    public required AiModelSource ModelSource { get; init; }

    public int? TenantAiModelId { get; init; }

    public required string EndpointName { get; init; }
}
