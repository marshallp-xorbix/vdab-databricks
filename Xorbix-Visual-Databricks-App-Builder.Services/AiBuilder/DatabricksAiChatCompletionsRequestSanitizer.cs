using System.Text.Json;
using System.Text.Json.Nodes;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Sanitizes outbound Databricks AI Gateway chat-completions JSON so tool-calling requests
/// work across GPT reasoning models and newer Anthropic models.
/// </summary>
public static class DatabricksAiChatCompletionsRequestSanitizer
{
    private static readonly string[] SamplingParameterNames = ["temperature", "top_p", "top_k"];

    /// <summary>
    /// Applies gateway compatibility rules to a chat-completions request body.
    /// Returns the original JSON when parsing fails or no changes are needed.
    /// </summary>
    public static string SanitizeJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return json;

        try
        {
            JsonNode? root = JsonNode.Parse(json);
            if (root is not JsonObject requestObject)
                return json;

            bool changed = SanitizeObject(requestObject);
            return changed ? requestObject.ToJsonString() : json;
        }
        catch (JsonException)
        {
            return json;
        }
    }

    private static bool SanitizeObject(JsonObject requestObject)
    {
        bool changed = false;

        foreach (string parameterName in SamplingParameterNames)
        {
            if (requestObject.Remove(parameterName))
                changed = true;
        }

        if (ShouldRemoveLegacyThinking(requestObject["thinking"]))
        {
            requestObject.Remove("thinking");
            changed = true;
        }

        // Never inject reasoning_effort. Claude and GPT chat endpoints on Databricks reject it
        // with 400 even when set to "none". Strip it when the client or gateway adds it.
        if (requestObject.Remove("reasoning_effort"))
            changed = true;

        if (requestObject["tools"] is JsonArray toolsArray)
        {
            foreach (JsonNode? toolNode in toolsArray)
            {
                if (toolNode is JsonObject toolObject && SanitizeToolObject(toolObject))
                    changed = true;
            }
        }

        return changed;
    }

    private static bool SanitizeToolObject(JsonObject toolObject)
    {
        bool changed = false;

        // Semantic Kernel / OpenAI SDK strict JSON-schema mode is rejected by several
        // Databricks-hosted Claude models (tools.N.custom.strict: Extra inputs are not permitted).
        if (toolObject.Remove("strict"))
            changed = true;

        if (toolObject["function"] is JsonObject functionObject && functionObject.Remove("strict"))
            changed = true;

        if (toolObject["custom"] is JsonObject customObject)
        {
            if (customObject.Remove("strict"))
                changed = true;

            if (customObject.Count == 0)
            {
                toolObject.Remove("custom");
                changed = true;
            }
        }

        return changed;
    }

    private static bool ShouldRemoveLegacyThinking(JsonNode? thinkingNode)
    {
        if (thinkingNode is not JsonObject thinkingObject)
            return false;

        if (thinkingObject.ContainsKey("budget_tokens"))
            return true;

        JsonNode? typeNode = thinkingObject["type"];
        return typeNode is JsonValue typeValue
            && typeValue.TryGetValue(out string? type)
            && string.Equals(type, "enabled", StringComparison.OrdinalIgnoreCase);
    }
}
