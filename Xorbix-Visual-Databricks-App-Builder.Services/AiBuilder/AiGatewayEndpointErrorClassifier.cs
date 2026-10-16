namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Maps Databricks AI Gateway error payloads to user-facing validation messages.
/// </summary>
internal static class AiGatewayEndpointErrorClassifier
{
    internal static string? TryClassifyUnsupportedEndpoint(string detail)
    {
        if (string.IsNullOrWhiteSpace(detail))
            return null;

        if (detail.Contains("mlflow/v1/embeddings", StringComparison.OrdinalIgnoreCase)
            || (detail.Contains("embeddings", StringComparison.OrdinalIgnoreCase)
                && detail.Contains("API type", StringComparison.OrdinalIgnoreCase)))
        {
            return "This endpoint is an embedding model, not a chat model. AI Builder requires a chat endpoint that supports mlflow/v1/chat/completions.";
        }

        if (detail.Contains("openai/v1/responses", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("mlflow/v1/chat/completions", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "This endpoint requires the OpenAI Responses API. VDAB AI Builder requires mlflow/v1/chat/completions.";
        }

        if (detail.Contains("API type", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase)
            && !detail.Contains("mlflow/v1/chat/completions", StringComparison.OrdinalIgnoreCase))
        {
            return "This endpoint does not support the mlflow/v1/chat/completions API required by AI Builder.";
        }

        if (detail.Contains("reasoning_effort", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "This model rejects reasoning_effort on chat/completions. VDAB strips that parameter automatically; if this error persists, the endpoint may require a different API type.";
        }

        if (detail.Contains("temperature", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "This model rejects temperature and other sampling parameters. VDAB omits those parameters for AI Builder requests.";
        }

        if (detail.Contains("top_p", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "This model rejects top_p and other sampling parameters. VDAB omits those parameters for AI Builder requests.";
        }

        if (detail.Contains("top_k", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase))
        {
            return "This model rejects top_k and other sampling parameters. VDAB omits those parameters for AI Builder requests.";
        }

        if (detail.Contains("thinking.type.enabled", StringComparison.OrdinalIgnoreCase)
            || (detail.Contains("budget_tokens", StringComparison.OrdinalIgnoreCase)
                && detail.Contains("not supported", StringComparison.OrdinalIgnoreCase)))
        {
            return "This model rejects legacy extended-thinking parameters. VDAB omits unsupported thinking blocks for AI Builder requests.";
        }

        if (detail.Contains("custom.strict", StringComparison.OrdinalIgnoreCase)
            && detail.Contains("Extra inputs are not permitted", StringComparison.OrdinalIgnoreCase))
        {
            return "This model rejects strict tool-schema mode on chat/completions. VDAB strips strict from tool definitions automatically; if this error persists, restart the API server to pick up the latest compatibility layer.";
        }

        return null;
    }
}
