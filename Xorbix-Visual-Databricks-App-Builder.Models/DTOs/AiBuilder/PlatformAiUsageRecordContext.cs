namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// Optional session context stored with a platform AI usage ledger event.
/// </summary>
public class PlatformAiUsageRecordContext
{
    public Guid? TenantId { get; init; }

    public int? AppId { get; init; }

    public int TotalTokens { get; init; }

    public int? InputTokens { get; init; }

    public int? OutputTokens { get; init; }
}
