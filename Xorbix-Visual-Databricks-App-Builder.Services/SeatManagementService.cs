using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Stripe;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Manages tenant seat lifecycle and Stripe quantity synchronization.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="SeatManagementService"/> class.
/// </remarks>
public class SeatManagementService(
    ILogger<SeatManagementService> _logger,
    ISubscriptionSeatRepository _subscriptionSeatRepository,
    ITenantRepository _tenantRepository,
    IUserTenantMembershipService _userTenantMembershipService,
    ISubscriptionTierService _subscriptionTierService,
    IInternalDevTenantService _internalDevTenantService,
    IStripeClient _stripeClient,
    UserManager<ApplicationUser> _userManager,
    ITenantAccessRevocationService _tenantAccessRevocationService,
    IAuditLogService _auditLogService) : ISeatManagementService
{
    private const int MaxSeatChangeCount = 1000;
    private const string AuditUserAgent = "SeatManagementService";
    private const string AuditIp = "internal-service";
    private const string ActionTypeMembershipEnd = "MembershipEnd";
    private const string EntityTypeMembership = "tenant-membership";

    /// <inheritdoc/>
    public async Task<Result<int>> InitializeSeatsForSubscriptionAsync(Guid tenantId, string tier, Guid creatorUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<SubscriptionTierLimits> tierLimitsResult = _subscriptionTierService.GetTierLimits(tier);
            if (tierLimitsResult.IsFailed)
            {
                return Result.Fail(tierLimitsResult.Errors);
            }

            int seatCount = ResolveInitialSeatCount(tier, tierLimitsResult.Value);
            if (seatCount <= 0)
            {
                return Result.Fail(new BadRequestError($"Tier '{tier}' does not support self-service seat initialization."));
            }

            IEnumerable<SubscriptionSeat> existingSeats = await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken);
            if (existingSeats.Any())
            {
                return Result.Fail(new ConflictError("Subscription seats are already initialized for this tenant."));
            }

            bool creatorBelongsToTenant = await _userTenantMembershipService.UserBelongsToTenantAsync(creatorUserId, tenantId, cancellationToken);
            if (!creatorBelongsToTenant)
            {
                return Result.Fail(new ForbiddenError("Creator does not belong to the tenant and cannot receive the initial seat assignment."));
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;
            List<SubscriptionSeat> seatsToCreate = new(seatCount);

            for (int index = 0; index < seatCount; index++)
            {
                Guid? assignedUserId = index == 0 ? creatorUserId : null;
                DateTimeOffset? assignedAt = assignedUserId.HasValue ? now : null;

                SubscriptionSeat seat = new()
                {
                    TenantId = tenantId,
                    UserId = assignedUserId,
                    Status = SubscriptionSeatStatuses.Active,
                    IsBundled = true,
                    SeatStartDate = now,
                    AssignedAt = assignedAt,
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = creatorUserId
                };

                seatsToCreate.Add(seat);
            }

            await _subscriptionSeatRepository.AddRangeAsync(seatsToCreate, cancellationToken);

            _logger.LogInformation("Initialized {SeatCount} bundled seats for tenant {TenantId} on tier {Tier}", seatCount, tenantId, tier);

            return Result.Ok(seatCount);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize seats for tenant {TenantId}", tenantId);
            return Result.Fail<int>("Failed to initialize seats for subscription.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatSummaryDto>> GetSeatSummaryAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail(tenantResult.Errors);
            }

            // Seat reads are allowed for every tier (including Individual's single seat).
            // Mutations remain gated by EnsureSeatManagementAllowed.
            IEnumerable<SubscriptionSeat> seats = await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken);
            SeatSummaryDto summary = BuildSeatSummary(seats);

            return Result.Ok(summary);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get seat summary for tenant {TenantId}", tenantId);
            return Result.Fail<SeatSummaryDto>("Failed to retrieve seat summary.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<SeatDto>>> GetSeatsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(tenantResult.Errors);
            }

            // Seat reads are allowed for every tier so admins can see Individual's single
            // occupant (and any stored seats on Enterprise). Mutations stay gated separately.
            List<SeatDto> seats = (await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken))
                .OrderByDescending(seat => seat.IsBundled)
                .ThenBy(seat => seat.SeatStartDate)
                .ThenBy(seat => seat.SubscriptionSeatId)
                .Select(MapToSeatDto)
                .ToList();

            return Result.Ok<IList<SeatDto>>(seats);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get seats for tenant {TenantId}", tenantId);
            return Result.Fail<IList<SeatDto>>("Failed to retrieve seats.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> TryAssignOpenSeatIfAllowedAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Ok();
            }

            if (EnsureSeatManagementAllowed(tenantResult.Value).IsFailed)
            {
                return Result.Ok();
            }

            SubscriptionSeat? existingUserSeat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId, cancellationToken);
            if (existingUserSeat != null)
            {
                return Result.Ok();
            }

            IEnumerable<SubscriptionSeat> availableSeats = await _subscriptionSeatRepository.GetAvailableSeatsAsync(tenantId, cancellationToken);
            SubscriptionSeat? openSeat = availableSeats.FirstOrDefault();
            if (openSeat is null)
            {
                return Result.Ok();
            }

            Result<SeatDto> assignResult = await AssignSeatAsync(tenantId, openSeat.SubscriptionSeatId, userId, cancellationToken);
            if (assignResult.IsFailed)
            {
                _logger.LogWarning(
                    "Best-effort seat assign skipped for user {UserId} on tenant {TenantId}: {Errors}",
                    userId,
                    tenantId,
                    string.Join(", ", assignResult.Errors.Select(error => error.Message)));
            }

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Best-effort seat assign failed for user {UserId} on tenant {TenantId}", userId, tenantId);
            return Result.Ok();
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> AssignSeatAsync(Guid tenantId, Guid seatId, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenantResult.Value);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatManagementAllowedResult.Errors);
            }

            IEnumerable<SubscriptionSeat> availableSeats = await _subscriptionSeatRepository.GetAvailableSeatsAsync(tenantId, cancellationToken);
            if (!availableSeats.Any())
            {
                return Result.Fail<SeatDto>(new ForbiddenError(
                    "No available seats. Purchase additional seats before assigning or inviting users."));
            }

            Result<SubscriptionSeat> seatResult = await GetSeatForTenantAsync(tenantId, seatId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatResult.Errors);
            }

            SubscriptionSeat seat = seatResult.Value;

            if (!string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal))
            {
                return Result.Fail<SeatDto>(new BadRequestError("Only active seats can be assigned."));
            }

            if (seat.UserId.HasValue)
            {
                return Result.Fail<SeatDto>(new ConflictError("Seat is already occupied."));
            }

            bool userBelongsToTenant = await _userTenantMembershipService.UserBelongsToTenantAsync(userId, tenantId, cancellationToken);
            if (!userBelongsToTenant)
            {
                return Result.Fail<SeatDto>(new ForbiddenError("User does not belong to the tenant."));
            }

            SubscriptionSeat? existingUserSeat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId, cancellationToken);
            if (existingUserSeat != null)
            {
                return Result.Fail<SeatDto>(new ConflictError("User already has an assigned seat in this tenant."));
            }

            seat.User = null;
            seat.UserId = userId;
            seat.AssignedAt = DateTimeOffset.UtcNow;
            seat.CanceledAt = null;

            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

            SubscriptionSeat? updatedSeat = await _subscriptionSeatRepository.GetByIdAsync(seat.SubscriptionSeatId, cancellationToken);
            if (updatedSeat == null)
            {
                return Result.Fail<SeatDto>(new NotFoundError("Assigned seat could not be reloaded."));
            }

            return Result.Ok(MapToSeatDto(updatedSeat));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to assign seat {SeatId} for tenant {TenantId}", seatId, tenantId);
            return Result.Fail<SeatDto>("Failed to assign seat.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> UnassignSeatAsync(Guid tenantId, Guid seatId, bool cancelExtraSeat, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatManagementAllowedResult.Errors);
            }

            Result<SubscriptionSeat> seatResult = await GetSeatForTenantAsync(tenantId, seatId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatResult.Errors);
            }

            SubscriptionSeat seat = seatResult.Value;

            if (!seat.UserId.HasValue)
            {
                return Result.Fail<SeatDto>(new BadRequestError("Seat is already unoccupied."));
            }

            if (cancelExtraSeat && seat.IsBundled)
            {
                return Result.Fail<SeatDto>(new ForbiddenError("Bundled seats cannot be canceled. Unassign only."));
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;

            ClearSeatAssignment(seat);

            if (cancelExtraSeat)
            {
                DateTimeOffset periodEnd = tenant.SubscriptionEndDate ?? now;

                seat.Status = SubscriptionSeatStatuses.PendingCancellation;
                seat.CanceledAt = now;
                seat.SeatEndDate = periodEnd;
            }
            else
            {
                seat.Status = SubscriptionSeatStatuses.Active;
                seat.CanceledAt = null;

                if (!seat.IsBundled)
                {
                    seat.SeatEndDate = null;
                }
            }

            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

            SubscriptionSeat? updatedSeat = await _subscriptionSeatRepository.GetByIdAsync(seat.SubscriptionSeatId, cancellationToken);
            if (updatedSeat == null)
            {
                return Result.Fail<SeatDto>(new NotFoundError("Updated seat could not be reloaded."));
            }

            return Result.Ok(MapToSeatDto(updatedSeat));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to unassign seat {SeatId} for tenant {TenantId}", seatId, tenantId);
            return Result.Fail<SeatDto>("Failed to unassign seat.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> TransferSeatAsync(Guid tenantId, Guid seatId, Guid newUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenantResult.Value);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatManagementAllowedResult.Errors);
            }

            Result<SubscriptionSeat> seatResult = await GetSeatForTenantAsync(tenantId, seatId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatResult.Errors);
            }

            SubscriptionSeat seat = seatResult.Value;

            if (!string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal))
            {
                return Result.Fail<SeatDto>(new BadRequestError("Only active seats can be transferred."));
            }

            if (!seat.UserId.HasValue)
            {
                return Result.Fail<SeatDto>(new BadRequestError("Seat is unoccupied. Use assign operation instead."));
            }

            bool userBelongsToTenant = await _userTenantMembershipService.UserBelongsToTenantAsync(newUserId, tenantId, cancellationToken);
            if (!userBelongsToTenant)
            {
                return Result.Fail<SeatDto>(new ForbiddenError("User does not belong to the tenant."));
            }

            SubscriptionSeat? existingUserSeat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, newUserId, cancellationToken);
            if (existingUserSeat != null && existingUserSeat.SubscriptionSeatId != seat.SubscriptionSeatId)
            {
                return Result.Fail<SeatDto>(new ConflictError("Target user already has an assigned seat in this tenant."));
            }

            seat.User = null;
            seat.UserId = newUserId;
            seat.AssignedAt = DateTimeOffset.UtcNow;

            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

            SubscriptionSeat? updatedSeat = await _subscriptionSeatRepository.GetByIdAsync(seat.SubscriptionSeatId, cancellationToken);
            if (updatedSeat == null)
            {
                return Result.Fail<SeatDto>(new NotFoundError("Transferred seat could not be reloaded."));
            }

            return Result.Ok(MapToSeatDto(updatedSeat));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to transfer seat {SeatId} for tenant {TenantId}", seatId, tenantId);
            return Result.Fail<SeatDto>("Failed to transfer seat.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<SeatDto>>> PurchaseAdditionalSeatsAsync(Guid tenantId, int count, CancellationToken cancellationToken = default)
    {
        try
        {
            Result validateCountResult = ValidateSeatCountArgument(count);
            if (validateCountResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(validateCountResult.Errors);
            }

            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(seatManagementAllowedResult.Errors);
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;
            List<SubscriptionSeat> newSeats = new List<SubscriptionSeat>(count);

            for (int index = 0; index < count; index++)
            {
                SubscriptionSeat seat = new SubscriptionSeat
                {
                    TenantId = tenantId,
                    Status = SubscriptionSeatStatuses.Active,
                    IsBundled = false,
                    SeatStartDate = now,
                    CreatedOn = DateTime.UtcNow
                };

                newSeats.Add(seat);
            }

            await _subscriptionSeatRepository.AddRangeAsync(newSeats, cancellationToken);

            int totalBillableSeats = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            bool isInternalDevTenant = _internalDevTenantService.IsInternalDevTenant(tenantId);
            if (!isInternalDevTenant)
            {
                Result stripeSyncResult = await SyncStripeQuantityAsync(tenant, totalBillableSeats, prorate: true, cancellationToken);
                if (stripeSyncResult.IsFailed)
                {
                    return Result.Fail<IList<SeatDto>>(stripeSyncResult.Errors);
                }
            }

            ApplySeatCountLimitsToTenant(tenant, totalBillableSeats, isInternalDevTenant);
            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            IList<SeatDto> createdSeatDtos = newSeats.Select(MapToSeatDto).ToList();
            return Result.Ok(createdSeatDtos);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to purchase {Count} additional seats for tenant {TenantId}", count, tenantId);
            return Result.Fail<IList<SeatDto>>("Failed to purchase additional seats.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> IncreaseSeatQuantityForPurchaseAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail(seatManagementAllowedResult.Errors);
            }

            int targetSeatCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken) + 1;
            if (_internalDevTenantService.IsInternalDevTenant(tenantId))
            {
                _logger.LogInformation(
                    "Skipping Stripe seat quantity increase for internal/dev tenant {TenantId}; complimentary seat capacity is {SeatCount}",
                    tenantId, targetSeatCount);
                return Result.Ok();
            }

            Result stripeSyncResult = await SyncStripeQuantityAsync(tenant, targetSeatCount, prorate: true, cancellationToken);
            if (stripeSyncResult.IsFailed)
            {
                return Result.Fail(stripeSyncResult.Errors);
            }

            _logger.LogInformation(
                "Increased Stripe seat quantity to {SeatCount} for tenant {TenantId} ahead of an over-allotment seat purchase",
                targetSeatCount, tenantId);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to increase Stripe seat quantity for tenant {TenantId}", tenantId);
            return Result.Fail("Failed to increase the subscription seat quantity.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> MaterializePurchasedSeatAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;

            SubscriptionSeat? existingUserSeat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId, cancellationToken);
            if (existingUserSeat != null)
            {
                return Result.Fail<SeatDto>(new ConflictError("User already has an assigned seat in this tenant."));
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;
            SubscriptionSeat seat = new SubscriptionSeat
            {
                TenantId = tenantId,
                UserId = userId,
                Status = SubscriptionSeatStatuses.Active,
                IsBundled = false,
                SeatStartDate = now,
                AssignedAt = now,
                CreatedOn = DateTime.UtcNow,
                CreatedBy = userId
            };

            await _subscriptionSeatRepository.AddRangeAsync(new[] { seat }, cancellationToken);

            int totalBillableSeats = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            bool isInternalDevTenant = _internalDevTenantService.IsInternalDevTenant(tenantId);
            ApplySeatCountLimitsToTenant(tenant, totalBillableSeats, isInternalDevTenant);
            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            _logger.LogInformation(
                "Materialized purchased seat {SeatId} for user {UserId} on tenant {TenantId}. New billable seat count {SeatCount}",
                seat.SubscriptionSeatId, userId, tenantId, totalBillableSeats);

            return Result.Ok(MapToSeatDto(seat));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to materialize a purchased seat for user {UserId} on tenant {TenantId}", userId, tenantId);
            return Result.Fail<SeatDto>("Failed to record the purchased seat.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<IList<SeatDto>>> RemoveExtraSeatsAsync(Guid tenantId, int count, CancellationToken cancellationToken = default)
    {
        try
        {
            Result validateCountResult = ValidateSeatCountArgument(count);
            if (validateCountResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(validateCountResult.Errors);
            }

            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<IList<SeatDto>>(seatManagementAllowedResult.Errors);
            }

            List<SubscriptionSeat> candidateSeats = (await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken))
                .Where(seat => !seat.IsBundled
                    && string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal)
                    && seat.UserId == null)
                .OrderBy(seat => seat.SeatStartDate)
                .ThenBy(seat => seat.SubscriptionSeatId)
                .Take(count)
                .ToList();

            if (candidateSeats.Count < count)
            {
                return Result.Fail<IList<SeatDto>>(new BadRequestError(
                    $"Unable to remove {count} extra seats. Only {candidateSeats.Count} unoccupied extra seats are available."));
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;
            DateTimeOffset periodEnd = tenant.SubscriptionEndDate ?? now;

            foreach (SubscriptionSeat seat in candidateSeats)
            {
                seat.Status = SubscriptionSeatStatuses.PendingCancellation;
                seat.CanceledAt = now;
                seat.SeatEndDate = periodEnd;
                await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
            }

            IList<SeatDto> scheduledSeats = candidateSeats.Select(MapToSeatDto).ToList();
            return Result.Ok(scheduledSeats);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove {Count} extra seats for tenant {TenantId}", count, tenantId);
            return Result.Fail<IList<SeatDto>>("Failed to schedule extra seat removals.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatPreviewDto>> PreviewSeatChangeAsync(Guid tenantId, int seatDelta, CancellationToken cancellationToken = default)
    {
        try
        {
            if (seatDelta == 0)
            {
                return Result.Fail<SeatPreviewDto>(new BadRequestError("Seat delta cannot be zero."));
            }

            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatPreviewDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatPreviewDto>(seatManagementAllowedResult.Errors);
            }

            int currentSeatCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            int newSeatCount = currentSeatCount + seatDelta;

            Result<SubscriptionTierLimits> tierLimitsResult = _subscriptionTierService.GetTierLimits(tenant.SubscriptionTier);
            if (tierLimitsResult.IsFailed)
            {
                return Result.Fail<SeatPreviewDto>(tierLimitsResult.Errors);
            }

            int minimumSeatCount = Math.Max(1, tierLimitsResult.Value.MinimumSeats);
            if (newSeatCount < minimumSeatCount)
            {
                return Result.Fail<SeatPreviewDto>(new BadRequestError(
                    $"Seat count cannot be reduced below tier minimum of {minimumSeatCount}."));
            }

            if (_internalDevTenantService.IsInternalDevTenant(tenantId))
            {
                DateTime complimentaryEffectiveDate = DateTime.UtcNow;
                return Result.Ok(new SeatPreviewDto
                {
                    CurrentSeats = currentSeatCount,
                    NewSeats = newSeatCount,
                    ProratedAmount = 0m,
                    Currency = "USD",
                    EffectiveDate = complimentaryEffectiveDate
                });
            }

            Result<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)> stripeDataResult =
                await GetStripeSubscriptionAndItemAsync(tenant.StripeSubscriptionId, cancellationToken);

            if (stripeDataResult.IsFailed)
            {
                return Result.Fail<SeatPreviewDto>(stripeDataResult.Errors);
            }

            (Stripe.Subscription subscription, Stripe.SubscriptionItem subscriptionItem) = stripeDataResult.Value;

            DateTime prorationDate = DateTime.UtcNow;

            InvoiceCreatePreviewOptions previewOptions = new InvoiceCreatePreviewOptions
            {
                Customer = subscription.CustomerId,
                Subscription = subscription.Id,
                SubscriptionDetails = new InvoiceSubscriptionDetailsOptions
                {
                    ProrationBehavior = "create_prorations",
                    ProrationDate = prorationDate,
                    Items = new List<InvoiceSubscriptionDetailsItemOptions>
                    {
                        new InvoiceSubscriptionDetailsItemOptions
                        {
                            Id = subscriptionItem.Id,
                            Quantity = newSeatCount
                        }
                    }
                }
            };

            InvoiceService invoiceService = new InvoiceService(_stripeClient);
            Invoice preview = await invoiceService.CreatePreviewAsync(previewOptions, null, cancellationToken);

            decimal proratedAmount = preview.Total / 100m;
            string currency = string.IsNullOrWhiteSpace(preview.Currency)
                ? "USD"
                : preview.Currency.ToUpperInvariant();

            SeatPreviewDto result = new SeatPreviewDto
            {
                CurrentSeats = currentSeatCount,
                NewSeats = newSeatCount,
                ProratedAmount = proratedAmount,
                Currency = currency,
                EffectiveDate = prorationDate
            };

            return Result.Ok(result);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe preview failed for tenant {TenantId}", tenantId);
            return Result.Fail<SeatPreviewDto>(new BadRequestError("Stripe could not preview this seat change."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to preview seat change for tenant {TenantId}", tenantId);
            return Result.Fail<SeatPreviewDto>("Failed to preview seat change.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<int>> ProcessPeriodEndCancellationsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<int>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;

            List<SubscriptionSeat> pendingSeats = (await _subscriptionSeatRepository.GetByTenantAsync(tenantId, cancellationToken))
                .Where(seat => string.Equals(seat.Status, SubscriptionSeatStatuses.PendingCancellation, StringComparison.Ordinal))
                .ToList();

            if (pendingSeats.Count == 0)
            {
                return Result.Ok(0);
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;

            foreach (SubscriptionSeat seat in pendingSeats)
            {
                cancellationToken.ThrowIfCancellationRequested();

                seat.Status = SubscriptionSeatStatuses.Canceled;
                seat.CanceledAt ??= now;
                seat.SeatEndDate ??= now;
                ClearSeatAssignment(seat);

                await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);
            }

            int newBillableSeatCount = await _subscriptionSeatRepository.GetTotalActiveCountAsync(tenantId, cancellationToken);
            bool isInternalDevTenant = _internalDevTenantService.IsInternalDevTenant(tenantId);
            if (!isInternalDevTenant)
            {
                Result stripeSyncResult = await SyncStripeQuantityAsync(tenant, newBillableSeatCount, prorate: false, cancellationToken);
                if (stripeSyncResult.IsFailed)
                {
                    return Result.Fail<int>(stripeSyncResult.Errors);
                }
            }

            ApplySeatCountLimitsToTenant(tenant, newBillableSeatCount, isInternalDevTenant);
            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            return Result.Ok(pendingSeats.Count);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe quantity sync failed while finalizing seat cancellations for tenant {TenantId}", tenantId);
            return Result.Fail<int>(new BadRequestError("Stripe quantity sync failed while finalizing seat cancellations."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process period-end cancellations for tenant {TenantId}", tenantId);
            return Result.Fail<int>("Failed to process period-end seat cancellations.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> RemoveUserFromSeatAsync(Guid tenantId, Guid seatId, Guid performedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenantResult.Value);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatManagementAllowedResult.Errors);
            }

            Result<SubscriptionSeat> seatResult = await GetSeatForTenantAsync(tenantId, seatId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatResult.Errors);
            }

            SubscriptionSeat seat = seatResult.Value;

            if (!string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal))
            {
                return Result.Fail<SeatDto>(new BadRequestError("Only active seats can have their user removed."));
            }

            if (!seat.UserId.HasValue)
            {
                return Result.Fail<SeatDto>(new BadRequestError("Seat is already unoccupied."));
            }

            Guid removedUserId = seat.UserId.Value;

            Result ownerGuard = await EnsureCanActOnTenantOwnerAsync(tenantResult.Value, removedUserId, performedByUserId, cancellationToken);
            if (ownerGuard.IsFailed)
            {
                return Result.Fail<SeatDto>(ownerGuard.Errors);
            }

            using (TransactionScope transaction = new TransactionScope(
                TransactionScopeAsyncFlowOption.Enabled))
            {
                ClearSeatAssignment(seat);
                seat.CanceledAt = null;
                seat.Status = SubscriptionSeatStatuses.Active;

                await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

                Result<(string? PriorRole, Guid? SeatId)> removalResult =
                    await EndMembershipAndAuditAsync(
                        removedUserId, tenantId, performedByUserId, seat.SubscriptionSeatId, cancellationToken);
                if (removalResult.IsFailed)
                {
                    return Result.Fail<SeatDto>(removalResult.Errors);
                }

                transaction.Complete();
            }

            // Revoke and reload outside the TransactionScope. Reads after Complete() would otherwise
            // hit "The current TransactionScope is already complete."
            await RevokeTenantAccessAsync(removedUserId, tenantId, cancellationToken);

            SubscriptionSeat? updatedSeat = await _subscriptionSeatRepository.GetByIdAsync(seat.SubscriptionSeatId, cancellationToken);
            SeatDto seatDto = updatedSeat is not null
                ? MapToSeatDto(updatedSeat)
                : MapToSeatDto(seat);

            _logger.LogInformation(
                "User {UserId} removed from seat {SeatId} for tenant {TenantId} by {PerformedBy}",
                removedUserId,
                seatId,
                tenantId,
                performedByUserId);

            return Result.Ok(seatDto);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove user from seat {SeatId} for tenant {TenantId}", seatId, tenantId);
            return Result.Fail<SeatDto>(new BadRequestError("Failed to remove user from seat."));
        }
    }

    /// <inheritdoc/>
    public async Task<Result> RemoveMemberAsync(Guid tenantId, Guid userId, Guid performedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (performedByUserId == userId)
            {
                return Result.Fail(new ForbiddenError("You cannot remove yourself from a tenant."));
            }

            Tenant? ownerCheckTenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (ownerCheckTenant is null)
            {
                return Result.Fail(new NotFoundError("Tenant not found."));
            }

            Result ownerGuard = await EnsureCanActOnTenantOwnerAsync(ownerCheckTenant, userId, performedByUserId, cancellationToken);
            if (ownerGuard.IsFailed)
            {
                return ownerGuard;
            }

            SubscriptionSeat? seat = await _subscriptionSeatRepository.GetByUserAsync(tenantId, userId, cancellationToken);
            if (seat is not null && seat.UserId == userId)
            {
                // Always clear the seat assignment and revoke membership. Do not route through
                // RemoveUserFromSeatAsync — that path is gated to Team/internal seat management,
                // but admin member removal must succeed for every tier (including Enterprise).
                using (TransactionScope occupiedSeatTransaction = new TransactionScope(
                    TransactionScopeAsyncFlowOption.Enabled))
                {
                    ClearSeatAssignment(seat);
                    if (string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal))
                    {
                        // Freeing an active seat should not leave a stale cancellation timestamp.
                        seat.CanceledAt = null;
                    }

                    await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

                    Result<(string? PriorRole, Guid? SeatId)> occupiedSeatRemovalResult =
                        await EndMembershipAndAuditAsync(
                            userId, tenantId, performedByUserId, seat.SubscriptionSeatId, cancellationToken);
                    if (occupiedSeatRemovalResult.IsFailed)
                    {
                        return Result.Fail(occupiedSeatRemovalResult.Errors);
                    }

                    occupiedSeatTransaction.Complete();
                }

                // Revoke outside the TransactionScope so DB work does not run after Complete().
                await RevokeTenantAccessAsync(userId, tenantId, cancellationToken);

                _logger.LogInformation(
                    "User {UserId} removed from tenant {TenantId} by {PerformedBy} (seat assignment cleared, status {SeatStatus})",
                    userId,
                    tenantId,
                    performedByUserId,
                    seat.Status);

                return Result.Ok();
            }

            // The member has no seat — revoke membership directly and reassign IsDefault.
            using (TransactionScope transaction = new TransactionScope(
                TransactionScopeAsyncFlowOption.Enabled))
            {
                Result<(string? PriorRole, Guid? SeatId)> removalResult =
                    await EndMembershipAndAuditAsync(
                        userId, tenantId, performedByUserId, seatId: null, cancellationToken);
                if (removalResult.IsFailed)
                {
                    return Result.Fail(removalResult.Errors);
                }

                transaction.Complete();
            }

            await RevokeTenantAccessAsync(userId, tenantId, cancellationToken);

            _logger.LogInformation(
                "User {UserId} removed from tenant {TenantId} by {PerformedBy}",
                userId,
                tenantId,
                performedByUserId);

            return Result.Ok();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove member {UserId} from tenant {TenantId}", userId, tenantId);
            return Result.Fail(new BadRequestError("Failed to remove member from tenant."));
        }
    }

    /// <summary>
    /// Enforces that only the tenant owner (or a global administrator) may remove or deactivate the
    /// tenant owner. Any other target, an unoccupied seat, or the owner acting on themselves is allowed.
    /// </summary>
    /// <param name="tenant">The tenant whose ownership is being checked.</param>
    /// <param name="targetUserId">The user the action targets, or null when the seat is unoccupied.</param>
    /// <param name="performedByUserId">The user performing the action.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>A successful result when permitted; otherwise a forbidden failure.</returns>
    private async Task<Result> EnsureCanActOnTenantOwnerAsync(Tenant tenant, Guid? targetUserId, Guid performedByUserId, CancellationToken cancellationToken)
    {
        if (targetUserId is null || tenant.OwnerId != targetUserId || performedByUserId == tenant.OwnerId)
        {
            return Result.Ok();
        }

        ApplicationUser? performer = await _userManager.FindByIdAsync(performedByUserId.ToString());
        if (performer is not null && await _userManager.IsInRoleAsync(performer, AuthRoles.Administrator))
        {
            return Result.Ok();
        }

        _logger.LogWarning(
            "User {PerformedBy} attempted to act on tenant owner {OwnerId} in tenant {TenantId} without permission",
            performedByUserId,
            tenant.OwnerId,
            tenant.TenantId);

        return Result.Fail(new ForbiddenError("Only the tenant owner can remove or deactivate the tenant owner."));
    }

    /// <summary>
    /// Ends membership (Status=Ended), writes audit, and leaves account fields untouched.
    /// IsDefault reassignment is handled inside RemoveUserFromTenantWithinTransactionAsync.
    /// Caller owns the ambient <see cref="TransactionScope"/> and must call
    /// <c>Complete()</c> before invoking <see cref="RevokeTenantAccessAsync"/>.
    /// </summary>
    private async Task<Result<(string? PriorRole, Guid? SeatId)>> EndMembershipAndAuditAsync(
        Guid userId,
        Guid tenantId,
        Guid performedByUserId,
        Guid? seatId,
        CancellationToken cancellationToken)
    {
        Result<string> priorRoleResult =
            await _userTenantMembershipService.GetUserRoleInTenantAsync(userId, tenantId, cancellationToken);
        string? priorRole = priorRoleResult.IsSuccess ? priorRoleResult.Value : null;

        Result membershipResult = await _userTenantMembershipService.RemoveUserFromTenantWithinTransactionAsync(
            userId, tenantId, performedByUserId, cancellationToken);
        if (membershipResult.IsFailed)
        {
            return Result.Fail<(string?, Guid?)>(membershipResult.Errors);
        }

        string metadataJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            priorRole,
            seatId,
            removedUserId = userId,
        });

        Result auditResult = await _auditLogService.LogActionAsync(
            AuditIp,
            AuditUserAgent,
            ActionTypeMembershipEnd,
            tenantId,
            performedByUserId,
            EntityTypeMembership,
            userId.ToString(),
            AuditSeverities.Info,
            metadata: metadataJson);
        if (auditResult.IsFailed)
        {
            _logger.LogWarning(
                "Membership end for user {UserId} in tenant {TenantId} rolled back because audit write failed: {Errors}",
                userId,
                tenantId,
                string.Join(", ", auditResult.Errors.Select(error => error.Message)));
            return Result.Fail<(string?, Guid?)>(auditResult.Errors);
        }

        return Result.Ok((priorRole, seatId));
    }

    /// <summary>
    /// After commit: revoke this tenant's refresh tokens and Databricks user tokens.
    /// Always runs for every removal — guest carve-outs are gone. Does not rotate the
    /// account-wide security stamp (tenant-scoped only).
    /// </summary>
    private Task RevokeTenantAccessAsync(
        Guid userId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        return _tenantAccessRevocationService.RevokeAsync(userId, tenantId, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<Result<SeatDto>> RemoveSeatAndUserAsync(Guid tenantId, Guid seatId, Guid performedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Result<Tenant> tenantResult = await GetTenantAsync(tenantId, cancellationToken);
            if (tenantResult.IsFailed)
            {
                return Result.Fail<SeatDto>(tenantResult.Errors);
            }

            Tenant tenant = tenantResult.Value;
            Result seatManagementAllowedResult = EnsureSeatManagementAllowed(tenant);
            if (seatManagementAllowedResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatManagementAllowedResult.Errors);
            }

            Result<SubscriptionSeat> seatResult = await GetSeatForTenantAsync(tenantId, seatId, cancellationToken);
            if (seatResult.IsFailed)
            {
                return Result.Fail<SeatDto>(seatResult.Errors);
            }

            SubscriptionSeat seat = seatResult.Value;

            if (seat.IsBundled)
            {
                return Result.Fail<SeatDto>(new BadRequestError(
                    "Bundled seats cannot be removed directly. Reduce plan minimum to remove bundled seats."));
            }

            if (!string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal))
            {
                return Result.Fail<SeatDto>(new BadRequestError("Only active seats can be scheduled for removal."));
            }

            Result ownerGuard = await EnsureCanActOnTenantOwnerAsync(tenant, seat.UserId, performedByUserId, cancellationToken);
            if (ownerGuard.IsFailed)
            {
                return Result.Fail<SeatDto>(ownerGuard.Errors);
            }

            DateTimeOffset now = DateTimeOffset.UtcNow;
            DateTimeOffset periodEnd = tenant.SubscriptionEndDate ?? now;

            seat.Status = SubscriptionSeatStatuses.PendingCancellation;
            seat.CanceledAt = now;
            seat.SeatEndDate = periodEnd;

            await _subscriptionSeatRepository.UpdateAsync(seat, cancellationToken);

            SubscriptionSeat? updatedSeat = await _subscriptionSeatRepository.GetByIdAsync(seat.SubscriptionSeatId, cancellationToken);
            if (updatedSeat == null)
            {
                return Result.Fail<SeatDto>(new NotFoundError("Updated seat could not be reloaded."));
            }

            _logger.LogInformation(
                "Seat {SeatId} scheduled for cancellation at {PeriodEnd} for tenant {TenantId} by {PerformedBy}",
                seatId,
                periodEnd,
                tenantId,
                performedByUserId);

            return Result.Ok(MapToSeatDto(updatedSeat));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule seat cancellation {SeatId} for tenant {TenantId}", seatId, tenantId);
            return Result.Fail<SeatDto>("Failed to schedule seat cancellation.");
        }
    }

    private async Task<Result<Tenant>> GetTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);

        if (tenant == null)
        {
            return Result.Fail<Tenant>(new NotFoundError("Tenant not found."));
        }

        if (!tenant.IsActive)
        {
            return Result.Fail<Tenant>(new ForbiddenError("Tenant is inactive."));
        }

        return Result.Ok(tenant);
    }
    private async Task<Result<SubscriptionSeat>> GetSeatForTenantAsync(Guid tenantId, Guid seatId, CancellationToken cancellationToken = default)
    {
        SubscriptionSeat? seat = await _subscriptionSeatRepository.GetByIdAsync(seatId, cancellationToken);

        if (seat == null || seat.TenantId != tenantId)
        {
            return Result.Fail<SubscriptionSeat>(new NotFoundError("Seat not found for tenant."));
        }

        return Result.Ok(seat);
    }

    private Result EnsureSeatManagementAllowed(Tenant tenant)
    {
        if (_internalDevTenantService.IsInternalDevTenant(tenant.TenantId))
        {
            return Result.Ok();
        }

        bool isPerSeatTier = _subscriptionTierService.IsPerSeatTier(tenant.SubscriptionTier);
        if (isPerSeatTier)
        {
            return Result.Ok();
        }

        return Result.Fail(new ForbiddenError("Seat management endpoints are only available for Team tier subscriptions."));
    }

    /// <summary>
    /// Applies billable seat count to tenant limits. Internal/dev tenants keep unlimited
    /// MaxUsers / MaxPublishedApps / MaxWorkspaceConnections (0 = unlimited).
    /// </summary>
    private void ApplySeatCountLimitsToTenant(Tenant tenant, int seatCount, bool isInternalDevTenant)
    {
        if (isInternalDevTenant)
        {
            tenant.MaxUsers = 0;
            tenant.MaxPublishedApps = 0;
            tenant.MaxWorkspaceConnections = 0;
            return;
        }

        tenant.MaxUsers = seatCount;
        ApplyEffectiveLimitsToTenant(tenant, seatCount);
    }

    /// <summary>
    /// Recomputes and applies the tenant's effective app/workspace limits from its tier,
    /// current subscription status, and the supplied seat count. Per-seat tiers scale their
    /// limits with the seat count. Failures are logged but do not abort the seat operation.
    /// </summary>
    private void ApplyEffectiveLimitsToTenant(Tenant tenant, int seatCount)
    {
        Result<EffectiveTierLimits> limitsResult = _subscriptionTierService.ResolveEffectiveLimits(
            tenant.SubscriptionTier, tenant.SubscriptionStatus, seatCount);

        if (limitsResult.IsFailed)
        {
            _logger.LogWarning(
                "Could not recompute effective limits for tenant {TenantId} (tier {Tier}, status {Status}, seats {SeatCount}): {Errors}",
                tenant.TenantId, tenant.SubscriptionTier, tenant.SubscriptionStatus, seatCount,
                string.Join("; ", limitsResult.Errors.Select(error => error.Message)));
            return;
        }

        tenant.MaxPublishedApps = limitsResult.Value.MaxPublishedApps;
        tenant.MaxWorkspaceConnections = limitsResult.Value.MaxWorkspaceConnections;
    }

    private async Task<Result> SyncStripeQuantityAsync(Tenant tenant, int quantity, bool prorate, CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
        {
            return Result.Fail(new BadRequestError("Stripe seat quantity must be greater than zero."));
        }

        Result<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)> stripeDataResult =
            await GetStripeSubscriptionAndItemAsync(tenant.StripeSubscriptionId, cancellationToken);

        if (stripeDataResult.IsFailed)
        {
            return Result.Fail(stripeDataResult.Errors);
        }

        (Stripe.Subscription subscription, Stripe.SubscriptionItem subscriptionItem) = stripeDataResult.Value;

        SubscriptionUpdateOptions updateOptions = new SubscriptionUpdateOptions
        {
            Items = new List<SubscriptionItemOptions>
            {
                new SubscriptionItemOptions
                {
                    Id = subscriptionItem.Id,
                    Quantity = quantity
                }
            },
            ProrationBehavior = prorate ? "create_prorations" : "none"
        };

        SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
        await subscriptionService.UpdateAsync(subscription.Id, updateOptions, null, cancellationToken);

        return Result.Ok();
    }

    private async Task<Result<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)>> GetStripeSubscriptionAndItemAsync(string? stripeSubscriptionId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(stripeSubscriptionId))
        {
            return Result.Fail<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)>(
                new BadRequestError("Tenant does not have an active Stripe subscription reference."));
        }

        try
        {
            SubscriptionService subscriptionService = new SubscriptionService(_stripeClient);
            Stripe.Subscription subscription = await subscriptionService.GetAsync(
                stripeSubscriptionId,
                requestOptions: null,
                cancellationToken: cancellationToken);

            Stripe.SubscriptionItem? subscriptionItem = subscription.Items?.Data?.FirstOrDefault();
            if (subscriptionItem == null)
            {
                return Result.Fail<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)>(
                    new NotFoundError("Stripe subscription has no billable seat item."));
            }

            return Result.Ok((subscription, subscriptionItem));
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Failed to load Stripe subscription {StripeSubscriptionId}", stripeSubscriptionId);
            return Result.Fail<(Stripe.Subscription Subscription, Stripe.SubscriptionItem SubscriptionItem)>(
                new BadRequestError("Unable to load Stripe subscription details."));
        }
    }

    private static Result ValidateSeatCountArgument(int count)
    {
        if (count <= 0)
        {
            return Result.Fail(new BadRequestError("Seat count must be greater than zero."));
        }

        if (count > MaxSeatChangeCount)
        {
            return Result.Fail(new BadRequestError($"Seat count cannot exceed {MaxSeatChangeCount} in one operation."));
        }

        return Result.Ok();
    }

    private int ResolveInitialSeatCount(string tier, SubscriptionTierLimits tierLimits)
    {
        if (_subscriptionTierService.IsPerSeatTier(tier))
        {
            return Math.Max(1, tierLimits.MinimumSeats);
        }

        if (string.Equals(tier, SubscriptionTierNames.Individual, StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        return 0;
    }

    /// <summary>
    /// Clears the user assignment on a seat. Also nulls the navigation property so EF Core
    /// does not restore <see cref="SubscriptionSeat.UserId"/> from an eagerly-loaded
    /// <see cref="SubscriptionSeat.User"/> when updating a detached entity.
    /// </summary>
    /// <param name="seat">The seat whose assignment should be cleared.</param>
    private static void ClearSeatAssignment(SubscriptionSeat seat)
    {
        SubscriptionSeatAssignment.Clear(seat);
    }

    private static SeatSummaryDto BuildSeatSummary(IEnumerable<SubscriptionSeat> seats)
    {
        List<SubscriptionSeat> seatList = seats.ToList();

        int totalSeats = seatList.Count;
        int occupiedSeats = seatList.Count(seat => seat.UserId.HasValue);
        int availableSeats = seatList.Count(seat =>
            string.Equals(seat.Status, SubscriptionSeatStatuses.Active, StringComparison.Ordinal)
            && seat.UserId == null);
        int bundledSeats = seatList.Count(seat => seat.IsBundled);
        int pendingCancellationSeats = seatList.Count(seat =>
            string.Equals(seat.Status, SubscriptionSeatStatuses.PendingCancellation, StringComparison.Ordinal));

        return new SeatSummaryDto
        {
            TotalSeats = totalSeats,
            OccupiedSeats = occupiedSeats,
            AvailableSeats = availableSeats,
            BundledSeats = bundledSeats,
            ExtraSeats = totalSeats - bundledSeats,
            PendingCancellationSeats = pendingCancellationSeats
        };
    }

    private static SeatDto MapToSeatDto(SubscriptionSeat seat)
    {
        string? userDisplayName = null;
        if (seat.User != null)
        {
            string firstName = seat.User.FirstName?.Trim() ?? string.Empty;
            string lastName = seat.User.LastName?.Trim() ?? string.Empty;
            string combinedName = $"{firstName} {lastName}".Trim();

            userDisplayName = string.IsNullOrWhiteSpace(combinedName)
                ? seat.User.Email
                : combinedName;
        }

        return new SeatDto
        {
            SeatId = seat.SubscriptionSeatId,
            UserId = seat.UserId,
            UserEmail = seat.User?.Email,
            UserDisplayName = userDisplayName,
            Status = seat.Status,
            IsBundled = seat.IsBundled,
            SeatStartDate = seat.SeatStartDate,
            SeatEndDate = seat.SeatEndDate,
            AssignedAt = seat.AssignedAt,
            CanceledAt = seat.CanceledAt
        };
    }
}