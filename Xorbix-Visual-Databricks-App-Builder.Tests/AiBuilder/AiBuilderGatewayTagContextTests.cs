using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiBuilderGatewayTagContextTests
{
    [Fact]
    public void TryGet_ReturnsFalse_WhenNotSet()
    {
        AsyncLocalAiBuilderGatewayTagContext context = new();

        bool found = context.TryGet(out AiBuilderGatewayTags? tags);

        Assert.False(found);
        Assert.Null(tags);
    }

    [Fact]
    public void SetAndClear_RoundTripTags()
    {
        AsyncLocalAiBuilderGatewayTagContext context = new();
        AiBuilderGatewayTags expected = new()
        {
            TenantId = Guid.NewGuid(),
            TenantName = "acme-corp",
            UserId = Guid.NewGuid(),
            AppId = 99,
            AppName = "Sales Dashboard",
            ModelSource = AiModelSource.Tenant,
            TenantAiModelId = 3,
            EndpointName = "my-endpoint",
        };

        context.Set(expected);
        Assert.True(context.TryGet(out AiBuilderGatewayTags? active));
        Assert.Equal(expected.TenantId, active!.TenantId);
        Assert.Equal(expected.AppName, active.AppName);

        context.Clear();
        Assert.False(context.TryGet(out AiBuilderGatewayTags? cleared));
        Assert.Null(cleared);
    }

    [Fact]
    public void TryGet_ReturnsTagsSetOnAnotherInstance_InSameAsyncFlow()
    {
        AsyncLocalAiBuilderGatewayTagContext writer = new();
        AsyncLocalAiBuilderGatewayTagContext reader = new();
        AiBuilderGatewayTags expected = new()
        {
            TenantId = Guid.NewGuid(),
            TenantName = "acme-corp",
            UserId = Guid.NewGuid(),
            AppId = 42,
            AppName = "Sales Dashboard",
            ModelSource = AiModelSource.Tenant,
            TenantAiModelId = 7,
            EndpointName = "team-endpoint",
        };

        writer.Set(expected);
        Assert.True(reader.TryGet(out AiBuilderGatewayTags? tags));
        Assert.Equal(expected.TenantId, tags!.TenantId);
        Assert.Equal(expected.AppName, tags.AppName);

        writer.Clear();
        Assert.False(reader.TryGet(out AiBuilderGatewayTags? cleared));
        Assert.Null(cleared);
    }
}

public class DatabricksAiGatewayTagBuilderTests
{
    [Fact]
    public void Build_IncludesAiBuilderTags_WhenContextProvided()
    {
        Guid tenantId = Guid.NewGuid();
        Guid userId = Guid.NewGuid();
        AiBuilderGatewayTags aiBuilderTags = new()
        {
            TenantId = tenantId,
            TenantName = "acme-corp",
            UserId = userId,
            AppId = 5,
            AppName = "Sales Dashboard",
            ModelSource = AiModelSource.Tenant,
            TenantAiModelId = 12,
            EndpointName = "serving-endpoint",
        };

        Dictionary<string, string> tags = DatabricksAiGatewayTagBuilder.Build("user@example.com", aiBuilderTags);

        Assert.Equal("user@example.com", tags["end_user"]);
        Assert.Equal("vdab", tags["source"]);
        Assert.Equal("ai-builder", tags["feature"]);
        Assert.Equal(tenantId.ToString(), tags["tenant_id"]);
        Assert.Equal("acme-corp", tags["tenant_name"]);
        Assert.Equal(userId.ToString(), tags["user_id"]);
        Assert.Equal("5", tags["app_id"]);
        Assert.Equal("Sales Dashboard", tags["app_name"]);
        Assert.Equal("tenant", tags["model_source"]);
        Assert.Equal("12", tags["tenant_ai_model_id"]);
        Assert.Equal("serving-endpoint", tags["endpoint_name"]);
    }

    [Fact]
    public void Build_OmitsTenantAiModelId_WhenPlatformModel()
    {
        AiBuilderGatewayTags aiBuilderTags = new()
        {
            TenantId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = 1,
            ModelSource = AiModelSource.Platform,
            EndpointName = "vdab-default",
        };

        Dictionary<string, string> tags = DatabricksAiGatewayTagBuilder.Build(null, aiBuilderTags);

        Assert.False(tags.ContainsKey("tenant_ai_model_id"));
        Assert.Equal("platform", tags["model_source"]);
        Assert.False(tags.ContainsKey("end_user"));
    }

    [Fact]
    public void Build_OmitsTenantAndAppNames_WhenBlank()
    {
        AiBuilderGatewayTags aiBuilderTags = new()
        {
            TenantId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = 1,
            ModelSource = AiModelSource.Platform,
            EndpointName = "vdab-default",
        };

        Dictionary<string, string> tags = DatabricksAiGatewayTagBuilder.Build("user@example.com", aiBuilderTags);

        Assert.False(tags.ContainsKey("tenant_name"));
        Assert.False(tags.ContainsKey("app_name"));
    }
}

public class AiBuilderServiceGatewayTagContextTests
{
    private static readonly Guid TenantId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    private static readonly Guid UserId = Guid.Parse("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    [Fact]
    public async Task GenerateComponentsStreamAsync_ChecksPlatformQuota_WhenPlatformModelSelected()
    {
        Mock<IAiModelResolverService> modelResolver = new();
        modelResolver
            .Setup(resolver => resolver.ResolveAsync(TenantId, It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ResolvedAiModelConfiguration
            {
                Source = AiModelSource.Platform,
                DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
                WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
                EndpointName = "vdab-default",
                AccessToken = "platform-token",
            }));

        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        AiBuilderService service = CreateService(
            modelResolver.Object,
            contextService: CreateSuccessfulContextService().Object,
            gatewayTagContext: new AsyncLocalAiBuilderGatewayTagContext(),
            platformAiQuotaService: quotaService.Object);

        await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(CreateRequest(), UserId, TenantId))
        {
        }

        quotaService.Verify(
            service => service.EnsureCanUsePlatformModelAsync(UserId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GenerateComponentsStreamAsync_SetsPlatformModelSource_WhenPlatformModelSelected()
    {
        Mock<IAiModelResolverService> modelResolver = new();
        modelResolver
            .Setup(resolver => resolver.ResolveAsync(TenantId, It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ResolvedAiModelConfiguration
            {
                Source = AiModelSource.Platform,
                DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
                WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
                EndpointName = "vdab-default",
                AccessToken = "platform-token",
            }));

        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();
        AiBuilderService service = CreateService(
            modelResolver.Object,
            contextService: CreateSuccessfulContextService().Object,
            gatewayTagContext: gatewayTagContext.Object);

        await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(CreateRequest(), UserId, TenantId))
        {
        }

        gatewayTagContext.Verify(
            context => context.Set(It.Is<AiBuilderGatewayTags>(tags =>
                tags.ModelSource == AiModelSource.Platform
                && tags.EndpointName == "vdab-default"
                && tags.TenantAiModelId == null)),
            Times.Once);
        gatewayTagContext.Verify(context => context.Clear(), Times.Once);
    }

    [Fact]
    public async Task GenerateComponentsStreamAsync_DoesNotSetGatewayTags_WhenModelResolutionFails()
    {
        Mock<IAiModelResolverService> modelResolver = new();
        modelResolver
            .Setup(resolver => resolver.ResolveAsync(TenantId, It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<ResolvedAiModelConfiguration>("Model not found."));

        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();

        AiBuilderService service = CreateService(modelResolver.Object, gatewayTagContext: gatewayTagContext.Object);

        await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(CreateRequest(), UserId, TenantId))
        {
        }

        gatewayTagContext.Verify(context => context.Set(It.IsAny<AiBuilderGatewayTags>()), Times.Never);
        gatewayTagContext.Verify(context => context.Clear(), Times.Never);
    }

    [Fact]
    public async Task GenerateComponentsStreamAsync_DoesNotSetGatewayTags_WhenAgentContextBuildFails()
    {
        Mock<IAiModelResolverService> modelResolver = CreateSuccessfulModelResolver();
        Mock<IAiBuilderContextService> contextService = new();
        contextService
            .Setup(service => service.BuildDatabricksContextAsync(It.IsAny<int>(), UserId, TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<AiBuilderDatabricksContext>("App not found."));

        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();

        AiBuilderService service = CreateService(
            modelResolver.Object,
            contextService: contextService.Object,
            gatewayTagContext: gatewayTagContext.Object);

        await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(CreateRequest(), UserId, TenantId))
        {
        }

        gatewayTagContext.Verify(context => context.Set(It.IsAny<AiBuilderGatewayTags>()), Times.Never);
        gatewayTagContext.Verify(context => context.Clear(), Times.Never);
    }

    [Fact]
    public async Task GenerateComponentsStreamAsync_SetsAndClearsGatewayTags_WhenAgentRunCompletes()
    {
        Mock<IAiModelResolverService> modelResolver = CreateSuccessfulModelResolver();
        Mock<IAiBuilderContextService> contextService = CreateSuccessfulContextService();
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();

        AiBuilderService service = CreateService(
            modelResolver.Object,
            contextService: contextService.Object,
            gatewayTagContext: gatewayTagContext.Object);

        await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(CreateRequest(), UserId, TenantId))
        {
        }

        gatewayTagContext.Verify(
            context => context.Set(It.Is<AiBuilderGatewayTags>(tags =>
                tags.TenantId == TenantId
                && tags.TenantName == "Acme Corp"
                && tags.UserId == UserId
                && tags.AppId == 42
                && tags.AppName == "Sales Dashboard"
                && tags.ModelSource == AiModelSource.Tenant
                && tags.TenantAiModelId == 7
                && tags.EndpointName == "team-endpoint")),
            Times.Once);
        gatewayTagContext.Verify(context => context.Clear(), Times.Once);
    }

    [Fact]
    public async Task GenerateComponentsStreamAsync_ClearsGatewayTags_WhenStreamCancelled()
    {
        Mock<IAiModelResolverService> modelResolver = CreateSuccessfulModelResolver();
        Mock<IAiBuilderContextService> contextService = CreateSuccessfulContextService();
        Mock<IAiBuilderGatewayTagContext> gatewayTagContext = new();

        AiBuilderService service = CreateService(
            modelResolver.Object,
            contextService: contextService.Object,
            gatewayTagContext: gatewayTagContext.Object);

        using CancellationTokenSource cancellation = new();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () =>
        {
            await foreach (AiBuilderStreamEvent _ in service.GenerateComponentsStreamAsync(
                CreateRequest(),
                UserId,
                TenantId,
                cancellation.Token))
            {
            }
        });

        gatewayTagContext.Verify(context => context.Set(It.IsAny<AiBuilderGatewayTags>()), Times.Once);
        gatewayTagContext.Verify(context => context.Clear(), Times.Once);
    }

    private static AiBuilderRequest CreateRequest() => new()
    {
        Prompt = "Add a button",
        AppId = 42,
    };

    private static Mock<IAiModelResolverService> CreateSuccessfulModelResolver()
    {
        Mock<IAiModelResolverService> modelResolver = new();
        modelResolver
            .Setup(resolver => resolver.ResolveAsync(TenantId, It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new ResolvedAiModelConfiguration
            {
                Source = AiModelSource.Tenant,
                DisplayName = "Team Model",
                WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
                EndpointName = "team-endpoint",
                AccessToken = "tenant-token",
                TenantAiModelId = 7,
            }));
        return modelResolver;
    }

    private static Mock<IAiBuilderContextService> CreateSuccessfulContextService()
    {
        Mock<IAiBuilderContextService> contextService = new();
        contextService
            .Setup(service => service.BuildDatabricksContextAsync(It.IsAny<int>(), UserId, TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new AiBuilderDatabricksContext
            {
                WorkspaceConnectionId = 0,
                Context = string.Empty,
                AppName = "Sales Dashboard",
                TenantName = "Acme Corp",
            }));
        return contextService;
    }

    private static AiBuilderService CreateService(
        IAiModelResolverService modelResolver,
        IAiBuilderContextService? contextService = null,
        IAiBuilderGatewayTagContext? gatewayTagContext = null,
        IPlatformAiQuotaService? platformAiQuotaService = null)
    {
        Mock<IAiBuilderModelSelectionService> modelSelectionService = new();
        modelSelectionService
            .Setup(service => service.SetSelectedModelAsync(UserId, TenantId, It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(new AiBuilderSelectedModelDto
            {
                DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
                Source = AiModelSource.Platform,
            }));

        return new AiBuilderService(
            modelResolver,
            new AiBuilderKernelFactory(new MockHttpClientFactory()),
            modelSelectionService.Object,
            NullLogger<AiBuilderService>.Instance,
            contextService ?? CreateSuccessfulContextService().Object,
            gatewayTagContext ?? new AsyncLocalAiBuilderGatewayTagContext(),
            platformAiQuotaService ?? CreatePermissiveQuotaService());
    }

    private static IPlatformAiQuotaService CreatePermissiveQuotaService()
    {
        Mock<IPlatformAiQuotaService> quotaService = new();
        quotaService
            .Setup(service => service.EnsureCanUsePlatformModelAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        return quotaService.Object;
    }

    private sealed class MockHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(new HttpClientHandler());
    }
}
