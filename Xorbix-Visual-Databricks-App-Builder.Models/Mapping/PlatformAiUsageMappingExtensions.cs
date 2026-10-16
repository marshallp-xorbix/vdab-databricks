using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Mapping;

/// <summary>
/// Mapping extensions for platform AI usage entities and DTOs.
/// </summary>
public static class PlatformAiUsageMappingExtensions
{
    /// <summary>
    /// Maps a usage record context to a ledger event entity.
    /// </summary>
    public static UserPlatformAiUsageEvent ToUsageEvent(
        this PlatformAiUsageRecordContext context,
        Guid userId,
        string periodKey)
    {
        return new UserPlatformAiUsageEvent
        {
            UserId = userId,
            PeriodKey = periodKey,
            TotalTokens = context.TotalTokens,
            InputTokens = context.InputTokens,
            OutputTokens = context.OutputTokens,
            TenantId = context.TenantId,
            AppId = context.AppId,
            CreatedOn = DateTime.UtcNow,
        };
    }
}
