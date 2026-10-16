using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Reads and writes per-user platform AI Builder token usage counters and ledger events.
/// </summary>
public interface IUserPlatformAiUsageRepository
{
    /// <summary>
    /// Gets the current token usage for a user in the given period, or zero when no row exists.
    /// </summary>
    Task<long> GetTokensUsedAsync(Guid userId, string periodKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records a usage event and atomically increments the user's period counter.
    /// </summary>
    Task RecordUsageAsync(
        Guid userId,
        string periodKey,
        PlatformAiUsageRecordContext context,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Permanently removes every platform AI usage counter and ledger event for the given user.
    /// </summary>
    Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
