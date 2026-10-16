using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Loads Databricks workspace metadata for AI Builder prompts.
/// </summary>
public interface IAiBuilderContextService
{
    /// <summary>
    /// Returns the workspace connection id and formatted metadata context for the app.
    /// </summary>
    Task<Result<AiBuilderDatabricksContext>> BuildDatabricksContextAsync(
        int appId,
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);
}
