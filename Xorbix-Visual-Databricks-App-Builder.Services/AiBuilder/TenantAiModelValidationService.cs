using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <inheritdoc/>
public class TenantAiModelValidationService : ITenantAiModelValidationService
{
    private const string PingFunctionName = "ping";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TenantAiModelValidationService> _logger;

    public TenantAiModelValidationService(
        IHttpClientFactory httpClientFactory,
        ILogger<TenantAiModelValidationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result> ValidateEndpointAsync(
        string workspaceUrl,
        string endpointName,
        string accessToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(workspaceUrl)
            || string.IsNullOrWhiteSpace(endpointName)
            || string.IsNullOrWhiteSpace(accessToken))
        {
            return Result.Fail(new ValidationError("Workspace URL, endpoint name, and access token are required."));
        }

        string chatCompletionsUrl = DatabricksServingUrlHelper.BuildChatCompletionsUrl(workspaceUrl);
        if (!Uri.TryCreate(chatCompletionsUrl, UriKind.Absolute, out Uri? requestUri))
        {
            return Result.Fail(new ValidationError("Workspace URL is not valid for Databricks AI Gateway."));
        }

        Uri requestUriValue = requestUri;
        object payload = BuildValidationPayload(endpointName.Trim());

        HttpClient client = _httpClientFactory.CreateClient(DatabricksAiConfiguration.HttpClientName);
        using HttpRequestMessage request = new(HttpMethod.Post, requestUriValue);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = JsonContent.Create(payload);

        try
        {
            using HttpResponseMessage response = await client.SendAsync(request, cancellationToken);
            string content = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return Result.Fail(new BadRequestError(
                    BuildHttpFailureMessage(response.StatusCode, endpointName, requestUriValue, content, response.Headers)));
            }

            if (TryParsePingToolCall(content, out _))
                return Result.Ok();

            _logger.LogWarning(
                "Tenant AI model validation did not detect a ping tool call for endpoint {EndpointName}. Response: {ResponseBody}",
                endpointName,
                TruncateForLog(content));

            return Result.Fail(new BadRequestError(
                "Serving endpoint did not return a function call. AI Builder requires a model that supports tool calling."));
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(ex, "Tenant AI model validation timed out for endpoint {EndpointName}", endpointName);
            return Result.Fail(new BadRequestError("Serving endpoint validation timed out."));
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Tenant AI model validation request failed for endpoint {EndpointName}", endpointName);
            return Result.Fail(new BadRequestError("Serving endpoint could not be reached."));
        }
    }

    /// <summary>
    /// Builds the registration ping. Temperature and reasoning_effort are omitted so
    /// Claude/GPT endpoints use provider defaults compatible with tool calling.
    /// </summary>
    internal static object BuildValidationPayload(string endpointName) => new
    {
        model = endpointName,
        messages = new[]
        {
            new { role = "user", content = "Respond using the ping tool." },
        },
        tools = new[]
        {
            new
            {
                type = "function",
                function = new
                {
                    name = PingFunctionName,
                    description = "Connectivity check for AI Builder.",
                    parameters = new { type = "object", properties = new { } },
                },
            },
        },
        tool_choice = "required",
        max_tokens = 64,
    };

    internal static bool TryParsePingToolCall(string content, out ValidationChatCompletionResponse? parsed)
    {
        parsed = JsonSerializer.Deserialize<ValidationChatCompletionResponse>(
            content,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (parsed?.Choices is null)
            return false;

        foreach (ValidationChoice choice in parsed.Choices)
        {
            ValidationMessage? message = choice.Message;
            if (message is null)
                continue;

            if (message.ToolCalls?.Any(tool =>
                    string.Equals(tool.Function?.Name, PingFunctionName, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(tool.Name, PingFunctionName, StringComparison.OrdinalIgnoreCase)) == true)
            {
                return true;
            }

            if (string.Equals(message.FunctionCall?.Name, PingFunctionName, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private string BuildHttpFailureMessage(
        HttpStatusCode statusCode,
        string endpointName,
        Uri requestUri,
        string content,
        System.Net.Http.Headers.HttpResponseHeaders headers)
    {
        string reasonPhrase = headers.TryGetValues("x-databricks-reason-phrase", out IEnumerable<string>? values)
            ? string.Join(", ", values)
            : string.Empty;
        string detail = string.IsNullOrWhiteSpace(content)
            ? reasonPhrase
            : string.IsNullOrWhiteSpace(reasonPhrase)
                ? content
                : $"{reasonPhrase} — {content}";

        _logger.LogWarning(
            "Tenant AI model validation failed with status {StatusCode} for endpoint {EndpointName} at {RequestUrl}. Detail: {Detail}",
            (int)statusCode,
            endpointName,
            requestUri,
            detail);

        string? classified = AiGatewayEndpointErrorClassifier.TryClassifyUnsupportedEndpoint(detail);
        if (classified is not null)
            return classified;

        string userMessage = (int)statusCode switch
        {
            401 => "Serving endpoint validation failed (401 Unauthorized). Verify the PAT was generated in the same workspace, has not expired, and has permission to query this endpoint via AI Gateway.",
            403 => "Serving endpoint validation failed (403 Forbidden). Grant your user or service principal Can Query on this serving endpoint.",
            _ => $"Serving endpoint validation failed ({(int)statusCode}). Verify the endpoint name and access token.",
        };

        if (!string.IsNullOrWhiteSpace(detail))
            userMessage = $"{userMessage} Databricks response: {detail}";

        return userMessage;
    }

    private static string TruncateForLog(string content, int maxLength = 2000)
    {
        if (content.Length <= maxLength)
            return content;

        return content[..maxLength] + "...";
    }

    internal sealed class ValidationChatCompletionResponse
    {
        [JsonPropertyName("choices")]
        public List<ValidationChoice>? Choices { get; set; }
    }

    internal sealed class ValidationChoice
    {
        [JsonPropertyName("message")]
        public ValidationMessage? Message { get; set; }
    }

    internal sealed class ValidationMessage
    {
        [JsonPropertyName("tool_calls")]
        public List<ValidationToolCall>? ToolCalls { get; set; }

        [JsonPropertyName("function_call")]
        public ValidationFunction? FunctionCall { get; set; }
    }

    internal sealed class ValidationToolCall
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("function")]
        public ValidationFunction? Function { get; set; }
    }

    internal sealed class ValidationFunction
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
