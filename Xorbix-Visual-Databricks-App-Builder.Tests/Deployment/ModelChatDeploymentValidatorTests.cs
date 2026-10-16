using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.Deployment;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Deployment;

public class ModelChatDeploymentValidatorTests
{
    [Fact]
    public async Task ValidateAsync_Fails_WhenModelChatNotBound()
    {
        Mock<IAppActionService> appActionService = new();
        List<VdabComponentDto> components =
        [
            CreateModelChat(string.Empty),
        ];

        Result result = await ModelChatDeploymentValidator.ValidateAsync(
            Guid.Empty,
            Guid.Empty,
            1,
            components,
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsFailed);
        Assert.Contains("not bound", result.Errors[0].Message);
        appActionService.Verify(
            service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_Fails_WhenServingEndpointResourceMissing()
    {
        Mock<IAppActionService> appActionService = AppActionServiceWithResources(
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.ServingEndpoint,
                Name = "other-endpoint",
                ServingEndpoint = new ServingEndpointResource
                {
                    Name = "other-endpoint",
                    Permission = "CAN_QUERY",
                },
            });
        List<VdabComponentDto> components =
        [
            CreateModelChat("my-endpoint"),
        ];

        Result result = await ModelChatDeploymentValidator.ValidateAsync(
            Guid.Empty,
            Guid.Empty,
            1,
            components,
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsFailed);
        Assert.Contains("no serving_endpoint resource", result.Errors[0].Message);
    }

    [Fact]
    public async Task ValidateAsync_Fails_WhenServingEndpointPermissionCannotQuery()
    {
        Mock<IAppActionService> appActionService = AppActionServiceWithResources(
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.ServingEndpoint,
                Name = "my-endpoint",
                ServingEndpoint = new ServingEndpointResource
                {
                    Name = "my-endpoint",
                    Permission = "CAN_VIEW",
                },
            });
        List<VdabComponentDto> components =
        [
            CreateModelChat("my-endpoint"),
        ];

        Result result = await ModelChatDeploymentValidator.ValidateAsync(
            Guid.Empty,
            Guid.Empty,
            1,
            components,
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsFailed);
        Assert.Contains("CAN_QUERY or CAN_MANAGE", result.Errors[0].Message);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsOk_WhenServingEndpointCanQuery()
    {
        Mock<IAppActionService> appActionService = AppActionServiceWithResources(
            new NormalizedAppResourceDto
            {
                Kind = DatabricksAppResourceKinds.ServingEndpoint,
                Name = "my-endpoint",
                ServingEndpoint = new ServingEndpointResource
                {
                    Name = "my-endpoint",
                    Permission = "CAN_QUERY",
                },
            });
        List<VdabComponentDto> components =
        [
            CreateModelChat("my-endpoint"),
        ];

        Result result = await ModelChatDeploymentValidator.ValidateAsync(
            Guid.Empty,
            Guid.Empty,
            1,
            components,
            appActionService.Object,
            NullLogger.Instance);

        Assert.True(result.IsSuccess);
    }

    private static ModelChatComponentDto CreateModelChat(string resourceName)
    {
        return new ModelChatComponentDto
        {
            Id = "model-chat-1",
            CodeName = "modelChat1",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = resourceName,
            },
        };
    }

    private static Mock<IAppActionService> AppActionServiceWithResources(params NormalizedAppResourceDto[] resources)
    {
        Mock<IAppActionService> appActionService = new();
        appActionService
            .Setup(service => service.GetAppDetailsAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<int>()))
            .ReturnsAsync(Result.Ok(new DatabricksAppResponse
            {
                AppSettings = new AppSettingsDetailsDto
                {
                    Resources = resources.ToList(),
                },
            }));

        return appActionService;
    }
}
