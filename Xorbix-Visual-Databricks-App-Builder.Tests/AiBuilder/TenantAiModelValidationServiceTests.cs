using System.Net;
using System.Text;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class TenantAiModelValidationServiceTests
{
    [Fact]
    public async Task ValidateEndpointAsync_UsesV1ChatCompletionsUrl()
    {
        Uri? capturedUri = null;
        TenantAiModelValidationService service = CreateService(
            HttpStatusCode.OK,
            """
            {
              "choices": [
                {
                  "message": {
                    "tool_calls": [
                      { "function": { "name": "ping" } }
                    ]
                  }
                }
              ]
            }
            """,
            request => capturedUri = request.RequestUri);

        await service.ValidateEndpointAsync(
            "https://adb-123.azuredatabricks.net",
            "databricks-claude-sonnet-4-6",
            "token");

        Assert.NotNull(capturedUri);
        Assert.Equal(
            "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1/chat/completions",
            capturedUri!.AbsoluteUri);
    }

    [Fact]
    public async Task ValidateEndpointAsync_SuccessfulToolCall_ReturnsSuccess()
    {
        string responseBody = """
            {
              "choices": [
                {
                  "message": {
                    "tool_calls": [
                      { "function": { "name": "ping" } }
                    ]
                  }
                }
              ]
            }
            """;

        TenantAiModelValidationService service = CreateService(HttpStatusCode.OK, responseBody);

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "team-endpoint",
            "token");

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task ValidateEndpointAsync_SuccessfulLegacyFunctionCall_ReturnsSuccess()
    {
        string responseBody = """
            {
              "choices": [
                {
                  "message": {
                    "function_call": {
                      "name": "ping",
                      "arguments": "{}"
                    }
                  }
                }
              ]
            }
            """;

        TenantAiModelValidationService service = CreateService(HttpStatusCode.OK, responseBody);

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "databricks-claude-sonnet-5",
            "token");

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task ValidateEndpointAsync_OmitsTemperatureAndUsesRequiredToolChoice()
    {
        string? capturedBody = null;
        TenantAiModelValidationService service = CreateService(
            HttpStatusCode.OK,
            """
            {
              "choices": [
                {
                  "message": {
                    "tool_calls": [
                      { "function": { "name": "ping" } }
                    ]
                  }
                }
              ]
            }
            """,
            request =>
            {
                capturedBody = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            });

        await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "databricks-gpt-5-5",
            "token");

        Assert.NotNull(capturedBody);
        Assert.DoesNotContain("\"temperature\"", capturedBody, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"tool_choice\":\"required\"", capturedBody, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateEndpointAsync_UnsupportedResponsesApi_ReturnsClearError()
    {
        TenantAiModelValidationService service = CreateService(
            HttpStatusCode.BadRequest,
            """
            {
              "error_code": "BAD_REQUEST",
              "message": "API type 'mlflow/v1/chat/completions' is not supported by 'databricks-gpt-5-3-codex'. Supported API types: [openai/v1/responses, cursor/v1/chat/completions]."
            }
            """);

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "databricks-gpt-5-3-codex",
            "token");

        Assert.True(result.IsFailed);
        Assert.Contains("OpenAI Responses API", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateEndpointAsync_UnsupportedResponsesApi_ThroughHandlerPipeline_ReturnsClearError()
    {
        const string errorBody = """
            {
              "error_code": "BAD_REQUEST",
              "message": "API type 'mlflow/v1/chat/completions' is not supported by 'databricks-gpt-5-3-codex'. Supported API types: [openai/v1/responses, cursor/v1/chat/completions]."
            }
            """;

        TenantAiModelValidationService service = CreateServiceWithHandlerPipeline(
            HttpStatusCode.BadRequest,
            errorBody);

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "databricks-gpt-5-3-codex",
            "token");

        Assert.True(result.IsFailed);
        Assert.Contains("OpenAI Responses API", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(
            "Serving endpoint could not be reached.",
            result.Errors[0].Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void TryParsePingToolCall_LegacyFunctionCall_ReturnsTrue()
    {
        bool found = TenantAiModelValidationService.TryParsePingToolCall(
            """
            {
              "choices": [
                {
                  "message": {
                    "function_call": { "name": "ping" }
                  }
                }
              ]
            }
            """,
            out _);

        Assert.True(found);
    }

    [Fact]
    public async Task ValidateEndpointAsync_NoToolCall_ReturnsValidationError()
    {
        string responseBody = """
            {
              "choices": [
                {
                  "message": {
                    "content": "hello"
                  }
                }
              ]
            }
            """;

        TenantAiModelValidationService service = CreateService(HttpStatusCode.OK, responseBody);

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "team-endpoint",
            "token");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
    }

    [Fact]
    public async Task ValidateEndpointAsync_Unauthorized_ReturnsValidationError()
    {
        TenantAiModelValidationService service = CreateService(HttpStatusCode.Unauthorized, "{}");

        Result result = await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "team-endpoint",
            "token");

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<BadRequestError>());
    }

    [Fact]
    public async Task ValidateEndpointAsync_OmitsReasoningEffortForAllModels()
    {
        string? capturedBody = null;
        TenantAiModelValidationService service = CreateService(
            HttpStatusCode.OK,
            """
            {
              "choices": [
                {
                  "message": {
                    "tool_calls": [
                      { "function": { "name": "ping" } }
                    ]
                  }
                }
              ]
            }
            """,
            request =>
            {
                capturedBody = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            });

        await service.ValidateEndpointAsync(
            "https://dbc.test.azuredatabricks.net",
            "databricks-gpt-5-4",
            "token");

        Assert.NotNull(capturedBody);
        using JsonDocument document = JsonDocument.Parse(capturedBody!);
        Assert.False(document.RootElement.TryGetProperty("reasoning_effort", out _));
        Assert.Equal("required", document.RootElement.GetProperty("tool_choice").GetString());
    }

    private static TenantAiModelValidationService CreateService(
        HttpStatusCode statusCode,
        string body,
        Action<HttpRequestMessage>? onRequest = null)
    {
        Mock<HttpMessageHandler> handler = new();
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((request, _) => onRequest?.Invoke(request))
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });

        HttpClient client = new(handler.Object);
        Mock<IHttpClientFactory> httpClientFactory = new();
        httpClientFactory
            .Setup(f => f.CreateClient(It.IsAny<string>()))
            .Returns(client);

        return new TenantAiModelValidationService(
            httpClientFactory.Object,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<TenantAiModelValidationService>.Instance);
    }

    private static TenantAiModelValidationService CreateServiceWithHandlerPipeline(
        HttpStatusCode statusCode,
        string body,
        Action<HttpRequestMessage>? onRequest = null)
    {
        Mock<HttpMessageHandler> innerHandler = new();
        innerHandler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((request, _) => onRequest?.Invoke(request))
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });

        Mock<ICurrentUserService> currentUserService = new();
        currentUserService.Setup(service => service.GetUserEmail()).Returns("user@example.com");
        currentUserService.Setup(service => service.GetUserId()).Returns((Guid?)null);

        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        DatabricksAiRequestTaggingHandler taggingHandler = new(
            currentUserService.Object,
            new AsyncLocalAiBuilderGatewayTagContext(),
            quotaService.Object,
            NullLogger<DatabricksAiRequestTaggingHandler>.Instance)
        {
            InnerHandler = innerHandler.Object,
        };

        DatabricksAiChatCompletionsRequestSanitizerHandler sanitizerHandler = new()
        {
            InnerHandler = taggingHandler,
        };

        HttpClient client = new(sanitizerHandler);
        Mock<IHttpClientFactory> httpClientFactory = new();
        httpClientFactory
            .Setup(f => f.CreateClient(It.IsAny<string>()))
            .Returns(client);

        return new TenantAiModelValidationService(
            httpClientFactory.Object,
            NullLogger<TenantAiModelValidationService>.Instance);
    }
}
