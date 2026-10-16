using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Deployment;

/// <summary>
/// Ensures each <see cref="ComponentType.ModelChat"/> references a queryable <c>serving_endpoint</c> app resource before codegen or deploy.
/// </summary>
public static class ModelChatDeploymentValidator
{
    private const string CanManagePermission = "CAN_MANAGE";
    private const string CanQueryPermission = "CAN_QUERY";

    public static async Task<Result> ValidateAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        IReadOnlyList<VdabComponentDto>? components,
        IAppActionService appActionService,
        ILogger logger)
    {
        Result<List<ModelChatComponentDto>> componentsResult = CollectModelChatComponents(components, logger);
        if (componentsResult.IsFailed)
        {
            return Result.Fail(componentsResult.Errors);
        }

        List<ModelChatComponentDto> modelChatComponents = componentsResult.Value;
        if (modelChatComponents.Count == 0)
        {
            return Result.Ok();
        }

        Result bindingResult = ValidateRequiredBindings(modelChatComponents);
        if (bindingResult.IsFailed)
        {
            return bindingResult;
        }

        Result<DatabricksAppResponse> detailsResult = await appActionService.GetAppDetailsAsync(userId, tenantId, appId);
        if (detailsResult.IsFailed)
        {
            return Result.Fail(detailsResult.Errors);
        }

        DatabricksAppResponse? appDetails = detailsResult.ValueOrDefault;
        Dictionary<string, NormalizedAppResourceDto> servingEndpointResources = GetServingEndpointResources(appDetails);
        return ValidateDeclaredResources(modelChatComponents, servingEndpointResources);
    }

    private static Result<List<ModelChatComponentDto>> CollectModelChatComponents(
        IReadOnlyList<VdabComponentDto>? components,
        ILogger logger)
    {
        List<ModelChatComponentDto> modelChatComponents = new();
        foreach (VdabComponentDto component in components ?? [])
        {
            if (component.Type != ComponentType.ModelChat)
            {
                continue;
            }

            if (component is ModelChatComponentDto modelChat)
            {
                modelChatComponents.Add(modelChat);
                continue;
            }

            logger.LogWarning("ModelChat component payload type mismatch for id {Id}", component.Id);
            return Result.Fail<List<ModelChatComponentDto>>(new BadRequestError(
                "Invalid Model Chat component payload. Save the app from the latest builder and try again."));
        }

        return Result.Ok(modelChatComponents);
    }

    private static Result ValidateRequiredBindings(List<ModelChatComponentDto> modelChatComponents)
    {
        foreach (ModelChatComponentDto modelChat in modelChatComponents)
        {
            string codeName = modelChat.CodeName?.Trim() ?? string.Empty;
            string id = modelChat.Id?.Trim() ?? string.Empty;
            string selected = modelChat.Props?.ServingEndpointAppResourceName?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(selected))
            {
                return Result.Fail(new BadRequestError(
                    $"Model Chat '{codeName}' (id {id}) is not bound to a serving endpoint. Open App Settings -> App resources, add a Serving endpoint with CAN_QUERY permission, then choose it in the Model Chat properties."));
            }
        }

        return Result.Ok();
    }

    private static Dictionary<string, NormalizedAppResourceDto> GetServingEndpointResources(DatabricksAppResponse? appDetails)
    {
        Dictionary<string, NormalizedAppResourceDto> resources = new(StringComparer.OrdinalIgnoreCase);
        foreach (NormalizedAppResourceDto resource in (appDetails?.AppSettings?.Resources ?? [])
            .Where(resource => string.Equals(
                resource.Kind,
                DatabricksAppResourceKinds.ServingEndpoint,
                StringComparison.OrdinalIgnoreCase)))
        {
            resources[resource.Name.Trim()] = resource;
        }

        return resources;
    }

    private static Result ValidateDeclaredResources(
        List<ModelChatComponentDto> modelChatComponents,
        Dictionary<string, NormalizedAppResourceDto> servingEndpointResources)
    {
        foreach (ModelChatComponentDto modelChat in modelChatComponents)
        {
            Result result = ValidateDeclaredResource(modelChat, servingEndpointResources);
            if (result.IsFailed)
            {
                return result;
            }
        }

        return Result.Ok();
    }

    private static Result ValidateDeclaredResource(
        ModelChatComponentDto modelChat,
        Dictionary<string, NormalizedAppResourceDto> servingEndpointResources)
    {
        string codeName = modelChat.CodeName?.Trim() ?? string.Empty;
        string id = modelChat.Id?.Trim() ?? string.Empty;
        string selected = modelChat.Props?.ServingEndpointAppResourceName?.Trim() ?? string.Empty;

        if (!servingEndpointResources.TryGetValue(selected, out NormalizedAppResourceDto? resource))
        {
            return Result.Fail(new BadRequestError(
                $"Model Chat '{codeName}' (id {id}) references app resource '{selected}', but no serving_endpoint resource with that name exists for this Databricks app. Add or fix the resource in App Settings, or pick another serving endpoint."));
        }

        string permission = resource.ServingEndpoint?.Permission?.Trim() ?? string.Empty;
        if (!HasQueryPermission(permission))
        {
            return Result.Fail(new BadRequestError(
                $"Model Chat '{codeName}' (id {id}) references app resource '{selected}', but that serving_endpoint resource has permission '{permission}'. Change it to CAN_QUERY or CAN_MANAGE in App Settings before deploying."));
        }

        return Result.Ok();
    }

    private static bool HasQueryPermission(string permission)
    {
        return string.Equals(permission, CanQueryPermission, StringComparison.OrdinalIgnoreCase)
            || string.Equals(permission, CanManagePermission, StringComparison.OrdinalIgnoreCase);
    }
}
