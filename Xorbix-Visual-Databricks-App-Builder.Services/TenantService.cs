using FluentResults;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Transactions;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Service for managing tenant entities and subscription limit enforcement.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="TenantService"/> class.
/// </remarks>
public class TenantService(
    ILogger<TenantService> _logger,
    ITenantRepository _tenantRepository,
    IUserTenantMembershipService _userTenantMembershipService,
    ISubscriptionTierService _subscriptionTierService,
    IStripeCustomerService _stripeCustomerService,
    IAuditLogService _auditLogService) : ITenantService
{

    private const string TenantNotFoundMessage = "Tenant not found";

    /// <summary>
    /// Subscription status applied when an administrator grants a plan via tier override
    /// on a tenant that has no Stripe subscription. Marks the plan as usable without Stripe.
    /// </summary>
    private const string GrantedPlanStatus = "active";

    /// <summary>
    /// Valid resource types for subscription limit validation.
    /// </summary>
    private static readonly string[] ValidResourceTypes = ["User", "App", "Connection"];

    /// <inheritdoc/>
    public async Task<Result<Tenant>> GetTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);

            if (tenant == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found", tenantId);
                return Result.Fail<Tenant>(new NotFoundError(TenantNotFoundMessage));
            }

            return Result.Ok(tenant);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tenant {TenantId}", tenantId);
            return Result.Fail<Tenant>("Failed to retrieve tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<Tenant>> UpdateTenantAsync(Guid tenantId, UpdateTenantRequest request, Guid updatedByUserId, Tenant? tenant = null, CancellationToken cancellationToken = default)
    {
        try
        {
            tenant ??= await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);

            if (tenant == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for update", tenantId);
                return Result.Fail<Tenant>(new NotFoundError(TenantNotFoundMessage));
            }

            if (!tenant.IsActive)
            {
                _logger.LogWarning("Attempt to update inactive tenant {TenantId}", tenantId);
                return Result.Fail<Tenant>(new BadRequestError("Cannot update an inactive tenant"));
            }

            string originalSubscriptionTier = tenant.SubscriptionTier;
            Guid? originalOwnerId = tenant.OwnerId;
            string? originalInvoiceName = tenant.InvoiceName;
            string? originalInvoiceEmail = tenant.InvoiceEmail;

            tenant.DisplayName = request.DisplayName;

            if (request.TenantName != null)
            {
                tenant.TenantName = request.TenantName;
            }

            if (request.MaxUsers.HasValue)
            {
                tenant.MaxUsers = request.MaxUsers.Value;
            }

            if (request.MaxPublishedApps.HasValue)
            {
                tenant.MaxPublishedApps = request.MaxPublishedApps.Value;
            }

            if (request.MaxWorkspaceConnections.HasValue)
            {
                tenant.MaxWorkspaceConnections = request.MaxWorkspaceConnections.Value;
            }

            if (request.InvoiceName != null)
            {
                tenant.InvoiceName = request.InvoiceName;
            }

            if (request.InvoiceEmail != null)
            {
                tenant.InvoiceEmail = request.InvoiceEmail;
            }

            if (request.OwnerId.HasValue && request.OwnerId.Value != tenant.OwnerId)
            {
                Result<UserTenantMembership> membershipResult = await _userTenantMembershipService.GetUserTenantMembershipAsync(
                    request.OwnerId.Value,
                    tenantId,
                    cancellationToken);

                if (membershipResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Attempted owner reassignment to non-member user {OwnerId} for tenant {TenantId}",
                        request.OwnerId,
                        tenantId);
                    return Result.Fail<Tenant>(
                        new BadRequestError("Owner must be an active member of the tenant."));
                }

                tenant.OwnerId = request.OwnerId;
            }

            bool hasSubscriptionTierOverride = !string.IsNullOrWhiteSpace(request.SubscriptionTier);
            if (hasSubscriptionTierOverride)
            {
                string normalizedTier = request.SubscriptionTier!.Trim();
                Result<SubscriptionTierLimits> tierResult = _subscriptionTierService.GetTierLimits(normalizedTier);
                if (tierResult.IsFailed)
                {
                    return Result.Fail<Tenant>(
                        new BadRequestError($"Invalid subscription tier override '{normalizedTier}'."));
                }

                tenant.SubscriptionTier = normalizedTier;

                // A tier override grants a plan outside Stripe. Mark it active so it is
                // recognized as a usable plan; without this the tenant keeps its default
                // "incomplete" status and is indistinguishable from a self-registration
                // that never completed payment. Only applied when there is no Stripe
                // subscription, so a real billing status is never clobbered.
                if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId))
                {
                    tenant.SubscriptionStatus = GrantedPlanStatus;
                }
            }

            tenant.ModifiedBy = updatedByUserId;

            bool invoiceChanged = !string.Equals(originalInvoiceName, tenant.InvoiceName, StringComparison.Ordinal)
                || !string.Equals(originalInvoiceEmail, tenant.InvoiceEmail, StringComparison.Ordinal);

            if (invoiceChanged && !string.IsNullOrWhiteSpace(tenant.BillingCustomerId))
            {
                Result stripeUpdateResult = await _stripeCustomerService.UpdateCustomerAsync(tenant, cancellationToken);
                if (stripeUpdateResult.IsFailed)
                {
                    _logger.LogWarning("Failed to update Stripe customer for tenant {TenantId}: {Errors}",
                        tenantId,
                        string.Join(", ", stripeUpdateResult.Errors.Select(error => error.Message)));

                    return Result.Fail<Tenant>(stripeUpdateResult.Errors);
                }
            }

            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            if (originalOwnerId != tenant.OwnerId)
            {
                string ownerMetadata = JsonSerializer.Serialize(new
                {
                    previousOwnerId = originalOwnerId,
                    newOwnerId = tenant.OwnerId
                });

                Result ownerAuditResult = await _auditLogService.LogActionAsync(
                    ipAddress: "internal-service",
                    userAgent: "TenantService",
                    actionType: "roleChange",
                    tenantId: tenantId,
                    userId: updatedByUserId,
                    entityType: "Tenant",
                    entityId: ownerMetadata,
                    severity: "Info");

                if (ownerAuditResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Failed to write owner reassignment audit log for tenant {TenantId}",
                        tenantId);
                }
            }

            if (!string.Equals(originalSubscriptionTier, tenant.SubscriptionTier, StringComparison.OrdinalIgnoreCase))
            {
                string tierMetadata = JsonSerializer.Serialize(new
                {
                    previousSubscriptionTier = originalSubscriptionTier,
                    newSubscriptionTier = tenant.SubscriptionTier
                });

                Result tierAuditResult = await _auditLogService.LogActionAsync(
                    ipAddress: "internal-service",
                    userAgent: "TenantService",
                    actionType: "update",
                    tenantId: tenantId,
                    userId: updatedByUserId,
                    entityType: "Tenant",
                    entityId: tierMetadata,
                    severity: "Info");

                if (tierAuditResult.IsFailed)
                {
                    _logger.LogWarning(
                        "Failed to write subscription-tier override audit log for tenant {TenantId}",
                        tenantId);
                }
            }

            _logger.LogInformation("Tenant {TenantId} updated by user {UserId}", tenantId, updatedByUserId);
            return Result.Ok(tenant);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tenant {TenantId}", tenantId);
            return Result.Fail<Tenant>("Failed to update tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<Tenant>> TransferOwnershipAsync(Guid tenantId, Guid newOwnerUserId, Guid performedByUserId, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);
            if (tenant == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for ownership transfer", tenantId);
                return Result.Fail<Tenant>(new NotFoundError(TenantNotFoundMessage));
            }

            if (!tenant.IsActive)
            {
                return Result.Fail<Tenant>(new BadRequestError("Cannot transfer ownership of an inactive tenant."));
            }

            if (tenant.OwnerId == newOwnerUserId)
            {
                return Result.Fail<Tenant>(new BadRequestError("User is already the tenant owner."));
            }

            Result<UserTenantMembership> membershipResult = await _userTenantMembershipService.GetUserTenantMembershipAsync(
                newOwnerUserId,
                tenantId,
                cancellationToken);

            if (membershipResult.IsFailed)
            {
                _logger.LogWarning(
                    "Attempted ownership transfer to non-member user {NewOwnerId} for tenant {TenantId}",
                    newOwnerUserId,
                    tenantId);
                return Result.Fail<Tenant>(new BadRequestError("New owner must be an active member of the tenant."));
            }

            Guid? previousOwnerId = tenant.OwnerId;

            using TransactionScope transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

            // Promote the new owner to tenant Admin when their current role is below that level.
            // The previous owner's role is intentionally left unchanged.
            if (UserExtensions.GetRoleHierarchyLevel(membershipResult.Value.Role) < UserExtensions.GetRoleHierarchyLevel(AuthRoles.TenantAdmin))
            {
                Result<UserTenantMembership> roleResult = await _userTenantMembershipService.UpdateUserRoleInTenantAsync(
                    newOwnerUserId,
                    tenantId,
                    AuthRoles.TenantAdmin,
                    performedByUserId,
                    cancellationToken);

                if (roleResult.IsFailed)
                {
                    return Result.Fail<Tenant>(roleResult.Errors);
                }
            }

            tenant.OwnerId = newOwnerUserId;
            tenant.ModifiedBy = performedByUserId;
            await _tenantRepository.UpdateAsync(tenant, cancellationToken);

            transaction.Complete();

            string ownerMetadata = JsonSerializer.Serialize(new
            {
                previousOwnerId,
                newOwnerId = newOwnerUserId
            });

            Result ownerAuditResult = await _auditLogService.LogActionAsync(
                ipAddress: "internal-service",
                userAgent: "TenantService",
                actionType: "roleChange",
                tenantId: tenantId,
                userId: performedByUserId,
                entityType: "Tenant",
                entityId: ownerMetadata,
                severity: "Info");

            if (ownerAuditResult.IsFailed)
            {
                _logger.LogWarning(
                    "Failed to write ownership transfer audit log for tenant {TenantId}",
                    tenantId);
            }

            _logger.LogInformation(
                "Tenant {TenantId} ownership transferred to {NewOwnerId} by {PerformedBy}",
                tenantId,
                newOwnerUserId,
                performedByUserId);

            return Result.Ok(tenant);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error transferring ownership for tenant {TenantId}", tenantId);
            return Result.Fail<Tenant>("Failed to transfer tenant ownership.");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<TenantUsageStatsDto>> GetUsageDashboardAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        try
        {
            TenantUsageStatsDto? stats = await _tenantRepository.GetUsageStatsAsync(tenantId, cancellationToken);

            if (stats == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for usage dashboard", tenantId);
                return Result.Fail<TenantUsageStatsDto>(new NotFoundError(TenantNotFoundMessage));
            }

            Result<SubscriptionTierLimits> tierLimitsResult = _subscriptionTierService.GetTierLimits(stats.SubscriptionTier);
            if (tierLimitsResult.IsFailed)
            {
                _logger.LogWarning("Unable to resolve usage dashboard tier limits for tenant {TenantId} tier {Tier}: {Errors}",
                    tenantId,
                    stats.SubscriptionTier,
                    string.Join(", ", tierLimitsResult.Errors.Select(e => e.Message)));

                return Result.Fail<TenantUsageStatsDto>(tierLimitsResult.Errors);
            }

            SubscriptionTierLimits tierLimits = tierLimitsResult.Value;

            TenantUsageStatsDto usageStats = new()
            {
                TenantId = stats.TenantId,
                DisplayName = stats.DisplayName,
                SubscriptionTier = stats.SubscriptionTier,
                SubscriptionStatus = stats.SubscriptionStatus,
                UserCount = stats.UserCount,
                AppCount = stats.AppCount,
                ConnectionCount = stats.ConnectionCount,
                MaxUsers = stats.MaxUsers,
                MaxPublishedApps = stats.MaxPublishedApps,
                MaxWorkspaceConnections = stats.MaxWorkspaceConnections
            };

            return Result.Ok(usageStats);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving usage dashboard for tenant {TenantId}", tenantId);
            return Result.Fail<TenantUsageStatsDto>("Failed to retrieve usage dashboard");
        }
    }

    /// <inheritdoc/>
    public async Task<Result> ValidateSubscriptionLimitsAsync(Guid tenantId, string resourceType, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!ValidResourceTypes.Contains(resourceType))
            {
                return Result.Fail(new BadRequestError(
                    $"Invalid resource type '{resourceType}'. Must be one of: {string.Join(", ", ValidResourceTypes)}"));
            }

            Tenant? tenant = await _tenantRepository.GetByIdAsync(tenantId, cancellationToken);

            if (tenant == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for limit validation", tenantId);
                return Result.Fail(new NotFoundError(TenantNotFoundMessage));
            }

            TenantUsageStatsDto? stats = await _tenantRepository.GetUsageStatsAsync(tenantId, cancellationToken);

            if (stats == null)
            {
                _logger.LogWarning("Tenant {TenantId} not found for limit validation", tenantId);
                return Result.Fail(new NotFoundError(TenantNotFoundMessage));
            }

            Result<SubscriptionTierLimits> tierLimitsResult = _subscriptionTierService.GetTierLimits(tenant.SubscriptionTier);
            if (tierLimitsResult.IsFailed)
            {
                _logger.LogWarning("Unable to resolve subscription tier limits for tenant {TenantId} tier {Tier}: {Errors}",
                    tenantId,
                    tenant.SubscriptionTier,
                    string.Join(", ", tierLimitsResult.Errors.Select(e => e.Message)));

                return Result.Fail(tierLimitsResult.Errors);
            }

            SubscriptionTierLimits tierLimits = tierLimitsResult.Value;

            return resourceType switch
            {
                "User" => ValidateLimit(stats.UserCount, stats.MaxUsers, "users"),
                "App" => ValidateLimit(stats.AppCount, tierLimits.MaxPublishedApps, "published apps"),
                "Connection" => ValidateLimit(stats.ConnectionCount, tierLimits.MaxWorkspaceConnections, "workspace connections"),
                _ => Result.Fail(new BadRequestError($"Unknown resource type: {resourceType}"))
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating subscription limits for tenant {TenantId}", tenantId);
            return Result.Fail("Failed to validate subscription limits");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<PaginatedTenantsResponse>> GetAllTenantsAsync(int skip, int take, CancellationToken cancellationToken = default)
    {
        try
        {
            (List<TenantDto> tenantDtos, int totalCount) = await _tenantRepository.GetAllForManagementAsync(skip, take, cancellationToken);

            PaginatedTenantsResponse response = new ()
            {
                Tenants = tenantDtos,
                TotalCount = totalCount,
                Skip = skip,
                Take = take
            };

            return Result.Ok(response);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all tenants");
            return Result.Fail<PaginatedTenantsResponse>("Failed to retrieve tenants");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<TenantDto>> CreateTenantAsync(CreateTenantRequest request, Guid createdByUserId, bool isRegistration = false, CancellationToken cancellationToken = default)
    {
        try
        {
            Tenant tenant = new()
            {
                TenantName = request.TenantName,
                DisplayName = request.DisplayName,
                IsActive = true,
                CreatedBy = createdByUserId,
                OwnerId = request.OwnerId ?? createdByUserId,
                InvoiceName = request.TenantName
            };

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                tenant.InvoiceEmail = request.Email;
            }

            if (!string.IsNullOrWhiteSpace(request.SubscriptionTier))
            {
                tenant.SubscriptionTier = request.SubscriptionTier;
            }

            if (!string.IsNullOrWhiteSpace(request.SubscriptionStatus))
            {
                tenant.SubscriptionStatus = request.SubscriptionStatus;
            }

            bool isIncomplete = string.Equals(tenant.SubscriptionStatus, "incomplete", StringComparison.OrdinalIgnoreCase);

            Tenant created = await _tenantRepository.CreateAsync(tenant, cancellationToken);

            if (!isIncomplete)
            {
                Result<string> stripeCustomerResult = await _stripeCustomerService.CreateStripeCustomerAsync(created, cancellationToken);
                if (stripeCustomerResult.IsFailed)
                {
                    _logger.LogError("Failed to create Stripe customer for tenant {TenantName}: {Errors}",
                        request.TenantName,
                        string.Join(", ", stripeCustomerResult.Errors.Select(error => error.Message)));

                    return Result.Fail<TenantDto>(stripeCustomerResult.Errors);
                }
            }

            if (isRegistration)
            {
                Result<UserTenantMembership> membershipResult = await _userTenantMembershipService
                    .AddUserToTenantAsync(createdByUserId, created.TenantId, AuthRoles.TenantAdmin, isDefault: true, addedByUserId: createdByUserId, cancellationToken: cancellationToken);

                if (membershipResult.IsFailed)
                {
                    _logger.LogError("Failed to assign creator {UserId} as TenantAdmin for new tenant {TenantId}: {Errors}",
                        createdByUserId, created.TenantId, string.Join(", ", membershipResult.Errors.Select(e => e.Message)));

                    return Result.Fail<TenantDto>(membershipResult.Errors);
                }
            }

            _logger.LogInformation("Tenant {TenantId} created by user {UserId}", created.TenantId, createdByUserId);
            return Result.Ok(MapToDto(created));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating tenant");
            return Result.Fail<TenantDto>("Failed to create tenant");
        }
    }

    /// <inheritdoc/>
    public async Task<Result<TenantDto>> CreateTenantAsAdminAsync(CreateTenantRequest request, Guid createdByUserId, CancellationToken cancellationToken = default)
    {
        if (!request.OwnerId.HasValue || request.OwnerId.Value == Guid.Empty)
        {
            return Result.Fail<TenantDto>(new BadRequestError("An owner must be selected when an administrator creates a tenant."));
        }

        Guid ownerId = request.OwnerId.Value;

        try
        {
            Tenant tenant = new()
            {
                TenantName = request.TenantName,
                DisplayName = request.DisplayName,
                IsActive = true,
                CreatedBy = createdByUserId,
                OwnerId = ownerId,
                InvoiceName = request.TenantName
            };

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                tenant.InvoiceEmail = request.Email;
            }

            if (!string.IsNullOrWhiteSpace(request.SubscriptionTier))
            {
                tenant.SubscriptionTier = request.SubscriptionTier;
            }

            if (!string.IsNullOrWhiteSpace(request.SubscriptionStatus))
            {
                tenant.SubscriptionStatus = request.SubscriptionStatus;
            }

            Tenant created;

            using (TransactionScope transaction = new(TransactionScopeAsyncFlowOption.Enabled))
            {
                created = await _tenantRepository.CreateAsync(tenant, cancellationToken);

                Result<UserTenantMembership> membershipResult = await _userTenantMembershipService
                    .AddUserToTenantAsync(ownerId, created.TenantId, AuthRoles.TenantAdmin, isDefault: true, addedByUserId: createdByUserId, cancellationToken: cancellationToken);

                if (membershipResult.IsFailed)
                {
                    _logger.LogError("Failed to assign owner {OwnerId} as TenantAdmin for new tenant {TenantId}: {Errors}",
                        ownerId, created.TenantId, string.Join(", ", membershipResult.Errors.Select(e => e.Message)));

                    return Result.Fail<TenantDto>(membershipResult.Errors);
                }

                transaction.Complete();
            }

            _logger.LogInformation("Tenant {TenantId} created by administrator {UserId} with owner {OwnerId}",
                created.TenantId, createdByUserId, ownerId);

            return Result.Ok(MapToDto(created));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating tenant as administrator");
            return Result.Fail<TenantDto>("Failed to create tenant");
        }
    }

    /// <summary>
    /// Maps a <see cref="Tenant"/> entity to a <see cref="TenantDto"/>.
    /// </summary>
    private static TenantDto MapToDto(Tenant tenant)
    {
        return new TenantDto
        {
            TenantId = tenant.TenantId,
            TenantName = tenant.TenantName,
            DisplayName = tenant.DisplayName,
            IsActive = tenant.IsActive,
            SubscriptionTier = tenant.SubscriptionTier,
            BillingCycle = tenant.BillingCycle,
            MaxUsers = tenant.MaxUsers,
            MaxPublishedApps = tenant.MaxPublishedApps,
            MaxWorkspaceConnections = tenant.MaxWorkspaceConnections,
            SubscriptionStartDate = tenant.SubscriptionStartDate,
            SubscriptionEndDate = tenant.SubscriptionEndDate,
            TrialEndDate = tenant.TrialEndDate,
            AutoRenew = tenant.AutoRenew,
            OwnerId = tenant.OwnerId,
            InvoiceName = tenant.InvoiceName,
            InvoiceEmail = tenant.InvoiceEmail,
            SubscriptionStatus = tenant.SubscriptionStatus,
            BillingCustomerId = tenant.BillingCustomerId,
            StripeSubscriptionId = tenant.StripeSubscriptionId,
            CancelAtPeriodEnd = tenant.CancelAtPeriodEnd,
            CreatedOn = tenant.CreatedOn
        };
    }

    /// <summary>
    /// Checks whether the current count is below the maximum allowed limit.
    /// </summary>
    /// <param name="currentCount">The current resource count.</param>
    /// <param name="maxAllowed">The maximum allowed by subscription.</param>
    /// <param name="resourceLabel">Human-readable label for the resource type.</param>
    private static Result ValidateLimit(int currentCount, int maxAllowed, string resourceLabel)
    {
        if (maxAllowed <= 0)
        {
            return Result.Ok();
        }

        if (currentCount >= maxAllowed)
        {
            return Result.Fail(new ForbiddenError(
                $"Subscription limit reached: {currentCount}/{maxAllowed} {resourceLabel}. " +
                $"Please upgrade your subscription to add more."));
        }

        return Result.Ok();
    }
}
