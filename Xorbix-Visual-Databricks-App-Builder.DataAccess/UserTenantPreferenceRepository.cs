using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <inheritdoc/>
public class UserTenantPreferenceRepository(ApplicationDbContext _context) : IUserTenantPreferenceRepository
{
    /// <inheritdoc/>
    public async Task<int?> GetIntPreferenceAsync(
        Guid userId,
        Guid tenantId,
        string key,
        CancellationToken cancellationToken = default)
    {
        string? preferencesJson = await _context.UserTenantPreferences
            .AsNoTracking()
            .Where(p => p.UserId == userId && p.TenantId == tenantId && p.DeletedOn == null)
            .Select(p => p.PreferencesJson)
            .FirstOrDefaultAsync(cancellationToken);

        return preferencesJson is null
            ? null
            : UserTenantPreferencesDocument.GetInt(preferencesJson, key);
    }

    /// <inheritdoc/>
    public async Task<bool> UpsertIntPreferenceAsync(
        Guid userId,
        Guid tenantId,
        string key,
        int? value,
        CancellationToken cancellationToken = default)
    {
        bool membershipExists = await _context.UserTenantMemberships
            .AsNoTracking()
            .AnyAsync(
                m => m.UserId == userId && m.TenantId == tenantId && m.DeletedOn == null,
                cancellationToken);

        if (!membershipExists)
        {
            return false;
        }

        UserTenantPreference? preference = await _context.UserTenantPreferences
            .FirstOrDefaultAsync(
                p => p.UserId == userId && p.TenantId == tenantId && p.DeletedOn == null,
                cancellationToken);

        if (preference is null)
        {
            if (!value.HasValue)
            {
                return true;
            }

            preference = new UserTenantPreference
            {
                UserId = userId,
                TenantId = tenantId,
                PreferencesJson = UserTenantPreferencesDocument.SetIntOrRemove("{}", key, value),
                CreatedOn = DateTime.UtcNow,
            };
            _context.UserTenantPreferences.Add(preference);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        int? currentValue = UserTenantPreferencesDocument.GetInt(preference.PreferencesJson, key);
        if (currentValue == value)
        {
            return true;
        }

        string updatedJson = UserTenantPreferencesDocument.SetIntOrRemove(preference.PreferencesJson, key, value);
        if (updatedJson == "{}")
        {
            _context.UserTenantPreferences.Remove(preference);
        }
        else
        {
            preference.PreferencesJson = updatedJson;
            preference.ModifiedOn = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <inheritdoc/>
    public async Task ClearIntPreferenceForTenantAsync(
        Guid tenantId,
        string key,
        int intValue,
        CancellationToken cancellationToken = default)
    {
        List<UserTenantPreference> preferences = await _context.UserTenantPreferences
            .Where(p => p.TenantId == tenantId && p.DeletedOn == null)
            .ToListAsync(cancellationToken);

        DateTime now = DateTime.UtcNow;
        foreach (UserTenantPreference preference in preferences)
        {
            if (!UserTenantPreferencesDocument.ContainsIntValue(preference.PreferencesJson, key, intValue))
            {
                continue;
            }

            string updatedJson = UserTenantPreferencesDocument.SetIntOrRemove(preference.PreferencesJson, key, null);
            if (updatedJson == "{}")
            {
                _context.UserTenantPreferences.Remove(preference);
            }
            else
            {
                preference.PreferencesJson = updatedJson;
                preference.ModifiedOn = now;
            }
        }
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantPreferences
            .Where(p => p.TenantId == tenantId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserTenantPreferences
            .Where(p => p.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
