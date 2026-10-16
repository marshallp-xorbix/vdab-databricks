namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>
/// Current-month platform AI Builder token usage for the authenticated user.
/// </summary>
public class PlatformAiUsageDto
{
    public long TokensUsed { get; set; }

    public long TokenLimit { get; set; }

    public string PeriodKey { get; set; } = string.Empty;

    public DateTime ResetsAtUtc { get; set; }

    public int PercentUsed { get; set; }

    public bool IsLimitReached { get; set; }

    public bool IsEnforcementEnabled { get; set; }
}
