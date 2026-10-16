using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Deployment;

/// <summary>
/// Ensures each <see cref="ComponentType.GenieChat"/> references an existing <c>genie_space</c> app resource before codegen or deploy.
/// </summary>
public static class GenieChatDeploymentValidator
{
    public static async Task<Result> ValidateAsync(
        Guid userId,
        Guid tenantId,
        int appId,
        IReadOnlyList<VdabComponentDto>? components,
        IAppActionService appActionService,
        ILogger logger)
    {
        if (components == null || components.Count == 0)
        {
            return Result.Ok();
        }

        List<GenieChatComponentDto> genieComponents = new();
        foreach (VdabComponentDto component in components)
        {
            if (component.Type != ComponentType.GenieChat)
            {
                continue;
            }

            if (component is not GenieChatComponentDto genieChat)
            {
                logger.LogWarning("GenieChat component payload type mismatch for id {Id}", component.Id);
                return Result.Fail(new BadRequestError(
                    "Invalid Genie Chat component payload. Save the app from the latest builder and try again."));
            }

            genieComponents.Add(genieChat);
        }

        if (genieComponents.Count == 0)
        {
            return Result.Ok();
        }

        foreach (GenieChatComponentDto genie in genieComponents)
        {
            string codeName = genie.CodeName?.Trim() ?? string.Empty;
            string id = genie.Id?.Trim() ?? string.Empty;
            string selected = genie.Props?.GenieSpaceAppResourceName?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(selected))
            {
                return Result.Fail(new BadRequestError(
                    $"Genie Chat '{codeName}' (id {id}) is not bound to a Genie space. Open App Settings → App resources, add a Genie space, then choose it in the Genie Chat properties."));
            }
        }

        Result<DatabricksAppResponse> detailsResult = await appActionService.GetAppDetailsAsync(userId, tenantId, appId);
        if (detailsResult.IsFailed)
        {
            return Result.Fail(detailsResult.Errors);
        }

        DatabricksAppResponse? appDetails = detailsResult.ValueOrDefault;
        HashSet<string> genieResourceNames = new(StringComparer.OrdinalIgnoreCase);
        if (appDetails?.AppSettings?.Resources != null)
        {
            foreach (NormalizedAppResourceDto resource in appDetails.AppSettings.Resources)
            {
                if (string.Equals(resource.Kind, DatabricksAppResourceKinds.GenieSpace, StringComparison.OrdinalIgnoreCase))
                {
                    genieResourceNames.Add(resource.Name.Trim());
                }
            }
        }

        foreach (GenieChatComponentDto genie in genieComponents)
        {
            string codeName = genie.CodeName?.Trim() ?? string.Empty;
            string id = genie.Id?.Trim() ?? string.Empty;
            string selected = genie.Props?.GenieSpaceAppResourceName?.Trim() ?? string.Empty;

            if (!genieResourceNames.Contains(selected))
            {
                return Result.Fail(new BadRequestError(
                    $"Genie Chat '{codeName}' (id {id}) references app resource '{selected}', but no genie_space resource with that name exists for this Databricks app. Add or fix the resource in App Settings, or pick another Genie space."));
            }
        }

        return Result.Ok();
    }
}
