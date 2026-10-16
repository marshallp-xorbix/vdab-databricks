using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Resolves the effective Databricks AI configuration for an AI Builder request.
/// </summary>
public interface IAiModelResolverService
{
    /// <summary>
    /// Resolves platform or tenant AI model configuration for the caller.
    /// </summary>
    Task<Result<ResolvedAiModelConfiguration>> ResolveAsync(
        Guid tenantId,
        int? tenantAiModelId,
        CancellationToken cancellationToken = default);

    /// <summary>Builds the platform default configuration from application settings.</summary>
    Result<ResolvedAiModelConfiguration> ResolvePlatformDefault();

    /// <summary>Returns whether the platform default model is fully configured.</summary>
    bool IsPlatformDefaultConfigured();

    /// <summary>Gets the platform endpoint name for display when configured.</summary>
    string GetPlatformEndpointName();
}
