using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class PageWidthBoundsTests
{
    [Theory]
    [InlineData(null, PageWidthBounds.DefaultPixels)]
    [InlineData("", PageWidthBounds.DefaultPixels)]
    [InlineData("   ", PageWidthBounds.DefaultPixels)]
    [InlineData("not-a-number", PageWidthBounds.DefaultPixels)]
    public void Parse_InvalidOrMissing_ReturnsDefault(string? value, int expected)
    {
        Assert.Equal(expected, PageWidthBounds.Parse(value));
    }

    [Theory]
    [InlineData("730", PageWidthBounds.DefaultPixels)]
    [InlineData("1100", 1100)]
    public void Parse_ValidValue_ReturnsClampedWidth(string value, int expected)
    {
        Assert.Equal(expected, PageWidthBounds.Parse(value));
    }

    [Theory]
    [InlineData("500", PageWidthBounds.MinPixels)]
    [InlineData("2000", PageWidthBounds.MaxPixels)]
    public void Parse_OutOfRange_ClampsToBounds(string value, int expected)
    {
        Assert.Equal(expected, PageWidthBounds.Parse(value));
    }

    [Theory]
    [InlineData("-100", PageWidthBounds.MinPixels)]
    [InlineData("1100.5", 1101)]
    [InlineData("2000000000000", PageWidthBounds.MaxPixels)]
    public void Parse_NumericEdgeCases_MatchFrontend(string value, int expected)
    {
        Assert.Equal(expected, PageWidthBounds.Parse(value));
    }

    [Theory]
    [InlineData(500, PageWidthBounds.MinPixels)]
    [InlineData(730, 730)]
    [InlineData(1800, 1800)]
    [InlineData(2000, PageWidthBounds.MaxPixels)]
    public void Clamp_OutOfRangeOrInRange_ReturnsExpected(int value, int expected)
    {
        Assert.Equal(expected, PageWidthBounds.Clamp(value));
    }

    [Fact]
    public void DefaultPixels_MatchesMinPixels()
    {
        Assert.Equal(PageWidthBounds.MinPixels, PageWidthBounds.DefaultPixels);
    }
}
