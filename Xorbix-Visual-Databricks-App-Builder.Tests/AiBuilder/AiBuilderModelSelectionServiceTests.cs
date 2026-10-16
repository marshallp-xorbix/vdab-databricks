using FluentResults;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiBuilderModelSelectionServiceTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public async Task GetSelectedModelAsync_NoPreference_ReturnsPlatformDefault()
    {
        Mock<IUserTenantPreferenceRepository> preferenceRepository = new();
        preferenceRepository
            .Setup(r => r.GetIntPreferenceAsync(
                UserId,
                TenantId,
                UserTenantPreferenceKeys.AiBuilderSelectedModelId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((int?)null);

        AiBuilderModelSelectionService service = CreateService(preferenceRepository: preferenceRepository.Object);

        Result<AiBuilderSelectedModelDto> result = await service.GetSelectedModelAsync(UserId, TenantId);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.AiModelId);
        Assert.Equal(AiModelSource.Platform, result.Value.Source);
    }

    [Fact]
    public async Task GetSelectedModelAsync_StalePreference_FallsBackToPlatformDefault()
    {
        Mock<IUserTenantPreferenceRepository> preferenceRepository = new();
        preferenceRepository
            .Setup(r => r.GetIntPreferenceAsync(
                UserId,
                TenantId,
                UserTenantPreferenceKeys.AiBuilderSelectedModelId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(42);

        Mock<ITenantAiModelRepository> tenantAiModelRepository = new();
        tenantAiModelRepository
            .Setup(r => r.GetByIdForTenantAsync(42, TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TenantAiModel?)null);

        AiBuilderModelSelectionService service = CreateService(
            tenantAiModelRepository: tenantAiModelRepository.Object,
            preferenceRepository: preferenceRepository.Object);

        Result<AiBuilderSelectedModelDto> result = await service.GetSelectedModelAsync(UserId, TenantId);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.AiModelId);
        preferenceRepository.Verify(
            r => r.UpsertIntPreferenceAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<int?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAvailableModelsAsync_IncludesPlatformDefaultAndTenantModels()
    {
        Mock<ITenantAiModelRepository> tenantAiModelRepository = new();
        tenantAiModelRepository
            .Setup(r => r.ListByTenantAsync(TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new TenantAiModel
                {
                    TenantAiModelId = 5,
                    TenantId = TenantId,
                    DatabricksConnectionId = 1,
                    DisplayName = "Custom",
                    EndpointName = "custom-endpoint",
                    AccessToken = "token",
                    CreatedByUserId = UserId,
                },
            ]);

        AiBuilderModelSelectionService service = CreateService(tenantAiModelRepository: tenantAiModelRepository.Object);

        Result<IReadOnlyList<AiBuilderModelOptionDto>> result =
            await service.GetAvailableModelsAsync(TenantId);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Count);
        Assert.Null(result.Value[0].Id);
        Assert.Equal(5, result.Value[1].Id);
    }

    private static AiBuilderModelSelectionService CreateService(
        ITenantAiModelRepository? tenantAiModelRepository = null,
        IUserTenantPreferenceRepository? preferenceRepository = null)
    {
        Mock<Microsoft.Extensions.Options.IOptions<DatabricksAiConfiguration>> options = new();
        options.Setup(o => o.Value).Returns(new DatabricksAiConfiguration
        {
            WorkspaceUrl = "https://dbc.test.azuredatabricks.net",
            EndpointName = "vdab-default",
            AccessToken = "platform-token",
        });

        IAiModelResolverService resolver = new AiModelResolverService(
            options.Object,
            tenantAiModelRepository ?? new Mock<ITenantAiModelRepository>().Object,
            new TenantResourceGuard());

        return new AiBuilderModelSelectionService(
            resolver,
            tenantAiModelRepository ?? new Mock<ITenantAiModelRepository>().Object,
            preferenceRepository ?? new Mock<IUserTenantPreferenceRepository>().Object);
    }
}
