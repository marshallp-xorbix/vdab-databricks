using System.Net;
using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Strips or overrides request parameters that break tool calling on Databricks AI Gateway
/// reasoning models before the request reaches the gateway.
/// </summary>
public sealed class DatabricksAiChatCompletionsRequestSanitizerHandler : DelegatingHandler
{
    /// <inheritdoc/>
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (ShouldSanitize(request) && request.Content is not null)
        {
            string originalJson = await request.Content.ReadAsStringAsync(cancellationToken);
            string sanitizedJson = DatabricksAiChatCompletionsRequestSanitizer.SanitizeJson(originalJson);
            if (!string.Equals(originalJson, sanitizedJson, StringComparison.Ordinal))
            {
                request.Content = new StringContent(sanitizedJson, Encoding.UTF8, "application/json");
            }
        }

        return await base.SendAsync(request, cancellationToken);
    }

    private static bool ShouldSanitize(HttpRequestMessage request)
    {
        return request.Method == HttpMethod.Post
            && request.RequestUri is not null
            && request.RequestUri.AbsolutePath.Contains("chat/completions", StringComparison.OrdinalIgnoreCase);
    }
}
