using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Databricks;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Portability;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc/>
public class DatabricksConnectionImportExportService : IDatabricksConnectionImportExportService
{
    private readonly IDatabricksConnectionRepository _connectionRepository;
    private readonly IDatabricksConnectionService _connectionService;
    private readonly IUserTenantMembershipService _membershipService;
    private readonly ILogger<DatabricksConnectionImportExportService> _logger;

    public DatabricksConnectionImportExportService(
        IDatabricksConnectionRepository connectionRepository,
        IDatabricksConnectionService connectionService,
        IUserTenantMembershipService membershipService,
        ILogger<DatabricksConnectionImportExportService> logger)
    {
        _connectionRepository = connectionRepository;
        _connectionService = connectionService;
        _membershipService = membershipService;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<ExportBundleDto>> ExportConnectionsByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Exporting all Databricks connections for tenant {TenantId}", tenantId);

            IEnumerable<DatabricksConnection> connections = await _connectionRepository.GetByTenantIdAsync(tenantId)
                ?? Enumerable.Empty<DatabricksConnection>();

            List<DatabricksConnectionExportDto> exported = connections
                .Where(c => c.DeletedOn == null)
                .Select(ToExportDto)
                .ToList();

            return Result.Ok(BuildBundle(exported));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export Databricks connections for tenant {TenantId}", tenantId);
            return Result.Fail<ExportBundleDto>(new ExceptionalError("Failed to export connections.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ExportBundleDto>> ExportConnectionAsync(int connectionId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Exporting Databricks connection {ConnectionId} for tenant {TenantId}", connectionId, tenantId);

            DatabricksConnection? connection = await _connectionRepository.GetByIdAsync(connectionId);
            if (connection == null || connection.DeletedOn != null)
            {
                return Result.Fail<ExportBundleDto>(new NotFoundError($"Connection {connectionId} was not found."));
            }

            if (connection.TenantId != tenantId)
            {
                return Result.Fail<ExportBundleDto>(new ForbiddenError("This connection does not belong to your tenant."));
            }

            return Result.Ok(BuildBundle([ToExportDto(connection)]));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export Databricks connection {ConnectionId}", connectionId);
            return Result.Fail<ExportBundleDto>(new ExceptionalError("Failed to export connection.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<ImportElementResultDto>> ImportConnectionAsync(ImportConnectionRequest request, Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (request?.Connection == null
            || string.IsNullOrWhiteSpace(request.Connection.WorkspaceUrl)
            || string.IsNullOrWhiteSpace(request.Connection.WorkspaceDisplayName))
        {
            return Result.Fail<ImportElementResultDto>(new BadRequestError("Workspace URL and display name are required."));
        }

        if (request.OwnerId == Guid.Empty)
        {
            return Result.Fail<ImportElementResultDto>(new BadRequestError("An owner must be selected for the connection."));
        }

        try
        {
            bool ownerBelongs = await _membershipService.UserBelongsToTenantAsync(request.OwnerId, tenantId, cancellationToken);
            if (!ownerBelongs)
            {
                return Result.Fail<ImportElementResultDto>(new BadRequestError("The selected owner is not a member of your tenant."));
            }

            IEnumerable<DatabricksConnection> existing = await _connectionRepository.GetByTenantIdAsync(tenantId)
                ?? Enumerable.Empty<DatabricksConnection>();

            HashSet<string> existingDisplayNames = existing
                .Where(c => c.DeletedOn == null)
                .Select(c => c.WorkspaceDisplayName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            string requestedDisplayName = request.Connection.WorkspaceDisplayName.Trim();
            string finalDisplayName = ImportNaming.ResolveUniqueName(requestedDisplayName, existingDisplayNames);
            bool renamed = !string.Equals(finalDisplayName, requestedDisplayName, StringComparison.Ordinal);

            CreateDatabricksConnectionRequest createRequest = new CreateDatabricksConnectionRequest
            {
                WorkspaceUrl = request.Connection.WorkspaceUrl,
                WorkspaceDisplayName = finalDisplayName,
                ClientId = request.Connection.ClientId,
                ClientSecret = request.ClientSecret,
                AccessTokenTtlMinutes = request.Connection.AccessTokenTtlMinutes,
                RefreshTokenLifespanMinutes = request.Connection.RefreshTokenLifespanMinutes
            };

            // CreateConnectionAsync normalizes the URL and rejects duplicate workspace URLs
            // within the tenant with a ConflictError, which the caller treats as "skip".
            Result<DatabricksConnectionDto> createResult = await _connectionService.CreateConnectionAsync(
                createRequest,
                request.OwnerId,
                tenantId);

            if (createResult.IsFailed)
            {
                return Result.Fail<ImportElementResultDto>(createResult.Errors);
            }

            _logger.LogInformation(
                "Imported Databricks connection {DisplayName} ({ConnectionId}) into tenant {TenantId}",
                finalDisplayName,
                createResult.Value.PkId,
                tenantId);

            return Result.Ok(new ImportElementResultDto
            {
                Name = finalDisplayName,
                NewId = createResult.Value.PkId,
                Renamed = renamed
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import Databricks connection into tenant {TenantId}", tenantId);
            return Result.Fail<ImportElementResultDto>(new ExceptionalError("Failed to import connection.", ex));
        }
    }

    private static DatabricksConnectionExportDto ToExportDto(DatabricksConnection connection) => new DatabricksConnectionExportDto
    {
        WorkspaceUrl = connection.WorkspaceUrl,
        WorkspaceDisplayName = connection.WorkspaceDisplayName,
        ClientId = connection.ClientId,
        AccessTokenTtlMinutes = connection.AccessTokenTtlMinutes,
        RefreshTokenLifespanMinutes = connection.RefreshTokenLifespanMinutes
    };

    private static ExportBundleDto BuildBundle(List<DatabricksConnectionExportDto> connections) => new ExportBundleDto
    {
        SchemaVersion = 1,
        ExportedAt = DateTime.UtcNow,
        Type = ExportBundleTypes.Connections,
        Connections = connections
    };
}
