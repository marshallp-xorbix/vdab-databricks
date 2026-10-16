using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class PlatformAiQuotaPeriodTests
{
    [Theory]
    [InlineData(99_999, 100_000, 99)]
    [InlineData(100_000, 100_000, 100)]
    [InlineData(0, 100_000, 0)]
    [InlineData(50_000, 100_000, 50)]
    public void CalculatePercentUsed_FloorsFractionalUsage(long tokensUsed, long tokenLimit, int expectedPercent)
    {
        int percentUsed = PlatformAiQuotaPeriod.CalculatePercentUsed(tokensUsed, tokenLimit);

        Assert.Equal(expectedPercent, percentUsed);
    }

    [Fact]
    public void CalculatePercentUsed_ReturnsZero_WhenLimitIsZero()
    {
        int percentUsed = PlatformAiQuotaPeriod.CalculatePercentUsed(50_000, 0);

        Assert.Equal(0, percentUsed);
    }
}
