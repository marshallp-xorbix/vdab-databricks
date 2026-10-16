using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <inheritdoc/>
public class AiBuilderModelSelectionService : IAiBuilderModelSelectionService
{
    private readonly IAiModelResolverService _resolverService;
    private readonly ITenantAiModelRepository _tenantAiModelRepository;
    private readonly IUserTenantPreferenceRepository _preferenceRepository;

    public AiBuilderModelSelectionService(
        IAiModelResolverService resolverService,
        ITenantAiModelRepository tenantAiModelRepository,
        IUserTenantPreferenceRepository preferenceRepository)
    {
        _resolverService = resolverService;
        _tenantAiModelRepository = tenantAiModelRepository;
        _preferenceRepository = preferenceRepository;
    }

    /// <inheritdoc/>
    public async Task<Result<IReadOnlyList<AiBuilderModelOptionDto>>> GetAvailableModelsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        List<AiBuilderModelOptionDto> options = [CreatePlatformDefaultOption()];

        IReadOnlyList<TenantAiModel> tenantModels =
            await _tenantAiModelRepository.ListByTenantAsync(tenantId, cancellationToken);
        foreach (TenantAiModel model in tenantModels)
        {
            options.Add(new AiBuilderModelOptionDto
            {
                Id = model.TenantAiModelId,
                DisplayName = model.DisplayName,
                Source = AiModelSource.Tenant,
                EndpointName = model.EndpointName,
                ConnectionDisplayName = model.DatabricksConnection?.WorkspaceDisplayName,
                IsConfigured = true,
            });
        }

        return Result.Ok<IReadOnlyList<AiBuilderModelOptionDto>>(options);
    }

    /// <inheritdoc/>
    public async Task<Result<AiBuilderSelectedModelDto>> GetSelectedModelAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        int? selectedId = await _preferenceRepository.GetIntPreferenceAsync(
            userId,
            tenantId,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            cancellationToken);
        if (!selectedId.HasValue)
        {
            return Result.Ok(CreatePlatformDefaultSelection());
        }

        TenantAiModel? model = await _tenantAiModelRepository.GetByIdForTenantAsync(selectedId.Value, tenantId, cancellationToken);
        if (model is null)
        {
            return Result.Ok(CreatePlatformDefaultSelection());
        }

        return Result.Ok(new AiBuilderSelectedModelDto
        {
            AiModelId = model.TenantAiModelId,
            DisplayName = model.DisplayName,
            Source = AiModelSource.Tenant,
        });
    }

    /// <inheritdoc/>
    public async Task<Result<AiBuilderSelectedModelDto>> SetSelectedModelAsync(
        Guid userId,
        Guid tenantId,
        int? tenantAiModelId,
        CancellationToken cancellationToken = default)
    {
        if (tenantAiModelId.HasValue)
        {
            TenantAiModel? model = await _tenantAiModelRepository.GetByIdForTenantAsync(
                tenantAiModelId.Value,
                tenantId,
                cancellationToken);
            if (model is null)
            {
                return Result.Fail<AiBuilderSelectedModelDto>(new NotFoundError("Tenant AI model not found."));
            }
        }

        bool updated = await _preferenceRepository.UpsertIntPreferenceAsync(
            userId,
            tenantId,
            UserTenantPreferenceKeys.AiBuilderSelectedModelId,
            tenantAiModelId,
            cancellationToken);
        if (!updated)
        {
            return Result.Fail<AiBuilderSelectedModelDto>(new NotFoundError("Tenant membership not found."));
        }

        return await GetSelectedModelAsync(userId, tenantId, cancellationToken);
    }

    private AiBuilderModelOptionDto CreatePlatformDefaultOption()
    {
        return new AiBuilderModelOptionDto
        {
            Id = null,
            DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
            Source = AiModelSource.Platform,
            EndpointName = _resolverService.GetPlatformEndpointName(),
            IsConfigured = _resolverService.IsPlatformDefaultConfigured(),
        };
    }

    private static AiBuilderSelectedModelDto CreatePlatformDefaultSelection()
    {
        return new AiBuilderSelectedModelDto
        {
            AiModelId = null,
            DisplayName = AiBuilderConstants.PlatformDefaultDisplayName,
            Source = AiModelSource.Platform,
        };
    }
}
