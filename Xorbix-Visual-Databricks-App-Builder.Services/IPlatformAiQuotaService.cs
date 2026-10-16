using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Enforces and records per-user monthly token quotas for the VDAB Default AI Builder model.
/// </summary>
public interface IPlatformAiQuotaService
{
    /// <summary>
    /// Returns the caller's current-month platform model usage snapshot.
    /// </summary>
    Task<Result<PlatformAiUsageDto>> GetUsageAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Ensures the user may use the platform default model for AI Builder sessions and LLM calls.
    /// </summary>
    Task<Result> EnsureCanUsePlatformModelAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Records token usage from a completed platform-model LLM response.
    /// </summary>
    Task RecordUsageAsync(
        Guid userId,
        PlatformAiUsageRecordContext context,
        CancellationToken cancellationToken = default);
}
