using System.Net;
using System.Text;
using System.Text.Json;
using FluentResults;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class DatabricksAiChatCompletionsRequestSanitizerHandlerTests
{
    [Fact]
    public async Task SendAsync_ChatCompletionsPost_SanitizesRequestBody()
    {
        CapturingHandler inner = new();
        DatabricksAiChatCompletionsRequestSanitizerHandler handler = new() { InnerHandler = inner };
        using HttpMessageInvoker invoker = new(handler);

        string requestBody = """
            {
              "model": "databricks-gpt-5-4",
              "messages": [{ "role": "user", "content": "ping" }],
              "tools": [{ "type": "function", "function": { "name": "ping" } }],
              "temperature": 1,
              "reasoning_effort": "none"
            }
            """;

        using HttpRequestMessage request = new(
            HttpMethod.Post,
            "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1/chat/completions")
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json"),
        };

        await invoker.SendAsync(request, CancellationToken.None);

        Assert.NotNull(inner.CapturedRequest?.Content);
        string capturedBody = await inner.CapturedRequest.Content!.ReadAsStringAsync();
        using JsonDocument document = JsonDocument.Parse(capturedBody);
        Assert.False(document.RootElement.TryGetProperty("reasoning_effort", out _));
        Assert.False(document.RootElement.TryGetProperty("temperature", out _));
    }

    [Fact]
    public async Task SendAsync_NonChatCompletionsUrl_LeavesBodyUnchanged()
    {
        CapturingHandler inner = new();
        DatabricksAiChatCompletionsRequestSanitizerHandler handler = new() { InnerHandler = inner };
        using HttpMessageInvoker invoker = new(handler);

        const string requestBody = """{ "model": "test", "temperature": 1 }""";
        using HttpRequestMessage request = new(
            HttpMethod.Post,
            "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1/embeddings")
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json"),
        };

        await invoker.SendAsync(request, CancellationToken.None);

        string capturedBody = await inner.CapturedRequest!.Content!.ReadAsStringAsync();
        Assert.Equal(requestBody, capturedBody);
    }

    [Fact]
    public async Task SendAsync_ThroughSanitizerAndTagging_RecordsPlatformUsage()
    {
        Guid userId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");
        Guid tenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        gatewayTagContext
            .Setup(context => context.TryGet(out It.Ref<AiBuilderGatewayTags?>.IsAny))
            .Returns((out AiBuilderGatewayTags? tags) =>
            {
                tags = new AiBuilderGatewayTags
                {
                    TenantId = tenantId,
                    UserId = userId,
                    AppId = 42,
                    ModelSource = AiModelSource.Platform,
                    EndpointName = "vdab-default",
                };
                return true;
            });

        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        const string responseBody = """{"usage":{"total_tokens":250,"prompt_tokens":150,"completion_tokens":100}}""";
        CapturingHandler inner = new(responseBody);
        DatabricksAiRequestTaggingHandler taggingHandler = CreateTaggingHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object,
            platformAiQuotaService: quotaService.Object,
            userId: userId);
        DatabricksAiChatCompletionsRequestSanitizerHandler sanitizerHandler = new()
        {
            InnerHandler = taggingHandler,
        };

        using HttpMessageInvoker invoker = new(sanitizerHandler);
        string requestBody = """
            {
              "model": "databricks-claude-sonnet-4-6",
              "messages": [{ "role": "user", "content": "hello" }],
              "tools": [{
                "type": "function",
                "function": { "name": "add_component", "strict": true }
              }],
              "temperature": 1
            }
            """;
        using HttpRequestMessage request = new(
            HttpMethod.Post,
            "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1/chat/completions")
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json"),
        };

        await invoker.SendAsync(request, CancellationToken.None);

        Assert.NotNull(inner.CapturedRequest?.Content);
        string sanitizedBody = await inner.CapturedRequest.Content!.ReadAsStringAsync();
        using (JsonDocument document = JsonDocument.Parse(sanitizedBody))
        {
            JsonElement function = document.RootElement.GetProperty("tools")[0].GetProperty("function");
            Assert.False(function.TryGetProperty("strict", out _));
            Assert.False(document.RootElement.TryGetProperty("temperature", out _));
        }

        quotaService.Verify(
            service => service.EnsureCanUsePlatformModelAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
        quotaService.Verify(
            service => service.RecordUsageAsync(
                userId,
                It.Is<PlatformAiUsageRecordContext>(context =>
                    context.TotalTokens == 250
                    && context.InputTokens == 150
                    && context.OutputTokens == 100
                    && context.AppId == 42
                    && context.TenantId == tenantId),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static DatabricksAiRequestTaggingHandler CreateTaggingHandler(
        HttpMessageHandler inner,
        string? email,
        IAiBuilderGatewayTagContext gatewayTagContext,
        IPlatformAiQuotaService platformAiQuotaService,
        Guid? userId = null)
    {
        Mock<ICurrentUserService> currentUserService = new();
        currentUserService.Setup(service => service.GetUserEmail()).Returns(email);
        currentUserService.Setup(service => service.GetUserId()).Returns(userId);

        return new DatabricksAiRequestTaggingHandler(
            currentUserService.Object,
            gatewayTagContext,
            platformAiQuotaService,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<DatabricksAiRequestTaggingHandler>.Instance)
        {
            InnerHandler = inner,
        };
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly string _responseBody;

        public CapturingHandler(string responseBody = "{}")
        {
            _responseBody = responseBody;
        }

        public HttpRequestMessage? CapturedRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CapturedRequest = request;
            HttpResponseMessage response = new(HttpStatusCode.OK)
            {
                Content = new StringContent(_responseBody, Encoding.UTF8, "application/json"),
            };
            return Task.FromResult(response);
        }
    }
}
