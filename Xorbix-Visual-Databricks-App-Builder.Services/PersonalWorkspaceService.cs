using System.Transactions;
using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.Billing;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Tenant;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Creates a personal Incomplete tenant when a Detached user explicitly requests a workspace.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="PersonalWorkspaceService"/> class.
/// </remarks>
public class PersonalWorkspaceService(
    ILogger<PersonalWorkspaceService> _logger,
    UserManager<ApplicationUser> _userManager,
    IUserTenantMembershipService _userTenantMembershipService,
    ITenantService _tenantService,
    IAccountAccessPolicy _accountAccessPolicy) : IPersonalWorkspaceService
{
    /// <inheritdoc/>
    public async Task<Result<TenantDto>> CreatePersonalWorkspaceAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ApplicationUser? user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null)
            {
                return Result.Fail(new NotFoundError($"User with ID {userId} not found"));
            }

            if (!_accountAccessPolicy.CanAuthenticate(user))
            {
                return Result.Fail(new ForbiddenError("This account cannot create a workspace."));
            }

            if (await _userManager.IsInRoleAsync(user, AuthRoles.Administrator))
            {
                return Result.Fail(new BadRequestError(
                    "Global administrators do not create personal workspaces through this path."));
            }

            Result<IEnumerable<UserTenantMembership>> membershipsResult =
                await _userTenantMembershipService.GetUserTenantsAsync(user.Id, cancellationToken);
            if (membershipsResult.IsFailed)
            {
                return Result.Fail(membershipsResult.Errors);
            }

            if (membershipsResult.Value.Any())
            {
                return Result.Fail(new ConflictError(
                    "You already have an active workspace membership."));
            }

            // Suspended memberships are excluded from GetUserTenantsAsync but still mean the user
            // is not Detached — do not mint a parallel personal tenant.
            if (await _userTenantMembershipService.HasLiveMembershipAsync(user.Id, cancellationToken))
            {
                return Result.Fail(new ConflictError(
                    "You still have a membership in a workspace. Contact an administrator to resume access."));
            }

            using TransactionScope scope = new(TransactionScopeAsyncFlowOption.Enabled);

            CreateTenantRequest tenantRequest = new()
            {
                TenantName = $"user-{user.Id}",
                DisplayName = $"{user.FirstName} {user.LastName}'s Workspace",
                BillingName = $"{user.FirstName} {user.LastName}",
                Email = user.Email,
                OwnerId = user.Id,
                SubscriptionStatus = SubscriptionStatusNames.Incomplete
            };

            Result<TenantDto> tenantResult = await _tenantService.CreateTenantAsync(
                tenantRequest,
                user.Id,
                isRegistration: true,
                cancellationToken);

            if (tenantResult.IsFailed)
            {
                _logger.LogError(
                    "Failed to create personal workspace for user {UserId}: {Errors}",
                    user.Id,
                    string.Join(", ", tenantResult.Errors.Select(error => error.Message)));
                return Result.Fail(tenantResult.Errors);
            }

            // Phase 4/5: CreateTenantAsync already creates membership with IsDefault; do not write TenantId.

            scope.Complete();

            _logger.LogInformation(
                "User {UserId} created personal workspace {TenantId}",
                user.Id,
                tenantResult.Value.TenantId);

            return Result.Ok(tenantResult.Value);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create personal workspace for user {UserId}", userId);
            return Result.Fail(new BadRequestError("Failed to create personal workspace."));
        }
    }
}
