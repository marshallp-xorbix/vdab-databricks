using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.User;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Repository for managing user data access.
/// </summary>
public class UserRepository(ApplicationDbContext _dbContext) : IUserRepository
{

    /// <inheritdoc/>
    public Task<IEnumerable<ApplicationUser>> GetUsersWithRolesAsync(CancellationToken cancellationToken = default)
    {
        IQueryable<ApplicationUser> query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null);

        return MaterializeUsersWithRolesAsync(query, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<IEnumerable<ApplicationUser>> GetRetiredUsersWithRolesAsync(CancellationToken cancellationToken = default)
    {
        IQueryable<ApplicationUser> query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn != null && u.AnonymizedOn == null);

        return MaterializeUsersWithRolesAsync(query, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<ApplicationUser>> GetRetiredByNormalizedEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken = default)
    {
        List<ApplicationUser> users = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn != null
                && u.AnonymizedOn == null
                && u.NormalizedEmail == normalizedEmail)
            .ToListAsync(cancellationToken);

        return users;
    }

    /// <inheritdoc/>
    public Task<IEnumerable<ApplicationUser>> GetActiveUsersWithRolesAsync(CancellationToken cancellationToken = default)
    {
        IQueryable<ApplicationUser> query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null)
            .Where(u => u.IsActive);

        return MaterializeUsersWithRolesAsync(query, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<IEnumerable<ApplicationUser>> GetUsersWithRolesForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        IQueryable<ApplicationUser> query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null)
            .Where(u => _dbContext.UserTenantMemberships
                .Any(m => m.UserId == u.Id
                    && m.TenantId == tenantId
                    && m.DeletedOn == null
                    && (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Suspended)));

        return MaterializeUsersWithRolesAsync(query, cancellationToken);
    }

    /// <inheritdoc/>
    public Task<IEnumerable<ApplicationUser>> GetActiveUsersWithRolesForTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        IQueryable<ApplicationUser> query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null)
            .Where(u => u.IsActive)
            .Where(u => _dbContext.UserTenantMemberships
                .Any(m => m.UserId == u.Id && m.TenantId == tenantId && m.DeletedOn == null && m.Status == MembershipStatus.Active));

        return MaterializeUsersWithRolesAsync(query, cancellationToken);
    }

    /// <summary>
    /// Applies the shared roles + tenant-membership projection to the filtered user query,
    /// materializes it server-side, and hydrates each <see cref="ApplicationUser"/>.
    /// </summary>
    private async Task<IEnumerable<ApplicationUser>> MaterializeUsersWithRolesAsync(
        IQueryable<ApplicationUser> userQuery,
        CancellationToken cancellationToken)
    {
        var usersWithRoles = await userQuery
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .Select(u => new
            {
                User = u,
                Roles = _dbContext.UserRoles
                    .Where(ur => ur.UserId == u.Id)
                    .Join(_dbContext.Roles,
                        ur => ur.RoleId,
                        r => r.Id,
                        (ur, r) => r.Name!)
                    .ToList(),
                Memberships = _dbContext.UserTenantMemberships
                    .Where(m => m.UserId == u.Id && m.DeletedOn == null)
                    .Join(_dbContext.Tenants,
                        m => m.TenantId,
                        t => t.TenantId,
                        (m, t) => new UserTenantMembershipDto
                        {
                            TenantId = t.TenantId,
                            TenantDisplayName = t.DisplayName,
                            Role = m.Role,
                            IsDefault = m.IsDefault,
                            IsPrimary = m.IsDefault,
                            IsOwner = t.OwnerId == u.Id,
                            Status = m.Status.ToString(),
                        })
                    .OrderByDescending(s => s.IsPrimary)
                    .ThenBy(s => s.TenantDisplayName)
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return usersWithRoles.Select(x =>
        {
            x.User.Roles = x.Roles;
            x.User.TenantMembershipsSummary = x.Memberships;
            return x.User;
        });
    }

    /// <inheritdoc/>
    public Task<int> CountActiveUsersAsync(CancellationToken cancellationToken = default)
    {
        return _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null && u.IsActive)
            .CountAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public Task<int> CountUsersCreatedSinceAsync(DateTime sinceUtc, CancellationToken cancellationToken = default)
    {
        return _dbContext.Users
            .AsNoTracking()
            .Where(u => u.DeletedOn == null && u.CreatedOn >= sinceUtc)
            .CountAsync(cancellationToken);
    }
}
