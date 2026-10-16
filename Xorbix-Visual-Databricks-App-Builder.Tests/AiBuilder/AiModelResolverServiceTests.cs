using FluentResults;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiModelResolverServiceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task ResolveAsync_NullModelId_ReturnsPlatformDefault()
    {
        AiModelResolverService service = CreateService(new DatabricksAiConfiguration
        {
            WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
            EndpointName = "vdab-default",
            AccessToken = "platform-token",
        });

        Result<ResolvedAiModelConfiguration> result = await service.ResolveAsync(TenantId, null);

        Assert.True(result.IsSuccess);
        Assert.Equal(AiModelSource.Platform, result.Value.Source);
        Assert.Equal("vdab-default", result.Value.EndpointName);
        Assert.Null(result.Value.TenantAiModelId);
    }

    [Fact]
    public async Task ResolveAsync_TenantModel_ReturnsTenantConfiguration()
    {
        Mock<ITenantAiModelRepository> repository = new();
        TenantAiModel model = new()
        {
            TenantAiModelId = 7,
            TenantId = TenantId,
            DatabricksConnectionId = 3,
            DisplayName = "Team Model",
            EndpointName = "team-endpoint",
            AccessToken = "tenant-token",
            CreatedByUserId = Guid.NewGuid(),
            DatabricksConnection = new DatabricksConnection
            {
                PkId = 3,
                TenantId = TenantId,
                OwnerId = Guid.NewGuid(),
                WorkspaceUrl = "https://dbc.team.azuredatabricks.net",
                WorkspaceDisplayName = "Team Workspace",
            },
        };

        repository
            .Setup(r => r.GetByIdForTenantAsync(7, TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(model);

        AiModelResolverService service = CreateService(
            new DatabricksAiConfiguration(),
            repository.Object);

        Result<ResolvedAiModelConfiguration> result = await service.ResolveAsync(TenantId, 7);

        Assert.True(result.IsSuccess);
        Assert.Equal(AiModelSource.Tenant, result.Value.Source);
        Assert.Equal(7, result.Value.TenantAiModelId);
        Assert.Equal("team-endpoint", result.Value.EndpointName);
        Assert.Equal("tenant-token", result.Value.AccessToken);
    }

    [Fact]
    public async Task ResolveAsync_MissingTenantModel_ReturnsNotFound()
    {
        Mock<ITenantAiModelRepository> repository = new();
        repository
            .Setup(r => r.GetByIdForTenantAsync(99, TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantAiModel?)null);

        AiModelResolverService service = CreateService(new DatabricksAiConfiguration(), repository.Object);

        Result<ResolvedAiModelConfiguration> result = await service.ResolveAsync(TenantId, 99);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public void IsPlatformDefaultConfigured_WhenComplete_ReturnsTrue()
    {
        AiModelResolverService service = CreateService(new DatabricksAiConfiguration
        {
            WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
            EndpointName = "vdab-default",
            AccessToken = "platform-token",
        });

        Assert.True(service.IsPlatformDefaultConfigured());
    }

    private static AiModelResolverService CreateService(
        DatabricksAiConfiguration config,
        ITenantAiModelRepository? repository = null)
    {
        Mock<IOptions<DatabricksAiConfiguration>> options = new();
        options.Setup(o => o.Value).Returns(config);

        return new AiModelResolverService(
            options.Object,
            repository ?? new Mock<ITenantAiModelRepository>().Object,
            new TenantResourceGuard());
    }
}
