namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// Resolved Databricks AI Gateway configuration for a single AI Builder request.
/// </summary>
public sealed class ResolvedAiModelConfiguration
{
    public AiModelSource Source { get; init; }

    public string DisplayName { get; init; } = string.Empty;

    public string WorkspaceUrl { get; init; } = string.Empty;

    public string EndpointName { get; init; } = string.Empty;

    public string AccessToken { get; init; } = string.Empty;

    public int? TenantAiModelId { get; init; }
}
