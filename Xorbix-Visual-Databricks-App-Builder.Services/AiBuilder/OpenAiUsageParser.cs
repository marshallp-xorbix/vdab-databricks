using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Parses OpenAI-compatible chat completion usage from JSON response bodies.
/// </summary>
public static class OpenAiUsageParser
{
    /// <summary>
    /// Attempts to read token usage from an OpenAI-compatible chat completions response body.
    /// </summary>
    public static bool TryParseTotalTokens(string responseBody, out int totalTokens, out int? inputTokens, out int? outputTokens)
    {
        totalTokens = 0;
        inputTokens = null;
        outputTokens = null;

        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return false;
        }

        try
        {
            using JsonDocument document = JsonDocument.Parse(responseBody);
            if (!document.RootElement.TryGetProperty(OpenAiChatCompletionJsonProperties.Usage, out JsonElement usageElement))
            {
                return false;
            }

            if (usageElement.TryGetProperty(OpenAiChatCompletionJsonProperties.TotalTokens, out JsonElement totalElement)
                && totalElement.TryGetInt32(out int parsedTotal))
            {
                totalTokens = parsedTotal;
            }
            else
            {
                int promptTokens = 0;
                int completionTokens = 0;
                bool hasPrompt = usageElement.TryGetProperty(OpenAiChatCompletionJsonProperties.PromptTokens, out JsonElement promptElement)
                    && promptElement.TryGetInt32(out promptTokens);
                bool hasCompletion = usageElement.TryGetProperty(OpenAiChatCompletionJsonProperties.CompletionTokens, out JsonElement completionElement)
                    && completionElement.TryGetInt32(out completionTokens);

                if (!hasPrompt && !hasCompletion)
                {
                    return false;
                }

                totalTokens = promptTokens + completionTokens;
            }

            if (usageElement.TryGetProperty(OpenAiChatCompletionJsonProperties.PromptTokens, out JsonElement inputElement)
                && inputElement.TryGetInt32(out int parsedInput))
            {
                inputTokens = parsedInput;
            }

            if (usageElement.TryGetProperty(OpenAiChatCompletionJsonProperties.CompletionTokens, out JsonElement outputElement)
                && outputElement.TryGetInt32(out int parsedOutput))
            {
                outputTokens = parsedOutput;
            }

            return totalTokens > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
