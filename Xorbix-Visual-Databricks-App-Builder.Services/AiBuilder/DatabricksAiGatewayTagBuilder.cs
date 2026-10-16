using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Builds the JSON tag object for <c>Databricks-Ai-Gateway-Request-Tags</c> headers.
/// </summary>
internal static class DatabricksAiGatewayTagBuilder
{
    /// <summary>
    /// Builds a string-keyed tag dictionary for AI Gateway request attribution.
    /// </summary>
    /// <param name="endUserEmail">Optional VDAB user email.</param>
    /// <param name="aiBuilderTags">Optional AI Builder session tags.</param>
    /// <returns>Tag key-value pairs suitable for JSON serialization.</returns>
    public static Dictionary<string, string> Build(string? endUserEmail, AiBuilderGatewayTags? aiBuilderTags)
    {
        Dictionary<string, string> tags = new(StringComparer.Ordinal)
        {
            [AiBuilderGatewayTagKeys.Source] = AiBuilderGatewayTagValues.Source,
        };

        if (!string.IsNullOrEmpty(endUserEmail))
            tags[AiBuilderGatewayTagKeys.EndUser] = endUserEmail;

        if (aiBuilderTags is null)
            return tags;

        tags[AiBuilderGatewayTagKeys.Feature] = AiBuilderGatewayTagValues.FeatureAiBuilder;
        tags[AiBuilderGatewayTagKeys.TenantId] = aiBuilderTags.TenantId.ToString();
        if (!string.IsNullOrWhiteSpace(aiBuilderTags.TenantName))
            tags[AiBuilderGatewayTagKeys.TenantName] = aiBuilderTags.TenantName;

        tags[AiBuilderGatewayTagKeys.UserId] = aiBuilderTags.UserId.ToString();
        tags[AiBuilderGatewayTagKeys.AppId] = aiBuilderTags.AppId.ToString();
        if (!string.IsNullOrWhiteSpace(aiBuilderTags.AppName))
            tags[AiBuilderGatewayTagKeys.AppName] = aiBuilderTags.AppName;
        tags[AiBuilderGatewayTagKeys.ModelSource] = aiBuilderTags.ModelSource switch
        {
            AiModelSource.Platform => AiBuilderGatewayTagValues.ModelSourcePlatform,
            AiModelSource.Tenant => AiBuilderGatewayTagValues.ModelSourceTenant,
            _ => AiBuilderGatewayTagValues.ModelSourcePlatform,
        };

        if (aiBuilderTags.TenantAiModelId is int tenantAiModelId)
            tags[AiBuilderGatewayTagKeys.TenantAiModelId] = tenantAiModelId.ToString();

        if (!string.IsNullOrWhiteSpace(aiBuilderTags.EndpointName))
            tags[AiBuilderGatewayTagKeys.EndpointName] = aiBuilderTags.EndpointName;

        return tags;
    }
}
