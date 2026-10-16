using FluentResults; // Need this using statement
using MaxMind.Db;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

public class AuditLogService : IAuditLogService
{
    // Clamp page size to a sane range so a misbehaving client can't ask for the whole table.
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 25;

    private readonly IAuditLogRepository _repository;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(IAuditLogRepository repository, ILogger<AuditLogService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<PaginatedAuditLogsResponse>> QueryAsync(AuditLogQuery query, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            int take = query.Take <= 0 ? DefaultPageSize : Math.Min(query.Take, MaxPageSize);

            if (query.StartDate is DateTime start && query.EndDate is DateTime end && end < start)
            {
                return Result.Fail<PaginatedAuditLogsResponse>(new BadRequestError("endDate must be on or after startDate"));
            }

            AuditLogQuery effective = new()
            {
                UserId = query.UserId,
                TenantId = query.TenantId,
                ActionTypes = query.ActionTypes,
                StartDate = query.StartDate,
                EndDate = query.EndDate,
                Severities = query.Severities,
                IncludeArchived = query.IncludeArchived,
                Cursor = query.Cursor,
                Take = take,
            };

            (IReadOnlyList<AuditLogDto> items, AuditLogCursor? nextCursor) =
                await _repository.QueryAsync(effective, cancellationToken);

            return Result.Ok(new PaginatedAuditLogsResponse
            {
                Items = items,
                NextCursor = nextCursor?.Encode(),
                Take = effective.Take,
            });
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to query audit logs");
            return Result.Fail<PaginatedAuditLogsResponse>(new ExceptionalError("Failed to query audit logs.", ex));
        }
    }


    /// <inheritdoc/>
    public async Task<Result> LogActionAsync(
        string ipAddress,
        string userAgent,
        string actionType,
        Guid? tenantId,
        Guid? userId,
        string? entityType,
        string? entityId,
        string severity,
        string? metadata = null)
    {
        AuditLog? auditLog = null;
        if (ipAddress == null)
        {
            _logger.LogWarning("Failed to log audit, no IP Address: {IpAddress}", ipAddress);
            return Result.Fail(new BadRequestError($"Failed to log audit, no IP Address: {ipAddress}."));
        }
        else if (actionType == null)
        {
            _logger.LogWarning("Failed to log audit, no Action Type: {ActionType}", actionType);
            return Result.Fail(new BadRequestError($"Failed to log audit, no actionType: {actionType}."));
        }
        else
        {
            auditLog = new AuditLog
            {
                AuditLogId = 0,
                TenantId = tenantId,
                Tenant = null,
                UserId = userId,
                User = null,
                IsArchived = false,
                EntityType = entityType,
                EntityId = entityId,
                HistoricalEntityId = entityId,
                Severity = severity ?? AuditSeverities.Info,
                Timestamp = DateTime.UtcNow,
                ActionType = actionType,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Metadata = metadata,
                Description = actionType + " action performed at " + DateTime.UtcNow.ToString() + " with severity " + severity
            };
        }
        try
        {
            _logger.LogInformation("Attempting to log audit: {ActionType} for tenant {TenantId}", actionType, tenantId);
            await _repository.LogAsync(auditLog);
            _logger.LogInformation("Successfully logged audit: {ActionType} for tenant {TenantId}", actionType, tenantId);
            return Result.Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to log audit {ActionType} for tenant {TenantId}", actionType, tenantId);
            return Result.Fail(new ExceptionalError($"Failed to log audit {actionType}: {ex.Message}", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<AuditLog>>> GetAuditLogsByTenantAsync(Tenant? tenant, int skip, int take, CancellationToken token)
    {
        try
        {
            _logger.LogInformation("Attempting to retrieve audit logs by tenant: {Tenant}", tenant);
            List<AuditLog> auditLogs = await _repository.GetByTenantAsync(tenant, skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found for tenant: {Tenant}", tenant);
                return Result.Ok<List<AuditLog>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs by tenant: {Tenant}", tenant);
            return Result.Ok<List<AuditLog>>(auditLogs);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs by tenant: {Tenant}", tenant);
            return Result.Fail<List<AuditLog>>(new ExceptionalError($"Failed to retrieve audit logs for tenant {tenant}.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<AuditLog>>> GetAuditLogsByTenantOnRangeAsync(Tenant? tenant, DateTime startDate, DateTime endDate, int skip, int take, CancellationToken token)
    {
        try
        {
            _logger.LogInformation("Attempting to retrieve audit logs by tenant: {Tenant}", tenant);
            List<AuditLog> auditLogs = await _repository.GetByTenantOnRangeAsync(tenant, startDate, endDate, skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found for tenant: {Tenant}", tenant);
                return Result.Ok<List<AuditLog>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs by tenant: {Tenant}", tenant);
            return Result.Ok<List<AuditLog>>(auditLogs);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs by tenant: {Tenant}", tenant);
            return Result.Fail<List<AuditLog>>(new ExceptionalError($"Failed to retrieve audit logs for tenant {tenant}.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<AuditLog>>> GetAuditLogsByUserAsync(Guid? userId, int skip, int take, CancellationToken token)
    {
        try
        {
            _logger.LogInformation("Attempting to retrieve audit logs by userId: {UserId}", userId);
            List<AuditLog> auditLogs = await _repository.GetByUserAsync(userId, skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found for userId: {UserId}", userId);
                return Result.Ok<List<AuditLog>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs by userId: {UserId}", userId);
            return Result.Ok<List<AuditLog>>(auditLogs);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs by userId: {UserId}", userId);
            return Result.Fail<List<AuditLog>>(new ExceptionalError($"Failed to retrieve audit logs for userId {userId}.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result<List<AuditLog>>> GetAllAuditLogsAsync(int skip, int take, CancellationToken token)
    {
        try
        {
            token.ThrowIfCancellationRequested();
            _logger.LogInformation("Attempting to retrieve all audit logs");
            List<AuditLog> auditLogs = await _repository.GetAllAuditLogsAsync(skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found");
                return Result.Ok<List<AuditLog>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs");
            return Result.Ok<List<AuditLog>>(auditLogs);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs");
            return Result.Fail<List<AuditLog>>(new ExceptionalError($"Failed to retrieve audit logs.", ex));
        }
    }


    /// <inheritdoc/>
    public async Task<Result<List<string>>> GetUserActivityAsync(Guid? userId, int skip, int take, CancellationToken token)
    {
        try
        {
            _logger.LogInformation("Attempting to retrieve audit logs by userId: {UserId}", userId);
            List<AuditLog> auditLogs = await _repository.GetByUserAsync(userId, skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found for userId: {UserId}", userId);
                return Result.Ok<List<string>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs by userId: {UserId}", userId);
            List<string> userActivity = new List<string>();
            for (int i = 0; i < auditLogs.Count; i++)
            {
                userActivity.Add(auditLogs[i].ActionType.ToString());
            }
            return Result.Ok<List<string>>(userActivity);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs by userId: {UserId}", userId);
            return Result.Fail<List<string>>(new ExceptionalError($"Failed to retrieve audit logs for userId {userId}.", ex));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ArchiveAuditLogsAsync(List<AuditLog> auditLogs, CancellationToken token)
    {
        try
        {
            token.ThrowIfCancellationRequested();
            foreach (AuditLog auditLog in auditLogs)
            {
                _logger.LogInformation("Attempting to archive audit log: {AuditLogId}", auditLog.AuditLogId);
                await _repository.MarkArchivedAsync(auditLog, token);
                _logger.LogInformation("Successfully archived audit log: {AuditLogId}", auditLog.AuditLogId);
            }
            return Result.Ok();
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to archive {AuditLogCount} audit logs", auditLogs.Count);
            return Result.Fail(new ExceptionalError($"Failed to archive audit logs: {ex.Message}", ex));
        }
    }


    /// <inheritdoc/>
    public async Task<Result<List<AuditLog>>> GetAuditLogsForArchival(DateTime start, DateTime end, int skip, int take, CancellationToken token)
    {
        try
        {
            token.ThrowIfCancellationRequested();
            _logger.LogInformation("Attempting to retrieve audit logs for archival");
            List<AuditLog> auditLogs = await _repository.GetRecordsForArchivalAsync(start, end, skip, take);

            if (auditLogs.Count == 0)
            {
                _logger.LogWarning("Audit logs not found");
                return Result.Ok<List<AuditLog>>([]);
            }

            _logger.LogInformation("Successfully retrieved audit logs");
            return Result.Ok<List<AuditLog>>(auditLogs);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit logs");
            return Result.Fail<List<AuditLog>>(new ExceptionalError($"Failed to retrieve audit logs.", ex));
        }
    }


    /// <inheritdoc/>
    public async Task<FileContentResult> exportAuditLogsToCsv(
        List<AuditLog> auditLogs,
        CancellationToken token
        )
    {
        var stringBuilder = new StringBuilder();

        // Header row (adjust fields to match your model)
        stringBuilder.AppendLine("UserId,ActionType,AuditLog,Timestamp");

        foreach (var log in auditLogs)
        {
            //"AuditLogId", "TenantId", "UserId", "IsArchived", "ActionType", "EntityType", "EntityId", "HistoricalEntityId", "Description", "Metadata", "IpAddress", "UserAgent", "Severity", "Timestamp"
            stringBuilder.AppendLine($"AuditLogId:{log.AuditLogId},TenantId:{log.TenantId},UserId:{log.UserId},IsArchived:{log.IsArchived},ActionType:{log.ActionType},EntityType:{log.EntityType},EntityId:{log.EntityId},HistoricalEntityId:{log.HistoricalEntityId},Description:{log.Description},Metadata:{log.Metadata},IpAddress:{log.IpAddress},UserAgent:{log.UserAgent},Severity:{log.Severity},Timestamp:{log.Timestamp}");
        }

        var bytes = Encoding.UTF8.GetBytes(stringBuilder.ToString());

        return new FileContentResult(bytes, "text/csv")
        {
            FileDownloadName = "auditLogs.csv"
        };
    }


    /// <inheritdoc/>
    public async Task<FileContentResult> exportAuditLogsToJson(
        List<AuditLog> auditLogs,
        CancellationToken token
        )
    {
        var json = JsonSerializer.Serialize(auditLogs, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var bytes = Encoding.UTF8.GetBytes(json);
        return new FileContentResult(bytes, "application/json")
        {
            FileDownloadName = "auditLogs.json"
        };
    }
}
