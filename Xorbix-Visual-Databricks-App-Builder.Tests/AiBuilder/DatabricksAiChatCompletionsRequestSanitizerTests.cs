using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class DatabricksAiChatCompletionsRequestSanitizerTests
{
    [Fact]
    public void SanitizeJson_WithTools_RemovesReasoningEffortWhenPresent()
    {
        string input = """
            {
              "model": "databricks-gpt-5-4",
              "messages": [{ "role": "user", "content": "ping" }],
              "tools": [{ "type": "function", "function": { "name": "ping" } }],
              "reasoning_effort": "none"
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        Assert.False(document.RootElement.TryGetProperty("reasoning_effort", out _));
    }

    [Fact]
    public void SanitizeJson_WithTools_DoesNotInjectReasoningEffort()
    {
        string input = """
            {
              "model": "databricks-claude-sonnet-4-6",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{ "type": "function", "function": { "name": "ping" } }]
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        Assert.False(document.RootElement.TryGetProperty("reasoning_effort", out _));
    }

    [Fact]
    public void SanitizeJson_RemovesSamplingParameters()
    {
        string input = """
            {
              "model": "databricks-claude-opus-4-8",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{ "type": "function", "function": { "name": "ping" } }],
              "temperature": 1,
              "top_p": 0.9,
              "top_k": 40
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        JsonElement root = document.RootElement;
        Assert.False(root.TryGetProperty("temperature", out _));
        Assert.False(root.TryGetProperty("top_p", out _));
        Assert.False(root.TryGetProperty("top_k", out _));
    }

    [Fact]
    public void SanitizeJson_RemovesLegacyThinkingEnabled()
    {
        string input = """
            {
              "model": "databricks-claude-sonnet-5",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{ "type": "function", "function": { "name": "ping" } }],
              "thinking": { "type": "enabled", "budget_tokens": 1024 }
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        Assert.False(document.RootElement.TryGetProperty("thinking", out _));
    }

    [Fact]
    public void SanitizeJson_WithoutTools_RemovesReasoningEffortWhenPresent()
    {
        string input = """
            {
              "model": "databricks-gpt-5-5",
              "messages": [{ "role": "user", "content": "hello" }],
              "reasoning_effort": "medium"
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        Assert.False(document.RootElement.TryGetProperty("reasoning_effort", out _));
    }

    [Fact]
    public void SanitizeJson_WithTools_RemovesFunctionStrict()
    {
        string input = """
            {
              "model": "databricks-claude-opus-4-8",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{
                "type": "function",
                "function": {
                  "name": "add_component",
                  "strict": true,
                  "parameters": { "type": "object", "properties": {} }
                }
              }]
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        JsonElement function = document.RootElement.GetProperty("tools")[0].GetProperty("function");
        Assert.False(function.TryGetProperty("strict", out _));
    }

    [Fact]
    public void SanitizeJson_WithTools_RemovesCustomStrict()
    {
        string input = """
            {
              "model": "databricks-claude-sonnet-5",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{
                "type": "custom",
                "custom": {
                  "name": "add_component",
                  "strict": true
                }
              }]
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        using JsonDocument document = JsonDocument.Parse(result);
        JsonElement custom = document.RootElement.GetProperty("tools")[0].GetProperty("custom");
        Assert.False(custom.TryGetProperty("strict", out _));
        Assert.Equal("add_component", custom.GetProperty("name").GetString());
    }

    [Fact]
    public void SanitizeJson_InvalidJson_ReturnsOriginal()
    {
        const string input = "not-json";

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        Assert.Equal(input, result);
    }

    [Fact]
    public void SanitizeJson_WithNonStringThinkingType_DoesNotThrow()
    {
        const string input = """
            {
              "model": "databricks-claude-sonnet-4-6",
              "messages": [{ "role": "user", "content": "hello" }],
              "thinking": { "type": 1 }
            }
            """;

        string result = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(input);

        Assert.Equal(input, result);
    }
}
