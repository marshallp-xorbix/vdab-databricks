using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class DatabricksServingUrlHelperTests
{
    [Theory]
    [InlineData("", "")]
    [InlineData("   ", "")]
    public void BuildServingBaseUrl_ReturnsEmpty_WhenWorkspaceUrlMissing(string workspaceUrl, string expected)
    {
        string result = DatabricksServingUrlHelper.BuildServingBaseUrl(workspaceUrl);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void BuildServingBaseUrl_AppendsAiGatewayPath_WithTrailingSlash()
    {
        string result = DatabricksServingUrlHelper.BuildServingBaseUrl("https://adb-123.azuredatabricks.net/");

        Assert.Equal("https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1", result);
    }

    [Fact]
    public void BuildServingBaseUrl_NormalizesMissingTrailingSlash()
    {
        string result = DatabricksServingUrlHelper.BuildServingBaseUrl("https://adb-123.azuredatabricks.net");

        Assert.Equal("https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1", result);
    }

    [Fact]
    public void BuildChatCompletionsUrl_AppendsChatCompletionsUnderV1()
    {
        string result = DatabricksServingUrlHelper.BuildChatCompletionsUrl("https://adb-123.azuredatabricks.net");

        Assert.Equal("https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1/chat/completions", result);
    }
}
