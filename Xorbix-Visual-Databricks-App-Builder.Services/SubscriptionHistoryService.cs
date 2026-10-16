using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for reading tenant subscription history records.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="SubscriptionHistoryService"/> class.
/// </remarks>
public class SubscriptionHistoryService(
    ILogger<SubscriptionHistoryService> _logger,
    ITenantRepository _tenantRepository,
    ISubscriptionHistoryRepository _subscriptionHistoryRepository) : ISubscriptionHistoryService
{
    /// <inheritdoc/>
    public async Task<Result<IReadOnlyList<SubscriptionHistoryDto>>> GetSubscriptionHistoryAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for subscription history", tenantId);
                return Result.Fail<IReadOnlyList<SubscriptionHistoryDto>>(new NotFoundError("Tenant not found"));
            }

            IReadOnlyList<SubscriptionHistory> records = await _subscriptionHistoryRepository.GetByTenantIdAsync(tenantId, cancellationToken);

            IReadOnlyList<SubscriptionHistoryDto> dtos = records.Select(MapToDto).ToList();
            return Result.Ok(dtos);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving subscription history for tenant {TenantId}", tenantId);
            return Result.Fail<IReadOnlyList<SubscriptionHistoryDto>>("Failed to retrieve subscription history");
        }
    }

    private static SubscriptionHistoryDto MapToDto(SubscriptionHistory record) => new()
    {
        SubscriptionHistoryId = record.SubscriptionHistoryId,
        TenantId = record.TenantId,
        EventType = record.EventType,
        SubscriptionTier = record.SubscriptionTier,
        BillingCycle = record.BillingCycle,
        Amount = record.Amount,
        Currency = record.Currency,
        ExternalTransactionId = record.ExternalTransactionId,
        StripeInvoiceId = record.StripeInvoiceId,
        StripePaymentIntentId = record.StripePaymentIntentId,
        PaymentStatus = record.PaymentStatus,
        StripeEventId = record.StripeEventId,
        Notes = record.Notes,
        EventDate = record.EventDate,
    };
}
