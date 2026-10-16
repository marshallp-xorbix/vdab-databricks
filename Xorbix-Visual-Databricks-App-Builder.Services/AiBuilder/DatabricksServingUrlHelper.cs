namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Builds the Databricks Model Serving base URL from a workspace URL.
/// </summary>
internal static class DatabricksServingUrlHelper
{
    /// <summary>
    /// Returns the AI Gateway base URL for the given workspace, or empty when the workspace URL is blank.
    /// </summary>
    internal static string BuildServingBaseUrl(string workspaceUrl)
    {
        if (string.IsNullOrWhiteSpace(workspaceUrl))
            return string.Empty;

        string normalizedWorkspaceUrl = workspaceUrl.EndsWith('/') ? workspaceUrl : workspaceUrl + "/";
        return $"{normalizedWorkspaceUrl}ai-gateway/mlflow/v1";
    }

    /// <summary>
    /// Returns the OpenAI-compatible chat completions URL for the workspace AI Gateway.
    /// </summary>
    internal static string BuildChatCompletionsUrl(string workspaceUrl)
    {
        string baseUrl = BuildServingBaseUrl(workspaceUrl);
        if (string.IsNullOrWhiteSpace(baseUrl))
            return string.Empty;

        return $"{baseUrl.TrimEnd('/')}/chat/completions";
    }
}
