using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Manages AI Builder model listing and per-user selection preferences.
/// </summary>
public interface IAiBuilderModelSelectionService
{
    /// <summary>Lists platform default and tenant models available to the caller.</summary>
    Task<Result<IReadOnlyList<AiBuilderModelOptionDto>>> GetAvailableModelsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>Gets the caller's selected model for the active tenant.</summary>
    Task<Result<AiBuilderSelectedModelDto>> GetSelectedModelAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>Sets the caller's selected model for the active tenant.</summary>
    Task<Result<AiBuilderSelectedModelDto>> SetSelectedModelAsync(
        Guid userId,
        Guid tenantId,
        int? tenantAiModelId,
        CancellationToken cancellationToken = default);
}
