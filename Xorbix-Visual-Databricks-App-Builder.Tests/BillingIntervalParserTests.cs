using Xorbix_Visual_Databricks_App_Builder.Models.Billing;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class BillingIntervalParserTests
{
    [Theory]
    [InlineData("monthly", BillingInterval.Monthly)]
    [InlineData("month", BillingInterval.Monthly)]
    [InlineData("Monthly", BillingInterval.Monthly)]
    [InlineData("MONTHLY", BillingInterval.Monthly)]
    // "annual" is the client UI vocabulary that a plain Enum.TryParse rejected.
    [InlineData("annual", BillingInterval.Yearly)]
    [InlineData("annually", BillingInterval.Yearly)]
    [InlineData("yearly", BillingInterval.Yearly)]
    [InlineData("year", BillingInterval.Yearly)]
    [InlineData("Yearly", BillingInterval.Yearly)]
    [InlineData("  Annual  ", BillingInterval.Yearly)]
    public void TryParse_RecognizedInterval_ReturnsTrueAndParsedValue(
        string value,
        BillingInterval expected)
    {
        bool result = BillingIntervalParser.TryParse(value, out BillingInterval interval);

        Assert.True(result);
        Assert.Equal(expected, interval);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("weekly")]
    [InlineData("0")]
    public void TryParse_UnrecognizedOrEmpty_ReturnsFalseAndDefaultsToMonthly(string? value)
    {
        bool result = BillingIntervalParser.TryParse(value, out BillingInterval interval);

        Assert.False(result);
        Assert.Equal(BillingInterval.Monthly, interval);
    }
}
