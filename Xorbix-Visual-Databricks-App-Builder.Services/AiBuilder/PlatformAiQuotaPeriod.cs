using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// UTC calendar-month helpers for platform AI Builder token quotas.
/// </summary>
public static class PlatformAiQuotaPeriod
{
    /// <summary>
    /// Returns the current UTC period key in <c>yyyy-MM</c> format.
    /// </summary>
    public static string GetCurrentPeriodKey(DateTime utcNow)
    {
        return utcNow.ToString(PlatformAiQuotaDefaults.PeriodKeyFormat);
    }

    /// <summary>
    /// Returns the instant when the current UTC calendar month ends and usage resets.
    /// </summary>
    public static DateTime GetResetsAtUtc(DateTime utcNow)
    {
        DateTime firstDayOfMonth = new(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return firstDayOfMonth.AddMonths(1);
    }

    /// <summary>
    /// Calculates whole-number percent used, capped at 100.
    /// </summary>
    public static int CalculatePercentUsed(long tokensUsed, long tokenLimit)
    {
        if (tokenLimit <= 0)
        {
            return 0;
        }

        double percent = tokensUsed * 100.0 / tokenLimit;
        int rounded = (int)Math.Floor(percent);
        return Math.Clamp(rounded, 0, 100);
    }
}
