using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.TenantAiModel;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Models.Mapping;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class TenantAiModelService : ITenantAiModelService
{
    private readonly ITenantAiModelRepository _tenantAiModelRepository;
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly ITenantResourceGuard _tenantResourceGuard;
    private readonly ITenantAiModelValidationService _validationService;
    private readonly ILogger<TenantAiModelService> _logger;

    public TenantAiModelService(
        ITenantAiModelRepository tenantAiModelRepository,
        IDatabricksConnectionRepository connectionRepository,
        ITenantResourceGuard tenantResourceGuard,
        ITenantAiModelValidationService validationService,
        ILogger<TenantAiModelService> logger)
    {
        _tenantAiModelRepository = tenantAiModelRepository;
        _connectionRepository = connectionRepository;
        _tenantResourceGuard = tenantResourceGuard;
        _validationService = validationService;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<IReadOnlyList<TenantAiModelDto>>> GetByTenantAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TenantAiModel> models = await _tenantAiModelRepository.ListByTenantAsync(tenantId, cancellationToken);
        List<TenantAiModelDto> dtos = models.Select(model => model.ToDto()).ToList();
        return Result.Ok<IReadOnlyList<TenantAiModelDto>>(dtos);
    }

    /// <inheritdoc/>
    public async Task<Result<TenantAiModelDto>> GetByIdAsync(
        int tenantAiModelId,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        TenantAiModel? model = await _tenantAiModelRepository.GetByIdForTenantAsync(tenantAiModelId, tenantId, cancellationToken);
        if (model is null)
        {
            return Result.Fail<TenantAiModelDto>(new NotFoundError("Tenant AI model not found."));
        }

        return Result.Ok(model.ToDto());
    }

    /// <inheritdoc/>
    public async Task<Result<TenantAiModelDto>> CreateAsync(
        CreateTenantAiModelRequest request,
        Guid tenantId,
        Guid createdByUserId,
        CancellationToken cancellationToken = default)
    {
        Result<DatabricksConnection> validationResult = await ValidateRequestAsync(request, tenantId, cancellationToken);
        if (validationResult.IsFailed)
        {
            return validationResult.ToResult<TenantAiModelDto>();
        }

        TenantAiModel entity = new()
        {
            TenantId = tenantId,
            DatabricksConnectionId = request.DatabricksConnectionId,
            DisplayName = request.DisplayName.Trim(),
            EndpointName = request.EndpointName.Trim(),
            AccessToken = request.AccessToken.Trim(),
            CreatedByUserId = createdByUserId,
            CreatedBy = createdByUserId,
        };

        TenantAiModel created = await _tenantAiModelRepository.CreateAsync(entity, cancellationToken);
        _logger.LogInformation(
            "Created tenant AI model {TenantAiModelId} for tenant {TenantId}",
            created.TenantAiModelId,
            tenantId);

        TenantAiModel? reloaded = await _tenantAiModelRepository.GetByIdForTenantAsync(
            created.TenantAiModelId,
            tenantId,
            cancellationToken);

        if (reloaded is null)
        {
            return Result.Fail<TenantAiModelDto>(new UpstreamDependencyError("Tenant AI model could not be reloaded after create."));
        }

        return Result.Ok(reloaded.ToDto());
    }

    /// <inheritdoc/>
    public async Task<Result<TenantAiModelDto>> UpdateAsync(
        int tenantAiModelId,
        UpdateTenantAiModelRequest request,
        Guid tenantId,
        Guid modifiedByUserId,
        CancellationToken cancellationToken = default)
    {
        TenantAiModel? existing = await _tenantAiModelRepository.GetByIdForTenantAsync(tenantAiModelId, tenantId, cancellationToken);
        if (existing is null)
        {
            return Result.Fail<TenantAiModelDto>(new NotFoundError("Tenant AI model not found."));
        }

        CreateTenantAiModelRequest createShape = new()
        {
            DisplayName = request.DisplayName,
            DatabricksConnectionId = request.DatabricksConnectionId,
            EndpointName = request.EndpointName,
            AccessToken = string.IsNullOrWhiteSpace(request.AccessToken) ? existing.AccessToken : request.AccessToken,
        };

        Result<DatabricksConnection> validationResult = await ValidateRequestAsync(createShape, tenantId, cancellationToken, tenantAiModelId);
        if (validationResult.IsFailed)
        {
            return validationResult.ToResult<TenantAiModelDto>();
        }

        existing.DisplayName = request.DisplayName.Trim();
        existing.DatabricksConnectionId = request.DatabricksConnectionId;
        existing.EndpointName = request.EndpointName.Trim();
        existing.AccessToken = createShape.AccessToken;
        existing.ModifiedBy = modifiedByUserId;
        existing.DatabricksConnection = null;
        existing.Tenant = null;

        await _tenantAiModelRepository.UpdateAsync(existing, cancellationToken);

        TenantAiModel? reloaded = await _tenantAiModelRepository.GetByIdForTenantAsync(
            tenantAiModelId,
            tenantId,
            cancellationToken);

        if (reloaded is null)
        {
            return Result.Fail<TenantAiModelDto>(new UpstreamDependencyError("Tenant AI model could not be reloaded after update."));
        }

        return Result.Ok(reloaded.ToDto());
    }

    /// <inheritdoc/>
    public async Task<Result> DeleteAsync(
        int tenantAiModelId,
        Guid tenantId,
        Guid deletedByUserId,
        CancellationToken cancellationToken = default)
    {
        bool deleted = await _tenantAiModelRepository.SoftDeleteAsync(tenantAiModelId, tenantId, deletedByUserId, cancellationToken);
        if (!deleted)
        {
            return Result.Fail(new NotFoundError("Tenant AI model not found."));
        }

        return Result.Ok();
    }

    private async Task<Result<DatabricksConnection>> ValidateRequestAsync(
        CreateTenantAiModelRequest request,
        Guid tenantId,
        CancellationToken cancellationToken,
        int? excludeModelId = null)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return Result.Fail<DatabricksConnection>(new ValidationError("Display name is required."));
        }

        if (request.DatabricksConnectionId <= 0)
        {
            return Result.Fail<DatabricksConnection>(new ValidationError("Databricks connection is required."));
        }

        if (string.IsNullOrWhiteSpace(request.EndpointName))
        {
            return Result.Fail<DatabricksConnection>(new ValidationError("Endpoint name is required."));
        }

        if (string.IsNullOrWhiteSpace(request.AccessToken))
        {
            return Result.Fail<DatabricksConnection>(new ValidationError("Access token is required."));
        }

        if (await _tenantAiModelRepository.DisplayNameExistsAsync(tenantId, request.DisplayName, excludeModelId, cancellationToken))
        {
            return Result.Fail<DatabricksConnection>(new ConflictError("A tenant AI model with this display name already exists."));
        }

        DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(request.DatabricksConnectionId);
        Result guardResult = _tenantResourceGuard.EnsureConnectionInTenant(connection, tenantId);
        if (guardResult.IsFailed)
        {
            return guardResult.ToResult<DatabricksConnection>();
        }

        Result endpointValidation = await _validationService.ValidateEndpointAsync(
            connection!.WorkspaceUrl,
            request.EndpointName,
            request.AccessToken,
            cancellationToken);

        if (endpointValidation.IsFailed)
        {
            return endpointValidation.ToResult<DatabricksConnection>();
        }

        return Result.Ok(connection);
    }
}
