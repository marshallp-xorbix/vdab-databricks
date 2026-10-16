using FluentResults;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <inheritdoc/>
public class AiModelResolverService : IAiModelResolverService
{
    private readonly DatabricksAiConfiguration _platformConfig;
    private readonly ITenantAiModelRepository _tenantAiModelRepository;
    private readonly ITenantResourceGuard _tenantResourceGuard;

    public AiModelResolverService(
        IOptions<DatabricksAiConfiguration> platformOptions,
        ITenantAiModelRepository tenantAiModelRepository,
        ITenantResourceGuard tenantResourceGuard)
    {
        _platformConfig = platformOptions.Value;
        _tenantAiModelRepository = tenantAiModelRepository;
        _tenantResourceGuard = tenantResourceGuard;
    }

    /// <inheritdoc/>
    public async Task<Result<ResolvedAiModelConfiguration>> ResolveAsync(
        Guid tenantId,
        int? tenantAiModelId,
        CancellationToken cancellationToken = default)
    {
        if (!tenantAiModelId.HasValue)
        {
            return ResolvePlatformDefault();
        }

        TenantAiModel? model = await _tenantAiModelRepository.GetByIdForTenantAsync(tenantAiModelId.Value, tenantId, cancellationToken);
        Result guardResult = _tenantResourceGuard.EnsureTenantAiModelInTenant(model, tenantId);
        if (guardResult.IsFailed)
        {
            return guardResult.ToResult<ResolvedAiModelConfiguration>();
        }

        Result connectionGuardResult = _tenantResourceGuard.EnsureConnectionInTenant(model!.DatabricksConnection, tenantId);
        if (connectionGuardResult.IsFailed)
        {
            return connectionGuardResult.ToResult<ResolvedAiModelConfiguration>();
        }

        if (string.IsNullOrWhiteSpace(model.AccessToken))
        {
            return Result.Fail<ResolvedAiModelConfiguration>(
                new BadRequestError("Tenant AI model is missing an access token."));
        }

        return Result.Ok(new ResolvedAiModelConfiguration
        {
            Source = AiModelSource.Tenant,
            DisplayName = model.DisplayName,
            WorkspaceUrl = model.DatabricksConnection!.WorkspaceUrl,
            EndpointName = model.EndpointName,
            AccessToken = model.AccessToken,
            TenantAiModelId = model.TenantAiModelId,
        });
    }

    /// <summary>
    /// Builds the platform default configuration from application settings.
    /// </summary>
    public Result<ResolvedAiModelConfiguration> ResolvePlatformDefault()
    {
        return Result.Ok(new ResolvedAiModelConfiguration
        {
            Source = AiModelSource.Platform,
            DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
            WorkspaceUrl = _platformConfig.WorkspaceUrl,
            EndpointName = _platformConfig.EndpointName,
            AccessToken = _platformConfig.AccessToken,
            TenantAiModelId = null,
        });
    }

    /// <summary>
    /// Returns whether the platform default model is fully configured.
    /// </summary>
    public bool IsPlatformDefaultConfigured()
    {
        return AiBuilderResultClassifier.GetConfigurationReason(_platformConfig) is null;
    }

    /// <summary>
    /// Gets the platform endpoint name for display when configured.
    /// </summary>
    public string GetPlatformEndpointName()
    {
        return _platformConfig.EndpointName;
    }
}
