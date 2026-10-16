using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for Stripe event log diagnostics operations.
/// </summary>
public class StripeEventLogService : IStripeEventLogService
{
    private const int MaxPageSize = 200;
    private readonly IStripeEventLogRepository _stripeEventLogRepository;
    private readonly ILogger<StripeEventLogService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="StripeEventLogService"/> class.
    /// </summary>
    /// <param name="stripeEventLogRepository">Stripe event log repository.</param>
    /// <param name="logger">Logger instance.</param>
    public StripeEventLogService(
        IStripeEventLogRepository stripeEventLogRepository,
        ILogger<StripeEventLogService> logger)
    {
        _stripeEventLogRepository = stripeEventLogRepository;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<Result<PaginatedStripeEventLogsResponse>> GetRecentAsync(int pageNumber, int pageSize, CancellationToken cancellationToken = default)
    {
        int safePageNumber = Math.Max(pageNumber, 1);
        int safePageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        try
        {
            (List<StripeEventLog> logs, int totalCount) = await _stripeEventLogRepository
                .GetRecentWithCountAsync(safePageNumber, safePageSize);

            IList<StripeEventLogDto> logDtos = logs
                .Select(MapToDto)
                .ToList();

            PaginatedStripeEventLogsResponse response = new PaginatedStripeEventLogsResponse
            {
                Logs = logDtos,
                TotalCount = totalCount,
                PageNumber = safePageNumber,
                PageSize = safePageSize
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to retrieve Stripe event logs for page {PageNumber} with size {PageSize}",
                safePageNumber,
                safePageSize);

            return Result.Fail<PaginatedStripeEventLogsResponse>("Failed to retrieve Stripe event logs.");
        }
    }

    private static StripeEventLogDto MapToDto(StripeEventLog log)
    {
        return new StripeEventLogDto
        {
            Id = log.Id,
            StripeEventId = log.StripeEventId,
            EventType = log.EventType,
            ProcessedAt = log.ProcessedAt,
            Success = log.Success,
            ErrorMessage = log.ErrorMessage,
            CustomerId = log.CustomerId,
            DetailSummary = log.DetailSummary
        };
    }
}