using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Server.Services;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class DatabricksAiRequestTaggingHandlerTests
{
    private const string TagHeader = "Databricks-Ai-Gateway-Request-Tags";

    [Fact]
    public async Task SendAsync_AddsTagHeader_WhenEmailPresent()
    {
        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(inner, email: "user@example.com");
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        Assert.True(inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values));
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        Assert.Equal("user@example.com", document.RootElement.GetProperty(AiBuilderGatewayTagKeys.EndUser).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.Source, document.RootElement.GetProperty(AiBuilderGatewayTagKeys.Source).GetString());
    }

    [Fact]
    public async Task SendAsync_AddsSourceTagOnly_WhenEmailMissingAndNoAiBuilderContext()
    {
        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(inner, email: null);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        Assert.True(inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values));
        string tag = Assert.Single(values!);
        Assert.Equal("{\"source\":\"vdab\"}", tag);
    }

    [Fact]
    public async Task SendAsync_AddsAiBuilderTags_WhenContextStoredInHttpContext()
    {
        Guid tenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        Guid userId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");
        DefaultHttpContext httpContext = new();
        Mock<IHttpContextAccessor> httpContextAccessor = new();
        httpContextAccessor.Setup(accessor => accessor.HttpContext).Returns(httpContext);

        AiBuilderGatewayTagContext gatewayTagContext = new(httpContextAccessor.Object);
        gatewayTagContext.Set(new AiBuilderGatewayTags
        {
            TenantId = tenantId,
            TenantName = "acme-corp",
            UserId = userId,
            AppId = 42,
            AppName = "Sales Dashboard",
            ModelSource = AiModelSource.Tenant,
            TenantAiModelId = 7,
            EndpointName = "team-endpoint",
        });

        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values);
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        JsonElement root = document.RootElement;
        Assert.Equal(AiBuilderGatewayTagValues.FeatureAiBuilder, root.GetProperty(AiBuilderGatewayTagKeys.Feature).GetString());
        Assert.Equal("acme-corp", root.GetProperty(AiBuilderGatewayTagKeys.TenantName).GetString());
        Assert.Equal("Sales Dashboard", root.GetProperty(AiBuilderGatewayTagKeys.AppName).GetString());
    }

    [Fact]
    public async Task SendAsync_AddsAiBuilderTags_WhenContextSetOnDifferentInstance()
    {
        Guid tenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        Guid userId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");

        AsyncLocalAiBuilderGatewayTagContext requestScopedContext = new();
        requestScopedContext.Set(new AiBuilderGatewayTags
        {
            TenantId = tenantId,
            TenantName = "acme-corp",
            UserId = userId,
            AppId = 42,
            AppName = "Sales Dashboard",
            ModelSource = AiModelSource.Tenant,
            TenantAiModelId = 7,
            EndpointName = "team-endpoint",
        });

        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: new AsyncLocalAiBuilderGatewayTagContext());
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values);
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        JsonElement root = document.RootElement;
        Assert.Equal(AiBuilderGatewayTagValues.FeatureAiBuilder, root.GetProperty(AiBuilderGatewayTagKeys.Feature).GetString());
        Assert.Equal("acme-corp", root.GetProperty(AiBuilderGatewayTagKeys.TenantName).GetString());
        Assert.Equal("Sales Dashboard", root.GetProperty(AiBuilderGatewayTagKeys.AppName).GetString());
        Assert.Equal("team-endpoint", root.GetProperty(AiBuilderGatewayTagKeys.EndpointName).GetString());
    }

    [Fact]
    public async Task SendAsync_AddsAiBuilderTags_WhenContextSet()
    {
        Guid tenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        Guid userId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");

        CapturingHandler inner = new();
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        gatewayTagContext
            .Setup(context => context.TryGet(out It.Ref<AiBuilderGatewayTags?>.IsAny))
            .Returns((out AiBuilderGatewayTags? tags) =>
            {
                tags = new AiBuilderGatewayTags
                {
                    TenantId = tenantId,
                    TenantName = "acme-corp",
                    UserId = userId,
                    AppId = 42,
                    AppName = "Sales Dashboard",
                    ModelSource = AiModelSource.Tenant,
                    TenantAiModelId = 7,
                    EndpointName = "team-endpoint",
                };
                return true;
            });

        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values);
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        JsonElement root = document.RootElement;
        Assert.Equal("user@example.com", root.GetProperty(AiBuilderGatewayTagKeys.EndUser).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.Source, root.GetProperty(AiBuilderGatewayTagKeys.Source).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.FeatureAiBuilder, root.GetProperty(AiBuilderGatewayTagKeys.Feature).GetString());
        Assert.Equal(tenantId.ToString(), root.GetProperty(AiBuilderGatewayTagKeys.TenantId).GetString());
        Assert.Equal("acme-corp", root.GetProperty(AiBuilderGatewayTagKeys.TenantName).GetString());
        Assert.Equal(userId.ToString(), root.GetProperty(AiBuilderGatewayTagKeys.UserId).GetString());
        Assert.Equal("42", root.GetProperty(AiBuilderGatewayTagKeys.AppId).GetString());
        Assert.Equal("Sales Dashboard", root.GetProperty(AiBuilderGatewayTagKeys.AppName).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.ModelSourceTenant, root.GetProperty(AiBuilderGatewayTagKeys.ModelSource).GetString());
        Assert.Equal("7", root.GetProperty(AiBuilderGatewayTagKeys.TenantAiModelId).GetString());
        Assert.Equal("team-endpoint", root.GetProperty(AiBuilderGatewayTagKeys.EndpointName).GetString());
    }

    [Fact]
    public async Task SendAsync_AddsAiBuilderTags_WhenEmailMissingAndContextSet()
    {
        Guid tenantId = Guid.NewGuid();

        CapturingHandler inner = new();
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        gatewayTagContext
            .Setup(context => context.TryGet(out It.Ref<AiBuilderGatewayTags?>.IsAny))
            .Returns((out AiBuilderGatewayTags? tags) =>
            {
                tags = new AiBuilderGatewayTags
                {
                    TenantId = tenantId,
                    TenantName = "platform-tenant",
                    UserId = Guid.NewGuid(),
                    AppId = 1,
                    AppName = "Demo App",
                    ModelSource = AiModelSource.Platform,
                    EndpointName = "vdab-default",
                };
                return true;
            });

        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: null,
            gatewayTagContext: gatewayTagContext.Object);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values);
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        JsonElement root = document.RootElement;
        Assert.False(root.TryGetProperty(AiBuilderGatewayTagKeys.EndUser, out _));
        Assert.Equal(AiBuilderGatewayTagValues.FeatureAiBuilder, root.GetProperty(AiBuilderGatewayTagKeys.Feature).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.ModelSourcePlatform, root.GetProperty(AiBuilderGatewayTagKeys.ModelSource).GetString());
        Assert.False(root.TryGetProperty(AiBuilderGatewayTagKeys.TenantAiModelId, out _));
    }

    [Fact]
    public async Task SendAsync_EscapesEmail_WhenEmailContainsJsonSpecialCharacters()
    {
        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(inner, email: "evil\",\"source\":\"spoofed");
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        inner.CapturedRequest!.Headers.TryGetValues(TagHeader, out IEnumerable<string>? values);
        string tag = Assert.Single(values!);

        using JsonDocument document = JsonDocument.Parse(tag);
        Assert.Equal("evil\",\"source\":\"spoofed", document.RootElement.GetProperty(AiBuilderGatewayTagKeys.EndUser).GetString());
        Assert.Equal(AiBuilderGatewayTagValues.Source, document.RootElement.GetProperty(AiBuilderGatewayTagKeys.Source).GetString());
    }

    [Fact]
    public async Task SendAsync_RecordsUsage_WhenPlatformAiBuilderSessionReturnsUsage()
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

        const string responseBody = """{"usage":{"total_tokens":321,"prompt_tokens":200,"completion_tokens":121}}""";
        CapturingHandler inner = new(responseBody);
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object,
            platformAiQuotaService: quotaService.Object,
            userId: userId);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        quotaService.Verify(
            service => service.RecordUsageAsync(
                userId,
                It.Is<PlatformAiUsageRecordContext>(context =>
                    context.TotalTokens == 321
                    && context.InputTokens == 200
                    && context.OutputTokens == 121
                    && context.AppId == 42
                    && context.TenantId == tenantId),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task SendAsync_DoesNotThrow_WhenRecordUsageFailsAfterSuccessfulResponse()
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
        quotaService
            .Setup(service => service.RecordUsageAsync(userId, It.IsAny<PlatformAiUsageRecordContext>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database unavailable"));

        const string responseBody = """{"usage":{"total_tokens":100}}""";
        CapturingHandler inner = new(responseBody);
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object,
            platformAiQuotaService: quotaService.Object,
            userId: userId);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        HttpResponseMessage response = await invoker.SendAsync(request, CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SendAsync_DoesNotRecordUsage_WhenTenantModel()
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
                    ModelSource = AiModelSource.Tenant,
                    TenantAiModelId = 7,
                    EndpointName = "team-endpoint",
                };
                return true;
            });

        Mock<IPlatformAiQuotaService> quotaService = new();
        const string responseBody = """{"usage":{"total_tokens":500}}""";
        CapturingHandler inner = new(responseBody);
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object,
            platformAiQuotaService: quotaService.Object,
            userId: userId);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await invoker.SendAsync(request, CancellationToken.None);

        quotaService.Verify(
            service => service.EnsureCanUsePlatformModelAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        quotaService.Verify(
            service => service.RecordUsageAsync(It.IsAny<Guid>(), It.IsAny<PlatformAiUsageRecordContext>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendAsync_Throws_WhenPlatformQuotaExceeded()
    {
        Guid userId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");
        Guid tenantId = Guid.NewGuid();
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        gatewayTagContext
            .Setup(context => context.TryGet(out It.Ref<AiBuilderGatewayTags?>.IsAny))
            .Returns((out AiBuilderGatewayTags? tags) =>
            {
                tags = new AiBuilderGatewayTags
                {
                    TenantId = tenantId,
                    UserId = userId,
                    AppId = 1,
                    ModelSource = AiModelSource.Platform,
                    EndpointName = "vdab-default",
                };
                return true;
            });

        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new PlatformAiQuotaExceededError(
                "Monthly VDAB Default limit reached (100k tokens).",
                100_000,
                100_000,
                DateTime.UtcNow)));

        CapturingHandler inner = new();
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object,
            platformAiQuotaService: quotaService.Object,
            userId: userId);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        await Assert.ThrowsAsync<PlatformAiQuotaExceededException>(
            () => invoker.SendAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task SendAsync_ReturnsNonSuccessResponse_WhenNoBuilderContext()
    {
        const string responseBody = """{"error_code":"BAD_REQUEST","message":"unsupported"}""";
        CapturingHandler inner = new(responseBody, HttpStatusCode.BadRequest);
        DatabricksAiRequestTaggingHandler handler = CreateHandler(inner, email: "user@example.com");
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        HttpResponseMessage response = await invoker.SendAsync(request, CancellationToken.None);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        string body = await response.Content!.ReadAsStringAsync();
        Assert.Contains("unsupported", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SendAsync_ThrowsHttpRequestException_WhenNonSuccessAndBuilderContextSet()
    {
        Guid tenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        gatewayTagContext
            .Setup(context => context.TryGet(out It.Ref<AiBuilderGatewayTags?>.IsAny))
            .Returns((out AiBuilderGatewayTags? tags) =>
            {
                tags = new AiBuilderGatewayTags
                {
                    TenantId = tenantId,
                    TenantName = "acme-corp",
                    UserId = Guid.NewGuid(),
                    AppId = 42,
                    AppName = "Sales Dashboard",
                    ModelSource = AiModelSource.Tenant,
                    TenantAiModelId = 7,
                    EndpointName = "team-endpoint",
                };
                return true;
            });

        const string responseBody = """{"error_code":"BAD_REQUEST","message":"unsupported"}""";
        CapturingHandler inner = new(responseBody, HttpStatusCode.BadRequest);
        DatabricksAiRequestTaggingHandler handler = CreateHandler(
            inner,
            email: "user@example.com",
            gatewayTagContext: gatewayTagContext.Object);
        using HttpMessageInvoker invoker = new(handler);
        using HttpRequestMessage request = new(HttpMethod.Post, "https://adb-123.azuredatabricks.net/ai-gateway/mlflow/v1");

        HttpRequestException exception = await Assert.ThrowsAsync<HttpRequestException>(
            () => invoker.SendAsync(request, CancellationToken.None));

        Assert.Contains("unsupported", exception.Message, StringComparison.Ordinal);
    }

    private static DatabricksAiRequestTaggingHandler CreateHandler(
        HttpMessageHandler inner,
        string? email,
        IAiBuilderGatewayTagContext? gatewayTagContext = null,
        IPlatformAiQuotaService? platformAiQuotaService = null,
        Guid? userId = null)
    {
        Mock<ICurrentUserService> currentUserService = new();
        currentUserService.Setup(service => service.GetUserEmail()).Returns(email);
        currentUserService.Setup(service => service.GetUserId()).Returns(userId);

        IAiBuilderGatewayTagContext tagContext = gatewayTagContext ?? new AsyncLocalAiBuilderGatewayTagContext();

        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(FluentResults.Result.Ok());

        return new DatabricksAiRequestTaggingHandler(
            currentUserService.Object,
            tagContext,
            platformAiQuotaService ?? quotaService.Object,
            NullLogger<DatabricksAiRequestTaggingHandler>.Instance)
        {
            InnerHandler = inner,
        };
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly string _responseBody;
        private readonly HttpStatusCode _statusCode;

        public CapturingHandler(string responseBody = "{}", HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            _responseBody = responseBody;
            _statusCode = statusCode;
        }

        public HttpRequestMessage? CapturedRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CapturedRequest = request;
            HttpResponseMessage response = new(_statusCode)
            {
                Content = new StringContent(_responseBody, System.Text.Encoding.UTF8, "application/json"),
            };
            return Task.FromResult(response);
        }
    }
}
