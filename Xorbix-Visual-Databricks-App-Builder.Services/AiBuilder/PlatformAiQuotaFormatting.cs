using System.Globalization;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Formats platform AI Builder quota labels and user-facing messages.
/// </summary>
internal static class PlatformAiQuotaFormatting
{
    internal static string FormatTokenLimitLabel(long tokenLimit)
    {
        if (tokenLimit >= PlatformAiQuotaDefaults.TokensPerThousandDivisor)
        {
            long thousands = tokenLimit / PlatformAiQuotaDefaults.TokensPerThousandDivisor;
            return $"{thousands}k";
        }

        return tokenLimit.ToString();
    }

    internal static string BuildExceededMessage(long tokenLimit, DateTime resetsAtUtc)
    {
        string limitLabel = FormatTokenLimitLabel(tokenLimit);
        return string.Format(
            CultureInfo.InvariantCulture,
            PlatformAiQuotaMessages.ExceededMessageTemplate,
            limitLabel,
            resetsAtUtc);
    }
}
