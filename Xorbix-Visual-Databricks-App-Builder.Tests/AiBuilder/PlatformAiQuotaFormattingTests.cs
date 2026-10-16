using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class PlatformAiQuotaFormattingTests
{
    [Theory]
    [InlineData(100_000, "100k")]
    [InlineData(500, "500")]
    public void FormatTokenLimitLabel_FormatsExpectedValues(long tokenLimit, string expectedLabel)
    {
        string label = PlatformAiQuotaFormatting.FormatTokenLimitLabel(tokenLimit);

        Assert.Equal(expectedLabel, label);
    }

    [Fact]
    public void BuildExceededMessage_IncludesLimitAndResetDate()
    {
        DateTime resetsAtUtc = new(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);

        string message = PlatformAiQuotaFormatting.BuildExceededMessage(100_000, resetsAtUtc);

        Assert.Contains("100k", message);
        Assert.Contains("August 1, 2026", message);
        Assert.Contains("tenant AI model", message);
    }
}
