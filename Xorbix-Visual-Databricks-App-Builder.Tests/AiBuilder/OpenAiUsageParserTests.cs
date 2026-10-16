using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class OpenAiUsageParserTests
{
    [Fact]
    public void TryParseTotalTokens_ReadsTotalTokensField()
    {
        const string body = """
            {
              "choices": [],
              "usage": {
                "prompt_tokens": 120,
                "completion_tokens": 30,
                "total_tokens": 150
              }
            }
            """;

        bool parsed = OpenAiUsageParser.TryParseTotalTokens(body, out int totalTokens, out int? inputTokens, out int? outputTokens);

        Assert.True(parsed);
        Assert.Equal(150, totalTokens);
        Assert.Equal(120, inputTokens);
        Assert.Equal(30, outputTokens);
    }

    [Fact]
    public void TryParseTotalTokens_SumsPromptAndCompletionWhenTotalMissing()
    {
        const string body = """
            {
              "usage": {
                "prompt_tokens": 200,
                "completion_tokens": 50
              }
            }
            """;

        bool parsed = OpenAiUsageParser.TryParseTotalTokens(body, out int totalTokens, out int? inputTokens, out int? outputTokens);

        Assert.True(parsed);
        Assert.Equal(250, totalTokens);
        Assert.Equal(200, inputTokens);
        Assert.Equal(50, outputTokens);
    }

    [Fact]
    public void TryParseTotalTokens_ReturnsFalse_WhenUsageMissing()
    {
        bool parsed = OpenAiUsageParser.TryParseTotalTokens("{}", out int totalTokens, out _, out _);

        Assert.False(parsed);
        Assert.Equal(0, totalTokens);
    }
}
