using FluentResults;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Validates tenant AI model endpoints support function calling required by AI Builder.
/// </summary>
public interface ITenantAiModelValidationService
{
    /// <summary>
    /// Sends a minimal function-calling request to verify the serving endpoint works.
    /// </summary>
    Task<Result> ValidateEndpointAsync(
        string workspaceUrl,
        string endpointName,
        string accessToken,
        CancellationToken cancellationToken = default);
}
